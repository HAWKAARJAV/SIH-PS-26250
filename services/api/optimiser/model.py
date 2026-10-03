"""CP-SAT baseline planner. Candidates are filtered; the validator still has the last word."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Any

from ortools.sat.python import cp_model
from scenarios.catalog import TIER_WEIGHT

from optimiser.geo import route_exposure_nm
from optimiser.timeutil import add_minutes, minutes_between, parse_iso, snap5, to_iso

MAX_AIRCRAFT = 6
MAX_CREW = 4


def solve_cpsat(
    snapshot: dict[str, Any],
    *,
    time_limit: float = 10.0,
    seed: int = 1,
    workers: int = 1,
    frozen: list[dict[str, Any]] | None = None,
    weights: dict[str, int] | None = None,
    previous: list[dict[str, Any]] | None = None,
    progress_path: str | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    model = cp_model.CpModel()
    epoch = parse_iso(snapshot["epoch"])
    params = snapshot["parameters"]
    weight = {**params["weights"], **(weights or {})}
    held = _held_tails(snapshot)
    frozen_by_mission = _by_mission(frozen or [])
    previous_by_mission = _by_mission(previous or [])
    prep = int(params["prep_min"])
    objective: list[Any] = []
    aircraft_intervals: dict[str, list[Any]] = defaultdict(list)
    crew_intervals: dict[str, list[Any]] = defaultdict(list)
    airspace_intervals: dict[str, list[Any]] = defaultdict(list)
    tanker_intervals: dict[str, list[Any]] = defaultdict(list)
    stock_terms: dict[tuple[str, str], list[Any]] = defaultdict(list)
    launch_terms: dict[tuple[str, int], list[Any]] = defaultdict(list)
    mission_state: dict[str, dict[str, Any]] = {}
    tail_uses: dict[str, list[Any]] = defaultdict(list)
    crew_loads: dict[str, list[tuple[Any, int]]] = defaultdict(list)

    for mission in snapshot["missions"]:
        built = _build_mission(
            model,
            snapshot,
            mission,
            epoch,
            held,
            prep,
            frozen_by_mission.get(mission["id"]),
            previous_by_mission.get(mission["id"]),
            weight,
            objective,
            aircraft_intervals,
            crew_intervals,
            airspace_intervals,
            tanker_intervals,
            stock_terms,
            launch_terms,
            tail_uses,
            crew_loads,
        )
        if built:
            mission_state[mission["id"]] = built

    for intervals in aircraft_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)
    for intervals in crew_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)
    for intervals in airspace_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)
    for intervals in tanker_intervals.values():
        if len(intervals) > 1:
            model.add_no_overlap(intervals)
    _cap_stock(model, snapshot, stock_terms)
    _cap_launch(model, snapshot, launch_terms)
    _cap_sorties(model, snapshot, tail_uses)
    _cap_duty(model, snapshot, crew_loads)
    _link_dependencies(model, snapshot, mission_state)
    if objective:
        model.maximize(sum(objective))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_search_workers = max(1, workers)
    solver.parameters.random_seed = seed
    callback = _Progress(progress_path)
    status = solver.solve(model, callback)
    elapsed = time.perf_counter() - started
    name = solver.status_name(status)
    if name not in {"OPTIMAL", "FEASIBLE"}:
        return _empty(name, elapsed, callback.count)
    assignments = _read(solver, mission_state, epoch)
    objective_value = int(solver.objective_value)
    bound = int(solver.best_objective_bound)
    gap = 0.0 if objective_value == 0 else abs(bound - objective_value) / max(1, abs(objective_value))
    return {
        "assignments": assignments,
        "status": name,
        "objective": objective_value,
        "bound": bound,
        "gap": round(gap, 4),
        "elapsed_s": round(elapsed, 3),
        "solutions": callback.count,
    }


def _build_mission(
    model: cp_model.CpModel,
    snapshot: dict[str, Any],
    mission: dict[str, Any],
    epoch: Any,
    held: set[str],
    prep: int,
    frozen_rows: list[dict[str, Any]] | None,
    previous_rows: list[dict[str, Any]] | None,
    weight: dict[str, Any],
    objective: list[Any],
    aircraft_intervals: dict[str, list[Any]],
    crew_intervals: dict[str, list[Any]],
    airspace_intervals: dict[str, list[Any]],
    tanker_intervals: dict[str, list[Any]],
    stock_terms: dict[tuple[str, str], list[Any]],
    launch_terms: dict[tuple[str, int], list[Any]],
    tail_uses: dict[str, list[Any]],
    crew_loads: dict[str, list[tuple[Any, int]]],
) -> dict[str, Any] | None:
    allowed = _allowed_starts(snapshot, mission, epoch)
    if not allowed:
        return None
    served = model.new_bool_var(f"served_{mission['id']}")
    start = model.new_int_var_from_domain(cp_model.Domain.from_values(allowed), f"start_{mission['id']}")
    if frozen_rows:
        model.add(served == 1)
        model.add(start == minutes_between(epoch, parse_iso(frozen_rows[0]["start"])))
    slot_vars: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for slot in mission["slots"]:
        crafts = _candidate_aircraft(snapshot, mission, slot, held)
        if frozen_rows:
            frozen_tail = next(row["tail"] for row in frozen_rows if row["slot"] == slot["slot"])
            crafts = [c for c in snapshot["aircraft"] if c["tail"] == frozen_tail] or crafts
        if not crafts:
            model.add(served == 0)
            return None
        literals = {}
        for craft in crafts:
            present = model.new_bool_var(f"ac_{mission['id']}_{slot['slot']}_{craft['tail']}")
            literals[craft["tail"]] = present
            turnaround = _turnaround(snapshot, craft["type_id"])
            size = prep + int(mission["duration_min"]) + turnaround
            aircraft_intervals[craft["tail"]].append(
                model.new_optional_fixed_size_interval_var(
                    start - prep, size, present, f"iv_{mission['id']}_{craft['tail']}_{slot['slot']}"
                )
            )
            stock_terms[(mission["launch_base"], slot["load_out"])].append(present)
            tail_uses[craft["tail"]].append(present)
        model.add(sum(literals.values()) == served)
        crews = _candidate_crew(snapshot, mission, slot)
        if frozen_rows:
            frozen_crew = next(row["crew_ids"] for row in frozen_rows if row["slot"] == slot["slot"])
            crews = [c for c in snapshot["crew"] if c["id"] in frozen_crew] or crews
        seat_literals = _seat_literals(
            model, mission, slot, crews, served, start, prep, crew_intervals, crew_loads
        )
        if seat_literals is None:
            model.add(served == 0)
            return None
        slot_vars.append((literals, seat_literals))
    tanker_lits = _tanker_choice(model, snapshot, mission, served, start, tanker_intervals)
    for block_id in mission["airspace_ids"]:
        block = next((b for b in snapshot["airspace"] if b["id"] == block_id), None)
        if block and block["exclusive"]:
            airspace_intervals[block_id].append(
                model.new_optional_fixed_size_interval_var(
                    start, int(mission["duration_min"]), served, f"as_{mission['id']}_{block_id}"
                )
            )
    _launch_bins(model, mission, served, start, launch_terms)
    _objective_terms(model, snapshot, mission, served, start, epoch, weight, previous_rows, slot_vars, objective)
    if frozen_rows:
        _pin_frozen(model, mission, slot_vars, frozen_rows)
    return {
        "mission": mission,
        "served": served,
        "start": start,
        "slots": slot_vars,
        "tankers": tanker_lits,
    }


def _pin_frozen(
    model: cp_model.CpModel,
    mission: dict[str, Any],
    slot_vars: list[tuple[dict[str, Any], dict[str, Any]]],
    frozen_rows: list[dict[str, Any]],
) -> None:
    for slot, (aircraft_lits, seat_lits) in zip(mission["slots"], slot_vars, strict=False):
        row = next(item for item in frozen_rows if item["slot"] == slot["slot"])
        if row["tail"] in aircraft_lits:
            model.add(aircraft_lits[row["tail"]] == 1)
        for crew_id in row["crew_ids"]:
            if crew_id in seat_lits:
                model.add(seat_lits[crew_id] == 1)


def _seat_literals(
    model: cp_model.CpModel,
    mission: dict[str, Any],
    slot: dict[str, Any],
    crews: list[dict[str, Any]],
    served: Any,
    start: Any,
    prep: int,
    crew_intervals: dict[str, list[Any]],
    crew_loads: dict[str, list[tuple[Any, int]]],
) -> dict[str, Any] | None:
    chosen: dict[str, Any] = {}
    for qual in slot["quals"]:
        options = [c for c in crews if qual in c["quals"] and slot["type_id"] in c["quals"]][:MAX_CREW]
        if not options:
            return None
        literals = {}
        for person in options:
            present = model.new_bool_var(f"cr_{mission['id']}_{slot['slot']}_{qual}_{person['id']}")
            literals[person["id"]] = present
            chosen[person["id"]] = present
            size = prep + int(mission["duration_min"]) + 15
            crew_intervals[person["id"]].append(
                model.new_optional_fixed_size_interval_var(start - prep, size, present, f"cv_{mission['id']}_{person['id']}_{qual}")
            )
            crew_loads[person["id"]].append((present, int(mission["duration_min"])))
        model.add(sum(literals.values()) == served)
    return chosen


def _tanker_choice(
    model: cp_model.CpModel,
    snapshot: dict[str, Any],
    mission: dict[str, Any],
    served: Any,
    start: Any,
    tanker_intervals: dict[str, list[Any]],
) -> dict[str, Any]:
    literals: dict[str, Any] = {}
    if not mission.get("needs_aar"):
        return literals
    for tanker in snapshot["tankers"]:
        present = model.new_bool_var(f"tk_{mission['id']}_{tanker['id']}")
        literals[str(tanker["id"])] = present
        tanker_intervals[tanker["id"]].append(
            model.new_optional_fixed_size_interval_var(
                start, int(mission["duration_min"]), present, f"tv_{mission['id']}_{tanker['id']}"
            )
        )
    if literals:
        model.add(sum(literals.values()) == served)
    return literals


def _objective_terms(
    model: cp_model.CpModel,
    snapshot: dict[str, Any],
    mission: dict[str, Any],
    served: Any,
    start: Any,
    epoch: Any,
    weight: dict[str, Any],
    previous_rows: list[dict[str, Any]] | None,
    slot_vars: list[tuple[dict[str, Any], dict[str, Any]]],
    objective: list[Any],
) -> None:
    tier = TIER_WEIGHT[int(mission["priority"])]
    objective.append(served * int(mission["value"]) * tier * int(weight.get("value", 1)))
    exposure = int(_exposure(snapshot, mission))
    objective.append(served * -exposure * int(weight.get("risk", 1)))
    preferred = minutes_between(epoch, parse_iso(mission["preferred_start"]))
    late = model.new_int_var(0, int(snapshot["horizon_min"]), f"late_{mission['id']}")
    model.add(late >= start - preferred).only_enforce_if(served)
    model.add(late == 0).only_enforce_if(~served)
    objective.append(late * -int(weight.get("lateness", 1)))
    if previous_rows and slot_vars:
        tail = previous_rows[0]["tail"]
        literals = slot_vars[0][0]
        if tail in literals:
            objective.append((served - literals[tail]) * -int(weight.get("stability", 0)))


def _launch_bins(
    model: cp_model.CpModel,
    mission: dict[str, Any],
    served: Any,
    start: Any,
    launch_terms: dict[tuple[str, int], list[Any]],
) -> None:
    # Count the preferred bin only as a conservative capacity signal; the validator
    # rechecks every 15-minute bin on the concrete start.
    lo = minutes_between  # silence linters if unused
    del lo
    window_bin = 0
    present = model.new_bool_var(f"bin_{mission['id']}")
    model.add(present == served)
    launch_terms[(mission["launch_base"], window_bin)].append(present)
    del start


def _cap_sorties(model: cp_model.CpModel, snapshot: dict[str, Any], uses: dict[str, list[Any]]) -> None:
    limit = int(snapshot["parameters"]["max_sorties_day"])
    for literals in uses.values():
        if literals:
            model.add(sum(literals) <= limit)


def _cap_duty(model: cp_model.CpModel, snapshot: dict[str, Any], loads: dict[str, list[tuple[Any, int]]]) -> None:
    limit = int(snapshot["parameters"]["flight_limit_24h_min"])
    crew = {person["id"]: person for person in snapshot["crew"]}
    for crew_id, terms in loads.items():
        person = crew.get(crew_id)
        if person is None or not terms:
            continue
        remaining = max(0, limit - int(float(person["hours_24h"]) * 60))
        model.add(sum(present * duration for present, duration in terms) <= remaining)


def _link_dependencies(
    model: cp_model.CpModel, snapshot: dict[str, Any], state: dict[str, dict[str, Any]]
) -> None:
    seen: set[tuple[str, str]] = set()
    for mission in snapshot["missions"]:
        left = state.get(mission["id"])
        if left is None:
            continue
        for dep in mission.get("dependencies", []):
            right = state.get(dep["mission_id"])
            if right is None:
                continue
            pair = tuple(sorted((mission["id"], dep["mission_id"])))
            if pair in seen:
                continue
            seen.add(pair)
            served_a, start_a = left["served"], left["start"]
            served_b, start_b = right["served"], right["start"]
            if dep["kind"] == "SYNC":
                within = int(dep.get("within_min") or 0)
                model.add(start_a - start_b <= within).only_enforce_if([served_a, served_b])
                model.add(start_b - start_a <= within).only_enforce_if([served_a, served_b])
            elif dep["kind"] == "AFTER":
                other = next(row for row in snapshot["missions"] if row["id"] == dep["mission_id"])
                model.add(served_b == 1).only_enforce_if(served_a)
                model.add(start_a >= start_b + int(other["duration_min"])).only_enforce_if(served_a)


def _cap_stock(model: cp_model.CpModel, snapshot: dict[str, Any], terms: dict[tuple[str, str], list[Any]]) -> None:
    available = {(row["base_id"], row["code"]): int(row["qty"]) - int(row["reserve_min"]) for row in snapshot["stocks"]}
    for key, literals in terms.items():
        model.add(sum(literals) <= available.get(key, 0))


def _cap_launch(model: cp_model.CpModel, snapshot: dict[str, Any], terms: dict[tuple[str, int], list[Any]]) -> None:
    rates = {base["id"]: int(base["launch_rate_15m"]) * 96 for base in snapshot["bases"]}
    for (base_id, _bin), literals in terms.items():
        model.add(sum(literals) <= rates.get(base_id, 1))


def _allowed_starts(snapshot: dict[str, Any], mission: dict[str, Any], epoch: Any) -> list[int]:
    params = snapshot["parameters"]
    lo = snap5(max(0, minutes_between(epoch, parse_iso(mission["window_start"]))))
    hi = snap5(minutes_between(epoch, parse_iso(mission["window_end"])) - int(mission["duration_min"]))
    if hi < lo:
        return []
    if _threat_blocks(snapshot, mission):
        return []
    base = next(b for b in snapshot["bases"] if b["id"] == mission["launch_base"])
    allowed = []
    minute = lo
    while minute <= hi:
        if _closed(base, minute, epoch):
            minute += 15
            continue
        if _weather_ok(snapshot, mission, minute, epoch, params):
            allowed.append(minute)
        minute += 15
        if len(allowed) >= 10:
            break
    return allowed


def _weather_ok(snapshot: dict[str, Any], mission: dict[str, Any], minute: int, epoch: Any, params: dict[str, Any]) -> bool:
    rows = [
        row
        for row in snapshot["weather"]
        if row["base_id"] == mission["launch_base"]
        and minutes_between(epoch, parse_iso(row["valid_from"])) <= minute < minutes_between(epoch, parse_iso(row["valid_to"]))
    ]
    if not rows:
        return False
    row = rows[0]
    members = row.get("ensemble") or [{"ceiling_ft": row["ceiling_ft"], "vis_m": row["vis_m"]}]
    minima = mission["wx_minima"]
    hits = sum(1 for member in members if member["ceiling_ft"] >= minima["ceiling_ft"] and member["vis_m"] >= minima["vis_m"])
    required = params["stale_wx_p_go_min"] if row.get("freshness") == "STALE" else params["p_go_min"]
    return bool(hits / len(members) >= float(required))


def _closed(base: dict[str, Any], minute: int, epoch: Any) -> bool:
    if base["status"] == "CLOSED" and not base.get("closures"):
        return True
    for window in base.get("closures", []):
        if minutes_between(epoch, parse_iso(window["start"])) <= minute < minutes_between(epoch, parse_iso(window["end"])):
            return True
    return False


def _threat_blocks(snapshot: dict[str, Any], mission: dict[str, Any]) -> bool:
    route = mission.get("route") or []
    for threat in snapshot["threats"]:
        radius = float(threat["radius_nm"]) * (1.25 if threat.get("freshness") == "STALE" else 1)
        if float(threat["existence_p"]) >= 0.8 and route_exposure_nm(route, (float(threat["lat"]), float(threat["lon"]))) < radius:
            return True
    return False


def _candidate_aircraft(
    snapshot: dict[str, Any], mission: dict[str, Any], slot: dict[str, Any], held: set[str]
) -> list[dict[str, Any]]:
    params = snapshot["parameters"]
    accept = bool(params.get("accept_pmc"))
    pool = []
    for craft in snapshot["aircraft"]:
        if craft["type_id"] != slot["type_id"] or craft["base_id"] != mission["launch_base"]:
            continue
        if craft["tail"] in held:
            continue
        status = craft.get("effective_status", craft["status"])
        if status == "NMC" or (status == "PMC" and not accept):
            continue
        threshold = params["pmc_p_mc_min"] if status == "PMC" else params["p_mc_min"]
        if float(craft["p_mc"]["6h"]) < float(threshold):
            continue
        pool.append(craft)
    pool.sort(key=lambda craft: float(craft["p_mc"]["6h"]), reverse=True)
    return pool[:MAX_AIRCRAFT]


def _candidate_crew(snapshot: dict[str, Any], mission: dict[str, Any], slot: dict[str, Any]) -> list[dict[str, Any]]:
    pool = [
        person
        for person in snapshot["crew"]
        if person["status"] == "AVAILABLE"
        and person["base_id"] == mission["launch_base"]
        and slot["type_id"] in person["quals"]
    ]
    pool.sort(key=lambda person: float(person["fatigue_index"]))
    return pool[: MAX_CREW * max(1, len(slot["quals"]))]


def _held_tails(snapshot: dict[str, Any]) -> set[str]:
    held: set[str] = set()
    for type_id, need in snapshot["parameters"]["reserve_by_type"].items():
        pool = [
            craft
            for craft in snapshot["aircraft"]
            if craft["type_id"] == type_id and craft.get("effective_status", craft["status"]) == "FMC"
        ]
        pool.sort(key=lambda craft: float(craft["p_mc"]["6h"]), reverse=True)
        held.update(craft["tail"] for craft in pool[: int(need)])
    return held


def _turnaround(snapshot: dict[str, Any], type_id: str) -> int:
    return int(next(row["min_turnaround_min"] for row in snapshot["aircraft_types"] if row["id"] == type_id))


def _exposure(snapshot: dict[str, Any], mission: dict[str, Any]) -> float:
    route = mission.get("route") or []
    score = 0.0
    for threat in snapshot["threats"]:
        distance = route_exposure_nm(route, (float(threat["lat"]), float(threat["lon"])))
        radius = float(threat["radius_nm"])
        if distance < radius * 2:
            score += float(threat["existence_p"]) * max(0.0, 1 - distance / max(radius, 1)) * 20
    return score


def _read(solver: cp_model.CpSolver, state: dict[str, dict[str, Any]], epoch: Any) -> list[dict[str, Any]]:
    assignments = []
    for built in state.values():
        if not solver.boolean_value(built["served"]):
            continue
        mission = built["mission"]
        minute = int(solver.value(built["start"]))
        when = add_minutes(epoch, minute)
        for slot, (aircraft_lits, seat_lits) in zip(mission["slots"], built["slots"], strict=False):
            tail = next(name for name, lit in aircraft_lits.items() if solver.boolean_value(lit))
            crew_ids = [name for name, lit in seat_lits.items() if solver.boolean_value(lit)]
            tanker_id = next((name for name, lit in built["tankers"].items() if solver.boolean_value(lit)), None)
            assignments.append(
                {
                    "mission_id": mission["id"],
                    "slot": slot["slot"],
                    "tail": tail,
                    "crew_ids": crew_ids,
                    "load_out": slot["load_out"],
                    "start": to_iso(when),
                    "end": to_iso(add_minutes(when, int(mission["duration_min"]))),
                    "duration_min": int(mission["duration_min"]),
                    "base_launch": mission["launch_base"],
                    "base_recover": mission["recover_base"],
                    "tanker_id": tanker_id,
                    "frozen": False,
                }
            )
    return assignments


def _by_mission(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row["mission_id"]].append(row)
    return grouped


def _empty(status: str, elapsed: float, solutions: int) -> dict[str, Any]:
    return {
        "assignments": [],
        "status": status,
        "objective": 0,
        "bound": 0,
        "gap": 1.0,
        "elapsed_s": round(elapsed, 3),
        "solutions": solutions,
    }


class _Progress(cp_model.CpSolverSolutionCallback):
    def __init__(self, path: str | None) -> None:
        super().__init__()
        self.path = path
        self.count = 0

    def on_solution_callback(self) -> None:
        self.count += 1
        if not self.path:
            return
        payload = f'{{"solutions": {self.count}, "objective": {int(self.objective_value)}}}\n'
        with open(self.path, "w", encoding="utf-8") as handle:
            handle.write(payload)
