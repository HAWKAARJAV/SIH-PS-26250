"""Small Monte Carlo on the seeded small theatre."""

from __future__ import annotations

from copy import deepcopy

import numpy as np
from optimiser.greedy import greedy
from optimiser.validator import validate
from scenarios.generate import small_world


def monte_carlo(seed: int = 7, runs: int = 20) -> dict[str, object]:
    base = small_world(seed)
    rng = np.random.Generator(np.random.PCG64(seed))
    served = []
    valid = 0
    fmc = [row["tail"] for row in base["aircraft"] if row["status"] == "FMC"]
    for _ in range(runs):
        world = deepcopy(base)
        if fmc:
            victim = fmc[int(rng.integers(0, len(fmc)))]
            for craft in world["aircraft"]:
                if craft["tail"] == victim:
                    craft["status"] = "NMC"
                    craft["effective_status"] = "NMC"
        plan = greedy(world)
        report = validate(world, plan)
        if report["valid"]:
            valid += 1
        served.append(len({row["mission_id"] for row in plan}))
    return {
        "simulated": True,
        "seed": seed,
        "runs": runs,
        "valid_runs": valid,
        "served_min": min(served) if served else 0,
        "served_max": max(served) if served else 0,
        "served_mean": round(sum(served) / len(served), 2) if served else 0,
        "note": "Each run marks one random mission-capable tail NMC, then builds the greedy plan.",
    }
