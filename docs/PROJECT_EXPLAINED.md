# VYUHA, in plain words

Smart India Hackathon 2026, problem SIH26250, Transportation and Logistics, Ministry of Defence.

## What it is

VYUHA is a planning board for a fictional flying day. It shows aircraft, crew, stores, bases, weather, airspace and missions together, builds a schedule, and offers options when something breaks. A person approves. Nothing flies itself.

## The problem today

Those facts sit in separate lists, so a change means rebuilding the plan by hand.

## Our solution

One web app for fictional theatre MERIDIAN. It builds a schedule, offers replacements when an aircraft drops out, and publishes only after a person approves.

## Who uses it

- **Commander** — selects an option, approves and publishes.
- **Ops Planner** — runs the schedule, marks a disruption, submits.
- **Fleet Officer** — reads aircraft and stores. Threats are hidden.
- **Crew Officer** — reads crew. Threats are hidden.
- **Situation Analyst** — reads weather, airspace and threats. No edit screen yet.
- **Auditor** — reads and verifies the log. Cannot change aircraft.
- **Admin** — can mark a data feed stale.

## How it works

1. **Fuse data.** Eight feeds are stored: maintenance, crew, stores, airspace, weather, threats, tasking, and execution feedback. An admin can mark one stale.
2. **Plan.** Optimise fills 24 hours. A separate checker re-reads the rules.
3. **Re-plan.** The planner marks one aircraft non-mission capable (NMC: it cannot fly). Up to four options come back.
4. **Human decides.** Each option is a course of action (COA: a suggested plan). The commander selects, the planner submits, the commander approves. You cannot approve your own submission.
5. **Publish.** The new plan becomes current. Export is JSON, CSV, or a short text note.

```mermaid
flowchart LR
  feeds[Eight feeds] --> picture[One picture]
  picture --> plan[Optimise]
  plan --> check[Independent check]
  check --> change[Aircraft drops out]
  change --> options[A few options]
  options --> human[A person decides]
  human --> publish[Publish the order]
```

## A short day

The planner builds the schedule, then marks one jet NMC. Cards show a reason and a change count. The commander may select and approve. A storm that closes Bravo exists only as data pack S2, not as a button.

## Main screens

| Screen | Why it matters |
| --- | --- |
| Home | Introduction. "Murphy strikes" only moves a sketch. |
| Sign in | Password, or seven role cards in demo mode. |
| Command glance | Seed counts for ready aircraft, crew, and any plan. |
| Planner and Retask | Optimise, or mark a tail NMC and read options. |
| Registers | Missions, fleet, crew, stores, bases. Read only. |
| ATO | The flying programme (air tasking order). Submit, approve, publish. |
| COP Health, map, audit | Feeds, fictional bases, and the log. |
| Judge mode | A checklist, not a timed tour. |

## Optimiser, predictions, fusion

**Optimiser.** Like seating a wedding with hard rules. OR-Tools matches aircraft, crew and time, and keeps spares. If the checker disagrees, a simpler plan is kept and labelled as such. One simulated run saved PLN-001 as OPTIMAL, with zero violations.

**Predictions.** Not built. The seed only stores a simple chance each aircraft stays usable, used as a cutoff.

**Fusion.** Like eight in-trays. A quiet maintenance feed makes healthy jets look only partly ready.

## Why you can trust it

The checker is not the solver. Submit, approve and publish are human steps. Each log line stores the hash of the line before it. Fonts and the map are bundled. A fully offline app is not built.

## Tech stack

| Piece | Used here |
| --- | --- |
| Web | Next.js 16, React, TypeScript 6, Tailwind |
| API | Python 3.12, FastAPI, SQLAlchemy, SQLite |
| Solver | OR-Tools CP-SAT and a separate checker |
| Sign-in | argon2id, session cookies, a CSRF token on changes |
| Map | MapLibre, plain background |

## How to run it

```
pnpm install
pnpm seed
pnpm dev
```

Open `http://localhost:3000` (API on port 8000). Seed is pack S1, seed 26250: 64 aircraft, 140 crew. Password for every demo user: `Vyuha-demo-2026`. Emails: commander, planner, fleet, crew, analyst, auditor and admin, each `@vyuha.local`.

**Three-minute path.** Sign in as the planner, optimise, then mark a tail NMC and read the cards. Sign in as the commander to select and approve, then as the auditor to verify. Cards stay on the page that created them.

## Not built yet

CI, Docker, migrations, mission import, a draggable Gantt, live solver progress, a "why not" panel, PDF, models, benchmarks, Hindi, offline mode, a moving clock, and a timed judge tour.

## Glossary

- **ATO** — the flying programme.
- **ACO** — the airspace blocks returned with that order.
- **DTG** — a short time, such as 050600Z OCT 26. Z means Zulu (UTC).
- **COA** — one suggested change to the plan.
- **NMC / PMC / FMC** — cannot fly / partly ready / fully ready.
- **Load-out class** — stock codes LC-A to LC-I, not a weapon.
- **Seed** — repeats the fictional day. Default 26250.
- **Validator** — re-checks the hard rules.
- **Degraded feed** — a stale source. The plan gets more cautious.
- **MERIDIAN** — the fictional four-base map. No real units.

All data is synthetic. SIH 2026 prototype. Not for operational use.
