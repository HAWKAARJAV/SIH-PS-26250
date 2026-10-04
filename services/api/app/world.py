"""Load and replace the theatre snapshot stored in the relational tables."""

from __future__ import annotations

from typing import Any

from scenarios.catalog import LOADOUTS
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.tables import (
    AircraftRow,
    AircraftTypeRow,
    AirspaceRow,
    AssignmentRow,
    BaseRow,
    CrewRow,
    MissionRow,
    ParameterRow,
    SimState,
    SourceRow,
    StockRow,
    TankerRow,
    ThreatRow,
    WeatherRow,
)


def clear_operational_plans(db: Session) -> None:
    """Remove plans and retask artefacts. Used only for scenario load/reset/seed."""
    from app.tables import AckRow, CoaRow, DecisionRow, EventRow, PlanRow

    for model in (AckRow, CoaRow, DecisionRow, AssignmentRow, PlanRow, EventRow):
        db.execute(delete(model))


def clear_theatre(db: Session) -> None:
    for model in (
        MissionRow,
        AircraftRow,
        CrewRow,
        StockRow,
        TankerRow,
        AirspaceRow,
        WeatherRow,
        ThreatRow,
        BaseRow,
        AircraftTypeRow,
        SourceRow,
        WeatherRow,
    ):
        db.execute(delete(model))


def write_world(db: Session, world: dict[str, Any], *, reset_operational: bool = False) -> None:
    if reset_operational:
        clear_operational_plans(db)
    clear_theatre(db)
    db.flush()
    for base in world["bases"]:
        db.add(BaseRow(**{key: base[key] for key in (
            "id", "name", "lat", "lon", "runways", "launch_rate_15m", "recovery_rate_15m",
            "parking", "fuel_state", "status", "closures",
        )}))
    for row in world["aircraft_types"]:
        db.add(AircraftTypeRow(id=row["id"], payload=row))
    for row in world["aircraft"]:
        db.add(AircraftRow(**{k: row[k] for k in (
            "tail", "type_id", "base_id", "status", "effective_status", "defects",
            "hours_to_inspection", "sorties_72h", "ready_at", "p_mc", "freshness",
            "maintenance_alias", "source_id",
        )}))
    for row in world["crew"]:
        db.add(CrewRow(
            id=row["id"], role=row["role"], quals=row["quals"], base_id=row["base_id"],
            hours_24h=row["hours_24h"], hours_7d=row["hours_7d"], duty_start=row["duty_start"],
            last_rest_end=row["last_rest_end"], available_at=row["available_at"], status=row["status"],
            fatigue_index=row["fatigue_index"], freshness=row["freshness"], source_id=row["source_id"],
        ))
    for row in world["stocks"]:
        db.add(StockRow(
            base_id=row["base_id"], code=row["code"], qty=row["qty"], reserve_min=row["reserve_min"],
            freshness=row["freshness"], source_id=row["source_id"],
        ))
    for row in world["tankers"]:
        db.add(TankerRow(id=row["id"], payload=row))
    for row in world["airspace"]:
        db.add(AirspaceRow(id=row["id"], payload=row))
    for row in world["weather"]:
        db.add(WeatherRow(id=row["id"], payload=row))
    for row in world["threats"]:
        db.add(ThreatRow(id=row["id"], payload=row))
    for row in world["missions"]:
        db.add(MissionRow(id=row["id"], payload=row))
    for row in world["sources"]:
        db.add(SourceRow(id=row["id"], payload={**row, "status": "LIVE", "degraded": False}))
    params = db.get(ParameterRow, 1)
    if params is None:
        db.add(ParameterRow(id=1, payload=world["parameters"], version=1))
    else:
        params.payload = world["parameters"]
        params.version += 1
    sim = db.get(SimState, 1)
    if sim is None:
        db.add(SimState(
            id=1, pack=world["pack"], seed=int(world["seed"]), scale=world["scale"],
            epoch=world["epoch"], sim_now=world["now"], status="PAUSED", rate=1, murphy="OFF",
        ))
    else:
        sim.pack = world["pack"]
        sim.seed = int(world["seed"])
        sim.scale = world["scale"]
        sim.epoch = world["epoch"]
        sim.sim_now = world["now"]
        sim.status = "PAUSED"
        sim.rate = 1
        sim.version += 1


def read_world(db: Session) -> dict[str, Any]:
    sim = db.get(SimState, 1)
    params = db.get(ParameterRow, 1)
    if sim is None or params is None:
        raise LookupError("No scenario is loaded. Run pnpm seed.")
    aircraft = []
    for row in db.scalars(select(AircraftRow)).all():
        aircraft.append({
            "tail": row.tail, "type_id": row.type_id, "base_id": row.base_id, "status": row.status,
            "effective_status": row.effective_status, "defects": row.defects, "hours_to_inspection": row.hours_to_inspection,
            "sorties_72h": row.sorties_72h, "ready_at": row.ready_at, "p_mc": row.p_mc,
            "freshness": row.freshness, "maintenance_alias": row.maintenance_alias, "source_id": row.source_id,
            "version": row.version,
        })
    return {
        "seed": sim.seed,
        "pack": sim.pack,
        "scale": sim.scale,
        "epoch": sim.epoch,
        "now": sim.sim_now,
        "horizon_min": 24 * 60,
        "theatre": "MERIDIAN",
        "parameters": params.payload,
        "bases": [_base(row) for row in db.scalars(select(BaseRow)).all()],
        "aircraft_types": [row.payload for row in db.scalars(select(AircraftTypeRow)).all()],
        "aircraft": aircraft,
        "crew": [_crew(row) for row in db.scalars(select(CrewRow)).all()],
        "loadouts": LOADOUTS,
        "stocks": [_stock(row) for row in db.scalars(select(StockRow)).all()],
        "tankers": [row.payload for row in db.scalars(select(TankerRow)).all()],
        "airspace": [row.payload for row in db.scalars(select(AirspaceRow)).all()],
        "weather": [row.payload for row in db.scalars(select(WeatherRow)).all()],
        "threats": [row.payload for row in db.scalars(select(ThreatRow)).all()],
        "missions": [row.payload for row in db.scalars(select(MissionRow)).all()],
        "sources": [row.payload for row in db.scalars(select(SourceRow)).all()],
    }


def _base(row: BaseRow) -> dict[str, Any]:
    return {
        "id": row.id, "name": row.name, "lat": row.lat, "lon": row.lon, "runways": row.runways,
        "launch_rate_15m": row.launch_rate_15m, "recovery_rate_15m": row.recovery_rate_15m,
        "parking": row.parking, "fuel_state": row.fuel_state, "status": row.status,
        "closures": row.closures, "version": row.version,
    }


def _crew(row: CrewRow) -> dict[str, Any]:
    return {
        "id": row.id, "role": row.role, "quals": row.quals, "base_id": row.base_id,
        "hours_24h": row.hours_24h, "hours_7d": row.hours_7d, "duty_start": row.duty_start,
        "last_rest_end": row.last_rest_end, "available_at": row.available_at, "status": row.status,
        "fatigue_index": row.fatigue_index, "freshness": row.freshness, "source_id": row.source_id,
        "version": row.version,
    }


def _stock(row: StockRow) -> dict[str, Any]:
    return {
        "base_id": row.base_id, "code": row.code, "qty": row.qty, "reserve_min": row.reserve_min,
        "freshness": row.freshness, "source_id": row.source_id, "version": row.version, "id": row.id,
    }
