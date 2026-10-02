# MASTER BUILD PROMPT: VYUHA | Smart India Hackathon 2026 | PS SIH26250

## 0. ROLE
You are a principal full-stack engineer, optimisation specialist and product designer on a Smart India Hackathon 2026 team that intends to win. You ship production-grade software: clean architecture, tests, security, accessibility, and a UI people describe as calm, warm and expensive. You make decisions yourself, you do not ask permission between phases, and you never leave placeholders.

## 1. HOW TO WORK (READ FIRST)
1. FIRST ACTION: save this entire message verbatim to docs/SPEC.md. It is the single source of truth; re-read the relevant section before each phase. Create docs/PROGRESS.md (done / next / known issues) and update it at the end of every phase so work can resume in a fresh chat. Log every deviation from this spec in docs/DECISIONS.md with a reason.
2. Build in the 7 phases of Section 14. After each phase: install, build, lint, type-check, run tests, start the app, and verify that phase's exit criteria yourself. Fix everything before moving on. Report in at most 10 lines, then continue to the next phase without waiting. Stop only for a genuinely blocking error.
3. Priorities: P0 = must exist and work flawlessly in the demo; P1 = should ship; P2 = only if time remains. Finish all P0 before starting P1. Shipping P0 completely beats shipping P1 partially.
4. Versions: check current stable versions before installing (npm view, pip/uv) and use the latest stable majors. Use Next.js 16.x (current Active LTS), NOT 15 (end-of-life 21 Oct 2026). Never pin versions from memory.
5. Quality bar: no TODO/FIXME, no lorem ipsum, no dead buttons or links, no console errors, no hydration warnings. Every view has loading, empty and error states. Every number on screen comes from seeded data or real computation, never hard-coded. Strict TypeScript; ruff and mypy clean. Keep files focused (aim under 300 lines).
6. Data policy: ALL data is synthetic and fictional: no real units, bases, aircraft models, weapons, call-signs or real-installation coordinates. Show a persistent banner: "SYNTHETIC DATA | UNCLASSIFIED PROTOTYPE | NOT FOR OPERATIONAL USE".
7. Scope guardrail: this is a planning and logistics decision-support tool with a human on the loop. Do not implement weapon effects, targeting solutions, kill-chain automation or autonomous tasking. "Load-out" means an abstract inventory and compatibility class (LC-A to LC-I) used only as a stock and compatibility constraint.
8. Air-gap ready: zero runtime requests to external hosts (no CDN, Google Fonts, analytics, map tiles or third-party APIs). Fonts are self-hosted npm packages. Enforce with CSP default-src 'self' and a CI check.
9. Cross-platform: the team uses Windows. Canonical commands are root package.json scripts (pnpm dev, test, seed, demo, benchmark, screenshots) that work in PowerShell and WSL. A Makefile is optional.
10. Tie-breakers when in doubt: correctness of plans > demo reliability > a judge understanding it in 30 seconds > visual polish > extra features.
11. Git: conventional commits, one per feature slice; tag each finished phase (phase-0 to phase-6).

## 2. THE PROBLEM (verified 3 Oct 2026 via a public mirror of the sih.gov.in listing captured 2 Oct 2026; re-check wording on the official portal)
- Code SIH26250 | Software edition | Theme: Transportation & Logistics
- Title: Air Power - Dynamic Air Operations & Resource Optimisation
- Owner: Ministry of Defence (MoD), Defence Services Staff College
- Problem (paraphrased): Planning, and dynamically re-tasking, air operations in a contested and fast-changing environment is complex. Information on aircraft availability, crew status, weapon loads, airspace, weather, threats and mission priorities is generated in several systems and is not always available through one common real-time decision-support framework. Result: longer planning timelines and sub-optimal allocation of scarce airpower resources.
- Technology opportunity (paraphrased): AI-enabled decision support, multi-source data fusion, predictive analytics, optimisation algorithms.
- We must therefore show: (a) one fused picture across the seven named data domains, (b) fast baseline planning, (c) fast dynamic re-tasking, (d) better use of scarce assets, all with measurable proof.
- The owner is a military staff college, so speak its language: ATO (Air Tasking Order), ACO (Airspace Control Order), DTG, Zulu time, COA (course of action), AAR (air-to-air refuelling), FMC/PMC/NMC (full/partial/non-mission capable).

## 3. PRODUCT
Name: VYUHA (change only in config/brand.ts). Tagline: "The sky changes. Your plan keeps up."
What it is: a web-based common operating picture (COP) + optimiser + dynamic re-tasking console. It fuses the seven data domains, generates an optimised ATO/ACO pair, and when reality changes (weather, aircraft fault, crew, threat, airspace, pop-up task) produces ranked, explainable COAs in seconds. A human approves; the system publishes and tracks acknowledgement.

Design principles:
1. Centralised planning, decentralised execution: pre-authorised change envelopes let units adapt within bounds.
2. Human on the loop: AI proposes, people decide, every decision is attributable.
3. Explainable by default: every assignment answers "why this", every dropped mission answers "why not".
4. Conservative under uncertainty: stale or conflicting data lowers confidence and tightens constraints, visibly.
5. Degrades gracefully: a manual mode works if solver, ML, LLM or network is down.
6. Sovereign and offline-first.
7. Calm UI for stressful moments: glanceable, plain-language alerts.

Differentiators to build with extra care (these win):
D1 Minimal-disruption re-planning (stability-aware, proximity-weighted).
D2 Explainable infeasibility: "why not mission X" from solver unsat cores, in plain English.
D3 Reliability-aware assignment: predicted serviceability feeds the optimiser (hot spares for top-priority missions).
D4 Staff-college COA comparison: decision matrix with live weights and a decision-deadline countdown.
D5 Conservative-by-default fusion with provenance, freshness decay and a conflict inbox.
D6 Air-gapped, offline-capable, CSP-enforced.
D7 Murphy Mode (seeded random disruptions) and Judge Mode (scripted 3-minute tour).
D8 Honest, reproducible benchmarks vs baselines with scalability curves (seeds shown).
D9 Operational authenticity: Zulu/IST toggle, DTG format, NM/kt/ft units, doctrinal ATO cycle clock.
D10 Independent plan validator that re-checks every plan (solver or manual), so we never trust the optimiser's own feasibility claim.

## 4. ROLES (RBAC: enforce server-side, mirror in UI and navigation)
- Commander: view all; set guidance (priorities, weights, reserve level); select COA; approve and publish; manage delegation envelopes.
- Ops Planner: CRUD missions; run optimiser; edit drafts; generate COAs; submit for approval.
- Fleet Officer: update aircraft status, defects and load-out stores; view forecasts; read-only plans.
- Crew Officer: update crew availability, qualifications and duty records; view fatigue.
- Situation Analyst: update threat zones, airspace blocks/ACMs and weather inputs; view route risk.
- Auditor: read-only everywhere, plus audit verify and exports.
- Admin: users, connectors, parameters, scenarios, feature flags; no operational approvals.
Field-level masking by role (e.g. Fleet Officer cannot see threat detail).

## 5. MODULES, SCREENS AND BEHAVIOUR (route in brackets)

F1 [P0] Product site [/]. Premium single-page story plus /docs (architecture, glossary, API link). Sections: nav; hero with an interactive mini-Gantt that re-plans when the visitor clicks "Murphy strikes" (self-contained, no backend); seven-domains-to-one-picture animation; How it works (Fuse, Plan, Retask, Decide); feature grid; measured-impact strip (build-time snapshot of the latest benchmark JSON, labelled simulated + seed; never type a percentage by hand); trust section (human on the loop, explainable, auditable, offline, secure); ATO-cycle compression visual; architecture diagram (accessible inline SVG); roadmap; FAQ; footer with disclaimer. CTAs: "Launch live demo", "Take the 3-minute tour". Team section renders only if config/team.ts is filled. Metadata, OG image (inline SVG), sitemap, robots, favicon.

F2 [P0] Auth and RBAC [/login]. Email + password (argon2id); short-lived JWT access + rotating refresh in httpOnly Secure SameSite cookies; CSRF token on mutations; login rate-limit and lockout; idle timeout with a warning dialog; optional TOTP MFA (P1). DEMO_MODE=true shows "Enter as <Role>" cards for seven seeded users; DEMO_MODE=false hides them.

F3 [P0] Scenario engine and sim clock [top bar + /app/simulate]. Server-authoritative clock (PAUSED/RUNNING, 1x/10x/60x, jump to DTG). Five scenario packs (Section 8) with load/reset/clone; deterministic RNG with the seed visible. Murphy Mode: seeded random disruptions at Low/Medium/High intensity, with a witty "Murphy is feeling: Mischievous" meter. Replay (P2): scrub the event-sourced history.

F4 [P0] Data fusion and COP Health [/app/fusion]. Eight simulated feeds cover the seven named data domains plus execution feedback (Section 7.4). Page shows per-source status LEDs, last-message age, latency, error rate, completeness; a Conflict Inbox (values per source with timestamps and confidence, policy applied, override with reason + expiry, audited); a lineage drawer (source to reconciled value). Wherever a fused value appears, show a ProvenanceChip and FreshnessBadge. A "Degrade this feed" switch (Admin and Judge Mode) proves stale-data behaviour.

F5 [P0] Missions [/app/missions, /app/missions/[id]]. CRUD; bulk CSV/JSON import with a validation report; templates by mission type; priority P1 to P5 with value; time window and duration; package slots (aircraft type, quantity, crew qualifications, load-out class); airspace block; weather minima; AAR need; dependencies (before, after, sync within N minutes); lifecycle REQUESTED, PLANNED, TASKED, LAUNCHED, AIRBORNE, COMPLETE, plus CANCELLED, RETASKED, ABORTED. Detail page: package, crew, load-out, abstract route, weather, threat, risk breakdown, timeline, "Why this?" panel, change history.

F6 [P0] Resource registers [/app/fleet, /app/crew, /app/stores, /app/bases]. Fleet: status FMC/PMC/NMC, defects, hours to inspection, turnaround timers, serviceability forecast. Crew: availability, qualification matrix, rolling flight/duty hours, rest clocks, fatigue heat strip. Stores: load-out class stock per base with reserve thresholds and consumption curves. Bases: runways, launch/recovery rate per 15 min, parking, fuel. Tankers (AAR): tracks, offload capacity, availability windows. All tables: virtualised, sortable, filterable, saved views, column chooser, CSV export, inline edit with role checks.

F7 [P0] Optimiser [button in Planner]. Baseline ATO/ACO generation (Section 7.1). Live solver panel: incumbent objective, bound, gap, elapsed, solutions found; cancel; "keep best so far". Objective-weights popover with presets (Balanced, Max Value, Min Risk, Preserve Reserve, Stability) and live preview deltas. Reproducible by seed.

F8 [P0] Planner Workbench [/app/plan]. Toolbar: plan selector (versions), horizon (12/24/48/72 h), Optimise, Validate, Compare, Submit. Views: by Aircraft, by Crew, by Mission, by Base (runway). Gantt on a 5-minute grid: zoom/pan, ghost bars for baseline, hatched violations, tooltips, click opens the right drawer. Drag/resize/reassign with instant validation (fast client checks, authoritative server validate); an invalid drop snaps back with a plain-language reason (e.g. "Crew C-027 would exceed the duty limit at 0410Z"). Left rail: Unscheduled queue with "Smart Insert" (best slot for one mission without disturbing others). Bottom: constraint monitor (hard/soft violations), runway occupancy, tanker usage, stock curves, crew duty histogram, KPI deltas vs baseline. Table view alternative for accessibility. Manual mode (solver off) must still work.

F9 [P0] Dynamic Retasking Console [/app/retask]. Left: event feed plus "Inject event" (types in Section 8). Centre: Impact Analysis (blast-radius graph: event, affected missions, dependent resources; T-minus to first affected launch; decision-deadline countdown). Right/bottom: 3 to 4 COA cards (A Minimal Change, B Maximum Value, C Lowest Risk / Preserve Reserve, D Robust) showing value kept, changes count, risk delta, reserve delta, fatigue delta, tanker delta, mini before/after diff and a "Recommended" badge with a reason. A decision matrix with live weight sliders re-ranks client-side (radar + table). Actions: Preview on Gantt (overlay), Select and request approval, Reject with reason. On selection a new plan version is created, validated and routed to approval; bars glide to new slots with ghost trails.

F10 [P0] Explainability [drawer everywhere]. "Why this?": constraints satisfied with slack, top 3 alternative aircraft/crews with score deltas and rejection reasons, sensitivity ("what would change this"), data provenance, risk breakdown (waterfall). "Why not?": for any unserved mission, a plain-English minimal reason from the unsat core plus a relaxation menu showing the effect of each option.

F11 [P0 serviceability + weather window; P1 the rest] Predictive analytics [/app/analytics]. Section 7.5. Every prediction shows probability, interval, key drivers, model version and a link to its model card.

F12 [P1] What-if, Monte Carlo, benchmark [/app/simulate]. Clone a plan into a sandbox, apply hypothetical events, compare. Monte Carlo robustness (default 500 runs): fan chart of value delivered, probability of meeting P1 coverage, tornado chart of sensitivity. Benchmark page: optimiser vs baselines, scalability curve, seeds, "Re-run" button.

F13 [P0] ATO/ACO Publisher [/app/ato]. Plan lifecycle DRAFT, PROPOSED, APPROVED, PUBLISHED, SUPERSEDED. Formal ATO view (ATO number, effective period in Zulu, mission lines: mission no., call-sign, type, package, tails, crew, load-out class, launch/recovery base + times, airspace refs, AAR details, notes) and ACO view (blocks, floors/ceilings, active windows, ACMs). Version diff ("what changed since ATO n-1"). Two-person integrity when a change touches P1 missions or at least N missions (configurable). Dissemination matrix (units x acknowledgement state; simulated acks with timers, retry and escalation). Exports: PDF (ReportLab, embedded fonts), CSV, JSON, and a "Signal" plain-text version under 4 KB. Show the SHA-256 digest of each published version.

F14 [P0] Command Dashboard [/app]. Role-adaptive. Top: five KPI tiles (value-weighted mission fulfilment, aircraft mission-capable, crew ready, reserve integrity, data freshness) with sparklines, deltas and methodology tooltips. Middle: next-12-hours compact Gantt and a Decision Queue (event, T-minus, recommended action, deep link to the console). Lower: compact map, alert feed, ATO cycle clock (Guidance, Task Development, Plan Build, ATO Production, Dissemination, Execution and Re-tasking, Assessment) showing time to the next ATO cut-off. Notification centre in the top bar. Alert levels ADVISORY, CAUTION, WARNING, CRITICAL with grouping, dedupe, ack, snooze and rate limits against alert fatigue.

F15 [P0] Map / COP [/app/map]. MapLibre GL with the bundled fictional theatre (GeoJSON on a plain warm background with graticule). Layers: bases, airspace blocks, threat zones (rings with confidence), weather cells, mission routes, tanker tracks, simulated aircraft positions. Time slider synced to the sim clock; hover cards; click opens the drawer; NM measure tool; route-risk heat. Render labels as HTML markers (avoid glyph servers). Table view for accessibility. 

F16 [P0 audit; P1 envelopes] Governance [/app/audit]. Append-only audit log with a hash chain (prev_hash + SHA-256 of the entry), filters, export, "Verify integrity". Every state change, override, approval, publish and login is recorded with actor, reason and diff. Delegation envelopes (P1): rule-based pre-authorisations (e.g. "duty officer may swap tails of the same type and load-out class if reliability >= X and no new violations"), auto-validated and logged.

F17 [P1] Staff Assistant [panel + command palette]. Deterministic intent parser (about 25 intents, fuzzy entity matching) answering from read-only query endpoints: status, "what if TAIL-114 goes NMC at 1400Z", "which missions are exposed to weather after 1600Z", "explain MSN-023", "who is near duty limit". Proposals (e.g. inject a what-if event) require a click. Always cite entity IDs and data freshness. Optional LLM adapter (OpenAI-compatible endpoint, including local Ollama) behind LLM_PROVIDER; it may only call the same read-only tools, and outputs referencing unknown IDs are rejected. Default = no LLM, so the demo works offline.

F18 [P1] Offline and low bandwidth. PWA shell (Serwist or hand-rolled service worker), cached reads with a visible "cached 4 min ago", queued mutations in IndexedDB with conflict handling, low-bandwidth mode (tables only, no map or animation), Signal export.

F19 [P0] Judge Mode [/app/judge]. Section 8.

F20 [P1] Shift Handover Brief [/app/handover]. Auto-generated one-pager (plan state, open decisions, risks, resource status, changes in the last 6 h) as page and PDF.

F21 [P1] Admin and Settings [/app/admin, /app/settings]. Admin: users and roles; connectors (enable, degrade); doctrine parameters (duty limits, minimum turnaround, freeze window, reserve thresholds, weight presets), clearly labelled configurable assumptions, not doctrine; scenarios; feature flags; export/import JSON bundle. Settings: Zulu/IST, units, density (Comfortable/Compact), language, high-contrast variant, notification preferences, active sessions.

F22 [P1] i18n. English and Hindi for landing and app (next-intl; Noto Sans Devanagari). Operational codes stay in English.

F23 [P0] Onboarding and help. First-run tour; glossary popovers (ATO, ACO, DTG, Zulu, COA, AAR, NMC/PMC/FMC, ROZ, ACM, COP, AEW&C, ISR); shortcuts modal (?); command palette (Ctrl/Cmd+K) with entity search (missions, tails, crew, bases, events). Shortcuts: g then d/p/r/f/m jump to Dashboard/Planner/Retask/Fleet/Map; / search; n new mission; o optimise; v validate; [ and ] zoom Gantt; Space play/pause clock.

## 6. DATA MODEL (SQLAlchemy 2 + Alembic; Pydantic v2; OpenAPI is the contract)
Conventions: store all times as UTC ISO-8601; UI toggles Zulu/IST (IST = UTC+5:30); DTG format DDHHMMZ MON YY (e.g. 051430Z OCT 26); 5-minute planning grid; units NM, kt, ft/FL (toggle to metric); human-readable IDs (MSN-023, TAIL-114, CREW-027, BASE-ALFA); optimistic concurrency via a version column + ETag (a 409 opens a review-and-merge dialog).
Entities (key fields):
- Base(id, name, lat, lon, runways[], launch_rate_15m, recovery_rate_15m, parking, fuel_state, status)
- AircraftType(id, class, role_tags[], range_nm, endurance_min, crew_req[], load_out_compat[], aar_capable, min_turnaround_min)
- Aircraft(tail, type_id, base_id, status FMC|PMC|NMC, defects[], hours_to_inspection, sorties_72h, last_landed_at, p_mc{1h,3h,6h,12h,24h}, ready_at, provenance)
- Crew(id, role, quals[], hours_24h, hours_7d, duty_start, last_rest_end, status, fatigue_index, provenance)
- LoadOutClass(code LC-A..LC-I, description_abstract, compat_types[]); Stock(base_id, code, qty, reserve_min)
- Tanker(id, base_id, offload_capacity, tracks[], availability_windows[])
- AirspaceBlock(id, polygon, floor_ft, ceiling_ft, active_windows[], exclusive, owner civil|military, rules)
- WeatherForecast(base_or_cell, valid_from, valid_to, ceiling_ft, vis_m, wind_kt, xwind_kt, convective_idx, confidence, ensemble[])
- ThreatZone(id, kind_abstract, centre, radius_nm, existence_p, last_seen, ttl, growth_nm_per_h, provenance)
- Mission(id, type, priority 1-5, value, window_start, window_end, duration_min, slots[], airspace_ids[], wx_minima, needs_aar, dependencies[], status, source)
- Plan(id, version, parent_id, status, objective_weights, horizon, seed, solver_stats, kpis, created_by); Assignment(plan_id, mission_id, slot, tail, crew_ids[], load_out, start, end, base_launch, base_recover, tanker_id, frozen)
- Event(id, type, severity, effective_at, payload, source, confidence, status); COA(id, event_id, preset, plan_id, metrics, diff, rank, rationale); Decision(id, actor, kind, reason, refs, at)
- SourceSystem(id, name, cadence, reliability_prior, tau_min, status); ProvenanceRecord(entity_ref, field, source_id, observed_at, confidence, method)
- Job(id, kind, status, progress, params, result_ref); Notification(id, level, user_id, ref, state); DisseminationAck(ato_version_id, unit, state, at)
- User(id, email, role, mfa); AuditEntry(id, seq, at, actor, action, ref, diff, reason, prev_hash, hash)

## 7. OPTIMISATION, FUSION AND ANALYTICS

7.1 Baseline planning (Google OR-Tools CP-SAT, Python)
Horizon default 24 h on a 5-minute grid. Variables: optional interval per (mission slot, aircraft) with duration = prep + sortie + recovery/turnaround; crew assignment literals; load-out class choice; served_m booleans; start-time integers; optional AAR intervals linked to receivers.
Hard constraints:
1. Aircraft: serviceable (status and forecast above threshold); role and load-out compatible; NoOverlap including turnaround; max sorties per day; maintenance blocks as fixed intervals; range/endurance (AAR if needed).
2. Crew: qualification and currency match; NoOverlap; rolling flight-hour and duty-period limits and minimum rest (configurable parameters); one aircraft per crew per sortie.
3. Stores: cumulative consumption per base and time must not exceed stock minus reserve; compatibility.
4. Bases: launch/recovery rate per 15-minute window (cumulative); runway closures; parking.
5. Airspace: exclusive blocks never double-booked; ACM active windows; civil-corridor restrictions.
6. Weather: minima met at launch, area, recovery and alternate with P(go) at or above the configured minimum (default 0.8); otherwise the slot is infeasible.
7. Threat: routes avoid no-go zones; remaining exposure is penalised.
8. Package sync and dependencies within allowed minutes; tanker rendezvous windows.
9. Reserve: minimum aircraft per type and readiness state held at every time step.
10. Freeze: airborne and inside-freeze-window (default 60 min) assignments are immutable unless the Commander overrides.
Objective (weighted, integer-scaled): maximise tier-weighted value served (P1 weight >> P2 >> ...) minus risk exposure, tanker overuse, crew-load imbalance (sum of squares), fleet-wear imbalance, change from baseline (stability), reserve shortfall and lateness vs preferred start. Tier weights are large enough that no lower-tier gain trades against a higher tier unless the Commander changes guidance.
Search: all CPU workers, fixed random seed, time limit (baseline 10 s, re-plan 5 s), solution hints from the previous plan or the greedy plan, incumbents streamed to the UI, objective bound and gap reported. Provide a deterministic single-thread mode for tests.

7.2 Independent validator
A separate pure-Python module re-checks every hard constraint on ANY plan (solver output, manual edit, import). The UI never shows "valid" unless the validator agrees. Property-based tests assert every solver output passes it.

7.3 Dynamic re-tasking
1. Event arrives; COP updates.
2. Impact analysis: directly invalidated assignments, then dependency closure (package-mates, tanker links, airspace/time conflicts, resource contention). Decision deadline = earliest affected launch minus prep minus safety margin.
3. Neighbourhood = affected set plus contention neighbours (adaptive size); everything else frozen.
4. Solve with a warm start from the current plan and a stability penalty that grows as launch time approaches.
5. Run four presets in parallel processes: A Minimal Change, B Maximum Value, C Lowest Risk and Preserve Reserve, D Robust (time buffers, hot spare for P1). Dedupe near-identical results.
6. For each COA: independent validation, metrics, diff vs the current plan, explanation.
7. Rank with the weighted decision matrix (default weights from Commander guidance); mark Recommended with a one-line reason; the human decides.
Targets: p50 <= 3 s, p95 <= 8 s on the default scenario. Tests assert the invariants: A has the fewest changes, B the highest value, C the lowest risk (within tolerance), and all COAs are valid.
If infeasible: extract an unsat core via CP-SAT assumptions, map it to plain English, and return a relaxation menu (drop or delay the lowest-value missions, widen a window by 30 min, accept PMC aircraft, borrow a tanker slot) with the effect of each.
If the solver times out: return the best incumbent with its gap, else the greedy plan, labelled "heuristic, not proven optimal".

7.4 Fusion pipeline
Eight simulated feeds: Maintenance and Serviceability (MSS), Crew Roster and Flight Records (CRFR), Armament and Stores Ledger (ASL), Airspace Management Feed (AMF), Meteorological Feed (MET), Threat and Intelligence Picture (TIP), Tasking and Priorities (TAP), Execution Feedback (EXF). Each has its own cadence, schema, reliability prior and deliberate imperfections (late, missing, duplicated, conflicting records).
Steps: ingest; schema-validate (reject with reason); normalise (units, UTC, IDs, alias table tail-to-maintenance-ID); reconcile per field; score confidence = reliability x freshness decay exp(-age/tau) x corroboration; publish to the COP store and emit events.
Policies: aircraft status: MSS is authoritative, operational override allowed with reason and expiry. Crew hours: take the most conservative (highest) value. Weather: ensemble blend weighted by recency. Threats: Bayesian log-odds update of existence probability, exponential decay when unseen, radius grows at growth_nm_per_h since last seen.
States: FRESH (< 1 tau), AGING (1 to 2 tau), STALE (> 2 tau). The optimiser reacts visibly: stale weather means stricter minima; stale aircraft status is treated as PMC until reconfirmed; stale threat is kept and widened.

7.5 Predictive analytics (train on a known synthetic generative process so ground truth is verifiable)
- Serviceability: Weibull survival + LightGBM on hours since inspection, open defects and severity, subsystem MTBF, sorties in 72 h, ground time, spares index. Output P(mission-capable) at +1/3/6/12/24 h and expected turnaround. Feeds the optimiser (reliability-adjusted availability, hot spares). Provide an adapter interface so an external predictive-maintenance service can replace the built-in model.
- Weather window: P(go) per mission and time from a 30-member synthetic ensemble; best launch windows.
- Mission risk (P1): transparent score 0 to 100 from route threat exposure, weather risk, aircraft reliability, crew fatigue and support dependency, plus a calibrated abort probability.
- Fatigue (P1): transparent duty/rest heuristic index 0 to 1, labelled heuristic, no medical claims.
- Pop-up task rate (P2): Poisson rate by type and time of day to recommend reserve size.
For each model show AUC/Brier/calibration or MAE, SHAP feature importance, model version, training seed, and a model card (docs/MODEL_CARDS.md).

7.6 Benchmarks and KPIs
Baselines: B1 priority-first greedy dispatcher (no lookahead); B2 full re-solve ignoring stability. Size classes: S 20 aircraft/15 missions, M 64/45 (default), L 150/110, XL 300/220; 30 seeded scenarios each; report median and IQR.
KPIs (define exactly in docs): value-weighted fulfilment; P1 fulfilment; hard violations (must be 0); time-to-plan; time-to-replan; decision latency (event to commander decision); assignments changed per re-plan; reserve integrity; tanker overuse; crew-load Gini; Monte Carlo P(meet P1 coverage).
Acceptance: the optimiser beats B1 on value-weighted fulfilment in at least 90% of seeded scenarios and never produces hard violations; if not, tune the model and report honestly. `pnpm benchmark` regenerates JSON + charts; the app and landing page read these. Label everything "simulated". Never invent numbers.

## 8. SCENARIOS, EVENTS, MURPHY MODE, JUDGE MODE
Fictional theatre "MERIDIAN"; bases ALFA, BRAVO, CHARLIE, DELTA. Abstract aircraft types: MRF (multirole fighter), INT (interdictor), AWC (AEW&C), TKR (tanker), TPT (transport), ISR (recce), ROT (rotary), UAV. Default scale: 64 aircraft, 140 crew, load-out classes LC-A to LC-I, 45 missions per 24 h across nine categories (Air Defence Patrol, Escort/Sweep, Interdiction, Close Air Support, ISR/Recce, AEW&C Orbit, Air-to-Air Refuelling, Airlift, Search and Rescue), 14 airspace blocks (including exclusive blocks and civil corridors), 6 abstract threat zones, and a weather front crossing BRAVO around 1400Z to 1800Z. Deterministic generator from a seed.
Packs: S1 Baseline Day; S2 Monsoon Closure (BRAVO closes 1400Z to 1800Z); S3 Pop-up Priority (urgent SAR plus airlift at T-90 min); S4 AOG Cascade (three aircraft NMC plus crew illness); S5 Contested Corridor (new threat blocks a corridor, tanker track shifts).
Event types: AIRCRAFT_NMC, AIRCRAFT_RTS, CREW_UNAVAILABLE, WEATHER_UPDATE, THREAT_UPDATE, AIRSPACE_CHANGE, NEW_TASK, TASK_CHANGED, BASE_STATUS, TANKER_UNAVAILABLE, SORTIE_FEEDBACK, GUIDANCE_CHANGE. Each carries severity, effective time, source, confidence.
Judge Mode (about 3:00): caption overlay, arrow keys step, N shows presenter notes, R resets to the exact seeded state in under 2 s, deep link ?scene=3. Scenes:
1. 0:00 "Seven domains, no common picture": COP Health converges.
2. 0:20 "Baseline ATO in seconds": Optimise with streamed progress, Gantt fills, KPIs update.
3. 0:55 "Murphy strikes": inject weather closure + AOG; deadline countdown; COAs in under 5 s; compare with the decision matrix; select; diff animation.
4. 1:40 "Why?": explanation drawer; "why not mission X" in one sentence.
5. 2:10 "Trust": two-person approval, publish ATO v2, acknowledgements, audit verify.
6. 2:40 "Proof": benchmark vs greedy, scalability curve, then toggle offline and show it still works.

## 9. DESIGN SYSTEM: "SANDSTONE & INK" (LIGHT MODE ONLY, WARM, PREMIUM, SMOOTH)
Feel: a well-made paper atlas crossed with a modern flight-ops board. Calm, confident, precise. No dark mode (set color-scheme: light); offer an optional high-contrast light variant in Settings.
Tokens (CSS variables; Tailwind v4 @theme):
- canvas #FAF6EF; surface #FFFDF9; surface-2 #F4EEE3; line #E6DDCE; line-strong #D5C9B6
- ink #2A2118; ink-2 #51463A; ink-3 #6F6352
- ember (primary) #B9461B, hover #9C3913, tint #F8E4D8
- vyom (info/secondary) #365C87, tint #E3ECF5
- moss (ok) #3E7A4B, tint #E3F0E4
- amber (caution) fill #D9921A, text #7A4A00, tint #FBEFD5
- brick (critical) #A92D1B, tint #F7DEDA
- chart categorical: ember, vyom, moss, amber, plum #7A4B72, teal #2E6F73, clay #A8745A (add patterns/hatching so colour is never the only cue)
- Elevation: shadow-1 0 1px 0 rgba(42,33,24,.04), 0 1px 2px rgba(42,33,24,.06); shadow-2 0 2px 4px rgba(42,33,24,.05), 0 12px 28px -8px rgba(42,33,24,.12). Radius: 8 inputs, 12 cards, 16 panels/dialogs, 999 pills. 4-pt spacing grid.
- Type: display Fraunces (variable; headings and hero only); UI Geist Sans 14/20 (16/24 body, 13/18 small); data Geist Mono 12.5/18 for IDs and DTGs; tabular lining numerals wherever numbers are compared; Noto Sans Devanagari for Hindi. All self-hosted via @fontsource(-variable) packages (or the geist package).
- Layout: left rail 248 px (72 px collapsed) grouped Command, Plan, Resources, Intelligence, Governance; top bar 56 px with scenario chip, sim clock (LIVE/SIM/REPLAY state), Zulu/IST toggle, search/Ctrl+K, notifications, user menu; content max 1480 px; right context drawer 420 px. "The Horizon Line": a 2 px ember-to-sand line under the top bar that doubles as global loading and solver-progress indicator.
- Signature details: status pills always pair colour with an icon and a label; FreshnessBadge ("updated 3 min ago") that warms from moss to amber to brick as data ages; ConfidenceMeter; ProvenanceChip; DiffViewer; sticky ApprovalBar; KPI tile with sparkline, delta and methodology tooltip; optional 2% paper-grain overlay (inline SVG data URI, pointer-events none).
- Motion (the Motion library, formerly Framer Motion): 120/200/320 ms, ease cubic-bezier(.2,.8,.2,1), spring stiffness 380 damping 32 for drags and drawers. Page transitions fade + 8 px rise; list-reorder animation; number count-up on KPI change; skeleton shimmer in sand tones; plan-diff glide with ghost trails; success check morph. Respect prefers-reduced-motion. Nothing over 320 ms on frequent interactions.
- Interaction polish: optimistic updates with undo toasts (Sonner), hover cards for entities, copy-to-clipboard on IDs, visible 2 px ember focus rings with offset, 44 px minimum touch targets, drag cursors and snap feedback, inline validation, command palette (cmdk), zero layout shift.
- Microcopy: precise and calm; a dry touch of wit ONLY in empty states, loading messages and the landing page; never in WARNING/CRITICAL flows. Examples: empty queue "All quiet on the unscheduled front."; loading "Untangling the schedule..." / "Counting every minute of crew rest..." / "Asking the weather nicely..."; success "Plan v3 is valid. Zero violations."; error "That didn't land. Nothing was changed. Try again."; 404 "This airspace isn't on the chart."
- States: every view ships skeleton, empty (inline SVG line illustration in the palette plus one clear next action), error (cause, what is safe, retry) and partial-data states.
- Responsive: desktop-first at 1440; tablet landscape for the ops floor; phone = read-only Glance + approvals. Test at 360, 768, 1024, 1440, 1920.
- Accessibility: WCAG 2.2 AA (verify contrast of every token pair); full keyboard operation including the Gantt (arrow keys move focus between bars, Enter opens, M enters move mode); ARIA live regions for alerts; focus trapping in drawers and dialogs; screen-reader table alternatives for chart, Gantt and map; colour-blind-safe encodings.
- Print: ATO and Handover Brief print cleanly in black and white with DTG headers and page numbers.
- Components (shadcn/ui on Radix, restyled to these tokens; build a living /dev/ui gallery): Button, IconButton, Input, Select, Combobox, DTG date-time picker, Switch, Slider, Tabs, Segmented, Badge, StatusPill, Tooltip, HoverCard, Popover, Dialog, Drawer, Toast, DataTable (TanStack Table + Virtual), Card, KpiTile, Gantt, MapPanel, chart wrappers, Skeleton, EmptyState, ErrorBoundary, CommandPalette, Stepper, Callout, Kbd.

## 10. ARCHITECTURE, STACK, API
Monorepo (pnpm workspaces):
  apps/web             Next.js 16 (App Router), React, TypeScript strict
  services/api         FastAPI (Python 3.12), SQLAlchemy 2, Alembic, Pydantic v2; modules: app/ (routers, services), optimiser/, fusion/, analytics/, scenarios/
  packages/contracts   OpenAPI to TypeScript types (openapi-typescript + openapi-fetch)
  infra/               docker-compose.yml, Caddyfile, Dockerfiles (multi-stage, non-root)
  docs/  scenarios/  scripts/  .github/workflows/
Web: Tailwind CSS v4, shadcn/ui + Radix, Motion, TanStack Query + Table + Virtual, Zustand, React Hook Form + Zod, next-intl, Sonner, cmdk, date-fns + date-fns-tz, MapLibre GL, D3 (scales/shapes) + Recharts, Serwist (PWA), idb, Lucide icons, ESLint (flat config) + Prettier or Biome.
API: FastAPI, OR-Tools, NumPy, scikit-learn, LightGBM, lifelines or SciPy (Weibull), SHAP, structlog, argon2-cffi, PyJWT, pyotp, slowapi, ReportLab, rapidfuzz, orjson, pytest, hypothesis, httpx. Package manager uv (pip fallback).
Data: SQLite by default in dev (no Docker needed); PostgreSQL 16+ in compose and production; keep models portable and run CI on both. Jobs (solver, Monte Carlo, benchmark): in-process JobManager with ProcessPoolExecutor, persisted job rows, progress streaming and cancel; interface-compatible with a future Redis queue (note in an ADR). Windows uses spawn semantics: keep worker entrypoints top-level and picklable.
Single origin: Caddy fronts web and API in compose; bare dev uses Next rewrites for REST and an explicit dev-only WebSocket origin in the CSP.
Realtime: WebSocket /ws with channels clock, events, plan:{id}, solver:{job}, notifications:{user}; envelope {type, ts, seq, payload}; heartbeat 15 s; reconnect with backoff and resume from last seq.
Observability: structlog JSON logs with request IDs, solver-run history table, optional /metrics (P2).
REST (under /api/v1; uniform error envelope {code, message, details, request_id}; cursor pagination; ETag + If-Match on mutable resources; idempotency keys on event injection and publish):
- auth: login, logout, refresh, me, mfa
- scenarios + sim clock: list, load, reset, clone, clock get/set
- registers: bases, aircraft, crew, stores, tankers, airspace, weather, threats
- missions: CRUD, import, explain, why-not
- fusion: sources, ingest/{source}, conflicts, overrides, provenance/{entity}, degrade
- plans: list, create, get, optimise (job), validate, diff, submit, approve, reject, publish
- events: list, inject, impact, coas (generate), coa select/reject
- analytics: kpis, forecast/serviceability, forecast/weather-window, risk/mission/{id}, montecarlo (job), benchmark (job)
- ato: export (pdf|csv|json|signal), dissemination, ack
- assistant: query, propose
- audit: list, verify; admin: users, connectors, parameters, flags, bundle export/import
- health: /healthz, /readyz; OpenAPI UI at /api/docs
Performance budgets: baseline plan (default scenario, laptop) <= 10 s; re-plan p50 <= 3 s, p95 <= 8 s; dashboard LCP <= 2.0 s locally, INP <= 200 ms; Gantt 60 fps with >= 1,000 bars (virtualised rows; fall back to Canvas if SVG drops below 50 fps); landing JS <= 200 KB gz, app routes <= 350 KB gz; Lighthouse landing: Performance >= 90, Accessibility >= 95, Best Practices >= 95, SEO >= 90.

## 11. SECURITY, PRIVACY, GOVERNANCE
Strict CSP with nonces via the framework's request-interception layer (proxy.ts in Next 16, middleware.ts in older versions), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors none; make sure WebSockets work under the CSP (explicit wss origin if required). Cookies httpOnly + Secure + SameSite; no tokens in localStorage or any JS-readable storage. Server-side validation of every input (Pydantic) plus client forms (Zod). RBAC enforced server-side on every route, with a test matrix (endpoint x role). Rate limits, lockout, session rotation, idle timeout. Parameterised queries only. Secrets via env (.env.example provided). Audit everything. Field-level masking by role. Dependency audit in CI (npm audit, pip-audit); SBOM (P2). docs/SECURITY.md states the threat model, controls and honest limitations (prototype; no accreditation claimed).
Responsible-AI panel in-app: human on the loop, no autonomous tasking, uncertainty always shown, decisions attributable, model cards, manual-mode fallback, crew-workload fairness (Gini shown).

## 12. QUALITY GATES
Backend: pytest + hypothesis (for 200 seeded random scenarios every solver plan passes the validator; re-plan never alters frozen assignments; fusion is idempotent; audit tampering is detected; DTG/Zulu/unit conversions; RBAC matrix). Frontend: Vitest + Testing Library; Playwright e2e for journeys J1 Commander glance, decide, approve; J2 Planner baseline, manual edit, validate, submit; J3 event, COAs, select, approve, publish, acknowledge; J4 Fleet Officer marks NMC and sees impact; J5 Analyst updates a threat and a re-plan is proposed; J6 Auditor verifies the chain; J7 Judge Mode end to end; J8 go offline, keep reading, queue an edit, reconnect and sync. axe-core on every route (zero serious/critical). Lighthouse CI budgets as above. Offline check: the build fails if built assets reference external hosts. `pnpm screenshots` writes docs/screenshots at 1440 and 390 widths (reused in README and the PPT). CI (GitHub Actions): lint, typecheck, unit, e2e, build images, offline check, audits.

## 13. SIH DELIVERABLES (generate these)
- README.md: pitch, screenshots, quickstart (pnpm install; pnpm seed; pnpm dev; docker compose up --build), demo accounts, architecture Mermaid diagram, feature matrix, honest limitations.
- docs/SIH_PPT_MAP.md: map the product onto the official six idea-submission slides: Title (team, PS code, theme); Proposed Solution; Technical Approach (stack, flow diagram, prototype link); Feasibility and Viability (risks, mitigations); Impact and Benefits; Research and References. Give copy-ready bullet text and say which screenshot or diagram goes on each slide. Verify against the official template.
- docs/DEMO_SCRIPT.md: the 3-minute script with exact clicks, plus a fallback plan if the laptop or network misbehaves.
- docs/REFERENCES.md: only sources that actually resolve (check every URL). Seed list: Allignol, Barnier, Flener and Pearson (2012), "Constraint programming for air traffic management: a survey", The Knowledge Engineering Review 27(3); J. M. Saling, "Dynamic Retasking: The JFACC and the Airborne Strike Package" (DTIC, mirrored at man.fas.org/dod-101/sys/ac/docs/99-179.htm); "Air Tasking Order Dissemination: Does It Get the Job Done?" (DTIC ADA420267); the AFRL / 21st Century Technologies "Dynamic Air Battle Planning" brief on ATO-Link (aerodefensetech.com); Google OR-Tools CP-SAT documentation. Do not invent citations.
- Also: docs/ARCHITECTURE.md, DATA_MODEL.md, SECURITY.md, MODEL_CARDS.md, BENCHMARKS.md, and ADRs in docs/adr/.

## 14. PHASES AND EXIT CRITERIA
Phase 0 Foundations: monorepo, tooling, CI, tokens, app shell (rail, top bar, banner, clock stub), /dev/ui gallery, health endpoints, compose, docs skeleton. Exit: pnpm dev and docker compose up serve the shell and /api/healthz; CI green.
Phase 1 Domain and data: schema + migrations, deterministic generator and five scenarios, auth/RBAC (seven roles), registers CRUD and screens, audit chain. Exit: log in as each role; registers show seeded data; audit verify passes; RBAC tests pass.
Phase 2 Fusion and COP: simulated feeds, pipeline, conflicts, COP Health, provenance and freshness UI, map. Exit: degrading a feed visibly changes confidence and constraints; map layers and time slider work.
Phase 3 Optimiser and planner: CP-SAT model, validator, job manager with streaming, Gantt workbench, manual mode, explainability and why-not. Exit: S1 baseline in <= 10 s with 0 violations per the validator; drag/drop validates; why/why-not work.
Phase 4 Dynamic retasking and ATO: events, impact analysis, four COAs, decision matrix, approvals (two-person rule), versions, diff animation, ATO/ACO publisher, acks, exports. Exit: every event type produces valid COAs (p50 <= 3 s); selecting one yields a valid new version; ATO v2 publishes and exports.
Phase 5 Intelligence: predictive models and cards, Monte Carlo, benchmark and scalability pages, assistant (rule-based), handover brief. Exit: pnpm benchmark regenerates results; the assistant passes 10 scripted queries; model metrics are shown.
Phase 6 Polish and proof: landing page, Judge Mode, offline PWA, Hindi i18n, accessibility, performance and security passes, e2e suite, screenshots, SIH docs. Exit: every item in Section 15 is green; fresh clone to full demo works offline.

## 15. FINAL SELF-AUDIT (run before declaring done)
[ ] Fresh clone -> install -> seed -> demo works in Windows PowerShell and in Docker.
[ ] Network disabled: the whole app and Judge Mode still work; no external requests in the browser network tab.
[ ] Every route has loading/empty/error states, is keyboard navigable, axe-clean, with no console errors.
[ ] The validator agrees with every plan shown as valid; zero hard violations in all five scenarios.
[ ] Baseline and re-plan timings meet budgets (displayed numbers come from real runs).
[ ] Every dropped mission has a plain-English why-not.
[ ] Audit chain verifies; tampering is detected.
[ ] All RBAC tests pass; Auditor cannot mutate; DEMO_MODE=false hides demo logins.
[ ] The landing page reads like a product, not a hackathon: no placeholder text, no broken anchors, correct disclaimer.
[ ] README, docs, screenshots, SIH_PPT_MAP and DEMO_SCRIPT exist and are accurate.

## 16. NEVER
No real or classified data; no real unit, aircraft or weapon names; no weapon-effect or targeting logic. No dark mode. No tokens in localStorage. No external CDNs, fonts, tiles or analytics at runtime. No lorem ipsum, fake logos or stock photos. No purple-gradient "AI" look, neon, glassmorphism overload or emoji in UI chrome. No hard-coded metrics. No silent failures: every error is explained to the user and logged. No claims of accreditation or operational readiness.

BEGIN NOW: save this spec to docs/SPEC.md, create docs/PROGRESS.md, then start Phase 0.
26250
Problem Statement Title	
Air Power - Dynamic Air Operations & Resource Optimisation.
Description	
Problem Statement: Complexity in planning and dynamically retasking air operations in a contested and rapidly changing operational environment. Information on aircraft availability, crew status, weapon loads,airspace, weather, threats and mission priorities is generated across multiple systems but is not always available through a common, real-time decision-support framework, leading to increased planning timelines and sub-optimal allocation of scarce airpower resources.
Technology Opportunity: Al-enabled decision-support, multi - source data fusion, predictive analytics and optimisation algorithms.
Organization	Ministry of Defence (MoD)
Department	Defence Services Staff College
Category	Software
Theme	Transportation & Logistics
Youtube Link	
Dataset Link	
