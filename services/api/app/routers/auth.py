"""Authentication routes. Tokens stay in httpOnly cookies."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select

from app.auditlog import append_audit
from app.deps import Cfg, CsrfUser, Db, UserDep
from app.rbac import ROLES
from app.security import ACCESS_COOKIE, REFRESH_COOKIE, as_utc, encode_access, hash_token, new_token, verify_password
from app.tables import SessionRow, User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginBody(BaseModel):
    email: str
    password: str


class DemoBody(BaseModel):
    role: str


def _cookies(response: Response, settings: Cfg, access: str, refresh: str) -> None:
    common = {"httponly": True, "secure": settings.cookie_secure, "samesite": "lax"}
    response.set_cookie(ACCESS_COOKIE, access, path="/", **common)
    response.set_cookie(REFRESH_COOKIE, refresh, path="/api/v1/auth", **common)


def _issue(db: Db, settings: Cfg, user: User, response: Response, action: str) -> dict[str, object]:
    session_id = new_token()[:32]
    refresh = new_token()
    csrf = new_token()
    now = datetime.now(UTC)
    db.add(
        SessionRow(
            id=session_id,
            user_id=user.id,
            refresh_hash=hash_token(refresh),
            csrf=csrf,
            expires_at=now + timedelta(days=settings.refresh_ttl_days),
            last_seen=now,
            revoked=False,
        )
    )
    append_audit(db, actor=user.id, action=action, ref=user.email, reason=user.role)
    db.commit()
    _cookies(response, settings, encode_access(settings, user.id, user.role, session_id), refresh)
    return _public(user, csrf, settings)


def _public(user: User, csrf: str, settings: Cfg) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "display_name": user.display_name,
        "csrf": csrf,
        "demo_mode": settings.demo_mode,
        "idle_timeout_min": settings.idle_timeout_min,
    }


@router.get("/config")
def auth_config(settings: Cfg) -> dict[str, bool]:
    return {"demo_mode": settings.demo_mode}


@router.post("/login")
def login(body: LoginBody, db: Db, settings: Cfg, response: Response) -> dict[str, object]:
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    now = datetime.now(UTC)
    if user and user.locked_until and as_utc(user.locked_until) > now:
        raise HTTPException(status_code=429, detail="This account is locked for a few minutes.")
    if user is None or not verify_password(body.password, user.password_hash):
        if user is not None:
            user.failed_logins += 1
            if user.failed_logins >= 5:
                user.locked_until = now + timedelta(minutes=15)
                user.failed_logins = 0
            db.commit()
        raise HTTPException(status_code=401, detail="Email or password is wrong.")
    user.failed_logins = 0
    user.locked_until = None
    return _issue(db, settings, user, response, "login")


@router.post("/demo")
def demo(body: DemoBody, db: Db, settings: Cfg, response: Response) -> dict[str, object]:
    if not settings.demo_mode:
        raise HTTPException(status_code=404, detail="Demo sign-in is turned off.")
    if body.role not in ROLES:
        raise HTTPException(status_code=422, detail="Unknown role.")
    user = db.scalar(select(User).where(User.role == body.role))
    if user is None:
        raise HTTPException(status_code=404, detail="That demo user has not been seeded.")
    return _issue(db, settings, user, response, "demo-login")


@router.get("/me")
def me(request: Request, user: UserDep, settings: Cfg) -> dict[str, object]:
    return _public(user, request.state.session.csrf, settings)


@router.post("/logout")
def logout(request: Request, user: CsrfUser, db: Db, response: Response) -> dict[str, str]:
    request.state.session.revoked = True
    append_audit(db, actor=user.id, action="logout", ref=user.email)
    db.commit()
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth")
    return {"status": "signed-out"}


@router.post("/refresh")
def refresh(request: Request, db: Db, settings: Cfg, response: Response) -> dict[str, object]:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="The session expired. Sign in again.")
    session = db.scalar(
        select(SessionRow).where(SessionRow.refresh_hash == hash_token(token), SessionRow.revoked.is_(False))
    )
    if session is None or as_utc(session.expires_at) < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="The session expired. Sign in again.")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    session.revoked = True
    db.commit()
    return _issue(db, settings, user, response, "refresh")
