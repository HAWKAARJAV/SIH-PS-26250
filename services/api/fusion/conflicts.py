"""Conflicting observations stored beside the fused picture."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.tables import ProvenanceRow
from sqlalchemy import select, text
from sqlalchemy.orm import Session


def ensure_value_column(db: Session) -> None:
    rows = db.execute(text("PRAGMA table_info(provenance)")).all()
    if rows and not any(row[1] == "value" for row in rows):
        db.execute(text("ALTER TABLE provenance ADD COLUMN value VARCHAR(64)"))
        db.commit()


def seed_conflicts(db: Session, epoch: str) -> None:
    ensure_value_column(db)
    existing = db.scalar(select(ProvenanceRow.id).limit(1))
    if existing is not None:
        return
    rows = [
        ("TAIL-101", "status", "MSS", "FMC", 0.96),
        ("TAIL-101", "status", "EXF", "PMC", 0.62),
        ("CREW-001", "hours_24h", "CRFR", "6.5", 0.9),
        ("CREW-001", "hours_24h", "EXF", "7.0", 0.7),
    ]
    for entity, field, source, value, confidence in rows:
        db.add(
            ProvenanceRow(
                entity_ref=entity,
                field=field,
                source_id=source,
                observed_at=epoch,
                confidence=confidence,
                method="seeded-conflict",
            )
        )
        db.flush()
        db.execute(
            text("UPDATE provenance SET value = :value WHERE id = :id"),
            {"value": value, "id": db.scalar(select(ProvenanceRow.id).order_by(ProvenanceRow.id.desc()))},
        )


def conflicts(db: Session) -> list[dict[str, Any]]:
    ensure_value_column(db)
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    raw = db.execute(text("SELECT entity_ref, field, source_id, observed_at, confidence, value FROM provenance")).all()
    for entity, field, source, observed, confidence, value in raw:
        grouped[(entity, field)].append(
            {"source_id": source, "observed_at": observed, "confidence": confidence, "value": value}
        )
    inbox = []
    for (entity, field), observations in grouped.items():
        values = {row["value"] for row in observations}
        if len(values) < 2:
            continue
        inbox.append({"entity_ref": entity, "field": field, "observations": observations, "policy": _policy(field)})
    return inbox


def _policy(field: str) -> str:
    if field == "status":
        return "Maintenance is authoritative. An override needs a reason and an expiry."
    if field == "hours_24h":
        return "Crew hours take the higher, more conservative figure."
    return "Show both values until a person decides."
