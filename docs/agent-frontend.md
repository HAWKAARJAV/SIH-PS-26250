# Frontend agent notes

P0 UI pass on `apps/web` only. No API or progress/decision doc edits.

## Done

- Shared `StatusBadge`, `EmptyState`, `ErrorState`, and `LoadingState` in `apps/web/src/components/states.tsx`. Used on command glance, retask, planner, COP health, ATO, and audit. Landing and judge mode use the same fetch states where they call the API.
- KPI tiles on the glance render only after `/api/v1/command/glance` returns. Empty and error copy does not invent fulfilment or coverage.
- Retask lists every COA the API returns. Preset `R` (id or name `R` / `Reserve Release`) is labelled reserve release. Impact missions link to `/app/missions/{id}` (the why-not page). No reserve-release card is invented when the solver omits `R`.
- Shell clock keeps the server DTG. The Zulu/IST control only rewrites that string as UTC+5:30 (`apps/web/src/lib/dtg.ts`). It does not POST the clock.
- Admin stays out of the rail unless `/api/v1/auth/me` role is `admin` or `commander`.

## Still short of a full staff workstation

- Fusion has live/degraded and a conflict list. It does not show per-feed age, latency, error rate, completeness, provenance chips, or a lineage drawer.
- ATO is a plan list plus one line table, digest prefix, and PDF. Missing ACO, dissemination acks as a matrix, CSV/JSON/signal export, and an explicit two-person integrity panel.
- Planner Gantt and assignment table are the working surface. No command palette, glossary, density/units/language settings, or keyboard map.
- Map is a sandstone sketch of bases, airspace, and threats. Not a full COP.
- Admin is scenario load only. No users, connectors, doctrine parameters, or feature flags.
- Registers (fleet, crew, stores, bases, missions) are tables. Mission detail is why-not plus risk, not a full mission folder.
- Forecasts exist on `/app/analytics` and were left as they were.
- No offline queue, notifications, or right-hand context drawer.
