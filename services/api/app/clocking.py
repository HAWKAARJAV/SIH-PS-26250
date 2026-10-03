"""Advance the server clock from wall time while it is RUNNING."""

from __future__ import annotations

from datetime import UTC, datetime

from optimiser.timeutil import add_minutes, parse_iso, to_iso
from sqlalchemy.orm import Session

from app.tables import SimState


def tick(sim: SimState, db: Session) -> None:
    if sim.status != "RUNNING":
        return
    now = datetime.now(UTC)
    if not sim.wall_anchor:
        sim.wall_anchor = now.isoformat()
        db.commit()
        return
    anchor = parse_iso(sim.wall_anchor)
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=UTC)
    minutes = (now - anchor).total_seconds() / 60.0 * max(sim.rate, 1)
    if minutes < 0.05:
        return
    sim.sim_now = to_iso(add_minutes(parse_iso(sim.sim_now), int(round(minutes))))
    sim.wall_anchor = now.isoformat()
    db.commit()
