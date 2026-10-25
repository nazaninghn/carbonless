# Stage 5 decision register

**Nothing in this register has been applied.** No factor value, formula, migration, signed inventory or historical result was changed.
Row-level evidence is in `factor_reconciliation.csv` (all 248 factors); the documented values are in `documented_factor_register.csv`.

How to read it. A decision is listed only if applying it would change a result, a unit, a GWP basis, a methodology rule, or text that a
report prints. Everything classified **A** (59 factors) and **P** (12 pass-through rows) needs nothing from you.

Class key: **A** correct (reproduced by your documents or equal to the exact source it names) · **B** attribution error, value may be valid ·
**C** genuine discrepancy against your documented methodology · **D** cannot be verified from the documents (evidence stated).

---

## 1. Decisions that change results or methodology (approval needed)

Ordered by consequence. "Existing data" is the disposable copy of the dev database (27,621,670 kg approved, 95% of it one clinker entry), so
percentages are per item, not of that total.

| ID | Class | Item | Stored | Your documents say | Impact on existing data | Options |
|---|---|---|---|---|---|---|
| **DR-01** | C | `truck-freight` (Turkey) | 0.823134 kg CO₂e **per tonne-km** | The same number is **per vehicle-km** (calc doc 3.1: activity in km, tonnes blank; uncertainty file "Kg CO2/Km"). Your 2024 sheet uses the tonne-km form, **0.09752** (DEFRA 2024 All HGVs, average laden). | **None** in existing data (reached only by the chat/dashboard form). For a Turkish company 1,000 tonne-km = **823 kg**, a German one **112 kg**; at 0.09752 it is 97.5 kg (8.4× less). | (a) change the unit to vehicle-km and add a separate tonne-km factor; (b) replace with the documented 2024 tonne-km value; (c) keep. Needs your approval either way (value or unit change). |
| **DR-02** | C | Refrigerant GWPs | R134a 1430 · R32 675 · R22 1810 · R410A 2088 · HFC-227ea 3350 | AR6 Table 7.SM.7: **1530 · 771 · 1960 · 2255.5**; 2024 file: HFC-227ea **3600**. R404A **3943** and R600a **3** are DEFRA 2023 values; SF₆ is **25,200** (2023) but **23,500** (2024 file). | **None** in existing data. Per 100 kg leaked: R134a +10 t, R32 +9.6 t, R22 +15 t, R410A +16.8 t CO₂e. | Choose one GWP basis for the platform and state it (the ISO report currently says AR6 for all gases). Separate sub-decisions: R404A (documented AR5-blend 3943 vs AR6 blend 4728), SF₆ (25,200 vs 23,500 vs 24,300 in the GHG Protocol AR6 column), and R407C / R432A (not in your documents). |
| **DR-03** | C | Off-road diesel per litre (`off-road-diesel-desnz`); `on-road-diesel-desnz` | 3.17939 kg CO₂e/L (both rows) | Documented method: off-road **2.93742**, on-road **2.69569** (2024 parameters 2.92742 / 2.68651). | None in existing data. Off-road: **+8.2%** (+242 kg per 1,000 L). The on-road row is registered but unused (the engine uses `motorin-mobile`, which is correct). The catalog\'s own three diesel-per-litre factors disagree by 18.6%. Origin of 3.17939 not established (nearest published: DESNZ fuel oil 3.17493). | Correct to the documented method; or document where 3.17939 comes from. |
| **DR-04** | C | LPG per litre | 1.51468 | Documented **1.58652** (IPCC EF × NCV 47.3 × DEFRA 2023 density 531.098); DESNZ 2024 1.55713. Stored implies a density of ≈0.507 kg/L, which is neither edition. | **1 entry**, 151.5 kg → 158.7 kg (+7.2 kg, +4.7%). | Correct to the documented method, or document the density used. |
| **DR-05** | B | Natural gas per m³ (label "DEFRA 2024 – 2.02") | 2.02 | **No single documented value:** your 2023 method gives **2.14288** (density 0.795, DEFRA 2023), your 2024 method **1.91242** (density 0.7095 kg/Sm³). DESNZ 2024 = 2.04542; DEFRA 2020 = 2.02266 (the stored value rounded). | **4 entries, 125,240 kg**: +7,619 kg (+6.1%) at 2.14288; −6,670 kg (−5.3%) at 1.91242; +1,576 kg (+1.26%) at 2.04542. | Decide the density/CV basis (and whether the platform should hold the IPCC parameters and compute, as your workbooks do, instead of one fixed per-m³ number); then relabel. The value may stay if you accept 2.02. |
| **DR-06** | A + C | Turkish electricity: edition, legacy entries, T&D | `turkey-grid` 0.4199 (legacy, inactive); ETKB by connection 0.436 / 0.469 (active); `transmission-losses` 0.02 | **2023 inventory:** IEA 0.4199 **plus T&D losses = 15% of Scope 2** (Ktg6). **2024 inventory:** ETKB consumption-point factor, 0.478 (the 2022-edition distribution value), no separate T&D line. | Legacy entries (2, 25,194 kg) are **correct for the 2023 method**; re-basing them to ETKB would be +11.7% (distribution) / +3.8% (transmission): a methodology change, not a fix. T&D: 4 entries, 15,400 kg at 0.02/kWh vs 48,498 kg at the documented 15% (+33 t), **if** that rule applies. | (i) Which factor applies to which inventory year (keep 0.4199 + 15% for 2023-method inventories; ETKB for 2024+). (ii) Leave legacy entries as they are (recommended default: they follow your documented method). (iii) T&D rule: flat 0.02, your 15%, or none if the ETKB consumption-point factor already includes losses (ETKB\'s form does not say; the GHG Protocol puts T&D losses in Category 3 "reported by end user" but does not say either). (iv) Only the 2023 ETKB edition is held; 2024/2025 not located. |
| **DR-07** | D (method) | Negative recycling credits (MDR-S4-01) | −0.125 / −0.506 / −9.1 kg/kg | **Neither** inventory contains a credit: 2023 uses positive DEFRA waste factors (C&I 21.28 kg/t); 2024 uses DEFRA 2024 Waste management (recycling **+6.41061 kg/t**, landfill positive); recycled metal is bought at the closed-loop **material** factor. The catalog cites only an internal ID. | None in existing data. | The Stage 4 options stand; the new evidence adds that your documented method is "positive DEFRA treatment factors, no netting" (Option C/E in MDR-S4-01). Provenance of EF-K3A-003/005/006 is still missing. |
| **DR-08** | B | Cement clinker (label "IPCC 2006") | 525 kg/t | Not in your documents (cable manufacturer). IPCC 2006 Eq. 2.4 = **520**; 525 is the cement-industry protocol default (secondary evidence). | **1 entry, 26,250,000 kg** → 26,000,000 kg (−250,000 kg, −0.95%) if 520. | Keep 525 and relabel to the cement protocol (needs the protocol text), or change to 520. |
| **DR-09** | D (method) | Flights and radiative forcing | e.g. long-haul business 0.429; RFI multiplier 1.9; ICAO 0.148 | Your documented practice is **"Without RF"** (DEFRA 2023 short-haul to/from UK, 0.10794/pkm, i.e. no multiplier). | None in existing data. | Decide whether the platform follows "without RF", offers both, or keeps RF; and which DESNZ class applies to a Turkish company (documented practice: to/from UK; DESNZ also has an international non-UK set). The 2.9 cabin multiplier has no source in the files. |
| **DR-10** | D | Spend-based factors (legal, cleaning, catering, IT, marketing) | 0.13 / 0.19 / 0.52 / 0.15 / 0.17 kg per USD | Your documented spend-based factors (0.4995, 0.0927, 1.5563) come from a **"USD Emission Factors" table (rows 115/305/389) that is not among the files**; the DESNZ 2024 workbook contains no spend-based factor at all. | 1 existing entry type (legal-accounting). | Provide the USD table (edition, currency year) so these can be matched to a sector row, or relabel as unsourced estimates. |
| **DR-11** | C (method) | Gas-split GWP and sector tier (ISO report CO₂/CH₄/N₂O columns) | CH₄ GWP **29.8**; commercial-tier CH₄ (5 / 10 kg/TJ) | Your documents use CH₄ **27.9** (AR6 7.SM.7) and the manufacturing tier (1 / 3 kg/TJ). | **Totals unchanged**; only the gas columns of the ISO report move slightly (e.g. CH₄ 0.06 t on the Stage 3 inventory). | Align the gas-split constants to your documented basis. |
| **DR-12** | C | Bioenergy: biodiesel, bioethanol, wood pellets | 0.03639 L · 0.02719 L · 0.01553 kg | The DESNZ 2024 rows the catalog cites: **0.16751 · 0.00901 · 0.05434**. Not in your inventories. | None. | Correct to the cited rows, or document another source. |
| **DR-13** | C / D | Landfill factors | `wt-01-landfill` 1.29 · `general-landfill` 0.57 · `landfill` (Turkey) 0.54 | Your documents: household landfill **0.49704**, paper landfill (2024) **1.16439**, C&I **0.52033**. | `wt-01-landfill` 1 entry 6.5 kg → 5.9 kg (−0.6 kg). `general-landfill` 1 entry 1,140 kg → 994 kg (household) or 1,041 kg (C&I). | State the waste category each represents; align to the documented values. |
| **DR-16** | C (minor) | `on-road-petrol-desnz` | 2.30233 | Documented on-road petrol 2.35027 (−2.0%). Registered only; the engine uses `gasoline-generic` (2.31, −1.7%). | None. | Align or leave. |
| **DR-17** | C (minor) | `diesel-kwh` | 0.24882 | The DESNZ 2024 row it cites: 0.25649 (−3.0%). | None. | Align or leave. |

## 2. Label-only corrections (no numerical change, but reports print them)

The ISO report prints these labels, so correcting them is still a change to what a report says. Apply only with your approval.

| ID | Factor | Printed now | The evidence says |
|---|---|---|---|
| DR-15 | `fuel-extraction` (0.6) | "GHG Protocol – Scope 3 Cat 3 estimate" | value ≈ the DEFRA WTT diesel 0.61101 in your calc doc (−1.8%); the GHG Protocol publishes no factors |
| DR-15 | `diesel-generic`, `gasoline-generic`, `product-fuel-use`, `car-commute`, `taxi`, `vehicle-km` | "generic" / GHG Protocol | values within 2% of your documented fuel and car factors |
| DR-15 | `off-road-gasoline-desnz` (2.30233) | "DESNZ/Defra 2024" | −0.21% from your documented off-road petrol (IPCC method), not a DESNZ value |
| DR-18 | `ferry-travel` (0.019) | "coastal/ferry passenger average" | equals the **foot-passenger** value 0.01871; the "average" row is 0.1127 |
| DR-05 | `natural-gas-m3` | "DEFRA 2024 – 2.02" | see §1 |
| DR-08 | `cement-clinker` | "IPCC 2006 – 525" | see §1 |

## 3. Evidence requests (class D: what is missing)

Nothing to approve; these need documents. Each factor row in the CSV has its own `missing_evidence` text. The 149 unresolved rows by
stored source label (non-overlapping; counts verified against `factor_reconciliation.csv`):

| Source label | Rows | Missing |
|---|---|---|
| `generic` ("GHG Protocol – Scope 3 Cat N estimate") | 51 | a citable source per value (the GHG Protocol publishes no factors) |
| `defra_2024` | 49 | **39** cite only an internal "CarbonIQ EF Katalogu EF-xxx" ID → the catalogue, or the primary row for each (this includes the 18 GLEC `tm-01…08` rows: the GLEC primary was inaccessible, or choose the DEFRA tonne-km set your 2024 sheet names). **10** name DEFRA 2024 but were not matched to a DESNZ row (the workbook you provided can answer this; not done in this review). 13 of the 49 are routed to DR-07 (3) / DR-09 (5) / DR-10 (5) in §1; DR-09 also holds 3 `generic` flight rows and the `icao` row. |
| `turkey_fleet` | 14 | a document for each Turkish fleet factor |
| `iea_2024` | 10 | the licensed IEA dataset rows (IEA is a documented source *type* in your 2023 inventory) |
| `ipcc_2006` | 10 | IPCC 2006 Vol.2 Ch.2 / Vol.3 Ch.3–4 rows (coal, fuel oil, 7 process factors) |
| `ipcc_2019` | 7 | the IPCC 2019 table and CH₄/N₂O tier behind each per-GJ CO₂e value |
| `turkey_grid` (non-electricity) | 7 | a source for district heating/cooling, coal, incineration, landfill (DR-13), compost, recyclable |
| `icao` | 1 | the ICAO document and conversion (DR-09) |

Decision IDs attached to unresolved rows: DR-14 (evidence only) 127 · DR-09 flights/RF 9 · DR-13 landfill 5 · DR-10 spend-based 5 · DR-07 recycling 3.

## 4. Closed by your documents (Stage 4 was wrong or incomplete)

| Stage 4 said | Stage 5 finding |
|---|---|
| 14 `atom_kablo` factors are unverifiable "company-specific defaults" (listed as a defect) | They **are your documented methodology.** 13 of 14 are reproduced from the calculation document to ≤0.011%, and 10 of those are also equal to DEFRA 2023 rows (primary-verified; the other three are Ecoinvent ×2 and the diesel formula). The remaining one, `truck-freight`, is a **unit** problem (DR-01). The "defect" test was removed. |
| `motorin-mobile` 2.696 unverified | Reproduced by the documented formula (2.69569, +0.011%); inputs verified (density 832.836 = DEFRA 2023 fuel properties). |
| `turkey-grid` 0.4199 origin unresolved | It is the factor in your 2023 inventory (0.4183 + 0.0001 + 0.0015, attributed to IEA). Correct for that method. |
| `sf6` 25,200 unresolved | Equals your 2023 document (AR6 7.SM.7). Your 2024 file uses 23,500: the documentation carries both (DR-02). |
| Refrigerants "AR4 labelled AR6" | Confirmed **against your own documented AR6 basis** for R134a, R32, R22, R410A; R404A (3943) and R600a (3) follow DEFRA 2023 in your document; R404A is within 0.5%. |
| Flights compared with DESNZ and found "derived" | The documents contain no catalog flight factor; the issue is a **boundary** difference (RF) and an unsourced multiplier: unresolved, not wrong (DR-09). |
| Spend-based factors "attributed to DEFRA 2024 but DESNZ has none" | Still true; and your documented spend-based source is a different table that is missing (DR-10). |
| Stage 4 compared nearly everything to DESNZ **2024** | Your inventories use DEFRA **2023** (2023) and DEFRA **2024 / IPCC 2006** (2024). Differences from DESNZ 2024 were treated as evidence of error only where the catalog explicitly cites that DESNZ row. |

## 5. Observations about the documents themselves (not findings on the catalog)

For your information; I have not judged whether they matter to your verified results.

1. 2023 calc doc, propane (sheet 1.1, row 29) uses the **natural-gas** EF 56,100 and NCV 48 (2.6955 kg/kg), not LPG/propane parameters (63,100 / 47.3).
2. SF₆ GWP is 25,200 in the 2023 workbook and 23,500 in the 2024 file.
3. The 2023 uncertainty file uses a non-hazardous waste factor of 21.2802 kg/t where the calculation sheet uses 21.2808 (0.003%).
4. The `std` USEEIO-style table in the 2024 file has mixed scaling (e.g. row 389: E=225, G=0.26), so it cannot be used as a clean reference.
5. The 2024 inventory moved from IEA 0.4199 + separate T&D (2023) to the ETKB consumption-point factor (2024).

> **Superseded by decision_register_v2.md (2026-10-23)**, which adds exact proposals, DR-19 to DR-22 and change controls.
