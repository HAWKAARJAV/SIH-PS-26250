from __future__ import annotations

from hypothesis import given
from hypothesis import settings as hyp_settings
from hypothesis import strategies as st
from optimiser.greedy import greedy
from optimiser.plan import build_plan
from optimiser.validator import validate
from scenarios.generate import small_world


@hyp_settings(max_examples=25, deadline=None)
@given(seed=st.integers(min_value=1, max_value=50))
def test_small_world_solver_valid_or_greedy_valid(seed: int) -> None:
    world = small_world(seed)
    result = build_plan(world, time_limit=3, seed=seed, workers=1)
    report = validate(world, result["assignments"])
    assert report["valid"], report["violations"][:4]


@hyp_settings(max_examples=20, deadline=None)
@given(seed=st.integers(min_value=201, max_value=800))
def test_greedy_valid_past_the_fixed_seed_loop(seed: int) -> None:
    world = small_world(seed)
    report = validate(world, greedy(world))
    assert report["valid"], report["violations"][:3]
