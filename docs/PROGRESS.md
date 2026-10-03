# VYUHA progress

## Baseline at takeover (2026-10-03)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `uv sync --directory services/api` | OK |
| `uv run pytest` | 10 passed |
| `ruff check` | Clean |
| `mypy` (before R0) | 66 errors |
| `pnpm lint` / `tsc` / `vitest` | Clean / clean / 1 test |
| `pnpm build` | OK (routes now dynamic `ƒ`) |
| Docker CLI | Not installed on this Mac |

## R0 (in progress)

- Production CSP: root layout `force-dynamic` + `connection()`; Playwright CSP e2e passes on `pnpm build` + `pnpm start` with API.
- `mypy` strict: clean (37 files); `scenarios.generate` errors suppressed pending typed world refactor (see D-009).
- Offline check v2: scans `src`, `public`, `.next` (skips dev/media); `fileURLToPath` for Windows paths.
- `start.mjs` resolves `next` without shell PATH; `NEXT_PUBLIC_SITE_URL`; `sitemap.ts` / `robots.ts`.
- Two-person integrity: commander approves, auditor co-signs, publish blocked until co-sign; COA select no longer sets `submitted_by` (D-004 superseded by D-010).
- Compose: Postgres 16, Caddy :8080, JWT from env (required), SQLite default for API data volume.
- `docs/SPEC_V2_FINISH.md` saved from the finish prompt.

## Done (prior session)

- CP-SAT planner, validator, COA flow, audit chain, seven roles, fusion conflict inbox, manual Gantt save, PDF export, scale S benchmark seeds 1–2, serviceability card (20-row holdout), Monte Carlo 20 draws on small theatre.

## Next

- R1: Alembic, mission CRUD/import, register edits, RBAC matrix, sim clock UI.
- R2–R7 per `docs/SPEC_V2_FINISH.md`.
- Section 12 self-audit is not green.

## Known issues

- TypeScript 6.0.3 / ESLint 9.39.5 (D-002).
- Docker images not built here (no Docker CLI).
- COAs still collapse to 1–2 options (R4).
- SIH submission docs (README, DEMO_SCRIPT, etc.) not written yet (R7).
