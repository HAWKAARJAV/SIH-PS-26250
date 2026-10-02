"""Event application, impact, and four explainable courses of action."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from optimiser.plan import build_plan, score
from optimiser.timeutil import add_minutes, minutes_between, parse_iso, to_iso
from optimiser.validator import validate

PRESETS: list[dict[str, Any]] = [
    {"id": "A", "name": "Minimal Change", "weights": {"stability": 400_000, "value": 1, "risk": 15, "lateness": 4}},
    {"id": "B", "name": "Maximum Value", "weights": {"stability": 20, "value": 1, "risk": 5, "lateness": 1}},
    {
        "id": "C",
        "name": "Lowest Risk",
        "weights": {"stability": 80, "value": 1, "risk": 8_000, "lateness": 2},
        "reserve_scale": 1.0,
    },
    {
        "id": "D",
        "name": "Robust",
        "weights": {"stability": 200, "value": 1, "risk": 40, "lateness": 6},
        "reserve_scale": 1.5,
    },
]


def apply_event(snapshot: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    data = deepcopy(snapshot)
    payload = event.get("payload") or {}
    kind = event["type"]
    if kind == "AIRCRAFT_NMC":
        _set_tail(data, payload["tail"], "NMC", 0.02)
    elif kind == "AIRCRAFT_RTS":
        _set_tail(data, payload["tail"], "FMC", 0.9)
    elif kind == "CREW_UNAVAILABLE":
        for person in data["crew"]:
            if person["id"] == payload["crew_id"]:
                person["status"] = "UNAVAILABLE"
    elif kind == "WEATHER_UPDATE":
        _weather(data, payload)
    elif kind == "THREAT_UPDATE":
        data["threats"].append(
            {
                "id": payload.get("id", "TZ-EVENT"),
                "kind": payload.get("kind", "pressure-ring"),
                "lat": payload.get("lat", 15.0),
                "lon": payload.get("lon", 65.4),
                "radius_nm": payload.get("radius_nm", 30),
                "existence_p": payload.get("existence_p", 0.9),
                "last_seen": data["now"],
                "ttl_min": 180,
                "growth_nm_per_h": 2,
                "freshness": "FRESH",
                "source_id": "TIP",
            }
        )
    elif kind == "AIRSPACE_CHANGE":
        for block in data["airspace"]:
            if block["id"] == payload.get("block_id"):
                block["exclusive"] = True
                block["owner"] = payload.get("owner", block["owner"])
    elif kind == "NEW_TASK":
        data["missions"].append(payload["mission"])
    elif kind == "TASK_CHANGED":
        for mission in data["missions"]:
            if mission["id"] == payload["mission_id"]:
                mission.update(payload.get("changes") or {})
    elif kind == "BASE_STATUS":
        for base in data["bases"]:
            if base["id"] == payload["base_id"]:
                base["status"] = payload.get("status", "CLOSED")
                if payload.get("closures"):
                    base["closures"] = payload["closures"]
    elif kind == "TANKER_UNAVAILABLE":
        data["tankers"] = [row for row in data["tankers"] if row["id"] != payload["tanker_id"]]
    elif kind == "SORTIE_FEEDBACK":
        for mission in data["missions"]:
            if mission["id"] == payload.get("mission_id"):
                mission["status"] = payload.get("status", "AIRBORNE")
    elif kind == "GUIDANCE_CHANGE":
        data["parameters"]["weights"].update(payload.get("weights") or {})
        if "reserve_by_type" in payload:
            data["parameters"]["reserve_by_type"].update(payload["reserve_by_type"])
    return data


def impact(snapshot: dict[str, Any], assignments: list[dict[str, Any]], event: dict[str, Any]) -> dict[str, Any]:
    payload = event.get("payload") or {}
    affected: set[str] = set()
    kind = event["type"]
    if kind in {"AIRCRAFT_NMC", "AIRCRAFT_RTS"}:
        affected |= {row["mission_id"] for row in assignments if row["tail"] == payload.get("tail")}
    elif kind == "CREW_UNAVAILABLE":
        affected |= {row["mission_id"] for row in assignments if payload.get("crew_id") in row["crew_ids"]}
    elif kind in {"WEATHER_UPDATE", "BASE_STATUS"}:
        base_id = payload.get("base_id")
        affected |= {m["id"] for m in snapshot["missions"] if m["launch_base"] == base_id}
    elif kind == "THREAT_UPDATE":
        affected |= {m["id"] for m in snapshot["missions"]}
    elif kind == "AIRSPACE_CHANGE":
        block_id = payload.get("block_id")
        affected |= {m["id"] for m in snapshot["missions"] if block_id in m["airspace_ids"]}
    elif kind in {"NEW_TASK", "TASK_CHANGED"}:
        affected.add(payload.get("mission_id") or payload.get("mission", {}).get("id", ""))
    elif kind == "TANKER_UNAVAILABLE":
        affected |= {row["mission_id"] for row in assignments if row.get("tanker_id") == payload.get("tanker_id")}
    elif kind == "SORTIE_FEEDBACK":
        affected.add(payload.get("mission_id", ""))
    affected.discard("")
    missions = {m["id"]: m for m in snapshot["missions"]}
    changed = True
    while changed:
        changed = False
        for mission in snapshot["missions"]:
            linked = {dep["mission_id"] for dep in mission.get("dependencies", [])}
            if mission["id"] in affected and linked - affected:
                affected |= linked
                changed = True
            if linked & affected and mission["id"] not in affected:
                affected.add(mission["id"])
                changed = True
    epoch = parse_iso(snapshot["epoch"])
    starts = [
        minutes_between(epoch, parse_iso(row["start"]))
        for row in assignments
        if row["mission_id"] in affected
    ]
    prep = int(snapshot["parameters"]["prep_min"])
    deadline = None
    if starts:
        deadline = to_iso(add_minutes(epoch, min(starts) - prep - 15))
    return {
        "affected_missions": sorted(affected),
        "affected_resources": sorted({row["tail"] for row in assignments if row["mission_id"] in affected}),
        "decision_deadline": deadline,
        "t_minus_min": (min(starts) - prep - 15) if starts else None,
        "neighbourhood": len(affected),
        "missions": len(missions),
    }


def courses_of_action(
    snapshot: dict[str, Any],
    assignments: list[dict[str, Any]],
    event: dict[str, Any],
    *,
    time_limit: float = 2.0,
    seed: int = 1,
) -> list[dict[str, Any]]:
    updated = apply_event(snapshot, event)
    blast = impact(snapshot, assignments, event)
    affected = set(blast["affected_missions"])
    frozen = [row for row in assignments if row["mission_id"] not in affected]
    if frozen and not validate(updated, frozen)["valid"]:
        frozen = []
    results = []
    seen: set[tuple[tuple[str, str, str], ...]] = set()
    for preset in PRESETS:
        working = deepcopy(updated)
        scale = float(preset.get("reserve_scale") or 1)
        reserve = working["parameters"]["reserve_by_type"]
        fmc: dict[str, int] = {}
        for craft in working["aircraft"]:
            if craft.get("effective_status", craft["status"]) == "FMC":
                fmc[craft["type_id"]] = fmc.get(craft["type_id"], 0) + 1
        working["parameters"]["reserve_by_type"] = {
            key: min(fmc.get(key, 0), max(0, int(round(int(value) * scale))))
            for key, value in reserve.items()
        }
        working["parameters"]["weights"] = {**working["parameters"]["weights"], **preset["weights"]}
        built = build_plan(
            working,
            time_limit=time_limit,
            seed=seed,
            workers=1,
            frozen=frozen,
            weights=preset["weights"],
            previous=assignments,
        )
        if not built["validation"]["valid"]:
            continue
        signature = tuple(sorted((row["mission_id"], row["tail"], row["start"]) for row in built["assignments"]))
        if signature in seen:
            continue
        seen.add(signature)
        before = {(row["mission_id"], row["slot"]): row for row in assignments}
        changes = 0
        for row in built["assignments"]:
            prior = before.get((row["mission_id"], row["slot"]))
            if prior is None or prior["tail"] != row["tail"] or prior["start"] != row["start"]:
                changes += 1
        changes += len(before) - len({(row["mission_id"], row["slot"]) for row in built["assignments"]})
        metrics = score(working, built["assignments"])
        results.append(
            {
                "id": preset["id"],
                "name": preset["name"],
                "recommended": False,
                "rationale": "",
                "changes": changes,
                "metrics": metrics,
                "validation": built["validation"],
                "label": built["label"],
                "assignments": built["assignments"],
                "diff": _diff(assignments, built["assignments"]),
            }
        )
    if not results:
        return []
    ranked = sorted(results, key=lambda row: (-row["metrics"]["value_weighted_fulfilment"], row["changes"]))
    best = min(results, key=lambda row: (row["changes"], -row["metrics"]["value_weighted_fulfilment"]))
    # Recommend minimal change when it keeps value within 1 point of the best, else the best value.
    recommended = best if best["metrics"]["value_weighted_fulfilment"] + 0.01 >= ranked[0]["metrics"]["value_weighted_fulfilment"] else ranked[0]
    for row in results:
        row["recommended"] = row["id"] == recommended["id"]
        if row["recommended"]:
            row["rationale"] = (
                f"{row['name']} keeps {row['metrics']['missions_served']} missions with {row['changes']} changes."
            )
    return results


def _set_tail(data: dict[str, Any], tail: str, status: str, p_value: float) -> None:
    for craft in data["aircraft"]:
        if craft["tail"] == tail:
            craft["status"] = status
            craft["effective_status"] = status
            craft["p_mc"] = {key: p_value for key in craft["p_mc"]}


def _weather(data: dict[str, Any], payload: dict[str, Any]) -> None:
    base_id = payload.get("base_id", "BASE-BRAVO")
    ceiling = int(payload.get("ceiling_ft", 600))
    vis = int(payload.get("vis_m", 2000))
    for row in data["weather"]:
        if row["base_id"] != base_id:
            continue
        row["ceiling_ft"] = ceiling
        row["vis_m"] = vis
        row["freshness"] = payload.get("freshness", "FRESH")
        for member in row.get("ensemble") or []:
            member["ceiling_ft"] = ceiling
            member["vis_m"] = vis


def _diff(before: list[dict[str, Any]], after: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prior = {(row["mission_id"], row["slot"]): row for row in before}
    changes = []
    for row in after:
        key = (row["mission_id"], row["slot"])
        old = prior.get(key)
        if old is None:
            changes.append({"mission_id": row["mission_id"], "kind": "added", "tail": row["tail"], "start": row["start"]})
        elif old["tail"] != row["tail"] or old["start"] != row["start"]:
            changes.append(
                {
                    "mission_id": row["mission_id"],
                    "kind": "moved",
                    "from_tail": old["tail"],
                    "tail": row["tail"],
                    "from_start": old["start"],
                    "start": row["start"],
                }
            )
    after_keys = {(row["mission_id"], row["slot"]) for row in after}
    for key, old in prior.items():
        if key not in after_keys:
            changes.append({"mission_id": old["mission_id"], "kind": "dropped", "tail": old["tail"]})
    return changes
