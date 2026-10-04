# VYUHA decisions

Deviations from `docs/SPEC.md`, with reasons. Newest last.

## D-000 — Spec stored as given
The master prompt, including the trailing SIH26250 listing, is `docs/SPEC.md`.

## D-001 — Ruff line length 160, B008 ignored
Catalogue literals and route signatures exceed 100 columns. FastAPI `Depends()` in defaults is the framework pattern, so B008 is ignored.

## D-002 — TypeScript 6.0.3 and ESLint 9.39.5
TypeScript 7.0.2 is the latest npm release, and typescript-eslint 8.71 throws on it. ESLint 10 breaks `eslint-plugin-react` 7.37, which `eslint-config-next` still uses. The app type-checks with TypeScript 6 and lints with ESLint 9.

## D-003 — style-src allows unsafe-inline
Scripts use a nonce. A style nonce would disable `unsafe-inline` in CSP3 and break component `style` attributes and MapLibre markers. Styles stay `'self' 'unsafe-inline'`.

## D-004 — COA proposal is attributed to the injector (superseded)
Selecting a COA used to store `submitted_by` as the event injector. Superseded by D-010: only explicit submit sets `submitted_by`.

## D-009 — mypy on `scenarios.generate`
The generator builds nested dict literals for the synthetic theatre. Strict typing every field is deferred; `scenarios.generate` uses a mypy `ignore_errors` override until R1 refactors world types.

## D-010 — Two-person publish with auditor co-sign
The commander approves (`approved_by`). The auditor co-signs (`co_approved_by`). Publish requires both and forbids co-sign from the submitter or approver. Seven demo roles are unchanged.

## D-005 — Plan row is flushed before assignments
SQLite checks the assignment foreign key before SQLAlchemy inserts the parent plan. `_store_plan` flushes the plan first.

## D-006 — Small theatres cap the reserve
Scale S keeps only the first aircraft in the fleet plan, so a reserve for a missing type made every plan invalid. Reserve for each type is now the minimum of the doctrine value and one less than the aircraft of that type.

## D-007 — Published benchmark is scale S, seeds 1 and 2
`docs/benchmarks/latest.json` is the output of `analytics.benchmark.run(range(1, 3))` after D-006. Both runs were valid. The solver served more missions than the greedy baseline in both. These are simulated. The 30-seed S/M/L/XL suite is not run yet.

## D-008 — MapLibre workers may load from blob URLs
The chart draws airspace and threat rings with MapLibre and no tiles. Its worker is a blob URL, so CSP adds `worker-src 'self' blob:`.

## D-011 — Event apply does not clear plans
`write_world()` no longer deletes `AssignmentRow` / plans. Only `reset_operational=True` (seed and scenario load) clears operational artefacts. Event injection persists theatre rows without wiping assignments.

## D-012 — CP-SAT models 15-minute launch and recovery bins
Launch and recovery capacity constraints use per-bin literals tied to the mission start variable, matching the independent validator. The previous single-bin stub (`rate × 96`) is removed.

