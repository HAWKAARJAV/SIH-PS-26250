# VYUHA progress

## Done
- Spec saved to `docs/SPEC.md`.
- API: synthetic MERIDIAN seed (S1, seed 26250, 64 aircraft, 140 crew), auth with demo roles, RBAC, audit chain, CP-SAT planner, independent validator, retask COAs, ATO submit/approve/publish.
- Web: Sandstone & Ink shell, login, dashboard, registers, planner, retask, ATO, COP Health, map, audit. `next build`, ESLint, and Vitest pass. API ruff and pytest pass (7 tests).
- Browser check: commander glance shows 59/64 mission-capable and 140/140 crew ready from the seed. Planner optimise saved PLN-001, validator said valid, zero violations, status OPTIMAL.

## Next
- Phase 0 leftovers: CI, Docker compose, `/dev/ui` gallery, offline-host check.
- Phase 1 leftovers: Alembic, mission import, login test for every role, audit tamper test.
- Phase 3 leftovers: Gantt drag, job streaming, why-not on the mission page.
- Then phases 4–6 as in the spec.

## Known issues
- Docker CLI is not installed here, so compose has not been run.
- The sim clock stores RUNNING but does not advance `sim_now` from wall time yet.
- TypeScript is 6.0.3 and ESLint is 9.39.5. See `docs/DECISIONS.md`.

