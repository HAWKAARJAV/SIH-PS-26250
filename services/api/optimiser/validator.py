"""Independent hard-constraint checks. The UI may say valid only when this agrees."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from optimiser.geo import route_exposure_nm
from optimiser.timeutil import minutes_between, parse_iso, to_dtg

Violation = dict[str, Any]


def validate(snapshot: dict[str, Any], assignments: list[dict[str, Any]]) -> dict[str, Any]:
    epoch = parse_iso(snapshot["epoch"])
    params = snapshot["parameters"]
    missions = {m["id"]: m for m in snapshot["missions"]}
    aircraft = {a["tail"]: a for a in snapshot["aircraft"]}
    types = {t["id"]: t for t in snapshot["aircraft_types"]}
    crew = {c["id"]: c for c in snapshot["crew"]}
    bases = {b["id"]: b for b in snapshot["bases"]}
    airspace = {a["id"]: a for a in snapshot["airspace"]}
    errors: list[Violation] = []

    by_mission: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for assignment in assignments:
        by_mission[assignment["mission_id"]].append(assignment)
        _check_one(snapshot, assignment, missions, aircraft, types, crew, bases, airspace, epoch, params, errors)

    _check_packages(by_mission, missions, errors)
    _check_overlaps(assignments, aircraft, types, crew, missions, epoch, params, errors)
    _check_hours(assignments, crew, missions, epoch, params, errors)
    _check_stock(assignments, snapshot, errors)
    _check_rates(assignments, bases, missions, epoch, errors)
    _check_airspace(assignments, missions, airspace, epoch, errors)
    _check_dependencies(by_mission, missions, epoch, errors)
    _check_reserve(assignments, snapshot, errors)
    _check_tankers(assignments, snapshot, missions, epoch, errors)
    return {"valid": not errors, "violations": errors, "warnings": _warnings(assignments, crew)}


def _mins(epoch: Any, iso: str) -> int:
    return minutes_between(epoch, parse_iso(iso))


def _check_one(
    snapshot: dict[str, Any],
    assignment: dict[str, Any],
    missions: dict[str, Any],
    aircraft: dict[str, Any],
    types: dict[str, Any],
    crew: dict[str, Any],
    bases: dict[str, Any],
    airspace: dict[str, Any],
    epoch: Any,
    params: dict[str, Any],
    errors: list[Violation],
) -> None:
    mission = missions.get(assignment["mission_id"])
    if mission is None:
        errors.append(_err("UNKNOWN_MISSION", f"{assignment['mission_id']} is not in this scenario.", assignment))
        return
    slot = next((s for s in mission["slots"] if s["slot"] == assignment["slot"]), None)
    craft = aircraft.get(assignment["tail"])
    if slot is None or craft is None:
        errors.append(_err("UNKNOWN_RESOURCE", "That slot or tail is not in the scenario.", assignment))
        return
    start = _mins(epoch, assignment["start"])
    if start % 5 != 0:
        errors.append(_err("GRID", f"{mission['id']} does not sit on the 5-minute grid.", assignment))
    window_start = _mins(epoch, mission["window_start"])
    window_end = _mins(epoch, mission["window_end"])
    if start < window_start or start + mission["duration_min"] > window_end:
        errors.append(_err("WINDOW", f"{mission['id']} sits outside its time window.", assignment))
    if craft["type_id"] != slot["type_id"]:
        errors.append(_err("TYPE", f"{craft['tail']} is not the type {mission['id']} asked for.", assignment))
    if assignment["load_out"] != slot["load_out"]:
        errors.append(_err("LOADOUT", f"{mission['id']} requires {slot['load_out']}.", assignment))
    if slot["load_out"] not in types[craft["type_id"]]["load_out_compat"]:
        errors.append(_err("COMPAT", f"{craft['tail']} cannot carry {slot['load_out']}.", assignment))
    status = craft.get("effective_status", craft["status"])
    accept_pmc = bool(params.get("accept_pmc"))
    if status == "NMC" or (status == "PMC" and not accept_pmc) or status not in {"FMC", "PMC"}:
        errors.append(_err("STATUS", f"{craft['tail']} is {status} and cannot take {mission['id']}.", assignment))
    threshold = params["pmc_p_mc_min"] if status == "PMC" else params["p_mc_min"]
    if float(craft["p_mc"]["6h"]) < float(threshold):
        errors.append(
            _err("RELIABILITY", f"{craft['tail']} is below the serviceability threshold for {mission['id']}.", assignment)
        )
    ready = _mins(epoch, craft["ready_at"]) if craft.get("ready_at") else 0
    if start < ready:
        errors.append(_err("READY", f"{craft['tail']} is not ready at {to_dtg(parse_iso(assignment['start']))}.", assignment))
    _check_crew(assignment, slot, crew, errors)
    _check_closure(bases.get(assignment["base_launch"]), start, epoch, mission, assignment, errors)
    _check_weather(snapshot, mission, assignment, start, epoch, params, errors)
    _check_threat(snapshot, mission, assignment, errors)
    for block_id in mission["airspace_ids"]:
        block = airspace.get(block_id)
        if block and block["owner"] == "civil" and craft["type_id"] in {"MRF", "INT"}:
            errors.append(_err("CIVIL", f"{mission['id']} cannot use civil block {block_id}.", assignment))


def _check_crew(assignment: dict[str, Any], slot: dict[str, Any], crew: dict[str, Any], errors: list[Violation]) -> None:
    seen: set[str] = set()
    covered: list[str] = []
    for crew_id in assignment.get("crew_ids", []):
        person = crew.get(crew_id)
        if person is None:
            errors.append(_err("UNKNOWN_CREW", f"{crew_id} is not on the roster.", assignment))
            continue
        if person["status"] != "AVAILABLE":
            errors.append(_err("CREW_STATUS", f"{crew_id} is {person['status']}.", assignment))
        if crew_id in seen:
            errors.append(_err("CREW_DUP", f"{crew_id} is listed twice on the same sortie.", assignment))
        seen.add(crew_id)
        covered.extend(person["quals"])
    for qual in slot["quals"]:
        if qual not in covered:
            errors.append(_err("QUAL", f"Missing qualification {qual} on {assignment['mission_id']}.", assignment))
    if slot["type_id"] not in covered:
        errors.append(_err("CURRENCY", f"No crew current on {slot['type_id']} for {assignment['mission_id']}.", assignment))


def _check_closure(
    base: dict[str, Any] | None,
    start: int,
    epoch: Any,
    mission: dict[str, Any],
    assignment: dict[str, Any],
    errors: list[Violation],
) -> None:
    if base is None:
        errors.append(_err("BASE", "Launch base is missing.", assignment))
        return
    if base["status"] == "CLOSED" and not base.get("closures"):
        errors.append(_err("BASE_CLOSED", f"{base['id']} is closed.", assignment))
    for window in base.get("closures", []):
        if _mins(epoch, window["start"]) <= start < _mins(epoch, window["end"]):
            errors.append(
                _err("BASE_CLOSED", f"{mission['id']} launches while {base['id']} is closed.", assignment)
            )


def _check_weather(
    snapshot: dict[str, Any],
    mission: dict[str, Any],
    assignment: dict[str, Any],
    start: int,
    epoch: Any,
    params: dict[str, Any],
    errors: list[Violation],
) -> None:
    rows = [
        w
        for w in snapshot["weather"]
        if w["base_id"] == assignment["base_launch"] and _mins(epoch, w["valid_from"]) <= start < _mins(epoch, w["valid_to"])
    ]
    if not rows:
        errors.append(_err("WEATHER", f"No weather covers the launch of {mission['id']}.", assignment))
        return
    row = rows[0]
    minima = mission["wx_minima"]
    members = row.get("ensemble") or [{"ceiling_ft": row["ceiling_ft"], "vis_m": row["vis_m"]}]
    hits = sum(1 for m in members if m["ceiling_ft"] >= minima["ceiling_ft"] and m["vis_m"] >= minima["vis_m"])
    p_go = hits / len(members)
    required = params["stale_wx_p_go_min"] if row.get("freshness") == "STALE" else params["p_go_min"]
    if p_go < required:
        errors.append(
            _err(
                "WEATHER",
                f"{mission['id']} has P(go) {p_go:.2f}, below {required:.2f} at {assignment['base_launch']}.",
                assignment,
            )
        )


def _check_threat(snapshot: dict[str, Any], mission: dict[str, Any], assignment: dict[str, Any], errors: list[Violation]) -> None:
    route = mission.get("route") or []
    for threat in snapshot["threats"]:
        radius = float(threat["radius_nm"]) * (1.25 if threat.get("freshness") == "STALE" else 1)
        if float(threat["existence_p"]) < 0.8:
            continue
        if route_exposure_nm(route, (float(threat["lat"]), float(threat["lon"]))) < radius:
            errors.append(
                _err("THREAT", f"{mission['id']} crosses no-go zone {threat['id']}.", assignment)
            )


def _check_packages(by_mission: dict[str, list[dict[str, Any]]], missions: dict[str, Any], errors: list[Violation]) -> None:
    for mission_id, rows in by_mission.items():
        mission = missions.get(mission_id)
        if mission is None:
            continue
        if len(rows) != len(mission["slots"]):
            errors.append(_err("PACKAGE", f"{mission_id} is missing a package slot.", rows[0]))
        starts = {row["start"] for row in rows}
        if len(starts) > 1:
            errors.append(_err("SYNC", f"{mission_id} package slots do not launch together.", rows[0]))
        tails = [row["tail"] for row in rows]
        if len(tails) != len(set(tails)):
            errors.append(_err("TAIL_DUP", f"{mission_id} uses the same tail twice.", rows[0]))


def _busy(start: int, duration: int, prep: int, turnaround: int) -> tuple[int, int]:
    return start - prep, start + duration + turnaround


def _duration(assignment: dict[str, Any], missions: dict[str, Any]) -> int:
    mission = missions.get(assignment["mission_id"])
    if mission is None:
        return int(assignment.get("duration_min") or 0)
    return int(mission["duration_min"])


def _check_overlaps(
    assignments: list[dict[str, Any]],
    aircraft: dict[str, Any],
    types: dict[str, Any],
    crew: dict[str, Any],
    missions: dict[str, Any],
    epoch: Any,
    params: dict[str, Any],
    errors: list[Violation],
) -> None:
    prep = int(params["prep_min"])
    per_tail: dict[str, list[tuple[int, int, str]]] = defaultdict(list)
    per_crew: dict[str, list[tuple[int, int, str]]] = defaultdict(list)
    for assignment in assignments:
        craft = aircraft.get(assignment["tail"])
        if craft is None:
            continue
        start = _mins(epoch, assignment["start"])
        duration = _duration(assignment, missions)
        if not duration:
            continue
        turnaround = int(types[craft["type_id"]]["min_turnaround_min"])
        per_tail[assignment["tail"]].append((*_busy(start, duration, prep, turnaround), assignment["mission_id"]))
        crew_end_pad = 15
        for crew_id in assignment.get("crew_ids", []):
            if crew_id in crew:
                per_crew[crew_id].append(
                    (*_busy(start, duration, prep, crew_end_pad), assignment["mission_id"])
                )
    _pair_overlaps(per_tail, "AIRCRAFT_OVERLAP", "is already flying or turning", errors)
    _pair_overlaps(per_crew, "CREW_OVERLAP", "is already tasked", errors)
    for tail, spans in per_tail.items():
        if len(spans) > int(params["max_sorties_day"]):
            errors.append(_err("SORTIES", f"{tail} exceeds the daily sortie limit.", {"tail": tail}))


def _pair_overlaps(
    groups: dict[str, list[tuple[int, int, str]]], code: str, verb: str, errors: list[Violation]
) -> None:
    for key, spans in groups.items():
        ordered = sorted(spans)
        for prev, nxt in zip(ordered, ordered[1:], strict=False):
            if nxt[0] < prev[1]:
                errors.append(_err(code, f"{key} {verb} between {prev[2]} and {nxt[2]}.", {"id": key}))


def _check_hours(
    assignments: list[dict[str, Any]],
    crew: dict[str, Any],
    missions: dict[str, Any],
    epoch: Any,
    params: dict[str, Any],
    errors: list[Violation],
) -> None:
    flown: dict[str, int] = defaultdict(int)
    for assignment in assignments:
        mission = missions.get(assignment["mission_id"])
        if mission is None:
            continue
        for crew_id in assignment.get("crew_ids", []):
            flown[crew_id] += int(mission["duration_min"])
            person = crew.get(crew_id)
            if person is None:
                continue
            available = _mins(epoch, person["available_at"]) if person.get("available_at") else 0
            if _mins(epoch, assignment["start"]) < available:
                when = to_dtg(parse_iso(assignment["start"]))
                errors.append(_err("REST", f"{crew_id} has not finished minimum rest at {when}.", assignment))
    for crew_id, extra in flown.items():
        person = crew.get(crew_id)
        if person is None:
            continue
        total = int(float(person["hours_24h"]) * 60) + extra
        if total > int(params["flight_limit_24h_min"]):
            errors.append(_err("DUTY", f"{crew_id} would exceed the duty limit.", {"crew_id": crew_id}))


def _check_stock(assignments: list[dict[str, Any]], snapshot: dict[str, Any], errors: list[Violation]) -> None:
    used: dict[tuple[str, str], int] = defaultdict(int)
    for assignment in assignments:
        used[(assignment["base_launch"], assignment["load_out"])] += 1
    stock = {(s["base_id"], s["code"]): s for s in snapshot["stocks"]}
    for key, count in used.items():
        row = stock.get(key)
        if row is None or count > int(row["qty"]) - int(row["reserve_min"]):
            errors.append(_err("STOCK", f"Not enough {key[1]} at {key[0]} after reserve.", {"base": key[0]}))


def _check_rates(
    assignments: list[dict[str, Any]],
    bases: dict[str, Any],
    missions: dict[str, Any],
    epoch: Any,
    errors: list[Violation],
) -> None:
    launches: dict[tuple[str, int], int] = defaultdict(int)
    recovers: dict[tuple[str, int], int] = defaultdict(int)
    for assignment in assignments:
        mission = missions.get(assignment["mission_id"])
        if mission is None:
            continue
        start = _mins(epoch, assignment["start"])
        end = start + int(mission["duration_min"])
        launches[(assignment["base_launch"], start // 15)] += 1
        recovers[(assignment["base_recover"], end // 15)] += 1
    for (base_id, _bin), count in launches.items():
        base = bases.get(base_id)
        if base and count > int(base["launch_rate_15m"]):
            errors.append(_err("LAUNCH_RATE", f"{base_id} exceeds its 15-minute launch rate.", {"base": base_id}))
    for (base_id, _bin), count in recovers.items():
        base = bases.get(base_id)
        if base and count > int(base["recovery_rate_15m"]):
            errors.append(_err("RECOVERY_RATE", f"{base_id} exceeds its 15-minute recovery rate.", {"base": base_id}))


def _check_airspace(
    assignments: list[dict[str, Any]],
    missions: dict[str, Any],
    airspace: dict[str, Any],
    epoch: Any,
    errors: list[Violation],
) -> None:
    spans: dict[str, list[tuple[int, int, str]]] = defaultdict(list)
    seen: set[tuple[str, str]] = set()
    for assignment in assignments:
        mission = missions.get(assignment["mission_id"])
        if mission is None:
            continue
        start = _mins(epoch, assignment["start"])
        end = start + int(mission["duration_min"])
        for block_id in mission["airspace_ids"]:
            block = airspace.get(block_id)
            if not block or not block["exclusive"]:
                continue
            key = (block_id, mission["id"])
            if key in seen:
                continue
            seen.add(key)
            spans[block_id].append((start, end, mission["id"]))
    _pair_overlaps(spans, "AIRSPACE", "double-books exclusive airspace", errors)


def _check_dependencies(
    by_mission: dict[str, list[dict[str, Any]]],
    missions: dict[str, Any],
    epoch: Any,
    errors: list[Violation],
) -> None:
    for mission_id, rows in by_mission.items():
        mission = missions.get(mission_id)
        if mission is None or not rows:
            continue
        start = _mins(epoch, rows[0]["start"])
        for dep in mission.get("dependencies", []):
            other_rows = by_mission.get(dep["mission_id"])
            other = missions.get(dep["mission_id"])
            if dep["kind"] == "SYNC" and not other_rows:
                continue
            if not other_rows or other is None:
                errors.append(_err("DEPENDENCY", f"{mission_id} depends on unserved {dep['mission_id']}.", rows[0]))
                continue
            other_start = _mins(epoch, other_rows[0]["start"])
            other_end = other_start + int(other["duration_min"])
            if dep["kind"] == "AFTER" and start < other_end:
                errors.append(_err("DEPENDENCY", f"{mission_id} must follow {dep['mission_id']}.", rows[0]))
            if dep["kind"] == "BEFORE" and other_start < start + int(mission["duration_min"]):
                errors.append(_err("DEPENDENCY", f"{mission_id} must precede {dep['mission_id']}.", rows[0]))
            if dep["kind"] == "SYNC" and abs(start - other_start) > int(dep.get("within_min") or 0):
                errors.append(_err("DEPENDENCY", f"{mission_id} is outside the sync window with {dep['mission_id']}.", rows[0]))


def _check_reserve(assignments: list[dict[str, Any]], snapshot: dict[str, Any], errors: list[Violation]) -> None:
    used = {a["tail"] for a in assignments}
    reserve = snapshot["parameters"]["reserve_by_type"]
    for type_id, need in reserve.items():
        free = [
            a
            for a in snapshot["aircraft"]
            if a["type_id"] == type_id and a.get("effective_status", a["status"]) == "FMC" and a["tail"] not in used
        ]
        if len(free) < int(need):
            errors.append(_err("RESERVE", f"Reserve for {type_id} falls short ({len(free)} of {need}).", {"type": type_id}))


def _check_tankers(
    assignments: list[dict[str, Any]],
    snapshot: dict[str, Any],
    missions: dict[str, Any],
    epoch: Any,
    errors: list[Violation],
) -> None:
    used: dict[str, list[tuple[int, int, str]]] = defaultdict(list)
    for assignment in assignments:
        mission = missions.get(assignment["mission_id"])
        if mission is None:
            continue
        if mission.get("needs_aar") and not assignment.get("tanker_id"):
            errors.append(_err("AAR", f"{mission['id']} needs a tanker and has none.", assignment))
        tanker_id = assignment.get("tanker_id")
        if not tanker_id:
            continue
        start = _mins(epoch, assignment["start"])
        used[tanker_id].append((start, start + int(mission["duration_min"]), mission["id"]))
    _pair_overlaps(used, "TANKER", "is already giving fuel", errors)


def _warnings(assignments: list[dict[str, Any]], crew: dict[str, Any]) -> list[Violation]:
    notes = []
    for assignment in assignments:
        for crew_id in assignment.get("crew_ids", []):
            person = crew.get(crew_id)
            if person and float(person["fatigue_index"]) >= 0.75:
                notes.append(_err("FATIGUE", f"{crew_id} is high on the fatigue index.", assignment))
    return notes


def _err(code: str, message: str, ref: dict[str, Any]) -> Violation:
    return {"code": code, "message": message, "ref": ref.get("mission_id") or ref.get("id") or ref.get("tail")}
