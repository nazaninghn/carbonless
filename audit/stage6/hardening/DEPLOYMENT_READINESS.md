# DR-19 hardening stage: deployment-readiness report

## Recommendation

**READY FOR REVIEW of the design and the diff. NOT READY for deployment.**

Blocking items before any deployment:
1. **PostgreSQL is untested** (a procedure for an authorized environment is in `POSTGRES_TEST_PROCEDURE.md`).
2. The read-only audit has only been run on the **development data**, never on a restored production copy; the freeze must be reviewed against that result first.
3. The user-facing messages for a **held inventory** and for a **substituted factor row** do not exist yet (English and Turkish).
4. The **report 15** decision (§5) and the question of the 21 sibling test inventories.
5. `build.sh` is unchanged; the freeze step is not in it (§3b, §8).

All DR-19 code is in an isolated copy and stays there until you approve it.

## Scope and safety statement

Nothing in this stage was applied to the repository, the development database, any factor value, GWP value, formula or historical inventory total. No commit, push, merge,
deploy or production migration. Report 15 was never saved, rebuilt or recalculated in the original database (it was examined in disposable copies). The original
`db.sqlite3` SHA-256 is `5141121f64495ba36cf3035b1a86c65a7776c07342e201e8a36a9eface64be32` and was **re-checked unchanged after every database run** (audit, dry run, reproduction, migration drill).

One mistake of mine during the stage: a helper script deleted and recreated this `hardening/` folder and removed the two hand-written reports in it. Only my own audit documents were affected (rewritten here); the script can no longer remove the folder root.

| | In the repository now | Only in the isolated copy |
|---|---|---|
| Label-only release (approved last stage): 26 `reference` texts, ISO PDF note, `test_label_only_release.py`, frozen baselines | **applied** | |
| DR-19: frozen factor map, pinned lookups, write-path protection, hold, read-only audit, deploy / release commands, migration `0013` | | **yes** |
| Anything else I changed this stage | **nothing** | |

**Unrelated changes in the repository that are not mine** (they appeared while I worked; I did not touch or review them): tax-number work in `accounts/views.py`, `accounts/tests.py`,
`companies/serializers.py`, `companies/tests.py`, `accounts/management/commands/fix_missing_companies.py`, the frontend `register/page.jsx`, `CompanySettings.jsx`, `companyFields.js`,
`.agents/tasks/taxnumber-10-digit/*`, and scratch files (`taxtest*.txt`, `qtest.txt`, `django_check.txt`, `fe_build.txt`). They were preserved. Deployment must be scoped so they are not shipped by accident.

## 1. Changed files and diff summary

Existing files modified (isolated copy versus repository; `implementation/modified_existing_files.diff`): **+172 / −7 lines in 7 files**.

| File | Change |
|---|---|
| `emissions/factor_lookup.py` (+39) | `pick_factor` resolves through the inventory's pins; the shared `resolve_factor_and_amount` (chat, dashboard previews, duplicate checks) enters the pinned context of the signed / completed inventory of that company and year |
| `emissions/models.py` (+66) | `EmissionFactor`: the value of a referenced row cannot be changed by `save()`, `update()` or `bulk_update()`; pre-change freeze. `EmissionEntry`: a new entry, or one whose factor row changes, in a locked inventory follows the pin (also `bulk_create()`); `update(emission_factor=…)` refused for a locked year |
| `questionnaire/models.py` (+3) | `CarbonReport.applied_factors` (nullable JSON) |
| `questionnaire/step_entries.py` (+17/−2) | `recorded_connections` loads and persists the pins and sets the "managed" flag; `sync_step_entries` refuses a held inventory |
| `questionnaire/workspace_views.py` (+7/−1) | Workspace sync runs in the pinned context and refuses a held inventory |
| `questionnaire/views.py` (+8/−3) | sign-off and `reset_session` freeze the map |
| `questionnaire/signals.py` (+32/−1) | freeze before a factor row is created or changed; freeze when a report is saved as locked (a failure never blocks the save) |
| `questionnaire/management/commands/backfill_calc_detail.py` (1 line, applied by `patch2.py`) | the deploy-time job runs with `persist=False` |

New files (`implementation/`): `applied_factors.py` (505 lines), migration `0013_report_applied_factors.py` (one nullable JSON column), commands `report_factor_provenance`, `freeze_applied_factors`,
`release_inventory_hold`, tests `test_dr19.py` (446 lines, 34 tests) and `test_dr19_routes.py` (499 lines, 36 tests).

## 2. Test results (exact)

Both suites were run to completion with `python manage.py test` on SQLite. The runner prints `Ran N tests` and `OK (expected failures=E)`; it adds `skipped=S`, `failures=F` or `errors=X` only when they are non-zero, and none was printed.
"Passed" is therefore **derived** (run − expected failures), not printed.

| Run | Tests run | Passed | Expected failures | Failures | Errors | Skipped | Result line |
|---|---|---|---|---|---|---|---|
| **Hardened isolated copy** (repository current state + DR-19) | **912** | 902 | 10 | 0 | 0 | 0 (none printed) | `OK (expected failures=10)`, 1,106 s |
| **Untouched copy of the repository's current state** | **842** | 832 | 10 | 0 | 0 | 0 (none printed) | `OK (expected failures=10)`, 1,271 s |
| Difference | +70 | +70 | 0 | 0 | 0 | 0 | the 70 DR-19 tests (`test_dr19.py` 34, `test_dr19_routes.py` 36) |

* The 10 expected failures are the same in both: the Stage 5 factor-discrepancy tests that stay open until you approve the corresponding decisions.
* The repository count rose from 837 (last stage) to 842 because of tests added by the unrelated tax-number work now in the working tree (not mine). The untouched copy was made from the working tree at the time of the run; the hardened copy was made from the same tree plus the DR-19 patches.
* DR-19 tests alone, last run: 70 run, all passed (an earlier run of the same files before the final test additions: 59 passed).
* Original development database SHA-256, re-checked after the last run: `5141121f64495ba36cf3035b1a86c65a7776c07342e201e8a36a9eface64be32` (unchanged).

**Negative controls** (a protection switched off; the tests that guard it must fail; all restored afterwards, no control switch remains in the delivered code):
pins off → 13 locked-inventory tests fail · factor write guards off → 3 fail · entry guard off → 6 fail · shared-lookup pin off → 1 fails (chat creation still passes because the entry guard catches it: defence in depth) ·
hold off → 3 fail · backfill allowed to persist pins → 1 fails · **the read-only bug of this stage re-introduced → all 5 `ReadOnlyGuarantees` tests fail**.

## 3. Safeguards, route by route

### 3a. Read-only guarantee: the bug found in this stage, and its regression tests

**Bug.** After the shared factor lookup was made pin-aware (so chat and dashboard follow a locked inventory), it opened its own *persisting* pin context whenever none was active. Inside the audit's
preview (which deliberately runs with `persist=False`, or with no pins at all to measure the exposure) it therefore (a) **wrote first-use pins** (`first_use_unverified`) into the legacy inventories being
audited, and (b) silently pinned the "without pins" exposure figure. The tests caught it: the "read-only" command changed `applied_factors`; the deploy freeze then stored `first_use_unverified` instead of
`deploy_time`; the hold test found pins on an inventory that should have none. **Fix:** a flag, set by `recorded_connections`, meaning "an explicit context manages the pins here"; the shared lookup and the entry guard do nothing inside it.

**Regression tests** (`test_dr19_routes.py::ReadOnlyGuarantees`, 5 tests). A snapshot of everything an audit must not touch (hash of all entries; every report's map, `updated_at`, `edited_after_signing_at`, status
and `signed_at`; history row count; answers; factor count) is identical before and after: `provenance_report()`; `rebuild_preview()` with and without pins; a shared lookup inside a managed context; the
`report_factor_provenance` command; the `freeze_applied_factors` dry run. A further test shows the two preview modes really differ (the exposure mode is not silently pinned). On the database copies the audit and the
dry run left the file **byte-identical** (hash compared).

### 3b. `build.sh` and `backfill_calc_detail`

Actual order on every deploy: `pip install → collectstatic → migrate → seed_factors → seed_gas_splits → create_admin → backfill_calc_detail (|| skipped) → ensure_user_companies`.

* **The freeze must be inserted between `migrate` and `seed_factors`** (proposal in §8; not applied). Without it, `seed_factors` could add or change rows before the legacy inventories are frozen; the pre-change freeze would
  still pin the factors their *entries* use, but not the underlying factors of calculated entries.
* **`backfill_calc_detail` cannot overwrite or falsely establish provenance:** it now runs with `persist=False` and writes no pin, no `frozen_at`, no hold. Tested on a legacy (unfrozen) inventory (map and every entry
  byte-identical afterwards, `frozen_at` still empty), on a frozen inventory (map, provenance and `frozen_at` identical; provenance still `lock`) and on a held inventory (untouched).
* **Remaining risks with it:**
  1. It still rewrites the *text* (`description`, `calc_detail`) of entries whose key is unchanged, including entries of signed inventories. The audit reads `calc_detail` to name the underlying factor of a calculated entry, so a regenerated text replaces the original evidence text (amounts never change).
  2. It does not check the hold. In the cases examined it neither creates nor deletes entries of a held inventory, but not every case was tested.
  3. Its facility-split path deletes and recreates entries; the recreated entries keep the (pinned) factor rows, but this was not exercised against a signed inventory.
  4. It runs after `seed_factors`, so it cannot be relied on to be the first thing that touches an inventory.

### 3c. Coverage by route, and what can still bypass it

| Route | Protected by | Tested | Bypass that remains |
|---|---|---|---|
| Dashboard create / edit / member's pending change | `EmissionEntry.save()` follows the pin (shown in the response, written to the company history) | yes (the pending-change replacement through the same constructor the view uses, not the member's HTTP flow) | none through the application; the UI does not explain the substitution |
| Batch import | same guard | yes | none |
| Chat entries, previews, duplicate checks | pinned shared lookup + entry guard | yes (creation, lookup); the chat HTTP views were not driven | previews of unsaved figures follow the newest row for an unsigned year (expected) |
| Admin | `save()` / `update()` guards; the "withdraw" action freezes first | yes (action, `save_model` for a factor and for an entry) | a factor-value edit in the admin form raises a server error instead of a field error |
| Workspace sync | pinned context + hold | yes | none found |
| Questionnaire saves, sign-off, final question, reset | pinned context; freeze on each lock path; hold | yes | a status set by raw SQL, or by `QuerySet.update()` outside `reset_session`, has no freeze at that moment; the pre-change freeze and the lazy freeze cover it when a factor changes or the inventory is next calculated |
| `resync_inventory` / Custom Request approval / facility resync | through `sync_step_entries` (pins, hold) | yes (`resync_inventory`); the facility resync not separately | none found |
| Background commands | `backfill_calc_detail` pin-free; `seed_factors` cannot change a referenced value; audit and freeze commands read-only or explicit; **no Celery, cron or scheduler found in the code** | yes (backfill, audit, freeze) | repository-root scripts that create entries (`demo_seed.py`, `create_test_data.py`, `qa_*.py`) go through `save()`, hence guarded, but were not run |
| `save()` | factor: value of a referenced row refused; entry: follows the pin | yes | none |
| `update()` | factor: value refused, withdraw / re-default freezes; entry: `emission_factor` refused for a locked year | yes | `update()` of other entry fields (quantity, status) is allowed by design (authorised edits) |
| `bulk_update()` | factor: value refused, withdraw / re-default freezes | yes | `bulk_update()` of **entries** is not overridden (an entry's factor could be bulk-updated to another row); I found no code that does this |
| `bulk_create()` of entries | follows the pin, kg recomputed | yes | none |
| Raw SQL / DB console / restored dumps | cannot be prevented by the application | detected: entries whose factor value no longer equals their own snapshot are `RECORD_INCONSISTENT_REVIEW` | **open**; a database trigger is the preventive control and was not built |
| Report generation (ISO / PDF) for a locked inventory | designed to run in the pinned context (existing `recorded_connections` wrapper) | **not tested separately** | unknown until tested |

## 4. Legacy provenance audit (read-only)

`manage.py report_factor_provenance --csv --steps-csv --entries-csv` re-runs each locked inventory's own calculation in memory and compares it with the approved entries. It writes nothing.
Outputs in `results/`: `legacy_inventory_audit.csv`, `…_steps.csv`, `…_entries.csv` (inventory id, status, entry id, class, missing provenance, recommended handling) and the logs.

Run on a **copy of the development database** (5 signed / completed inventories; production data was not available to me):

| Report | Company / year | Approved entries | Entry classes | Verdict |
|---|---|---|---|---|
| 28 | 3 / 2025 | 19 (26,856,253.81 kg) | proven 8 · answer_based 8 · **unproven_reproducible_today 3** | provable |
| 31 | 4 / 2025 | 16 (388,669.34 kg) | proven 10 · answer_based 4 · **unproven_reproducible_today 2** | provable |
| 6, 8 | 1 / 2024 | 0 | | no_entries |
| **15** | 1 / 2024 | **0 (no calculation entries on record)** | entries_missing 11 steps | **ENTRIES_MISSING_REVIEW** |

* `unproven_reproducible_today`: a calculated entry priced with a catalog factor (`turkey-grid-distribution`, `wt-01-landfill`) named in the entry's own calculation text but **recorded by no entry**. Today's rows reproduce
  the stored figures; that is not evidence of which row was used at signing. They are stored as **`deploy_time`: explicitly unproven**, never presented as the historical factor. `answer_based` entries (supplier factor,
  declaration, reported total) come from the user's own answer and need no catalog row.
* **No inventory in the development data is `UNPROVABLE_REVIEW`** (a stored figure that today's factors already fail to reproduce) and none has value drift. For production this can only be established by running the same
  command on a restored production copy.
* **Safe handling implemented; nothing automatic.** The deploy command (dry run by default) freezes provable inventories and puts the others on **hold**. A held inventory is not frozen, not rebuilt, not repriced: the
  questionnaire, Workspace and resync routes refuse to touch its entries and write a history row; its answers are still saved. `release_inventory_hold` (reason and actor required, audited) is the only way out.

## 5. Report 15

**Actual versus hypothetical.** *Actual saved result for report 15 today: no entries, 0 kg of calculated emissions on record* (the company's 2024 entry set is empty; the company's only saved entries are four 2026 chat
entries). *The 258,690.91 kg is a hypothetical recomputation* from its saved answers with today's factors. It has never been stored for this report and would be stored only if a rebuild were allowed.

Facts (disposable copy of the development database; `results/report15_reproduction.log`, `tools/report15_history_query.py`):
* Company 1 / 2024, titled "E2E Test 2", created 2026-10-13 19:53:19, 166 saved steps, 7C-2 sign-off saved 19:57:05, completed 19:57:13. `signed_at` equals the 7C-2 step time to the microsecond, which is what migration 0010
  (applied 2026-10-15) writes when it back-fills `signed_at` from the sign-off step; so the signed state is consistent with a real sign-off but was set by the migration, not by the live save.
* It belongs to a group of **22 inventories for the same company and year** (3 completed including report 15, 19 drafts; all flagged `legacy_duplicate_year` by migration 0012 when applied to the copy). Their titles are E2E / QA runs ("E2E Test", "Edge Test", "E2E2 …", "Live Check").
* **Timeline from the company history:** 19:54–19:55 its 11 questionnaire steps created entries (history rows 25–35); **20:01:09, four minutes after signing, history rows 38–48 log the same 11 steps as "→ removed"**. At that moment
  another draft of the same company and year ("E2E2 Fix2", report 16, created 20:00:40) was saving its own steps (20:00:41–20:01:10). An earlier removal at 19:53:47 (rows 21–24), when report 15 started saving, is the same mechanism.
* **Root cause: the original F-4 defect.** Entries are stored by company and year, not by inventory, so a later inventory of the same year rebuilt the shared entry set and deleted the signed inventory's entries. It is a legacy
  data-integrity casualty, not a factor problem. Stage 1's guard (one inventory per company and year, 409) prevents the cause; nothing repairs the past.
* **Correction to my earlier statement** ("a save could generate 258,690.91 kg"). Reproduced in a disposable copy: with the current code a save of report 15 is **refused (409, `InventoryYearConflict`)** because 21 other inventories
  cover 2024. The hypothetical 258,690.91 kg (14 entries, 11 steps) appears **only if no other inventory covered that year** (reproduced by removing the siblings inside a rolled-back transaction). The exposure is therefore
  conditional but real: archiving or deleting the siblings, or any path that skips the year guard, would create it silently. With the hold set, the same save creates 0 entries and writes one `rebuild_held` history row. Every
  reproduction was rolled back and the copy's row counts were identical afterwards.
* **Why a silent rebuild would be wrong even if allowed:** the history shows the originally signed electricity was 5.04 t (12,000 kWh × 0.4199, the legacy grid factor); today's connection-based factors give 5,628 kg (+589.2 kg, +11.7%).
  The other steps' logged quantities reproduce (3A-5 1,000 m³ = 2,020 kg; 3B-7 3,000 L = 8,088 kg; Q88 2.34 t).

**Proposed recovery procedure (not executed; needs your approval):**
1. Keep the hold on report 15 (deploy command). Never save or rebuild it in place.
2. Preserve the signed record: export its 166 answers, the 7C-2 sign-off and the company history rows 8–51 into an evidence bundle with hashes.
3. Decide with the owner whether this inventory is a test artefact (title "E2E Test 2", among 21 other test inventories). If so, mark it as test data and exclude it from reporting instead of recovering figures.
4. If it must be recovered: reconstruct each step from the retained answers **with the factors in force on 2026-10-13** (for electricity the legacy `turkey-grid` 0.4199, not today's connection factors), compare each step with
   the amounts logged in rows 25–35, and write the result as new entries through an explicit, reasoned, audited action (a reviewed variant of `reprice_inventory`), flagged edited-after-signing, with the before state ("no entries") and the after state on record.
5. Only then release the hold (reason required, audited).

## 6. Explicit re-pricing

`reprice_inventory` runs in one transaction under a row lock and requires a stated reason. Its history row records: reason, actor (id and name), timestamp, previous factor map and provenance, previous entries (factor row,
value, quantity, kg) and total, the new map, new entries and new total, and which slugs moved. A signed inventory whose total moves is flagged edited-after-signing. A failure part-way (forced in a test) leaves map, entries,
history and flag untouched. It refuses a draft, an empty reason and a held inventory. Tested: the previous approved total is preserved when two re-prices, or a re-price and an unrelated edit, run at the same time.

## 7. Database and concurrency testing

* **PostgreSQL: NOT TESTED (unverified).** A PostgreSQL 18 service is running on this machine (port 5432, `psycopg2` present) but it requires a password I do not have; `DATABASE_URL` in `.env` is empty (so every run used
  SQLite) and the Docker daemon is not running. One passwordless connection attempt was refused; no credentials were guessed and nothing was installed. The exact procedure for an authorized environment is in `POSTGRES_TEST_PROCEDURE.md`.
* **Forward migration and rollback (SQLite, fresh copies of the development database), `results/migration_rollback_drill.log`:** forward 0011 → 0013; freeze `--apply` (4 frozen, 1 held); rollback to 0012; forward
  again; freeze again. **Entries 55, approved total 27,621,670.0512 kg and the entry hash `4cec5c43a6fa68e9` were identical at every step**; reports 32, steps 1,256, locked 5. After rollback the column is gone (maps and the hold are lost; re-running the freeze
  command restores them: 4 frozen, 1 held). `makemigrations --check`: no drift. A test also migrates backward and forward on a test database and checks the neighbouring column.
* **Concurrency (SQLite serialises writers; this is not a PostgreSQL row-lock test):** real threads for completion vs a factor row being added, explicit re-price vs an unrelated edit, two simultaneous re-prices, sign-off
  freeze vs resync vs a factor row, and a rebuild vs a factor row; plus 4 threads × 6 pin merges and deterministic stale-writer interleavings. Invariants checked after each: exactly one entry per source, its kg equals quantity × its
  row, the map agrees with the entries, both re-prices are on record and the original approved total is preserved in one of them.
* **Rollback of a transaction:** a forced failure during re-pricing changes nothing (tested); a failing freeze never blocks saving a report (tested).

## 8. Deployment sequence (proposed; nothing run)

1. **Freeze factor changes:** no new or changed factor rows, no numeric releases, until step 7.
2. **Back up** the production database (`pg_dump -Fc`) and prove the backup restores into a scratch database.
3. On that restored copy, with the new code: `migrate`, then `report_factor_provenance --csv … --entries-csv …` and review every row that is not `provable` / `no_entries`.
4. **Check `showmigrations`:** the development database was at questionnaire 0010; if production is too, 0011 (grid connections) and **0012 (one inventory per year; flags legacy duplicates)** are also pending. 0013 itself is one nullable column.
5. Deploy the code and `migrate` (old code ignores the new column, so a rolling deploy is safe).
6. Run `freeze_applied_factors` (dry run), review the freeze / hold lists, then `freeze_applied_factors --apply`. **Only after this step may `seed_factors` run.** Proposed `build.sh` change, once the first run has been reviewed: add
   `python manage.py freeze_applied_factors --apply` between `migrate` and `seed_factors` (idempotent; holds any newly found problem). Not applied.
7. Re-run `report_factor_provenance`: every locked inventory is frozen or held. Smoke-test: sign an inventory, add a dashboard and a chat entry to the signed year, add a new factor row, edit an unrelated step, confirm nothing in the signed inventory moved.
8. Only then release factor changes.

**Rollback.** Before step 6: roll back the code and `migrate questionnaire 0012` (nothing is lost). After step 6: a schema rollback drops the maps and holds; restore them by re-running the freeze command (holds are recomputed) or from the backup.
A code rollback without a schema rollback is safe (the column is ignored), but then nothing is protected and no factor change may be made.

**Seed behaviour to expect:** a `seed_factors` run that changes the **value** of a factor row that any entry references now fails with a clear error (a correction must be a new row). Label-only changes pass (the approved label release is of this kind).

## 9. Remaining bypasses and unresolved risks

1. **PostgreSQL unverified** (§7).
2. **Raw SQL / DB console / restored dumps** can still change a factor value or an entry; detected by the audit, not prevented. No database trigger was built.
3. **Unproven provenance remains for calculated entries** of legacy inventories (`deploy_time`): the freeze is only as good as "nothing changed before deployment". Production must be audited first.
4. **A held inventory silently stops updating its entries** from new answers (the answer is saved; a history row is written). The user-facing message (EN + TR) is not designed; `emissions_not_counted: inventory_on_hold` is the only signal today.
5. **Previews** (`/api/emissions/calculate/`) show the newest row for a signed year (nothing is stored).
6. **Substitution of a requested factor row** by the recorded one is logged and visible in the response, but the UI does not explain it.
7. **Admin** factor-value edits fail with a server error page instead of a field message.
8. **Mixed rows already inside one inventory** (an earlier dashboard entry on another row of the same slug) are not unified; the earliest entry defines the pin.
9. **The gas split** is read live from factor rows; DR-11 and the split fields are not covered by the pins (DR-11 stays on hold).
10. **`backfill_calc_detail`** can still regenerate the text of entries of signed inventories (§3b).
11. **Report generation under pins** was not tested; `bulk_update()` of entries is not overridden; the chat HTTP views and the facility resync were not driven directly.
12. **Report 15** needs your decision (§5); the 21 sibling E2E inventories of the same company and year should be reviewed as test data.
13. **Cross-app coupling:** `emissions.models` calls into `questionnaire.applied_factors` (acceptable for review; to be tidied before merge).
14. **Other people's uncommitted changes** are in the working tree (listed above).

## 10. What I need from you

Approval or changes for: the hold semantics; the report 15 procedure (and whether it is test data); adding the freeze to `build.sh`; the bilingual message for held inventories and substituted entries; a PostgreSQL
instance or credential to finish §7; and whether to apply the DR-19 diff to the repository as a branch for review.
