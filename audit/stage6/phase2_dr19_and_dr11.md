> **Superseded for DR-19 by `audit/stage6/hardening/` (the earlier prototype folder `tools/dr19_prototype/` was replaced by it).** DR-11 and the label release parts of this file remain current.

# Stage 6 review package: label release, DR-19 (isolated implementation), DR-11 hold

Scope kept: **label text only** is applied to the repository. DR-19 exists only in an isolated copy (scratchpad, own test databases, no `.env`);
DR-11 is a decision note. No factor value, historical inventory, production migration, commit, push or deploy. The development database is unchanged
(SHA-256 `5141121f64495ba36cf3035b1a86c65a7776c07342e201e8a36a9eface64be32` before and after).

## 1. Label-only release (applied)

* **Diff:** `label_release.diff` (26 `reference` strings in `emissions/seed_data.py`, one bilingual note block in `questionnaire/iso_report_pdf.py`). New files: `emissions/test_label_only_release.py`, `emissions/seed_non_label_baseline.json`, `emissions/seed_references_before.json`. Edited tests: `emissions/test_factor_provenance.py` (three label tests moved from expected failure to passing).
* **Complete before/after list with evidence:** `label_changes.md` / `label_changes.csv` (26 rows).
* **R-404A, as you asked:** stored value stays **3,922**; the label now says it is the IPCC AR4 blend, that your 2023 document uses the DEFRA 2023 blend value 3,943, that the AR6 components compute to about 4,728, and that it is not an AR6 value.
* **Not touched:** `source` (it feeds the year mapping), `year`, `unit`, `slug`, `factor_kg_co2e`, flags, gas splits, `gas_split_data.py`.
* **Proof that nothing calculated moved** (`emissions/test_label_only_release.py`, 9 tests): every non-label field of all 236 seeded factors equals the frozen pre-release baseline; exactly the 26 approved rows changed their label and only that; re-seeding the new labels over a database seeded with the old ones updates rows in place (same ids, values, per-gas splits, no row added); **`pick_factor` returns the same row for every slug, country and 8 reference years (2005 to 2030)**; the calculator returns identical numbers; existing entries keep their kg, value snapshot and source snapshot, a re-save recomputes the same kg, and the company year total is identical; 10,000 m³ = 20,200 kg still holds.
* **Deferred, with the reason:** the `source` display for clinker, SF₆ and the spend-based rows (changing it would change the year mapping and create new rows); DR-12 bioenergy (its label already states its boundary and I have no evidence to correct it); DR-03 diesel labels; landfill categories; R-407C and R-432A (not verified); the generic "GHG Protocol – Cat N estimate" rows beyond the three DR-15 slugs.

## 2. DR-19 in an isolated copy

Files: `tools/dr19_prototype/` (`dr19_modified_files.diff` for 7 existing files: +128/−7 lines; new `applied_factors.py`, migration `0013`, two management commands, `test_dr19.py`; `apply_prototype_to_a_copy.py` rebuilds the copy).

### 2.1 What changed from the first prototype, against your gaps

| Your gap | Implementation | Test |
|---|---|---|
| Freeze at **every** path that sets COMPLETED | `post_save` on `CarbonReport` (covers the final-question `save()`, admin and scripts); explicit calls in the sign-off `_track_signature` and in `reset_session` (which uses `queryset.update`); a **pre-change freeze** in front of every factor create / change / withdraw (`freeze_slug`, the `freeze_applied_connection` pattern), which also protects a lock made by a bare `update()`; lazy freeze from the inventory's own entries as the last net; and a deploy command | `LockPaths` (5 tests) |
| No in-place edit through ordinary saves, `bulk_update()` and other write paths | `EmissionFactor.save()`, `QuerySet.update()` and `bulk_update()` refuse to change `factor_kg_co2e` of a row any entry references (a correction is a new row); `PROTECT` already blocks deleting a referenced row; `update()` / `bulk_update()` of `is_active` / `is_default` freeze first | `FactorWriteGuards` (5 tests) |
| **Unavoidable bypass** | Raw SQL / DB console cannot be intercepted by the application. It is made **detectable**: `report_factor_provenance` flags entries whose factor row no longer equals the entry's own value snapshot (`RECORD_INCONSISTENT_REVIEW`). A database trigger would be the preventive control (not built; backend-specific). Django admin uses `save()`, so it is guarded. | `test_raw_sql_is_the_unavoidable_bypass_and_it_is_detected` |
| Do not silently pin today's factor as historical truth | Every pin carries a **provenance**: `entry` (an approved entry references it: proven), `entry_value_drift`, `lock`, `factor_change`, `repriced`, and the two **unproven** ones, `deploy_time` and `first_use_unverified`. The deploy command stores legacy freezes as `deploy_time`; nothing is called proven that is not. | `LegacyProvenance` (6 tests) |
| Read-only legacy report | `manage.py report_factor_provenance` (section 3) | tested incl. "writes nothing" |
| Explicit re-pricing records reason, actor, time, previous map, previous entries and totals, new map, new totals; preserves the previous result; flags edited after signing | `reprice_inventory` in one transaction; history row `inventory_repriced` holds all of those (`reason`, `actor`, `actor_id`, `at`, `previous_factor_map`, `new_factor_map`, `before_entries`, `after_entries`, `before_total_kg`, `after_total_kg`, `moved`); sets `edited_after_signing_at` when a signed total moves; refused for drafts and without a reason | `Reprice` (4 tests) |
| Draft, signed, completed, legacy, concurrent, rollback, migration | all present, below | |

Also covered, because it is a second rebuild path: the **Workspace sync** (`_sync_workspace_to_emission_entries`) now runs inside the same pinning context.

### 2.2 Test results

* DR-19 file: **34 tests, OK**. Negative controls: with the pins disabled **13 tests fail** (all locked-inventory scenarios); with the write guards disabled the 3 guard tests fail; with both on, all pass.
* Full suite of the isolated copy (the final code): **870 tests, OK, expected failures = 10**; the code is identical to the diff delivered.
* Scenarios exercised: draft follows newest · signed + same-year row + unrelated edit · completed-but-unsigned · quantity change · later-year row · new activity · withdrawn row · `resync_inventory` · edited-then-re-signed · Workspace sync · final-question / sign-off / reset / bare-`update()` lock paths · legacy unfrozen inventory with and without a prior factor change · in-place edit via `save()`, `update()`, `bulk_update()`, delete, raw SQL · explicit re-price (audited, rolled back on failure, no-op case) · two stale writers · parallel merge threads · migration backward/forward.

### 2.3 Migration, rollback, concurrency, backend limits

* **Migration:** `0013` adds one nullable JSON column (nullable for the same rolling-deploy reason as `applied_grid_connections`). Forward, backward (to 0012) and forward again were run **on a copy of the development database**: 32 reports and 5 locked inventories before and after; the neighbouring column survived; the dropped map re-creates empty (re-run the freeze command). `makemigrations --check` reports no drift. **Finding:** the development database was only migrated to `questionnaire` 0010, so applying 0011 to 0013 to it also applied Stage 2's migration 0012, which flagged **24 inventories as legacy duplicates**.
* **Rollback:** the code must not be rolled back while the column is in use unless it tolerates a missing column; schema rollback loses the maps (recoverable with the deploy command only for direct entries; underlying-factor provenance is lost). A failed `reprice_inventory` rolls back map, entries and history (tested).
* **Concurrency:** pins are merged under a row lock and an existing pin is never overwritten, so two writers cannot undo each other (tested with deterministic stale-writer interleavings and 4 real threads × 6 merges on SQLite's shared in-memory test database). **`SELECT … FOR UPDATE` semantics are PostgreSQL behaviour and were not tested; SQLite serialises writers instead.**
* **PostgreSQL: not tested.** Nothing in the code is backend-specific, but that is an inference.

## 3. Read-only report: legacy inventories with unprovable factor provenance

Command: `manage.py report_factor_provenance --csv … --steps-csv …` (writes nothing; a test asserts the report row and `updated_at` are unchanged). It re-runs each locked inventory's own calculation and compares it with the approved entries; a step that still differs when every factor row the entries themselves reference is held is one whose price depends on a factor that is recorded nowhere (supplier factor, declaration, reporting-category entries) and no longer reproduces.

Run on a **copy of the development database** (`legacy_provenance_report.csv`, `legacy_provenance_steps.csv`): 5 signed/completed inventories.

| Report | Company / year | Approved entries | Verdict |
|---|---|---|---|
| 28 | 3 / 2025 | 19 (26,856,253.81 kg; 11 calculated) | **provable**: today's factors reproduce every stored figure |
| 31 | 4 / 2025 | 16 (388,669.34 kg; 6 calculated) | **provable** |
| 6, 8 | 1 / 2024 | 0 | no entries |
| **15** | 1 / 2024 | 0 | **ENTRIES_MISSING_REVIEW**: it holds saved answers that would create **258,690.91 kg** across 11 steps on its next save, although it has no entries on record. Not a factor-provenance problem; a signed inventory whose figures are absent. |

No inventory was found whose recorded figure already differs from today's factors (`UNPROVABLE_REVIEW`: 0), and none with value drift or a kg/snapshot mismatch. Caveats: this is the development data only (QA-test answers), not production; "provable" means *reproducible today*, which is proof the freeze would record the original basis only because nothing has changed yet; **the freeze must run before any new factor row is added**. Reports 6, 8, 15 are three signed inventories for company 1 / 2024 (Stage 2 duplicates).

## 4. DR-11: hold

`dr11_decision_note.md` separates the methane value and fossil / non-fossil classification (29.8 vs 27.0 vs 27.9, with the GHG Protocol instruction that combustion methane takes the non-fossil value), the IPCC sector tier by fuel (Tables 2.2 to 2.5, retrieved), and the effect on the printed table and disclosure. Measured gas table: `dr11_gas_table.csv`, `dr11_gas_shares_per_factor.csv`. No value was changed.

## 5. Unresolved risks

1. **Calculated entries of legacy inventories:** their underlying factor row is recorded nowhere. The deploy freeze records today's row (`deploy_time`, unproven). In the development data they reproduce, but only the production run of the report can say.
2. **Run order:** the deploy freeze must happen before any new or changed factor row; otherwise the underlying factor of calculated entries can already have moved.
3. **Raw SQL / DB console edits** cannot be prevented, only detected.
4. **Other paths that create entries in a locked year** (dashboard form, AI chat) were not put under the pins; a new entry on a slug an inventory already holds would use the newest row. Not tested or changed.
5. **The gas split** is read live from factor rows; a DR-11 change would alter printed gas columns of signed reports unless the split is pinned too (DR-19 does not cover it).
6. **Future seed runs:** a numeric release that edits a referenced row in `seed_data.py` will now be refused; numeric corrections must be new-year rows, which is the intended control but changes how `seed_factors` is used.
7. **Cross-app coupling** in the prototype (`emissions.models` calls into `questionnaire.applied_factors`); acceptable for review, to be tidied before merge.
8. **Report 15** (signed inventory with answers but no entries) needs a decision independent of DR-19.
9. PostgreSQL, a running server and a browser were not exercised.

## 6. Verification of the repository

See the final section appended after the last run.

| Run | Result |
|---|---|
| **Repository** (label release only), full suite | **837 tests, OK, expected failures = 10** → 827 passed, 0 failed, 0 errors (no skipped count reported). Before Stage 6: 828 tests / 13 expected failures. |
| Development database SHA-256 | `5141121f64495ba36cf3035b1a86c65a7776c07342e201e8a36a9eface64be32`, **unchanged** |
| `makemigrations --check` on the repository | No changes detected (no migration was added to the repository) |
| Isolated copy with DR-19 (final code) | **870 tests, OK, expected failures = 10**; DR-19 file alone 34 tests |
| PostgreSQL | **not tested** |
