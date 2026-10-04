# Data model (as stored)

Times are UTC ISO-8601 strings in JSON payloads and in several string columns. The UI may format Zulu or IST. Human ids follow `MSN-*`, `TAIL-*`, `CREW-*`, `BASE-*`, `PLN-*`, `EVT-*`.

Persistence is SQLAlchemy 2 models in `services/api/app/tables.py`. The process creates tables with `Base.metadata.create_all`. Alembic is not applied. See `docs/adr/0001-sqlite-prototype.md`.

Many spec entities are one JSON `payload` rather than normalised columns. That is intentional for SQLite/Postgres portability and means the logical fields below live inside that JSON unless a column is listed.

## Tables

| Table | Primary key | What is actually stored |
|-------|-------------|-------------------------|
| `users` | `id` | email, argon2 hash, role, display name, unused `mfa_secret`, `failed_logins`, `locked_until` |
| `sessions` | `id` | refresh hash, CSRF secret, expiry, `last_seen`, `revoked` |
| `audit_entries` | `id`, unique `seq` | actor, action, ref, JSON diff, reason, `prev_hash`, `hash` |
| `sim_state` | `id` | pack, seed, scale, epoch, sim time, status, rate, `murphy`, `version` |
| `parameters` | `id` | JSON doctrine/weights payload, `version` |
| `bases` | `id` | name, lat, lon, runway JSON, launch/recovery per 15 min, parking, fuel, status, closures, `version` |
| `aircraft_types` | `id` | JSON (class, roles, range, endurance, crew, load-out compat) |
| `aircraft` | `tail` | type, base, status, `effective_status`, defects, hours to inspection, sorties, `ready_at`, `p_mc` JSON, freshness, maintenance alias, `source_id`, `version` |
| `crew` | `id` | role, quals, base, hours, duty/rest, status, `fatigue_index`, freshness, `source_id`, `version` |
| `stocks` | `id` | base, load-out code, qty, `reserve_min`, freshness, `source_id`, `version` |
| `tankers` | `id` | JSON payload |
| `airspace` | `id` | JSON payload, `version` |
| `weather` | `id` | JSON payload |
| `threats` | `id` | JSON payload, `version` |
| `missions` | `id` | JSON payload (priority, window, slots, dependencies, status), `version` |
| `sources` | `id` | JSON feed descriptor |
| `provenance` | `id` | entity, field, source, observed_at, confidence, method. Runtime may `ALTER` in a `value` column that is not on the ORM model |
| `plans` | `id` | `version_no`, parent, status, weights, horizon, seed, solver stats, KPIs, label, created/submitted/approved/`co_approved_by`, digest, optimistic `version` |
| `assignments` | `id` | `plan_id`, JSON payload (tail, crew, load-out, start, end, bases) |
| `events` | `id` | type, severity, effective time, payload, source, confidence, status |
| `coas` | `id` | event, preset, optional plan id, metrics, diff, rank, rationale, recommended, assignment JSON |
| `decisions` | `id` | actor, kind, reason, refs, time |
| `jobs` | `id` | kind, status, progress, params, result ref. Schema only; optimise does not stream jobs |
| `notifications` | `id` | level, user, ref, message, state |
| `acks` | `id` | plan, unit, state, time |
| `idempotency` | `key` | stored JSON response |

## Plan status

Code paths use `DRAFT`, `PROPOSED`, `APPROVED`, `PUBLISHED`, `SUPERSEDED`, and reject. Publish moves other `PUBLISHED` rows to `SUPERSEDED`.

## Optimistic concurrency

Aircraft, crew, stock, mission, and plan updates compare `If-Match` to the integer `version` column and return 409 on mismatch (`app/routers/ops.py`).

## Identifiers and theatre

Generator theatre name is MERIDIAN. Bases are `BASE-ALFA`, `BASE-BRAVO`, `BASE-CHARLIE`, `BASE-DELTA`. Aircraft type ids are MRF, INT, AWC, TKR, TPT, ISR, ROT, UAV. Load-out codes are LC-A through LC-I with abstract descriptions in `scenarios/catalog.py`. Coordinates are fictional generator outputs.
