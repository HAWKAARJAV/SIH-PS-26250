from __future__ import annotations

from collections.abc import Iterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings

_engine = None
SessionLocal: sessionmaker[Session] | None = None


def configure_engine(settings: Settings) -> None:
    global _engine, SessionLocal
    url, connect_args = _connect(settings.database_url)
    _engine = create_engine(url, connect_args=connect_args, future=True)
    if settings.database_url.startswith("sqlite"):

        @event.listens_for(_engine, "connect")
        def _enable_fk(dbapi_connection: object, _: object) -> None:
            cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    SessionLocal = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False, future=True)


def _connect(database_url: str) -> tuple[str, dict[str, object]]:
    if database_url.startswith("sqlite"):
        return database_url, {"check_same_thread": False}
    url = database_url
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url.removeprefix("postgresql://")
    # Neon's pooler is PgBouncer. Prepared statements and channel_binding fail there.
    connect_args: dict[str, object] = {}
    if "-pooler." in url:
        connect_args["prepare_threshold"] = None
        parts = urlsplit(url)
        query = [(key, value) for key, value in parse_qsl(parts.query) if key != "channel_binding"]
        url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return url, connect_args


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
