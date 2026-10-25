# Stage 5 evidence manifest

## Your documents (read only; originals untouched; not copied into the repository)

All live in `D:\ACADEMIA PROJECTS\carbon data\`. I worked from read-only copies in a scratch directory and parsed them with `python -I`.

| Role in this review | File | Bytes | SHA-256 |
|---|---|---|---|
| **ATOM KABLO ISO 14064-1 Calculation Document (2023)**: the primary documentary basis | `ISO 14064-1 Hesaplama Dokümanı ATOM KABLO 2023 .xlsx` | 91,411 | `59c70f16e57bdec1341380a5de32be11c5367356a21231e88bc52bd4434f8fe9` |
| same document, second copy | `1-CASEM ISO14064-1 Hesaplama Dokümanı ATOM KABLO 2023 .xlsx` | 142,542 | `435b1c7a5f97a7387100625ee602d2fc65bfed59bca5de871d410ec8e1441d2a` |
| same document, third copy | `ISO 14064-1 Hesaplama Dokümanı  2023 .xlsx` | 91,367 | `2396241776ac07c0998aeee03c4abc9f7b06bbebfc62476efcfb296ad63a599a` |
| **Uncertainty Calculation Document (2023)** | `BELİRSİZLİK HESABI DOKÜMANI-2023.xlsx` | 53,736 | `bd03553e532eeb7e54497ccefe0fa952f73c841bd8957a0ad9f4d1ceb504d448` |
| **"Detailed Calculation Tables"** | `Detaylı hesap tabloları (2).xlsx` | 33,112 | `2e9755840392b609dcec4b52f0daa7ef5e909932941f1896a108567f08c1126f` |
| **DEFRA/DESNZ 2024 conversion factors workbook** (condensed set v1.1) | `ghg-conversion-factors-2024-condensed_set__for_most_users__v1_1 (1).xlsx` | 1,861,195 | `09a45a6d876075fee35a98802dd102de695c5348c5c09c151c3d135443d4ceb2` |
| *Supplementary, not in your list:* 2024 general calculation table | `aaaa-genel_hesap_tablosu_2024.xlsx` | 22,421,524 | `14ebd5b748a294d8947d0168c58e7a3650ea6c54d18ee0e48d0ceddf7ccdfea7` |

### What each document turned out to contain

| Document | Content | Usable as factor evidence? |
|---|---|---|
| Calculation document (3 copies) | 19 sheets: stationary and mobile combustion, fugitive gases, imported energy, transport, travel, raw materials, waste, water, EoL; formulas intact. **The three copies are cell-for-cell identical** (1,600 populated cells, values and formulas; 0 differences), so there is one dataset, not three versions. | **Yes: primary** |
| Uncertainty document | IPCC 2003 Tier-1 aggregation tool; its sheet "1 aggregation – indirect" lists the factors used (with 5% uncertainty) and **agrees with the calculation document** (e.g. 0.4199, 0.82313 kg/km, 32.1, 2.04, 3102.4485). | **Yes: independent confirmation** |
| "Detailed calculation tables" | A category / input-field **specification** (categories 1–6, sub-categories, fields). **Zero numeric cells.** | **No factor values** |
| DESNZ 2024 workbook (yours) | 4,629 numeric cells; 4,609 appear in the flat file I downloaded in Stage 4; the other 20 are the version stamp "1.1". Fuel-properties sheet used for 2024 densities. | **Yes: same dataset as Stage 4** |
| 2024 general table (supplementary) | The 2024 inventory: parameters (`Referanslar-dogrudan`), DEFRA 2024 families (`Referanslar-dolayli`), a `std` USEEIO-style table. | Used as supplementary evidence only, and flagged wherever used |

## Public sources added in this stage

| Document | URL | SHA-256 | Used for |
|---|---|---|---|
| DEFRA/DESNZ 2023 condensed set (update) | `https://assets.publishing.service.gov.uk/media/649c5340bb13dc0012b2e2b6/ghg-conversion-factors-2023-condensed-set-update.xlsx` | `db3b9f724492bb42520b3230a41bac52be46a233a34120409e69a56ed819699a` (copy in `evidence/`) | confirms the calc document's DEFRA-2023 densities (diesel average blend **832.836**, natural gas **0.795**, LPG **531.098**, propane **515.198**) |
| DEFRA/DESNZ 2023 flat file; 2020, 2024, 2025 flat files; ETKB 2020/2022/2023; GHG Protocol GWP table; Scope 3 Standard; IPCC 2006 | see `audit/stage4/evidence_manifest.md` | see `audit/stage4/evidence/SHA256SUMS.txt` | the values matched exactly against your documents (paper 868.07, metals, wood, LDPE, plastic, household landfill 497.04, water, HGV 0.81406/km, container ship, car, short-haul no RF, hotel) |

## Limitations in matching your documents to the catalog

1. **Only the 2023 calculation document is cell-level.** Its factors are 2023-inventory choices. Where the 2024 file and the 2023 document use different parameters (natural-gas density 0.795 vs 0.7095, diesel 0.832836 vs 0.83, electricity IEA 0.4199 vs ETKB 0.478, SF₆ 25,200 vs 23,500), no single "documented" value exists; I report both and do not pick one.
2. **The documents cover a cable manufacturer.** They contain no cement, no hotels beyond Türkiye, no UK electricity, no biofuels, no refrigerants beyond those listed, and no LPG for vehicles. For catalog rows outside that scope, "not in your documents" means *unresolved*, not *wrong*.
3. **Three source tables are referred to but not provided:** Ecoinvent (chemicals, 2.04), IEA (Turkish grid 0.4199), and the "USD Emission Factors" table (rows 115 / 305 / 389). Those documented values are reproduced from your cells but not independently verifiable by me.
4. **The "CarbonIQ EF Katalogu" is not available** (also noted on 2026-10-20). 39 unresolved rows depend on it.
5. **Matching method.** Each catalog factor was compared with the documented value for the same activity, unit and year. Tolerances: *exact* ≤ 0.05%; *within parameter choice* ≤ 2% (different densities, CH₄ tier, rounding); anything larger is reported with its size. A numerical coincidence (e.g. propane 2.9976 vs a GWP of 3) was discarded on meaning. The matching script (`tools/documented_register.py`) reads the values from the document cells; nothing was retyped.
6. **Class boundaries are my convention.** B vs C vs D depends on whether the label is wrong with a plausible value (B), the value conflicts with a documented method (C), or nothing documents it (D). I tried to err towards D when the documents were silent.
7. **Not examined:** the Turkish report translations, the data-collection list (`14064-1 Veri Toplama Listesi.Rev.00.xlsx`: I read its sheet names and sizes only), and every inventory other than Atom Kablo.
8. **Not tested:** PostgreSQL, a running server, a real browser.

## Added for decision register v2 (2026-10-23)

| Document | URL | SHA-256 | Used for |
|---|---|---|---|
| IPCC AR6 WG1 Ch.7 Supplementary Material (Table 7.SM.7) | https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_Chapter_07_Supplementary_Material.pdf | 770db58ce60bd5431608339377262d084babd5aba3fbd1a6b5710f1f44ed0ba7 | GWP-100: CH4 27.9, N2O 273, HFC-32 771, HFC-125 3740, HFC-134a 1530, HFC-227ea 3600, HCFC-22 1960, SF6 25200 (copy in evidence/, extract in Table_7SM7_GWP100_extracted.txt) |
| IPCC AR6 WG1 Ch.7 main report | ipcc.ch (same folder) | 470d2662fdd212421617a32c684e8106a4221a7235bdfff40a278eff02febfa9 | Table 7.15 vs 7.SM.7 scope; numeric rows could not be text-extracted |
| DESNZ truck factors 2023/2024/2025 | from the flat files already listed in the Stage 4 manifest | see Stage 4 SHA256SUMS | DR-01 values |

Probe: audit/stage6/tools/probe_factor_change_propagation.py (run in a disposable test DB; not part of the suite).
