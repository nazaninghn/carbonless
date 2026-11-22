# Carbonless: safety and impact review of PR #149 / #150, the 48 unresolved mappings and report issuance

Date: 2026-11-22. **Assessment only.** Nothing was modified, staged, committed, pushed or deployed; no factor, mapping, GWP, density, conversion, formula, report or configuration was changed; neither PR was reverted or amended; no production access. The working tree is clean.

Companion workbook: `PR149_150_impact_and_unresolved_register.xlsx` (sheet *PR 149-150 impact register*, 19 items; sheet *Unresolved mappings (48)*, one row per mapping).

The six policies in the request are used below as **proposed policy for analysis** (P1–P6), not as authorization.

## 0. Two things to know before reading

1. **CD-57.7 and CD-62 are not in the project.** I searched every text, CSV, JSON and code file in the repository, including `audit/`, `.carbon/specs/` and `memory/`: there is no "CD-" reference of any kind. I therefore compare current behaviour with policies P5 and P6 as you wrote them, which I take to be their substance. If the CD texts say more, I need them.
2. **Whether the merged rows are live in production is not verified.** `build.sh` on `main` runs both seed commands and the README names `./build.sh` as the build command, so a deployment of `main` loads them. I have no production access and did not check.

## 1. PR #149 and #150: what they introduced

Commits: `f53509f` and `424df3b` (PR #149), `6798b33` (PR #150). 54 files, of which two data files hold the factors. The full item list with evidence is the impact register (I-01 to I-19); the points that matter:

| Item | Introduced | Against the register / owner evidence |
|---|---|---|
| I-01 | 1,712 DEFRA rows (142 slugs, editions 2014–2026) | 48 slugs exact, 46 acceptable, **48 unresolved**; the unresolved ones run into DR-01, 03, 07, 09, 12, 13, 16, 17 |
| I-05, I-06 | 72 IPCC / GHG Protocol rows with two GWP sets | Owner documents use CH₄ 27.9, N₂O 273, SF₆ 25,200. Merged: 28 / 265 / 23,500 ("IPCC") and 27.0 / 273 / 24,300 ("GHG Protocol"). DR-02, DR-11 undecided |
| I-07, I-08 | "IPCC = AR5, GHG Protocol = AR6"; one IPCC sector tier for all companies; my choice of road and off-road rows | No source defines these; DR-11 undecided |
| I-09 | DEFRA 2026 net CV × density for six fuels inside 24 IPCC / GHG rows | The owner's formula uses the IPCC NCV with the density of the inventory-year edition. DR-03, 04, 05, 20 undecided |
| I-12 | New `standard` column; catalogue queries filtered to it. Touches `calculator.py`, `factor_lookup.py`, `models.py` | These are "do not touch" files; no per-item waiver was recorded (DR-21). **Catalogue values are unchanged**: `seed_data.py`, `gas_split_data.py` and `unit_converter.py` have no diff |
| I-13 | D1 now offers only the four standards and is the first, required question | See §1.2: this is the change with the widest reach |

### 1.1 What is selectable and used

Every merged row is `is_active`. None is `is_default`, so no catalogue list or form offers one. A row is consumed only when an inventory's D1 (or a Mix question) names its standard: then `pick_factor` selects it for every calculation path in §3.

### 1.2 Effect on existing and historical inventories

| Inventory | Effect |
|---|---|
| Signed, or completed | **None.** The existing immutability gate refuses any recalculation (`immutability.check_report`, called first by `sync_step_entries` and by the new `step-standard` endpoint). Stored entries keep their factor snapshot |
| Unsigned, D1 answered with a former option (DEFRA_TUIK, DEFRA, IPCC_AR6, EPA, custom) | **None unless D1 is edited.** It stays on the catalogue with the same numbers. If the user opens D1, only the four standards are offered; choosing one recalculates the whole inventory |
| Unsigned, D1 not yet answered | D1 now appears as a required unanswered question and can only be answered with a standard. Until then it stays on the catalogue; after, it is recalculated on the chosen standard |
| **Every new inventory** | Must choose one of the four standards as its first answer. **The audited catalogue can no longer be reached through the questionnaire for new work.** All new results therefore rest on the merged rows |
| Company-level chat and form entries (no inventory) | None: catalogue |

Not measured: how many inventories and entries are affected in production. That needs a read-only count there (inventories by D1 value and signed state; entries whose factor has a non-blank `standard`), which I have not done.

## 2. The 48 unresolved mappings

One row each in the workbook, with the DEFRA row and flat-file row/ID, unit, geography, the open point, the questions or chat activities that consume it, and a containment proposal. They do **not** carry the same risk:

| Risk now | Count | Slugs |
|---|---|---|
| **High**: reachable automatically and wrong by a large or unknown factor | 11 | `coal`, `flight-domestic`, `train`, `district-heating`, `steam`, `transmission-losses`, `truck-freight`, `flight-short-economy`, `flight-long-economy`, `flight-long-business`, `flight-long-first` |
| **Medium**: reachable; error bounded, or a method decision is open | 26 | `off-road-diesel-desnz`, `off-road-gasoline-desnz`, `gasoline-generic`, `fuel-extraction`, `air-freight`, `tm-04`, `tm-07`, `tm-07-short`, `tm-08`, `flight-short`, `flight-medium`, `flight-long`, `train-commute`, `general-landfill`, `wt-01-recycling`, `wt-03-recycling`, `wt-04-recycling`, `wt-10-landfill`, `landfill`, `truck-delivery`, `tm-04-ds`, `tm-07-ds`, `tm-07-short-ds`, `tm-08-ds`, `product-landfill`, `wood-pellets` |
| **Low**: reachable by a narrow path; small bounded error | 4 | `tm-05`, `road-travel`, `tm-05-ds`, `diesel-kwh` |
| **None now**: loaded, but no question or chat activity selects it | 7 | `on-road-petrol-desnz`, `flight-international`, `metro`, `train-travel`, `metro-commute`, `biodiesel`, `bioethanol` |

Three rows deserve separate mention because they are applied **without the user choosing them**:

- `transmission-losses` and `fuel-extraction` are generated by the Category 3 confirmation (K3C3-INFO) from the electricity and fuel already entered. In a DEFRA inventory they attach the UK grid loss factor to every non-UK kWh, and the diesel well-to-tank factor to every litre of diesel, fuel oil and LPG.
- `landfill` / `general-landfill` are chosen by company country when only a waste total is given (K3C5-2b).

Minimum containment differs accordingly: 41 rows need to be withheld from selection (the activity then stays "not calculated", which P5 allows); 7 need nothing now beyond staying on a hold list; 6 of the 41 have a specific better target once approved (`tm-04`, `tm-05` and their downstream twins to the size-class rows; `road-travel` to "Average car, Diesel"; `fuel-extraction` restricted to diesel).

## 3. Active calculation-path impact map

| Path | Entry point | Uses the inventory's standard? | Can consume a merged row? |
|---|---|---|---|
| Questionnaire step save | `SubmitStepView` → `sync_step_entries` → `_entry_specs` → `pick_factor` | Yes (and per question in Mix) | **Yes**: main path |
| Change of a Mix question's standard | `StepStandardView` → `sync_step_entries` | Yes | **Yes** |
| Recalculation after an admin electricity-factor approval, or a facility connection change | `resync_inventory`, `facility_sync` → `sync_step_entries` | Yes | **Yes** (unsigned inventories only) |
| AI chat message and confirm-entry | `chat/views.py` (`_chat_standard`) → `create_entry_from_activity` | Yes; Mix is refused | **Yes**, for entries joining a single-standard inventory |
| Scope 3 chat categories | `resolve_scope3_activity` → `resolve_factor_and_amount` | Yes when inside the chat request | **Yes** |
| Notes and assumptions | `uncalculated_notes`, `derive_assumptions` | Yes | Reads only |
| Workspace calculation | `workspace_views.py` line 133 | **No**: always the catalogue | No, but its figures can disagree with a standard inventory's total (I-19) |
| Dashboard manual entry form | factor list endpoint (`is_default` rows only) | n/a | Not offered. An entry posted with a merged row's id directly would be accepted (`is_active` is the only check) |
| Quick calculation by slug | `calculate_by_slug` → `get_emission_factor` | No: catalogue | No |

Downstream, every entry feeds the same readers: the summary endpoint and dashboard, the ISO 14064-1 PDF, the combined report, the quantified summary PDF and the CSV / Excel exports. None of them distinguishes an entry priced with an unresolved row from any other.

## 4. Report issuance

### 4.1 The existing paths

| Step | Where | Gate today |
|---|---|---|
| Draft export | `GET …/pdf/`, `…/iso-report/`, `…/combined-report/` (`questionnaire/views.py` 1636–1740) | None. `draft = status != COMPLETED` adds a DRAFT / TASLAK watermark |
| Completion without signature | step `7B-INFO` answered "done" (`views.py` ~955) | Required questions answered (`deferral.required_unanswered`) |
| Signature | step `7C-2` (`_track_signature`, `views.py` 354–372; gate ~898) | Signer is owner, admin or manager; required questions before the sign-off answered; `7C-1` says the inventory is ready (`deferral.required_before_signature`) |
| After signature | `immutability.py` | No further write |
| Conformity statement | `iso_report_pdf.py` 2092–2094 (EN), 2117 (TR): "Quantification and reporting have been carried out in accordance with ISO 14064-1:2018"; also 1886 and 2063 | **Printed unconditionally**, in drafts too |
| Exports | `emissions/export-csv/`, `export-all/`, `export-excel/`, `emissions/report/` | Not traced in detail in this review |

### 4.2 Can unresolved factors appear in a final report?

**Yes.** Neither the completion gate nor the signature gate looks at how any amount was priced, at amounts that are "not calculated", or at any framework requirement. Specifically:

- An inventory priced with any of the 41 reachable unresolved rows, or with the IPCC / GHG rows, can be signed. Its figures print as ordinary figures.
- An inventory with required sources marked "not calculated" can be signed. The gaps are listed among the report's assumptions, but they do not stop issuance.
- A completed-but-unsigned inventory loses the DRAFT watermark although nobody has signed it.
- The conformity sentence is printed whatever the state.
- For a DEFRA or "IPCC" inventory the report states an AR6 GWP basis that the numbers do not have.

### 4.3 Against the proposed policies

| Policy | Current behaviour | Verdict |
|---|---|---|
| P5: entry and completion continue when a factor is unavailable, explicitly marked not calculated | Entry continues; since PR #150 a note is produced for every source the standard lacks (`_standard_notes`), in the wizard and in the report's assumptions | **Met**, with one wording gap: a *withheld* row would currently read "the standard publishes no factor", which would be untrue |
| P6: no final signed or conformity-claiming report while required calculations or mandatory framework requirements are unmet | No such gate exists; the conformity statement is unconditional | **Not met** |

### 4.4 Proposed distinction (design only)

| | Draft output | Final issued report |
|---|---|---|
| When | Any time | Only after a pre-issuance check passes and an authorised person signs |
| Marking | DRAFT watermark; a front-page list of open items | No watermark; signature block |
| Gaps | Disclosed: not-calculated amounts, provisional factors, undecided framework items | None of the blocking kinds below |
| Conformity statement | Replaced by "prepared towards ISO 14064-1; not a conformity statement" | Printed only here |
| GWP / factor basis | The inventory's actual profile | Same, frozen at signing |

Blocking conditions for final issuance (each to be approved before it is built): a required in-boundary source is "not calculated" without a recorded, permitted exclusion; any entry is priced with a row that is not approved (unresolved mapping, provisional profile); the inventory's framework profile or GWP set is not approved; a mandatory framework disclosure is missing. "Completed, unsigned" should count as draft. The signature step (`7C-2`) is the natural place for the check, returning the blockers bilingually; this needs to be reconciled with the "hold" concept of the DR-19 hardening work, which exists only in an isolated copy.

## 5. Prioritized containment proposal

Nothing here has been done. Each step needs your approval; steps 2–4 change data or code.

| Priority | Proposal | Kind | Effect and caveat |
|---|---|---|---|
| 1 | **Instruction, no system change:** until step 3 exists, do not sign or issue any inventory whose D1 is IPCC, GHG Protocol or Mix, nor a DEFRA inventory that uses any High or Medium row | Operational | Immediate; relies on people |
| 2 | **Measure exposure:** a read-only count in production of inventories by D1 value and signed state, and of entries whose factor has a non-blank standard | Read-only | Tells whether anything has already been calculated or signed on the merged rows |
| 3 | **Withhold the 41 reachable unresolved DEFRA rows** (all editions) and decide the fate of the 72 IPCC / GHG rows (withhold, or keep visibly provisional) | Data state, reversible | The activities become "not calculated" in those inventories. Unsigned inventories already priced with them change at their next recalculation. Needs a truthful note text ("mapping under review") instead of "publishes no factor" |
| 4 | **Final-issuance gate and draft / final distinction** (§4.4), including the conformity sentence and the GWP statement | Code + report text | Closes P6 |
| 5 | **Decide whether new inventories can still be calculated on the audited catalogue** | Owner decision, then code | Today they cannot (§1.2) |
| 6 | Profiles, GWP sets, density table, mapping classes (earlier assessment §6), then re-approval of rows one by one | Design, then data | Lets withheld rows return individually |

## 6. Decisions still required from you

1. **CD-57.7 and CD-62:** please supply the texts, or confirm P5 and P6 state them in full.
2. **Step 1 instruction:** do you issue it now, and does it cover completed-but-unsigned inventories?
3. **Step 2:** who runs the production count? I cannot.
4. **Step 3 scope:** withhold all 41 reachable rows, or only the 11 High ones first? Withhold the IPCC and GHG Protocol rows entirely, or keep them selectable but provisional?
5. **Already-priced unsigned inventories:** leave them until their next recalculation, or recalculate them deliberately once rows are withheld?
6. **Catalogue for new inventories:** should a "platform catalogue" choice exist again beside the four standards?
7. **P6 blockers:** which of the four blocking conditions in §4.4 apply, and what counts as a "required" calculation (every in-boundary source, or only those the chosen framework mandates)?
8. **Completed, unsigned:** draft or final?
9. **Conformity sentence in drafts:** remove, or reword as proposed?
10. The open register items the unresolved rows depend on: DR-01, DR-03, DR-07, DR-09, DR-12, DR-13, DR-16, DR-17 (mappings) and DR-02a, DR-05, DR-11, DR-20 (GWP, density, method year).

**Stopped here for approval.**
