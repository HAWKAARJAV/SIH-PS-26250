"""Compare the solver with the greedy baseline on small seeded days."""

from __future__ import annotations

import json
from pathlib import Path

from optimiser.greedy import greedy
from optimiser.plan import build_plan, score
from optimiser.validator import validate
from scenarios.generate import generate_world

OUT = Path(__file__).resolve().parents[3] / "docs" / "benchmarks" / "latest.json"


def run(seeds: range = range(1, 6), *, persist: bool = True) -> dict[str, object]:
    rows = []
    for seed in seeds:
        world = generate_world(seed, "S1", "S")
        greedy_plan = greedy(world)
        greedy_report = validate(world, greedy_plan)
        solved = build_plan(world, time_limit=3, seed=seed, workers=1)
        rows.append(
            {
                "seed": seed,
                "scale": "S",
                "pack": "S1",
                "simulated": True,
                "greedy_fulfilment": score(world, greedy_plan)["value_weighted_fulfilment"],
                "greedy_served": score(world, greedy_plan)["missions_served"],
                "greedy_valid": greedy_report["valid"],
                "solver_fulfilment": solved["kpis"]["value_weighted_fulfilment"],
                "solver_served": solved["kpis"]["missions_served"],
                "solver_valid": solved["validation"]["valid"],
                "solver_label": solved["label"],
                "missions_total": solved["kpis"]["missions_total"],
            }
        )
    beats = sum(1 for row in rows if row["solver_fulfilment"] >= row["greedy_fulfilment"] and row["solver_valid"])
    payload = {
        "simulated": True,
        "scale": "S",
        "seeds": list(seeds),
        "solver_beats_or_ties_greedy": beats,
        "runs": len(rows),
        "rows": rows,
    }
    if persist:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(payload, indent=2))
    return payload


def load() -> dict[str, object] | None:
    if not OUT.exists():
        return None
    from typing import cast

    return cast(dict[str, object], json.loads(OUT.read_text()))


if __name__ == "__main__":
    print(json.dumps({"wrote": str(OUT), "runs": run()["runs"]}))
