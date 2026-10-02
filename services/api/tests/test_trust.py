from __future__ import annotations

import app.db as database
from app.auditlog import verify_chain
from app.config import Settings
from app.db import configure_engine, get_engine
from app.main import create_app
from app.tables import AuditEntry, Base
from fastapi.testclient import TestClient
from scenarios.cli import seed
from sqlalchemy import select


def test_audit_detects_tampering(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "audit.db"
    settings = Settings(
        database_url=f"sqlite:///{database_path}",
        cookie_secure=False,
        demo_mode=True,
        jwt_secret="test-secret-at-least-32-bytes-long",
    )
    monkeypatch.chdir(tmp_path)
    configure_engine(settings)
    Base.metadata.create_all(get_engine())
    create_app(settings)
    seed()
    assert database.SessionLocal is not None
    db = database.SessionLocal()
    before = verify_chain(db)
    assert before["valid"] is True
    row = db.scalar(select(AuditEntry).order_by(AuditEntry.seq.desc()))
    assert row is not None
    row.hash = "tampered"
    db.commit()
    after = verify_chain(db)
    db.close()
    assert after["valid"] is False


def test_each_role_can_sign_in(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "roles.db"
    settings = Settings(
        database_url=f"sqlite:///{database_path}",
        cookie_secure=False,
        demo_mode=True,
        jwt_secret="test-secret-at-least-32-bytes-long",
    )
    monkeypatch.chdir(tmp_path)
    app = create_app(settings)
    seed()
    client = TestClient(app)
    for role in ("commander", "planner", "fleet", "crew_officer", "analyst", "auditor", "admin"):
        response = client.post("/api/v1/auth/demo", json={"role": role})
        assert response.status_code == 200, role
        assert response.json()["role"] == role


def test_assistant_status(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "ask.db"
    settings = Settings(
        database_url=f"sqlite:///{database_path}",
        cookie_secure=False,
        demo_mode=True,
        jwt_secret="test-secret-at-least-32-bytes-long",
    )
    monkeypatch.chdir(tmp_path)
    app = create_app(settings)
    seed()
    client = TestClient(app)
    client.post("/api/v1/auth/demo", json={"role": "commander"})
    response = client.post("/api/v1/assistant/query", json={"text": "what is the status"})
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "status"
    assert body["aircraft_total"] == 64
