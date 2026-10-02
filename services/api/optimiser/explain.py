"""Plain-English reasons for a mission the planner did not serve."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from optimiser.greedy import greedy
from optimiser.model import _allowed_starts, _candidate_aircraft, _candidate_crew, _held_tails, _threat_blocks
from optimiser.timeutil import add_minutes, parse_iso, to_iso
from optimiser.validator import validate


def why_not(snapshot: dict[str, Any], assignments: list[dict[str, Any]], mission_id: str) -> dict[str, Any]:
    mission = next((row for row in snapshot["missions"] if row["id"] == mission_id), None)
    if mission is None:
        return {"mission_id": mission_id, "reason": "That mission is not in this scenario.", "relaxations": []}
    if any(row["mission_id"] == mission_id for row in assignments):
        return {"mission_id": mission_id, "reason": f"{mission_id} is already on the plan.", "relaxations": []}
    epoch = parse_iso(snapshot["epoch"])
    held = _held_tails(snapshot)
    reason = _reason(snapshot, mission, held, epoch)
    relaxations = [
        _try_pmc(snapshot, assignments, mission),
        _try_window(snapshot, assignments, mission),
        _try_reserve(snapshot, assignments, mission),
        _try_drop_low(snapshot, assignments, mission),
    ]
    return {"mission_id": mission_id, "reason": reason, "relaxations": [row for row in relaxations if row]}


def _reason(snapshot: dict[str, Any], mission: dict[str, Any], held: set[str], epoch: Any) -> str:
    if _threat_blocks(snapshot, mission):
        return f"{mission['id']} crosses a no-go zone, so it cannot be tasked on this route."
    if not _allowed_starts(snapshot, mission, epoch):
        base = mission["launch_base"]
        return f"{mission['id']} has no launch time at {base} that meets weather minima and runway availability."
    for slot in mission["slots"]:
        if not _candidate_aircraft(snapshot, mission, slot, held):
            if _candidate_aircraft(snapshot, mission, slot, set()):
                return (
                    f"{mission['id']} has no {slot['type_id']} left at {mission['launch_base']} "
                    "once the reserve is held back."
                )
            return f"No serviceable {slot['type_id']} at {mission['launch_base']} can take {mission['id']}."
        if _candidate_crew(snapshot, mission, slot) == [] or not _crew_covers(snapshot, mission, slot):
            return f"{mission['id']} is short of qualified crew at {mission['launch_base']}."
    return (
        f"Every compatible aircraft for {mission['id']} is already committed, "
        "or taking it would break a hard constraint."
    )


def _crew_covers(snapshot: dict[str, Any], mission: dict[str, Any], slot: dict[str, Any]) -> bool:
    people = _candidate_crew(snapshot, mission, slot)
    covered = {qual for person in people for qual in person["quals"]}
    return all(qual in covered for qual in slot["quals"])


def _try_pmc(snapshot: dict[str, Any], assignments: list[dict[str, Any]], mission: dict[str, Any]) -> dict[str, str] | None:
    trial = deepcopy(snapshot)
    trial["parameters"]["accept_pmc"] = True
    if _serves(trial, assignments, mission["id"]):
        return {"id": "accept_pmc", "label": "Accept a PMC aircraft", "effect": f"{mission['id']} becomes feasible."}
    return None


def _try_window(snapshot: dict[str, Any], assignments: list[dict[str, Any]], mission: dict[str, Any]) -> dict[str, str] | None:
    trial = deepcopy(snapshot)
    for row in trial["missions"]:
        if row["id"] == mission["id"]:
            row["window_end"] = to_iso(add_minutes(parse_iso(row["window_end"]), 30))
    if _serves(trial, assignments, mission["id"]):
        return {"id": "widen_30", "label": "Widen the window by 30 minutes", "effect": f"{mission['id']} finds a slot."}
    return None


def _try_reserve(snapshot: dict[str, Any], assignments: list[dict[str, Any]], mission: dict[str, Any]) -> dict[str, str] | None:
    trial = deepcopy(snapshot)
    for key in trial["parameters"]["reserve_by_type"]:
        trial["parameters"]["reserve_by_type"][key] = 0
    if _serves(trial, assignments, mission["id"]):
        return {
            "id": "release_reserve",
            "label": "Release one reserved aircraft",
            "effect": f"{mission['id']} can launch if the reserve is reduced.",
        }
    return None


def _try_drop_low(
    snapshot: dict[str, Any], assignments: list[dict[str, Any]], mission: dict[str, Any]
) -> dict[str, str] | None:
    served = {row["mission_id"] for row in assignments}
    lowest = [
        row
        for row in snapshot["missions"]
        if row["id"] in served and int(row["priority"]) > int(mission["priority"])
    ]
    if not lowest:
        return None
    lowest.sort(key=lambda row: (-int(row["priority"]), int(row["value"])))
    drop_id = lowest[0]["id"]
    kept = [row for row in assignments if row["mission_id"] != drop_id]
    trial_snapshot = deepcopy(snapshot)
    for row in trial_snapshot["missions"]:
        if row["id"] == drop_id:
            row["status"] = "CANCELLED"
            row["window_end"] = row["window_start"]
    if _serves(trial_snapshot, kept, mission["id"]):
        return {
            "id": "drop_low",
            "label": f"Delay or drop {drop_id}",
            "effect": f"Freeing {drop_id} makes room for {mission['id']}.",
        }
    return None


def _serves(snapshot: dict[str, Any], frozen: list[dict[str, Any]], mission_id: str) -> bool:
    plan = greedy(snapshot, frozen)
    if not any(row["mission_id"] == mission_id for row in plan):
        return False
    return bool(validate(snapshot, plan)["valid"])
