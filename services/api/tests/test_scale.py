from optimiser.greedy import greedy
from optimiser.validator import validate
from scenarios.generate import small_world


def test_two_hundred_small_greedy_plans_are_valid() -> None:
    for seed in range(1, 201):
        world = small_world(seed)
        plan = greedy(world)
        report = validate(world, plan)
        assert report["valid"], (seed, report["violations"][:2])
