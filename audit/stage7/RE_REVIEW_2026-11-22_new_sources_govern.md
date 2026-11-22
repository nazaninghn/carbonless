# Re-review of the 48 unresolved DEFRA mappings

Date: 2026-11-22. Basis given by the owner: **the five sources supplied by the client are the data; the earlier catalogue values and the decisions recorded against them are not binding.**

Consequence for this review: a DEFRA mapping is judged against what DEFRA itself publishes and prescribes (2026 methodology paper), not against the earlier register (DR-01 … DR-22) or the owner's 2023 calculation document. `DEFRA_mapping_review.xlsx` in this folder is the earlier review and is kept as the record; where it called a row unresolved only because of an earlier decision, that reason no longer applies.

Result: **33 rows are selectable again, 15 stay withheld.** The withheld list and reasons are in `carbonless_backend/emissions/data/withheld_factors.json`.

## Released unchanged (18)

| Slugs | Why the DEFRA row stands |
|---|---|
| `truck-freight`, `truck-delivery` | The activity is in tonne-km; DEFRA's row for that unit is "HGV, all HGVs, average laden, per tonne.km" |
| `general-landfill`, `landfill` | A company's general waste is DEFRA's "Commercial and industrial waste", landfill |
| `wt-01-recycling`, `wt-03-recycling`, `wt-04-recycling` | DEFRA's method: recycling emissions are attributed to the user of the recycled material; the waste producer counts collection only (methodology 2026, para 12.22). The earlier negative credits are not DEFRA's |
| `bioethanol`, `wood-pellets` | Same DEFRA bioenergy item and unit |
| `gasoline-generic`, `on-road-petrol-desnz`, `off-road-gasoline-desnz` | DEFRA's forecourt petrol row, "average biofuel blend". **Caveat:** it embeds the UK ethanol share; the "100% mineral" row is 13% higher |
| `off-road-diesel-desnz` | DEFRA's off-road diesel is gas oil |
| `road-travel` | "Average car, unknown fuel", per km |
| `air-freight`, `flight-international` | "International, to/from non-UK", with radiative forcing: DEFRA recommends applying the multiplier to all flights (paras 8.42–8.44) |

## Re-mapped to the row DEFRA publishes for the item (15)

| Slugs | From | To | Why |
|---|---|---|---|
| `flight-short-economy`, `flight-long-economy` | Short- / long-haul, to/from UK, economy | International, to/from non-UK, Economy class | A company outside the UK flies between non-UK countries; DEFRA publishes this row for that (para 8.10). It has no haul split |
| `flight-long-business`, `flight-long-first` | Long-haul, to/from UK | International, to/from non-UK, Business / First class | Same |
| `flight-short`, `flight-medium`, `flight-long` | Short- / long-haul, to/from UK, average | International, to/from non-UK, Average passenger | Same |
| `tm-07`, `tm-07-ds`, `tm-07-short`, `tm-07-short-ds` | Freight flights, to/from UK | Freight flights, International, to/from non-UK | Same; DEFRA has one non-UK air-freight row |
| `tm-04`, `tm-04-ds` | Container ship, Average | Container ship, 8000+ TEU | The item is a ship above 10,000 TEU |
| `tm-05`, `tm-05-ds` | Container ship, Average | Container ship, 5000–7999 TEU | The item is 3,000–8,000 TEU; the 3000–4999 and 5000–7999 rows are equal in every edition |
| `wt-10-landfill`, `product-landfill` | Commercial and industrial waste, landfill | Household residual waste, landfill | Municipal waste, and products discarded by consumers, are household waste |

All flight and air-freight rows use the "With RF" tables.

## Still withheld (15)

`coal`, `district-heating`, `steam`, `transmission-losses`, `train`, `train-travel`, `train-commute`, `metro`, `metro-commute`, `flight-domestic`, `tm-08`, `tm-08-ds`, `diesel-kwh`, `biodiesel`, `fuel-extraction`.

These are wrong for a site outside the UK whatever the earlier decisions were: UK grid electricity or UK heat networks inside the number, UK coal standing for lignite, no DEFRA row for a domestic flight in another country, an electric-rail item against a diesel-average row, or one generic slug covering several DEFRA rows. They need a Turkish or fuel-specific source.

## Not done

- **ETKB 2022 grid factors** (transmission 0.445, distribution 0.478 t CO₂e/MWh) are not added. The catalogue holds the 2023 edition of the same form (0.436 / 0.469). Adding the 2022 rows is a change to the frozen catalogue: nine guard tests (`test_label_only_release`, `test_factor_provenance`, `test_stage3_oracle`) fail on it by design. It needs its own approved change.
- **TUR_NID_2024** is still unread beyond page 12. It is the likely source for Turkish fuel values (lignite, natural gas calorific value and density) that would release `coal` and the 24 withheld IPCC / GHG Protocol per-litre and per-m³ rows.
- The DEFRA dataset is generated outside the repository (from the gov.uk flat files and a slug map); the generator is not committed.
