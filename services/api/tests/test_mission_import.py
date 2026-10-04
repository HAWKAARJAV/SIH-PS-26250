"""JSON and CSV mission import share one row-level reject report."""

from __future__ import annotations

from app.config import Settings
from app.main import create_app
from app.mission_import import REQUIRED, rejection_reason
from fastapi.testclient import TestClient
from hypothesis import given
from hypothesis import settings as hyp_settings
from hypothesis import strategies as st
from scenarios.cli import seed

SAMPLE = {
    "id": "MSN-CSV-1",
    "type": "CAP",
    "priority": 2,
    "value": 80,
    "window_start": "2026-10-05T06:00:00+00:00",
    "window_end": "2026-10-05T10:00:00+00:00",
    "duration_min": 90,
    "slots": [{"slot": 0, "type_id": "MRF", "load_out": "LC-A", "quals": ["PLT"]}],
    "launch_base": "BASE-ALFA",
    "recover_base": "BASE-ALFA",
}


def _client(tmp_path) -> tuple[TestClient, dict[str, str]]:
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'import.db'}",
        cookie_secure=False,
        demo_mode=True,
        jwt_secret="test-secret-at-least-32-bytes-long",
    )
    app = create_app(settings)
    seed()
    client = TestClient(app)
    csrf = client.post("/api/v1/auth/demo", json={"role": "planner"}).json()["csrf"]
    return client, {"X-CSRF-Token": csrf}


def test_json_import_still_accepts_and_rejects_rows(tmp_path) -> None:
    client, headers = _client(tmp_path)
    bad = {key: SAMPLE[key] for key in SAMPLE if key != "launch_base"}
    response = client.post(
        "/api/v1/missions/import",
        headers=headers,
        json={"format": "json", "missions": [SAMPLE, bad, {**SAMPLE, "id": "MSN-CSV-9", "priority": 9}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] == 1
    assert body["rejected"] == [
        {"row": "1", "reason": "Missing launch_base"},
        {"row": "2", "reason": "Priority must be 1–5."},
    ]
    stored = client.get("/api/v1/missions/MSN-CSV-1")
    assert stored.status_code == 200
    assert stored.json()["mission"]["type"] == "CAP"
    assert stored.json()["version"] == 1

    again = client.post("/api/v1/missions/import", headers=headers, json={"missions": [{**SAMPLE, "value": 81}]})
    assert again.status_code == 200
    assert again.json()["accepted"] == 1
    assert client.get("/api/v1/missions/MSN-CSV-1").json()["version"] == 2


def test_csv_import_reports_bad_rows_and_keeps_good_ones(tmp_path) -> None:
    client, headers = _client(tmp_path)
    csv_text = "\n".join(
        [
            "id,type,priority,value,window_start,window_end,duration_min,launch_base,recover_base,type_id,load_out,quals",
            "MSN-ROW-1,SAR,1,96,2026-10-05T08:00:00Z,2026-10-05T12:00:00Z,80,BASE-DELTA,BASE-DELTA,ROT,LC-I,PLT|RESCUE",
            "MSN-ROW-2,CAP,8,40,2026-10-05T08:00:00Z,2026-10-05T12:00:00Z,60,BASE-ALFA,BASE-ALFA,MRF,LC-A,PLT",
            "MSN-ROW-3,CAP,2,not-a-number,2026-10-05T08:00:00Z,2026-10-05T12:00:00Z,60,BASE-ALFA,BASE-ALFA,MRF,LC-A,PLT",
        ]
    )
    response = client.post("/api/v1/missions/import", headers=headers, json={"csv": csv_text})
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] == 1
    reasons = {item["row"]: item["reason"] for item in body["rejected"]}
    assert reasons["3"] == "Priority must be 1–5."
    assert "integer" in reasons["4"]
    mission = client.get("/api/v1/missions/MSN-ROW-1").json()["mission"]
    assert mission["slots"] == [{"slot": 0, "type_id": "ROT", "load_out": "LC-I", "quals": ["PLT", "RESCUE"]}]
    assert mission["status"] == "REQUESTED"
    assert mission["source"] == "CSV"


def test_csv_header_failure_is_a_row_report(tmp_path) -> None:
    client, headers = _client(tmp_path)
    response = client.post("/api/v1/missions/import", headers=headers, json={"format": "csv", "csv": "id,type\nMSN-1,CAP\n"})
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] == 0
    assert body["rejected"][0]["row"] == "1"
    assert "Header missing" in body["rejected"][0]["reason"]


def test_import_without_payload_is_422(tmp_path) -> None:
    client, headers = _client(tmp_path)
    assert client.post("/api/v1/missions/import", headers=headers, json={}).status_code == 422
    assert client.post("/api/v1/missions/import", headers=headers, json={"format": "csv"}).status_code == 422


@hyp_settings(max_examples=25, deadline=None)
@given(priority=st.integers().filter(lambda value: value < 1 or value > 5))
def test_priority_outside_range_is_rejected(priority: int) -> None:
    mission = {key: "x" for key in REQUIRED}
    mission["priority"] = priority
    assert rejection_reason(mission) == "Priority must be 1–5."
