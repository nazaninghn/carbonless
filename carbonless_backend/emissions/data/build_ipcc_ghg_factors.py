"""Builds ipcc_ghg_factors.json: the factor rows of the IPCC and GHG Protocol standards.

Run:  python emissions/data/build_ipcc_ghg_factors.py      (writes the JSON next to this file)

What the two standards are here (owner to confirm; change the constants below and re-run to change them):

* Both use the IPCC default emission factors per gas (2006 IPCC Guidelines for National Greenhouse Gas
  Inventories, Volume 2 Energy — the defaults the IPCC Emission Factor Database holds) and the IPCC default
  net calorific values.
* They differ in the global warming potentials that turn CH4, N2O and the fluorinated gases into CO2e:
    - "ipcc": IPCC Fifth Assessment Report (AR5) 100-year GWPs, the set national inventories under the
      Paris Agreement report with (decision 18/CMA.1);
    - "ghg":  IPCC Sixth Assessment Report (AR6) 100-year GWPs, the set the GHG Protocol recommends
      ("IPCC Global Warming Potential Values", GHG Protocol, version 2.0, August 2024).
  Both GWP columns are copied from that GHG Protocol document.

Neither standard publishes factors for grid electricity (the national factor is used) or for the Scope 3
categories: those stay "not calculated" under these standards.

Every number below is copied from the table named beside it. Nothing is estimated.
"""
import json
from decimal import Decimal as D
from pathlib import Path

# ── IPCC 2006, Vol. 2, Ch. 1, Table 1.2: default net calorific values, TJ/Gg (= GJ/tonne) ──────────────
NCV = {'natural_gas': D('48.0'), 'gas_diesel_oil': D('43.0'), 'motor_gasoline': D('44.3'),
       'residual_fuel_oil': D('40.4'), 'lpg': D('47.3'), 'other_bituminous_coal': D('25.8')}

# ── kg of gas per TJ (net calorific basis): (CO2, CH4, N2O) ─────────────────────────────────────────────
# CO2: Table 1.4 (Ch. 1), repeated in Tables 2.3, 3.2.1 and 3.3.1.
STATIONARY = {   # Ch. 2, Table 2.3 — manufacturing industries and construction
    'natural_gas': (56100, D('1'), D('0.1')),
    'gas_diesel_oil': (74100, D('3'), D('0.6')),
    'motor_gasoline': (69300, D('3'), D('0.6')),
    'residual_fuel_oil': (77400, D('3'), D('0.6')),
    'lpg': (63100, D('1'), D('0.1')),
    'other_bituminous_coal': (94600, D('10'), D('1.5')),
}
ROAD = {         # Ch. 3, Tables 3.2.1 (CO2) and 3.2.2 (CH4, N2O)
    'gas_diesel_oil': (74100, D('3.9'), D('3.9')),
    # "Motor Gasoline – Low Mileage Light Duty Vehicle Vintage 1995 or Later"
    'motor_gasoline': (69300, D('3.8'), D('5.7')),
    'natural_gas': (56100, D('92'), D('3')),
    'lpg': (63100, D('62'), D('0.2')),
}
OFF_ROAD = {     # Ch. 3, Table 3.3.1 — Industry
    'gas_diesel_oil': (74100, D('4.15'), D('28.6')),
    'motor_gasoline': (69300, D('50'), D('2')),      # Motor Gasoline 4-stroke
}
TABLE = {'stationary': (STATIONARY, 'Table 2.3 (manufacturing industries and construction)'),
         'road': (ROAD, 'Tables 3.2.1 and 3.2.2 (road transport)'),
         'off_road': (OFF_ROAD, 'Table 3.3.1 (off-road, industry)')}
FUEL_NAME = {'natural_gas': 'Natural Gas', 'gas_diesel_oil': 'Gas/Diesel Oil', 'motor_gasoline': 'Motor Gasoline',
             'residual_fuel_oil': 'Residual Fuel Oil', 'lpg': 'Liquefied Petroleum Gases',
             'other_bituminous_coal': 'Other Bituminous Coal'}

# ── Energy content per volume ────────────────────────────────────────────────────────────────────────────
# The IPCC Guidelines give calorific values per mass only. A factor per litre or per m3 needs the fuel's
# energy per volume: net CV (GJ/tonne) x density (kg/m3) of the SAME row of the UK Government GHG
# Conversion Factors 2026, "Fuel properties" sheet — the only one of the supplied sources that states both.
VOLUME = {       # name of the row: (net CV GJ/tonne, density kg/m3)
    'natural_gas_m3': ('Natural Gas', D('44.695'), D('0.808')),
    'diesel_litre': ('Diesel (100% mineral diesel)', D('43.031'), D('830.565')),
    'gas_oil_litre': ('Gas Oil', D('42.569'), D('853.971')),
    'petrol_litre': ('Petrol (100% mineral petrol)', D('44.593'), D('746.269')),
    'fuel_oil_litre': ('Fuel Oil', D('40.752'), D('983.284')),
    'lpg_litre': ('LPG', D('45.944'), D('529.749')),
}

# ── 100-year GWPs: GHG Protocol, "IPCC Global Warming Potential Values" v2.0 (Aug 2024) — (AR5, AR6) ───
GWP = {
    'CO2': (D('1'), D('1')),
    'CH4_combustion': (D('28'), D('27.0')),     # "Methane – non-fossil": the document assigns it to combustion
    'CH4_fossil': (D('30'), D('29.8')),         # "Methane – fossil": fugitive methane
    'N2O': (D('265'), D('273')),
    'SF6': (D('23500'), D('24300')),
    'HFC-32': (D('677'), D('771')), 'HFC-125': (D('3170'), D('3740')),
    'HFC-134a': (D('1300'), D('1530')), 'HFC-143a': (D('4800'), D('5810')),
    'HFC-227ea': (D('3350'), D('3600')), 'HCFC-22': (D('1760'), D('1960')),
}
STANDARDS = {'ipcc': (0, 'AR5'), 'ghg': (1, 'AR6')}
# Refrigerant blends by mass (ANSI/ASHRAE 34 compositions). With the AR5 GWPs above they give the blend
# values the UK Government conversion factors 2026 publish (R410A 1924, R404A 3943, R407C 1624).
BLENDS = {'R-410A': {'HFC-32': D('0.50'), 'HFC-125': D('0.50')},
          'R-404A': {'HFC-125': D('0.44'), 'HFC-143a': D('0.52'), 'HFC-134a': D('0.04')},
          'R-407C': {'HFC-32': D('0.23'), 'HFC-125': D('0.25'), 'HFC-134a': D('0.52')}}

# ── The platform's factor slugs these standards can calculate ────────────────────────────────────────────
# slug: (table, fuel, unit basis, catalogue unit, scope, category, name, name_tr)
#   basis 'gj'  = per GJ (net);  'kg' = per kg via the IPCC NCV;  a VOLUME key = per litre / m3.
S1S, S1M = ('scope1', 'stationary_combustion'), ('scope1', 'mobile_combustion')
COMBUSTION = {
    'natural-gas': ('stationary', 'natural_gas', 'gj', 'gj', *S1S, 'Natural Gas', 'Doğal Gaz'),
    'natural-gas-m3': ('stationary', 'natural_gas', 'natural_gas_m3', 'm3', *S1S, 'Natural Gas (m³)', 'Doğal Gaz (m³)'),
    'diesel': ('stationary', 'gas_diesel_oil', 'diesel_litre', 'liters', *S1S, 'Diesel (volume)', 'Motorin (hacim)'),
    'gas-diesel-oil-energy': ('stationary', 'gas_diesel_oil', 'gj', 'gj', *S1S, 'Gas/Diesel Oil (energy basis)', 'Motorin (enerji bazlı)'),
    'motor-gasoline': ('stationary', 'motor_gasoline', 'gj', 'gj', *S1S, 'Motor Gasoline', 'Benzin'),
    'fuel-oil': ('stationary', 'residual_fuel_oil', 'fuel_oil_litre', 'liters', *S1S, 'Fuel Oil (volume)', 'Fuel Oil (hacim)'),
    'lpg': ('stationary', 'lpg', 'lpg_litre', 'liters', *S1S, 'LPG', 'LPG'),
    'propane': ('stationary', 'lpg', 'kg', 'kg', *S1S, 'Propane (mass)', 'Propan (kütle)'),
    'coal': ('stationary', 'other_bituminous_coal', 'kg', 'kg', *S1S, 'Coal', 'Kömür'),
    'coal-industrial': ('stationary', 'other_bituminous_coal', 'kg', 'kg', *S1S, 'Coal (industrial)', 'Kömür (sanayi)'),
    'on-road-diesel': ('road', 'gas_diesel_oil', 'gj', 'gj', *S1M, 'On-Road Diesel', 'Karayolu Motorin'),
    'on-road-gasoline': ('road', 'motor_gasoline', 'gj', 'gj', *S1M, 'On-Road Gasoline', 'Karayolu Benzin'),
    'on-road-natural-gas': ('road', 'natural_gas', 'gj', 'gj', *S1M, 'On-Road Natural Gas', 'Karayolu Doğal Gaz'),
    'on-road-lpg': ('road', 'lpg', 'gj', 'gj', *S1M, 'On-Road LPG', 'Karayolu LPG'),
    'motorin-mobile': ('road', 'gas_diesel_oil', 'diesel_litre', 'liters', *S1M, 'Diesel – mobile', 'Motorin – hareketli'),
    'diesel-generic': ('road', 'gas_diesel_oil', 'diesel_litre', 'liters', *S1M, 'Diesel (road)', 'Motorin (karayolu)'),
    'on-road-diesel-desnz': ('road', 'gas_diesel_oil', 'diesel_litre', 'liters', *S1M, 'On-Road Diesel', 'Karayolu Motorin'),
    'gasoline-generic': ('road', 'motor_gasoline', 'petrol_litre', 'liters', *S1M, 'Gasoline (road)', 'Benzin (karayolu)'),
    'on-road-petrol-desnz': ('road', 'motor_gasoline', 'petrol_litre', 'liters', *S1M, 'On-Road Petrol', 'Karayolu Benzin'),
    'cng': ('road', 'natural_gas', 'kg', 'kg', *S1M, 'CNG', 'CNG'),
    'off-road-ipcc': ('off_road', 'gas_diesel_oil', 'gj', 'gj', *S1M, 'Off-Road Diesel (energy basis)', 'Arazi Motorin (enerji bazlı)'),
    'off-road-diesel-desnz': ('off_road', 'gas_diesel_oil', 'gas_oil_litre', 'liters', *S1M, 'Off-Road Diesel', 'Arazi Motorin'),
    'off-road-gasoline-desnz': ('off_road', 'motor_gasoline', 'petrol_litre', 'liters', *S1M, 'Off-Road Gasoline', 'Arazi Benzin'),
    'product-gas-use': ('stationary', 'natural_gas', 'gj', 'gj', 'scope3', 'use_of_sold', 'Product gas use (lifetime)', 'Ürün gaz kullanımı (ömür boyu)'),
    'product-fuel-use': ('stationary', 'gas_diesel_oil', 'diesel_litre', 'liters', 'scope3', 'use_of_sold', 'Product fuel use (lifetime)', 'Ürün yakıt kullanımı (ömür boyu)'),
}
S1F = ('scope1', 'fugitive_emissions')
# slug: (gas or blend, reporting column, name, name_tr)
FUGITIVE = {
    'r410a': ('R-410A', 'hfc', 'R-410A', 'R-410A'), 'r404a': ('R-404A', 'hfc', 'R-404A', 'R-404A'),
    'r407c': ('R-407C', 'hfc', 'R-407C', 'R-407C'), 'r134a': ('HFC-134a', 'hfc', 'R-134a (HFC-134a)', 'R-134a (HFC-134a)'),
    'r32': ('HFC-32', 'hfc', 'R-32', 'R-32'), 'hfc-227ea': ('HFC-227ea', 'hfc', 'HFC-227ea', 'HFC-227ea'),
    'r22': ('HCFC-22', 'hfc', 'HCFC-22 / R-22', 'HCFC-22 / R-22'),
    'sf6': ('SF6', 'sf6', 'SF6 (Sulphur hexafluoride)', 'SF6 (Kükürt hekzaflorür)'),
    'methane': ('CH4_fossil', 'ch4', 'Methane (CH4)', 'Metan (CH4)'),
    'n2o': ('N2O', 'n2o', 'Nitrous Oxide (N2O)', 'Diazot monoksit (N2O)'),
    'co2-fire-suppression': ('CO2', 'co2', 'CO2 fire suppression', 'CO2 yangın söndürme'),
}
GUIDE = '2006 IPCC Guidelines for National Greenhouse Gas Inventories, Vol. 2 Energy'
GWP_DOC = 'GHG Protocol, IPCC Global Warming Potential Values v2.0 (Aug 2024)'


def q(x):
    return str(D(x).quantize(D('0.000001')))


def energy_per_unit(fuel, basis):
    """(GJ per catalogue unit, how it was obtained)."""
    if basis == 'gj':
        return D('1'), ''
    if basis == 'kg':
        return NCV[fuel] / 1000, f'; per kg with the IPCC default NCV {NCV[fuel]} TJ/Gg (Table 1.2)'
    row, ncv, density = VOLUME[basis]
    unit = 'm3' if basis.endswith('_m3') else 'litre'
    per = ncv * density / 1000 / (1 if unit == 'm3' else 1000)
    return per, (f'; per {unit} with the energy content of "{row}" in the UK Government GHG Conversion '
                 f'Factors 2026, Fuel properties (net CV {ncv} GJ/tonne x density {density} kg/m3) — '
                 f'the IPCC Guidelines give no density')


def build():
    rows = []
    for standard, (i, ar) in STANDARDS.items():
        label = 'IPCC' if standard == 'ipcc' else 'GHG Protocol'
        for slug, (table, fuel, basis, unit, scope, category, name, name_tr) in COMBUSTION.items():
            co2, ch4, n2o = TABLE[table][0][fuel]
            gj, how = energy_per_unit(fuel, basis)
            gas = {'co2': D(co2) * gj / 1000, 'ch4': ch4 * GWP['CH4_combustion'][i] * gj / 1000,
                   'n2o': n2o * GWP['N2O'][i] * gj / 1000}
            rows.append({
                'standard': standard, 'slug': slug, 'year': 2006, 'unit': unit, 'scope': scope, 'category': category,
                'name': name, 'name_tr': name_tr, 'factor_kg_co2e': q(sum(gas.values())),
                'gas': {k: q(v) for k, v in gas.items()},
                'reference': (f'{label} standard: {GUIDE}, {TABLE[table][1]}, {FUEL_NAME[fuel]}: '
                              f'{co2} kg CO2, {ch4} kg CH4, {n2o} kg N2O per TJ (net){how}; '
                              f'{ar} GWP100 CH4 {GWP["CH4_combustion"][i]}, N2O {GWP["N2O"][i]} ({GWP_DOC}).'),
            })
        for slug, (gas_name, column, name, name_tr) in FUGITIVE.items():
            if gas_name in BLENDS:
                value = sum(share * GWP[g][i] for g, share in BLENDS[gas_name].items())
                made = ' = ' + ' + '.join(f'{int(share * 100)}% {g} ({GWP[g][i]})' for g, share in BLENDS[gas_name].items())
            else:
                value, made = GWP[gas_name][i], ''
            rows.append({
                'standard': standard, 'slug': slug, 'year': 2006, 'unit': 'kg', 'scope': S1F[0], 'category': S1F[1],
                'name': name, 'name_tr': name_tr, 'factor_kg_co2e': q(value), 'gas': {column: q(value)},
                'reference': f'{label} standard: {ar} GWP100 of {gas_name}{made} ({GWP_DOC}).',
            })
    return rows


if __name__ == '__main__':
    out = Path(__file__).with_name('ipcc_ghg_factors.json')
    rows = build()
    out.write_text(json.dumps({'source': __doc__.strip().splitlines()[0], 'factors': rows},
                              ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{len(rows)} rows -> {out.name}')
