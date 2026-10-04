# VYUHA — judge demo script

**Seed:** 26250 · **Pack:** S5 · **Scale:** M · **Theatre:** MERIDIAN (synthetic)

Say the banner out loud once: synthetic data, unclassified prototype, not for operational use.

Judge Mode (`/app/judge`) is a numbered list. **RESET DEMO** calls `POST /api/v1/scenarios/load` with pack S5, seed 26250, scale M. It does not animate the later steps. Arrow keys, presenter-note key, and `?scene=` are not implemented. Walk the links yourself.

Demo mode must be on so role cards work. Password if you type it: `Vyuha-demo-2026`.

| Step | Screen | Do this |
|------|--------|---------|
| 0 | `/login` | **Ops Planner** card. Land on `/app`. |
| 1 | `/app/judge` | **RESET DEMO**. Wait until the status line says scenario S5 loaded. |
| 2 | `/app/plan` | **Optimise**. Then **Validate**. Read the validator line. If it is not a pass, do not call the plan valid. |
| 3 | `/app/fusion` | Show feed rows. **Degrade** on MET, then **Restore**. |
| 4 | `/app/retask` | **Inject disruption**. Read the impact summary and the COA cards (presets include Minimal Change, Maximum Value, Lowest Risk, Robust). |
| 5 | `/app` | Command glance. Only claim a decision banner if the page is actually showing one after the inject. |
| 6 | `/app/missions/MSN-…` | Open a mission the plan did not serve, if the UI links one. The why-not text comes from `optimiser/explain.py`, not from an unsat core. |
| 7 | `/app/ato` | As planner, **Submit** on the DRAFT. Sign out. |
| 8 | `/login` | **Commander**. **Approve** on the PROPOSED plan. Sign out. |
| 9 | `/login` | **Auditor**. **Co-sign** on the APPROVED plan. Sign out. |
| 10 | `/login` | **Commander** again. **Publish**. Publish fails closed without the co-sign, without a matching digest, or if the validator fails. **PDF** downloads the ReportLab file. |
| 11 | `/app/audit` | As auditor, **Verify integrity**. Intact chain copy is `Chain intact.` plus the entry count. |
| 12 | `/` | Benchmark sentence. It must match `docs/benchmarks/latest.json`. Today that is scale S, seeds 1 and 2, simulated. |

## If the laptop misbehaves

- **Solver still running:** the plan route waits on the HTTP call. The API falls back to a greedy plan labelled as a heuristic when the solver does not return a proven solution. Still press **Validate**.
- **Refresh:** demo cards again. Scenario state is on the API, not in the browser.
- **API was restarted empty:** `pnpm seed`, then **RESET DEMO**.
- **Ports 3000 or 8000 already taken:** do not kill them. Use the server that is already up, or pick another time. Playwright is not required for this spoken demo.
- **No network:** the demo does not call a map tile host or a font CDN if the offline check is clean. Do not promise IndexedDB replay; that queue is not in the app.
