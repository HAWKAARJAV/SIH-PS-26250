"""Priority-first greedy dispatcher. This is baseline B1: no lookahead."""

from __future__ import annotations

from typing import Any

from optimiser.timeutil import add_minutes, minutes_between, parse_iso, snap5, to_iso
from optimiser.validator import validate


def greedy(
    snapshot: dict[str, Any],
    frozen: list[dict[str, Any]] | None = None,
    *,
    accept_pmc: bool = False,
    reserve_scale: float = 1.0,
) -> list[dict[str, Any]]:
    params = {**snapshot["parameters"], "accept_pmc": accept_pmc or snapshot["parameters"].get("accept_pmc")}
    working = {**snapshot, "parameters": params}
    plan = [dict(row) for row in (frozen or [])]
    held = _reserve_tails(working, reserve_scale)
    missions = sorted(snapshot["missions"], key=lambda m: (m["priority"], -m["value"], m["id"]))
    for mission in missions:
        if any(row["mission_id"] == mission["id"] for row in plan):
            continue
        placed = _place(working, plan, mission, held)
        if placed:
            plan.extend(placed)
    return plan


def _reserve_tails(snapshot: dict[str, Any], scale: float) -> set[str]:
    held: set[str] = set()
    for type_id, need in snapshot["parameters"]["reserve_by_type"].items():
        pool = [
            a
            for a in snapshot["aircraft"]
            if a["type_id"] == type_id and a.get("effective_status", a["status"]) == "FMC"
        ]
        pool.sort(key=lambda a: float(a["p_mc"]["6h"]), reverse=True)
        count = int(round(int(need) * scale))
        held.update(a["tail"] for a in pool[:count])
    return held


def _place(
    snapshot: dict[str, Any],
    plan: list[dict[str, Any]],
    mission: dict[str, Any],
    held: set[str],
) -> list[dict[str, Any]] | None:
    epoch = parse_iso(snapshot["epoch"])
    preferred = minutes_between(epoch, parse_iso(mission["preferred_start"]))
    partner = _partner_start(snapshot, plan, mission, epoch)
    starts = _starts(mission, epoch, partner if partner is not None else preferred)
    aircraft: dict[str, list[dict[str, Any]]] = {a["type_id"]: [] for a in snapshot["aircraft"]}
    for craft in snapshot["aircraft"]:
        aircraft.setdefault(craft["type_id"], []).append(craft)
    crew_by_qual: dict[str, list[dict[str, Any]]] = {}
    for person in snapshot["crew"]:
        for qual in person["quals"]:
            crew_by_qual.setdefault(qual, []).append(person)
    for start in starts:
        choice = _assign_slots(snapshot, mission, start, epoch, aircraft, crew_by_qual, held, plan)
        if choice is None:
            continue
        trial = plan + choice
        if validate(snapshot, trial)["valid"]:
            return choice
    return None


def _partner_start(
    snapshot: dict[str, Any], plan: list[dict[str, Any]], mission: dict[str, Any], epoch: Any
) -> int | None:
    for dep in mission.get("dependencies", []):
        if dep["kind"] != "SYNC":
            continue
        rows = [row for row in plan if row["mission_id"] == dep["mission_id"]]
        if rows:
            return minutes_between(epoch, parse_iso(rows[0]["start"]))
    return None


def _starts(mission: dict[str, Any], epoch: Any, preferred: int) -> list[int]:
    window_start = minutes_between(epoch, parse_iso(mission["window_start"]))
    window_end = minutes_between(epoch, parse_iso(mission["window_end"])) - int(mission["duration_min"])
    lo = snap5(max(0, window_start))
    hi = snap5(window_end)
    if hi < lo:
        return []
    raw = [preferred]
    for step in range(15, 8 * 60, 15):
        raw.append(preferred - step)
        raw.append(preferred + step)
    seen: set[int] = set()
    ordered: list[int] = []
    for minute in raw:
        snapped = snap5(minute)
        if snapped < lo or snapped > hi or snapped in seen:
            continue
        seen.add(snapped)
        ordered.append(snapped)
        if len(ordered) >= 8:
            break
    return ordered


def _assign_slots(
    snapshot: dict[str, Any],
    mission: dict[str, Any],
    start: int,
    epoch: Any,
    aircraft: dict[str, list[dict[str, Any]]],
    crew_by_qual: dict[str, list[dict[str, Any]]],
    held: set[str],
    plan: list[dict[str, Any]],
) -> list[dict[str, Any]] | None:
    used_tails = {row["tail"] for row in plan}
    used_crew = {cid for row in plan for cid in row["crew_ids"]}
    rows: list[dict[str, Any]] = []
    tanker = _tanker(snapshot, mission, plan) if mission.get("needs_aar") else None
    if mission.get("needs_aar") and tanker is None:
        return None
    for slot in mission["slots"]:
        craft = _pick_aircraft(aircraft.get(slot["type_id"], []), held, used_tails, mission)
        if craft is None:
            return None
        people = _pick_crew(slot, crew_by_qual, used_crew, craft["base_id"])
        if people is None:
            return None
        used_tails.add(craft["tail"])
        used_crew.update(person["id"] for person in people)
        when = add_minutes(epoch, start)
        rows.append(
            {
                "mission_id": mission["id"],
                "slot": slot["slot"],
                "tail": craft["tail"],
                "crew_ids": [person["id"] for person in people],
                "load_out": slot["load_out"],
                "start": to_iso(when),
                "end": to_iso(add_minutes(when, int(mission["duration_min"]))),
                "duration_min": int(mission["duration_min"]),
                "base_launch": mission["launch_base"],
                "base_recover": mission["recover_base"],
                "tanker_id": tanker,
                "frozen": False,
            }
        )
    return rows


def _pick_aircraft(
    pool: list[dict[str, Any]], held: set[str], used: set[str], mission: dict[str, Any]
) -> dict[str, Any] | None:
    ranked = [
        craft
        for craft in pool
        if craft["tail"] not in held
        and craft["tail"] not in used
        and craft["base_id"] == mission["launch_base"]
        and craft.get("effective_status", craft["status"]) == "FMC"
        and float(craft["p_mc"]["6h"]) >= 0.7
    ]
    ranked.sort(key=lambda craft: float(craft["p_mc"]["6h"]), reverse=True)
    return ranked[0] if ranked else None


def _pick_crew(
    slot: dict[str, Any],
    crew_by_qual: dict[str, list[dict[str, Any]]],
    used: set[str],
    base_id: str,
) -> list[dict[str, Any]] | None:
    chosen: list[dict[str, Any]] = []
    local_used = set(used)
    needed = list(slot["quals"])
    if slot["type_id"] not in needed:
        needed.append(slot["type_id"])
    # One person may cover role and currency together.
    for qual in slot["quals"]:
        options = [
            person
            for person in crew_by_qual.get(qual, [])
            if person["id"] not in local_used
            and person["status"] == "AVAILABLE"
            and slot["type_id"] in person["quals"]
            and person["base_id"] == base_id
        ]
        options.sort(key=lambda person: float(person["fatigue_index"]))
        if not options:
            return None
        chosen.append(options[0])
        local_used.add(options[0]["id"])
    return chosen


def _tanker(snapshot: dict[str, Any], mission: dict[str, Any], plan: list[dict[str, Any]]) -> str | None:
    busy = {row["tanker_id"] for row in plan if row.get("tanker_id")}
    for tanker in snapshot["tankers"]:
        if tanker["id"] not in busy and tanker["base_id"] == mission["launch_base"]:
            return str(tanker["id"])
    for tanker in snapshot["tankers"]:
        if tanker["id"] not in busy:
            return str(tanker["id"])
    return None
