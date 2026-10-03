# VYUHA: FINISH-THE-JOB MASTER PROMPT (v2) | SIH 2026 | PS SIH26250

> This file must match the finish prompt pasted into the agent on 2026-10-03.
> If any section is missing below, treat the chat message that begins with this title as source of truth over this stub.

---

## 0. ROLE AND THE ONLY GOAL

Finish VYUHA completely for SIH 2026 PS SIH26250. Winning means: judge understands in 30s, 3-minute demo never breaks, real labelled numbers, provably valid plans, calm product UX. Build R0–R7 without asking between phases. Do not declare done until Section 12 is green in a **production** browser build.

## 1. HOW TO WORK

Read SPEC.md, PROGRESS.md, DECISIONS.md, PROJECT_EXPLAINED.md, and this file. Run baseline health check. Verify with `pnpm build && pnpm start` and Playwright. P0 before P1. Honest metrics only. Log deviations in DECISIONS.md. Windows/PowerShell compatible scripts.

## 2. GROUND TRUTH (audit)

Keep optimiser, validator, audit, auth, generator. Fix: CSP hydration (W1), four COAs (W2), benchmark (W3), UX gaps (W5–W26), mypy, e2e, SIH docs (W21).

## 3. PHASES R0–R7

R0: CSP, mypy, offline v2, start.mjs, two-person integrity, compose, reconcile docs.
R1: Alembic, mission CRUD/import, registers, RBAC matrix, sim clock.
R2: JobManager, WebSocket, solver streaming.
R3: Gantt workbench.
R4: Four COAs, retask UI, benchmark 30 seeds, analytics wired.
R5: Fusion visibility, map time slider, ATO governance.
R6: Product layer, Judge Mode, landing, PWA, Hindi last.
R7: Tests, CI, screenshots, SIH deliverables, fresh-clone rehearsal.

## 4–10. DATA, UI/UX, WEAK SPOTS, NARRATIVE, QUALITY, PERFORMANCE, RISKS

See the full v2 prompt in the agent session (sections 4–10 cover optimiser additions, Sandstone & Ink UI contract, honest limitations, narrative, commit bar, performance budgets, risk register).

## 11. CUT LINE

Never cut: R0 fixes, mission CRUD, solver panel, 4 COAs + matrix, benchmark, Judge Mode, why/why-not, ATO two-person + digest, audit, dashboard, landing, SIH docs, e2e J1–J3 and J7, axe, offline proof.

## 12. FINAL SELF-AUDIT

Production build, offline, mypy/ruff/tsc, validator parity, 12 event types, benchmark matrix, serviceability 5k rows, Monte Carlo 500, two-person, Judge Mode 3:00, J1–J8, axe, no unused deps, SIH docs complete.

## 13. NEVER

Synthetic only, no weapon effects, no external runtime, no hard-coded metrics, no done without evidence.

## 14. BEGIN NOW

Baseline → R0 → through R7 → summary with measured numbers and demo commands.

The engine is already good. Make the car around it worth driving.
