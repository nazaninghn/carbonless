# Stage 5 decision register v2 (for final approval before Stage 6)

**Status: PROPOSED. Nothing here has been applied.** No factor value, recalculation, migration, commit, push or deploy was done. The only
things created in this step are audit files, plus one throw-away test (`stage6/tools/probe_factor_change_propagation.py`, run in a
disposable test database and then moved out of the code base). The v1 register (`decision_register.md`) stays as the evidence record.

Date: 2026-10-23. Machine-readable twin: `decision_register_v2.csv`.

> **Corrections found while implementing Phase 1 (2026-10-23).**
> 1. DR-02b: the stored R-404A value is **3,922** (the IPCC AR4 blend), not 3,943. 3,943 is the DEFRA 2023 blend value in your 2023 document (the stored value is 0.53% below it). The text below that says "keep 3,943" should read "keep the stored 3,922 and label it AR4".
> 2. DR-11: 29.8 is the AR6 *fossil* methane value, which the GHG Protocol reserves for fossil-fuel **fugitive** and process methane. Its own instructions (retrieved, `GHGProtocol_GWP_values_v2_Aug2024.pdf`) say combustion methane "should use the Methane - non-fossil GWP value" (27.0). Your documents use 27.9. So 29.8 is not an arithmetic error; the choice is among 29.8 / 27.9 / 27.0. Measured effect: `audit/stage6/dr11_gas_table.csv`.
> 3. The "Release C" controls (DR-19) were prototyped in an isolated copy and are described in `audit/stage6/phase2_dr19_and_dr11.md`.

## 0. How to read this

Each item has: **change type**, an **exact proposed decision**, the **impact before/after** on the disposable copy of the dev database
(27,621,670 kg approved, 95% one clinker entry), the **treatment of signed/approved inventories**, and the **regression tests** that would
accompany it. Your six directions are applied as follows.

| Change type | Meaning | Needs |
|---|---|---|
| **LABEL** | the text a report prints about a factor changes; no number moves | approval of the wording (EN + TR) |
| **NUMERIC** | a factor value, GWP, or conversion changes | approval **and** a written waiver of CLAUDE.md hard rule 1 for that item |
| **NEW-ROW** | a new slug/unit/year row is added; existing rows untouched | approval; hard rule 1 ("never change units or slugs") is not broken because nothing existing changes, but I flag it |
| **METHOD / BOUNDARY** | which method, year or boundary applies | owner decision, documented |
| **CODE** | application code or schema | approval; separate from the factor changes |
| **HISTORICAL** | would alter a stored or signed result | **never proposed**; listed only where a choice could cause it by accident |

**Proposed global rule (DR-19 / DR-20 below): no in-place edit of any factor value.** Every numeric change is a new row with a new effective
year, a `source`, `reference` and approval note. Existing rows, `factor_value_snapshot` on entries, and signed inventories are untouched.

## 1. The decisions you named

### DR-01 Truck freight: tonne-km and vehicle-km are separate methods

* **Type:** NEW-ROW + METHOD (mapping). No existing row changes value.
* **Finding that drives it.** The stored `truck-freight` (Turkey) 0.823134 is the DEFRA 2023 *All rigids, average laden, per vehicle-km* figure (0.8231341248, confirmed). It is stored per tonne-km, so 1,000 tkm = 823 kg for a Turkish company against 112 kg for a German one. DESNZ publishes the tonne-km set separately: All HGVs average laden **0.09695746711 (2023), 0.09752 (2024), 0.10163 (2025)**; per vehicle-km rigids **0.8231341248 (2023), 0.82657 (2024), 0.83751 (2025)**.
* **Exact proposal.**
  1. Leave the existing `truck-freight` rows exactly as they are. Mark them `is_default=False` only if you approve (it is reached today only by the chat/dashboard form; no entry in existing data uses it).
  2. Add `truck-freight-tkm` (unit tonne-km) with the DESNZ All HGVs average-laden values for 2023, 2024, 2025 above, source "DESNZ/DEFRA conversion factors, Freighting goods, HGV (all diesel), average laden", global and Turkey.
  3. Add `truck-freight-vkm` (unit vehicle-km) with the rigids average-laden per-vehicle-km values for 2023, 2024, 2025 above.
  4. Routing (a change in the factor/unit map, so it needs your explicit approval): activity in *tonne-km* → `-tkm`; activity in *km* with no weight → `-vkm`. **No conversion between them**; a quantity entered in one unit is never reinterpreted as the other. If a weight is missing the entry stays "not calculated — no factor" rather than guessing.
  5. Applicability statement stored with each row: tkm for goods with a stated weight; vkm for a vehicle-distance basis (your 2023 document); the UK average laden HGV mix is applied to Turkish operations as in your 2024 sheet.
* **Impact:** existing data 0 kg. A new 1,000 tkm entry (Turkey): 823 kg now → 97.5 kg (2024 row).
* **Signed inventories:** none contain it; unaffected by construction (new slugs).
* **Tests:** 1,000 tkm 2024 → 97.52 kg; 1,000 vkm 2024 → 826.57 kg; km never converted to tkm; the old row still returns 0.823134; the Stage 5 `expectedFailure` for DR-01 flips to a pass.

### DR-02 Refrigerant GWPs: state the basis, then align per gas

* **Type:** NUMERIC (new year rows) + LABEL. HISTORICAL excluded.
* **Primary-source finding (new, verified).** IPCC AR6 WG1 Ch.7 Supplementary Table 7.SM.7, GWP-100: HFC-32 **771**, HFC-125 **3740**, HFC-134a **1530**, HFC-143a **5810**, HFC-227ea **3600**, HCFC-22 **1960**, HFC-23 14600, HFC-152a 164, SF₆ **25,200**, CH₄ 27.9, N₂O 273. Blends are not tabulated; R410A (50/50 R32/R125) computes to **2255.5**, which matches your documents. SHA-256 in `evidence/SHA256SUMS_AR6.txt`.
* **Exact proposal.**
  1. Declare the platform basis as **IPCC AR6 WG1 (100-year)**, citing Table 7.SM.7 (and 7.15 where the gas is there), and print it on the ISO report. Today the report already says AR6 while four stored values are not AR6 (1430, 675, 1810, 2088 are AR4-era).
  2. Add year rows (effective for inventory year **≥ the year you name**, default 2025 because the 2024 file is the first to use these) with: R134a 1530, R32 771, R22 1960, R410A 2255.5, HFC-227ea 3600. Each value is per refrigerant and internally consistent with the table above.
  3. **SF₆ (DR-02a):** keep **25,200** (equals the stored value and the primary table). Your 2024 file uses 23,500, which is the AR5 value labelled AR6; the GHG Protocol AR6 column shows 24,300, which conflicts with the primary table. *Your choice:* (i) keep 25,200, relabel only [recommended] or (ii) add a 2024 row at 23,500 labelled AR5 to reproduce the 2024 file.
  4. **R404A (DR-02b):** do not change the stored value, **3,922** (the IPCC AR4 blend). 3,943 is the different DEFRA 2023 blend value in your 2023 document (stored is 0.53% below it), and the AR6 components compute to about 4,728. The label now says exactly that (Phase 1, applied). Your 2024 file does not list R404A, so no 2024+ value is documented: evidence request, not a default.
  5. R407C, R432A, R600a: not in your documents beyond R600a = 3 (DEFRA 2023): label only until evidence.
  6. 2023-document values are **not** assumed for 2024+; each new row carries its own source cell.
* **Impact:** existing data 0 kg. Per 100 kg leaked: R134a +10.0 t, R32 +9.6 t, R22 +15.0 t, R410A +16.8 t (CO₂e). HFC-227ea +250 per kg.
* **Signed inventories:** untouched (new rows apply only to years ≥ effective year; entries keep `factor_value_snapshot`).
* **Tests:** table-driven GWP equality for each gas; R410A = 0.5·771 + 0.5·3740; an inventory dated before the effective year still picks the old row; SF₆ unchanged.

### DR-05 Natural gas per m³

* **Type:** LABEL now; NUMERIC/METHOD only on your explicit choice.
* **Facts.** 2.02 is not a DESNZ 2024 value (DESNZ 2024 = 2.04542; DEFRA 2020 = 2.02266, which rounds to the stored value). Your 2023 method gives **2.14288** (density 0.795, DEFRA 2023, ×IPCC EF/NCV with AR6 CH₄/N₂O), your 2024 method **1.91242** (0.7095 kg/Sm³).
* **Exact proposal.**
  1. **Now (LABEL):** stop printing "DEFRA 2024 – 2.02". Print "fixed per-m³ value adopted by the platform (matches the DEFRA 2020 figure 2.02266, rounded); not a DEFRA 2024 factor; approval status: <your entry>". EN + TR. The value stays 2.02 and the 20,200 kg guard holds.
  2. **Later (METHOD, only if you approve):** add parameter-based rows per documented method: *2023 method* 2.14288 and *2024 method* 1.91242, each stored with its density, EF, NCV and GWP inputs, selected by the inventory's declared method year. This needs a written amendment of the 20,200 kg regression guard for those years, because 10,000 m³ would no longer equal 20,200 kg.
* **Impact (if step 2):** 4 entries, 125,240 kg: **+7,619 kg (+6.1%)** at 2.14288 or **−6,670 kg (−5.3%)** at 1.91242. Step 1: 0.
* **Signed inventories:** untouched; new method applies only to inventories you declare.
* **Tests:** step 1: `reference` text no longer contains "DEFRA 2024" and the guard 10,000 m³ = 20,200 kg passes. Step 2: both methods reproduce the cell values to ≤0.05%; the 2.02 row still resolves for inventories without a declared method.

### DR-06 Turkish electricity: preserve both documented methods

* **Type:** METHOD (documentation) + LABEL. **No numeric change. HISTORICAL excluded.**
* **Facts.** 2023 inventory: IEA 0.4183 + 0.0001 + 0.0015 = **0.4199**, with T&D = **15% of Scope 2** (sheet Ktg6). 2024 inventory: **ETKB consumption-point factor** (0.478 t/MWh, ETKB reference 12). I searched every sheet of the 2024 file (INDEX, hesaplamalar, GHG SONUC, ISO 14064_sonuc and others) for a T&D line: **there is none**. ETKB's form does not state whether losses are included.
* **Exact proposal.**
  1. Keep `turkey-grid` 0.4199 as the **2023-method** factor and the ETKB connection-point factors (0.436 / 0.469) as the **2024-method** factors. Add a `method` text to each: "IEA 2023 + separate T&D" vs "ETKB consumption point".
  2. Do not re-base legacy entries (2 entries, 25,194 kg). Re-basing would be +11.7% (distribution) or +3.8% (transmission): a methodology change, not a correction.
  3. **T&D unchanged** (`transmission-losses` 0.02 per kWh). Do not remove it and do not raise it to 15%, because the sources do not establish either: the 15% rule is a 2023 inventory choice, and the 2024 file shows no T&D line without saying why.
  4. Evidence request: ETKB's statement of whether the consumption-point factor includes T&D, and whether the 2023 15% rule was retained or dropped in 2024.
* **Impact:** 0. Reference only: applying 15% to the 4 existing T&D entries would be +33,098 kg (15,400 → 48,498).
* **Signed inventories:** untouched.
* **Tests:** 50,000 kWh legacy → 20,995 kg still passes; method text present; a 2023-method inventory and a 2024-method inventory pick different rows.

## 2. Remaining numeric/method items

### DR-03 Off-road diesel per litre (`off-road-diesel-desnz`, `on-road-diesel-desnz`)
* **Type:** NUMERIC (new year row). **Proposal:** new rows from the documented formula: off-road **2.93742** (2023 parameters) and **2.92742** (2024 parameters); on-road 2.69569 / 2.68651. Apply 2.92742 for inventory years ≥ the effective year you name; leave 3.17939 for earlier years. The on-road DESNZ row is not used by the engine (`motorin-mobile` is), so it is a label/consistency fix only.
* **Impact:** none in existing data. A 1,000 L off-road entry: 3,179 kg → 2,927 kg (−252 kg, −7.9%). (Stored is 8.2–8.6% above the documented value.)
* **Open fact:** where 3.17939 came from is not established (nearest published: DESNZ fuel oil 3.17493).
* **Signed inventories:** untouched. **Tests:** formula test (IPCC EF × NCV × density × 10⁻⁶) reproduces both values; old row still returns 3.17939 for earlier years.

### DR-04 LPG per litre
* **Type:** NUMERIC (new year row), **hold until you confirm the year basis.** Documented 1.58652 (IPCC × NCV 47.3 × DEFRA 2023 density 531.098); stored 1.51468 implies density ≈0.507 kg/L, which matches neither edition. I found no 2024-parameter LPG value, so **I propose 1.58652 only for 2023-method inventories** and an evidence request for 2024+.
* **Impact:** 1 entry: 151.5 → 158.7 kg (+7.2 kg, +4.7%). **Signed:** untouched. **Tests:** reproduce 1.58652 within 0.05%.

### DR-07 Negative recycling credits (MDR-S4-01)
* **Type:** METHOD. **Proposal: no change.** Option A with the existing disclosure stays until you decide A–E; your documented method (positive DEFRA treatment factors, no netting) is evidence for Option C/E but not an approval. Provenance of EF-K3A-003/005/006 is still missing. **Impact:** 0 (no entry uses them). **Tests:** the existing guard (exactly three negative factors) stays.

### DR-08 Cement clinker (label "IPCC 2006")
* **Type:** LABEL now; NUMERIC only on request. IPCC 2006 Eq. 2.4 gives **520**; 525 is the cement-industry protocol default, which is secondary evidence and not in your documents. **Proposal:** relabel as "cement-industry protocol default (525); IPCC 2006 Eq. 2.4 gives 520" and keep the value. If you choose 520: 1 entry, 26,250,000 → 26,000,000 kg (**−250,000 kg, −0.95%**), applied to new inventories only. **Tests:** label text; value unchanged.

### DR-09 Flights and radiative forcing
* **Type:** METHOD/BOUNDARY. **Proposal: no value change.** Your documented practice is "without RF" (short-haul 0.10794/pkm). Decide whether the platform follows that, offers both, or keeps RFI 1.9. Label the 2.9 cabin multiplier "no source found". **Impact:** 0 in existing data.

### DR-10 Spend-based factors
* **Type:** LABEL + evidence request. Your documented spend factors (0.4995, 0.0927, 1.5563) come from a "USD Emission Factors" table (rows 115/305/389) that was not provided; the DESNZ 2024 workbook has none. **Proposal:** relabel the five catalog values "unsourced estimate" and request the table. **Impact:** 0.

### DR-11 Gas-split GWP and sector tier
* **Type:** NUMERIC (gas columns only) + METHOD. **Totals unchanged by construction.** Stored constant CH₄ **29.8** (the AR6 *fossil* CH₄ value in Table 7.15); your documents and Table 7.SM.7 use **27.9**. Tier: stored commercial (5 / 10 kg/TJ) vs your manufacturing tier (1 / 3).
* **Proposal:** (a) CH₄ = 27.9, N₂O = 273 in `gas_split_data` for AR6-basis rows (a GWP-math edit, so a rule-1 waiver is required); (b) tier by declared sector, only if you approve; otherwise keep and label "commercial tier".
* **Impact:** CH₄ column falls by 6.4% (27.9/29.8) on affected rows, about 0.06 t on the Stage 3 inventory per v1. **I have not yet run the before/after of the whole ISO gas table; it will be produced on a disposable copy in Stage 6 before anything is applied.** **Tests:** sum of gas columns == total for every row; CH₄ constant equals 27.9.

### DR-12 Bioenergy (biodiesel, bioethanol, wood pellets)
* **Type:** BOUNDARY. Stored 0.03639 / 0.02719 / 0.01553 vs the DESNZ 2024 rows the catalog cites, 0.16751 / 0.00901 / 0.05434. The differences go in both directions (4.6×, 0.33×, 3.5×), which suggests different boundaries (e.g. fossil-only vs total), but I did not verify that. **Proposal: hold, no value change.** Relabel "differs from the cited row; boundary not stated" and ask you to state the intended boundary; the numeric choice follows from that. **Impact:** 0 in existing data.

### DR-13 Landfill factors
* **Type:** LABEL + NUMERIC for one row. **Proposal:** (a) state the waste category each factor represents (label); (b) `wt-01-landfill` (paper) → **1.16439** (DEFRA 2024 paper landfill, documented): 1 entry 6.5 → 5.9 kg (−0.6 kg); (c) `general-landfill` 0.57 and `landfill` (Turkey) 0.54: **hold** until the category is declared (household 0.49704: −12.8%, 1 entry 1,140 → 994 kg; C&I 0.52033: → 1,041 kg). Existing/signed: untouched; applies to new rows by year.

### DR-16 `on-road-petrol-desnz` 2.30233 (documented 2.35027, −2.0%) and DR-17 `diesel-kwh` 0.24882 (cited row 0.25649, −3.0%)
* **Type:** LABEL. **Proposal: no value change.** DR-16 is registered only (engine uses `gasoline-generic` 2.31). Relabel both "does not equal the row it names (−2.0% / −3.0%)". **Impact:** 0. A numeric alignment can be added later as new year rows if you want it.

## 3. Label-only items

| ID | Item | Exact proposed change | Number moves? |
|---|---|---|---|
| DR-15 | `fuel-extraction`, `diesel-generic`, `gasoline-generic`, `product-fuel-use`, `car-commute`, `taxi`, `vehicle-km`, `off-road-gasoline-desnz` | replace "GHG Protocol / generic / DESNZ" with a statement of what the value matches (e.g. WTT diesel 0.61101, −1.8%) | No |
| DR-18 | `ferry-travel` 0.019 | "foot-passenger value (0.01871)", not "average" (0.1127) | No |
| DR-05, DR-08, DR-16, DR-17 | see above | see above | No |

## 4. Evidence requests (class D; nothing to approve)

Unchanged from v1 §3 (149 unresolved rows, DR-14): the CarbonIQ EF catalogue (39 rows), the USD Emission Factors table, ETKB 2024/2025 editions, the IEA table, the GLEC primary, IPCC rows for coal/fuel oil/process factors, the 10 DEFRA 2024 rows not matched to a DESNZ row.

## 5. Decisions I found that you did not list

| ID | Type | Decision needed | Proposal |
|---|---|---|---|
| **DR-19** | CODE (schema/service) | **Factor version control for signed inventories.** The probe (§6) shows signed inventories are exposed to factor changes. | Approve a design in which every factor change is a new row and entries for a *locked* inventory keep their recorded factor on rebuild. Detail in §6. |
| **DR-20** | METHOD | **Method-year rule.** `pick_factor` takes the latest default row with year ≤ the inventory year. DR-05 and DR-06 need "this inventory uses the 2023 method or the 2024 method". | Add a `method` tag and select by tag when set, else by year (unchanged behaviour). |
| **DR-21** | Policy | **Waiver of hard rule 1 and the regression guards, per item.** Rule 1 forbids factor/GWP edits; DR-02, 03, 04, 11 and 13(b) are numeric. DR-05 step 2 also breaks the 20,200 kg guard. | You approve each numeric item by ID; I amend CLAUDE.md guard text only for approved items. |
| **DR-22** | Owner's documents | Your 2023 document uses **natural-gas** parameters (56,100; NCV 48) for propane (sheet 1.1, row 29) instead of LPG/propane (63,100; 47.3). | Not a catalog change. Confirm whether your 2023 reported figure should stay as filed. |

## 6. Change control: what the probe showed (isolated test DB, nothing persisted)

Scenario: step 3A-5, natural gas 10,000 m³ at 2.02 = 20,200 kg; then the factor is changed to 2.14288.

| # | Operation | Result for the existing natural-gas entry |
|---|---|---|
| A1 | in-place value edit + `resync_inventory` | **20,200 kg stays** (stale). `resync_inventory` does not re-price. |
| A2/A3 | same answer saved again; or an unrelated answer in the same step changed | stays 20,200 (stale) |
| A4 | the gas **quantity** changes (11,000 m³) | re-priced at the new value (23,571.68 kg). The stale value disappears silently. |
| B1 | signed inventory, in-place edit, unrelated diesel edit | stays 20,200; report flagged `edited_after_signing` |
| C1 | **new** row for the inventory year (new id), signed inventory, an unrelated edit in the same step | the gas entry is **re-priced 20,200 → 21,428.80 kg (+1,228.80)** and the report is flagged edited-after-signing |
| D1 | new row for a *later* year (2026), signed 2025 inventory, unrelated edit | unchanged |

**Consequences.**
1. An in-place edit is unsafe in both directions: it produces a **stale/new mixture** inside one inventory (some entries old, entries touched later new), and it rewrites the `reference` of past results.
2. A same-year new row is safe only until someone edits that step: an authorised, flagged edit then silently moves *other* rows. The rebuild rule is `(factor_id, quantity, facility)`, so any change of factor id counts as a change.
3. A later-year row is the only variant that cannot reach a signed inventory.

**Controls proposed (DR-19, all CODE, none implemented):**
* **C1.** Factor changes are new rows with a new effective year (never in-place). A DB/service guard refuses to edit `factor_kg_co2e` on a row that any entry references.
* **C2.** Rebuild of a step for a *locked* inventory keeps each unchanged entry's recorded factor (match on slug+quantity+facility, reuse the entry's `emission_factor`/`factor_value_snapshot`), so an unrelated edit cannot re-price it. Draft inventories still use the newest eligible row.
* **C3.** Audit row on every factor create/deactivate (who, old/new value, source, approval reference) and on any inventory re-price (before/after kg).
* **C4.** Before/after report per approved item, generated on a disposable copy: entries touched, kg before, kg after, inventories affected, signed ones (expected 0).
* **C5.** Source-label corrections ship separately from numeric changes: first release LABEL items only; the totals are asserted byte-identical on the disposable copy.

## 7. Proposed order for Stage 6 (only after your approval)

1. **Release L (labels):** DR-05 step 1, DR-08, DR-10, DR-12, DR-15, DR-16, DR-17, DR-18, DR-02 labels (R404A, SF₆). Totals must be identical (asserted).
2. **Release C (controls):** DR-19, DR-20.
3. **Release N (numeric, new rows only, per ID you approve):** DR-01, DR-02, DR-03, DR-04, DR-13(b), then DR-11 and DR-05 step 2 if approved.

## 8. Not tested or not established

* PostgreSQL (all runs on SQLite). The probe ran in SQLite test DBs.
* ISO gas-column before/after for DR-11 is an estimate until Stage 6 runs it.
* 2024/2025 ETKB editions, the CarbonIQ catalogue and the USD factor table were not available.
* AR6 Chapter 7 main-report numeric rows could not be text-extracted; the values above come from Table 7.SM.7.

## 9. Approval form

Mark each ID **A**pprove / **R**eject / **M**odify, with the effective inventory year for numeric items.

| ID | Decision | Effective year | Approved by / date |
|---|---|---|---|
| DR-01 | | | |
| DR-02 (and 02a SF₆, 02b R404A) | | | |
| DR-03 | | | |
| DR-04 | | | |
| DR-05 step 1 / step 2 | | | |
| DR-06 | | | |
| DR-07 | | | |
| DR-08 | | | |
| DR-09 | | | |
| DR-10 | | | |
| DR-11 | | | |
| DR-12 | | | |
| DR-13 | | | |
| DR-15 / DR-18 | | | |
| DR-16 / DR-17 | | | |
| DR-19 / DR-20 / DR-21 | | | |
| DR-22 | | | |
