# Backend note (this pass)

CSV mission import is on `POST /api/v1/missions/import`. JSON `{ "missions": [...] }` is unchanged (optional `"format": "json"`). CSV is `"format": "csv"` plus a `csv` string, or a `csv` field alone. The response is still `{ "accepted", "rejected": [{ "row", "reason" }] }`. CSV row numbers are file lines (header is line 1). A `slots` column is a JSON list; otherwise `type_id`, `load_out`, and `quals` (`|` or `;`) build one slot. Bad rows are skipped; a bad header is one reject on row 1.

Alembic revision `c9d9574462ca` creates the tables in `app/tables.py`. From `services/api`: `uv run alembic upgrade head`. `DATABASE_URL` selects the database. Tests and app startup still use `create_all` and do not migrate. If the file already exists from `create_all`, use `uv run alembic stamp head` instead of upgrade. Details are in `services/api/alembic/README`.

Property tests now also check greedy plans for seeds past the fixed 1–200 loop. Benchmark smoke is scale S, seeds 1 and 2, and does not write `docs/benchmarks`. There is no 30-seed medium CP-SAT run.

Still not 100% on the backend: no 30-seed M/L benchmark charts, Docker was not run, Weibull/LightGBM serviceability was not rebuilt, and Alembic is not what the app calls on startup.
