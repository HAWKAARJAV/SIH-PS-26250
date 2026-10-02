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

## D-004 — COA proposal is attributed to the injector
Selecting a COA stores `submitted_by` as the user who injected the event, so the commander who selects it can still approve. There is one commander account.

## D-005 — Plan row is flushed before assignments
SQLite checks the assignment foreign key before SQLAlchemy inserts the parent plan. `_store_plan` flushes the plan first.

