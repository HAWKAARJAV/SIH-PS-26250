# API endpoints

Prefix `/api/v1` unless noted. OpenAPI UI: `/api/docs`. Schema: `/api/openapi.json`.

Auth cookies: `vyuha_access`, `vyuha_refresh`. Mutating routes that depend on `CsrfUser` need the CSRF token issued at login. Register and plan writes that check versions need `If-Match`.

Roles below are the permission in `app/rbac.py`, not a hint.

## Health (no prefix)

| Method | Path | Auth |
|--------|------|------|
| GET | `/healthz` and `/api/healthz` | public |
| GET | `/readyz` | public, runs `SELECT 1` |

## Auth — `/api/v1/auth`

| Method | Path | Who |
|--------|------|-----|
| GET | `/config` | public; `{demo_mode}` |
| POST | `/login` | public; body `email`, `password` |
| POST | `/demo` | only if `DEMO_MODE`; body `role` |
| GET | `/me` | access cookie |
| POST | `/logout` | CSRF; revokes session |
| POST | `/refresh` | refresh cookie; rotates session |

No `/mfa` route.

## Registers, clock, plans, fusion, events — `/api/v1`

| Method | Path | Permission / notes |
|--------|------|--------------------|
| GET | `/registers/{kind}` | `read`. `kind=threats` is empty for fleet and crew officer |
| PATCH | `/aircraft/{tail}` | `fleet_write`, CSRF, If-Match |
| PATCH | `/crew/{crew_id}` | `crew_write`, CSRF, If-Match |
| PATCH | `/stocks/{stock_id}` | `stores_write`, CSRF, If-Match |
| PATCH | `/missions/{mission_id}` | `missions`, CSRF, If-Match |
| GET | `/missions/{mission_id}` | `read` |
| GET | `/missions/{mission_id}/why-not` | `read`; heuristic explainer |
| POST | `/missions/import` | `missions`, CSRF; JSON rows and a per-row report |
| POST | `/scenarios/load` | `clock`; body pack, seed, scale |
| POST | `/scenarios/reset` | `clock` |
| GET | `/clock` | `read` |
| POST | `/clock` | `clock` |
| GET | `/system/health` | `read` |
| GET | `/command/glance` | `read` |
| GET | `/fusion/snapshot` | `read` |
| GET | `/fusion/conflicts` | `read` |
| POST | `/fusion/{source_id}/degrade` | `connectors` (admin) |
| POST | `/events` | CSRF; planner `events` or analyst `intel_events`; payload checked |
| GET | `/events/latest` | `read` |
| POST | `/plans/validate` | `read` |
| POST | `/plans/optimise` | `optimise`; synchronous |
| GET | `/plans` | `read` |
| GET | `/plans/{plan_id}` | `read` |
| PUT | `/plans/{plan_id}/assignments` | `plans` |
| POST | `/plans/{plan_id}/submit` | `submit`; DRAFT → PROPOSED |
| POST | `/plans/{plan_id}/approve` | `approve` |
| POST | `/plans/{plan_id}/reject` | `approve` |
| POST | `/plans/{plan_id}/co-approve` | `co_approve` (auditor) |
| POST | `/plans/{plan_id}/publish` | `publish`; needs co-sign, digest, validator |
| POST | `/plans/{plan_id}/ack` | `ack_ato` |
| GET | `/plans/{plan_id}/ato` | `read` |
| GET | `/plans/{plan_id}/ato-diff` | `read` |
| GET | `/plans/{plan_id}/export?fmt=` | `export`; `json`, `csv`, `signal`, `pdf` |
| POST | `/coas/rank` | `read`; body weights |
| POST | `/coas/{coa_id}/select` | `select_coa`; writes a DRAFT plan |
| GET | `/audit` | `audit` |
| POST | `/audit/verify` | `audit` |

There is no `POST /scenarios/clone`, no `POST /fusion/ingest/{source}`, no WebSocket, and no admin user-CRUD route.

## Analytics — `/api/v1`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/missions/{mission_id}/risk` | `read` |
| POST | `/assistant/query` | `read` |
| GET | `/benchmark` | `read`; file `docs/benchmarks/latest.json` |
| GET | `/forecast/serviceability` | `read` |
| POST | `/forecast/serviceability` | `admin`; trains and writes the card JSON |
| POST | `/montecarlo` | `read`; fixed 20 greedy runs, seed 7 |
| POST | `/benchmark/run` | `admin`; calls `run(range(1, 4))` (seeds 1–3, scale S), not the CLI default |

## Event types accepted by `events_schema.py`

`AIRCRAFT_NMC`, `AIRCRAFT_RTS`, `AIRCRAFT_PMC`, `CREW_UNAVAILABLE`, `BASE_CLOSED`, `BASE_STATUS`, `WEATHER_DEGRADATION`, `WEATHER_UPDATE`, `THREAT_EXPANSION`, `THREAT_UPDATE`, `AIRSPACE_BLOCKED`, `STORE_SHORTAGE`, `TASK_PRIORITY_CHANGE`, `NEW_TASK`, `FEED_STALE`.

`AIRSPACE_CHANGE` is applied in `optimiser/retask.py` but **rejected** by the schema (422) unless a caller bypasses it. `TASK_CHANGED`, `TANKER_UNAVAILABLE`, `SORTIE_FEEDBACK`, and `GUIDANCE_CHANGE` from the spec are not in the allow-list.
