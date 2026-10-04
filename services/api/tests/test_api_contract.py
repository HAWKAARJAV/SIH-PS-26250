"""Smoke test: every documented route responds without 500."""

from __future__ import annotations

from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from scenarios.cli import seed


def _client(tmp_path) -> tuple[TestClient, str]:
    database = tmp_path / "contract.db"
    settings = Settings(
        database_url=f"sqlite:///{database}",
        cookie_secure=False,
        demo_mode=True,
        jwt_secret="test-secret-at-least-32-bytes-long",
    )
    app = create_app(settings)
    seed()
    client = TestClient(app)
    csrf = client.post("/api/v1/auth/demo", json={"role": "planner"}).json()["csrf"]
    return client, csrf


def test_public_and_read_routes(tmp_path) -> None:
    client, csrf = _client(tmp_path)
    assert client.get("/api/healthz").status_code == 200
    assert client.get("/readyz").status_code == 200
    assert client.get("/api/v1/auth/config").status_code == 200
    assert client.get("/api/v1/benchmark").status_code == 200
    assert client.get("/api/v1/forecast/serviceability").status_code == 200

    assert client.get("/api/v1/command/glance").status_code == 200
    assert client.get("/api/v1/system/health").status_code == 200
    assert client.get("/api/v1/clock").status_code == 200
    assert client.get("/api/v1/plans").status_code == 200
    assert client.get("/api/v1/registers/missions").status_code == 200
    assert client.get("/api/v1/fusion/snapshot").status_code == 200
    assert client.get("/api/v1/fusion/conflicts").status_code == 200
    assert client.get("/api/v1/events/latest").status_code == 200

    opt = client.post("/api/v1/plans/optimise", headers={"X-CSRF-Token": csrf})
    assert opt.status_code == 200
    plan_id = opt.json()["plan_id"]
    assert client.get(f"/api/v1/plans/{plan_id}").status_code == 200
    assert client.get(f"/api/v1/plans/{plan_id}/ato").status_code == 200
    assert client.get(f"/api/v1/plans/{plan_id}/ato-diff").status_code == 200
    assert client.get(f"/api/v1/plans/{plan_id}/export?fmt=json").status_code == 200
    mission_id = client.get("/api/v1/registers/missions").json()["items"][0]["id"]
    assert client.get(f"/api/v1/missions/{mission_id}").status_code == 200
    assert client.get(f"/api/v1/missions/{mission_id}/why-not").status_code == 200
    assert client.get(f"/api/v1/missions/{mission_id}/risk").status_code == 200
    assert client.post("/api/v1/assistant/query", json={"text": "status"}).status_code == 200
