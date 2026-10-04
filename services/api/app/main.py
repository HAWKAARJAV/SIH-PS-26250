"""VYUHA HTTP API."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import Settings, set_settings
from app.db import configure_engine, get_engine
from app.routers.auth import router as auth_router
from app.routers.ops import router as ops_router
from app.tables import Base


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or Settings()
    if not cfg.demo_mode and cfg.jwt_secret in {"", "dev-only-change-me"}:
        raise RuntimeError("Set JWT_SECRET to a long random value when DEMO_MODE is false.")
    set_settings(cfg)
    if cfg.database_url.startswith("sqlite"):
        from pathlib import Path

        Path(cfg.database_url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
    configure_engine(cfg)
    engine = get_engine()
    Base.metadata.create_all(engine)
    if cfg.database_url.startswith("sqlite"):
        with engine.begin() as conn:
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(plans)")).all()}
            if "approved_by" not in cols:
                conn.execute(text("ALTER TABLE plans ADD COLUMN approved_by VARCHAR(64)"))
            if "co_approved_by" not in cols:
                conn.execute(text("ALTER TABLE plans ADD COLUMN co_approved_by VARCHAR(64)"))
    app = FastAPI(
        title="VYUHA",
        summary="Synthetic air operations planning prototype. Not for operational use.",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id(request: Request, call_next):  # type: ignore[no-untyped-def]
        request.state.request_id = request.headers.get("x-request-id", uuid.uuid4().hex[:16])
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(request, "HTTP_ERROR", str(exc.detail)),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content=_envelope(request, "VALIDATION", "The request could not be read.", {"errors": exc.errors()}))

    @app.get("/healthz")
    @app.get("/api/healthz")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "vyuha-api"}

    @app.get("/readyz")
    def ready() -> dict[str, str]:
        from app.db import SessionLocal

        if SessionLocal is None:
            return {"status": "not-ready"}
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()
        return {"status": "ready"}

    app.include_router(auth_router)
    app.include_router(ops_router)
    from app.routers.intel import router as intel_router

    app.include_router(intel_router)
    return app


def _envelope(request: Request, code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "details": details or {},
        "request_id": getattr(request.state, "request_id", ""),
    }


def _bootstrap_settings() -> Settings:
    cfg = Settings()
    if not cfg.demo_mode and cfg.jwt_secret == "dev-only-change-me":
        return Settings(demo_mode=True, jwt_secret="dev-only-change-me", database_url=cfg.database_url)
    return cfg


app = create_app(_bootstrap_settings())
