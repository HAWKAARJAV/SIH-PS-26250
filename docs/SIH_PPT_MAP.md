# SIH slide map (SIH26250)

Copy for a six-slide idea deck. Official template wording was **not** re-opened on sih.gov.in for this file. Adjust titles if the portal template differs. Do not put a metric on a slide unless it is in `docs/benchmarks/latest.json` or on screen during the demo.

## 1 Title

**VYUHA — Dynamic Air Operations & Resource Optimisation**  
Smart India Hackathon 2026 · Transportation & Logistics · Software · SIH26250  
Organisation: Ministry of Defence · Defence Services Staff College

Tagline: The sky changes. Your plan keeps up.

Footer: SYNTHETIC DATA · UNCLASSIFIED PROTOTYPE · NOT FOR OPERATIONAL USE

Visual: landing page with the disclaimer visible.

## 2 Proposed solution

- One picture for aircraft, crew, stores, airspace, weather, threats, tasking, and execution feedback.
- A baseline plan from CP-SAT that a second checker must also accept.
- When a disruption is injected, ranked courses of action and a human decision.
- Publish only after approve, independent co-sign, digest match, and validator pass.

Visual: `/app/retask` after **Inject disruption**, or `/app/plan` after **Validate**.

## 3 Technical approach

- Browser: Next.js. API: FastAPI, SQLAlchemy, SQLite for the prototype.
- Optimiser: OR-Tools CP-SAT and a greedy fallback. Validator is a separate module.
- Diagram: the Mermaid figure in `docs/ARCHITECTURE.md`.

Say “prototype SQLite”, not “production Postgres”, unless the demo is actually pointed at Postgres.

## 4 Feasibility and viability

- Run path: `pnpm install`, `uv sync --directory services/api`, `pnpm seed`, `pnpm dev`.
- Tests: `pnpm test` (Vitest and pytest). Playwright judge spec exists and is brittle; see `docs/agent-quality.md`.
- Risks to say out loud: solver time on scale M, benchmark evidence only at scale S for two seeds, Alembic not yet the live migrator, no accreditation.

Visual: test command output or the judge **RESET DEMO** confirmation.

## 5 Impact and benefits

Quote only checked-in numbers:

- Simulated, scale S, seeds 1 and 2, pack S1.
- Solver fulfilment tied greedy (0.7418 and 0.7483) and served 6 missions versus 5, both validator-valid, label OPTIMAL, 15 missions in the small day.

Do not say “90% better” or a re-plan time you have not measured.

Qualitative benefit that the software does show: the unmoved part of the plan is the point of the stability weights on COA preset A, and publish is blocked without a second person.

Visual: COA card metrics, plus the benchmark sentence on `/`.

## 6 Research and references

Use `docs/REFERENCES.md`. Only rows marked verified. Leave unverified rows off the slide.

Problem statement paraphrase lives in `docs/SPEC.md` section 2 and the trailing portal paste. Re-check sih.gov.in before submission. That re-check is **not** done in this file.
