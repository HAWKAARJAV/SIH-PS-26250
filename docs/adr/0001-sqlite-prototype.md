# ADR 0001 — SQLite and `create_all` for the prototype

**Status:** accepted for the hackathon prototype  
**Date:** 2026-10-05

## Context

`docs/SPEC.md` asks for SQLAlchemy 2, Alembic, SQLite in development, and PostgreSQL 16 in compose and production, with CI on both. The demo has to start with `pnpm seed` and `pnpm dev` and no Docker.

## Decision

The running prototype uses SQLite and creates tables in process.

- Default URL: `sqlite:///./data/vyuha.db` (`app/config.py`).
- `create_app` and `scenarios.cli seed` call `Base.metadata.create_all` (`app/main.py`, `scenarios/cli.py`).
- Nested fields (mission payload, assignment payload, weather, threats, airspace, tanker tracks) are JSON columns so the same models can move to Postgres later (`app/tables.py`).
- SQLite foreign keys are turned on with `PRAGMA foreign_keys=ON` (`app/db.py`).
- Older SQLite files are patched in place: `plans.approved_by` and `plans.co_approved_by` in `create_app`, and `provenance.value` in `fusion/conflicts.py`. Those `ALTER TABLE` statements are not Alembic revisions.

Alembic is the migration path, not the path the app uses today.

- `services/api/alembic.ini` and `services/api/alembic/env.py` exist.
- `env.py` sets `target_metadata = None`.
- `alembic.ini` still has the placeholder URL `driver://user:pass@localhost/dbname`.
- There is no `alembic/versions/` directory, so `alembic upgrade head` has nothing to apply.

`infra/docker-compose.yml` starts Postgres 16, but the API service defaults to `DATABASE_URL=sqlite:////data/vyuha.db`. Postgres is not the database the API writes unless that variable is overridden. CI runs pytest against the default SQLite engine only.

## Migration path

1. Point `alembic/env.py` at `app.tables.Base.metadata` and at `Settings.database_url`.
2. Generate one initial revision that matches the current tables, including `approved_by`, `co_approved_by`, and `provenance.value`.
3. Keep `create_all` for empty local SQLite files until that revision is reviewed.
4. For any shared or Postgres database, stop calling `create_all` and run `alembic upgrade head` before serving traffic.
5. Delete the ad-hoc `ALTER TABLE` blocks once every database has been upgraded through Alembic.
6. Run the same pytest suite with `DATABASE_URL` set to Postgres before calling the compose stack production-ready.

## Consequences

- A fresh clone can seed and demo without Docker or a migration history.
- Schema changes can drift: a new column on a machine that already has `vyuha.db` is invisible to `create_all` unless an `ALTER` is added by hand.
- Two developers can have different SQLite shapes and still pass tests that always create a new database.
