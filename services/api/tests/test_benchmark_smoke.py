"""Two scale-S seeds only. The 30-seed medium CP-SAT sweep stays out of pytest."""

from __future__ import annotations

from analytics.benchmark import run


def test_scale_s_two_seed_benchmark_smoke() -> None:
    payload = run(range(1, 3), persist=False)
    assert payload["scale"] == "S"
    assert payload["runs"] == 2
    assert payload["seeds"] == [1, 2]
    assert all(row["greedy_valid"] and row["solver_valid"] for row in payload["rows"])
