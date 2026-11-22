"""Builds defra_factors.json: the factor rows of the DEFRA standard, one per published edition.

Run:  python emissions/data/build_defra_factors.py <folder with the DEFRA flat files>

The folder holds the "flat file" workbook of each edition of the UK Government GHG Conversion Factors for
Company Reporting (gov.uk collection "Government conversion factors for company reporting"), named
defra_<year>.xlsx (or .xls) for 2014 … 2026. Two editions (2021, 2022) are published as .xls files that the
xlrd reader refuses; convert them to .xlsx first (LibreOffice: soffice --headless --convert-to xlsx) and put
the converted file in a "conv" sub-folder, which is read in preference. Needs pandas, openpyxl and xlrd.

What it does: MAP names, for each factor slug of the platform, the DEFRA row that publishes it (level 1-4,
column text, unit) and the unit scaling to the platform's unit. For every edition the row's "kg CO2e" value
becomes that slug's factor of that year, with its CO2 / CH4 / N2O split when the edition publishes one that
adds up. A slug with no DEFRA row is not in MAP and is simply not calculated under the DEFRA standard.
Nothing is estimated. To change a mapping, edit MAP and re-run — never edit the JSON by hand. A mapping that
is wrong for a site outside the UK stays in MAP and is withheld in withheld_factors.json instead.
"""
import glob
import importlib.util
import json
import os
import re
import sys
import warnings
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
YEARS = range(2014, 2027)


def norm(s):
    return re.sub(r'\s+', ' ', str(s)).strip().lower()


def read_flat_files(folder):
    """Every numeric row of every edition: year, levels 1-4, column text, unit, gas label, factor."""
    warnings.filterwarnings('ignore')
    frames = []
    for y in YEARS:
        cand = glob.glob(os.path.join(folder, 'conv', f'defra_{y}.*')) or glob.glob(os.path.join(folder, f'defra_{y}.*'))
        if not cand:
            sys.exit(f'no flat file for {y} in {folder} (expected defra_{y}.xlsx)')
        xl = pd.ExcelFile(cand[0])
        found = None
        for sn in xl.sheet_names:
            raw = xl.parse(sn, header=None)
            for i in range(min(15, len(raw))):
                vals = [str(v).strip() for v in raw.iloc[i].tolist()]
                if 'Scope' in vals and 'Level 1' in vals:
                    found = (sn, i)
                    break
            if found:
                break
        sn, i = found
        df = xl.parse(sn, header=i)
        df.columns = [str(c).strip() for c in df.columns]
        fcol = [c for c in df.columns if c == 'Factor' or 'Conversion Factor' in c][0]
        gcol = [c for c in df.columns if c in ('GHG', 'GHG/Unit')][0]
        o = pd.DataFrame({
            'year': y, 'l1': df['Level 1'], 'l2': df['Level 2'], 'l3': df['Level 3'], 'l4': df['Level 4'],
            'col': df['Column Text'], 'uom': df['UOM'], 'ghg': df[gcol],
            'factor': pd.to_numeric(df[fcol], errors='coerce'),
        })
        for c in ('l1', 'l2', 'l3', 'l4', 'col', 'uom', 'ghg'):
            o[c] = o[c].astype(str).str.strip().replace({'nan': '', 'None': ''})
        frames.append(o[o['l1'] != ''].dropna(subset=['factor']))
    D = pd.concat(frames, ignore_index=True)
    for c in ('l1', 'l2', 'l3', 'l4', 'col', 'uom'):
        D[c + '_n'] = D[c].map(norm)
    return D


# ── slug -> (kind of match, DEFRA row) ───────────────────────────────────────────────────────────────────
GJ = 277.777778; T = 0.001
K = 'Emissions including only Kyoto products'; NK = 'Emissions including only non-Kyoto products'
def F(l3, uom, s=1.0): return dict(l1='Fuels', l3=l3, uom=uom, scale=s)
def R(l3, col=K): return dict(l1='Refrigerant & other', l3=l3, col=col, uom='kg')
def MU(l3, col='Primary material production'): return dict(l1='Material use', l3=l3, col=col, uom='tonnes', scale=T)
def W(l3, col): return dict(l1='Waste disposal', l3=l3, col=col, uom='tonnes', scale=T)
def AIR(l3, l4): return dict(l1='Business travel- air', l3=l3, l4=l4, col='With RF', uom='passenger.km')
# A company outside the UK flies between non-UK countries: DEFRA publishes "International, to/from non-UK"
# for that, by cabin class, and recommends the radiative-forcing ("With RF") rows for all flights.
def AIRNU(l4): return AIR('International, to/from non-UK', l4)
def LAND(l3, col='', uom='km'): return dict(l1='Business travel- land', l3=l3, col=col, uom=uom)
def PV(col): return dict(l1='Passenger vehicles', l3='Average car', col=col, uom='km')
def FR(l2, l3, col='', l4=''): return dict(l1='Freighting goods', l2=l2, l3=l3, l4=l4, col=col, uom='tonne.km')
HGV = ['HGV (non-refrigerated, all diesel)', 'HGV (all diesel)']
E, N, M = 'same item', 'nearest item', 'different method'
MAP = {
 'coal-industrial': (E, F('Coal (industrial)', 'tonnes', T)),
 'gas-diesel-oil-energy': (N, F('Gas oil', 'kWh (Net CV)', GJ)),
 'lpg': (E, F('LPG', 'litres')),
 'propane': (E, F('Propane', 'tonnes', T)),
 'motor-gasoline': (N, F('Petrol (100% mineral petrol)', 'kWh (Net CV)', GJ)),
 'natural-gas': (N, F('Natural gas', 'kWh (Net CV)', GJ)),
 'diesel': (N, F('Diesel (100% mineral diesel)', 'litres')),
 'coal': (N, F('Coal (industrial)', 'tonnes', T)),
 'fuel-oil': (N, F('Fuel oil', 'litres')),
 'off-road-ipcc': (N, F('Gas oil', 'kWh (Net CV)', GJ)),
 'on-road-diesel': (N, F('Diesel (100% mineral diesel)', 'kWh (Net CV)', GJ)),
 'on-road-gasoline': (N, F('Petrol (100% mineral petrol)', 'kWh (Net CV)', GJ)),
 'on-road-natural-gas': (N, F('Natural gas', 'kWh (Net CV)', GJ)),
 'on-road-lpg': (N, F('LPG', 'kWh (Net CV)', GJ)),
 'off-road-diesel-desnz': (N, F('Gas oil', 'litres')),
 'on-road-diesel-desnz': (N, F('Diesel (average biofuel blend)', 'litres')),
 'off-road-gasoline-desnz': (N, F('Petrol (average biofuel blend)', 'litres')),
 'on-road-petrol-desnz': (N, F('Petrol (average biofuel blend)', 'litres')),
 'gasoline-generic': (N, F('Petrol (average biofuel blend)', 'litres')),
 'diesel-generic': (N, F('Diesel (average biofuel blend)', 'litres')),
 'motorin-mobile': (N, F('Diesel (average biofuel blend)', 'litres')),
 'cng': (N, F('CNG', 'tonnes', T)),
 'natural-gas-kwh': (E, F('Natural gas', 'kWh (Gross CV)')),
 'natural-gas-m3': (E, F('Natural gas', 'cubic metres')),
 'diesel-kwh': (E, F('Gas oil', 'kWh (Gross CV)')),
 'biodiesel': (E, dict(l1='Bioenergy', l3='Biodiesel ME', uom='litres')),
 'bioethanol': (E, dict(l1='Bioenergy', l3='Bioethanol', uom='litres')),
 'wood-pellets': (E, dict(l1='Bioenergy', l3='Wood pellets', uom='tonnes', scale=T)),
 'biogas': (E, dict(l1='Bioenergy', l3='Biogas', uom='kWh')),
 'product-gas-use': (N, F('Natural gas', 'kWh (Net CV)', GJ)),
 'product-fuel-use': (N, F('Diesel (average biofuel blend)', 'litres')),
 'fuel-extraction': (N, dict(l1='WTT- fuels', l3='Diesel (average biofuel blend)', uom='litres')),
 'vehicle-km': (N, PV('Unknown')), 'car-gasoline': (N, PV('Petrol')), 'car-diesel': (N, PV('Diesel')),
 'car-lpg': (N, PV('LPG')), 'car-hybrid': (N, PV('Hybrid')),
 'taxi': (N, LAND('Regular taxi')), 'road-travel': (N, LAND('Average car', 'Unknown')),
 'car-commute': (N, LAND('Average car', 'Unknown')), 'car-rental-diesel': (N, LAND('Average car', 'Diesel')),
 'car-rental-petrol': (N, LAND('Average car', 'Petrol')), 'motorcycle-commute': (N, LAND('Average')),
 'train': (N, LAND('National rail', uom='passenger.km')), 'train-travel': (N, LAND('National rail', uom='passenger.km')),
 'train-commute': (N, LAND('National rail', uom='passenger.km')),
 'metro': (N, LAND('Light rail and tram', uom='passenger.km')), 'metro-commute': (N, LAND('Light rail and tram', uom='passenger.km')),
 'bus': (N, LAND('Average local bus', uom='passenger.km')), 'bus-travel': (N, LAND('Average local bus', uom='passenger.km')),
 'bus-commute': (N, LAND('Average local bus', uom='passenger.km')), 'shuttle-bus-commute': (N, LAND('Average local bus', uom='passenger.km')),
 'ferry-travel': (E, dict(l1='Business travel- sea', l3='Foot passenger', uom='passenger.km')),
 'flight-domestic': (N, AIR('Domestic, to/from UK', 'Average passenger')),
 'flight-international': (N, AIR('International, to/from non-UK', 'Average passenger')),
 'flight-short': (N, AIRNU('Average passenger')),
 'flight-medium': (N, AIRNU('Average passenger')),
 'flight-long': (N, AIRNU('Average passenger')),
 'flight-short-economy': (N, AIRNU('Economy class')),
 'flight-long-economy': (N, AIRNU('Economy class')),
 'flight-long-business': (N, AIRNU('Business class')),
 'flight-long-first': (N, AIRNU('First class')),
 'hotel-turkey': (E, dict(l1='Hotel stay', l3='Turkey', uom='Room per night')),
 'hotel-uk': (E, dict(l1='Hotel stay', l3='UK', uom='Room per night')),
 'r410a': (E, R('R410A')), 'r432a': (E, R('R432A', NK)), 'r22': (E, R('HCFC-22/R22 = chlorodifluoromethane', NK)),
 'hfc-227ea': (E, R('HFC-227ea')), 'r600a': (E, R('R600A = isobutane', NK)), 'r134a': (E, R('HFC-134a')),
 'r404a': (E, R('R404A')), 'r407c': (E, R('R407C')), 'r32': (E, R('HFC-32')), 'sf6': (E, R('Sulphur hexafluoride (SF6)')),
 'methane': (E, R('Methane')), 'n2o': (E, R('Nitrous oxide')), 'co2-fire-suppression': (E, R('Carbon dioxide')),
 'uk-grid': (E, dict(l1='UK electricity', l3='Electricity: UK', uom='kWh')),
 'uk-transmission-losses': (E, dict(l1='Transmission and distribution', l2='T&D- UK electricity', l3='Electricity: UK', uom='kWh')),
 'transmission-losses': (N, dict(l1='Transmission and distribution', l2='T&D- UK electricity', l3='Electricity: UK', uom='kWh')),
 'district-heating': (N, dict(l1='Heat and steam', l3='District heat and steam', uom='kWh')),
 'steam': (N, dict(l1='Heat and steam', l3='District heat and steam', uom='kWh')),
 'water-supply': (E, dict(l1='Water supply', l3='Water supply', uom='cubic metres')),
 'water-treatment': (E, dict(l1='Water treatment', l3='Water treatment', uom='cubic metres')),
 'electrical-large': (E, MU('Electrical items - large')), 'electrical-small': (E, MU('Electrical items - small')),
 'electrical-fridges': (E, MU('Electrical items - fridges and freezers')), 'electrical-it': (E, MU('Electrical items - IT')),
 'glass': (E, MU('Glass')), 'metal-aluminium': (E, MU('Metal: aluminium cans and foil (excl. forming)')),
 'metal-mixed-cans': (E, MU('Metal: mixed cans')), 'metal-steel-cans': (E, MU('Metal: steel cans')),
 'mineral-oil': (E, MU('Mineral oil')), 'paper-mixed': (E, MU('Paper and board: mixed')),
 'plastic-average': (E, MU('Plastics: average plastics')), 'plastic-hdpe': (E, MU('Plastics: HDPE (incl. forming)')),
 'wood': (E, MU('Wood')), 'plastic': (E, MU('Plastics: average plastics')), 'carton': (E, MU('Paper and board: mixed')),
 'metal-primary': (E, MU('Metals')), 'metal-recycled': (E, MU('Metals', 'Closed-loop source')),
 'foam-tape': (N, MU('Plastics: LDPE and LLDPE (incl. forming)')),
 'truck-freight': (N, FR(HGV, ['All HGVs', 'Average non-refrigerated HGVs'], 'Average laden')), 'truck-delivery': (N, FR(HGV, ['All HGVs', 'Average non-refrigerated HGVs'], 'Average laden')),
 'rail-freight': (N, FR(['Rail'], 'Freight train')), 'sea-freight': (N, FR(['Cargo ship'], 'Container ship', l4='Average')),
 'air-freight': (N, FR(['Freight flights'], 'International, to/from non-UK', 'With RF')),
 'tm-01': (N, FR(HGV, 'Articulated (>33t)', '100% Laden')), 'tm-02': (N, FR(HGV, 'Articulated (>33t)', '50% Laden')),
 'tm-03': (N, FR(['Vans'], 'Average (up to 3.5 tonnes)', 'Diesel')),
 'tm-04': (N, FR(['Cargo ship'], 'Container ship', l4='8000+ TEU')), 'tm-05': (N, FR(['Cargo ship'], 'Container ship', l4='5000–7999 TEU')),
 'tm-06': (N, FR(['Cargo ship'], 'Bulk carrier', l4='Average')),
 'tm-07': (N, FR(['Freight flights'], 'International, to/from non-UK', 'With RF')),
 'tm-07-short': (N, FR(['Freight flights'], 'International, to/from non-UK', 'With RF')),
 'tm-08': (N, FR(['Rail'], 'Freight train')),
 'general-landfill': (N, W('Commercial and industrial waste', 'Landfill')), 'landfill': (N, W('Commercial and industrial waste', 'Landfill')),
 'wt-10-landfill': (N, W('Household residual waste', 'Landfill')), 'product-landfill': (N, W('Household residual waste', 'Landfill')),
 'recyclable': (M, W('Commercial and industrial waste', 'Closed-loop')), 'product-recycling': (M, W('Commercial and industrial waste', 'Closed-loop')),
 'incineration': (M, W('Commercial and industrial waste', 'Combustion')), 'product-incineration': (M, W('Commercial and industrial waste', 'Combustion')),
 'organic-compost': (M, W('Organic: food and drink waste', 'Composting')), 'wt-06-compost': (M, W('Organic: food and drink waste', 'Composting')),
 'wt-06-anaerobic': (M, W('Organic: food and drink waste', 'Anaerobic digestion')),
 'wt-01-landfill': (N, W('Paper and board: mixed', 'Landfill')), 'wt-01-recycling': (M, W('Paper and board: mixed', 'Closed-loop')),
 'wt-02-landfill': (M, W('Plastics: average plastics', 'Landfill')), 'wt-03-recycling': (M, W('Metal: steel cans', 'Closed-loop')),
 'wt-04-recycling': (M, W('Metal: aluminium cans and foil (excl. forming)', 'Closed-loop')),
 'wt-07-licensed': (M, W('WEEE - mixed', 'Open-loop')),
}
for k in list(MAP):
    if k.startswith('tm-'):
        MAP[k + '-ds'] = MAP[k]          # the downstream-transport twin of each transport mode

GAS = {'co2': {'kg CO2e of CO2 per unit', 'kg CO2e of CO2', 'kg CO2', 'CO2'},
       'ch4': {'kg CO2e of CH4 per unit', 'kg CO2e of CH4', 'kg CH4', 'CH4'},
       'n2o': {'kg CO2e of N2O per unit', 'kg CO2e of N2O', 'kg N2O', 'N2O'},
       'total': {'kg CO2e', 'All Gases (CO2e)'}}


def rows_for(D, spec, y):
    l3s = spec['l3'] if isinstance(spec['l3'], list) else [spec['l3']]
    x = D[(D['year'] == y) & (D['l1_n'] == norm(spec['l1'])) & (D['l3_n'].isin([norm(v) for v in l3s]))
          & (D['uom_n'] == norm(spec['uom']))]
    if 'l2' in spec:
        l2s = spec['l2'] if isinstance(spec['l2'], list) else [spec['l2']]
        x = x[x['l2_n'].isin([norm(v) for v in l2s])]
    if spec.get('l4'):
        x = x[x['l4_n'] == norm(spec['l4'])]
    if 'col' in spec:
        xc = x[x['col_n'] == norm(spec['col'])]
        if len(xc) or (spec['col'] != '' and spec['l1'] != 'Refrigerant & other'):
            x = xc
    return x


def one(x, labels):
    """The value, when the selection names exactly one."""
    v = sorted(set(round(float(f), 8) for f in x[x['ghg'].isin(labels)]['factor']))
    return v[0] if len(v) == 1 else None


def catalogue():
    """Unit, scope, category and names of each slug: the platform catalogue (first row of the slug)."""
    spec = importlib.util.spec_from_file_location('seed_data', HERE.parent / 'seed_data.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    first = {}
    for f in mod.EMISSION_FACTORS:
        first.setdefault(f['slug'], f)
    return first


def build(folder):
    D, first, out = read_flat_files(folder), catalogue(), []
    for slug, (kind, spec) in sorted(MAP.items()):
        base = first.get(slug)
        if not base:
            continue
        s = spec.get('scale', 1.0)
        row_name = ' | '.join(str(v[0] if isinstance(v, list) else v) for v in
                              [spec['l1'], spec.get('l2', ''), spec['l3'], spec.get('l4', ''), spec.get('col', ''), spec['uom']]
                              if v != '')
        for y in YEARS:
            x = rows_for(D, spec, y)
            tot = one(x, GAS['total'])
            if tot is None:
                continue
            rec = {'slug': slug, 'year': y, 'unit': base['unit'], 'scope': base['scope'], 'category': base['category'],
                   'name': base['name'].replace(' (Turkey)', ''), 'name_tr': base.get('name_tr', '').replace(' (Türkiye)', ''),
                   'factor_kg_co2e': round(tot * s, 8), 'match': kind, 'defra_row': row_name, 'defra_value': tot,
                   'defra_uom': spec['uom']}
            g = {k: one(x, GAS[k]) for k in ('co2', 'ch4', 'n2o')}
            if all(v is not None for v in g.values()) and tot and abs(sum(g.values()) - tot) / abs(tot) <= 0.01:
                rec['gas'] = {k: round(v * s, 8) for k, v in g.items()}
            out.append(rec)
    return out


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    rows = build(sys.argv[1])
    target = HERE / 'defra_factors.json'
    json.dump({'source': 'UK Government GHG Conversion Factors for Company Reporting (DESNZ/Defra), flat files 2014-2026, gov.uk',
               'factors': rows}, open(target, 'w'), ensure_ascii=False, indent=0)
    print(f'{len(rows)} rows, {len({r["slug"] for r in rows})} slugs, {sum("gas" in r for r in rows)} with a gas split -> {target.name}')
