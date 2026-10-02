from __future__ import annotations

from optimiser.greedy import greedy
from optimiser.plan import build_plan
from optimiser.timeutil import parse_iso, to_dtg
from optimiser.validator import validate
from scenarios.generate import generate_world, small_world


def test_dtg_format() -> None:
    assert to_dtg(parse_iso("2026-10-05T14:30:00+00:00")) == "051430Z OCT 26"


def test_small_greedy_is_valid() -> None:
    world = small_world(26250)
    plan = greedy(world)
    report = validate(world, plan)
    assert report["valid"], report["violations"][:4]


def test_small_solver_passes_validator() -> None:
    world = small_world(7)
    result = build_plan(world, time_limit=3, seed=7, workers=1)
    assert result["validation"]["valid"], result["validation"]["violations"][:6]
    assert result["kpis"]["hard_violations"] == 0 or result["validation"]["valid"]


def test_s1_greedy_has_no_hard_violations() -> None:
    world = generate_world(26250, "S1", "M")
    plan = greedy(world)
    report = validate(world, plan)
    assert report["valid"], report["violations"][:8]
    assert len({row["mission_id"] for row in plan}) >= 10
