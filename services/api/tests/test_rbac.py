from __future__ import annotations

from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from scenarios.cli import seed


def _app(tmp_path) -> TestClient:
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'rbac.db'}",
        cookie_secure=False,
        demo_mode=True,
        jwt_secret="test-secret-at-least-32-bytes-long",
    )
    app = create_app(settings)
    seed()
    return TestClient(app)


def _as(client: TestClient, role: str) -> str:
    response = client.post("/api/v1/auth/demo", json={"role": role})
    assert response.status_code == 200
    return response.json()["csrf"]


def test_role_matrix_core_actions(tmp_path) -> None:
    client = _app(tmp_path)
    auditor = _as(client, "auditor")
    denied = client.post("/api/v1/plans/optimise", headers={"X-CSRF-Token": auditor})
    assert denied.status_code == 403

    planner = _as(client, "planner")
    plan_id = client.post("/api/v1/plans/optimise", headers={"X-CSRF-Token": planner}).json()["plan_id"]
    client.post(f"/api/v1/plans/{plan_id}/submit", json={"reason": "x"}, headers={"X-CSRF-Token": planner})
    approve = client.post(f"/api/v1/plans/{plan_id}/approve", json={"reason": "x"}, headers={"X-CSRF-Token": planner})
    assert approve.status_code == 403

    fleet = _as(client, "fleet")
    threat = client.post(
        "/api/v1/events",
        json={"type": "THREAT_UPDATE", "payload": {"radius_nm": 20, "existence_p": 0.9}},
        headers={"X-CSRF-Token": fleet},
    )
    assert threat.status_code == 403
