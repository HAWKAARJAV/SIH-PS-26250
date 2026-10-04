from __future__ import annotations

from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from scenarios.cli import seed


def _client(tmp_path) -> TestClient:
    database = tmp_path / "evt.db"
    settings = Settings(
        database_url=f"sqlite:///{database}",
        cookie_secure=False,
        demo_mode=True,
        jwt_secret="test-secret-at-least-32-bytes-long",
    )
    app = create_app(settings)
    seed()
    return TestClient(app)


def test_malformed_event_returns_422_not_500(tmp_path) -> None:
    client = _client(tmp_path)
    csrf = client.post("/api/v1/auth/demo", json={"role": "planner"}).json()["csrf"]
    bad = client.post(
        "/api/v1/events",
        json={"type": "AIRCRAFT_NMC", "payload": {}},
        headers={"X-CSRF-Token": csrf},
    )
    assert bad.status_code == 422


def test_monotonic_event_ids(tmp_path) -> None:
    client = _client(tmp_path)
    csrf = client.post("/api/v1/auth/demo", json={"role": "planner"}).json()["csrf"]
    first = client.post(
        "/api/v1/events",
        json={"type": "AIRCRAFT_NMC", "payload": {"tail": "TAIL-101"}},
        headers={"X-CSRF-Token": csrf},
    ).json()["event_id"]
    second = client.post(
        "/api/v1/events",
        json={"type": "AIRCRAFT_NMC", "payload": {"tail": "TAIL-102"}},
        headers={"X-CSRF-Token": csrf},
    ).json()["event_id"]
    assert first < second
