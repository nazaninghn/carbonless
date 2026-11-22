# Client documents checked on 2026-11-22, and the change made from them

## Files supplied by the owner

| File | SHA-256 (first 12) | Content | Factor evidence? |
|---|---|---|---|
| `1-CASEM ISO14064-1 Hesaplama Dokümanı ATOM KABLO 2023` (3 identical copies) | `435b1c7a5f97` | 19 sheets, the 2023 inventory calculation | Yes — already reconciled cell by cell in `audit/stage5` (same hash) |
| `ISO 14064-1 Hesaplama Dokümanı ATOM KABLO 2023` (2 identical copies) | `59c70f16e57b` | the same calculation document | Yes — same, `audit/stage5` |
| `BELİRSİZLİK HESABI DOKÜMANI-2023` (2 copies) | `bd03553e532e` | uncertainty tool; repeats the factors of the calculation document | Yes — `audit/stage5` |
| `ghg-conversion-factors-2024-condensed set v1.1` | `09a45a6d8760` | DEFRA / DESNZ 2024 | Yes — the DEFRA standard's 2024 rows |
| `Detaylı hesap tabloları` | `9d0f7a632ee6` | category and input-field specification | No: no numeric cell |
| `Carbon footprint platform document` (TR, EN) | `653eec0c72c8`, `c3c97f7c3c67` | platform introduction brochure | No |
| `Kategori 1.docx` | — | summary of the 2023 formulas | Nothing beyond the calculation document |
| **`ISO 14064-1 GHG Inventory Report 2024 ANONYMISED STRICT`** | — | a verified 2024 inventory report; all factors and methods preserved | **Yes — new** |

## What the 2024 report shows (Tables 8–20)

* **Fuel by volume:** activity in m³ / litres → mass with the DEFRA 2024 "Fuel properties" density (natural gas 0.796, diesel 830.565, petrol 746.269 kg/m³) → TJ with the IPCC 2006 default NCV (Table 1.2: 48.0, 43.0, 44.3 TJ/Gg) → kg of CO₂, CH₄, N₂O with the IPCC 2006 factors (Tables 2.3, 3.2.1, 3.2.2) → CO₂e with the AR6 GWPs of the GHG Protocol document. The 2023 calculation document does the same with the 2023 densities (natural gas 0.795, LPG 531.098).
* **Refrigerants:** AR6 GWPs (R-134a 1 530, R-22 1 960, R-32 771, R-410A 2 256).
* **Electricity:** 0.478 t CO₂e/MWh (the ministry's 2022 distribution factor) for a 2024 inventory.
* **Scope 3:** DEFRA 2024 rows; flights **without** radiative forcing.

## Compared with the platform before this change

| Item | Client | Platform | |
|---|---|---|---|
| Road diesel, kg/L (2024) | 2.6886 | GHG row 2.6902 — withheld | same method, row was withheld for its density |
| Petrol, kg/L (2024) | 2.3462 | GHG row 2.3614 — withheld | DEFRA NCV instead of IPCC NCV |
| Natural gas, kg/m³ | 2.1502 (2024), 2.1429 (2023) | 1.9396 (national NCV per m³, TUR_NID_2024) | 10 % lower |
| R-134a / R-22 / R-32 / R-410A | 1 530 / 1 960 / 771 / 2 256 | GHG rows 1 530 / 1 960 / 771 / 2 255.5 | equal |
| Plastic, domestic waste, water, wastewater, hotel (Türkiye) | 3.16478, 0.497045, 0.153, 0.186, 32 | DEFRA 2024 rows 3.16478, 0.49704, 0.15311, 0.18574, 32.1 | equal |

## Change made (owner: "the factors must be right for every year, for every standard")

1. **IPCC and GHG Protocol, fuel per litre and per m³:** rebuilt with the client's method — IPCC factor × IPCC NCV × the DEFRA density **of the inventory year**, one row per year 2014–2026 (densities copied from the "Fuel properties" sheet of each edition, downloaded from gov.uk). The 22 withheld per-litre rows are released; the natural-gas row no longer uses the national NCV. Check values: LPG 2023 = 1.586495 (client's 2023 document: 1.58652), natural gas 2023 = 2.142848 (client: 2.142882), road diesel 2024 = 2.688215 (client: 2.6886), petrol 2024 = 2.345875 (client: 2.3462).
2. **Turkish grid electricity:** the ministry's 2020 form added (0.427 / 0.462). Inventory year → edition: ≤ 2021 → 2020, 2022 → 2022, ≥ 2023 → 2023.

## Differences left as they are, for the client to decide

| # | Item | Platform | Client's documents |
|---|---|---|---|
| 1 | Natural gas per m³: which energy content | client's method (≈ 38.2 MJ/m³ in 2024) | TUR_NID_2024 gives 34.54 MJ/m³ (net); the client's method is about 10 % higher. Both are in the client's sources. |
| 2 | CH₄ of natural gas, stationary | 1 kg/TJ (IPCC Table 2.3 as published) | 5 kg/TJ, cited as Table 2.3 (that value is Table 2.4's). Effect 0.2 %. |
| 3 | CH₄ GWP for combustion | 27.0 (the GHG Protocol document assigns "non-fossil" to combustion) | 29.8 in the 2024 report, 27.9 in the 2023 document. Effect < 0.1 %. |
| 4 | "IPCC" standard GWP set | AR5 | the client's IPCC-method calculations use AR6, which is the platform's "GHG Protocol" standard |
| 5 | Flights | DEFRA "with RF" rows (DEFRA's recommendation), international non-UK | "without RF"; short-haul and international rows |
| 6 | Electricity for a 2024 inventory | 0.469 (2023 form) | 0.478 (2022 form) |
| 7 | T&D losses | no Turkish factor | a share of the electricity emissions: 15 % (2023), 11 % (2024) |
| 8 | Paper and board | one "mixed" row | paper 1 339.32 and board 1 193.97 kg/t separately; plastic film 2 910.47 |

Two figures of the 2024 report look like transcription errors and were not used: GWP of FM200 (HFC-227ea) "25,056" (AR6: 3 600) and of N₂O "27" (273).

## Also done the same day, without waiting for the client

* **Grid forms:** the ministry's page (`enerji.gov.tr/evced-cevre-ve-iklim-elektrik-uretim-tuketim-emisyon-faktorleri`) lists the periods 2020, 2022 and 2023 only. All three are in the platform; a 2021 or 2024 form does not exist to add.
* **Refrigerant and other fugitive gases (question 62)** were never calculated. On a factor standard they now are: refill (kg) × the gas's GWP of that standard, as in the client's 2024 report (Table 12). A catalogue inventory is unchanged.
* **The emissions report** (`emissions/report_pdf.py`) now states uncalculated Scope 1 / 2 amounts as the ISO report does.
