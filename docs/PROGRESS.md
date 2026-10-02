# VYUHA progress

## Done
- Spec saved to `docs/SPEC.md`.
- Seeded MERIDIAN day, seven roles, audit chain, CP-SAT planner, independent validator, COA generation, ATO submit/approve/publish.
- The clock advances while RUNNING. Latest COAs can be reloaded. A mission page states why it was dropped and shows a transparent risk score. Retask can inject an aircraft fault, Bravo weather, or a Bravo closure. Judge mode steps through those real screens.
- Scale S benchmark, seeds 1 and 2, is in `docs/benchmarks/latest.json`. Both plans were valid. The solver served more missions than the greedy baseline in both. Simulated. The landing page reads that file.
- Manual Gantt moves shift a bar by 15 minutes and save only when the validator agrees. ATO export includes a PDF. The fusion page lists seeded source conflicts. The map draws bases, and it requests airspace and threat rings with no external tiles. Fleet status can be edited with If-Match. A service worker caches same-origin GET pages.
- The serviceability card was trained on the seeded fleet. `docs/benchmarks/serviceability.json` records holdout AUC 0.778 and Brier 0.073 on 20 rows. The planner still uses the seeded chance of staying usable. A 20-draw Monte Carlo on the small theatre stayed valid in 20 of 20 runs and served 2 missions in each. Simulated.
- Web typecheck passes. API ruff is clean. Pytest covers health, RBAC, demo mode, audit tampering, all seven logins, and one assistant query (10 tests). Browser checks: fusion inbox, fleet status change and restore, forecast card, and Monte Carlo.

## Next
- Solver job streaming and cancel, Hindi, a timed Judge Mode tour, Playwright J1–J8, and a benchmark matrix beyond seeds 1–2 at scale S.
- Docker files exist under `infra/`. This machine has no Docker CLI, so the images have not been built.
- Section 15 is not green yet.

## Known issues
- TypeScript is 6.0.3 and ESLint is 9.39.5. See `docs/DECISIONS.md`.
- Option cards still do not animate. Crew and stores registers are still read-only.
