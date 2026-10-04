# Model cards

All figures below are from the synthetic generator or from `docs/benchmarks/serviceability.json` produced by `analytics/serviceability.py`. Nothing here is an operational model.

Label on every card: **Synthetic prototype. Not validated for operational use.**

## Serviceability — logistic regression v1

- **Code:** `services/api/analytics/serviceability.py`
- **Question it actually answers:** given the seeded fleet, can a logistic model separate current FMC from not-FMC?
- **Features:** `hours_to_inspection`, defect count, `sorties_72h`
- **Label:** 1 if `status == FMC`, else 0
- **Split:** `train_test_split`, test size 0.3, `random_state` = seed, stratified
- **Checked-in run:** seed 26250, model `logistic-regression-v1`, 20 holdout rows, AUC 0.778, Brier 0.073 (`docs/benchmarks/serviceability.json`)
- **What the planner uses instead:** `p_mc` written by `scenarios/generate.py` (`_p_mc`), a closed-form decay from status, defects, sorties, and hours to inspection. The logistic model is not an input to CP-SAT.
- **Not in this card:** Weibull survival, LightGBM, SHAP, horizon-specific trained probabilities. Those appear in the master spec and are not implemented. `lightgbm` may be installed; this module imports scikit-learn only.
- **Oversight:** a person selects and approves the plan.

## Mission risk — transparent weighted v1

- **Code:** `services/api/analytics/risk.py` `mission_risk`
- **Output:** score 0–100 from max threat `existence_p`, a ceiling-versus-minima weather penalty, mean `p_mc["6h"]` at the launch base, mean fatigue at that base, and a flat +15 if `needs_aar`.
- **Label:** heuristic. The function’s own note says it is not a calibrated probability.
- **Not in this card:** trained classifier, abort probability, SHAP.

## Fatigue

`fatigue_index` is a float stored on each crew row by the generator. The assistant can list high values. There is no separate fatigue model card and no medical claim in code.

## Weather window

Weather rows can carry an `ensemble` list (the monsoon pack overwrites member ceilings). There is no `forecast/weather-window` route and no P(go) model beyond the planner’s minima filter in `optimiser/model.py` `_weather_ok`.

## Monte Carlo

- **Code:** `services/api/analytics/montecarlo.py`
- **Procedure:** `small_world(seed)`, 20 runs by default, each marks one random FMC tail NMC, then `greedy` + `validate`.
- **Returns:** min/max/mean missions served, count of valid runs, seed. No fan chart, no tornado, no 500-run default, no CP-SAT.
- **Route:** `POST /api/v1/montecarlo` (body ignored; seed 7 and 20 runs are fixed in the router).

## Pop-up task rate

Not implemented.

## Assistant

`analytics/assistant.py` is a regex over the snapshot (mission id, tail id, duty/fatigue, weather, ready/status). It cites ids it found and the snapshot `now` string. Unknown text returns intent `unknown`. No LLM provider.
