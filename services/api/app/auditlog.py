"""Append-only audit hash chain."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.tables import AuditEntry


def _canonical(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def append_audit(
    db: Session,
    *,
    actor: str,
    action: str,
    ref: str,
    diff: dict[str, Any] | None = None,
    reason: str = "",
) -> AuditEntry:
    previous = db.scalar(select(AuditEntry).order_by(AuditEntry.seq.desc()).limit(1))
    prev_hash = previous.hash if previous else "GENESIS"
    seq = (previous.seq + 1) if previous else 1
    body = {
        "seq": seq,
        "actor": actor,
        "action": action,
        "ref": ref,
        "diff": diff or {},
        "reason": reason,
        "prev_hash": prev_hash,
    }
    digest = hashlib.sha256(_canonical(body).encode()).hexdigest()
    entry = AuditEntry(
        seq=seq,
        at=datetime.now(UTC),
        actor=actor,
        action=action,
        ref=ref,
        diff=diff or {},
        reason=reason,
        prev_hash=prev_hash,
        hash=digest,
    )
    db.add(entry)
    return entry


def verify_chain(db: Session) -> dict[str, Any]:
    rows = list(db.scalars(select(AuditEntry).order_by(AuditEntry.seq.asc())))
    prev = "GENESIS"
    for row in rows:
        body = {
            "seq": row.seq,
            "actor": row.actor,
            "action": row.action,
            "ref": row.ref,
            "diff": row.diff or {},
            "reason": row.reason,
            "prev_hash": row.prev_hash,
        }
        digest = hashlib.sha256(_canonical(body).encode()).hexdigest()
        if row.prev_hash != prev or row.hash != digest:
            return {"valid": False, "broken_seq": row.seq, "entries": len(rows)}
        prev = row.hash
    return {"valid": True, "entries": len(rows), "head": prev}
