"""Facade: solver output is returned only when the independent validator agrees."""

from __future__ import annotations

from typing import Any

from scenarios.catalog import TIER_WEIGHT

from optimiser.greedy import greedy
from optimiser.model import solve_cpsat
from optimiser.validator import validate


def build_plan(
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
    greedy_plan = greedy(snapshot, frozen)
    solved = solve_cpsat(
        snapshot,
        time_limit=time_limit,
        seed=seed,
        workers=workers,
        frozen=frozen,
        weights=weights,
        previous=previous or greedy_plan,
        progress_path=progress_path,
    )
    candidate = solved["assignments"]
    report = validate(snapshot, candidate) if candidate else {"valid": False, "violations": [], "warnings": []}
    used_solver = bool(candidate) and report["valid"]
    assignments = candidate if used_solver else greedy_plan
    solver_status = str(solved["status"])
    fallback = _fallback(used_solver, solver_status, candidate, report)
    if not used_solver:
        report = validate(snapshot, assignments)
        solved = {**solved, "status": "HEURISTIC" if solved["status"] != "INFEASIBLE" else solved["status"]}
    return {
        "assignments": assignments,
        "validation": report,
        "solver": solved,
        "kpis": score(snapshot, assignments),
        "proven": used_solver and solved["status"] == "OPTIMAL",
        "label": solved["status"] if used_solver else "heuristic, not proven optimal",
        "fallback": fallback,
    }


def _fallback(
    used_solver: bool, solver_status: str, candidate: list[dict[str, Any]], report: dict[str, Any]
) -> dict[str, Any]:
    """Say plainly when the greedy plan replaced the CP-SAT plan, and why."""
    if used_solver:
        return {"used": False, "reason_codes": [], "solver_status": solver_status}
    reasons: list[str] = []
    if not candidate:
        reasons.append(f"SOLVER_{solver_status}" if solver_status in {"INFEASIBLE", "UNKNOWN", "MODEL_INVALID"} else "SOLVER_NO_PLAN")
    else:
        reasons.append("VALIDATOR_REJECTED")
        reasons.extend(sorted({str(v["code"]) for v in report["violations"]}))
    return {"used": True, "reason_codes": reasons, "solver_status": solver_status}


def score(snapshot: dict[str, Any], assignments: list[dict[str, Any]]) -> dict[str, float]:
    validation = validate(snapshot, assignments)
    served_ids = {row["mission_id"] for row in assignments}
    possible = 0
    got = 0
    p1_total = 0
    p1_got = 0
    for mission in snapshot["missions"]:
        tier = TIER_WEIGHT[int(mission["priority"])] * int(mission["value"])
        possible += tier
        if int(mission["priority"]) == 1:
            p1_total += 1
        if mission["id"] in served_ids:
            got += tier
            if int(mission["priority"]) == 1:
                p1_got += 1
    return {
        "value_weighted_fulfilment": round(got / possible, 4) if possible else 0.0,
        "p1_fulfilment": round(p1_got / p1_total, 4) if p1_total else 1.0,
        "missions_served": len(served_ids),
        "missions_total": len(snapshot["missions"]),
        "hard_violations": len(validation["violations"]),
    }
