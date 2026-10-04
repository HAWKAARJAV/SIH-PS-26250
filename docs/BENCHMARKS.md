# Benchmarks (simulated)

Generate: `pnpm benchmark`  
Script: `services/api/analytics/benchmark.py`  
Output: `docs/benchmarks/latest.json`

The landing page reads `GET /api/v1/benchmark`, which serves that file. The sentence is built from `runs`, `scale`, and `seeds`. It is labelled simulated in the JSON (`"simulated": true`).

## What the script does

For each seed it builds pack S1 at scale **S**, scores `greedy`, then `build_plan` with a 3 second limit, 1 worker, and that seed. It records value-weighted fulfilment, missions served, validator `valid`, and solver label.

The function default is `range(1, 6)` (seeds 1–5). `POST /api/v1/benchmark/run` calls `run(range(1, 4))` instead. The file in the repo is neither of those runs.

## Checked-in file (do not extrapolate)

`docs/benchmarks/latest.json` at the time of this note:

| Seed | Scale | Pack | Greedy fulfilment | Greedy served | Greedy valid | Solver fulfilment | Solver served | Solver valid | Label | Missions |
|------|-------|------|-------------------|---------------|--------------|-------------------|---------------|--------------|-------|----------|
| 1 | S | S1 | 0.7418 | 5 | true | 0.7418 | 6 | true | OPTIMAL | 15 |
| 2 | S | S1 | 0.7483 | 5 | true | 0.7483 | 6 | true | OPTIMAL | 15 |

`solver_beats_or_ties_greedy` is 2 of 2. On both rows fulfilment is a tie. The solver serves one more mission. That is not a 90% win rate, and it is not scale M.

## Spec targets that are not in this file

- 30 seeds each at S (20 aircraft / 15 missions), M (64/45), L (150/110), XL (300/220)
- Median and IQR
- Hard violations must be 0 on every reported valid plan (these two rows are valid; that does not cover the matrix)
- Re-plan p50 ≤ 3 s and p95 ≤ 8 s
- Optimiser beats greedy fulfilment on at least 90% of seeded scenarios

Until a new JSON is produced by `pnpm benchmark` (or a wider harness), slides should quote only the table above and say **simulated, scale S, seeds 1–2**.

## KPI names the scorer returns

`optimiser/plan.py` `score` reports `value_weighted_fulfilment` and `missions_served` (also copied onto plan KPIs). The spec’s longer set (P1 fulfilment, decision latency, reserve integrity, tanker overuse, crew-load Gini, Monte Carlo P(meet P1)) is not a column in `latest.json`.
