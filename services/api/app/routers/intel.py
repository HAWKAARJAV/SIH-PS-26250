"""Read-only intelligence routes."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from analytics.assistant import answer
from analytics.benchmark import load, run
from analytics.montecarlo import monte_carlo
from analytics.risk import mission_risk
from analytics.serviceability import train as train_serviceability
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import Db, UserDep, need
from app.routers.ops import _snapshot
from app.tables import User

router = APIRouter(prefix="/api/v1", tags=["intel"])
CARD = Path(__file__).resolve().parents[4] / "docs" / "benchmarks" / "serviceability.json"


class QueryBody(BaseModel):
    text: str


@router.get("/missions/{mission_id}/risk")
def risk(mission_id: str, user: UserDep, db: Db) -> dict[str, Any]:
    del user
    world = _snapshot(db)
    mission = next((row for row in world["missions"] if row["id"] == mission_id), None)
    if mission is None:
        raise HTTPException(status_code=404, detail="That mission is not in this scenario.")
    return mission_risk(world, mission)


@router.post("/assistant/query")
def query(body: QueryBody, user: UserDep, db: Db) -> dict[str, Any]:
    del user
    return answer(_snapshot(db), body.text)


@router.get("/benchmark")
def benchmark_latest() -> dict[str, Any]:
    payload = load()
    if payload is None:
        return {"simulated": True, "rows": [], "message": "No benchmark file yet. Run pnpm benchmark."}
    return payload


@router.get("/forecast/serviceability")
def serviceability_card(user: UserDep) -> dict[str, Any]:
    del user
    path = CARD
    if not path.exists():
        return {"simulated": True, "trained": False, "message": "No model card yet."}
    return json.loads(path.read_text())


@router.post("/forecast/serviceability")
def serviceability_train(db: Db, user: User = Depends(need("admin"))) -> dict[str, Any]:
    del db, user
    return train_serviceability()


@router.post("/montecarlo")
def montecarlo(db: Db, user: User = Depends(need("read"))) -> dict[str, Any]:
    del db, user
    return monte_carlo()


@router.post("/benchmark/run")
def benchmark_run(db: Db, user: User = Depends(need("admin"))) -> dict[str, Any]:
    del db, user
    return run(range(1, 4))
