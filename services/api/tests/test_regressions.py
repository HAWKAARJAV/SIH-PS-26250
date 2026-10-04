"""Regression tests for independent review findings (Section 3)."""

from __future__ import annotations

from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from optimiser.plan import build_plan
from scenarios.cli import seed
from scenarios.generate import generate_world


def _client(tmp_path) -> TestClient:
    database = tmp_path / "reg.db"
    settings = Settings(
        database_url=f"sqlite:///{database}",
        cookie_secure=False,
        demo_mode=True,
        jwt_secret="test-secret-at-least-32-bytes-long",
    )
    app = create_app(settings)
    seed()
    return TestClient(app)


def _csrf(client: TestClient, role: str = "planner") -> str:
    signed = client.post("/api/v1/auth/demo", json={"role": role})
    assert signed.status_code == 200
    return signed.json()["csrf"]


def test_c1_event_injection_preserves_plan_assignments(tmp_path) -> None:
    client = _client(tmp_path)
    csrf = _csrf(client, "planner")
    optimised = client.post("/api/v1/plans/optimise", headers={"X-CSRF-Token": csrf})
    assert optimised.status_code == 200
    plan_id = optimised.json()["plan_id"]
    before = client.get(f"/api/v1/plans/{plan_id}").json()
    count_before = len(before["assignments"])
    assert count_before > 0

    event = client.post(
        "/api/v1/events",
        json={"type": "AIRCRAFT_NMC", "severity": "WARNING", "payload": {"tail": "TAIL-114"}},
        headers={"X-CSRF-Token": csrf},
    )
    assert event.status_code == 200
    after = client.get(f"/api/v1/plans/{plan_id}").json()
    assert len(after["assignments"]) == count_before


def test_c2_solver_plan_passes_launch_recovery_validator() -> None:
    world = generate_world(26250, "S1", "M")
    result = build_plan(world, time_limit=8, seed=26250, workers=1)
    assert result["validation"]["valid"], result["validation"]["violations"][:6]
    assert result["kpis"]["hard_violations"] == 0
    rate_codes = {v["code"] for v in result["validation"]["violations"]}
    assert "LAUNCH_RATE" not in rate_codes
    assert "RECOVERY_RATE" not in rate_codes


def test_c4_published_plan_cannot_be_edited(tmp_path) -> None:
    client = _client(tmp_path)
    planner_csrf = _csrf(client, "planner")
    optimised = client.post("/api/v1/plans/optimise", headers={"X-CSRF-Token": planner_csrf})
    plan_id = optimised.json()["plan_id"]
    plan = client.get(f"/api/v1/plans/{plan_id}").json()
    assignments = plan["assignments"]

    client.post(f"/api/v1/plans/{plan_id}/submit", json={"reason": "demo"}, headers={"X-CSRF-Token": planner_csrf})
    commander_csrf = _csrf(client, "commander")
    client.post(f"/api/v1/plans/{plan_id}/approve", json={"reason": "ok"}, headers={"X-CSRF-Token": commander_csrf})
    auditor_csrf = _csrf(client, "auditor")
    client.post(f"/api/v1/plans/{plan_id}/co-approve", json={"reason": "ok"}, headers={"X-CSRF-Token": auditor_csrf})
    commander_csrf = _csrf(client, "commander")
    published = client.post(
        f"/api/v1/plans/{plan_id}/publish",
        json={"reason": "go"},
        headers={"X-CSRF-Token": commander_csrf},
    )
    assert published.status_code == 200

    planner_csrf = _csrf(client, "planner")
    denied = client.put(
        f"/api/v1/plans/{plan_id}/assignments",
        json={"assignments": assignments},
        headers={"X-CSRF-Token": planner_csrf},
    )
    assert denied.status_code == 409


def test_c4_published_plan_cannot_be_resubmitted(tmp_path) -> None:
    client = _client(tmp_path)
    planner_csrf = _csrf(client, "planner")
    optimised = client.post("/api/v1/plans/optimise", headers={"X-CSRF-Token": planner_csrf})
    plan_id = optimised.json()["plan_id"]

    client.post(f"/api/v1/plans/{plan_id}/submit", json={"reason": "demo"}, headers={"X-CSRF-Token": planner_csrf})
    commander_csrf = _csrf(client, "commander")
    client.post(f"/api/v1/plans/{plan_id}/approve", json={"reason": "ok"}, headers={"X-CSRF-Token": commander_csrf})
    auditor_csrf = _csrf(client, "auditor")
    client.post(f"/api/v1/plans/{plan_id}/co-approve", json={"reason": "ok"}, headers={"X-CSRF-Token": auditor_csrf})
    commander_csrf = _csrf(client, "commander")
    published = client.post(
        f"/api/v1/plans/{plan_id}/publish",
        json={"reason": "go"},
        headers={"X-CSRF-Token": commander_csrf},
    )
    assert published.status_code == 200

    planner_csrf = _csrf(client, "planner")
    again = client.post(
        f"/api/v1/plans/{plan_id}/submit",
        json={"reason": "retry"},
        headers={"X-CSRF-Token": planner_csrf},
    )
    assert again.status_code == 409
    assert client.get(f"/api/v1/plans/{plan_id}").json()["status"] == "PUBLISHED"
