# Quality notes (2026-10-05)

These notes compare the tree to `docs/SPEC.md` and to the code that was read that day. They do not change product behaviour.

## Playwright `e2e/judge-journey.spec.ts`

The spec is too brittle to treat as a required local browser run when ports are already in use.

What it does today:

- Opens `/login`, clicks a button matching `/Ops Planner|planner/i`, then `/app/plan`.
- Clicks **Optimise** and waits up to 60s for text matching `/valid|PLN-/i`.
- Opens `/app/retask`, clicks **Inject disruption**, and waits up to 90s for text matching `/COA|courses of action|distinct/i`.

Why that fails closed:

- `apps/web/playwright.config.mjs` starts uvicorn on `127.0.0.1:8000` with no `reuseExistingServer`. If something is already bound to 8000, Playwright’s webServer step fails before a test runs.
- The web server reuses an existing server only when `CI` is unset. In CI it always tries to start both processes.
- The assertions accept any “valid” or “PLN-” string, so a failed optimise that still prints a plan id can pass, and a real COA card that uses different copy can fail.
- The file does not sign in as Commander or Auditor, and it does not publish or verify the audit chain. `e2e/csp-production.spec.ts` only checks the landing Murphy sketch, `/login`, and console/CSP noise. Spec journeys J1–J8 are not covered.
- Judge Mode in the app is a step list with **RESET DEMO**. It does not implement arrow-key scenes, `N` presenter notes, or `?scene=`.

Do not kill processes on ports 3000 or 8000 to make this pass. If either port is busy, skip the browser run and say so. CI in `.github/workflows/ci.yml` still installs Chromium and runs `pnpm --filter @vyuha/web e2e`; that step was left in place.

`PLAYWRIGHT_SKIP_SERVER` is set only as a truthy check in the config (`process.env.PLAYWRIGHT_SKIP_SERVER ? undefined : ...`). Setting it skips **both** the API and the web server. That is safe only when a demo is already healthy on the configured base URL. It is not a fallback for a busy port.

## Docs checked against code

Updated the same day from routers, `app/tables.py`, fusion, the optimiser, analytics, the landing page, and the judge page. Numbers in `docs/BENCHMARKS.md` are only the two rows in `docs/benchmarks/latest.json`. Citations in `docs/REFERENCES.md` say whether the URL was opened.

## Still not 100% of `docs/SPEC.md`

The prototype covers a judge path: synthetic MERIDIAN data, seven roles, eight named feeds, CP-SAT plus an independent validator, four COA presets plus a reserve-release preset, ATO submit / approve / co-sign / publish, hash-chained audit, and a short benchmark file. It is not the full master prompt.

### Product and screens

- Landing (`apps/web/src/app/page.tsx`) has a disclaimer, a self-contained mini board with **Murphy strikes**, Fuse/Plan/Retask/Decide, a domain list, a live benchmark sentence, optional team, and two CTAs. It does not have a feature grid, trust section, ATO-cycle visual, inline architecture SVG, roadmap, or FAQ.
- No `/app/simulate`, `/app/handover`, or `/app/settings`. Admin only loads a scenario pack.
- No Hindi UI (`next-intl` is a dependency and is not imported under `apps/web/src`).
- No command palette, glossary popovers, or the `g`/`o`/`v` shortcut map. No first-run tour.
- Planner shows a Gantt and Optimise / Validate. Drag, resize, reassignment, Smart Insert, and a table alternative were not found in the planner page.
- Map is MapLibre with HTML markers for bases. Time slider, threat rings, weather cells, routes, tanker tracks, measure tool, and route-risk heat are not on that page.
- Resource tables are not the virtualised saved-view grids in the spec.
- Judge Mode is a manual step list. It does not reset in under 2 seconds with caption overlay, arrow keys, or deep link `?scene=`.
- No delegation envelopes. No shift-handover PDF.
- Service worker file exists; spec offline behaviour (cached reads with age, IndexedDB mutation queue, low-bandwidth mode) is not implemented as specified. `scripts/check-offline.mjs` is the CI offline check that does exist.

### Optimiser, fusion, analytics

- CP-SAT covers a subset of the hard constraints (aircraft and crew no-overlap, stock, 15-minute launch/recovery caps, sortie and duty caps, dependencies, exclusive airspace, tanker intervals, weather filter, threat block, reserve hold). It is not the full Section 7.1 model (package sync in the solver, freeze window, civil corridors, endurance/AAR as first-class intervals, streamed incumbent UI, cancel, keep-best).
- “Why not” is a plain-English heuristic in `optimiser/explain.py` with a relaxation menu. There is no CP-SAT assumption unsat core.
- Re-plan targets (p50 ≤ 3 s, p95 ≤ 8 s) are not measured. COA presets A–D exist; preset R (reserve release) is extra. Parallel preset runs exist in `optimiser/retask.py`. Invariant tests are not a 30-seed acceptance report.
- Fusion applies degrade policies for MSS, MET, TIP, and CRFR and stores a few seeded conflicts. It is not an eight-feed ingest pipeline with schema reject, alias tables, Bayesian threat update, or freshness states driving every optimiser constraint. There is no `ingest/{source}` route.
- Serviceability card is logistic regression on the current seeded fleet (`docs/benchmarks/serviceability.json`: seed 26250, 20 holdout rows, AUC 0.778, Brier 0.073). The planner still uses generator `p_mc`. No Weibull, LightGBM, SHAP, or weather-window model, despite those libraries being listed in `services/api/pyproject.toml`.
- Mission risk is a weighted heuristic. Monte Carlo is 20 greedy runs on the small theatre with one random NMC tail, not 500 CP-SAT runs with a fan chart.
- Assistant answers a handful of regex intents. It is not ~25 intents, and there is no LLM adapter.
- Benchmark file on disk is scale S, seeds 1 and 2 only (`docs/benchmarks/latest.json`). The script default is `range(1, 6)` still at scale S. Spec acceptance is 30 seeds at S/M/L/XL and optimiser beating greedy on value in at least 90% of scenarios. That study has not been run. Both stored rows tie greedy on value-weighted fulfilment and serve one more mission.

### Platform, security, quality gates

- No WebSocket `/ws`. Optimise is a synchronous HTTP call, not a cancellable job with progress streaming. `jobs` rows exist in the schema and are not a ProcessPool job manager.
- No OpenAPI-generated `packages/contracts` wired as the live client (a `pnpm contracts` script exists).
- Alembic is a skeleton. See `docs/adr/0001-sqlite-prototype.md`. CI does not run Postgres.
- Auth has argon2id, httpOnly JWT cookies, rotating refresh, CSRF on mutations, an in-memory login rate limit (20 / 60 s per client), and lockout after 5 failures. `slowapi` is a dependency and is not the limiter. `mfa_secret` is stored and unused. Idle timeout is enforced in `app/deps.py`; no warning dialog was found in the web app.
- Field masking hides the threats register from fleet and crew officer only.
- Audit hash chain and verify exist. Not every spec event (every override, every register edit) was re-checked for coverage.
- E2E, axe, and Lighthouse budgets in Section 12 and Section 15 are not met. No `docs/screenshots` from `pnpm screenshots` were in the tree when these notes were written.
- Section 15 items (Windows fresh clone, network-off judge tour, every route’s empty/error states, timing budgets, why-not on every dropped mission) were not executed for this note.
