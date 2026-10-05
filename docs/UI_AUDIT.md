# VYUHA UI audit

Walked in the browser on 5 Oct 2026 against `pnpm dev` (web `http://localhost:3000`, API `:8000`, `DEMO_MODE=true`). Signed in with **Enter as Ops Planner**. Viewport started at 594×734, then was widened to 1440×900 so the desktop sidebar appeared.

Quoted labels are the text that was on the control at the time of the click.

## What was broken

### Navigation and sign-in

- **Landing, first click on “Launch live demo”.** The header link received focus and the URL stayed `/`. A Next.js hydration overlay was open at the same time (dev-only mismatch on `data-cursor-ref` attributes injected by the audit browser). A later direct open of `/login` worked. The hero control with the same label is a real link to `/login`.
- **Narrow window hides the whole app.** Below the `md` breakpoint the sidebar is `display: none` and there was no other menu. At 594px the only in-app links on Command glance were “Open planner”, “Retask console”, and “Judge mode”. Fleet, ATO, Audit, Map, and the rest were unreachable without typing a URL.
- **No way to change role.** The header showed “Ops Planner” and nothing else. Logout exists on `POST /api/v1/auth/logout` but no control called it. The ATO lifecycle needs Planner, then Commander, then Auditor. The only path was to navigate to `/login` by hand.
- **“Take the 3-minute tour” / “Open the 3-minute tour for judges”** goes to `/app/judge`. Signed-out visitors are sent to `/login`, and sign-in always landed on `/app`, so the tour destination was dropped.

### Command glance

- Tiles loaded: Mission fulfilment “No plan yet”, P1 coverage “—”, Aircraft FMC “59 / 64”, Crew ready “140 / 140”, Data freshness “64 / 64 FRESH”, Plan validator “Not valid — open planner”, Reserve integrity “Check plan”, Plan status “No plan”. Calling a missing plan “Not valid” sends the reader to fix a plan that does not exist. P1 “—” does not say what to do.
- A later edit of the tile list stored objects and still destructured them as pairs, so the labels would have rendered blank. That render path is fixed.

### Planner

- Empty state “No plan yet / All quiet on the unscheduled front. Optimise to draw the first ATO.” was clear.
- **“Validate”** and **“Submit”** with no plan did nothing. No message, no disabled state. Confirmed by clicking “Validate”: the empty state stayed and the API was not called.
- **“Optimise”** worked. Status line: “Plan PLN-001 is valid. Zero violations. OPTIMAL”. “Validate” then showed “Validator PASS · 0 hard violations.”
- **Gantt bars** are buttons named only `MSN-001`, `MSN-004`, and so on. Nothing says a click moves the bar. Clicking `MSN-001` called `PUT /api/v1/plans/PLN-001/assignments` and the server answered **409** “MSN-001 package slots do not launch together.” The message was shown (twice, in the alert). The move snapped back because only one aircraft in the package moved.
- “Submit” does not say it is a handoff to the commander.

### Retask

- **“Inject disruption”** with Tail `TAIL-101` and Event “Aircraft NMC” returned **200**. Impact: “3 missions · 3 aircraft · 4 crews · 0 tankers · 0 bases”, “Decision window T−55 min”, links “Why not MSN-028”, “Why not MSN-029”, “Why not MSN-031”.
- The note said **“0 distinct valid COAs · validator checked each.”** and the empty card still said **“No courses of action yet”** with “Optimise a baseline in the planner, then inject Bravo closure or T-114 NMC.” The baseline already existed. The solver was given a 2 second limit per preset (`time_limit=2` in `inject_event`), shorter than the 8–10 seconds used for a baseline optimise, so every preset came back invalid and the page blamed the user.
- **“Select COA → new draft plan”** (later “Select — creates a draft for the commander”) is enabled for the planner. Selection is `select_coa`, which only the commander has. A planner click is a **403** “Your role cannot do that.”
- Sliders “Value weight (40)”, “Stability weight (50)”, “Risk weight (30)”, “Reserve weight (40)” are present. They only re-rank cards that already exist, so with zero cards they look like controls that do nothing.
- The tail list is the first 40 FMC tails. `TAIL-114` is the tail the empty copy names, and it was not the selected value (`TAIL-101`).

### COP Health

- Eight feeds loaded (MSS, CRFR, ASL, AMF, MET, TIP, TAP, EXF) with badge “LIVE”. Conflict inbox showed TAIL-101 status (MSS FMC vs EXF PMC) and CREW-001 hours.
- Every row had a button whose accessible name was only **“Degrade”** (later “Mark feed stale”), with no feed name in the name. Clicking the first one (`MSS`) returned **403** “Your role cannot do that.” The page showed that sentence plus a “Try again” retry. Degrade is `connectors`, admin only. The word “Admin” under the button did not stop the click.

### Fleet

- Status menus were live `<select>` elements for every tail. A planner change is `fleet_write` and returns **403**. The page later disabled them, but the closed reason was the two words **“Fleet officer only”**, and the options were the codes FMC / PMC / NMC. Column headers were “Tail (tail)”, “Type (type_id)”, and the same pattern for the other fields.

### Missions, crew, stores, bases

- Registers load. Headers were raw field names (`id`, `call_sign`, …) and then “Mission (id)”, “Call sign (call_sign)”, “Person (id)”, “Stock code (code)”. The page prose explains the register; the column titles still read like a schema dump.
- Mission import is a file input labelled “Import JSON” / “Import mission JSON or CSV”. It is enabled for every role. Import is `missions`, planner only, so other roles get a 403 after choosing a file.

### ATO

- With a draft, the planner can open **“View”** and **“PDF”**. Approve, co-sign, and publish were hidden rather than explained, so a planner could not see why the lifecycle stopped. A later pass shows every step disabled with a reason. That is the right shape. **“Submit”** still needed to name the commander handoff (the row label is now “Submit draft — Ops Planner”).

### Audit

- `GET /api/v1/audit` is **403** for the planner: “Your role cannot read the audit log.” The page shows that, then **“Try again”**, which calls the same request.
- **“Verify integrity”** stays enabled. Verify is `audit`, auditor only, so the click is another **403** “Your role cannot do that.”

### Judge mode

- **“RESET DEMO”** and **“Run reset”** call `POST /api/v1/scenarios/load`, which needs `clock`. Planner and auditor get **403**. The button does not say that a commander or admin has to press it. **“START 3-MINUTE TOUR”** only resets the local step index; it does not load a scenario. Those two buttons looked like the same kind of action.

### Map, forecasts, admin

- Map title “Theatre MERIDIAN”. Base markers were `<button>` elements with the base name and no click handler, so they look pressable and do nothing.
- Forecasts: **“Train on the seeded fleet”** (later “Train serviceability on the seeded fleet — admin”) is enabled for the planner and 403s (`admin`). **“Run 20 disruptions”** is allowed for any signed-in role (`read`).
- Admin is omitted from the planner sidebar (`showAdmin` is commander or admin only). A planner who opens `/app/admin` directly still sees **“Load scenario”**, which 403s.

### Header

- “Zulu” and “IST” work (pressed state flips). They do not say they only change how the clock line is written.
- **“Sim 10×”** is commander/admin only and gave no success or failure text.

## Fixes applied after the walk

- Mobile **“Open menu” / “Close menu”** shows the same nav the desktop sidebar uses. **“Switch role”** signs out and returns to the demo login. A signed-out visit keeps `?next=` so the judge tour can resume. **“Run simulation clock at 10×”** prints the server error or “Simulation clock is running at 10×.”
- Command glance: no plan reads “No plan yet”, including P1 coverage and the validator badge. Tile meanings render.
- Planner buttons: **“Optimise the flying day”**, **“Check this plan”** (closed until a draft exists), **“Submit for commander approval”** (closed unless the plan is DRAFT). A bar click shifts every aircraft in that mission by 15 minutes. The helper line says so. Other roles see spans, not buttons.
- Retask: select is **“Select this course of action — commander”** and stays closed with a reason for everyone else. After an inject with zero cards the empty title is “No valid course of action”, not “go optimise”. Event solve limit raised from 2 seconds to 8 so a preset can finish (`services/api/app/routers/ops.py`).
- COP Health: **“Mark MSS stale”** / **“Restore MSS”** (and the other feed ids) stay closed unless the role is admin, with “An admin marks a feed stale.”
- Fleet status options read “FMC — fully mission capable”, “PMC — partially mission capable”, “NMC — not mission capable”. Closed rows say a fleet officer changes the status. Column titles are Tail, Type, Base, Hours to inspection, Status.
- Audit: **“Verify the audit chain — auditor”** is disabled for other roles, with a switch-role sentence.
- Judge mode: **“Reset demo to scenario S5”** is disabled unless the role is commander or admin.
- Forecasts: the train button is disabled unless the role is admin.
- Map markers are labels, not buttons.
- Register columns on Missions, Crew, Stores, and Bases use plain titles (Mission, Call sign, Person, Quantity, Launches per 15 min, and so on).

## Still broken or unfinished

- Injecting “Aircraft NMC” on `TAIL-101` returned zero courses of action under the 2 second limit. The limit is now 8 seconds; that path was not re-run to the end in this pass, so a slow or empty solve can still happen on a large theatre.
- Weight sliders do nothing until cards exist. They are labelled, and they are not disabled.
- Mission import stays enabled for roles that cannot import. The paragraph says an ops planner imports; the file input itself does not.
- Audit “Try again” on a 403 reloads the same forbidden request.
- Admin “Load scenario” is still a live button if a planner opens `/app/admin` by URL. The nav hides the link.
- Landing “Launch live demo” can be covered by the Next.js dev issues overlay. That overlay is not part of the product build.
- After a fresh optimise, clicking “Shift MSN-001 on TAIL-105 15 minutes later” still returned 409: “TAIL-109 is already flying or turning between MSN-001 and MSN-031.” The checker message is on the page. A 15 minute slide is not always legal; the bar is no longer silent.
- While TAIL-101 stayed NMC from the earlier inject, every bar shift 409’d with “TAIL-101 is NMC and cannot take MSN-028,” because the save rechecks the whole plan.
- Crew, stores, and bases remain read-only. The pages say so. There is no crew-officer or fleet-officer editor on those screens.
- A full commander approve → auditor co-sign → publish → PDF download was not completed in this pass. The ATO row shows those steps disabled, with the role and the status that would enable them.
