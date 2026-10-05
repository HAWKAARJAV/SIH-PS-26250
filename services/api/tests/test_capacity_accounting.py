"""R0.1: launch and recovery capacity is counted per slot, like the independent validator does."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest
from hypothesis import given
from hypothesis import settings as hyp_settings
from hypothesis import strategies as st
from optimiser.model import solve_cpsat
from optimiser.plan import build_plan
from optimiser.validator import validate
from scenarios.generate import generate_world, small_world

RATE_CODES = {"LAUNCH_RATE", "RECOVERY_RATE"}


def _with_slots(world: dict[str, Any], counts: list[int]) -> dict[str, Any]:
    """Return a copy where mission i has counts[i] identical slots (mixed 1/2/3-slot packages)."""
    data = deepcopy(world)
    for mission, count in zip(data["missions"], counts, strict=False):
        template = mission["slots"][0]
        mission["slots"] = [{**template, "slot": index} for index in range(count)]
    return data


@pytest.mark.parametrize("seed", range(1, 31))
def test_m_scale_solver_plan_is_valid_without_fallback(seed: int) -> None:
    world = generate_world(seed, "S1", "M")
    solved = solve_cpsat(world, time_limit=5, seed=seed, workers=1)
    assert solved["status"] in {"OPTIMAL", "FEASIBLE"}
    report = validate(world, solved["assignments"])
    assert report["valid"], report["violations"][:4]
    built = build_plan(world, time_limit=5, seed=seed, workers=1)
    assert built["fallback"]["used"] is False, built["fallback"]


@hyp_settings(max_examples=25, deadline=None)
@given(
    seed=st.integers(min_value=1, max_value=60),
    counts=st.lists(st.integers(min_value=1, max_value=3), min_size=6, max_size=6),
    launch_rate=st.integers(min_value=1, max_value=4),
)
def test_mixed_slot_packages_pass_rate_parity(seed: int, counts: list[int], launch_rate: int) -> None:
    world = _with_slots(small_world(seed), counts)
    for base in world["bases"]:
        base["launch_rate_15m"] = launch_rate
        base["recovery_rate_15m"] = launch_rate
    solved = solve_cpsat(world, time_limit=2, seed=seed, workers=1)
    report = validate(world, solved["assignments"])
    assert report["valid"], report["violations"][:4]
    assert not RATE_CODES & {v["code"] for v in report["violations"]}
    served = {row["mission_id"] for row in solved["assignments"]}
    for mission in world["missions"]:
        if len(mission["slots"]) > launch_rate:
            assert mission["id"] not in served


def test_package_larger_than_base_rate_is_never_attempted() -> None:
    world = _with_slots(small_world(11), [3, 1, 1, 1, 1, 1])
    for base in world["bases"]:
        base["launch_rate_15m"] = 2
        base["recovery_rate_15m"] = 2
    solved = solve_cpsat(world, time_limit=2, seed=11, workers=1)
    served = {row["mission_id"] for row in solved["assignments"]}
    assert world["missions"][0]["id"] not in served
    assert validate(world, solved["assignments"])["valid"]


def test_two_packages_share_a_rate_limited_bin_only_when_it_fits() -> None:
    world = _with_slots(small_world(5), [2, 2, 2, 2, 2, 2])
    for base in world["bases"]:
        base["launch_rate_15m"] = 2
        base["recovery_rate_15m"] = 2
    solved = solve_cpsat(world, time_limit=3, seed=5, workers=1)
    report = validate(world, solved["assignments"])
    assert report["valid"], report["violations"][:4]
