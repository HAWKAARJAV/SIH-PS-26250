from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings

_engine = None
SessionLocal: sessionmaker[Session] | None = None


def configure_engine(settings: Settings) -> None:
    global _engine, SessionLocal
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    _engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
    if settings.database_url.startswith("sqlite"):

        @event.listens_for(_engine, "connect")
        def _enable_fk(dbapi_connection: object, _: object) -> None:
            cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    SessionLocal = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False, future=True)


def get_engine() -> Engine:
    if _engine is None:
        raise RuntimeError("Database engine is not configured.")
    return _engine


def session_scope() -> Iterator[Session]:
    if SessionLocal is None:
        raise RuntimeError("Database engine is not configured.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
