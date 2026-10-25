# Stage 4 evidence manifest

All documents were downloaded on 2026-10-23 from the publisher's own host, kept unmodified in `evidence/`, and
parsed with `python -I` (isolated mode) because they are untrusted files. `evidence/SHA256SUMS.txt` lists the hashes;
`sha256sum -c SHA256SUMS.txt` re-checks them. The audit table's `source_row_or_page` column cites the row ID or page.

## Retrieved and used

| ID | Document | Publisher / URL | SHA-256 | Used for |
|---|---|---|---|---|
| E-DESNZ24 | UK Government GHG Conversion Factors for Company Reporting 2024, flat format v1.1 (8,741 data rows) | DESNZ/DEFRA, `https://assets.publishing.service.gov.uk/media/6722567c10b0d582ee8c4953/ghg-conversion-factors-2024-FlatFormat_v1_1.xlsx` | `1b063892ad1f00c5bc73029c016e54bc4c3050a71219202b545f8aea2f9f75c4` | fuels, WTT, material use, water, hotels, flights, waste, refrigerants, UK grid; absence of spend-based factors |
| E-DESNZ25 | same, 2025 edition | `https://assets.publishing.service.gov.uk/media/6846b6ea57f3515d9611f0dd/ghg-conversion-factors-2025-flat-format.xlsx` | `8bfdb45b81ec4a88e3bdf4584637330f62e6bd09ce1940e654c5d7b7f736de94` | UK grid 2025, T&D 2025, 2025 flight values |
| E-DESNZ23 | same, 2023 edition | `https://assets.publishing.service.gov.uk/media/649c536906179b00113f74a9/ghg-conversion-factors-2023-flat-file-update.xlsx` | `804885cb9d8f02bbb97dcd92b79ca294080ba892ba67e3c95fcfbae52af359a6` | vintage tests |
| E-DEFRA20 | DEFRA Conversion Factors 2020, flat file | `https://assets.publishing.service.gov.uk/media/5edfa176d3bf7f1eb2043f01/Conversion_Factors_2020_-_Flat_file__for_automatic_processing_only_.xlsx` | `c47a39ecac3e7876b80d99e59b05b402bba068277d849ab53c522a3196d38146` | natural gas 2.02266 (origin of the stored 2.02) |
| E-DESNZ24-METH | UK GHG conversion factors 2024: methodology paper | `https://assets.publishing.service.gov.uk/media/66a9fe4ca3c2a28abb50da4a/2024-greenhouse-gas-conversion-factors-methodology.pdf` | `e8653c3641bc96bbca5c09a76f03113a5b04c11d81af18494d37cf1996169d5f` | waste/recycling boundary (§12.29, p.121) |
| E-ETKB23 | Türkiye Elektrik Üretimi ve Elektrik Tüketim Noktası Emisyon Faktörleri Bilgi Formu, ETKB-EVÇED-FRM-042 Rev.01, calculation period 2023 | T.C. Enerji ve Tabii Kaynaklar Bakanlığı, `https://enerji.gov.tr/Media/Dizin/EVCED/tr/%C3%87evreVe%C4%B0klim/%C4%B0klimDe%C4%9Fi%C5%9Fikli%C4%9Fi/EmisyonFaktorleri/2023_Turkiye_Elektrik_UretimiveElektrik_Tuketim_Noktasi_Emisyon_Faktorleri.pdf` | `9c88c77e97a8e03ef3e4e4d404f7e039fb6aba0ea6e27093da4858eaf7fff4a2` | transmission 0.436 and distribution 0.469 tCO₂-eq/MWh (p.2); generation 0.434 |
| E-ETKB22 / E-ETKB20 | same form, 2022 and 2020 | `.../EmisyonFaktorleri/2022_Uretim_Tuketim_EF.pdf`, `.../2020_Uretim_Tuketim_EF.pdf` | `8c62d29b…fc5133`, `cc0edb89…04882d` | the legacy `turkey-grid` 0.4199 matches none (2020 generation 0.420, 2022 0.442) |
| E-GHGP-GWP | IPCC Global Warming Potential Values, v2.0 (7 Aug 2024), AR4/AR5/AR6 columns | GHG Protocol, `https://ghgprotocol.org/sites/default/files/2024-08/Global-Warming-Potential-Values%20%28August%202024%29.pdf` | `5f0bbd46600e0b27ea4eda97932d683aaef9b6e70a88830e8b219c885aeea387` | refrigerant / SF₆ GWP basis |
| E-GHGP-S3 | Corporate Value Chain (Scope 3) Accounting and Reporting Standard (2011) | GHG Protocol, `https://ghgprotocol.org/sites/default/files/standards/Corporate-Value-Chain-Accounting-Reporing-Standard_041613_2.pdf` | `c748e35216aedd90fff3dc580b233f37cbaf9e6cefd211c88e92965bded54b91` | Box 5.6 (p.49), §3.2, §9.5: recycling and avoided emissions |
| E-IPCC-V3C2 | 2006 IPCC Guidelines Vol.3 Ch.2 Mineral Industry | IPCC NGGIP, `https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/3_Volume3/V3_2_Ch2_Mineral_Industry.pdf` | `f76b756a812afeb3da0c6824cf3747d2d11002a386e1885b374138796c4e1240` | clinker EF, Eq. 2.4 (0.51 × 1.02 = 0.52) |
| E-IPCC-V2C1 / V2C2 | 2006 IPCC Guidelines Vol.2 Ch.1 and Ch.2 | `.../2_Volume2/V2_1_Ch1_Introduction.pdf`, `.../V2_2_Ch2_Stationary_Combustion.pdf` | `e391cd46…ea1ac45`, `a25d9f96…02985b` | NCVs (Table 1.2) and default CO₂ factors (Table 2.3) |

## Not retrieved: limitations on what this audit can claim

| Item | Why | Effect on the audit |
|---|---|---|
| GLEC Framework v3.x (Smart Freight Centre) | The S3 host rejected this environment's TLS connection (`SEC_E_LOGON_DENIED` / `TLSV1_ALERT_ACCESS_DENIED`). | `tm-01/02` (0.062/0.123) classed **X, unverifiable here**. Secondary summaries disagree (≈62 / 101 / 125 g per tkm); none was used as a value. |
| IEA Emissions Factors 2024 | Licensed data. | The 10 `iea_2024` grid factors (DE, FR, JP, KR, IN, AU, BR, CA, SA, AE) classed **X**. |
| IPCC AR6 WG1 Ch.7 (Tables 7.15 / 7.SM.7) | Not retrieved in this stage. | SF₆ 25,200 vs the GHG Protocol's AR6 column 24,300 is **unresolved**. |
| IPCC 2006 Vol.3 Ch.3–4 (chemicals, metals); IPCC 2019 Refinement | Not retrieved in this stage. | 8 `ipcc_2006` process rows and 14 `ipcc_2019` rows classed **U**, not verified. |
| WBCSD/CSI Cement CO₂ Protocol | Only a secondary summary (California Climate Registry comparison) was seen. | The statement "525 is the cement-industry protocol default" is **secondary evidence**; the stored value is still shown to differ from IPCC 2006's 0.52. |
| ISO 14064-1:2018, GHG Protocol Scope 2 Guidance | Paywalled / not retrieved. | No claim is made about what ISO 14064-1 requires. The market-based residual-mix expectations were not re-verified in this stage. |
| "CarbonIQ EF Katalogu" | Not in the repository or any searched location (also noted on 2026-10-20). | 42 factors that cite only an EF-xxx ID are classed **U**. |

## Method, so the table can be reproduced

1. `tools/flat2csv.py` flattens a DESNZ workbook; `tools/q.py` filters the rows; values are compared **in the stored unit**
   (DESNZ per-tonne values ÷ 1000 for per-kg factors).
2. `tools/build_audit.py` reads the stored value, unit, source label and reference from the catalog itself, usage from
   a disposable copy of the dev database (read-only), and merges the hand-entered findings.
3. A finding is **V** only when a retrieved primary document shows the stored value (to rounding). A value that matches
   an older edition is **D** with the matching edition named. Nothing in the table is a recalled number.
