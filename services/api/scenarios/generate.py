"""Build a deterministic MERIDIAN world from a seed and scenario pack."""

from __future__ import annotations

import math
from copy import deepcopy

import numpy as np
from optimiser.timeutil import add_minutes, parse_iso, snap5, to_iso

from scenarios.catalog import (
    AIRCRAFT_TYPES,
    BASES,
    CREW_PLAN,
    DEFAULT_PARAMETERS,
    EPOCH,
    FLEET_PLAN,
    LOADOUTS,
    MISSION_TEMPLATE,
    MISSION_TYPES,
    SOURCES,
)

DEFECT_LIBRARY = [
    "hydraulic seep",
    "avionics intermittent",
    "tyre wear",
    "canopy seal",
    "generator ripple",
]


def _p_mc(hours_to_inspection: float, defects: int, sorties: int, status: str) -> dict[str, float]:
    if status == "NMC":
        base = 0.08
    elif status == "PMC":
        base = 0.66
    else:
        base = 0.97
    base -= 0.04 * defects + 0.015 * sorties + max(0.0, 12.0 - hours_to_inspection) * 0.01
    base = min(0.99, max(0.04, base))
    out: dict[str, float] = {}
    for label, hours in (("1h", 1), ("3h", 3), ("6h", 6), ("12h", 12), ("24h", 24)):
        out[label] = round(min(0.99, base * math.exp(-0.006 * hours)), 3)
    return out


def _bases() -> list[dict[str, object]]:
    rows = []
    for base in BASES:
        rows.append(
            {
                "id": base["id"],
                "name": base["name"],
                "lat": base["lat"],
                "lon": base["lon"],
                "runways": ["R1", "R2"],
                "launch_rate_15m": base["launch"],
                "recovery_rate_15m": base["recover"],
                "parking": base["parking"],
                "fuel_state": base["fuel"],
                "status": "OPEN",
                "closures": [],
            }
        )
    return rows


def _airspace(bases: list[dict[str, object]]) -> list[dict[str, object]]:
    blocks = []
    specs = [
        ("AS-01", "BASE-ALFA", 0.35, False, "military"),
        ("AS-02", "BASE-ALFA", 0.55, False, "military"),
        ("AS-03", "BASE-BRAVO", 0.35, False, "military"),
        ("AS-04", "BASE-BRAVO", 0.7, True, "military"),
        ("AS-05", "BASE-CHARLIE", 0.4, False, "military"),
        ("AS-06", "BASE-CHARLIE", 0.8, False, "military"),
        ("AS-07", "BASE-DELTA", 0.35, False, "military"),
        ("AS-08", "BASE-DELTA", 0.6, True, "military"),
        ("AS-09", "BASE-ALFA", 1.1, False, "civil"),
        ("AS-10", "BASE-BRAVO", 1.0, False, "civil"),
        ("AS-11", "BASE-CHARLIE", 0.9, True, "military"),
        ("AS-12", "BASE-DELTA", 1.2, False, "military"),
        ("AS-13", "BASE-ALFA", 0.25, True, "military"),
        ("AS-14", "BASE-BRAVO", 0.45, False, "military"),
    ]
    by_id = {b["id"]: b for b in bases}
    for index, (bid, base_id, size, exclusive, owner) in enumerate(specs):
        base = by_id[base_id]
        lat = float(base["lat"]) + (0.15 if index % 2 == 0 else -0.1)
        lon = float(base["lon"]) + (0.2 if index % 3 else -0.15)
        poly = [
            [lat - size / 2, lon - size / 2],
            [lat - size / 2, lon + size / 2],
            [lat + size / 2, lon + size / 2],
            [lat + size / 2, lon - size / 2],
        ]
        blocks.append(
            {
                "id": bid,
                "polygon": poly,
                "floor_ft": 0 if owner == "military" else 5000,
                "ceiling_ft": 45000 if owner == "military" else 18000,
                "active_windows": [{"start": EPOCH, "end": to_iso(add_minutes(parse_iso(EPOCH), 24 * 60))}],
                "exclusive": exclusive,
                "owner": owner,
                "rules": "no_fighter" if owner == "civil" else "standard",
                "base_hint": base_id,
            }
        )
    return blocks


def _threats() -> list[dict[str, object]]:
    specs = [
        ("TZ-1", "pressure-ring", 15.1, 65.1, 18, 0.35),
        ("TZ-2", "denial-ring", 14.2, 66.2, 22, 0.42),
        ("TZ-3", "corridor-pressure", 13.9, 65.2, 16, 0.28),
        ("TZ-4", "northern-pressure", 15.8, 66.4, 20, 0.31),
        ("TZ-5", "coastal-pressure", 14.7, 64.6, 14, 0.22),
        ("TZ-6", "southern-pressure", 13.4, 66.8, 24, 0.38),
    ]
    rows = []
    for tid, kind, lat, lon, radius, existence in specs:
        rows.append(
            {
                "id": tid,
                "kind": kind,
                "lat": lat,
                "lon": lon,
                "radius_nm": radius,
                "existence_p": existence,
                "last_seen": EPOCH,
                "ttl_min": 180,
                "growth_nm_per_h": 1.5,
                "freshness": "FRESH",
                "source_id": "TIP",
            }
        )
    return rows


def _weather(rng: np.random.Generator) -> list[dict[str, object]]:
    rows = []
    epoch = parse_iso(EPOCH)
    for base in BASES:
        for step in range(0, 24, 3):
            start = add_minutes(epoch, step * 60)
            end = add_minutes(start, 180)
            ceiling = 8000
            vis = 9000
            if base["id"] == "BASE-BRAVO" and 8 <= step <= 12:
                ceiling = 2200
                vis = 6000
            members = []
            for _ in range(30):
                members.append(
                    {
                        "ceiling_ft": int(ceiling + rng.normal(0, 400)),
                        "vis_m": int(vis + rng.normal(0, 300)),
                    }
                )
            rows.append(
                {
                    "id": f"WX-{base['id']}-{step:02d}",
                    "base_id": base["id"],
                    "valid_from": to_iso(start),
                    "valid_to": to_iso(end),
                    "ceiling_ft": ceiling,
                    "vis_m": vis,
                    "wind_kt": int(8 + rng.integers(0, 8)),
                    "xwind_kt": int(rng.integers(2, 10)),
                    "convective_idx": 0.15 if ceiling > 3000 else 0.45,
                    "confidence": 0.86,
                    "ensemble": members,
                    "freshness": "FRESH",
                    "source_id": "MET",
                }
            )
    return rows


def generate_world(seed: int = 26250, pack: str = "S1", scale: str = "M") -> dict[str, object]:
    rng = np.random.Generator(np.random.PCG64(seed + _pack_offset(pack)))
    scale_n = {"S": (20, 15, 48), "M": (64, 45, 140), "L": (150, 110, 320), "XL": (300, 220, 640)}[scale]
    world = _build(rng, seed, pack, scale, scale_n)
    return apply_pack(world, pack)


def _parameters(aircraft: list[dict[str, object]]) -> dict[str, object]:
    parameters = deepcopy(DEFAULT_PARAMETERS)
    counts: dict[str, int] = {}
    for craft in aircraft:
        key = str(craft["type_id"])
        counts[key] = counts.get(key, 0) + 1
    parameters["reserve_by_type"] = {
        key: min(int(value), max(0, counts.get(key, 0) - 1))
        for key, value in parameters["reserve_by_type"].items()
    }
    return parameters


def _pack_offset(pack: str) -> int:
    return {"S1": 0, "S2": 2, "S3": 3, "S4": 4, "S5": 5}.get(pack, 0)


def _build(
    rng: np.random.Generator,
    seed: int,
    pack: str,
    scale: str,
    scale_n: tuple[int, int, int],
) -> dict[str, object]:
    aircraft_target, mission_target, crew_target = scale_n
    bases = _bases()
    types = deepcopy(AIRCRAFT_TYPES)
    aircraft = _aircraft(rng, aircraft_target)
    crew = _crew(rng, aircraft, crew_target)
    airspace = _airspace(bases)
    threats = _threats()
    weather = _weather(rng)
    missions = _missions(rng, mission_target, bases, airspace, aircraft)
    stocks = _stocks(bases)
    tankers = _tankers(aircraft)
    return {
        "seed": seed,
        "pack": pack,
        "scale": scale,
        "epoch": EPOCH,
        "now": EPOCH,
        "horizon_min": 24 * 60,
        "theatre": "MERIDIAN",
        "parameters": _parameters(aircraft),
        "bases": bases,
        "aircraft_types": types,
        "aircraft": aircraft,
        "crew": crew,
        "loadouts": deepcopy(LOADOUTS),
        "stocks": stocks,
        "tankers": tankers,
        "airspace": airspace,
        "weather": weather,
        "threats": threats,
        "missions": missions,
        "sources": deepcopy(SOURCES),
    }


def _aircraft(rng: np.random.Generator, target: int) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    planned: list[tuple[str, str]] = []
    for type_id, bases in FLEET_PLAN:
        planned.extend((type_id, base) for base in bases)
    if target != 64:
        planned = _resize_fleet(planned, target)
    for index, (type_id, base_id) in enumerate(planned, start=101):
        defects = []
        roll = float(rng.random())
        status = "FMC"
        if roll > 0.96:
            status = "NMC"
            defects = [DEFECT_LIBRARY[int(rng.integers(0, len(DEFECT_LIBRARY)))]]
        elif roll > 0.88:
            status = "PMC"
            defects = [DEFECT_LIBRARY[int(rng.integers(0, len(DEFECT_LIBRARY)))]]
        hours = float(rng.uniform(8, 110))
        sorties = int(rng.integers(0, 4))
        pmc = _p_mc(hours, len(defects), sorties, status)
        rows.append(
            {
                "tail": f"TAIL-{index}",
                "type_id": type_id,
                "base_id": base_id,
                "status": status,
                "effective_status": status,
                "defects": defects,
                "hours_to_inspection": round(hours, 1),
                "sorties_72h": sorties,
                "ready_at": EPOCH,
                "p_mc": pmc,
                "freshness": "FRESH",
                "maintenance_alias": f"MX-{index}",
                "source_id": "MSS",
            }
        )
    return rows


def _resize_fleet(planned: list[tuple[str, str]], target: int) -> list[tuple[str, str]]:
    if target < len(planned):
        return planned[:target]
    extra = []
    index = 0
    while len(planned) + len(extra) < target:
        extra.append(planned[index % len(planned)])
        index += 1
    return planned + extra


def _crew(rng: np.random.Generator, aircraft: list[dict[str, object]], target: int) -> list[dict[str, object]]:
    by_type: dict[str, list[str]] = {}
    for row in aircraft:
        by_type.setdefault(str(row["type_id"]), []).append(str(row["base_id"]))
    plan = list(CREW_PLAN)
    if target != 140:
        plan = _resize_crew(plan, target)
    rows = []
    number = 1
    for role, type_id, count in plan:
        bases = by_type.get(type_id) or ["BASE-ALFA"]
        for i in range(count):
            hours24 = float(rng.uniform(0, 3.5))
            if number % 17 == 0:
                hours24 = float(rng.uniform(6.5, 7.5))
            fatigue = round(min(0.95, hours24 / 10 + float(rng.uniform(0, 0.1))), 3)
            rows.append(
                {
                    "id": f"CREW-{number:03d}",
                    "role": role,
                    "quals": [role, type_id],
                    "base_id": bases[i % len(bases)],
                    "hours_24h": round(hours24, 2),
                    "hours_7d": round(hours24 + float(rng.uniform(2, 12)), 2),
                    "duty_start": None,
                    "last_rest_end": EPOCH,
                    "available_at": EPOCH,
                    "status": "AVAILABLE",
                    "fatigue_index": fatigue,
                    "freshness": "FRESH",
                    "source_id": "CRFR",
                }
            )
            number += 1
    return rows


def _resize_crew(plan: list[tuple[str, str, int]], target: int) -> list[tuple[str, str, int]]:
    total = sum(item[2] for item in plan)
    if total == target:
        return plan
    scaled = []
    running = 0
    for index, (role, type_id, count) in enumerate(plan):
        if index == len(plan) - 1:
            scaled.append((role, type_id, max(1, target - running)))
        else:
            qty = max(1, round(count * target / total))
            scaled.append((role, type_id, qty))
            running += qty
    return scaled


def _stocks(bases: list[dict[str, object]]) -> list[dict[str, object]]:
    rows = []
    for base in bases:
        for loadout in LOADOUTS:
            rows.append(
                {
                    "base_id": base["id"],
                    "code": loadout["code"],
                    "qty": 28,
                    "reserve_min": 4,
                    "freshness": "FRESH",
                    "source_id": "ASL",
                }
            )
    return rows


def _tankers(aircraft: list[dict[str, object]]) -> list[dict[str, object]]:
    rows = []
    tkr = [a for a in aircraft if a["type_id"] == "TKR" and a["status"] != "NMC"]
    for index, craft in enumerate(tkr[:6], start=1):
        base = next(b for b in BASES if b["id"] == craft["base_id"])
        rows.append(
            {
                "id": f"TKR-{index:02d}",
                "tail": craft["tail"],
                "base_id": craft["base_id"],
                "offload_capacity": 4,
                "tracks": [
                    [base["lat"], base["lon"]],
                    [float(base["lat"]) + 0.4, float(base["lon"]) + 0.3],
                ],
                "availability": [{"start": EPOCH, "end": to_iso(add_minutes(parse_iso(EPOCH), 24 * 60))}],
                "freshness": "FRESH",
            }
        )
    return rows


def _missions(
    rng: np.random.Generator,
    target: int,
    bases: list[dict[str, object]],
    airspace: list[dict[str, object]],
    aircraft: list[dict[str, object]],
) -> list[dict[str, object]]:
    types = list(MISSION_TYPES)
    while len(types) < target:
        types.append(MISSION_TYPES[len(types) % len(MISSION_TYPES)])
    types = types[:target]
    priorities = _priorities(target)
    epoch = parse_iso(EPOCH)
    military_air = [a for a in airspace if a["owner"] == "military"]
    rows = []
    for index, mission_type in enumerate(types, start=1):
        template = MISSION_TEMPLATE[mission_type]
        hosts = [a["base_id"] for a in aircraft if a["type_id"] == template["type_id"] and a["status"] != "NMC"]
        base_id = hosts[index % len(hosts)] if hosts else "BASE-ALFA"
        base = next(b for b in bases if b["id"] == base_id)
        start_min = snap5(int(rng.integers(30, 20 * 60)))
        window = 180 if template["duration"] < 150 else 240
        preferred = add_minutes(epoch, start_min)
        window_start = add_minutes(preferred, -30)
        window_end = add_minutes(preferred, window)
        block = military_air[index % len(military_air)]
        lat = float(base["lat"])
        lon = float(base["lon"])
        aim_lat = lat + (0.35 if index % 2 == 0 else -0.25)
        aim_lon = lon + 0.45
        needs_aar = mission_type == "INT" and index % 4 == 0
        value = int(110 - priorities[index - 1] * 18 + rng.integers(0, 8))
        rows.append(
            {
                "id": f"MSN-{index:03d}",
                "call_sign": f"VYU-{index:03d}",
                "type": mission_type,
                "priority": int(priorities[index - 1]),
                "value": value,
                "window_start": to_iso(window_start),
                "window_end": to_iso(window_end),
                "preferred_start": to_iso(preferred),
                "duration_min": template["duration"],
                "slots": [
                    {
                        "slot": slot,
                        "type_id": template["type_id"],
                        "load_out": template["load_out"],
                        "quals": list(template["quals"]),
                    }
                    for slot in range(int(template["slots"]))
                ],
                "airspace_ids": [block["id"]],
                "wx_minima": {"ceiling_ft": 1500, "vis_m": 5000},
                "needs_aar": needs_aar,
                "dependencies": [],
                "status": "REQUESTED",
                "launch_base": base_id,
                "recover_base": base_id,
                "route": [[lat, lon], [aim_lat, aim_lon], [lat, lon]],
                "source": "TAP",
                "freshness": "FRESH",
            }
        )
    _link_dependencies(rows)
    return rows


def _priorities(target: int) -> list[int]:
    pattern = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 5]
    return [pattern[i % len(pattern)] for i in range(target)]


def _link_dependencies(missions: list[dict[str, object]]) -> None:
    by_type: dict[str, list[dict[str, object]]] = {}
    for mission in missions:
        by_type.setdefault(str(mission["type"]), []).append(mission)
    escorts = by_type.get("ESCORT", [])
    strikes = by_type.get("INT", [])
    for escort, strike in zip(escorts, strikes, strict=False):
        escort["dependencies"] = [{"kind": "SYNC", "mission_id": strike["id"], "within_min": 15}]
        strike["dependencies"] = [{"kind": "SYNC", "mission_id": escort["id"], "within_min": 15}]


def apply_pack(world: dict[str, object], pack: str) -> dict[str, object]:
    if pack == "S2":
        _monsoon(world)
    elif pack == "S3":
        _popup(world)
    elif pack == "S4":
        _aog(world)
    elif pack == "S5":
        _corridor(world)
    world["pack"] = pack
    return world


def _monsoon(world: dict[str, object]) -> None:
    epoch = parse_iso(str(world["epoch"]))
    start = to_iso(add_minutes(epoch, 8 * 60))
    end = to_iso(add_minutes(epoch, 12 * 60))
    for base in world["bases"]:  # type: ignore[union-attr]
        if base["id"] == "BASE-BRAVO":
            base["status"] = "CLOSED"
            base["closures"] = [{"start": start, "end": end}]
    for row in world["weather"]:  # type: ignore[union-attr]
        if row["base_id"] == "BASE-BRAVO" and "08" in row["id"] or (
            row["base_id"] == "BASE-BRAVO" and row["valid_from"] >= start and row["valid_from"] < end
        ):
            row["ceiling_ft"] = 700
            row["vis_m"] = 2400
            for member in row["ensemble"]:
                member["ceiling_ft"] = 700
                member["vis_m"] = 2400


def _popup(world: dict[str, object]) -> None:
    epoch = parse_iso(str(world["epoch"]))
    start = add_minutes(epoch, 90)
    specs = [
        ("MSN-901", "SAR", 1, 100, "BASE-DELTA", "ROT", "LC-I", ["PLT", "RESCUE"], 80),
        ("MSN-902", "AIRLIFT", 1, 96, "BASE-CHARLIE", "TPT", "LC-G", ["PLT", "LM"], 100),
    ]
    for mid, mtype, priority, value, base_id, type_id, loadout, quals, duration in specs:
        base = next(b for b in world["bases"] if b["id"] == base_id)  # type: ignore[union-attr]
        world["missions"].append(  # type: ignore[union-attr]
            {
                "id": mid,
                "call_sign": mid.replace("MSN", "VYU"),
                "type": mtype,
                "priority": priority,
                "value": value,
                "window_start": to_iso(start),
                "window_end": to_iso(add_minutes(start, 180)),
                "preferred_start": to_iso(add_minutes(start, 15)),
                "duration_min": duration,
                "slots": [{"slot": 0, "type_id": type_id, "load_out": loadout, "quals": quals}],
                "airspace_ids": ["AS-07" if base_id == "BASE-DELTA" else "AS-05"],
                "wx_minima": {"ceiling_ft": 800, "vis_m": 3000},
                "needs_aar": False,
                "dependencies": [],
                "status": "REQUESTED",
                "launch_base": base_id,
                "recover_base": base_id,
                "route": [[base["lat"], base["lon"]], [float(base["lat"]) + 0.2, float(base["lon"]) + 0.2]],
                "source": "TAP",
                "freshness": "FRESH",
            }
        )


def _aog(world: dict[str, object]) -> None:
    wanted = [
        a["tail"]
        for a in world["aircraft"]  # type: ignore[union-attr]
        if a["type_id"] in {"MRF", "INT", "TPT"}
    ][:3]
    for craft in world["aircraft"]:  # type: ignore[union-attr]
        if craft["tail"] in wanted:
            craft["status"] = "NMC"
            craft["effective_status"] = "NMC"
            craft["defects"] = ["unscheduled grounding"]
            craft["p_mc"] = {k: 0.02 for k in ("1h", "3h", "6h", "12h", "24h")}
    for crew in list(world["crew"])[:2]:  # type: ignore[union-attr]
        if crew["role"] == "PLT":
            crew["status"] = "UNAVAILABLE"


def _corridor(world: dict[str, object]) -> None:
    world["threats"].append(  # type: ignore[union-attr]
        {
            "id": "TZ-7",
            "kind": "corridor-denial",
            "lat": 14.9,
            "lon": 65.9,
            "radius_nm": 40,
            "existence_p": 0.92,
            "last_seen": world["epoch"],
            "ttl_min": 240,
            "growth_nm_per_h": 2.0,
            "freshness": "FRESH",
            "source_id": "TIP",
        }
    )
    for tanker in world["tankers"]:  # type: ignore[union-attr]
        track = tanker["tracks"]
        tanker["tracks"] = [[track[0][0] + 0.5, track[0][1] - 0.4], [track[1][0] + 0.5, track[1][1] - 0.4]]


def small_world(seed: int) -> dict[str, object]:
    """Compact theatre for property tests. Same schema as the full generator."""
    world = generate_world(seed, "S1", "S")
    world["parameters"]["reserve_by_type"] = {key: 0 for key in world["parameters"]["reserve_by_type"]}  # type: ignore[index]
    world["missions"] = [
        m
        for m in world["missions"]  # type: ignore[union-attr]
        if m["type"] in {"ADP", "SAR", "AIRLIFT"}
    ][:6]
    keep_types = {slot["type_id"] for m in world["missions"] for slot in m["slots"]}  # type: ignore[index]
    world["aircraft"] = [a for a in world["aircraft"] if a["type_id"] in keep_types][:12]  # type: ignore[union-attr]
    tails = {a["base_id"] for a in world["aircraft"]}  # type: ignore[union-attr]
    world["crew"] = [c for c in world["crew"] if c["base_id"] in tails][:24]  # type: ignore[union-attr]
    for mission in world["missions"]:  # type: ignore[union-attr]
        mission["slots"] = mission["slots"][:1]
        mission["dependencies"] = []
        mission["needs_aar"] = False
    return world
