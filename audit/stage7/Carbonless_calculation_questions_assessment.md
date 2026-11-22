# Carbonless: technical assessment of four open calculation questions

Date: 2026-11-22. Status: **for review. Assessment and documentation only.** No code, database, migration, factor value, GWP value, conversion value, formula, rounding or scope rule was changed, and no factor was approved, activated or deactivated. Nothing was done in production. The repository is unchanged by this work: the working tree is clean and nothing was committed (`origin/main` is at `17850df`). Both deliverables are outside the repository.

Companion file: `DEFRA_mapping_review.xlsx` (sheets *Mapping review*, *Unresolved register*, *Summary*).

## 0. What this assessment found first

1. **The repository already contains a methodology audit that answers part of these questions.** `audit/stage5/decision_register_v2.md` (items DR-01 to DR-22) and `audit/stage5/documented_factor_register.csv` record the methodology owner's own verified calculation documents (ATOM KABLO ISO 14064-1 calculation document 2023 and the 2024 general table), with cell references and file hashes in `audit/stage5/evidence_manifest.md`. Most of those items are still **undecided** (the approval form in §9 of the register is empty).
2. **The factor-standards work merged in PRs #149 and #150 was built without consulting that register.** It introduced rows that take a position on several of its open items. Those positions are listed in §9 as unsupported assumptions. They are on `main` today.
3. So the useful split is not "internal vs client" but three-way: decided by evidence already in the project; decidable internally as structure or policy; and genuinely open, most of which are *already* open items in the existing register and belong to the methodology owner, not to a new client query.

## 1. Evidence and source register

| ID | Source | Where | What it establishes | Limits |
|---|---|---|---|---|
| E-01 | Decision register v2 | `audit/stage5/decision_register_v2.md` | Open decisions DR-01…DR-22; proposed rule "no in-place edit of any factor value" (DR-19), method-year rule (DR-20), per-item waiver of hard rule 1 (DR-21) | Proposed, not approved |
| E-02 | Documented factor register | `audit/stage5/documented_factor_register.csv` (54 rows) | The owner's documented formulas, densities, GWPs and DEFRA rows, each with sheet and cell | 2023 document is cell-level; 2024 file is supplementary |
| E-03 | Evidence manifest | `audit/stage5/evidence_manifest.md`, `audit/stage4/evidence_manifest.md` | Hashes of the owner's files and of the public sources below | Owner's files are not in the repository |
| E-04 | DR-11 decision note | `audit/stage6/dr11_decision_note.md` | Three methane GWP values in play (29.8 / 27.9 / 27.0); IPCC sector tiers | Status HOLD |
| E-05 | GHG Protocol, "IPCC Global Warming Potential Values" v2.0 (Aug 2024) | `audit/stage4/evidence/GHGProtocol_GWP_values_v2_Aug2024.pdf`; client link | AR4 / AR5 / AR6 columns; "the use of the latest values (AR6) is recommended"; methane fossil / non-fossil instruction | A GWP table, not an emission-factor set |
| E-06 | IPCC AR6 WG1 Ch.7 Supplementary Table 7.SM.7 | `audit/stage5/evidence/Table_7SM7_GWP100_extracted.txt` | CH₄ 27.9, N₂O 273, SF₆ 25,200, HFC values | Table 7.15 numeric rows were not extractable (E-03) |
| E-07 | IPCC 2006 Guidelines, Vol. 2, Ch. 1, 2, 3 | ipcc-nggip.iges.or.jp; SHA-256 `e391cd4676d0891cd77f67d3bd76e0e6775386b468ce5ce7ebe2311a6ea1ac45`, `a25d9f96d7672df391b328de79d4cfd812c07fe79d5cf4a30d23d82d8f02985b`, `b0b7d96d5ac90ecf359cdb74e932448cfba041c6cec0e1dc24f2def444508c30` | Tables 1.2 (NCV), 1.4 (CO₂), 2.2–2.5 (stationary CH₄/N₂O by sector), 3.2.1–3.2.2 (road), 3.3.1 (off-road) | Mass and energy bases only: **no densities** |
| E-08 | DEFRA/DESNZ 2026 full set | `ghg-conversion-factors-2026-full-set.xlsx`, SHA-256 `b5c4f2f86cdc74707337b2fb013b44ded189a1b528f5e29ea99856ba65ae0205` | Sheet *Fuel properties* (cells cited in §3); sheet *Haul definition* | States no reference temperature or pressure |
| E-09 | DEFRA/DESNZ 2026 flat file (revised) | `ghg-conversion-factors-2026-flat-format-revised.xlsx`, sheet *Factors by Category*, SHA-256 `a9a455ab396dae226d510c7be6233748416d490c41a5d20f3dc7a0c45feecd5e` | The rows the mapping points at (row and ID per mapping in the review workbook) | |
| E-10 | DEFRA/DESNZ 2026 methodology paper | `2026-GHG-conversion-factors-methodology-report.pdf`, SHA-256 `e15e575e3d54c75a723e32b7aebcbd4e294abe39267d585d6daa231fc5cbd7d7` | Paras 1.4–1.5 (intended for UK operations; other use "at their own risk"); footnote 3 and Table 1 (AR5, with AR4 remnants); 2.9 (gross CV default for gas kWh); 8.10 (non-UK flights); 10.1 (overseas electricity no longer provided); 12.22 (waste allocation); 13.2–13.6 (fuel properties from the UK GHG inventory / DUKES) | |
| E-11 | DEFRA flat files 2014–2025 | gov.uk, one per edition | Edition history of each mapped row | 2002–2013 have no flat file |
| E-12 | Mapping workbook | `carbonless_factors_vs_DEFRA.xlsx`, sheet *Comparison* (236 rows), SHA-256 `73fed531f912f6614de1ea710047532e5fa3eaae3013cc9fd513f373936476cc` | The mapping under review (column N "DEFRA row used") | Built by one person, never second-reviewed |
| E-13 | ETKB form ETKB-EVÇED-FRM-042, calculation period 2022 | client link; 2020 / 2022 / 2023 editions in `audit/stage4/evidence/` | Turkish grid factors by connection point; states its data come from the national inventory's CRF tables | Does not say whether T&D losses are included (DR-06) |
| E-14 | TUR_NID_2024, pages 1–12 only | unfccc.int (client link) | Title, authorship, scope, guideline basis (§5) | **536 of 548 pages not retrieved** |
| E-15 | Platform code as merged | `emissions/data/build_ipcc_ghg_factors.py`, `emissions/data/defra_factors.json`, `questionnaire/iso_report_pdf.py` lines 256–275, 2904, 3479, `emissions/gas_split_data.py` lines 36–40 | What the platform calculates and prints today | |

Not retrieved, so nothing below states what they require: **ISO 14064-1:2018** (paywalled; the earlier audit records the same gap) and the body of **TUR_NID_2024**.

## 2. GWP policy

### 2.1 What each framework actually requires

| Framework | Statement | Requirement or not | Evidence |
|---|---|---|---|
| GHG Protocol | "The use of the latest values (AR6) is recommended"; AR4 and AR5 are listed "because they are sometimes used for inventory and reporting purposes" | **Recommendation**, not a requirement | E-05, p.1 |
| GHG Protocol | Combustion methane "should use the Methane – non-fossil GWP value"; the fossil value is for fugitive and process methane | Guidance | E-05, p.1; E-04 |
| DEFRA / DESNZ | Factors are published already in CO₂e. 2026: CH₄/N₂O factors and refrigerants on AR5; WTT bioenergy still AR4; hotel stay mixed; AR6 only where no AR5 value existed | **Fixed by the publisher per edition.** The platform cannot choose | E-10, footnote 3, Table 1 |
| IPCC 2006 Guidelines | Give factors in kg of gas per TJ. They prescribe no GWP for a company inventory | **No requirement** | E-07 |
| ISO 14064-1:2018 | Not retrieved | **Unknown here** | — |
| National inventories (decision 18/CMA.1) | Cited by the Turkish NID as its reporting basis (E-14). That it mandates AR5 was *not* read from a retrieved document, and it binds Parties, not companies | Not applicable to a company inventory | E-14 |

### 2.2 "AR6" is not one set of numbers

| Gas | AR6 Table 7.SM.7 (E-06) | AR6 column of the GHG Protocol document (E-05) | Owner's documents (E-02) |
|---|---|---|---|
| CH₄ | 27.9 (one row) | 27.0 non-fossil / 29.8 fossil | 27.9 (`1.1 SBT. YANMA!M5`) |
| N₂O | 273 | 273 | 273 (`!N5`) |
| SF₆ | 25,200 | 24,300 | 25,200 in 2023 (`1.4 GAZ KAC.!AG7`); 23,500 in the 2024 table, labelled AR6 (`Referanslar-dogrudan!Q16`) |

A GWP set therefore has to be identified by **source table**, not by the label "AR5" or "AR6". This is already DR-02a and DR-11.

### 2.3 What the platform does today

| Place | GWP basis | Evidence |
|---|---|---|
| ISO report | Prints one fixed "IPCC AR6" table (CH₄ 29.8, SF₆ 25,200, R-404A 4,728) for **every** inventory | E-15, `iso_report_pdf.py` 260–271, 2904, 3479; no branch on the standard was found |
| Gas-split apportionment | CH₄ 29.8, N₂O 273 | E-15, `gas_split_data.py` 39–40; DR-11 HOLD |
| Catalogue rows | Mixed: some AR4 (R-134a 1,430, R-32 675, R-22 1,810, R-410A 2,088, R-404A 3,922), SF₆ 25,200 | E-01, DR-02 |
| `standard = defra` rows (merged) | Publisher's: AR5 with AR4 remnants | E-10 |
| `standard = ipcc` rows (merged) | AR5 column of E-05 (CH₄ 28 combustion / 30 fugitive, SF₆ 23,500, R-410A 1,923.5) | E-15 |
| `standard = ghg` rows (merged) | AR6 column of E-05 (CH₄ 27.0 / 29.8, SF₆ 24,300, R-410A 2,255.5) | E-15 |

Two consequences. (a) An inventory calculated on DEFRA or on the merged "IPCC" rows is on AR5, while its report states AR6: the declared basis does not match the numbers. (b) The merged "GHG Protocol" rows use SF₆ 24,300 and combustion CH₄ 27.0, which differ from the owner's documented 25,200 and 27.9.

### 2.4 Assumptions, as opposed to requirements

- "IPCC standard = AR5" and "GHG Protocol standard = AR6" are **my implementation choices** in `build_ipcc_ghg_factors.py`. No source defines an "IPCC framework" for company reporting with a mandated GWP set.
- The two merged sets share the same activity factors; they differ only in GWP. For fuels the difference is below 0.1%; it is material only for fluorinated gases.

### 2.5 Recommendation

1. Make the GWP set a property of a **versioned framework profile**, and record on every factor row the GWP set it was built with (§6). Never infer it from a label.
2. **Never re-base a DEFRA factor.** A DEFRA profile carries "as published in edition N".
3. The report must print the GWP set of the profile the inventory was actually calculated on.
4. Candidate GWP sets, each a complete, source-traceable table: `AR6-7SM7` (E-06), `AR6-GHGP` (E-05 AR6 column, fossil / non-fossil rule), `AR5-GHGP` (E-05 AR5 column), `DEFRA-<edition>` (publisher-fixed).
5. Which set governs each non-DEFRA profile is the methodology owner's decision. The only documented practice is `AR6-7SM7` with CH₄ 27.9 and SF₆ 25,200.

## 3. Fuel density policy

### 3.1 Where a volume-to-mass (or volume-to-energy) conversion is needed

| Path | Needs a density? | Evidence |
|---|---|---|
| Platform catalogue | No conversion is applied by design: an LPG or fuel-oil amount in kg is "not calculated — the factor is per litre and no density conversion is applied" | `step_entries.py`, note for 3A-5 |
| `standard = defra` rows | No. DEFRA publishes per-litre and per-m³ factors itself | E-09 |
| `standard = ipcc` / `ghg` rows per litre or m³ | **Yes.** 12 slugs × 2 standards = 24 of the 72 merged rows: `natural-gas-m3`, `diesel`, `fuel-oil`, `lpg`, `motorin-mobile`, `diesel-generic`, `on-road-diesel-desnz`, `off-road-diesel-desnz`, `gasoline-generic`, `on-road-petrol-desnz`, `off-road-gasoline-desnz`, `product-fuel-use` | E-15 |
| Owner's documented method | Yes: `EF(IPCC) × NCV(IPCC) × density × 10⁻⁶` | E-02, D-NG, D-LPG, D-DIESEL-* |

### 3.2 The DEFRA 2026 values (sheet *Fuel properties*, year 2026)

| Fuel (col B) | Net CV GJ/t (col D) | Density kg/m³ (col F) | Cells |
|---|---|---|---|
| Diesel (100% mineral diesel) | 43.031 | 830.565 | D24, F24 |
| Diesel (average biofuel blend) | 42.869 | 832.107 | D25, F25 |
| Fuel Oil | 40.752 | 983.284 | D26, F26 |
| Gas Oil | 42.569 | 853.971 | D27, F27 |
| LPG | 45.944 | 529.749 | D29, F29 |
| Natural Gas | 44.695 | 0.808 | D31, F31 |
| Petrol (100% mineral petrol) | 44.593 | 746.269 | D35, F35 |
| Petrol (average biofuel blend) | 42.976 | 750.368 | D36, F36 |
| Propane | 46.4 | 514.933 | D37, F37 |
| CNG | 44.695 | 175 | D48, F48 |

The only note on the sheet (A63:B63) explains litres/tonne. **No reference temperature or pressure is stated anywhere on the sheet.**

### 3.3 Applicability limits that are documented

- **UK-specific.** "Fuel property data for the vast majority of fuels uses data from the UK GHG Inventory… largely based on DUKES" (E-10, 13.2). The factors are "for UK-based organisations" and "international organisations reporting on their UK operations"; other use is "at their own risk" (E-10, 1.4–1.5).
- **Edition-specific.** Natural gas density is 0.795 in the 2023 edition (E-03) and 0.808 in 2026 (F31): +1.6% in three editions. Diesel average blend 832.836 → 832.107; LPG 531.098 → 529.749.
- **Blend-specific.** Petrol and diesel "average biofuel blend" rows embed the UK biofuel share.
- **Gas reference conditions unknown.** The owner's 2024 table uses 0.7095 kg/**Sm³** (E-02, D24-NG-MANUF); DEFRA states no condition for 0.808. Which condition a Turkish gas invoice's m³ refers to is not evidenced in the project.

### 3.4 Sensitivity (natural gas, per m³, AR5 weights, IPCC Table 2.3)

| Combination | kg CO₂e/m³ |
|---|---|
| IPCC NCV 48.0 × owner's 2024 density 0.7095 | 1.9124 |
| DEFRA 2026 NCV 44.695 × DEFRA 2026 density 0.808 (**what was merged**) | 2.0279 |
| IPCC NCV 48.0 × DEFRA 2023 density 0.795 (owner's 2023 method) | 2.1429 |
| IPCC NCV 48.0 × DEFRA 2026 density 0.808 | 2.1779 |

A spread of about 14% from the density and NCV choice alone. For liquid fuels the density spread between editions is below 0.3%, but the **fuel identity** matters more: gas oil 853.971 against diesel 830.565 (2.8%), and petrol blend against mineral petrol.

### 3.5 Assessment per application

| Application | Suitable? | Why |
|---|---|---|
| DEFRA density inside DEFRA's own per-litre factors | Yes | Publisher's own consistent set |
| DEFRA density of the **inventory-year edition** in the owner's formula, for an inventory that declares that method | Supported by documented practice | E-02 (2023: DEFRA 2023 densities) |
| DEFRA **2026** density applied to every inventory year under "IPCC" / "GHG Protocol" | **Not supported** | Edition fixed arbitrarily; no method-year link (DR-20) |
| DEFRA NCV × DEFRA density combined with IPCC factors per TJ (the merged rows) | **Not supported** | Differs from the documented formula, which uses the IPCC NCV |
| DEFRA natural gas density for Turkish pipeline gas | **Not established** | UK gas composition; reference conditions unknown; the owner's 2024 value is 12% lower |
| DEFRA gas-oil density for Turkish off-road diesel | **Not established** | The owner treats off-road diesel as ordinary diesel (D-DIESEL-OFF) |
| DEFRA fuel-oil density for Turkish fuel oil grades | **Not established** | No grade or specification evidence in the project |

### 3.6 Recommendation

A **density reference table**, versioned and source-traceable, in which each row is one value with: fuel (and specification or grade), value, unit, reference conditions (or "not stated by source"), source document, edition, sheet and cell, source hash, country of applicability, valid-from year, status (proposed / approved / superseded) and approval reference. A calculation may use only an **approved** row whose country and year match; where none exists the amount stays "not calculated — no density", which is the platform's existing rule. DEFRA rows enter that table flagged "UK; conditions not stated". No DEFRA density is a universal default.

## 4. DEFRA nearest-item mapping

Reviewed: every one of the 236 rows of sheet *Comparison* in `carbonless_factors_vs_DEFRA.xlsx`, against the DEFRA 2026 flat file row it points at (row number and ID in the review workbook), the unit, the methodology paper, the edition history, and the owner's documented choices.

| Class | Catalogue rows | Distinct slugs loaded as `standard = defra` |
|---|---|---|
| Exact Match | 58 | 48 |
| Acceptable Match (justification recorded per row) | 56 | 46 |
| Unresolved | 52 | 48 |
| Not mapped (no DEFRA row; nothing loaded) | 70 | 0 |

"Exact" means the same DEFRA item on the same unit basis. It does **not** mean valid for a non-UK site: every DEFRA value is UK-derived, and that limit applies to the whole DEFRA profile.

**Unsafe if used as is (20 slugs):** `biodiesel`, `coal`, `district-heating`, `flight-domestic`, `flight-long`, `flight-long-business`, `flight-long-economy`, `flight-long-first`, `flight-medium`, `flight-short`, `flight-short-economy`, `metro`, `metro-commute`, `steam`, `train`, `train-commute`, `train-travel`, `transmission-losses`, `truck-delivery`, `truck-freight`. These depend on UK-only infrastructure (grid, rail, heat networks), on a fuel that is not the Turkish one (lignite), or on a unit, route or method that is in doubt (flights, truck freight, biodiesel).

Main groups of unresolved items (full list and row references in sheet *Unresolved register*):

| Group | Why unresolved | Existing register item |
|---|---|---|
| All flights and air freight | "With RF" rows were mapped; the owner's documented practice is without RF. Most rows are "to/from UK" routes; DEFRA haul classes are by territory (sheet *Haul definition*, Turkey = Short Haul, cell C219), not by the catalogue's km bands | DR-09 |
| Truck freight | tonne-km vs vehicle-km | DR-01 |
| General landfill | Commercial-and-industrial row mapped; the owner uses household residual | DR-13 |
| Recycling with negative catalogue factors | DEFRA's positive transport-only method would be adopted silently | DR-07 |
| Biodiesel, bioethanol, wood pellets | Boundary and biodiesel type not stated | DR-12 |
| Petrol (three slugs) | UK E10 blend row; mineral row is 13% higher | DR-16 |
| Off-road diesel, diesel kWh | Fuel identity (gas oil vs diesel) | DR-03, DR-17 |
| Rail, metro, generic T&D, district heat, steam | UK grid or UK heat mix | — (new) |
| Coal | UK industrial coal for Turkish lignite | — (new) |
| Container ship size classes, electric rail freight | A closer DEFRA row exists, or the traction does not correspond | — (new) |
| `road-travel` | "Unknown fuel" row mapped; the owner uses "Diesel" | — (new) |

All 48 unresolved slugs are **loaded and selectable today** for an inventory that chooses DEFRA. Nothing was deactivated in this assessment.

## 5. TUR_NID_2024

**What it is (read from pages 1–12, E-14).** "Turkish Greenhouse Gas Inventory 1990–2022 — National Inventory Document for submission under the United Nations Framework Convention on Climate Change", 548 pages. Compiled by the Turkish Statistical Institute with the energy, transport, environment and agriculture ministries. It states that national emissions and removals "are calculated by using 2006 IPCC Guidelines", that it is submitted with the Common Reporting Tables (CRT) under decision 18/CMA.1, and that it covers energy, industrial processes, agriculture, waste and land use.

**What it is not.** It is a national, sector-level inventory report. Nothing in the retrieved pages presents activity-level emission factors for a company. It must not be treated as a factor dataset on the strength of being a national inventory document.

**Project evidence of its intended use: none.** The only reference is the client's link. No specification, register item or code in the repository mentions it (searched).

**How it reaches company calculations already.** The ETKB grid-factor form states that its data set includes the emission values "in the CRF calculation tables prepared… under Türkiye's National Greenhouse Gas Inventory Report" (E-13). So the national inventory feeds the electricity factor the platform already uses, indirectly.

**What could be relevant, and is unverified.** A national inventory's energy chapter normally reports, per fuel and year, the net calorific values and carbon contents or CO₂ factors used, and marks which are country-specific. For Türkiye the candidates of interest would be lignite, hard coal and natural gas. **I could not read those pages, so I cannot name a table, a value, or confirm that country-specific values exist.**

**Exactly what is missing.**
1. Pages 13–548 of the PDF, in particular the Energy chapter (fuel combustion, categories 1.A.1–1.A.4) and the annexes. The UNFCCC site refuses automated download, and the page-reading service timed out and is now out of credits.
2. The CRT workbook for the same submission (the Excel tables that hold implied emission factors by fuel).
3. The client's statement of what the document was supplied for.

**Recommendation.** Classify TUR_NID_2024 as a *candidate parameter source* (calorific values and carbon contents of Turkish fuels), not as an emission-factor dataset. Do not import anything from it. Obtain the PDF as a file and the CRT tables, extract the Energy-chapter tables with page and table numbers into a register, and only then assess row by row whether a national aggregate value is appropriate for a single company's fuel.

## 6. Proposed configuration and data model (design only)

| Object | Purpose | Key fields |
|---|---|---|
| `GwpSet` | One complete GWP table | code (`AR6-7SM7`…), source document, table reference, source hash, per-gas values, methane rule (single / fossil–non-fossil), status, approval reference |
| `FrameworkProfile` | What "calculated on framework X" means, as a version | code, version, valid-from inventory year, factor source (publisher edition or parameter formula), `GwpSet`, sector-tier rule, radiative-forcing rule, waste-allocation rule, biogenic rule, density reference set, status (proposed / approved / superseded), approved by, date |
| `DensityReference` | One density value | fields listed in §3.6 |
| Factor row (existing `EmissionFactor`) | Provenance | add: profile version, GWP set code, density reference id (if any), mapping class (Exact / Acceptable), disclosure text for Acceptable rows |
| Inventory (existing `CarbonReport`) | Reproducibility | profile version fixed at first calculation and frozen at signing |

This extends, and must be reconciled with, DR-19 (no in-place edits; factor versioning for signed inventories) and DR-20 (method-year rule) in the existing register. An unapproved profile, GWP set or density row is not selectable.

## 7. Decisions Carbonless can safely make internally

1. GWP sets are identified by source table and stored per factor row and per profile; never by a bare "AR5 / AR6" label.
2. A DEFRA factor is never re-based to another GWP set.
3. The report prints the GWP set actually used by the inventory.
4. Density values live in a versioned reference table with source, edition, cell, conditions and applicability; no density is a universal default; no approved row means "not calculated".
5. Mapping classes are recorded per row; an Acceptable match always carries its disclosure text; an Unresolved mapping is not offered.
6. DEFRA rows that depend on UK-only infrastructure (rail, metro, UK grid T&D, district heat and steam) are not offered for non-UK activity. DEFRA limits its own scope this way (E-10, 1.4–1.5, 10.1).
7. `tm-04` / `tm-05` point at the size-class rows DEFRA publishes rather than "Average"; `tm-08` (electric rail) has no DEFRA row.
8. TUR_NID_2024 is not a factor dataset and nothing is imported from it before a table-level register exists.
9. The 48 Exact-match DEFRA slugs need no external confirmation as mappings (their use for non-UK sites is covered by the DEFRA profile's general disclosure).

Each of these still needs an owner's sign-off before it is implemented, because items 5–7 remove selectable rows and item 3 changes report text.

## 8. Decisions that genuinely require external confirmation

Most are existing register items addressed to the methodology owner.

| # | Decision | Who | Reference |
|---|---|---|---|
| 1 | Which GWP set governs each non-DEFRA profile; in particular CH₄ 27.9 / 27.0 / 29.8 and SF₆ 25,200 / 24,300 / 23,500 | Methodology owner; verifier's view if one is engaged | DR-02a, DR-11 |
| 2 | Whether "IPCC" and "GHG Protocol" are meant to be two distinct calculation frameworks at all, and what distinguishes them | Client / methodology owner | new |
| 3 | What ISO 14064-1:2018 requires on GWP selection | Whoever holds the standard text; the verifier | not retrieved |
| 4 | IPCC sector tier: one tier for all companies, or by declared activity | Methodology owner | DR-11 |
| 5 | Density basis per fuel and method year for Turkish fuels; reference conditions of a gas m³ | Methodology owner; a Turkish fuel specification or supplier document | DR-03, DR-04, DR-05, DR-20 |
| 6 | Radiative forcing on flights and air freight | Methodology owner | DR-09 |
| 7 | Truck freight: tonne-km vs vehicle-km | Methodology owner | DR-01 |
| 8 | Landfill waste category; recycling credits; bioenergy boundary | Methodology owner | DR-13, DR-07, DR-12 |
| 9 | Which UK biofuel-blend or mineral rows represent Turkish petrol and diesel | Methodology owner, with blend-mandate evidence | DR-16 |
| 10 | What TUR_NID_2024 was supplied for | Client | new |

## 9. Unsupported assumptions that must not enter calculations

Items marked **[merged]** are already on `main`. This assessment changed none of them.

1. **[merged]** "IPCC standard = AR5" and "GHG Protocol standard = AR6 as tabulated by the GHG Protocol" (§2.4).
2. **[merged]** SF₆ 24,300 and combustion CH₄ 27.0 for the "GHG Protocol" rows, against the documented 25,200 and 27.9.
3. **[merged]** IPCC Table 2.3 (manufacturing) CH₄/N₂O factors for every company (DR-11 open).
4. **[merged]** Road petrol on the "low mileage light duty vehicle, 1995 or later" row; off-road on "Industry" and "4-stroke". These are my selections among several IPCC rows.
5. **[merged]** DEFRA 2026 net CV × DEFRA 2026 density, for every inventory year, inside the IPCC and GHG Protocol per-litre and per-m³ rows (§3.5).
6. **[merged]** The 48 Unresolved DEFRA mappings, including the 20 unsafe slugs (§4).
7. **[merged]** "With RF" for every flight and air-freight row.
8. **[merged]** The ISO report's fixed "IPCC AR6" statement for inventories calculated on AR5-based rows.
9. A DEFRA density as a default for Turkish fuels.
10. A gas m³ treated as equal under any reference condition.
11. TUR_NID_2024 values as company emission factors.
12. That decision 18/CMA.1 mandates AR5: not read from a retrieved document, and not a company requirement in any case.
13. The catalogue unit "km" read as passenger-km for bus, train, metro and flight rows: the catalogue does not state it.

## 10. Recommended implementation sequence

Nothing below should start without the owner's approval of the step.

1. **Containment decision.** Decide whether inventories on `std_ipcc`, `std_ghg`, and on the Unresolved DEFRA slugs, may be signed or exported before the items above are settled. This is urgent because the rows are live. Options range from a notice to hiding the options; choosing one is an owner decision.
2. **Register.** Add the new items (§8 nos. 2, 10; §4 new groups) to the existing decision register and collect decisions on DR-01, 02a, 03, 05, 07, 09, 11, 12, 13, 16, 20.
3. **Data model** (§6): GWP sets, framework profiles, density reference, provenance fields. Structure only, no values activated.
4. **DEFRA profile:** keep Exact rows; Acceptable rows with their disclosure text; withdraw Unresolved rows until decided. Report prints "as published, DEFRA edition N (AR5 with AR4 remnants)".
5. **Parameter-based profiles** ("IPCC", "GHG Protocol", or the owner's 2023 / 2024 methods): regenerate rows only from approved GWP sets, tiers and density rows, as new versioned rows per DR-19.
6. **Report:** GWP table and basis text taken from the inventory's profile.
7. **TUR_NID_2024:** obtain the PDF and CRT tables, build the table-level register, then assess.
8. **Verification per step:** before/after on a disposable copy (DR-19 C4), signed inventories unchanged, regression guards for catalogue inventories unchanged.

## 11. Recommendation on each of the four questions

1. **GWP policy.** Do not ask the client "AR5 or AR6". Adopt versioned framework profiles with an explicit, source-identified GWP set each; never re-base DEFRA; make the report print the set used. Treat the merged IPCC and GHG Protocol rows as provisional: their GWP assignment is my assumption, not a framework requirement. The value choices (methane, SF₆) go to the methodology owner as DR-02a and DR-11, where they already sit.
2. **Fuel density.** DEFRA density is suitable only inside DEFRA's own factors and, by documented practice, in the owner's formula with the edition of the inventory year. It is not a universal default and is not established for Turkish gas, off-road diesel or fuel oil. Build the versioned density reference table; until a row is approved for a fuel, country and year, the amount is not calculated. The merged per-litre and per-m³ IPCC / GHG rows should not be relied on.
3. **DEFRA mapping.** 48 slugs are exact and 46 are acceptable with the recorded justification; 48 are unresolved, 20 of them unsafe as they stand. The unresolved rows should be withdrawn from selection until decided; most map onto decisions already open in the existing register.
4. **TUR_NID_2024.** It is the national inventory document, not a company factor dataset, and the project holds no statement of its intended use. Import nothing. It may serve as a source of Turkish fuel parameters once pages 13–548 and the CRT tables are obtained and tabulated.

**Stopped here for review.**
