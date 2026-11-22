# TUR_NID_2024 — examination of the original document (2026-11-22)

**Document:** *Turkish Greenhouse Gas Inventory 1990–2022, National Inventory Document for submission under the UNFCCC* (TurkStat, April 2024), the file the client linked (`unfccc.int/sites/default/files/resource/TUR_NID_2024.pdf`), supplied by the owner as a PDF.
SHA-256 `eec4630c47dfa768d9739df2b2d1e71d8d3cd847bbfd24d9962590a4b191ef04`. Read from the PDF text (`pdftotext -layout`); page numbers are the printed ones.

## What the document holds that matters to Carbonless

| Where | Content | 2022 values |
|---|---|---|
| Recalculations section (PDF text line "…for 2024 are based on the GWP values specified in the IPCC Fifth Assessment Report") | GWP basis of the submission: IPCC **AR5** (the previous submission used AR4) | — |
| Table 3.5, p. 51 | Country-specific carbon contents, t C/TJ | hard coal 25.63, lignite 29.69, coke 30.79, petroleum coke 26.55, fuel oil 21.33, diesel 20.03, natural gas 15.20 |
| Table 3.6, p. 52 | Country-specific oxidation factors | hard coal 0.976, lignite 0.963, fuel oil 0.984, diesel 0.984 |
| Table 3.7, p. 52 | CO₂ emission factors, t/TJ | hard coal 91.71, lignite 104.79, asphaltite 96.1, coke 112.90, fuel oil 77.0, diesel 72.3, gasoline 69.3, LPG 63.1, natural gas 55.4, jet kerosene 71.5 |
| Table 3.17 | Average NCVs in public electricity and heat (1.A.1.a), TJ/kt | Turkish lignite 6.53 (IPCC default 11.9), natural gas 48.75, residual fuel oil 43.32, gas/diesel oil 43.07 |
| Annex 4, p. 484, "NCV of Fuels" | National NCVs, 2022 | hard coal 25.40, lignite 8.24, fuel oil 39.39, diesel oil 43.33, gasoline 44.80, LPG 47.31 **TJ/kton**; natural gas **34.54 TJ/10⁶ m³** |
| Annex 4, p. 483 | One worked example of a fuel-oil sample (METU, 2006): density 0.9757 | not a national density |

## What it allows

1. **Natural gas per m³ under the IPCC and GHG Protocol standards — released.** The IPCC default factors are per TJ (net); the document gives the national net calorific value per volume, 34.54 TJ/10⁶ m³ (= 8 250 kcal/m³ × 4.1868, the constant of the national energy balance). The two rows are now built as IPCC Table 2.3 × 0.03454 GJ/m³:
   `ipcc` 1.939576 and `ghg` 1.939570 kg CO₂e/m³ (CO₂ 1.937694). The DEFRA 2026 UK density is no longer used for them, and they are removed from `withheld_factors.json`.
   Open point: the document does not state the reference conditions of the m³ on that line; elsewhere it counts gas in "million sm3".
2. **The GWP basis of the `ipcc` standard (AR5)** agrees with what Türkiye itself reports with.

## What it does not allow

1. **Per-litre rows (diesel, petrol, LPG, fuel oil) stay withheld — 11 slugs × 2 standards = 22 rows.** The document gives calorific values per mass only and no density for these fuels. The single fuel-oil figure is one laboratory sample of 2006 used as a worked example. A per-litre factor still needs a density with supported applicability (for example the TS / EN fuel specifications or EPDK data); none is among the five sources.
2. **Lignite under DEFRA (`coal`) stays withheld.** DEFRA publishes UK coal only. The document's lignite values (NCV 8.24 TJ/kt, 104.79 t CO₂/TJ → 0.863 kg CO₂/kg) are national-inventory values, not DEFRA values, and are not placed under a standard that did not publish them.
3. **The country-specific CO₂ factors of Table 3.7 are not imported.** They would form a fifth, "national" factor set; the inventory offers four (GHG Protocol, IPCC, DEFRA, Mix). Whether to add a national set is the owner's decision.

## The other two PDFs, checked against what was used

- `Global-Warming-Potential-Values (August 2024).pdf`, SHA-256 `5f0bbd46600e0b27ea4eda97932d683aaef9b6e70a88830e8b219c885aeea387`: CH₄ non-fossil 28 (AR5) / 27.0 (AR6), CH₄ fossil 30 / 29.8 — as in `build_ipcc_ghg_factors.py`; the document assigns the non-fossil value to combustion.
- `2022_Uretim_Tuketim_EF.pdf` (ETKB-EVÇED-FRM-042, period 2022, published 06.12.2024), SHA-256 `8c62d29bfec24a5929b2381155046118ac46475440f0a66480f4b20878fc5133`: generation 0.438 tCO₂ / 0.442 tCO₂e per MWh; consumption point on the transmission line 0.442 / **0.445**; on the distribution line 0.474 / **0.478**. Not yet in the platform: grid electricity is served by the catalogue, whose rows are another edition, and adding rows there changes its guard tests (owner's decision).
