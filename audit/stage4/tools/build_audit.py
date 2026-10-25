"""Build audit/stage4/factor_audit.csv: every factor in the catalog, stored values from the catalog itself,
usage from the disposable dev copy, findings hand-entered below (evidence IDs refer to evidence_manifest.md)."""
import csv, os, re, sqlite3, sys

SP = r"C:/Users/UP/AppData/Local/Temp/claude/D--ACADEMIA-PROJECTS-CARBONLESS/b954cafe-f9a3-4334-be50-4ecff1db1b77/scratchpad/s4"
OUT = r"D:/ACADEMIA PROJECTS/CARBONLESS/carbonless/audit/stage4/factor_audit.csv"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# evidence_class: V verified primary | D discrepant vs primary | S secondary/derived only | U unverified (nothing checkable
# cited or located) | X unverifiable here (licensed or primary inaccessible) | P pass-through, not a factor
KEEP = 'Keep. No action.'
DEC_VAL = 'Owner decision: correct to the published value and relabel; {n}'
DEC_LABEL = 'Owner decision: relabel the source/reference so it states what the value is; value unchanged'
FIND_SRC = 'Obtain the primary source for this value; until then show it in reports as an unverified estimate'

# key: slug or (slug, country) or (slug, country, year).  value: (class, published_value or None, published_unit, doc, row/page,
#      conversion, finding, action)
C = {}
def add(keys, *row):
    for k in (keys if isinstance(keys, list) else [keys]):
        C[k] = row

# ---------- VERIFIED ----------
add(('turkey-grid-transmission', 'turkey'), 'V', 0.436, 'tCO2-eq/MWh', 'E-ETKB23', 'p.2 "Elektrik Tuketim Noktasi Emisyon Faktorleri - Iletim Hattindan Bagli" (CO2-esd. column)', 'tCO2e/MWh = kg CO2e/kWh (x1)',
    'Exact match. Publisher: T.C. Enerji ve Tabii Kaynaklar Bakanligi, form ETKB-EVCED-FRM-042 Rev.01 (calculation period 2023). CO2-only value is 0.433; the CO2-equivalent 0.436 is stored. Location-based, consumption-point basis (includes network losses and imports). Only the 2023 edition is held: later reporting years use it and are disclosed as estimates.', KEEP)
add(('turkey-grid-distribution', 'turkey'), 'V', 0.469, 'tCO2-eq/MWh', 'E-ETKB23', 'p.2 "... Dagitim Hattindan Bagli" (CO2-esd. column)', 'x1',
    'Exact match (CO2-only 0.465). Same document and basis as the transmission factor.', KEEP)
add(('hotel-turkey', 'turkey'), 'V', 32.1, 'kg CO2e / room night', 'E-DESNZ24', 'ID 29_600_4051_13_1 (Hotel stay, Turkey)', 'none', 'Exact match.', KEEP)
add(('water-supply', 'global'), 'V', 0.15311, 'kg CO2e / m3', 'E-DESNZ24', 'ID 17_404_4005_1_1', 'none', 'Exact match. UK water-company average; geography is UK, applied to all companies.', 'Keep; note UK geography in the methodology statement.')
add(('water-treatment', 'global'), 'V', 0.18574, 'kg CO2e / m3', 'E-DESNZ24', 'ID 18_405_4006_1_1', 'none', 'Exact match. UK average; applied to all companies.', 'Keep; note UK geography.')
add([('propane', 'global'), ('propane', 'turkey')], 'V', 2.99763233, 'kg CO2e / kg (DESNZ: 2,997.63233 per tonne)', 'E-DESNZ24', 'ID 1_100_1007_15_1', '/1000 tonne->kg', 'Match to 6 decimals.', KEEP)
for slug, rid, pub in [('electrical-fridges', '19_503_5076_15_1', 4.36333333), ('electrical-it', '19_503_5084_15_1', 24.86547556),
                       ('electrical-large', '19_503_5080_15_1', 3.267), ('electrical-small', '19_503_5088_15_1', 5.64794563),
                       ('glass', '19_501_5056_15_1', 1.40276667), ('metal-aluminium', '19_504_5104_15_1', 9.10691851),
                       ('metal-mixed-cans', '19_504_5108_15_1', 5.10563851), ('metal-steel-cans', '19_504_5116_15_1', 2.85491851),
                       ('mineral-oil', '19_500_5036_15_1', 1.401), ('paper-mixed', '19_506_5160_15_1', 1.28274402),
                       ('plastic-average', '19_505_5120_15_1', 3.16478049), ('plastic-hdpe', '19_505_5132_15_1', 3.08639038),
                       ('wood', '19_500_5048_15_1', 0.26950416)]:
    add((slug, 'global'), 'V', pub, 'kg CO2e / kg (DESNZ per tonne)', 'E-DESNZ24', f'ID {rid} (Material use, PRIMARY material production)', '/1000 tonne->kg',
        'Match. Basis is virgin (primary) material production; DESNZ also publishes closed-loop (recycled-content) values that the catalog does not use.',
        'Keep. Methodology statement should say "primary production, no recycled content".')
add(('uk-grid', 'global', 2024), 'V', 0.20705, 'kg CO2e / kWh', 'E-DESNZ24', 'ID 7_400_4000_5_1 (Electricity: UK)', 'rounded to 3 dp in the catalog', 'Match (rounding -0.02%).', KEEP)
add(('uk-grid', 'global', 2025), 'V', 0.177, 'kg CO2e / kWh', 'E-DESNZ25', 'ID 7_400_4000_5_1', 'none', 'Exact match.', KEEP)
add(('uk-transmission-losses', 'global'), 'V', 0.01853, 'kg CO2e / kWh', 'E-DESNZ25', 'ID 13_402_4000_5_1 (T&D, Electricity: UK)', 'none', 'Exact match.', KEEP)
add(('hfc-227ea', 'global'), 'D', 3350, 'kg CO2e / kg (GWP100)', 'E-DESNZ24 + E-GHGP-GWP', 'DESNZ 3_200_2036_3_1 = 3350 (AR5); GHGP table AR4 3220 / AR5 3350 / AR6 3600',
    'none', 'Equals DESNZ 2024 and the AR5 value, but the reference says "AR6" and the ISO report says every gas uses AR6 (AR6 = 3,600, +7.5%).', 'Owner decision: choose one GWP assessment report for all gases and state it (see GWP note below).')

# ---------- DISCREPANT vs primary ----------
GWP = 'Stored value is the AR4 GWP (GHGP table AR4/AR5/AR6) and is labelled "AR6 GWP100"; DESNZ 2024 uses AR5. The ISO report states all gases use AR6.'
add(('r134a', 'global'), 'D', 1530, 'kg CO2e / kg (AR6 GWP100)', 'E-GHGP-GWP', 'HFC-134a: AR4 1430 / AR5 1300 / AR6 1530; DESNZ 2024 3_200_2024_3_1 = 1300', 'none', GWP + ' AR6 would be +7.0%.', 'Owner decision: GWP basis (AR4/AR5/AR6) for refrigerants.')
add(('r32', 'global'), 'D', 771, 'kg CO2e / kg (AR6)', 'E-GHGP-GWP', 'HFC-32: 675 / 677 / 771; DESNZ 3_200_2012_3_1 = 677', 'none', GWP + ' AR6 would be +14.2%.', 'Owner decision: GWP basis.')
add(('r22', 'global'), 'D', 1960, 'kg CO2e / kg (AR6)', 'E-GHGP-GWP', 'HCFC-22: 1810 / 1760 / 1960; DESNZ 3_202_2388_3_1 = 1760 (non-Kyoto)', 'none', GWP + ' AR6 would be +8.3%. HCFC-22 is a Montreal-Protocol gas, outside the six Kyoto gases of ISO 14064-1/GHG Protocol totals.', 'Owner decision: GWP basis, and whether non-Kyoto gases belong in the total.')
add(('r404a', 'global'), 'D', 4728, 'kg CO2e / kg (AR6 blend: .44 R125 + .52 R143a + .04 R134a)', 'E-GHGP-GWP', 'AR4 blend = 3922 (matches stored); DESNZ 3_201_2120_3_1 = 3943 (AR5)', 'blend arithmetic from GHGP component GWPs',
    'Stored 3922 is the AR4 blend. AR6 blend computes to 4,728 (+20.6%).', 'Owner decision: GWP basis.')
add(('r407c', 'global'), 'D', 1908, 'kg CO2e / kg (AR6 blend: .23 R32 + .25 R125 + .52 R134a)', 'E-GHGP-GWP', 'AR4 blend = 1774 (matches stored); DESNZ 3_201_2135_3_1 = 1624 (AR5)', 'blend arithmetic', 'Stored 1774 is the AR4 blend; AR6 = 1,908 (+7.5%).', 'Owner decision: GWP basis.')
add(('r410a', 'global'), 'D', 2255.5, 'kg CO2e / kg (AR6 blend: .5 R32 + .5 R125)', 'E-GHGP-GWP', 'AR4 blend = 2088 (matches stored); DESNZ 3_201_2156_3_1 = 1924 (AR5)', 'blend arithmetic', 'Stored 2088 is the AR4 blend; AR6 = 2,255.5 (+8.0%).', 'Owner decision: GWP basis.')
add(('sf6', 'global'), 'D', 24300, 'kg CO2e / kg (GHGP AR6 column)', 'E-GHGP-GWP', 'SF6: AR4 22,800 / AR5 23,500 / AR6 24,300; DESNZ 3_200_2075_3_1 = 23,500', 'none',
    'Stored 25,200 is in none of the three GHGP columns. 25,200 is the figure I recall from IPCC AR6 WG1 Ch.7 Table 7.15, which I did not retrieve in this stage, so the difference (+3.7% vs 24,300) is unresolved.', 'Confirm against IPCC AR6 WG1 Ch.7 (Tables 7.15 / 7.SM.7), then state the basis.')
add(('r432a', 'global'), 'U', 1.8, 'kg CO2e / kg', 'E-DESNZ24', 'ID 3_201_2259_3_1 = 1.8 (non-Kyoto, R432A blend)', 'none', 'Stored 1940 is not DESNZ 2024 (1.8, which is non-Kyoto only; the Kyoto total is not published separately here). Origin not located.', FIND_SRC)
add(('r600a', 'global'), 'V', 3, 'kg CO2e / kg', 'E-DESNZ24', 'ID 3_204_2475_3_1 (R600A = isobutane)', 'none', 'Match.', KEEP)
add([('natural-gas-m3', 'global'), ('natural-gas-m3', 'turkey')], 'D', 2.04542, 'kg CO2e / m3', 'E-DESNZ24 (+E-DEFRA20)', 'DESNZ 2024 ID 1_100_1004_1_1 = 2.04542; DEFRA 2020 flat file = 2.02266', 'none',
    'Stored 2.02 is the DEFRA 2020 value (2.02266) rounded, labelled "DEFRA 2024". Also differs from 2023 (2.03839) and 2025 (2.06672). USED by existing inventories and printed in the ISO report as "DEFRA 2024 - 2.02".', DEC_VAL.format(n='affects every natural-gas m3 entry (+1.26%)'))
add([('lpg', 'global'), ('lpg', 'turkey')], 'D', 1.55713, 'kg CO2e / litre', 'E-DESNZ24', 'ID 1_100_1003_8_1', 'none',
    'Stored 1.51468 matches no edition 2020 (1.55537), 2023 (1.55713), 2024 (1.55713), 2025 (1.55713). Origin not located. -2.7%.', DEC_VAL.format(n='USED; +2.8% on LPG entries'))
add([('diesel-kwh', 'global')], 'D', 0.25649, 'kg CO2e / kWh (gross CV)', 'E-DESNZ24', 'ID 1_101_1014_6_1 (Gas oil)', 'none', 'Stored 0.24882 matches neither 2023 nor 2024 (both 0.25649): -3.0%.', DEC_VAL.format(n='+3.1%'))
add([('natural-gas-kwh', 'global'), ('natural-gas-kwh', 'turkey')], 'D', 0.1829, 'kg CO2e / kWh (gross CV)', 'E-DESNZ24', 'ID 1_100_1004_6_1', 'none', 'Stored 0.18316 vs 0.1829 (2024) / 0.18293 (2023): +0.14%, immaterial. Note: DESNZ publishes gross-CV and net-CV (0.20264) values; the catalog does not say which basis users should enter.', 'Keep or align; state gross/net CV basis.')
add([('coal-industrial', 'global'), ('coal-industrial', 'turkey')], 'D', 2.39944, 'kg CO2e / kg (DESNZ per tonne)', 'E-DESNZ24', 'ID 1_102_1025_15_1 (Coal, industrial)', '/1000', 'Stored 2.40739: +0.33% (2023 value 2.39648). Immaterial.', 'Keep or align.')
add([('off-road-diesel-desnz', 'global'), ('on-road-diesel-desnz', 'global')], 'D', 2.75541, 'kg CO2e / litre (gas oil; mineral diesel 2.66155; blend 2.51279)', 'E-DESNZ24', 'IDs 1_101_1014_8_1 / 1_101_1012_8_1 / 1_101_1011_8_1', 'none',
    'CONFIRMED INTERNAL INCONSISTENCY: the catalog holds 2.68 (stationary diesel), 2.696 (on-road) and 3.17939 (off-road) for diesel per litre; 3.17939 is +15% over DESNZ gas oil and +19% over mineral diesel, +18.6% over the catalog\'s own 2.68. Nearest published numbers: DESNZ fuel oil 3.17493 per litre, IPCC-2019 diesel 74.4 kg/GJ x 42.7 MJ/kg = 3.18 per KG. Origin not established. Used for off-road machines (EQ-3B-11..16) diesel litres; on-road-diesel-desnz is registered but the engine uses motorin-mobile.',
    DEC_VAL.format(n='USED by off-road diesel litre entries (overstated about 15-19%)'))
add([('off-road-gasoline-desnz', 'global'), ('on-road-petrol-desnz', 'global')], 'D', 2.35372, 'kg CO2e / litre (100% mineral petrol; blend 2.0844)', 'E-DESNZ24', 'ID 1_101_1018_8_1 / 1_101_1017_8_1', 'none', 'Stored 2.30233: -2.2% vs mineral petrol, +10.5% vs average blend. No edition holds 2.30233.', 'Owner decision: value and blend basis.')
add(('cement-clinker', 'global'), 'D', 520, 'kg CO2 / t clinker', 'E-IPCC-V3C2', 'IPCC 2006 Vol.3 Ch.2 Eq. 2.4: EFclc = 0.51 x 1.02 (CKD) = 0.52 t CO2/t', 'x1000',
    'Stored 525 is labelled IPCC 2006; IPCC gives 0.52. 525 is the cement-industry (WBCSD/CSI) protocol default per a secondary source (California Climate Registry comparison, not retrieved). +0.96%. USED: the single largest existing entry.',
    DEC_VAL.format(n='50,000 t entry: 250 t CO2e lower'))
add(('flight-long-business', 'global'), 'D', 0.39044, 'kg CO2e / passenger-km (DESNZ "International, to/from non-UK", RF incl.)', 'E-DESNZ24', 'ID 21_316_3184_11_1; long-haul to/from UK 0.58028 (3174), without RF 0.34252', 'none',
    'Stored 0.429 is documented as "Economy x ~2.9" and appears in no edition 2023-2025. Geography: DESNZ long-haul rows are to/from the UK; "to/from non-UK" is the applicable set for a Turkish company. 2025 edition values are lower (0.31656).', 'Owner decision: adopt a published class and edition (non-UK international), state RF treatment.')
add(('flight-long-economy', 'global'), 'D', 0.13465, 'kg CO2e / passenger-km (non-UK, RF incl.)', 'E-DESNZ24', 'ID 21_316_3180_11_1', 'none', 'Stored 0.148 ("RFI included") equals the catalog\'s own ICAO row (flight-international 0.148); not a DESNZ value.', 'Owner decision, as above.')
add(('biodiesel', 'global'), 'D', 0.16751, 'kg CO2e / litre (excl. biogenic CO2 2.39)', 'E-DESNZ24', 'ID 2_103_1032_8_1', 'none', 'Stored 0.03639 is -78% vs the published fossil-origin share. Reference says "biogenic CO2 excluded". Biogenic CO2 is reported separately (outside scopes) per DESNZ.', DEC_VAL.format(n='not used in dev data'))
add(('bioethanol', 'global'), 'D', 0.00901, 'kg CO2e / litre', 'E-DESNZ24', 'ID 2_103_1031_8_1', 'none', 'Stored 0.02719 is 3.0x the published value.', DEC_VAL.format(n='not used in dev data'))
add(('wood-pellets', 'global'), 'D', 0.05433654, 'kg CO2e / kg (DESNZ per tonne 54.33654)', 'E-DESNZ24', 'ID 2_104_1045_15_1', '/1000', 'Stored 0.01553 is -71% (2023 edition 0.05156).', DEC_VAL.format(n='not used in dev data'))
add(('biogas', 'global'), 'D', 0.00023, 'kg CO2e / kWh', 'E-DESNZ24', 'ID 2_105_1047_5_1', 'none', 'Stored 0.00022 equals the 2023 edition; 2024 = 0.00023. Immaterial.', 'Keep or align.')
add(('wfh-day', 'global'), 'D', 2.67024, 'kg CO2e / 8-hour day (DESNZ 0.33378 per FTE working hour x 8)', 'E-DESNZ24', 'ID 32_603_9999_12_1', 'x8 h (assumption: the hours-per-day is not published)', 'Stored 0.79 per day cannot be reproduced from DESNZ at any whole-hour day length (2.37 h). Unit/assumption undocumented.', 'Owner decision: per-hour factor x stated hours.')
add(('hotel-uk', 'global'), 'D', 10.4, 'kg CO2e / room night', 'E-DESNZ24', 'ID 29_600_4000_13_1', 'none', 'Stored 10.5: +1.0%. Immaterial.', 'Keep or align.')
add(('hotel-global-avg', 'global'), 'U', None, '', 'E-DESNZ24', 'no global-average or luxury row exists (rows are per country)', '', 'Cited as DEFRA 2024 but DESNZ publishes no "global average" hotel factor.', FIND_SRC)
add(('hotel-luxury', 'global'), 'U', None, '', 'E-DESNZ24', 'no luxury-class row exists', '', 'Cited as DEFRA 2024 but DESNZ publishes no hotel class factor.', FIND_SRC)
add(('ferry-travel', 'global'), 'D', 0.01871, 'kg CO2e / passenger-km (foot passenger; "average (all passenger)" is 0.1127)', 'E-DESNZ24', 'ID 23_318_3188_11_1 / 23_318_3190_11_1', 'none', 'Stored 0.019 matches FOOT passenger but the reference says "coastal/ferry passenger average" (0.1127, 5.9x).', 'Owner decision: which ferry class.')
for slug in ('cleaning-services', 'food-catering', 'it-telecom-services', 'legal-accounting', 'marketing-advertising'):
    add((slug, 'global'), 'D', None, 'kg CO2e / USD', 'E-DESNZ24', 'searched all 8,741 rows: no spend-based (USD/GBP) factor exists', '',
        'Attributed to "DEFRA 2024" but the 2024 workbook publishes no spend-based factors. Source not located. USED (legal-accounting appears in the ISO report as "DEFRA 2024 - professional services").', 'Replace with a citable spend-based set (e.g. an EEIO database) or flag as an estimate.')
add(('wt-01-landfill', 'global'), 'D', 1.16439, 'kg CO2e / kg (DESNZ per tonne 1,164.39)', 'E-DESNZ24', 'ID 20_506_5453_15_1 (Paper and board: mixed, Landfill)', '/1000', 'Stored 1.29 (+10.8%); reference is an internal catalogue ID only.', DEC_VAL.format(n='USED (6.5 kg in dev data)'))
add(('general-landfill', 'global'), 'D', 0.52033, 'kg CO2e / kg (C&I waste landfill; household 0.49704)', 'E-DESNZ24', 'ID 20_507_5313_15_1 / 20_507_5285_15_1', '/1000', 'Stored 0.57 has no reference; +9.5% vs C&I landfill.', DEC_VAL.format(n='USED (1,140 kg in dev data)'))
add(('fuel-extraction', 'global'), 'S', 0.61101, 'kg CO2e / litre (WTT diesel, average blend)', 'E-DESNZ24', 'ID 11_101_1011_8_1 (mineral 0.62409)', 'none', 'Cited as "GHG Protocol - Scope 3 Cat 3 estimate" (the GHG Protocol publishes no factors). Stored 0.6 is within -1.8% of the DESNZ WTT value for diesel, so plausible, but it is applied to every fuel.', 'Relabel with the DESNZ WTT row, or flag as an estimate.')
add(('fuel-oil', 'global'), 'S', 3.17493, 'kg CO2e / litre', 'E-DESNZ24', 'ID 1_101_1013_8_1', 'none', 'Stored 3.18 (labelled IPCC 2006); DESNZ 2024 3.17493 (2020: 3.18317): within 0.2%.', 'Relabel source, or keep.')

# ---------- IPCC-derived ----------
add([('diesel', 'global'), ('diesel', 'turkey')], 'S', 2.66155, 'kg CO2e / litre (DESNZ mineral diesel); IPCC CO2 only = 74,100 kg/TJ x 43.0 TJ/Gg = 3,186 kg/t', 'E-IPCC-V2C2 + E-IPCC-V2C1 + E-DESNZ24', 'IPCC 2006 Vol.2 Ch.2 Table 2.3 (74,100), Ch.1 Table 1.2 (43.0)', '/density 0.841 kg/L (assumed; not in IPCC)',
    'Reproduces 2.68 only with an undocumented density of about 0.841 kg/L. +0.7% vs DESNZ mineral diesel. CH4/N2O add 0.2-0.4% on top of CO2-only.', 'Document the density assumption in the reference.')
add([('coal', 'global')], 'S', 2.441, 'kg CO2 / kg (other bituminous: 94,600 kg/TJ x 25.8 TJ/Gg)', 'E-IPCC-V2C1 + E-IPCC-V2C2', 'Table 2.3 / Table 1.2', 'none', 'Stored 2.42 is within -0.9% of the IPCC other-bituminous value; the coal type is not stated.', 'State the coal type.')
for slug in ('aluminium-smelting', 'ammonia-production', 'glass-production', 'lime-production', 'nitric-acid', 'steel-bof', 'steel-eaf', 'co2-fire-suppression'):
    add((slug, 'global'), 'U', None, '', 'E-IPCC (Vol.3 Ch.3-4 NOT retrieved)', '', '', 'Process-emission factors citing IPCC 2006 Vol.3; the chapters were not retrieved in this stage.', 'Verify against IPCC 2006 Vol.3 Ch.2-4.')

# ---------- unverifiable here / company specific / etc. are applied by rule below ----------
RULES = [
    ('P', lambda r: r['source'] == 'custom', 'Pass-through "calculated-*" row: quantity = kg CO2e entered or derived elsewhere; not an emission factor.', 'No factor to verify. The CO2e comes from the declaration, supplier or report it names.'),
    ('U', lambda r: r['source'] == 'atom_kablo', 'Source is one company\'s own inventory ("Turkey ISO 14064-1 verified inventory"), used as the country default for every company. Cannot be verified, and "verified" cannot be confirmed.', 'Owner decision: replace with a published factor, or label as company-specific and exclude from defaults.'),
    ('X', lambda r: r['source'] == 'iea_2024', 'IEA Emissions Factors is licensed data; the primary was not accessible. Value not verified.', 'Verify against the licensed IEA dataset or a national publisher; until then disclose as unverified.'),
    ('U', lambda r: 'CarbonIQ EF Katalogu' in (r['reference'] or ''), 'Reference is an internal catalogue ID (CarbonIQ EF Katalogu EF-xxx); the catalogue is not part of the codebase or public. The "source" label says DEFRA/other but nothing citable backs it.', 'Provide the catalogue or cite the primary row; until then disclose as unverified.'),
    ('U', lambda r: r['source'] == 'generic', 'Cited as "GHG Protocol - Scope 3 Cat N estimate" (the GHG Protocol publishes no emission factors) or nothing.', 'Replace with a citable factor or flag as an estimate.'),
    ('U', lambda r: r['source'] == 'turkey_fleet', 'Reference is a description ("Turkey fleet 2025", "Turkish Airlines 2025") with no document.', FIND_SRC),
    ('U', lambda r: r['source'] == 'turkey_grid', 'No citable document (waste/heating rows: empty or "Turkey ... 2025" reference; year field says 2023).', FIND_SRC),
    ('X', lambda r: r['source'] == 'icao', 'ICAO publishes route-level calculator results, not a per-km factor; primary not retrievable as a factor.', FIND_SRC),
    ('U', lambda r: r['source'] == 'ipcc_2019', 'Cites IPCC 2019 Refinement; the volume was not retrieved in this stage.', 'Verify against IPCC 2019 Refinement Vol.2 Ch.2-3.'),
    ('U', lambda r: r['source'] == 'ipcc_2006', 'Cites IPCC 2006; the specific table was not retrieved in this stage.', 'Verify against IPCC 2006.'),
    ('U', lambda r: r['source'] == 'defra_2024', 'Names DEFRA/DESNZ 2024 but was not matched to a workbook row in this stage.', 'Match to a DESNZ row ID.'),
    ('U', lambda r: True, 'Not assessed.', 'Not assessed.'),
]
SPECIAL = {
    ('turkey-grid', 'turkey'): ('U', 'tCO2e/MWh national GENERATION average', 'E-ETKB20/22/23', 'Matches no edition: ETKB generation CO2e 2020 0.420, 2022 0.442, 2023 0.434 (CO2 0.417/0.438/0.430). 2021 and 2024+ editions not located at the Ministry URLs.',
        'SUPERSEDED (inactive). Different system boundary from the ministry consumption-point factors that replaced it (generation vs consumption incl. losses): 0.4199 is 10.5% below distribution 0.469 and 3.7% below transmission 0.436. Entries saved before the replacement keep it until the inventory is saved again (owner decision); 2 such approved entries (25,194 kg) exist in the dev copy: they would be +2,946 kg (distribution) or +966 kg (transmission). Origin of 0.4199 unresolved.',
        'Owner decision: re-save legacy entries (or migrate with approval) so one inventory does not mix generation and consumption-point bases.'),
    ('tm-01', 'global'): ('X', 'GLEC Framework v3 Tier 1 default, 40 t HGV full load', 'E-GLEC (not retrieved)', 'PRIMARY INACCESSIBLE: smart-freight-centre S3 host refused this environment. Secondary summaries disagree (about 62 / 101 / 125 g per tkm by version and class). DESNZ HGV all-average for context: 0.09752 kg/tkm (ID 27_304_3140_14_1).',
        'Labelled defra_2024 but cites GLEC/ISO 14083 via an internal ID. USED (tm-01-ds, 49,600 kg in dev data). 0.062 is -36% vs the DESNZ HGV average and well below the secondary GLEC figures.', 'Retrieve the GLEC v3.x table and cite the row; state the version.'),
}
SPECIAL[('tm-01-ds', 'global')] = SPECIAL[('tm-01', 'global')]
SPECIAL[('tm-02', 'global')] = ('X', 'GLEC default load, 40 t HGV 50% load', 'E-GLEC (not retrieved)', 'Primary inaccessible (see tm-01).', 'Same issue as tm-01; 0.123 is +26% vs the DESNZ HGV average 0.09752.', 'Retrieve the GLEC table.')
SPECIAL[('tm-02-ds', 'global')] = SPECIAL[('tm-02', 'global')]
for s in ('wt-01-recycling', 'wt-03-recycling', 'wt-04-recycling'):
    SPECIAL[(s, 'global')] = ('D', 'DESNZ waste disposal, recycling (closed-loop), per kg: +0.00641', 'E-DESNZ24 + E-DESNZ24-METH + E-GHGP-S3',
        'DESNZ 2024 ID 20_506_5450_15_1 etc.: +6.41061 kg CO2e/tonne; DESNZ methodology paper 12.29; GHG Protocol Scope 3 Standard Box 5.6 p.49',
        'NEGATIVE AVOIDED-EMISSION CREDIT, not a process emission (the catalog says so: "negative: recycling avoids virgin production"). DESNZ and the GHG Protocol give a small POSITIVE treatment figure and say avoided emissions must not be netted into Scope 3. See methodology_decision_negative_recycling.md. Value NOT changed.',
        'METHODOLOGY OWNER DECISION required (options in the decision record).')

def classify(r):
    key3, key2 = (r['slug'], r['country'], int(r['year'] or 0)), (r['slug'], r['country'])
    if key3 in C: return C[key3]
    if key2 in C: return C[key2]
    if key2 in SPECIAL:
        cls, pubunit, doc, row, finding, action = SPECIAL[key2]
        return (cls, None, pubunit, doc, row, '', finding, action)
    for cls, test, finding, action in RULES:
        if test(r):
            return (cls, None, '', {'X': 'licensed / inaccessible', 'U': '', 'P': ''}.get(cls, ''), '', '', finding, action)

URL = {'E-DESNZ24': 'https://assets.publishing.service.gov.uk/media/6722567c10b0d582ee8c4953/ghg-conversion-factors-2024-FlatFormat_v1_1.xlsx',
       'E-ETKB23': 'https://enerji.gov.tr/Media/Dizin/EVCED/tr/%C3%87evreVe%C4%B0klim/%C4%B0klimDe%C4%9Fi%C5%9Fikli%C4%9Fi/EmisyonFaktorleri/2023_Turkiye_Elektrik_UretimiveElektrik_Tuketim_Noktasi_Emisyon_Faktorleri.pdf',
       'E-DESNZ25': 'https://assets.publishing.service.gov.uk/media/6846b6ea57f3515d9611f0dd/ghg-conversion-factors-2025-flat-format.xlsx',
       'E-IPCC-V3C2': 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/3_Volume3/V3_2_Ch2_Mineral_Industry.pdf',
       'E-GHGP-GWP': 'https://ghgprotocol.org/sites/default/files/2024-08/Global-Warming-Potential-Values%20%28August%202024%29.pdf'}

db = sqlite3.connect(f"file:{SP}/catalog.sqlite3?mode=ro", uri=True); db.row_factory = sqlite3.Row
usage = {}
for r in db.execute("select f.slug,f.country,f.year,count(e.id) n,sum(e.calculated_co2e_kg) kg from emissions_emissionentry e join emissions_emissionfactor f on f.id=e.emission_factor_id group by f.id"):
    usage[(r['slug'], r['country'], r['year'])] = (r['n'], round(r['kg'], 1))
rows = db.execute("select * from emissions_emissionfactor order by source, slug, country, year").fetchall()
cols = ['factor_id', 'slug', 'name', 'country', 'stored_year', 'unit', 'stored_value', 'stored_source_label', 'stored_reference', 'active_default',
        'used_in_dev_data(entries;kg)', 'evidence_class', 'published_value_in_stored_unit', 'published_unit_and_basis', 'source_document', 'source_row_or_page', 'source_url',
        'conversion_applied', 'discrepancy_abs', 'discrepancy_pct', 'finding', 'recommended_action(no change made)']
counts = {}
with open(OUT, 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh); w.writerow(cols)
    for r in rows:
        cls, pub, pubunit, doc, rowid, conv, finding, action = classify(dict(r))
        counts[cls] = counts.get(cls, 0) + 1
        stored = float(r['factor_kg_co2e'])
        dabs = dpct = ''
        if isinstance(pub, (int, float)) and pub:
            dabs, dpct = round(stored - pub, 6), round(100 * (stored - pub) / pub, 2)
        u = usage.get((r['slug'], r['country'], r['year']))
        urls = [URL[k] for k in URL if k in (doc or '')]
        w.writerow([r['id'], r['slug'], r['name'], r['country'], r['year'], r['unit'], stored, r['source'], (r['reference'] or '').replace('\n', ' '),
                    f"{'Y' if r['is_active'] else 'N'}/{'Y' if r['is_default'] else 'N'}", f'{u[0]};{u[1]}' if u else '', cls,
                    pub if pub is not None else '', pubunit, doc, rowid, ' | '.join(urls), conv, dabs, dpct, finding, action])
print('rows', len(rows), 'classes', counts)
