from __future__ import annotations

from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from scenarios.cli import seed


def _client(tmp_path, demo: bool = True) -> TestClient:
    database = tmp_path / "vyuha.db"
    settings = Settings(
        database_url=f"sqlite:///{database}",
        cookie_secure=False,
        demo_mode=demo,
        jwt_secret="test-secret-at-least-32-bytes-long",
    )
    app = create_app(settings)
    seed()
    return TestClient(app)


def test_health(tmp_path) -> None:
    client = _client(tmp_path)
    assert client.get("/api/healthz").json()["status"] == "ok"


def test_demo_login_and_auditor_cannot_mutate(tmp_path) -> None:
    client = _client(tmp_path)
    signed = client.post("/api/v1/auth/demo", json={"role": "auditor"})
    assert signed.status_code == 200
    csrf = signed.json()["csrf"]
    denied = client.patch(
        "/api/v1/aircraft/TAIL-101",
        json={"status": "NMC", "reason": "test"},
        headers={"X-CSRF-Token": csrf, "If-Match": "1"},
    )
    assert denied.status_code == 403
    aircraft = client.get("/api/v1/registers/aircraft")
    assert aircraft.status_code == 200
    assert aircraft.json()["count"] == 64


def test_demo_mode_off_hides_demo_login(tmp_path, monkeypatch) -> None:
    database = tmp_path / "off.db"
    settings = Settings(database_url=f"sqlite:///{database}", cookie_secure=False, demo_mode=False, jwt_secret="test-secret-at-least-32-bytes-long")
    app = create_app(settings)
    seed()
    client = TestClient(app)
    assert client.post("/api/v1/auth/demo", json={"role": "commander"}).status_code == 404
    del monkeypatch
