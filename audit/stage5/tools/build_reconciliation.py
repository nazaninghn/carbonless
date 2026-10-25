"""Stage 5: reconcile every catalog factor against the user's documents.  Writes factor_reconciliation.csv.
Classes (the user's four, plus pass-through):
  A  correct: reproduced by / consistent with the documented methodology, or equal to the exact primary source it names
  B  attribution: label/source/year is wrong or unsupported, the numerical value may still be valid
  C  discrepancy: numerical / unit / GWP / method differs from the documented methodology (clear documentary evidence)
  D  unresolved: the provided documents do not establish provenance or applicability (missing evidence stated)
  P  pass-through (calculated-* rows)
match_quality: exact (<=0.05%) | tolerance (<=2%: parameter choice) | outside | n/a
"""
import csv, os, re, sys

SP5 = r"C:/Users/UP/AppData/Local/Temp/claude/D--ACADEMIA-PROJECTS-CARBONLESS/b954cafe-f9a3-4334-be50-4ecff1db1b77/scratchpad/s5"
S4 = SP5.replace('/s5', '/s4')
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

reg = {r['id']: r for r in csv.DictReader(open(f'{SP5}/out/documented_register.csv', encoding='utf-8-sig'))}
V = lambda i: float(reg[i]['value'])
cat = list(csv.DictReader(open(f'{S4}/catalog_full.csv', encoding='utf-8')))
st4 = {r['factor_id']: r for r in csv.DictReader(open(r"D:/ACADEMIA PROJECTS/CARBONLESS/carbonless/audit/stage4/factor_audit.csv", encoding='utf-8-sig'))}

D23 = 'ISO 14064-1 Hesaplama Dokumani ATOM KABLO 2023 (calc doc)'
UNC = 'BELIRSIZLIK HESABI DOKUMANI-2023 (sheet "1 aggregation - indirect")'
G24 = 'aaaa-genel_hesap_tablosu_2024 (supplementary, not in your list)'
D24U = 'DEFRA/DESNZ 2024 workbook you provided'
P23 = 'DEFRA 2023 condensed set (public, downloaded: confirms the calc doc\'s DEFRA-2023 values)'

K = {}   # key -> dict


def put(keys, cls, doc_id=None, doc_val=None, unit='', doc='', basis='', evidence='', missing='', dec='', primary='', mq=None):
    for k in (keys if isinstance(keys, list) else [keys]):
        K[k] = dict(cls=cls, doc_id=doc_id, doc_val=(V(doc_id) if (doc_val is None and doc_id and doc_id in reg) else doc_val), unit=unit, doc=doc,
                    basis=basis, evidence=evidence, missing=missing, dec=dec, primary=primary, mq=mq)


# ================= A: reproduced from the documents =================
put(('carton', 'turkey'), 'A', 'D-PAPER', doc=f'{D23}: 4.1 HAM. KULL.!E7 (868.0699 kg/t); {UNC} row "Karton"', basis='DEFRA 2023 Material use, Paper and board: mixed, PRIMARY production, per tonne /1000',
    evidence='Equals the document cell to 6 d.p. and equals the DEFRA 2023 row (primary-verified).', primary='DEFRA 2023 material use (verified)')
put([('chemical', 'turkey'), ('chemical-oil', 'turkey')], 'A', 'D-CHEM', doc=f'{D23}: 4.1 HAM. KULL.!E4 / E5 (2.04 kg/kg)', basis='Ecoinvent "Chemical" per the document (column G)',
    evidence='Equals the document cell. The underlying Ecoinvent dataset is not among the provided files, so the 2.04 itself is documented but not independently verifiable by me.', missing='(optional) the Ecoinvent dataset/version behind 2.04', primary='not verifiable (Ecoinvent)')
put(('foam-tape', 'turkey'), 'A', 'D-LDPE', doc=f'{D23}: 4.1 HAM. KULL.!E11 (2586.7273 kg/t)', basis='DEFRA 2023 Material use, Plastics LDPE/LLDPE primary, /1000', evidence='Equals the document cell; equals DEFRA 2023 row (primary-verified).', primary='DEFRA 2023 (verified)')
put(('metal-primary', 'turkey'), 'A', 'D-METAL-PRIM', doc=f'{D23}: 4.1 HAM. KULL.!E8 (4005.1378 kg/t)', basis='DEFRA 2023 Material use, Metals (construction), Primary, /1000', evidence='Equals the document cell; equals DEFRA 2023 row (primary-verified).', primary='DEFRA 2023 (verified)')
put(('metal-recycled', 'turkey'), 'A', 'D-METAL-CL', doc=f'{D23}: 4.1 HAM. KULL.!E9 (1558.9489 kg/t)', basis='DEFRA 2023 Material use, Metals, Closed-loop source, /1000', evidence='Equals the document cell; equals DEFRA 2023 row. It is the factor for PURCHASED recycled-content metal, not a recycling credit.', primary='DEFRA 2023 (verified)')
put(('plastic', 'turkey'), 'A', 'D-PLASTIC', doc=f'{D23}: 4.1 HAM. KULL.!E6 (3102.4485 kg/t); {UNC} row "Plastik"', basis='DEFRA 2023 Material use, Plastics: average plastics, primary, /1000', evidence='Equals the document cell; equals DEFRA 2023 row. (The global `plastic-average` 3.16478 is the DEFRA 2024 value: same material, different edition.)', primary='DEFRA 2023 (verified)')
put(('wood', 'turkey'), 'A', 'D-WOOD', doc=f'{D23}: 4.1 HAM. KULL.!E10 (312.6118 kg/t)', basis='DEFRA 2023 Material use, Wood, primary, /1000', evidence='Equals the document cell; equals DEFRA 2023 row.', primary='DEFRA 2023 (verified)')
put(('water-supply', 'turkey'), 'A', 'D-WATER-SUPPLY', doc=f'{D23}: 4.3.2 KULL.&ATIK SU!D4', basis='DEFRA 2023 Water supply, per m3', evidence='Equals the document cell and DEFRA 2023. A Turkish company resolves to this 2023 row; the global row (0.15311) is DEFRA 2024.', primary='DEFRA 2023 (verified)')
put(('water-treatment', 'turkey'), 'A', 'D-WATER-TREAT', doc=f'{D23}: 4.3.2 KULL.&ATIK SU!D12', basis='DEFRA 2023 Water treatment, per m3', evidence='Equals the document cell and DEFRA 2023.', primary='DEFRA 2023 (verified)')
put(('road-travel', 'turkey'), 'A', 'D-CAR-SERVICE', doc=f'{D23}: 3.3 ALINAN HIZ.!C5:E5 and 3.5 SEYAHAT!D5:F5; {UNC} "Is seyahati-Karayolu"', basis='DEFRA 2023 Cars (by size), Average car, Diesel, per km (CO2+CH4+N2O)', evidence='Equals the documented average-diesel-car factor and DEFRA 2023 (0.1698264). Applicability: a diesel car; the engine also uses it for any `road_travel`/`car_rental` and, as the fallback, for non-Turkish companies.', primary='DEFRA 2023 (verified)')
put(('sea-freight', 'turkey'), 'A', 'D-SEA-TKM', doc=f'{D23}: 3.1 HAMMADDE NAK.!D14:F14; {UNC} "Hammadde Nakliye - Denizyolu"', basis='DEFRA 2023 Cargo ship, Container ship, Average, per tonne-km', evidence='Equals the document (0.016119) and DEFRA 2023. Applicability: container ships only; the Turkish default is applied to any `sea_freight`.', primary='DEFRA 2023 (verified)')
put(('motorin-mobile', 'turkey'), 'A', 'D-DIESEL-ON', doc=f'{D23}: 1.2 HAR. YANMA!A5:N5 and formulas I5:S5', basis='(74100 + 3.9*27.9 + 3.9*273) kg/TJ x 0.832836 kg/L x 43 TJ/Gg x 1e-6 = 2.69569 kg CO2e/L',
    evidence='Reproduced by the documented formula to 0.011% (catalog rounds to 2.696). Inputs verified: EF IPCC 2006 V2 Ch3 T3.2.1/3.2.2; NCV IPCC V2 Ch1 T1.2; density 832.836 = DEFRA 2023 Fuel properties, Diesel (average biofuel blend) (verified in the public file); GWP 27.9/273 as in the document. Stage 4 wrongly called this "unverified".', primary='IPCC 2006 + DEFRA 2023 fuel properties (verified)')
put(('turkey-grid', 'turkey'), 'A', 'D-ELEC', doc=f'{D23}: 2 ITHAL ENERJI!C5:E5 (0.4183+0.0001+0.0015), footnote A7 "IEA"; {UNC} "Ithal edilen enerji" G=0.4199', basis='kg CO2e per kWh as the sum of the CO2, CH4 and N2O columns',
    evidence='Equals the factor used in the 2023 inventory. Attributed in the document to IEA (the IEA dataset is not provided, so the IEA value itself is not independently verified). The row is inactive/superseded in the catalog by the ETKB consumption-point factors: see DR-06. Stage 4 had called its origin unresolved: it is the documented factor.', dec='DR-06', primary='IEA (licensed; not verified)')
put([('turkey-grid-transmission', 'turkey'), ('turkey-grid-distribution', 'turkey')], 'A', None, None, doc=f'{G24}: Referanslar-dogrudan!K27 = 0.478 t/MWh, reference 12 = enerji.gov.tr (ETKB). Primary: ETKB 2023 form p.2', basis='ETKB consumption-point factor by grid connection (tCO2-eq/MWh = kg/kWh)',
    evidence='Equal to the ETKB 2023 values (0.436 / 0.469; primary-verified in Stage 4). Your 2024 inventory uses the same publisher/type of factor (0.478 = the ETKB 2022 distribution-connected value, which I read from the 2022 form). So the catalog\'s replacement logic matches the 2024 documented methodology. Edition note: 2023 edition vs 0.478 (2022) used in the 2024 file.', dec='DR-06', primary='ETKB 2023 (verified)')
put(('hotel-turkey', 'turkey'), 'A', 'D-HOTEL-TR', doc=f'{D23}: 3.5 SEYAHAT!D21 (32.1); {UNC} "Is seyahati-Konaklama"', basis='DEFRA hotel stay, Turkey, per room-night', evidence='Equals the document and DEFRA 2023 and 2024 (unchanged).', primary='DEFRA 2023/2024 (verified)')
put(('r600a', 'global'), 'A', 'D-GWP-R600A', doc=f'{D23}: 1.4 GAZ KAC.!Z7 (3), "DEFRA 2023 Refrigerant others"', basis='GWP', evidence='Equals the documented GWP and DESNZ 2024.', primary='DEFRA (verified)')
put(('sf6', 'global'), 'A', 'D-GWP-SF6', doc=f'{D23}: 1.4 GAZ KAC.!AG7 (25,200, "IPCC AR6 Table 7.SM.7")', basis='GWP', evidence='Equals your 2023 document. Note: your 2024 file uses 23,500 (Referanslar-dogrudan!Q16), and the GHG Protocol AR6 column shows 24,300; so the documentation itself carries two values. Stage 4\'s "unresolved" is resolved for the 2023 basis; which one the platform should use is DR-02.', dec='DR-02', primary='IPCC AR6 7.SM.7 (not retrieved)')
put(('co2-fire-suppression', 'global'), 'A', 'D-GWP-FIREFIGHT-CO2', doc=f'{D23}: 1.4 GAZ KAC.!S7 (GWP 1)', basis='GWP of CO2 = 1', evidence='Equals the documented CO2 GWP of 1 for fire-suppression CO2.')
put(('methane', 'global'), 'A', None, 27.9, 'GWP', doc=f'{D23}: GWP CH4 27.9 on every combustion sheet (AR6 Table 7.SM.7)', basis='GWP', evidence='Equal to the documented CH4 GWP (27.9). The gas-split code uses 29.8: DR-11.', dec='DR-11', mq='exact')
put(('n2o', 'global'), 'A', None, 273, 'GWP', doc=f'{D23}: GWP N2O 273 on every combustion sheet (AR6 Table 7.SM.7)', basis='GWP', evidence='Equal to the documented N2O GWP (273).', mq='exact')
put([('gas-diesel-oil-energy', 'global'), ('gas-diesel-oil-energy', 'turkey')], 'A', None, 74.1, 'kg CO2/GJ', doc=f'{D23}: 1.1 SBT. YANMA!E41 (74,100 kg/TJ)', basis='IPCC 2006 default CO2 EF for gas/diesel oil', evidence='Equals the documented CO2 emission factor (74.1 kg/GJ), CO2 only.', mq='exact')
put([('natural-gas', 'global'), ('natural-gas', 'turkey')], 'A', None, 56.155, 'kg CO2e/GJ', doc=f'{D23}: 1.1 SBT. YANMA!E5:G5 (56,100 / 1 / 0.1 kg/TJ with GWP 27.9 / 273)', basis='(56100 + 1*27.9 + 0.1*273)/1000 = 56.155 (manufacturing CH4 tier); 56.267 with the commercial tier (CH4=5)', evidence='Stored 56.211 lies between the two documented tiers (56.155 / 56.267): consistent within parameter choice.', mq='tolerance')
put(('product-gas-use', 'global'), 'A', None, 56.1, 'kg CO2/GJ', doc=f'{D23}: 1.1 SBT. YANMA!E5 (56,100 kg/TJ)', basis='natural gas CO2 EF', evidence='Equals the documented natural-gas CO2 EF.', mq='exact')
put([('diesel', 'global'), ('diesel', 'turkey')], 'A', 'D-DIESEL-STAT', doc=f'{D23}: 1.1 SBT. YANMA row 41 (generator); {G24}: Referanslar-dogrudan row 12', basis='IPCC EF x NCV x DEFRA density (CH4 3, N2O 0.6)',
    evidence='Stored 2.68 is +0.66% over the documented stationary-diesel value 2.66253 (2023) and +1.0% over 2.65346 (2024 parameters); it equals an IPCC-based value at a density of about 0.841 kg/L, not stated in the catalog. Consistent within parameter choice; not an error.', mq='tolerance', primary='IPCC 2006 + DEFRA fuel properties (verified)')
put(('fuel-extraction', 'global'), 'B', 'D-WTT-DIESEL', doc=f'{D23}: Ktg6 DIGER!C14 (0.61101, "DEFRA WTT Fuels Diesel")', basis='DEFRA WTT diesel (average blend) per litre', evidence='Stored 0.6 is -1.8% from the documented 0.61101 (the DEFRA 2023 and 2024 WTT diesel value). Value consistent; the label "GHG Protocol - Scope 3 Cat 3 estimate" is not a source (the GHG Protocol publishes no factors). It is also applied to every liquid fuel, while the document applies it to diesel only.', dec='DR-15', mq='tolerance')
put(('hfc-227ea', 'global'), 'C', 'D24-GWP-HFC227EA', doc=f'{G24}: Referanslar-dogrudan!P12:Q12 (HFC 227ea = 3600)', basis='GWP AR6', evidence='Your 2024 file states 3,600 (AR6). Stored 3,350 equals the AR5 value and DESNZ 2024. The 2023 document does not list HFC-227ea.', dec='DR-02')
for slug, did, label in [('r134a', 'D-GWP-R134A', 'HFC-134a'), ('r32', 'D-GWP-R32', 'HFC-32'), ('r22', 'D-GWP-R22', 'HCFC-22'), ('r410a', 'D-GWP-R410A', 'R-410A (50% R125 / 50% R32)')]:
    put((slug, 'global'), 'C', did, doc=f'{D23}: 1.4 GAZ KAC.! (AR6 Table 7.SM.7); {G24} agrees ({label})', basis='GWP AR6 (IPCC 7.SM.7)',
        evidence=f'Your documents use the AR6 value for {label}. The catalog value is the AR4 value (GHG Protocol table AR4/AR5/AR6) while its reference says "AR6 GWP100", and the ISO report says all gases use AR6. Lower than your documented value.', dec='DR-02')
put(('r404a', 'global'), 'A', 'D-GWP-R404A', doc=f'{D23}: 1.4 GAZ KAC.!L22 (3943, "DEFRA 2023 Refrigerant")', basis='GWP of the blend from DEFRA 2023 (AR5-based)', evidence='Stored 3,922 (AR4 blend) is -0.53% from the documented 3,943: within tolerance. Note the documented value is the DEFRA (AR5) blend, not AR6 (4,728): the documentation itself mixes bases for R404A; see DR-02.', dec='DR-02', mq='tolerance')

# ================= C: genuine discrepancy vs documents =================
put(('truck-freight', 'turkey'), 'C', 'D-HGV-KM', doc=f'{D23}: 3.1 HAMMADDE NAK.!D5:F5 (0.82313, activity in km, tonnes left "-"); {UNC} unit "Kg CO2 / Km"', basis='DEFRA 2023 Delivery vehicles, HGV all rigids, average laden, per VEHICLE-KM',
    evidence='The value is reproduced exactly (0.823134) but the document applies it per vehicle-km; the catalog stores it per TONNE-km (`truck_freight`, tonne-km). For a Turkish company 1,000 tonne-km resolves to 823 kg (112 kg for a German one). Your 2024 reference sheet uses the tonne-km form for tonne-km activity (DEFRA 2024 All HGVs, average laden, 0.09752 per tonne-km; Referanslar-dolayli R47).', dec='DR-01', mq='exact')
put([('off-road-diesel-desnz', 'global')], 'C', 'D-DIESEL-OFF', doc=f'{D23}: 1.2 HAR. YANMA row 18 (off-road: CH4 4.15, N2O 28.6)', basis='(74100 + 4.15*27.9 + 28.6*273) x 0.832836 x 43 x 1e-6 = 2.93742 kg CO2e/L',
    evidence='Documented method gives 2.93742 (2023) / 2.92742 (2024 parameters); stored 3.17939 is +8.2% / +8.6%. It also matches no DESNZ per-litre diesel/gas-oil value (2.51 - 2.76) and is 18% above the catalog\'s own diesel factors. The origin is not established. USED by the questionnaire for off-road machines (EQ-3B-11..16).', dec='DR-03')
put([('on-road-diesel-desnz', 'global')], 'C', 'D-DIESEL-ON', doc=f'{D23}: 1.2 HAR. YANMA row 5', basis='documented on-road diesel 2.69569', evidence='Stored 3.17939 is +17.9% over the documented on-road diesel; registered but not used by the engine for on-road (it uses `motorin-mobile`).', dec='DR-03')
put([('lpg', 'global'), ('lpg', 'turkey')], 'C', 'D-LPG', doc=f'{D23}: 1.1 SBT. YANMA row 17 (LPG: 63,100 / 1 / 0.1, NCV 47.3, density 531.098 = DEFRA 2023 Fuel properties)', basis='(63100 + 27.9 + 27.3) x 531.098/1000 x 47.3 x 1e-6 x 1000 = 1.58652 kg CO2e/L',
    evidence='Documented method 1.58652; stored 1.51468 is -4.5% (DESNZ 2024: 1.55713, -2.7%). It corresponds to a density of about 0.507 kg/L, which is neither the DEFRA 2023 (0.531098) nor 2024 (0.529749) value. Origin not established. USED in existing data.', dec='DR-04')
put([('biodiesel', 'global')], 'C', None, 0.16751, 'kg CO2e/L', doc=f'{D24U}: Bioenergy sheet, Biodiesel ME (fossil-origin share; biogenic CO2 reported outside scopes)', basis='DEFRA 2024', evidence='The catalog cites DEFRA 2024 Bioenergy; the cited row is 0.16751. Stored 0.03639 is -78%. Not in your inventories. No other edition matches.', dec='DR-12')
put([('bioethanol', 'global')], 'C', None, 0.00901, 'kg CO2e/L', doc=f'{D24U}: Bioenergy sheet, Bioethanol', basis='DEFRA 2024', evidence='Cited row 0.00901; stored 0.02719 is 3.0x. No other edition matches.', dec='DR-12')
put([('wood-pellets', 'global')], 'C', None, 0.05433654, 'kg CO2e/kg', doc=f'{D24U}: Bioenergy sheet, Wood pellets (54.33654 per tonne)', basis='DEFRA 2024 /1000', evidence='Cited row 0.0543; stored 0.01553 is -71%.', dec='DR-12')
put([('wt-01-landfill', 'global')], 'C', None, 1.16439015, 'kg CO2e/kg', doc=f'{G24}: Referanslar-dolayli R269-271 (DEFRA 2024 Waste management, Paper and board, Landfill = 1164.39015 per tonne)', basis='DEFRA 2024 /1000',
    evidence='Your 2024 methodology uses 1.16439 for paper landfill; stored 1.29 is +10.8%. The catalog cites only an internal catalogue ID. USED in existing data (6.5 kg).', dec='DR-13')
put([('diesel-kwh', 'global')], 'C', None, 0.25649, 'kg CO2e/kWh (gross CV)', doc=f'{D24U}: Fuels sheet, Gas oil, kWh (gross CV)', basis='DEFRA 2024 (the row the catalog cites)', evidence='Cited row 0.25649 (also the 2023 value); stored 0.24882 is -3.0%; no edition matches. Not in your inventories.', dec='DR-17')
put([('on-road-petrol-desnz', 'global')], 'C', 'D24-PETROL-ON', doc=f'{G24}: Referanslar-dogrudan row 14 (petrol on-road: 69,300 / 25 / 8, NCV 44.3, density 0.735)', basis='IPCC EF x NCV x density', evidence='Documented on-road petrol 2.35027; stored 2.30233 is -2.0% (borderline). Same value as the off-road row although the documented parameters differ. Registered; the engine uses `gasoline-generic` for on-road.', dec='DR-16')

put(('gasoline-generic', 'global'), 'B', 'D24-PETROL-ON', doc=f'{G24}: Referanslar-dogrudan row 14 (petrol on-road)', basis='documented fuel method', evidence='Stored 2.31 is -1.7% from the documented on-road petrol 2.35027, but labelled generic with no source. Plausibly derived; label unsupported.', dec='DR-15', mq='tolerance')

# ================= A with tolerance vs 2024 parameters =================
put([('off-road-gasoline-desnz', 'global')], 'A', 'D24-PETROL-OFF', doc=f'{G24}: Referanslar-dogrudan row 16 (petrol off-road: 69,300 / 52 / 0.4, NCV 44.3, density 0.735)', basis='IPCC EF x NCV x density', evidence='Stored 2.30233 is -0.21% from the documented off-road petrol 2.30724: consistent. The "DESNZ" label is not what the value derives from (it derives from the documented IPCC method).', mq='tolerance', dec='DR-15')

# ================= B: attribution =================
put([('natural-gas-m3', 'global'), ('natural-gas-m3', 'turkey')], 'B', None, None, 'RANGE, no single value: 2.14288 (2023 method) / 1.91242 (2024 method) kg CO2e/m3', doc=f'{D23}: 1.1 SBT. YANMA row 5 -> 2.14288 (density 0.795); {G24}: row 10 -> 1.91242 (density 0.7095 kg/Sm3); DESNZ 2024 2.04542; DEFRA 2020 2.02266', basis='IPCC EF x NCV x density: the density differs between your two inventories',
    evidence='Label says "DEFRA 2024 - 2.02": untrue (DESNZ 2024 = 2.04542). Stored 2.02 equals the DEFRA 2020 value rounded. Your own method yields 2.143 (2023 density 0.795 = DEFRA 2023) and 1.912 (2024 density 0.7095), so no single documented per-m3 value exists; 2.02 lies inside that range (-5.7% / +5.6%). The value may be defensible; its label is not. USED in existing data (4 entries). Which density/CV basis applies is yours to decide.', dec='DR-05')
put([('cement-clinker', 'global')], 'B', None, 520, 'kg CO2/t clinker', doc='Not in your documents (cable manufacturer). Primary: IPCC 2006 Vol.3 Ch.2 Eq. 2.4 = 0.52; WBCSD/CSI protocol default 525 (secondary evidence only)', basis='IPCC 2006 vs cement-industry protocol',
    evidence='Label says IPCC 2006; IPCC gives 520. 525 is the cement-industry protocol default per a secondary source. Value may be valid under that protocol; the attribution is wrong. USED (one 50,000 t entry: 250 t CO2e difference).', missing='the WBCSD/CSI protocol text (primary) and your decision on which basis applies to clinker', dec='DR-08')
put([('ferry-travel', 'global')], 'B', None, 0.01871, 'kg CO2e/pkm (foot passenger)', doc=f'{D24U}: Business travel- sea, Ferry', basis='DEFRA 2024', evidence='Stored 0.019 equals the FOOT-passenger value (0.01871); the reference says "average" (0.1127, "average (all passenger)"). Value valid for foot passengers; label wrong.', dec='DR-18')
put([('diesel-generic', 'global'), ('product-fuel-use', 'global')], 'B', 'D-DIESEL-STAT', doc=f'{D23}: diesel 2.66253 (stationary) - 2.69569 (on-road) kg CO2e/L', basis='documented fuel method', evidence='Numerically close to the documented fuel values (within 2%) but labelled "generic"/GHG Protocol with no source. Value plausibly valid; label unsupported.', dec='DR-15', mq='tolerance')
put([('car-commute', 'global'), ('taxi', 'global'), ('vehicle-km', 'global')], 'B', 'D-CAR-SERVICE', doc=f'{D23}: 3.3/3.5 average diesel car', basis='DEFRA 2023 average diesel car', evidence='0.171 is +0.7% over the documented 0.169826 but labelled generic/GHG Protocol. Plausibly derived from it; label unsupported.', dec='DR-15', mq='tolerance')

# ================= A* DESNZ-primary verified rows (documented source FAMILY) =================
for slug, did, note in [('electrical-fridges', None, 'Electrical items - fridges and freezers'), ('electrical-it', None, 'Electrical items - IT'), ('electrical-large', None, 'Electrical items - large'), ('electrical-small', None, 'Electrical items - small'),
                        ('glass', None, 'Glass'), ('metal-aluminium', None, 'Metal: aluminium cans and foil'), ('metal-mixed-cans', None, 'Metal: mixed cans'), ('metal-steel-cans', None, 'Metal: steel cans'),
                        ('mineral-oil', None, 'Mineral oil'), ('paper-mixed', None, 'Paper and board: mixed'), ('plastic-average', None, 'Plastics: average plastics'), ('plastic-hdpe', None, 'Plastics: HDPE'), ('wood', None, 'Wood')]:
    if slug == 'wood':
        put(('wood', 'global'), 'A', None, None, doc=f'{D24U}: Material use sheet; {G24}: Referanslar-dolayli R208+ "DEFRA 2024-MATERIAL USE"', basis='DEFRA 2024 Material use, primary production, /1000', evidence='Equals DESNZ 2024 exactly (Stage 4) and belongs to the source family your 2024 methodology names (DEFRA 2024 Material use).', primary='DESNZ 2024 (verified)', mq='exact')
    else:
        put((slug, 'global'), 'A', None, None, doc=f'{D24U}: Material use sheet, {note}; family named in {G24}: Referanslar-dolayli R208+', basis='DEFRA 2024 Material use, primary production, /1000', evidence='Equals DESNZ 2024 exactly (Stage 4) and belongs to the source family your 2024 methodology names (DEFRA 2024 Material use).', primary='DESNZ 2024 (verified)', mq='exact')
put([('water-supply', 'global'), ('water-treatment', 'global')], 'A', None, None, doc=f'{D24U}: Water sheets; family named in {G24}: Referanslar-dolayli R316/R323', basis='DEFRA 2024 water', evidence='Equals DESNZ 2024 exactly; same source family as the 2024 methodology.', primary='DESNZ 2024 (verified)', mq='exact')
put([('propane', 'global'), ('propane', 'turkey')], 'A', None, 2.99763233, 'kg CO2e/kg', doc=f'{D24U}: Fuels sheet, Propane', basis='DEFRA 2024 /1000', evidence='Equals DESNZ 2024 exactly. Observation about your 2023 document (not a finding on the catalog): its propane row uses the natural-gas EF 56,100 and NCV 48, which gives 2.6955 kg/kg, not the LPG parameters 63,100 / 47.3.', primary='DESNZ 2024 (verified)', mq='exact', dec='DR-19')
put(('uk-grid', 'global'), 'A', None, None, doc='Not in your inventories (UK); primary DESNZ 2024/2025', basis='DESNZ electricity: UK', evidence='Equals DESNZ 2024 (0.20705, rounded) and 2025 (0.177).', primary='DESNZ (verified)', mq='exact')
put(('uk-transmission-losses', 'global'), 'A', None, 0.01853, 'kg CO2e/kWh', doc='Not in your inventories (UK); primary DESNZ 2025', basis='T&D UK', evidence='Equals DESNZ 2025 exactly.', primary='DESNZ 2025 (verified)', mq='exact')
put([('natural-gas-kwh', 'global'), ('natural-gas-kwh', 'turkey')], 'A', None, 0.1829, 'kg CO2e/kWh (gross CV)', doc=f'{D24U}: Fuels sheet, Natural gas kWh gross CV', basis='DEFRA 2024', evidence='Stored 0.18316 is +0.14% from DESNZ 2024 (0.1829): rounding-level. The catalog does not state gross vs net CV.', mq='tolerance', primary='DESNZ 2024')
put([('coal-industrial', 'global'), ('coal-industrial', 'turkey')], 'A', None, 2.39944, 'kg CO2e/kg', doc=f'{D24U}: Fuels sheet, Coal (industrial)', basis='DEFRA 2024 /1000', evidence='Stored 2.40739 is +0.33% from DESNZ 2024; rounding-level.', mq='tolerance')
put(('biogas', 'global'), 'A', None, 0.00023, 'kg CO2e/kWh', doc=f'{D24U}: Bioenergy sheet, Biogas', basis='DEFRA 2023/2024', evidence='Stored 0.00022 equals DEFRA 2023; DEFRA 2024 is 0.00023. The difference is the 5th decimal (rounding), not a method difference.', mq='rounding')
put(('hotel-uk', 'global'), 'A', None, 10.4, 'kg CO2e/room-night', doc=f'{D24U}: Hotel stay, UK', basis='DEFRA', evidence='Stored 10.5 is +1.0% from DEFRA 2023/2024 (10.4); within tolerance.', mq='tolerance')
put(('car-rental-diesel', 'global'), 'A', None, 0.16984, 'kg CO2e/km', doc=f'{D24U}: Passenger vehicles, Average car, Diesel', basis='DEFRA 2024', evidence='Stored 0.168 is -1.1% from DESNZ 2024 (0.16984); within tolerance.', mq='tolerance')
put(('metro-commute', 'global'), 'A', None, 0.0278, 'kg CO2e/pkm', doc=f'{D24U}: Business travel- land, London Underground', basis='DEFRA 2024', evidence='Stored 0.028 equals DESNZ 2024 (rounded). Geography: London Underground, applied to any metro (the Turkish rows `metro` use 0.028 with a different label).', mq='tolerance')

# ================= flights / RF / spend / recycling / T&D / grids =================
put([(s, 'global') for s in ('flight-long-business', 'flight-long-economy', 'flight-long-first', 'flight-short-economy', 'flight-long', 'flight-medium', 'flight-short')], 'D', None, None,
    doc=f'{D23}: 3.5 SEYAHAT!D13:F13 uses DEFRA 2023 Short-haul to/from UK WITHOUT RF = 0.10794/pkm (the only flight factor in your documents)', basis='DEFRA air factors, RF excluded',
    evidence='Your documented practice excludes radiative forcing ("Without RF"); the catalog rows say "RFI included" and the long-haul business value is documented as "Economy x ~2.9". They are on a different boundary and match no DESNZ 2023-2025 row. Not wrong per se; not verifiable from your documents.', missing='your decision on RF treatment (with / without) and the DESNZ class (to/from UK vs international non-UK), plus the source of the economy x 2.9 cabin multiplier', dec='DR-09')
put(('rfi-multiplier', 'global'), 'D', None, None, doc='Not in your documents (they use "Without RF")', basis='multiplier 1.9', evidence='A radiative-forcing multiplier; your documented method applies none.', missing='decision on RF treatment', dec='DR-09')
put(('flight-international', 'turkey'), 'D', None, None, doc='Not in your documents', basis='ICAO 2025', evidence='ICAO publishes a route calculator, not a per-km factor.', missing='the ICAO document/edition and conversion used', dec='DR-09')
for s in ('cleaning-services', 'food-catering', 'it-telecom-services', 'legal-accounting', 'marketing-advertising'):
    put((s, 'global'), 'D', None, None, doc=f'{D23}: spend-based factors are cited to "USD Emission Factors" rows 115 / 305 / 389 (kg CO2e per USD); the table itself is not among the files', basis='spend-based, USD',
        evidence='Labelled "DEFRA 2024" but the DESNZ 2024 workbook has no spend-based factors. The documented spend-based source is a different "USD Emission Factors" table; its row numbers do not land on the named sectors in the `std` table of your 2024 file (rows 115/305/389 are roofing, aluminium and scale manufacturing), so the table edition is not identifiable. The catalog value does not match that table\'s sector rows either.', missing='the exact "USD Emission Factors" table (edition, currency year) and the sector row used for this service', dec='DR-10')
for s in ('wt-01-recycling', 'wt-03-recycling', 'wt-04-recycling'):
    put((s, 'global'), 'D', None, 0.00641061, 'kg CO2e/kg (DEFRA treatment, closed-loop)', doc=f'{D23}: 4.3.1 ATIK (C&I waste combustion/open loop 21.28 kg/t, positive); {G24}: Referanslar-dolayli R247-R275 (DEFRA 2024 Waste management: recycling +6.41061 kg/t)', basis='documented: positive DEFRA treatment factors; no credit',
        evidence='NEITHER documented inventory contains a negative recycling factor: both use positive DEFRA waste factors (2023: 21.28 kg/t open loop; 2024: +6.41061 kg/t recycling), and purchased recycled-content metal uses the closed-loop MATERIAL factor (1558.95 kg/t). The catalog credits (-125 / -506 / -9100 kg/t) therefore are not part of your documented methodology, and cite only an internal catalogue ID. See Stage 4 MDR-S4-01.', missing='the CarbonIQ EF Katalogu entries EF-K3A-003/005/006 and your decision on netting (MDR-S4-01)', dec='DR-07')
put(('transmission-losses', 'global'), 'C', None, 0.062985, 'kg CO2e/kWh (derived: 15% x 0.4199)', doc=f'{D23}: Ktg6 DIGER!C4 = 0.15 (TEIAS T&D ratio 15% of the Category-2 emissions), footnote A7', basis='documented: 15% x Scope 2 tCO2e (= 0.063 kg/kWh at 0.4199)',
    evidence='The catalog uses a flat 0.02 kg/kWh (generic, no source) for T&D losses (about 4-5% of Scope 2), while your documented method uses 15% of Scope 2. Also open: whether the ETKB consumption-point factors already include network losses (the GHG Protocol Scope 3 Standard puts T&D losses in Category 3 "reported by end user" but does not say whether a consumption-point Scope 2 factor already contains them), in which case adding any T&D term could double count. Used in existing data (4 entries).', missing='ETKB statement on whether the consumption-point factor includes T&D losses; your decision', dec='DR-06')
put(('upstream-electricity', 'global'), 'D', None, None, doc='Not in your documents (they have WTT diesel only)', basis='WTT electricity 0.025', evidence='No documented counterpart; cited as "GHG Protocol - Scope 3 Cat 3 estimate". Used in existing data (4 entries).', missing='a source for upstream (WTT) electricity for Turkey', dec='DR-14')
put(('landfill', 'turkey'), 'D', 'D-WASTE-LANDFILL', doc=f'{D23}: 4.3.1 ATIK!H23 (household landfill 497.04 kg/t = 0.497 kg/kg)', basis='DEFRA household landfill', evidence='Stored 0.54 is +8.6% over the documented household landfill; no reference given, so the waste category it represents is unknown.', missing='the source and waste category of 0.54', dec='DR-13')
put(('general-landfill', 'global'), 'D', 'D-WASTE-LANDFILL', doc=f'{D23}: 4.3.1 ATIK!H23 and {G24} (household 497.04; C&I 520.33 kg/t)', basis='DEFRA landfill', evidence='Stored 0.57 matches neither documented landfill value (+14.7% / +9.5%); empty reference. USED in existing data (1,140 kg).', missing='source of 0.57', dec='DR-13')
put([('recyclable', 'turkey'), ('recyclable', 'global'), ('product-recycling', 'global')], 'D', 'D-WASTE-OPEN', doc=f'{D23}: 4.3.1 ATIK!H5 (21.28 kg/t) / {G24} (6.41 kg/t)', basis='DEFRA treatment', evidence='0.017-0.021 kg/kg is within the range of the documented waste treatment values (0.0064-0.0213) but no reference states the basis.', missing='source and basis', dec='DR-13')

# ================= everything else by group =================
GROUP = {
    'custom': ('P', 'Pass-through "calculated-*" row (quantity = kg CO2e entered or derived elsewhere); not an emission factor.', '', ''),
    'iea_2024': ('D', 'IEA is a documented source TYPE (your 2023 Turkish grid factor is attributed to IEA) but these country values are not in your documents and the IEA dataset is licensed.', 'the IEA Emissions Factors edition and the country rows used', 'DR-14'),
    'turkey_fleet': ('D', 'Reference is a description ("Turkey fleet 2025", "Turkish Airlines 2025"); no document. (car-commute/gasoline 0.172 is within 1.3% of the documented average diesel car 0.1698, but that is not shown to be their source.)', 'the document for the Turkish fleet factors', 'DR-14'),
    'turkey_grid': ('D', 'No citable document in your files (waste/heating/district rows).', 'a source document', 'DR-14'),
    'ipcc_2006': ('D', 'Cites IPCC 2006 but your documents do not include this process/fuel row; the specific IPCC table was not retrieved.', 'IPCC 2006 Vol.2 Ch.2 / Vol.3 Ch.3-4 rows for this factor', 'DR-14'),
    'ipcc_2019': ('D', 'Cites the IPCC 2019 Refinement; your documents use IPCC 2006 emission factors, and the per-GJ CO2e composition of this row is not reproducible from them.', 'the IPCC 2019 table and the CH4/N2O tier used', 'DR-14'),
    'generic': ('D', 'Cited as "GHG Protocol - Scope 3 Cat N estimate" (the GHG Protocol publishes no emission factors) or nothing; no counterpart in your documents.', 'a citable source for this value', 'DR-14'),
    'defra_2024': ('D', 'Names DEFRA 2024 (or an internal catalogue ID) but has no counterpart in your documents and was not matched to a DESNZ row in this review. Checkable against the DESNZ 2024 workbook you provided, but not yet checked.', 'the exact DESNZ 2024 row (or the internal catalogue entry)', 'DR-14'),
    'desnz_2025': ('A', 'Equals DESNZ 2025.', '', ''),
    'atom_kablo': ('D', 'Not assessed.', '', ''),
}
SPECIAL_TM = ('D', 'GLEC-based internal catalogue IDs. Your documents do not use GLEC: road freight is DEFRA per-km (2023) or per-tonne-km (2024), and the GLEC primary was inaccessible in Stage 4. For context, your 2024 sheet\'s DEFRA All-HGV average laden is 0.09752 per tonne-km.', 'the GLEC Framework table and version behind each tm-xx value, or a decision to use the DEFRA tonne-km set your 2024 methodology names', 'DR-14')

rows_out = []
for r in cat:
    slug, country, year = r['slug'], r['country'], int(r['year'] or 0)
    ent = K.get((slug, country, year)) or K.get((slug, country)) or K.get(slug)
    if ent is None:
        if re.match(r'tm-0\d', slug):
            cls, ev, miss, dec = SPECIAL_TM
        else:
            cls, ev, miss, dec = GROUP.get(r['source'], ('D', 'Not assessed.', '', ''))
        ent = dict(cls=cls, doc_id=None, doc_val=None, unit='', doc='', basis='', evidence=ev, missing=miss, dec=dec, primary='', mq=None)
    stored = float(r['factor_kg_co2e'])
    dv = ent['doc_val']
    s4r = st4.get(r['id'], {})
    if dv is None and ent['cls'] in ('A', 'B', 'C') and not ent['unit']:
        try:
            dv = float(s4r.get('published_value_in_stored_unit') or '')
            ent = dict(ent, unit=ent['unit'] or s4r.get('published_unit_and_basis', ''))
        except ValueError:
            pass
    diff = round(100 * (stored - dv) / dv, 3) if isinstance(dv, (int, float)) and dv else ''
    mq = ent['mq'] or ('' if diff == '' else ('exact' if abs(diff) <= 0.05 else 'tolerance' if abs(diff) <= 2 else 'outside'))
    unit = ent['unit'] or (reg[ent['doc_id']]['unit'] if ent['doc_id'] in reg else '')
    s4 = st4.get(r['id'], {})
    rows_out.append(dict(
        factor_id=r['id'], slug=slug, name=r['name'], country=country, stored_year=r['year'], unit=r['unit'], stored_value=stored, stored_source_label=r['source'],
        stored_reference=(r['reference'] or '').replace('\n', ' '), active_default=f"{'Y' if r['is_active'] == '1' else 'N'}/{'Y' if r['is_default'] == '1' else 'N'}",
        used_in_dev_data=s4.get('used_in_dev_data(entries;kg)', ''), stage5_class=ent['cls'], match_quality=mq,
        documented_value=dv if dv is not None else '', documented_unit_basis=unit, documents_and_cells=ent['doc'], calculation_basis=ent['basis'],
        primary_check=ent['primary'], diff_pct=diff, stage4_class=s4.get('evidence_class', ''), evidence_and_reasoning=ent['evidence'],
        missing_evidence=ent['missing'], decision_id=ent['dec'], approval_required={'A': 'No', 'P': 'No', 'B': 'Yes - decision needed', 'C': 'Yes - decision needed', 'D': 'Evidence needed' + (' (and a decision: ' + ent['dec'] + ')' if ent['dec'] in ('DR-07', 'DR-09', 'DR-10') else '')}[ent['cls']],
    ))

cols = list(rows_out[0].keys())
with open(OUT + '/factor_reconciliation.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); w.writerows(rows_out)
import collections
print(len(rows_out), 'rows;', dict(collections.Counter(x['stage5_class'] for x in rows_out)))
print('stage4 -> stage5:', dict(collections.Counter((x['stage4_class'], x['stage5_class']) for x in rows_out)))
