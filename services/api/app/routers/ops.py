"""Operational routes."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from fusion.conflicts import conflicts as list_conflicts
from fusion.snapshot import fuse
from optimiser.explain import why_not
from optimiser.plan import build_plan
from optimiser.retask import _diff as assignment_diff
from optimiser.retask import apply_event, courses_of_action, impact, rank_coas
from optimiser.timeutil import parse_iso, to_dtg
from optimiser.validator import validate
from pydantic import BaseModel
from scenarios.generate import generate_world
from sqlalchemy import delete, select

from app.auditlog import append_audit, verify_chain
from app.clocking import tick
from app.deps import CsrfUser, Db, UserDep, need
from app.mission_import import MissionImport, load_import_rows, rejection_reason
from app.rbac import MASKED_ROLES
from app.schemas import AssignmentListIn
from app.tables import (
    AckRow,
    AircraftRow,
    AssignmentRow,
    CoaRow,
    CrewRow,
    DecisionRow,
    EventRow,
    MissionRow,
    PlanRow,
    SourceRow,
    StockRow,
    User,
)
from app.world import read_world, write_world

router = APIRouter(prefix="/api/v1", tags=["ops"])
UNITS = ["Wing Alfa", "Wing Bravo", "Wing Charlie", "Wing Delta"]


def _snapshot(db: Db) -> dict[str, Any]:
    try:
        return fuse(read_world(db))
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


def _next_event_id(db: Db) -> str:
    rows = list(db.scalars(select(EventRow.id)).all())
    return f"EVT-{len(rows) + 1:08d}"


def _normalize_event_type(kind: str) -> str:
    return {
        "BASE_CLOSED": "BASE_STATUS",
        "WEATHER_DEGRADATION": "WEATHER_UPDATE",
        "THREAT_EXPANSION": "THREAT_UPDATE",
        "AIRSPACE_BLOCKED": "AIRSPACE_CHANGE",
    }.get(kind, kind)


PLANNER_EVENTS = {
    "AIRCRAFT_NMC", "AIRCRAFT_RTS", "CREW_UNAVAILABLE", "BASE_STATUS", "BASE_CLOSED",
    "WEATHER_UPDATE", "WEATHER_DEGRADATION", "STORE_SHORTAGE", "NEW_TASK", "TASK_CHANGED",
    "TANKER_UNAVAILABLE", "SORTIE_FEEDBACK",
}
ANALYST_EVENTS = {"THREAT_UPDATE", "THREAT_EXPANSION", "AIRSPACE_CHANGE", "AIRSPACE_BLOCKED", "WEATHER_UPDATE", "WEATHER_DEGRADATION"}


def _version(if_match: str | None, current: int) -> None:
    if if_match is None or if_match.strip('"') != str(current):
        raise HTTPException(status_code=409, detail="Someone else edited this. Review the latest version and try again.")


class PatchBody(BaseModel):
    status: str | None = None
    defects: list[str] | None = None
    hours_24h: float | None = None
    qty: int | None = None
    reason: str = ""


class LoadBody(BaseModel):
    pack: str = "S1"
    seed: int = 26250
    scale: str = "M"


class ClockBody(BaseModel):
    status: str | None = None
    rate: int | None = None
    sim_now: str | None = None
    murphy: str | None = None


class EventBody(BaseModel):
    type: str
    severity: str = "CAUTION"
    payload: dict[str, Any]
    confidence: float = 0.9


class ReasonBody(BaseModel):
    reason: str = ""


@router.get("/registers/{kind}")
def registers(kind: str, user: UserDep, db: Db) -> dict[str, Any]:
    world = _snapshot(db)
    key = {
        "bases": "bases", "aircraft": "aircraft", "crew": "crew", "stocks": "stocks", "tankers": "tankers",
        "airspace": "airspace", "weather": "weather", "threats": "threats", "missions": "missions", "sources": "sources",
    }.get(kind)
    if key is None:
        raise HTTPException(status_code=404, detail="Unknown register.")
    items = []
    for row in world[key]:
        if key == "threats" and user.role in MASKED_ROLES:
            items.append({"id": row["id"], "kind": "restricted", "restricted": True})
        else:
            items.append(row)
    return {"items": items, "count": len(items)}


@router.patch("/aircraft/{tail}", dependencies=[])
def patch_aircraft(
    tail: str,
    body: PatchBody,
    db: Db,
    user: User = Depends(need("fleet_write")),
    if_match: str | None = Header(default=None),
) -> dict[str, Any]:
    row = db.get(AircraftRow, tail)
    if row is None:
        raise HTTPException(status_code=404, detail="That tail is not on the register.")
    _version(if_match, row.version)
    before = row.status
    if body.status:
        if body.status not in {"FMC", "PMC", "NMC"}:
            raise HTTPException(status_code=422, detail="Status must be FMC, PMC or NMC.")
        row.status = body.status
        row.effective_status = body.status
    if body.defects is not None:
        row.defects = body.defects
    row.version += 1
    append_audit(db, actor=user.id, action="aircraft.update", ref=tail, diff={"from": before, "to": row.status}, reason=body.reason)
    db.commit()
    return {"tail": tail, "status": row.status, "version": row.version}


@router.patch("/crew/{crew_id}")
def patch_crew(
    crew_id: str,
    body: PatchBody,
    db: Db,
    user: User = Depends(need("crew_write")),
    if_match: str | None = Header(default=None),
) -> dict[str, Any]:
    row = db.get(CrewRow, crew_id)
    if row is None:
        raise HTTPException(status_code=404, detail="That crew member is not on the roster.")
    _version(if_match, row.version)
    if body.status:
        row.status = body.status
    if body.hours_24h is not None:
        row.hours_24h = body.hours_24h
    row.version += 1
    append_audit(db, actor=user.id, action="crew.update", ref=crew_id, diff={"status": row.status}, reason=body.reason)
    db.commit()
    return {"id": crew_id, "status": row.status, "version": row.version}


@router.patch("/stocks/{stock_id}")
def patch_stock(
    stock_id: int,
    body: PatchBody,
    db: Db,
    user: User = Depends(need("stores_write")),
    if_match: str | None = Header(default=None),
) -> dict[str, Any]:
    row = db.get(StockRow, stock_id)
    if row is None:
        raise HTTPException(status_code=404, detail="That stock row does not exist.")
    _version(if_match, row.version)
    if body.qty is not None:
        if body.qty < 0:
            raise HTTPException(status_code=422, detail="Quantity cannot be negative.")
        row.qty = body.qty
    row.version += 1
    append_audit(db, actor=user.id, action="stock.update", ref=str(stock_id), diff={"qty": row.qty}, reason=body.reason)
    db.commit()
    return {"id": stock_id, "qty": row.qty, "version": row.version}


@router.post("/scenarios/load")
def load_scenario(body: LoadBody, db: Db, user: User = Depends(need("clock"))) -> dict[str, Any]:
    if body.pack not in {"S1", "S2", "S3", "S4", "S5"} or body.scale not in {"S", "M", "L", "XL"}:
        raise HTTPException(status_code=422, detail="Unknown scenario pack or scale.")
    world = generate_world(body.seed, body.pack, body.scale)
    write_world(db, world, reset_operational=True)
    append_audit(db, actor=user.id, action="scenario.load", ref=body.pack, diff={"seed": body.seed, "scale": body.scale})
    db.commit()
    missions = world["missions"]
    if not isinstance(missions, list):
        raise HTTPException(status_code=500, detail="The scenario did not load missions.")
    return {"pack": body.pack, "seed": body.seed, "scale": body.scale, "missions": len(missions)}


@router.post("/scenarios/reset")
def reset_scenario(db: Db, user: User = Depends(need("clock"))) -> dict[str, Any]:
    from app.tables import SimState

    sim = db.get(SimState, 1)
    if sim is None:
        raise HTTPException(status_code=409, detail="No scenario is loaded.")
    return load_scenario(LoadBody(pack=sim.pack, seed=sim.seed, scale=sim.scale), db, user)


@router.get("/clock")
def get_clock(user: UserDep, db: Db) -> dict[str, Any]:
    del user
    from app.tables import SimState

    sim = db.get(SimState, 1)
    if sim is None:
        raise HTTPException(status_code=409, detail="No scenario is loaded.")
    from app.clocking import projected_sim_now

    return {
        "pack": sim.pack, "seed": sim.seed, "scale": sim.scale, "epoch": sim.epoch, "sim_now": projected_sim_now(sim),
        "status": sim.status, "rate": sim.rate, "murphy": sim.murphy, "dtg": to_dtg(parse_iso(sim.sim_now)),
        "version": sim.version,
    }


@router.post("/clock")
def set_clock(body: ClockBody, db: Db, user: User = Depends(need("clock"))) -> dict[str, Any]:
    from app.tables import SimState

    sim = db.get(SimState, 1)
    if sim is None:
        raise HTTPException(status_code=409, detail="No scenario is loaded.")
    if body.status:
        if body.status not in {"PAUSED", "RUNNING"}:
            raise HTTPException(status_code=422, detail="Clock status must be PAUSED or RUNNING.")
        if body.status == "PAUSED":
            tick(sim, db)
            sim.wall_anchor = None
        if body.status == "RUNNING":
            sim.wall_anchor = datetime.now(UTC).isoformat()
        sim.status = body.status
    if body.rate:
        if body.rate not in {1, 10, 60}:
            raise HTTPException(status_code=422, detail="Rate must be 1, 10 or 60.")
        sim.rate = body.rate
    if body.sim_now:
        sim.sim_now = body.sim_now
    if body.murphy:
        sim.murphy = body.murphy
    sim.version += 1
    append_audit(db, actor=user.id, action="clock.update", ref="sim", diff=body.model_dump(exclude_none=True))
    db.commit()
    return get_clock(user, db)


@router.post("/plans/validate")
def validate_assignments(body: AssignmentListIn, db: Db, user: User = Depends(need("read"))) -> dict[str, Any]:
    del user
    return validate(_snapshot(db), body.as_dicts())


@router.post("/plans/optimise")
def optimise(db: Db, user: User = Depends(need("optimise"))) -> dict[str, Any]:
    world = _snapshot(db)
    workers = int(os.environ.get("SOLVER_WORKERS", "1"))
    built = build_plan(world, time_limit=10, seed=int(world["seed"]), workers=workers)
    plan_id = _store_plan(db, user.id, built, status="DRAFT")
    append_audit(db, actor=user.id, action="plan.optimise", ref=plan_id, diff=built["kpis"])
    db.commit()
    return {
        "plan_id": plan_id, "kpis": built["kpis"], "label": built["label"], "validation": built["validation"],
        "solver": built["solver"], "fallback": built["fallback"],
    }


def _store_plan(db: Db, actor: str, built: dict[str, Any], status: str, parent: str | None = None) -> str:
    count = len(list(db.scalars(select(PlanRow.id)).all())) + 1
    plan_id = f"PLN-{count:03d}"
    digest = hashlib.sha256(json.dumps(built["assignments"], sort_keys=True).encode()).hexdigest()
    db.add(PlanRow(
        id=plan_id, version_no=count, parent_id=parent, status=status,
        objective_weights=built.get("solver", {}).get("weights", {}), horizon=1440, seed=0,
        solver_stats={**built.get("solver", {}), **({"fallback": built["fallback"]} if "fallback" in built else {})},
        kpis=built["kpis"], label=built.get("label", ""),
        created_by=actor, digest=digest,
    ))
    db.flush()
    for row in built["assignments"]:
        db.add(AssignmentRow(plan_id=plan_id, payload=row))
    return plan_id


@router.get("/plans")
def list_plans(user: UserDep, db: Db) -> dict[str, Any]:
    del user
    rows = list(db.scalars(select(PlanRow).order_by(PlanRow.version_no.desc())).all())
    return {"items": [_plan_brief(row) for row in rows]}


@router.get("/plans/{plan_id}")
def get_plan(plan_id: str, user: UserDep, db: Db) -> dict[str, Any]:
    del user
    plan = db.get(PlanRow, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="That plan is not on the board.")
    assignments = [row.payload for row in db.scalars(select(AssignmentRow).where(AssignmentRow.plan_id == plan_id)).all()]
    return {**_plan_brief(plan), "assignments": assignments}


def _plan_brief(plan: PlanRow) -> dict[str, Any]:
    return {
        "id": plan.id, "version_no": plan.version_no, "parent_id": plan.parent_id, "status": plan.status,
        "kpis": plan.kpis, "label": plan.label, "digest": plan.digest, "created_by": plan.created_by,
        "submitted_by": plan.submitted_by, "solver": plan.solver_stats,
        "fallback": (plan.solver_stats or {}).get("fallback"),
    }


@router.post("/plans/{plan_id}/submit")
def submit_plan(plan_id: str, body: ReasonBody, db: Db, user: User = Depends(need("submit"))) -> dict[str, str]:
    plan = _require_plan(db, plan_id)
    if plan.status != "DRAFT":
        raise HTTPException(status_code=409, detail="Only a draft plan can be submitted.")
    assignments = [row.payload for row in db.scalars(select(AssignmentRow).where(AssignmentRow.plan_id == plan_id)).all()]
    report = validate(_snapshot(db), assignments)
    if not report["valid"]:
        message = report["violations"][0]["message"] if report["violations"] else "This plan fails validation."
        raise HTTPException(status_code=409, detail=message)
    plan.status = "PROPOSED"
    plan.submitted_by = user.id
    append_audit(db, actor=user.id, action="plan.submit", ref=plan_id, reason=body.reason)
    db.commit()
    return {"status": plan.status}


@router.post("/plans/{plan_id}/approve")
def approve_plan(plan_id: str, body: ReasonBody, db: Db, user: User = Depends(need("approve"))) -> dict[str, str]:
    plan = _require_plan(db, plan_id)
    if plan.status != "PROPOSED":
        raise HTTPException(status_code=409, detail="Only a proposed plan can be approved.")
    assignments = [row.payload for row in db.scalars(select(AssignmentRow).where(AssignmentRow.plan_id == plan_id)).all()]
    report = validate(_snapshot(db), assignments)
    if not report["valid"]:
        message = report["violations"][0]["message"] if report["violations"] else "This plan fails validation."
        raise HTTPException(status_code=409, detail=message)
    if plan.submitted_by == user.id:
        raise HTTPException(status_code=403, detail="The person who submitted this plan cannot approve it.")
    plan.status = "APPROVED"
    plan.approved_by = user.id
    db.add(DecisionRow(id=f"DEC-{plan_id}", actor=user.id, kind="approve", reason=body.reason, refs={"plan_id": plan_id}, at=datetime.now(UTC).isoformat()))
    append_audit(db, actor=user.id, action="plan.approve", ref=plan_id, reason=body.reason)
    db.commit()
    return {"status": plan.status}


@router.post("/plans/{plan_id}/co-approve")
def co_approve_plan(plan_id: str, body: ReasonBody, db: Db, user: User = Depends(need("co_approve"))) -> dict[str, str]:
    plan = _require_plan(db, plan_id)
    if plan.status != "APPROVED":
        raise HTTPException(status_code=409, detail="The commander must approve the plan before a co-sign.")
    if plan.approved_by == user.id or plan.submitted_by == user.id:
        raise HTTPException(status_code=403, detail="Co-sign must come from someone other than the submitter and the approver.")
    if plan.co_approved_by:
        raise HTTPException(status_code=409, detail="This plan is already co-signed.")
    plan.co_approved_by = user.id
    append_audit(db, actor=user.id, action="plan.co_approve", ref=plan_id, reason=body.reason)
    db.commit()
    return {"status": plan.status, "co_approved_by": user.id}


@router.post("/plans/{plan_id}/reject")
def reject_plan(plan_id: str, body: ReasonBody, db: Db, user: User = Depends(need("approve"))) -> dict[str, str]:
    plan = _require_plan(db, plan_id)
    if plan.status != "PROPOSED":
        raise HTTPException(status_code=409, detail="Only a proposed plan can be rejected.")
    plan.status = "REJECTED"
    append_audit(db, actor=user.id, action="plan.reject", ref=plan_id, reason=body.reason)
    db.commit()
    return {"status": plan.status}


@router.post("/plans/{plan_id}/publish")
def publish_plan(plan_id: str, body: ReasonBody, db: Db, user: User = Depends(need("publish"))) -> dict[str, Any]:
    plan = _require_plan(db, plan_id)
    if plan.status != "APPROVED":
        raise HTTPException(status_code=409, detail="Approve the plan before publishing it.")
    if not plan.co_approved_by:
        raise HTTPException(status_code=409, detail="An independent co-sign is required before publish.")
    assignments = [row.payload for row in db.scalars(select(AssignmentRow).where(AssignmentRow.plan_id == plan_id)).all()]
    report = validate(_snapshot(db), assignments)
    if not report["valid"]:
        message = report["violations"][0]["message"] if report["violations"] else "This plan fails validation."
        raise HTTPException(status_code=409, detail=message)
    digest = hashlib.sha256(json.dumps(assignments, sort_keys=True).encode()).hexdigest()
    if plan.digest != digest:
        raise HTTPException(status_code=409, detail="Plan digest does not match assignments. Create a new draft version.")
    for other in db.scalars(select(PlanRow).where(PlanRow.status == "PUBLISHED")).all():
        other.status = "SUPERSEDED"
    plan.status = "PUBLISHED"
    for unit in UNITS:
        db.add(AckRow(plan_id=plan_id, unit=unit, state="PENDING", at=None))
    append_audit(db, actor=user.id, action="plan.publish", ref=plan_id, reason=body.reason, diff={"digest": plan.digest})
    db.commit()
    return {"status": "PUBLISHED", "digest": plan.digest}


@router.post("/plans/{plan_id}/ack")
def acknowledge(plan_id: str, body: ReasonBody, db: Db, user: User = Depends(need("ack_ato"))) -> dict[str, str]:
    row = db.scalar(select(AckRow).where(AckRow.plan_id == plan_id, AckRow.state == "PENDING"))
    if row is None:
        raise HTTPException(status_code=404, detail="Nothing is waiting for acknowledgement.")
    row.state = "ACK"
    row.at = datetime.now(UTC).isoformat()
    append_audit(db, actor=user.id, action="ato.ack", ref=plan_id, diff={"unit": row.unit}, reason=body.reason)
    db.commit()
    return {"unit": row.unit, "state": "ACK"}


@router.get("/plans/{plan_id}/ato-diff")
def ato_diff(plan_id: str, user: UserDep, db: Db) -> dict[str, Any]:
    del user
    _require_plan(db, plan_id)
    previous = db.scalar(
        select(PlanRow)
        .where(PlanRow.status.in_(("PUBLISHED", "SUPERSEDED")), PlanRow.id != plan_id)
        .order_by(PlanRow.version_no.desc())
    )
    current_rows = [row.payload for row in db.scalars(select(AssignmentRow).where(AssignmentRow.plan_id == plan_id)).all()]
    prior_rows: list[dict[str, Any]] = []
    if previous is not None:
        prior_rows = [row.payload for row in db.scalars(select(AssignmentRow).where(AssignmentRow.plan_id == previous.id)).all()]
    changes = assignment_diff(prior_rows, current_rows)
    p1_dropped = sum(1 for row in changes if row.get("kind") == "dropped")
    return {
        "plan_id": plan_id,
        "previous_plan_id": previous.id if previous else None,
        "summary": (
            f"{len(changes)} assignment changes · "
            f"{sum(1 for row in changes if row.get('kind') == 'moved')} moved · "
            f"{p1_dropped} dropped slots"
        ),
        "changes": changes,
        "hard_violations": len(validate(_snapshot(db), current_rows)["violations"]),
    }


@router.get("/plans/{plan_id}/ato")
def ato(plan_id: str, user: UserDep, db: Db) -> dict[str, Any]:
    plan = _require_plan(db, plan_id)
    world = _snapshot(db)
    assignments = [row.payload for row in db.scalars(select(AssignmentRow).where(AssignmentRow.plan_id == plan_id)).all()]
    missions = {m["id"]: m for m in world["missions"]}
    lines = []
    for row in assignments:
        mission = missions.get(row["mission_id"], {})
        lines.append({
            "mission": row["mission_id"], "call_sign": mission.get("call_sign", row["mission_id"]),
            "type": mission.get("type"), "tail": row["tail"], "crew": row["crew_ids"], "load_out": row["load_out"],
            "launch": row["base_launch"], "recover": row["base_recover"], "start": row["start"], "end": row["end"],
            "start_dtg": to_dtg(parse_iso(row["start"])), "airspace": mission.get("airspace_ids", []),
            "aar": row.get("tanker_id"),
        })
    acks = [{"unit": a.unit, "state": a.state, "at": a.at} for a in db.scalars(select(AckRow).where(AckRow.plan_id == plan_id)).all()]
    return {"plan": _plan_brief(plan), "lines": lines, "acks": acks, "aco": world["airspace"], "role": user.role}


@router.get("/plans/{plan_id}/export")
def export_plan(plan_id: str, fmt: str, user: UserDep, db: Db) -> dict[str, Any]:
    if user.role not in {"commander", "planner", "auditor", "admin"}:
        raise HTTPException(status_code=403, detail="Your role cannot export.")
    document = ato(plan_id, user, db)
    if fmt == "json":
        return document
    if fmt == "signal":
        text = _signal(document)
        return {"format": "signal", "bytes": len(text.encode()), "text": text}
    if fmt == "csv":
        return {"format": "csv", "text": _csv(document)}
    if fmt == "pdf":
        import base64

        from app.pdfato import ato_pdf

        blob = ato_pdf(document)
        return {"format": "pdf", "bytes": len(blob), "base64": base64.b64encode(blob).decode()}
    raise HTTPException(status_code=422, detail="Format must be json, csv, signal or pdf.")


@router.put("/plans/{plan_id}/assignments")
def save_assignments(plan_id: str, body: AssignmentListIn, db: Db, user: User = Depends(need("plans"))) -> dict[str, Any]:
    plan = _require_plan(db, plan_id)
    if plan.status in {"APPROVED", "PUBLISHED"}:
        raise HTTPException(
            status_code=409,
            detail="Approved and published plans are locked. Optimise or select a COA to create a new draft.",
        )
    rows = body.as_dicts()
    report = validate(_snapshot(db), rows)
    if not report["valid"]:
        message = report["violations"][0]["message"] if report["violations"] else "That edit is not valid."
        raise HTTPException(status_code=409, detail=message)
    db.execute(delete(AssignmentRow).where(AssignmentRow.plan_id == plan_id))
    for row in rows:
        db.add(AssignmentRow(plan_id=plan_id, payload=row))
    append_audit(db, actor=user.id, action="plan.edit", ref=plan_id, diff={"assignments": len(rows)})
    db.commit()
    return {"plan_id": plan_id, "valid": True}


@router.get("/fusion/conflicts")
def fusion_conflicts(user: UserDep, db: Db) -> dict[str, Any]:
    del user
    return {"items": list_conflicts(db)}


def _signal(document: dict[str, Any]) -> str:
    plan = document["plan"]
    lines = [f"ATO {plan['id']} {plan['digest'][:12]}"]
    for row in document["lines"]:
        lines.append(f"{row['mission']} {row['call_sign']} {row['type']} {row['tail']} {row['start_dtg']} {row['load_out']}")
    text = "\n".join(lines)
    return text[:4000]


def _csv(document: dict[str, Any]) -> str:
    rows = ["mission,call_sign,type,tail,start,load_out,launch"]
    for row in document["lines"]:
        rows.append(f"{row['mission']},{row['call_sign']},{row['type']},{row['tail']},{row['start']},{row['load_out']},{row['launch']}")
    return "\n".join(rows)


@router.get("/missions/{mission_id}/why-not")
def mission_why_not(mission_id: str, user: UserDep, db: Db) -> dict[str, Any]:
    del user
    world = _snapshot(db)
    plan = db.scalar(select(PlanRow).order_by(PlanRow.version_no.desc()))
    assignments = []
    if plan is not None:
        assignments = [row.payload for row in db.scalars(select(AssignmentRow).where(AssignmentRow.plan_id == plan.id)).all()]
    return why_not(world, assignments, mission_id)


@router.get("/fusion/snapshot")
def fusion_snapshot(user: UserDep, db: Db) -> dict[str, Any]:
    del user
    snap = _snapshot(db)
    return {
        "theatre": snap.get("theatre"),
        "seed": snap.get("seed"),
        "fusion": snap.get("fusion"),
        "sources": snap.get("sources"),
    }


@router.post("/events")
def inject_event(body: EventBody, db: Db, user: CsrfUser) -> dict[str, Any]:
    from app.events_schema import EventIn

    try:
        parsed = EventIn(type=body.type, severity=body.severity, payload=body.payload, confidence=body.confidence)
        payload = parsed.validated_payload()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    kind = _normalize_event_type(body.type)
    if user.role == "analyst":
        if kind not in ANALYST_EVENTS:
            raise HTTPException(status_code=403, detail="Analysts may only inject threat, airspace and weather picture events.")
    elif user.role == "planner":
        if kind in {"THREAT_UPDATE", "AIRSPACE_CHANGE"}:
            raise HTTPException(status_code=403, detail="Threat and airspace updates are owned by the situation analyst.")
    elif user.role not in {"commander", "admin"}:
        raise HTTPException(status_code=403, detail="Your role cannot inject events.")
    if kind == "BASE_STATUS" and body.type == "BASE_CLOSED" and "status" not in payload:
        payload = {**payload, "status": "CLOSED"}
    world = read_world(db)
    event_id = _next_event_id(db)
    event = {"id": event_id, "type": kind, "severity": body.severity, "payload": payload, "confidence": body.confidence}
    updated = apply_event(world, event)
    write_world(db, updated)
    fused = _snapshot(db)
    db.add(EventRow(
        id=event_id, type=body.type, severity=body.severity, effective_at=fused["now"], payload=body.payload,
        source=user.id, confidence=body.confidence, status="OPEN",
    ))
    plan = db.scalar(select(PlanRow).where(PlanRow.status == "PUBLISHED").order_by(PlanRow.version_no.desc()))
    if plan is None:
        plan = db.scalar(select(PlanRow).order_by(PlanRow.version_no.desc()))
    assignments = []
    if plan is not None:
        assignments = [row.payload for row in db.scalars(select(AssignmentRow).where(AssignmentRow.plan_id == plan.id)).all()]
    blast = impact(fused, assignments, event)
    options = courses_of_action(fused, assignments, event, time_limit=8, seed=int(fused["seed"]))
    for index, option in enumerate(options, start=1):
        db.add(CoaRow(
            id=f"{event_id}-{option['id']}", event_id=event_id, preset=option["id"], metrics=option["metrics"],
            diff=option["diff"], rank=index, rationale=option["rationale"], recommended=option["recommended"],
            assignments=option["assignments"],
        ))
    append_audit(db, actor=user.id, action="event.inject", ref=event_id, diff={"type": body.type})
    db.commit()
    return {"event_id": event_id, "impact": blast, "coas": [_coa_public(row) for row in options]}


class MatrixWeights(BaseModel):
    value: int = 50
    stability: int = 50
    risk: int = 50
    reserve: int = 50
    coas: list[dict[str, Any]] | None = None


@router.post("/coas/rank")
def rank_courses(body: MatrixWeights, user: UserDep, db: Db) -> dict[str, Any]:
    del user
    coas = body.coas
    if not coas:
        event = db.scalar(select(EventRow).order_by(EventRow.id.desc()))
        if event is None:
            return {"items": []}
        rows = list(db.scalars(select(CoaRow).where(CoaRow.event_id == event.id)).all())
        coas = [
            {
                "id": row.preset,
                "name": row.preset,
                "changes": len(row.diff or []),
                "metrics": row.metrics,
                "recommended": row.recommended,
                "rationale": row.rationale,
                "diff": row.diff,
            }
            for row in rows
        ]
    ranked = rank_coas(
        coas,
        value=body.value,
        stability=body.stability,
        risk=body.risk,
        reserve=body.reserve,
    )
    return {"items": [_coa_public(row) for row in ranked]}


@router.get("/command/glance")
def command_glance(user: UserDep, db: Db) -> dict[str, Any]:
    del user
    world = _snapshot(db)
    plan = db.scalar(select(PlanRow).where(PlanRow.status == "PUBLISHED").order_by(PlanRow.version_no.desc()))
    if plan is None:
        plan = db.scalar(select(PlanRow).order_by(PlanRow.version_no.desc()))
    assignments: list[dict[str, Any]] = []
    validation = {"valid": False, "violations": []}
    if plan is not None:
        assignments = [row.payload for row in db.scalars(select(AssignmentRow).where(AssignmentRow.plan_id == plan.id)).all()]
        validation = validate(world, assignments)
    event = db.scalar(select(EventRow).order_by(EventRow.id.desc()))
    decision_required = event is not None and event.status == "OPEN"
    aircraft = world["aircraft"]
    crew = world["crew"]
    fmc = sum(1 for row in aircraft if row.get("effective_status", row["status"]) == "FMC")
    ready = sum(1 for row in crew if row["status"] == "AVAILABLE")
    fresh = sum(1 for row in aircraft if row.get("freshness") == "FRESH")
    latest_coas = []
    impact_summary = None
    if event is not None:
        coa_rows = list(db.scalars(select(CoaRow).where(CoaRow.event_id == event.id)).all())
        latest_coas = [{"id": r.preset, "recommended": r.recommended, "metrics": r.metrics} for r in coa_rows]
        if assignments:
            impact_summary = impact(world, assignments, {"type": event.type, "payload": event.payload})
    return {
        "plan": _plan_brief(plan) if plan else None,
        "validation": validation,
        "decision_required": decision_required,
        "decision_state": "COMMAND DECISION REQUIRED" if decision_required else "NO DECISION REQUIRED",
        "kpis": {
            "mission_fulfilment": (plan.kpis or {}).get("value_weighted_fulfilment") if plan else None,
            "p1_coverage": (plan.kpis or {}).get("p1_fulfilment") if plan else None,
            "aircraft_fmc": f"{fmc} / {len(aircraft)}",
            "crew_ready": f"{ready} / {len(crew)}",
            "data_freshness": f"{fresh} / {len(aircraft)} FRESH",
            "reserve_integrity": "OK" if validation.get("valid") else "Check plan",
        },
        "latest_event": {"id": event.id, "type": event.type} if event else None,
        "impact": impact_summary,
        "coa_count": len(latest_coas),
        "retask_href": "/app/retask",
    }


@router.get("/events/latest")
def latest_event(user: UserDep, db: Db) -> dict[str, Any]:
    del user
    event = db.scalar(select(EventRow).order_by(EventRow.id.desc()))
    if event is None:
        return {"event": None, "coas": []}
    coas = list(db.scalars(select(CoaRow).where(CoaRow.event_id == event.id)).all())
    return {
        "event": {"id": event.id, "type": event.type, "severity": event.severity, "payload": event.payload, "source": event.source},
        "coas": [
            {
                "id": row.preset,
                "coa_id": row.id,
                "name": row.preset,
                "recommended": row.recommended,
                "rationale": row.rationale,
                "metrics": row.metrics,
                "diff": row.diff,
                "changes": len(row.diff or []),
            }
            for row in coas
        ],
    }


def _coa_public(row: dict[str, Any]) -> dict[str, Any]:
    keys = ("id", "name", "recommended", "rationale", "changes", "metrics", "label", "diff", "matrix_score", "validation")
    return {key: row[key] for key in keys if key in row}


@router.post("/coas/{coa_id}/select")
def select_coa(coa_id: str, body: ReasonBody, db: Db, user: User = Depends(need("select_coa"))) -> dict[str, Any]:
    coa = db.get(CoaRow, coa_id)
    if coa is None:
        raise HTTPException(status_code=404, detail="That course of action is gone.")
    built = {"assignments": coa.assignments, "kpis": coa.metrics, "label": coa.rationale, "solver": {"status": "COA"}}
    plan_id = _store_plan(db, user.id, built, status="DRAFT")
    coa.plan_id = plan_id
    event = db.get(EventRow, coa.event_id)
    if event is not None:
        event.status = "RESOLVED"
    append_audit(db, actor=user.id, action="coa.select", ref=coa_id, reason=body.reason, diff={"plan_id": plan_id})
    db.commit()
    return {"plan_id": plan_id, "status": "DRAFT"}


class MissionPatch(BaseModel):
    priority: int | None = None
    value: int | None = None
    reason: str = ""


@router.patch("/missions/{mission_id}")
def patch_mission(
    mission_id: str,
    body: MissionPatch,
    db: Db,
    user: User = Depends(need("missions")),
    if_match: str | None = Header(default=None),
) -> dict[str, Any]:
    row = db.get(MissionRow, mission_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Mission not found.")
    _version(if_match, row.version)
    payload = dict(row.payload)
    if body.priority is not None:
        if body.priority < 1 or body.priority > 5:
            raise HTTPException(status_code=422, detail="Priority must be 1–5.")
        payload["priority"] = body.priority
    if body.value is not None:
        if body.value < 0:
            raise HTTPException(status_code=422, detail="Value cannot be negative.")
        payload["value"] = body.value
    row.payload = payload
    row.version += 1
    append_audit(db, actor=user.id, action="mission.update", ref=mission_id, diff=body.model_dump(exclude_none=True), reason=body.reason)
    db.commit()
    return {"mission": payload, "version": row.version}


@router.get("/system/health")
def system_health(user: UserDep, db: Db) -> dict[str, Any]:
    del user
    snap = _snapshot(db)
    fusion_meta = snap.get("fusion") or {}
    audit = verify_chain(db)
    return {
        "api": "OK",
        "db": "OK",
        "solver": "READY",
        "fusion": f"{fusion_meta.get('feeds_live', 0)}/{fusion_meta.get('feeds_total', 0)}",
        "audit": "PASS" if audit.get("valid") else "FAIL",
        "seed": snap.get("seed"),
        "synthetic": True,
    }


@router.post("/fusion/{source_id}/degrade")
def degrade(source_id: str, db: Db, user: User = Depends(need("connectors"))) -> dict[str, Any]:
    row = db.get(SourceRow, source_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Unknown feed.")
    payload = dict(row.payload)
    payload["degraded"] = not bool(payload.get("degraded"))
    payload["status"] = "DEGRADED" if payload["degraded"] else "LIVE"
    row.payload = payload
    append_audit(db, actor=user.id, action="feed.degrade", ref=source_id, diff={"status": payload["status"]})
    db.commit()
    return payload


@router.get("/audit")
def audit_list(user: UserDep, db: Db) -> dict[str, Any]:
    if user.role not in {"auditor", "commander", "admin"}:
        raise HTTPException(status_code=403, detail="Your role cannot read the audit log.")
    from app.tables import AuditEntry

    rows = list(db.scalars(select(AuditEntry).order_by(AuditEntry.seq.desc()).limit(200)).all())
    return {"items": [
        {"seq": r.seq, "at": r.at.isoformat(), "actor": r.actor, "action": r.action, "ref": r.ref, "reason": r.reason, "hash": r.hash}
        for r in rows
    ]}


@router.post("/audit/verify")
def audit_verify(db: Db, user: User = Depends(need("audit"))) -> dict[str, Any]:
    del user
    return verify_chain(db)


def _require_plan(db: Db, plan_id: str) -> PlanRow:
    plan = db.get(PlanRow, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="That plan is not on the board.")
    return plan


@router.post("/missions/import")
def import_missions(body: MissionImport, db: Db, user: User = Depends(need("missions"))) -> dict[str, Any]:
    parsed, fatal = load_import_rows(body)
    if fatal:
        raise HTTPException(status_code=422, detail=fatal)
    accepted = 0
    rejected: list[dict[str, str]] = []
    for row_id, mission, error in parsed:
        if error or mission is None:
            rejected.append({"row": row_id, "reason": error or "Rejected."})
            continue
        reason = rejection_reason(mission)
        if reason:
            rejected.append({"row": row_id, "reason": reason})
            continue
        row = db.get(MissionRow, str(mission["id"]))
        if row is None:
            db.add(MissionRow(id=str(mission["id"]), payload=mission, version=1))
        else:
            row.payload = mission
            row.version += 1
        accepted += 1
    append_audit(db, actor=user.id, action="mission.import", ref="missions", diff={"accepted": accepted, "rejected": len(rejected)})
    db.commit()
    return {"accepted": accepted, "rejected": rejected}


@router.get("/missions/{mission_id}")
def get_mission(mission_id: str, user: UserDep, db: Db) -> dict[str, Any]:
    row = db.get(MissionRow, mission_id)
    if row is None:
        raise HTTPException(status_code=404, detail="This airspace isn't on the chart.")
    return {"mission": row.payload, "role": user.role, "version": row.version}
