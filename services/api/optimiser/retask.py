"""Event application, impact, and four explainable courses of action."""

from __future__ import annotations

import os
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from copy import deepcopy
from typing import Any

from optimiser.plan import build_plan, score
from optimiser.stability import stability_metrics
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
    {
        "id": "R",
        "name": "Reserve Release",
        "weights": {"stability": 40, "value": 1, "risk": 10, "lateness": 1},
        "reserve_scale": 0,
        "release_reserve": True,
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
        from optimiser.geo import route_exposure_nm

        lat = float(payload.get("lat", 15.0))
        lon = float(payload.get("lon", 65.4))
        radius = float(payload.get("radius_nm", 30))
        for mission in snapshot["missions"]:
            route = mission.get("route") or []
            if route_exposure_nm(route, (lat, lon)) < radius * 2:
                affected.add(mission["id"])
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
    tails = {row["tail"] for row in assignments if row["mission_id"] in affected}
    crews = {crew_id for row in assignments if row["mission_id"] in affected for crew_id in row["crew_ids"]}
    tankers = {row["tanker_id"] for row in assignments if row["mission_id"] in affected and row.get("tanker_id")}
    bases = {
        missions[mid]["launch_base"]
        for mid in affected
        if mid in missions
    }
    return {
        "affected_missions": sorted(affected),
        "affected_aircraft": sorted(tails),
        "affected_crews": sorted(crews),
        "affected_tankers": sorted(tankers),
        "affected_bases": sorted(bases),
        "affected_resources": sorted(tails),
        "decision_deadline": deadline,
        "decision_deadline_dtg": deadline,
        "t_minus_min": (min(starts) - prep - 15) if starts else None,
        "neighbourhood": len(affected),
        "missions": len(missions),
        "summary": (
            f"{len(affected)} missions · {len(tails)} aircraft · {len(crews)} crews · "
            f"{len(tankers)} tankers · {len(bases)} bases"
        ),
    }


def _frozen_for_preset(
    preset_id: str,
    assignments: list[dict[str, Any]],
    affected: set[str],
    snapshot: dict[str, Any],
) -> list[dict[str, Any]]:
    epoch = parse_iso(snapshot["epoch"])
    now_min = minutes_between(epoch, parse_iso(snapshot["now"]))
    window = int(snapshot["parameters"]["freeze_window_min"])
    frozen: list[dict[str, Any]] = []
    for row in assignments:
        mission_id = row["mission_id"]
        if mission_id in affected:
            continue
        start_min = minutes_between(epoch, parse_iso(row["start"]))
        mins_to_launch = start_min - now_min
        if preset_id == "B":
            if mins_to_launch <= window or row.get("frozen"):
                frozen.append(row)
        elif preset_id == "D":
            if mins_to_launch <= window * 2 or row.get("frozen"):
                frozen.append(row)
        else:
            frozen.append(row)
    return frozen


def _widen_affected(snapshot: dict[str, Any], assignments: list[dict[str, Any]], affected: set[str]) -> set[str]:
    bases = {row["base_launch"] for row in assignments if row["mission_id"] in affected}
    widened = set(affected)
    for row in assignments:
        if row["base_launch"] in bases:
            widened.add(row["mission_id"])
    return widened


def _build_one_coa(
    preset: dict[str, Any],
    updated: dict[str, Any],
    assignments: list[dict[str, Any]],
    affected: set[str],
    time_limit: float,
    seed: int,
) -> dict[str, Any] | None:
    working = deepcopy(updated)
    preset_id = preset["id"]
    local_affected = _widen_affected(working, assignments, affected) if preset_id == "D" else affected
    frozen = _frozen_for_preset(preset_id, assignments, local_affected, working)
    if frozen and not validate(working, frozen)["valid"]:
        frozen = _frozen_for_preset("A", assignments, local_affected, working)
    scale = float(preset.get("reserve_scale") or 1)
    reserve = working["parameters"]["reserve_by_type"]
    fmc: dict[str, int] = {}
    for craft in working["aircraft"]:
        if craft.get("effective_status", craft["status"]) == "FMC":
            fmc[craft["type_id"]] = fmc.get(craft["type_id"], 0) + 1
    if preset.get("release_reserve"):
        working["parameters"]["reserve_by_type"] = {key: 0 for key in reserve}
        working["parameters"]["reserve_released"] = True
    else:
        working["parameters"]["reserve_by_type"] = {
            key: min(fmc.get(key, 0), max(0, int(round(int(value) * scale))))
            for key, value in reserve.items()
        }
    working["parameters"]["weights"] = {**working["parameters"]["weights"], **preset["weights"]}
    built = build_plan(
        working,
        time_limit=time_limit,
        seed=seed + ord(preset_id),
        workers=1,
        frozen=frozen,
        weights=preset["weights"],
        previous=assignments,
    )
    if not built["validation"]["valid"]:
        return None
    before = {(row["mission_id"], row["slot"]): row for row in assignments}
    changes = 0
    for row in built["assignments"]:
        prior = before.get((row["mission_id"], row["slot"]))
        if prior is None or prior["tail"] != row["tail"] or prior["start"] != row["start"]:
            changes += 1
    changes += len(before) - len({(row["mission_id"], row["slot"]) for row in built["assignments"]})
    metrics = score(working, built["assignments"])
    stab = stability_metrics(
        assignments,
        built["assignments"],
        freeze_window_min=int(working["parameters"]["freeze_window_min"]),
        epoch_iso=working["epoch"],
        sim_now_iso=working["now"],
    )
    metrics.update(stab)
    return {
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
        "signature": tuple(sorted((row["mission_id"], row["tail"], row["start"]) for row in built["assignments"])),
    }


def courses_of_action(
    snapshot: dict[str, Any],
    assignments: list[dict[str, Any]],
    event: dict[str, Any],
    *,
    time_limit: float = 5.0,
    seed: int = 1,
) -> list[dict[str, Any]]:
    updated = apply_event(snapshot, event)
    blast = impact(snapshot, assignments, event)
    affected = set(blast["affected_missions"])
    results: list[dict[str, Any]] = []
    seen: set[tuple[tuple[str, str, str], ...]] = set()
    executor_cls = ProcessPoolExecutor if os.environ.get("VYUHA_COA_POOL", "process") == "process" else ThreadPoolExecutor
    with executor_cls(max_workers=min(4, len(PRESETS))) as pool:
        futures = [
            pool.submit(_build_one_coa, preset, updated, assignments, affected, time_limit, seed)
            for preset in PRESETS
        ]
        for future in as_completed(futures):
            built = future.result()
            if built is None:
                continue
            signature = built.pop("signature")
            if signature in seen:
                continue
            seen.add(signature)
            results.append(built)
    if not results:
        return []
    ranked = sorted(results, key=lambda row: (-row["metrics"]["value_weighted_fulfilment"], row["changes"]))
    best = min(results, key=lambda row: (row["changes"], -row["metrics"]["value_weighted_fulfilment"]))
    recommended = best if best["metrics"]["value_weighted_fulfilment"] + 0.01 >= ranked[0]["metrics"]["value_weighted_fulfilment"] else ranked[0]
    for row in results:
        row["recommended"] = row["id"] == recommended["id"]
        if row["recommended"]:
            pct = round(float(row["metrics"].get("stability_score", 0)) * 100, 1)
            row["rationale"] = (
                f"{row['name']}: {pct}% preserved · {row['changes']} changes · "
                f"{row['metrics']['missions_served']} missions · validator PASS."
            )
    return results


def rank_coas(
    coas: list[dict[str, Any]],
    *,
    value: int = 50,
    stability: int = 50,
    risk: int = 50,
    reserve: int = 50,
) -> list[dict[str, Any]]:
    """Score COAs for the decision matrix (backend-only ranking)."""
    total_w = max(1, value + stability + risk + reserve)
    ranked = []
    for coa in coas:
        metrics = coa.get("metrics") or {}
        fulfil = float(metrics.get("value_weighted_fulfilment") or 0)
        stab = float(metrics.get("stability_score") or 0)
        risk_penalty = float(metrics.get("hard_violations") or 0) + (1.0 - fulfil) * 0.1
        reserve_ok = 1.0 if int(metrics.get("hard_violations") or 0) == 0 else 0.0
        score_value = (
            fulfil * (value / total_w)
            + stab * (stability / total_w)
            + reserve_ok * (reserve / total_w)
            - risk_penalty * (risk / total_w) * 0.05
            - coa.get("changes", 0) * (stability / total_w) * 0.002
        )
        ranked.append({**coa, "matrix_score": round(score_value, 6)})
    ranked.sort(key=lambda row: row["matrix_score"], reverse=True)
    if ranked:
        leader = ranked[0]
        for row in ranked:
            row["recommended"] = row["id"] == leader["id"]
            if row["recommended"]:
                fulfil_pct = round(float((row.get("metrics") or {}).get("value_weighted_fulfilment") or 0) * 100, 1)
                row["rationale"] = (
                    f"Best fit for your weights (value {value}, stability {stability}, risk {risk}, reserve {reserve}). "
                    f"Trade-off: {row['changes']} changes vs fulfilment {fulfil_pct}%."
                )
    return ranked


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
