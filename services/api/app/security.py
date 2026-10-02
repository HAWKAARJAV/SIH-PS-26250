"""Password hashing, session cookies and CSRF."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.config import Settings

_hasher = PasswordHasher()
ACCESS_COOKIE = "vyuha_access"
REFRESH_COOKIE = "vyuha_refresh"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except VerifyMismatchError:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


def encode_access(settings: Settings, user_id: str, role: str, session_id: str) -> str:
    exp = datetime.now(UTC) + timedelta(minutes=settings.access_ttl_min)
    return jwt.encode(
        {"sub": user_id, "role": role, "sid": session_id, "exp": exp},
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_access(settings: Settings, token: str) -> dict[str, Any]:
    return dict(jwt.decode(token, settings.jwt_secret, algorithms=["HS256"]))


def as_utc(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        return moment.replace(tzinfo=UTC)
    return moment.astimezone(UTC)
