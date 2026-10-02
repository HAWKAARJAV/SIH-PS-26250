"""Seed the fictional MERIDIAN theatre and the seven demo roles."""

from __future__ import annotations

import argparse
from pathlib import Path

from app.auditlog import append_audit
from app.config import get_settings, set_settings
from app.db import configure_engine, get_engine
from app.security import hash_password
from app.tables import Base, User
from app.world import write_world
from fusion.conflicts import seed_conflicts
from sqlalchemy import select

from scenarios.generate import generate_world

USERS = [
    ("USR-CMD", "commander@vyuha.local", "commander", "Commander"),
    ("USR-PLN", "planner@vyuha.local", "planner", "Ops Planner"),
    ("USR-FLT", "fleet@vyuha.local", "fleet", "Fleet Officer"),
    ("USR-CRW", "crew@vyuha.local", "crew_officer", "Crew Officer"),
    ("USR-ANL", "analyst@vyuha.local", "analyst", "Situation Analyst"),
    ("USR-AUD", "auditor@vyuha.local", "auditor", "Auditor"),
    ("USR-ADM", "admin@vyuha.local", "admin", "Admin"),
]


def seed(pack: str = "S1", seed_value: int = 26250, scale: str = "M") -> None:
    import app.db as database

    settings = get_settings()
    set_settings(settings)
    if settings.database_url.startswith("sqlite"):
        raw = settings.database_url.removeprefix("sqlite:///")
        Path(raw).parent.mkdir(parents=True, exist_ok=True)
    if database.SessionLocal is None:
        configure_engine(settings)
        Base.metadata.create_all(get_engine())
    if database.SessionLocal is None:
        raise RuntimeError("Database is not configured.")
    db = database.SessionLocal()
    world = generate_world(seed_value, pack, scale)
    write_world(db, world)
    seed_conflicts(db, str(world["epoch"]))
    password = hash_password(settings.demo_password)
    for user_id, email, role, name in USERS:
        existing = db.get(User, user_id)
        if existing is None:
            db.add(User(id=user_id, email=email, password_hash=password, role=role, display_name=name, failed_logins=0))
        else:
            existing.password_hash = password
            existing.role = role
    db.flush()
    if db.scalar(select(User).limit(1)) is not None:
        append_audit(db, actor="system", action="seed", ref=pack, diff={"seed": seed_value, "scale": scale})
    db.commit()
    db.close()
    print(f"Seeded {pack} seed={seed_value} scale={scale}. Demo password is in the environment, default Vyuha-demo-2026.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", nargs="?", default="seed")
    parser.add_argument("--pack", default="S1")
    parser.add_argument("--seed", type=int, default=26250)
    parser.add_argument("--scale", default="M")
    args = parser.parse_args()
    if args.command != "seed":
        raise SystemExit(f"Unknown command {args.command}")
    seed(args.pack, args.seed, args.scale)


if __name__ == "__main__":
    main()
