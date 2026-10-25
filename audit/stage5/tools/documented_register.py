"""Compute every emission factor the provided documents contain, from the document's own cells (no retyped numbers),
then match the whole catalog against them.  Output: documented_register.csv and catalog_matches.csv in OUT dir."""
import csv, io, re, sys, collections

SP5 = r"C:/Users/UP/AppData/Local/Temp/claude/D--ACADEMIA-PROJECTS-CARBONLESS/b954cafe-f9a3-4334-be50-4ecff1db1b77/scratchpad/s5"
S4 = SP5.replace('/s5', '/s4')
OUT = sys.argv[1]


TR = str.maketrans({'ı':'i','İ':'I','ş':'s','Ş':'S','ğ':'g','Ğ':'G','ü':'u','Ü':'U','ö':'o','Ö':'O','ç':'c','Ç':'C'})
def load(path):
    d = {}
    for line in io.open(path, encoding='utf-8'):
        k, v, f = (line.rstrip(chr(10)).split(chr(9)) + ['', ''])[:3]
        sh, addr = k.rsplit('!', 1); k = sh.translate(TR).strip() + '!' + addr
        v = v.strip("'\"")
        try: v = float(v)
        except ValueError: pass
        d[k] = (v, f)
    return d


C23 = load(SP5 + '/docs/calc_atom_2023.dump.txt')      # the three calc workbooks are cell-identical (checked)
UNC = load(SP5 + '/docs/uncertainty_2023.dump.txt')
G24 = load(SP5 + '/docs/genel2024.dump.txt')
val = lambda d, k: d[k][0]
rows = []   # (id, description, kg CO2e per unit, unit, document, sheet/cells, formula/basis, year, notes)


def add(i, desc, v, unit, doc, cells, basis, year, note=''):
    rows.append((i, desc, v, unit, doc, cells, basis, year, note))


# ---- 2023 calculation document: fuels (IPCC 2006 EF x NCV x DEFRA-2023 density, AR6 GWPs from the same sheet) ----
def fuel(sheet, r, gas_cols=('E', 'F', 'G'), name='', unit='per m3', per_litre=False, i=''):
    q = lambda c: val(C23, f"{sheet}!{c}{r}")
    dens, ef = q('C'), (q('E'), q('F'), q('G'))
    ncv, g = q('H'), (q('L'), q('M'), q('N'))
    kg = sum(e * w for e, w in zip(ef, g)) * dens * ncv * 1e-6          # kg CO2e per m3 (density is kg/m3)
    add(i, name, kg / (1000 if per_litre else 1), 'kg CO2e/L' if per_litre else 'kg CO2e/m3', 'calc_2023', f"{sheet}!C{r},E{r}:H{r},L{r}:N{r}",
        f"(EF_CO2*{g[0]} + EF_CH4*{g[1]} + EF_N2O*{g[2]}) * density {dens} * NCV {ncv} * 1e-6", 2023)
    return kg


S = '1.1 SBT. YANMA'; M = '1.2 HAR. YANMA'
fuel(S, 5, name='Natural gas, stationary', i='D-NG')
fuel(S, 17, name='LPG, stationary', per_litre=True, i='D-LPG')
fuel(S, 29, name='Propane, stationary (per m3 of liquid)', per_litre=True, i='D-PROPANE')
fuel(S, 41, name='Diesel, stationary generator', per_litre=True, i='D-DIESEL-STAT')
fuel(M, 5, name='Diesel, on-road', per_litre=True, i='D-DIESEL-ON')
fuel(M, 18, name='Diesel, off-road', per_litre=True, i='D-DIESEL-OFF')

# ---- electricity, T&D, WTT ----
add('D-ELEC', 'Grid electricity, Turkey (IEA per document)', sum(val(C23, f"2 ITHAL ENERJI!{c}5") for c in 'CDE'), 'kg CO2e/kWh', 'calc_2023', "2 ITHAL ENERJI!C5:E5 (0.4183+0.0001+0.0015)", 'sum of the three gas columns; footnote A7 "IEA dan alinmistir"', 2023)
add('D-TD', 'T&D loss ratio applied to Scope 2', val(C23, 'Ktg6 DIGER!C4'), 'fraction of Category-2 tCO2e', 'calc_2023', 'Ktg6 DIGER!C4', 'footnote A7: TEIAS iletim dagitim orani %15', 2023)
add('D-WTT-DIESEL', 'WTT diesel', val(C23, 'Ktg6 DIGER!C14'), 'kg CO2e/L', 'calc_2023', 'Ktg6 DIGER!C14', 'DEFRA WTT Fuels Diesel', 2023)

# ---- refrigerant GWPs ----
g = lambda c: val(C23, f'1.4 GAZ KAC.!{c}')
for i, name, cell, src in [('D-GWP-R410A', 'R-410A blend (50% R125 / 50% R32)', 'C7', 'IPCC AR6 Table 7.SM.7'), ('D-GWP-R125', 'HFC-125', 'G8', 'IPCC AR6 7.SM.7'),
                           ('D-GWP-R32', 'HFC-32', 'H8', 'IPCC AR6 7.SM.7'), ('D-GWP-R134A', 'HFC-134a', 'C15', 'IPCC AR6 7.SM.7'), ('D-GWP-R22', 'HCFC-22', 'C28', 'IPCC AR6 7.SM.7'),
                           ('D-GWP-R404A', 'R-404A', 'L22', 'DEFRA 2023 Refrigerant'), ('D-GWP-R600A', 'R-600a', 'Z7', 'DEFRA 2023 Refrigerant others'), ('D-GWP-SF6', 'SF6', 'AG7', 'IPCC AR6 7.SM.7'),
                           ('D-GWP-FIREFIGHT-CO2', 'CO2 fire suppression', 'S7', 'CO2 = 1')]:
    add(i, 'GWP ' + name, g(cell), 'kg CO2e/kg', 'calc_2023', f'1.4 GAZ KAC.!{cell}', src, 2023)
add('D-GWP-CH4', 'GWP CH4 (all combustion sheets)', val(C23, f'{S}!M5'), '-', 'calc_2023', f'{S}!M5', 'IPCC AR6 Table 7.SM.7', 2023)
add('D-GWP-N2O', 'GWP N2O', val(C23, f'{S}!N5'), '-', 'calc_2023', f'{S}!N5', 'IPCC AR6 Table 7.SM.7', 2023)

# ---- transport / travel ----
for i, name, sheet, r, cols, unit in [
        ('D-HGV-KM', 'Road freight HGV (all rigids, average laden), per vehicle-km', '3.1 HAMMADDE NAK.', 5, 'DEF', 'kg CO2e/vehicle-km'),
        ('D-SEA-TKM', 'Container ship average, per tonne-km', '3.1 HAMMADDE NAK.', 14, 'DEF', 'kg CO2e/tkm'),
        ('D-CAR-SERVICE', 'Service vehicle / average car diesel, per km', '3.3 ALINAN HIZ.', 5, 'CDE', 'kg CO2e/km'),
        ('D-CAR-MEAL', 'Meal-service vehicle, per km', '3.3 ALINAN HIZ.', 13, 'CDE', 'kg CO2e/km'),
        ('D-CAR-BTRAVEL', 'Business travel average car, per km', '3.5 SEYAHAT', 5, 'DEF', 'kg CO2e/km'),
        ('D-AIR-SHORT-NORF', 'Flight short-haul to/from UK WITHOUT RF, per pkm', '3.5 SEYAHAT', 13, 'DEF', 'kg CO2e/pkm')]:
    add(i, name, sum(val(C23, f'{sheet}!{c}{r}') for c in cols), unit, 'calc_2023', f'{sheet}!{cols[0]}{r}:{cols[-1]}{r}', 'sum of CO2+CH4+N2O columns (DEFRA 2023)', 2023)
add('D-HOTEL-TR', 'Hotel stay Turkey', val(C23, '3.5 SEYAHAT!D21'), 'kg CO2e/room-night', 'calc_2023', '3.5 SEYAHAT!D21', 'DEFRA 2023 Hotel stay', 2023)
add('D-USD-TRUCK', 'Spend-based: truck transport', val(C23, '3.1 HAMMADDE NAK.!G20'), 'kg CO2e/USD', 'calc_2023', '3.1 HAMMADDE NAK.!G20', '"USD Emission Factors" row 389 (table not provided)', 2023)

# ---- raw materials, waste, water ----
for i, name, r in [('D-CHEM', 'Chemicals (Ecoinvent)', 4), ('D-PLASTIC', 'Plastic, average (DEFRA 2023 primary)', 6), ('D-PAPER', 'Paper/board mixed primary', 7), ('D-METAL-PRIM', 'Metals primary', 8),
                   ('D-METAL-CL', 'Metals closed loop', 9), ('D-WOOD', 'Wood primary', 10), ('D-LDPE', 'Plastic LDPE (foam tape)', 11)]:
    v = val(C23, f'4.1 HAM. KULL.!E{r}')
    per_kg = v if i == 'D-CHEM' else v / 1000
    add(i, name, per_kg, 'kg CO2e/kg', 'calc_2023', f'4.1 HAM. KULL.!E{r}', 'DEFRA 2023 Material use' if i != 'D-CHEM' else 'Ecoinvent (document column G)', 2023)
add('D-USD-MFG', 'Spend-based: electrical equipment / wire & cable mfg', val(C23, '4.1 HAM. KULL.!G16'), 'kg CO2e/USD', 'calc_2023', '4.1 HAM. KULL.!G16', '"USD Emission Factors" row 115 (table not provided)', 2023)
add('D-USD-SERV', 'Spend-based: commercial machinery repair/maintenance', val(C23, '4.5 ALINAN HIZ.!G2'), 'kg CO2e/USD', 'calc_2023', '4.5 ALINAN HIZ.!G2', '"USD Emission Factors" row 305 (table not provided)', 2023)
add('D-WASTE-OPEN', 'Waste C&I open loop / combustion', val(C23, '4.3.1 ATIK!H5') / 1000, 'kg CO2e/kg', 'calc_2023', '4.3.1 ATIK!H5', 'DEFRA 2023 Waste disposal C&I', 2023)
add('D-WASTE-LANDFILL', 'Household residual waste landfill', val(C23, '4.3.1 ATIK!H23') / 1000, 'kg CO2e/kg', 'calc_2023', '4.3.1 ATIK!H23', 'DEFRA 2023 Waste disposal household landfill', 2023)
add('D-WATER-SUPPLY', 'Water supply', val(C23, '4.3.2 KULL.&ATIK SU!D4'), 'kg CO2e/m3', 'calc_2023', '4.3.2 KULL.&ATIK SU!D4', 'DEFRA 2023 Water supply', 2023)
add('D-WATER-TREAT', 'Water treatment', val(C23, '4.3.2 KULL.&ATIK SU!D12'), 'kg CO2e/m3', 'calc_2023', '4.3.2 KULL.&ATIK SU!D12', 'DEFRA 2023 Water treatment', 2023)
add('D-EOL-WEEE', 'End-of-life cable (WEEE mixed open loop)', val(C23, 'Ktg5 URUN KULL.!D4') / 1000, 'kg CO2e/kg', 'calc_2023', 'Ktg5 URUN KULL.!D4', 'DEFRA 2023 Waste disposal WEEE', 2023)

# ---- 2024 general table parameters (supplementary: not in the list of documents) ----
q24 = lambda c: val(G24, f'Referanslar-dogrudan!{c}')
for i, name, r in [('D24-NG-MANUF', 'Natural gas, stationary manufacturing (2024 table)', 10), ('D24-DIESEL-MANUF', 'Diesel, stationary manufacturing (2024 table)', 12),
                   ('D24-DIESEL-ON', 'Diesel on-road (2024 table)', 13), ('D24-DIESEL-OFF', 'Diesel off-road (2024 table)', 15),
                   ('D24-PETROL-ON', 'Petrol on-road (2024 table)', 14), ('D24-PETROL-OFF', 'Petrol off-road (2024 table)', 16)]:
    dens, ncv, co2, ch4, n2o = q24(f'E{r}'), q24(f'H{r}'), q24(f'K{r}'), q24(f'L{r}'), q24(f'M{r}')
    kg = (co2 + ch4 * 27.9 + n2o * 273) * dens * ncv * 1e-6
    unit_div = 1 if 'NG' in i else 1  # density kg/Sm3 for gas; kg/lt for liquids -> per litre already
    add(i, name, kg, 'kg CO2e/m3' if 'NG' in i else 'kg CO2e/L', 'genel_hesap_2024', f'Referanslar-dogrudan!E{r},H{r},K{r}:M{r}', f'(CO2+CH4*27.9+N2O*273)*density {dens}*NCV {ncv}*1e-6 (density kg/L)', 2024)
add('D24-ELEC', 'Grid electricity (2024 table, ref 12 = enerji.gov.tr)', q24('K27'), 'kg CO2e/kWh (0.478 t/MWh)', 'genel_hesap_2024', 'Referanslar-dogrudan!K27', 'ETKB', 2024)
for i, name, c, gas in [('D24-GWP-HFC227EA', 'GWP HFC-227ea (2024 table)', 'Q12', ''), ('D24-GWP-R22', 'GWP R-22', 'Q13', ''), ('D24-GWP-R134A', 'GWP R-134a', 'Q14', ''),
                        ('D24-GWP-R410A', 'GWP R-410A', 'Q15', ''), ('D24-GWP-SF6', 'GWP SF6 (2024 table)', 'Q16', '')]:
    add(i, name, q24(c), 'kg CO2e/kg', 'genel_hesap_2024', f'Referanslar-dogrudan!{c}', 'IPCC AR6 / table 10', 2024)

with open(OUT + '/documented_register.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh); w.writerow(['id', 'description', 'value', 'unit', 'document', 'cells', 'formula_or_basis', 'year', 'note'])
    for r in rows: w.writerow(r)
print(len(rows), 'documented values')

# ---- match the whole catalog against the documented values ----
cat = list(csv.DictReader(open(S4 + '/catalog_full.csv', encoding='utf-8')))
fam = lambda u: {'liters': 'L', 'm3': 'm3', 'kwh': 'kWh', 'kg': 'kg', 'km': 'km', 'tonne-km': 'tkm', 'nights': 'night', 'usd': 'USD', 'person-km': 'pkm'}.get(u.lower(), u)
def ufam(u):
    u = u.lower()
    if 'l' == u[-1:] and ('kg co2e/l' in u) : return 'L'
    for k, v in (('kg co2e/l', 'L'), ('/m3', 'm3'), ('/kwh', 'kWh'), ('/kg', 'kg'), ('/vehicle-km', 'veh-km'), ('/km', 'km'), ('/tkm', 'tkm'), ('room-night', 'night'), ('/usd', 'USD'), ('/pkm', 'pkm')):
        if k in u: return v
    return u
matches = []
for r in cat:
    cv, cu = float(r['factor_kg_co2e']), fam(r['unit'])
    best = None
    for d in rows:
        if d[3].startswith('-') or 'fraction' in d[3] or d[2] == 0: continue
        du = ufam(d[3])
        same_unit = (du == cu) or (cu == 'tkm' and du == 'veh-km')       # keep tonne-km vs vehicle-km visible as a unit mismatch
        if not same_unit: continue
        dv = d[2]
        rel = abs(cv - dv) / abs(dv)
        if best is None or rel < best[0]: best = (rel, d, du != cu)
    if best and best[0] <= 0.02:
        matches.append((r['slug'], r['country'], r['year'], r['unit'], cv, best[1][0], best[1][1], best[1][2], round(100 * (cv - best[1][2]) / best[1][2], 3), 'UNIT MISMATCH' if best[2] else ''))
with open(OUT + '/catalog_matches.csv', 'w', newline='', encoding='utf-8-sig') as fh:
    w = csv.writer(fh); w.writerow(['slug', 'country', 'year', 'unit', 'stored', 'doc_id', 'doc_description', 'doc_value', 'diff_pct', 'flag']); [w.writerow(m) for m in matches]
print(len(matches), 'catalog factors within 2% of a documented value')
for m in sorted(matches, key=lambda m: abs(m[8])): print('  ', f'{m[0][:24]:24} {m[1][:6]:6} {m[3]:8} stored={m[4]:<10} ~ {m[5]:16} doc={m[7]:<12.6g} {m[8]:+8.3f}% {m[9]}')
