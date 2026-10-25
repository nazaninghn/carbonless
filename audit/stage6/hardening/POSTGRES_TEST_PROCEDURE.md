# PostgreSQL test procedure for DR-19 (for an authorized environment)

**Status: PostgreSQL has NOT been tested.** A PostgreSQL 18 service is installed and running on the development machine (port 5432), but it requires a password
that was not provided; `DATABASE_URL` in the project `.env` is empty, so every run so far used SQLite. No credentials were guessed and nothing was installed.

Run this only with a database you are authorized to use, never against production or the development data. Use a throw-away role and database.

## 1. Prepare (as a PostgreSQL superuser, once)

```sql
CREATE ROLE carbonless_scratch LOGIN PASSWORD '<choose a password; do not commit it>' CREATEDB;
CREATE DATABASE carbonless_scratch OWNER carbonless_scratch;
```
`CREATEDB` is needed because Django's test runner creates and drops `test_carbonless_scratch` itself.

## 2. Get the DR-19 code into an isolated copy (not the working tree)

`tools/rebuild.ps1` builds the copy from the repository plus the prototype patches (`patch.py`, `patch2.py`) and copies in the two test files (adjust the paths at the top).
Or copy the backend folder elsewhere, apply `implementation/modified_existing_files.diff`, and add the new files under `implementation/`.

## 3. Tests (PowerShell, inside the copy's `carbonless_backend`)

```powershell
$env:ALLOW_DEV_SECRET = "true"
$env:DATABASE_URL = "postgres://carbonless_scratch:<password>@localhost:5432/carbonless_scratch"
python manage.py check
python manage.py makemigrations --check --dry-run          # expect: No changes detected
python manage.py test questionnaire.test_dr19 questionnaire.test_dr19_routes
python manage.py test                                      # whole suite; compare with the SQLite counts in DEPLOYMENT_READINESS.md
```
Record the exact `Ran … / OK|FAILED (failures=…, errors=…, skipped=…)` lines. Any failure is a finding, not a flake: capture the traceback.

## 4. Migration, freeze and rollback drill on a restored copy of the data

1. `pg_restore` (or load) a **copy** of the data to be tested into `carbonless_scratch`.
2. `python manage.py showmigrations questionnaire` (note whether 0011 and 0012 are pending too).
3. `python manage.py migrate`, then record: entry count, `SUM(calculated_co2e_kg)` of approved entries, a hash of the entry rows, number of reports, number of locked reports.
4. `python manage.py report_factor_provenance --csv audit.csv --steps-csv steps.csv --entries-csv entries.csv` (read-only; re-take the numbers of step 3 and confirm they are identical).
5. `python manage.py freeze_applied_factors` (dry run), review, then `--apply`; repeat the numbers (entries must be identical).
6. `python manage.py migrate questionnaire 0012` (rollback), repeat the numbers (entries identical; the `applied_factors` column is gone), then `python manage.py migrate questionnaire` and `freeze_applied_factors --apply` again.
7. Compare with `results/migration_rollback_drill.log` (SQLite).

## 5. Concurrency that SQLite cannot show (row locks)

* Run the `Threads` tests from step 3 and read the output for lock or serialization errors.
* Manual lock check with two `psql` sessions on the scratch database: session A `BEGIN; SELECT id FROM questionnaire_carbonreport WHERE id = <locked report> FOR UPDATE;` (leave open); session B runs
  `python manage.py shell` and calls `questionnaire.applied_factors.reprice_inventory(report, user, 'test')`. B must wait until A commits or rolls back, then complete correctly.
* Failure inside the transaction: a forced error in `reprice_inventory` must leave the map, the entries and the history unchanged (the test does this on SQLite; confirm on PostgreSQL, where a failed
  statement aborts the whole transaction).

## 6. Clean up

```sql
DROP DATABASE IF EXISTS carbonless_scratch;
DROP ROLE IF EXISTS carbonless_scratch;
```
Do not set `DATABASE_URL` in `.env`. Do not run any of this against the development SQLite file or production.
