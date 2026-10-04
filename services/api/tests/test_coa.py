from __future__ import annotations

from optimiser.plan import build_plan
from optimiser.retask import courses_of_action
from scenarios.generate import generate_world


def test_event_yields_multiple_coas_on_m_scale() -> None:
    world = generate_world(26250, "S1", "M")
    baseline = build_plan(world, time_limit=8, seed=26250, workers=1)
    assert baseline["validation"]["valid"]
    event = {"type": "AIRCRAFT_NMC", "payload": {"tail": "TAIL-114"}}
    coas = courses_of_action(world, baseline["assignments"], event, time_limit=4, seed=26250)
    assert len(coas) >= 2, f"expected >=2 COAs, got {len(coas)}"
