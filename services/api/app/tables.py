"""Relational schema. Nested structures are JSON so SQLite and Postgres stay portable."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    role: Mapped[str] = mapped_column(String(32))
    display_name: Mapped[str] = mapped_column(String(120))
    mfa_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SessionRow(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    refresh_hash: Mapped[str] = mapped_column(String(128))
    csrf: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class AuditEntry(Base):
    __tablename__ = "audit_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    seq: Mapped[int] = mapped_column(Integer, unique=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(80))
    ref: Mapped[str] = mapped_column(String(120))
    diff: Mapped[dict[str, Any]] = mapped_column(JSON)
    reason: Mapped[str] = mapped_column(Text, default="")
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))


class SimState(Base):
    __tablename__ = "sim_state"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pack: Mapped[str] = mapped_column(String(8))
    seed: Mapped[int] = mapped_column(Integer)
    scale: Mapped[str] = mapped_column(String(4), default="M")
    epoch: Mapped[str] = mapped_column(String(40))
    sim_now: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(16), default="PAUSED")
    rate: Mapped[int] = mapped_column(Integer, default=1)
    wall_anchor: Mapped[str | None] = mapped_column(String(40), nullable=True)
    murphy: Mapped[str] = mapped_column(String(16), default="OFF")
    version: Mapped[int] = mapped_column(Integer, default=1)


class ParameterRow(Base):
    __tablename__ = "parameters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)


class BaseRow(Base):
    __tablename__ = "bases"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    runways: Mapped[list[Any]] = mapped_column(JSON)
    launch_rate_15m: Mapped[int] = mapped_column(Integer)
    recovery_rate_15m: Mapped[int] = mapped_column(Integer)
    parking: Mapped[int] = mapped_column(Integer)
    fuel_state: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(16))
    closures: Mapped[list[Any]] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)


class AircraftTypeRow(Base):
    __tablename__ = "aircraft_types"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class AircraftRow(Base):
    __tablename__ = "aircraft"
    tail: Mapped[str] = mapped_column(String(32), primary_key=True)
    type_id: Mapped[str] = mapped_column(String(16))
    base_id: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(8))
    effective_status: Mapped[str] = mapped_column(String(8))
    defects: Mapped[list[Any]] = mapped_column(JSON)
    hours_to_inspection: Mapped[float] = mapped_column(Float)
    sorties_72h: Mapped[int] = mapped_column(Integer)
    ready_at: Mapped[str] = mapped_column(String(40))
    p_mc: Mapped[dict[str, Any]] = mapped_column(JSON)
    freshness: Mapped[str] = mapped_column(String(16), default="FRESH")
    maintenance_alias: Mapped[str] = mapped_column(String(32))
    source_id: Mapped[str] = mapped_column(String(16), default="MSS")
    version: Mapped[int] = mapped_column(Integer, default=1)


class CrewRow(Base):
    __tablename__ = "crew"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    role: Mapped[str] = mapped_column(String(16))
    quals: Mapped[list[Any]] = mapped_column(JSON)
    base_id: Mapped[str] = mapped_column(String(32))
    hours_24h: Mapped[float] = mapped_column(Float)
    hours_7d: Mapped[float] = mapped_column(Float)
    duty_start: Mapped[str | None] = mapped_column(String(40), nullable=True)
    last_rest_end: Mapped[str] = mapped_column(String(40))
    available_at: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(16))
    fatigue_index: Mapped[float] = mapped_column(Float)
    freshness: Mapped[str] = mapped_column(String(16), default="FRESH")
    source_id: Mapped[str] = mapped_column(String(16), default="CRFR")
    version: Mapped[int] = mapped_column(Integer, default=1)


class StockRow(Base):
    __tablename__ = "stocks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    base_id: Mapped[str] = mapped_column(String(32))
    code: Mapped[str] = mapped_column(String(8))
    qty: Mapped[int] = mapped_column(Integer)
    reserve_min: Mapped[int] = mapped_column(Integer)
    freshness: Mapped[str] = mapped_column(String(16), default="FRESH")
    source_id: Mapped[str] = mapped_column(String(16), default="ASL")
    version: Mapped[int] = mapped_column(Integer, default=1)


class TankerRow(Base):
    __tablename__ = "tankers"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class AirspaceRow(Base):
    __tablename__ = "airspace"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)


class WeatherRow(Base):
    __tablename__ = "weather"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class ThreatRow(Base):
    __tablename__ = "threats"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)


class MissionRow(Base):
    __tablename__ = "missions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)


class SourceRow(Base):
    __tablename__ = "sources"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class ProvenanceRow(Base):
    __tablename__ = "provenance"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_ref: Mapped[str] = mapped_column(String(64))
    field: Mapped[str] = mapped_column(String(64))
    source_id: Mapped[str] = mapped_column(String(16))
    observed_at: Mapped[str] = mapped_column(String(40))
    confidence: Mapped[float] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String(32))


class PlanRow(Base):
    __tablename__ = "plans"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    version_no: Mapped[int] = mapped_column(Integer)
    parent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16))
    objective_weights: Mapped[dict[str, Any]] = mapped_column(JSON)
    horizon: Mapped[int] = mapped_column(Integer)
    seed: Mapped[int] = mapped_column(Integer)
    solver_stats: Mapped[dict[str, Any]] = mapped_column(JSON)
    kpis: Mapped[dict[str, Any]] = mapped_column(JSON)
    label: Mapped[str] = mapped_column(String(80), default="")
    created_by: Mapped[str] = mapped_column(String(64))
    submitted_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    digest: Mapped[str] = mapped_column(String(64), default="")
    version: Mapped[int] = mapped_column(Integer, default=1)


class AssignmentRow(Base):
    __tablename__ = "assignments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class EventRow(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    type: Mapped[str] = mapped_column(String(40))
    severity: Mapped[str] = mapped_column(String(16))
    effective_at: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(32))
    confidence: Mapped[float] = mapped_column(Float, default=1)
    status: Mapped[str] = mapped_column(String(16), default="OPEN")


class CoaRow(Base):
    __tablename__ = "coas"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str] = mapped_column(String(64))
    preset: Mapped[str] = mapped_column(String(8))
    plan_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON)
    diff: Mapped[list[Any]] = mapped_column(JSON)
    rank: Mapped[int] = mapped_column(Integer)
    rationale: Mapped[str] = mapped_column(Text, default="")
    recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    assignments: Mapped[list[Any]] = mapped_column(JSON)


class DecisionRow(Base):
    __tablename__ = "decisions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    actor: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(Text, default="")
    refs: Mapped[dict[str, Any]] = mapped_column(JSON)
    at: Mapped[str] = mapped_column(String(40))


class JobRow(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16))
    progress: Mapped[dict[str, Any]] = mapped_column(JSON)
    params: Mapped[dict[str, Any]] = mapped_column(JSON)
    result_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)


class NotificationRow(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    level: Mapped[str] = mapped_column(String(16))
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ref: Mapped[str] = mapped_column(String(120))
    message: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(16), default="OPEN")


class AckRow(Base):
    __tablename__ = "acks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[str] = mapped_column(String(64))
    unit: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(16))
    at: Mapped[str | None] = mapped_column(String(40), nullable=True)


class IdempotencyRow(Base):
    __tablename__ = "idempotency"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    response: Mapped[dict[str, Any]] = mapped_column(JSON)
