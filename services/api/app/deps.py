"""Request dependencies."""

from __future__ import annotations

from collections.abc import Callable, Generator
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import session_scope
from app.rbac import allows
from app.security import ACCESS_COOKIE, as_utc, decode_access
from app.tables import SessionRow, User


def settings_dep() -> Settings:
    return get_settings()


def db_dep() -> Generator[Session, None, None]:
    yield from session_scope()


Db = Annotated[Session, Depends(db_dep)]
Cfg = Annotated[Settings, Depends(settings_dep)]


def current_user(request: Request, db: Db, settings: Cfg) -> User:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    try:
        payload = decode_access(settings, token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="The session expired. Sign in again.") from exc
    session = db.get(SessionRow, payload["sid"])
    if session is None or session.revoked or as_utc(session.expires_at) < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="The session expired. Sign in again.")
    idle = datetime.now(UTC) - as_utc(session.last_seen)
    if idle > timedelta(minutes=settings.idle_timeout_min):
        session.revoked = True
        db.commit()
        raise HTTPException(status_code=401, detail="The session timed out after inactivity.")
    session.last_seen = datetime.now(UTC)
    db.commit()
    user = db.get(User, payload["sub"])
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    request.state.session = session
    request.state.user = user
    return user


UserDep = Annotated[User, Depends(current_user)]


def csrf_user(request: Request, user: UserDep) -> User:
    if request.method != "GET":
        session: SessionRow = request.state.session
        header = request.headers.get("x-csrf-token")
        if not header or header != session.csrf:
            raise HTTPException(status_code=403, detail="The form token did not match. Refresh and try again.")
    return user


CsrfUser = Annotated[User, Depends(csrf_user)]


def need(perm: str) -> Callable[..., User]:
    def checker(user: CsrfUser) -> User:
        if not allows(user.role, perm):
            raise HTTPException(status_code=403, detail="Your role cannot do that.")
        return user

    return checker
