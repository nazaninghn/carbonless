"""
Turn questionnaire answers into EmissionEntry rows.

Only questions that really ask for an activity amount create entries. The old
code treated every number in any Scope 1/2 step as a consumption amount, so
e.g. a supplier EF document (value 5, year 2026) became "2031 kWh natural gas",
the unit electricity price became kWh of grid electricity, and Scope 3 answers
(step ids K3…) never produced anything.

This module does not choose or change any emission factor. Each answer is
matched to an EmissionFactor that is already registered, following the
mapping the company's carbon expert approved:
  - 3A-5  per fuel type the user picked -> emissions.factor_lookup (same as chat)
  - 3B-7  vehicles: diesel litres -> motorin-mobile, petrol -> gasoline-generic,
          LPG/CNG -> lpg; off-road machines -> the DESNZ off-road factors;
          km only for passenger cars (car-<fuel>). Tonne-km, km of other
          vehicle classes, hybrids by litre and electric by km are not
          calculated (no Scope 1 factor of that vehicle class).
  - 4A-EV electric vehicle charging (kWh) -> grid electricity, only when it
          is not already part of the site electricity of 4A-1
  - 3C-2  production (tonnes) -> the process factor of that equipment type
  - 4A-1  electricity per site           -> emissions.factor_lookup
  - 4B-2  purchased heat / steam / cooling (GJ, MWh) -> district heating,
          steam, district cooling (kWh)
  - K3C1  spend in USD only (SC-07, SC-09); quantity by material; supplier
          declarations replace the generic calculation of their category
  - K3C3  "confirmed": upstream electricity + T&D losses on 4A-1 kWh,
          fuel extraction on litres of liquid fuel
  - K3C4-2 / K3C9-1 transport rows       -> the CarbonIQ catalog factor whose
    slug is the TM code (tm-01, tm-01-ds …), in tonne-km = load × distance
  - K3C5-2 waste rows                    -> the catalog factor whose slug is the
    WT code + disposal method (wt-01-landfill …), in kg
  - K3C6-2 business travel by BT code; hotel nights -> hotel-turkey
  - K3C8 … K3C15 leased assets, processing / use / end of life of sold
    products, franchises (reported total only), investments (PCAF)
An answer without a registered factor is skipped, never guessed.

A supplier / facility-specific factor (3A/3B/3C/4A/4B-EF-a), a supplier or
provider declaration and a PCAF attribution are not catalog factors: such an
entry is stored as kg CO2e on a "calculated" factor of the same scope and
category (factor 1), with the real factor named in its description. The same
holds for a catalog factor used under another category (LPG burnt in
vehicles, declared energy of a leased building, waste factors for the end of
life of sold products).
"""
import logging
import re
from decimal import Decimal, InvalidOperation

from chat.local_parser import parse_localized_number

logger = logging.getLogger(__name__)

DESCRIPTION_PREFIX = 'Questionnaire step'

# A units-bearing answer is typed as "1200 kWh" / "15.000 m³" in one string —
# split the leading number from the trailing unit so it can go through
# parse_localized_number. A bare number returns ('1200', '').
_QTY_UNIT_RE = re.compile(r'^\s*([\d.,]+)\s*([^\d,.\s][^\s]*)?\s*$')


def _split_amount_unit(raw):
    s = str(raw).strip()
    m = _QTY_UNIT_RE.match(s)
    if not m:
        return s, ''
    return m.group(1), (m.group(2) or '').strip()


def _number(raw):
    """Positive number from an answer field, or None."""
    if raw in (None, '') or isinstance(raw, (dict, list, bool)):
        return None
    if isinstance(raw, (int, float)):
        return float(raw) if raw > 0 else None
    try:
        value = parse_localized_number(str(raw))
    except (ValueError, TypeError):
        return None
    return value if value and value > 0 else None


def _answer(data):
    if not isinstance(data, dict):
        return None
    return data.get('answer')


def _rows(answer):
    """Rows of a repeatable compound answer ({items: [...]}, a list or one dict)."""
    if isinstance(answer, dict) and isinstance(answer.get('items'), list):
        return [r for r in answer['items'] if isinstance(r, dict)]
    if isinstance(answer, list):
        return [r for r in answer if isinstance(r, dict)]
    if isinstance(answer, dict):
        return [answer]
    return []


def _true(v):
    return v is True or str(v).lower() in ('true', 'yes', '1')


def _fmt(n, decimals=4):
    """A number in an entry description, Turkish style (1.200,5): the
    descriptions are read in the Turkish UI and ISO report, where "1,200"
    would mean 1.2."""
    text = f'{n:,.{decimals}f}'.rstrip('0').rstrip('.') if decimals else f'{n:,.0f}'
    return text.replace(',', ' ').replace('.', ',').replace(' ', '.')


# 3A-5 fuel keys that have registered factors (same activity names the chat uses).
_STATIONARY_FUELS = {'natural_gas', 'fuel_oil', 'diesel', 'lpg', 'coal'}
# Units as offered in the 3A-5 / 4A-1 unit pickers -> factor_lookup spelling.
# "ton" in the (Turkish) picker is the metric tonne.
_UNIT_ALIASES = {'ton': 'tonne'}


def _stationary_fuels(answer):
    """3A-5: {fuel_type: "amount unit"} -> one activity per fuel."""
    out = []
    if not isinstance(answer, dict):
        return out
    for fuel, raw in answer.items():
        if fuel not in _STATIONARY_FUELS:
            continue
        amount, unit = _split_amount_unit(raw)
        qty = _number(amount)
        if not qty:
            continue
        unit = unit.lower()
        out.append({'activity': fuel, 'quantity': qty, 'unit': _UNIT_ALIASES.get(unit, unit),
                    'label': fuel})
    return out


# 3A-5bio biomass type -> (bioenergy factor of the CH4 + N2O of burning it,
# unit it is entered in). Its CO2 is biogenic: not in the scope totals.
_BIOMASS = {'wood_pellets': ('wood-pellets', 'kg'), 'biogas': ('biogas', 'kwh')}
# Biogenic CO2 per unit — DESNZ/DEFRA 2024 "Outside of scopes": wood pellets
# 1 677,18 kg/t, biogas 0,19902 kg/kWh. Reported apart from the inventory.
_BIOGENIC_CO2_KG = {'wood_pellets': 1.67718, 'biogas': 0.19902}


def _biomass_amount(A):
    """(type, quantity in the factor's unit) of 3A-5 biomass, or None."""
    if not isinstance(A.get('3A-5'), dict) or A['3A-5'].get('biomass') in (None, ''):
        return None
    kind = A.get('3A-5bio')
    if kind not in _BIOMASS:
        return None
    amount, unit = _split_amount_unit(A['3A-5']['biomass'])
    qty, unit = _number(amount), unit.lower()
    if not qty:
        return None
    if _BIOMASS[kind][1] == 'kg':
        qty = {'kg': qty, 'ton': qty * 1000}.get(unit)
    elif unit != 'kwh':
        qty = None
    return (kind, qty) if qty else None


def biogenic_co2_kg(answers):
    """Biogenic CO2 of the biomass burnt (3A-5), reported separately."""
    A = {k: _value(v) for k, v in (answers or {}).items()}
    if A.get('3A-0') not in (None, '', 'yes'):
        return 0.0
    got = _biomass_amount(A)
    return got[1] * _BIOGENIC_CO2_KG[got[0]] if got else 0.0


def _electricity(answer):
    """4A-1: {site: "amount kWh|MWh"} (or one string) -> one grid electricity activity."""
    items = list(answer.values()) if isinstance(answer, dict) else [answer]
    total_kwh = 0.0
    for raw in items:
        amount, unit = _split_amount_unit(raw)
        qty = _number(amount)
        if not qty:
            continue
        unit = unit.lower()
        if unit in ('', 'kwh'):
            total_kwh += qty
        elif unit == 'mwh':
            total_kwh += qty * 1000
    if not total_kwh:
        return []
    return [{'activity': 'electricity', 'quantity': total_kwh, 'unit': 'kwh', 'label': ''}]


def _transport(answer, slug_suffix):
    """K3C4-2 / K3C9-1 rows -> tonne-km on the TM-code catalog factor."""
    out = []
    for row in _rows(answer):
        mode = str(row.get('transport_mode') or '')
        if not re.fullmatch(r'TM-0[1-8]', mode):
            continue
        load, distance = _number(row.get('load_tonne')), _number(row.get('distance_km'))
        if not load or not distance:
            continue
        out.append({'slug': mode.lower() + slug_suffix, 'quantity': load * distance,
                    'label': mode})
    return out


# disposal_method option -> suffix used in the WT catalog slugs
_DISPOSAL_SLUG = {
    'landfill': 'landfill',
    'recycling': 'recycling',
    'incineration': 'incineration',
    'composting': 'compost',
    'anaerobic_digestion': 'anaerobic',
    'licensed_contractor': 'licensed',
}


def _waste(answer):
    """K3C5-2 rows -> kg on the WT-code + disposal method catalog factor."""
    out = []
    for row in _rows(answer):
        wt = str(row.get('waste_type') or '')
        method = _DISPOSAL_SLUG.get(row.get('disposal_method'))
        if not re.fullmatch(r'WT-\d\d', wt) or not method:
            continue
        qty = _number(row.get('quantity_kg'))
        if not qty:
            continue
        out.append({'slug': f'{wt.lower()}-{method}', 'quantity': qty,
                    'label': f'{wt} {row.get("disposal_method")}'})
    return out


def activities_for_step(step_id, data):
    """The activity amounts a step's own answer reports; [] for any other
    question. Steps whose calculation needs other answers too (3B-7 needs the
    fuel type of 3B-5, …) are handled by activities_for_report."""
    answer = _answer(data)
    if answer in (None, ''):
        return []
    if step_id == '3A-5':
        return _stationary_fuels(answer)
    if step_id == '4A-1':
        return _electricity(answer)
    if step_id == 'K3C4-2':
        return _transport(answer, '')
    if step_id == 'K3C9-1':
        return _transport(answer, '-ds')
    if step_id == 'K3C5-2':
        return _waste(answer)
    return []


# ── Answers that need more than their own step ────────────────────────────────

def _value(stored):
    if isinstance(stored, dict) and 'answer' in stored:
        return stored['answer']
    return stored


# 3B-1 vehicle classes: road vehicles and off-road machines. Ships, aircraft,
# locomotives and "other" have no registered factor of their own.
_ROAD_VEHICLES = {f'EQ-3B-{i:02d}' for i in range(1, 11)}
_OFFROAD_MACHINES = {f'EQ-3B-{i:02d}' for i in range(11, 17)}
_ROAD_LITRE_SLUG = {'diesel': 'motorin-mobile', 'petrol': 'gasoline-generic'}
_OFFROAD_LITRE_SLUG = {'diesel': 'off-road-diesel-desnz', 'petrol': 'off-road-gasoline-desnz'}
_CAR_KM_SLUG = {'diesel': 'car-diesel', 'petrol': 'car-gasoline', 'lpg_cng': 'car-lpg', 'hybrid': 'car-hybrid'}


def _vehicles(A):
    """3B-7 {item: "amount unit"} with the fuel (3B-5) and data type (3B-6)
    of each vehicle type (or group of one, "EQ-3B-01#2")."""
    amounts, fuels, modes = A.get('3B-7'), A.get('3B-5'), A.get('3B-6')
    if not isinstance(amounts, dict):
        return []
    fuels = fuels if isinstance(fuels, dict) else {}
    modes = modes if isinstance(modes, dict) else {}
    out = []
    for key, raw in amounts.items():
        base = str(key).split('#')[0]
        fuel, mode = fuels.get(key), modes.get(key)
        amount, unit = _split_amount_unit(raw)
        qty = _number(amount)
        if not qty:
            continue
        unit = unit.lower()
        if mode == 'fuel_litres' and unit in ('litre', 'liter', 'l', ''):
            if fuel == 'lpg_cng' and (base in _ROAD_VEHICLES or base in _OFFROAD_MACHINES):
                # The registered LPG factor is per litre of LPG burnt; reported
                # under mobile combustion, where the vehicle belongs.
                out.append({'slug': 'lpg', 'quantity': qty, 'label': key,
                            'report_as': ('scope1', 'mobile_combustion'), 'litres': qty})
                continue
            table = _ROAD_LITRE_SLUG if base in _ROAD_VEHICLES else (
                _OFFROAD_LITRE_SLUG if base in _OFFROAD_MACHINES else {})
            slug = table.get(fuel)
            if slug:
                out.append({'slug': slug, 'quantity': qty, 'label': key, 'litres': qty})
        elif mode == 'annual_km' and unit in ('km', '') and base == 'EQ-3B-01':
            slug = _CAR_KM_SLUG.get(fuel)
            if slug:
                out.append({'slug': slug, 'quantity': qty, 'label': key})
    return out


def _ev_charging(A):
    """4A-EV: charging electricity of electric vehicles (3B-5 = electric),
    counted only when it is not already in the site electricity (4A-1)."""
    fuels = A.get('3B-5')
    if A.get('3B-0') == 'no' or not (isinstance(fuels, dict) and 'electric' in fuels.values()):
        return []
    ans = A.get('4A-EV')
    if not isinstance(ans, dict) or ans.get('in_site_bill') != 'no':
        return []
    kwh = _number(ans.get('ev_kwh'))
    if not kwh:
        return []
    return [{'activity': 'electricity', 'quantity': kwh, 'unit': 'kwh', 'label': 'EV', 'kwh': kwh}]


# 3C-1 process equipment -> process factor (per tonne of product).
_PROCESS_SLUG = {
    'EQ-3C-01': 'cement-clinker',
    'EQ-3C-02': 'lime-production',
    'EQ-3C-03': 'glass-production',
    'EQ-3C-05': 'steel-bof',
    'EQ-3C-06': 'steel-eaf',
    'EQ-3C-07': 'aluminium-smelting',
    'EQ-3C-08': 'ammonia-production',
    'EQ-3C-09': 'nitric-acid',
}


def _process(A):
    """3C-2 {equipment: {quantity, method}} -> tonnes of product."""
    ans = A.get('3C-2')
    if not isinstance(ans, dict):
        return []
    out = []
    for key, row in ans.items():
        slug = _PROCESS_SLUG.get(str(key).split('#')[0])
        qty = _number(row.get('quantity')) if isinstance(row, dict) else None
        if slug and qty:
            out.append({'slug': slug, 'quantity': qty, 'label': key})
    return out


_GJ_TO_KWH = 1e9 / 3.6e6  # exact: 1 GJ = 277.78 kWh
_PURCHASED_ENERGY_SLUG = {'heat': 'district-heating', 'steam': 'steam', 'cooling': 'district-cooling'}


def _energy_kwh(raw):
    amount, unit = _split_amount_unit(raw)
    qty = _number(amount)
    if not qty:
        return None
    unit = unit.lower()
    if unit == 'gj':
        return qty * _GJ_TO_KWH
    if unit == 'mwh':
        return qty * 1000
    if unit == 'kwh':
        return qty
    return None  # tonnes of steam, m³ of compressed air: no factor


def _purchased_energy(A):
    """4B-2 {heat|steam|cooling|compressed_air: "amount unit"} -> kWh."""
    ans = A.get('4B-2')
    if not isinstance(ans, dict):
        return []
    out = []
    for kind, raw in ans.items():
        slug = _PURCHASED_ENERGY_SLUG.get(kind)
        kwh = _energy_kwh(raw) if slug else None
        if kwh:
            out.append({'slug': slug, 'quantity': kwh, 'label': kind})
    return out


# K3C1 purchased goods
_SPEND_SLUG = {'SC-07': 'legal-accounting', 'SC-09': 'food-catering'}  # kg CO2e per USD
MATERIAL_SLUG = {  # K3C1-3m option -> purchased goods factor per kg
    'chemical': 'chemical', 'chemical_oil': 'chemical-oil', 'plastic': 'plastic',
    'plastic_hdpe': 'plastic-hdpe', 'metal_primary': 'metal-primary',
    'metal_recycled': 'metal-recycled', 'metal_aluminium': 'metal-aluminium',
    'wood': 'wood', 'carton': 'carton', 'paper': 'paper-mixed', 'glass': 'glass',
    'foam_tape': 'foam-tape', 'mineral_oil': 'mineral-oil',
}


def _kg(raw):
    amount, unit = _split_amount_unit(raw or '')
    qty = _number(amount)
    if not qty:
        return None
    unit = unit.lower()
    if unit == 'kg':
        return qty
    if unit in ('ton', 'tonne', 't'):
        return qty * 1000
    return None


def _purchase_declarations(A, year):
    """K3C1-4a rows valid for the reporting year -> {category: [activity]}."""
    out = {}
    if A.get('K3C1-4') == 'no':
        return out
    quantities = A.get('K3C1-3a') if isinstance(A.get('K3C1-3a'), dict) else {}
    for row in _rows(A.get('K3C1-4a')):
        cat, value = str(row.get('category') or ''), _number(row.get('value'))
        if not cat or not value or str(row.get('year') or '').strip() != str(year):
            continue
        unit, supplier = row.get('unit'), str(row.get('supplier') or '').strip()
        kg = None
        if unit == 'tCO2e_total':
            kg = value * 1000
        elif unit == 'kgCO2e_kg':
            qty = _kg(quantities.get(cat))
            kg = value * qty if qty else None
        elif unit == 'kgCO2e_unit':
            amount, u = _split_amount_unit(quantities.get(cat) or '')
            qty = _number(amount) if u.lower() == 'adet' else None
            kg = value * qty if qty else None
        if kg:
            out.setdefault(cat, []).append({
                'reported_kg': kg, 'report_as': ('scope3', 'purchased_goods'),
                'label': f'{cat} · {supplier} ({_fmt(value)} {unit})'})
    return out


def _purchased_goods(A, declared):
    """K3C1-2 spend (USD) and K3C1-3a quantities of the categories without a
    supplier declaration."""
    spend, quantities = [], []
    if isinstance(A.get('K3C1-2'), dict):
        for cat, raw in A['K3C1-2'].items():
            amount, unit = _split_amount_unit(raw or '')
            usd = _number(amount) if unit.upper() == 'USD' else None
            if cat in _SPEND_SLUG and usd and cat not in declared:
                spend.append({'slug': _SPEND_SLUG[cat], 'quantity': usd, 'label': cat})
    if A.get('K3C1-3') != 'no' and isinstance(A.get('K3C1-3a'), dict):
        materials = A.get('K3C1-3m') if isinstance(A.get('K3C1-3m'), dict) else {}
        for cat, raw in A['K3C1-3a'].items():
            if cat in declared:
                continue
            slug, qty = None, None
            if cat in ('SC-01', 'SC-02'):
                slug, qty = MATERIAL_SLUG.get(materials.get(cat)), _kg(raw)
            elif cat == 'SC-03':
                slug, qty = 'electrical-it', _kg(raw)
            elif cat == 'SC-11':
                amount, unit = _split_amount_unit(raw or '')
                slug = 'water-supply'
                qty = _number(amount) if unit.lower() in ('m³', 'm3') else None
            if slug and qty:
                quantities.append({'slug': slug, 'quantity': qty, 'label': cat})
    return spend, quantities


def _litres(raw):
    amount, unit = _split_amount_unit(raw or '')
    qty = _number(amount)
    return qty if qty and unit.lower() in ('litre', 'liter', 'l', 'lt') else None


def _upstream_energy(A, groups):
    """K3C3 "confirmed": upstream electricity and T&D losses on the kWh of
    4A-1 (and of EV charging counted in 4A-EV); fuel extraction on litres of
    liquid fuel (3A-5 diesel / fuel oil / LPG, vehicles)."""
    if A.get('K3C3-INFO') != 'confirmed':
        return []
    kwh = sum(a['quantity'] for a in groups.get('4A-1', []))
    kwh += sum(a.get('kwh', 0) for a in groups.get('4A-EV', []))
    litres = 0.0
    if groups.get('3A-5') and isinstance(A.get('3A-5'), dict):
        for fuel in ('diesel', 'fuel_oil', 'lpg'):
            litres += _litres(A['3A-5'].get(fuel)) or 0
    litres += sum(a.get('litres', 0) for a in groups.get('3B-7', []))
    out = []
    if kwh:
        out.append({'slug': 'upstream-electricity', 'quantity': kwh, 'label': 'Elektrik üretim zinciri (WTT)'})
        out.append({'slug': 'transmission-losses', 'quantity': kwh, 'label': 'İletim ve dağıtım kayıpları'})
    if litres:
        out.append({'slug': 'fuel-extraction', 'quantity': litres, 'label': 'Yakıt üretim zinciri (WTT)'})
    return out


def _provider_report(A, step, year, scope_category):
    """K3C4-2c / K3C5-2c / K3C6-2c: a provider's own emission report (tCO2e)
    for the reporting year."""
    ans = A.get(step)
    if not isinstance(ans, dict) or str(ans.get('year') or '').strip() != str(year):
        return []
    t = _number(ans.get('total_tco2e'))
    if not t:
        return []
    provider = str(ans.get('provider') or '').strip()
    return [{'reported_kg': t * 1000, 'report_as': scope_category,
             'label': f'{provider} ({_fmt(t)} tCO2e)'}]


def _employees(A):
    ans = A.get('K3C7-1')
    if not isinstance(ans, dict):
        return None
    total = sum(_number(ans.get(k)) or 0 for k in ('fulltime_count', 'hybrid_count', 'remote_count'))
    return total or None


# K3C6-2 travel mode -> factor; flights by cabin class (unknown = economy).
_TRAVEL_SLUG = {
    'BT-01': 'flight-domestic', 'BT-04': 'train', 'BT-05': 'train', 'BT-06': 'bus',
    'BT-08': 'taxi', 'BT-09': 'ferry-travel', 'BT-10': 'hotel-turkey',
}
_FLIGHT_CABIN_SLUG = {
    'BT-02': {'economy': 'flight-short-economy'},
    # 3–6 h: the short-haul factor on the distance flown, by cabin class.
    'BT-11': {'economy': 'flight-short-economy'},
    'BT-03': {'economy': 'flight-long-economy', 'business': 'flight-long-business',
              'first': 'flight-long-first'},
}
_RENTAL_SLUG = {'diesel': 'car-rental-diesel', 'petrol': 'car-rental-petrol', 'electric': 'car-rental-electric'}


def _business_travel(A):
    out = []
    for row in _rows(A.get('K3C6-2')):
        mode, qty = str(row.get('travel_mode') or ''), _number(row.get('quantity'))
        if not qty:
            continue
        slug = _TRAVEL_SLUG.get(mode)
        if mode in _FLIGHT_CABIN_SLUG:
            slug = _FLIGHT_CABIN_SLUG[mode].get(row.get('cabin_class') or 'economy')
        elif mode == 'BT-07':
            slug = _RENTAL_SLUG.get(row.get('rental_fuel'))
        if slug:
            out.append({'slug': slug, 'quantity': qty, 'label': mode})
    return out


def _energy_activity(kwh, carrier, report_as, label):
    """Declared kWh of a leased asset, reported under its Scope 3 category."""
    if carrier == 'electricity':
        return {'activity': 'electricity', 'quantity': kwh, 'unit': 'kwh',
                'report_as': report_as, 'label': label}
    if carrier == 'natural_gas':
        return {'slug': 'natural-gas-kwh', 'quantity': kwh, 'report_as': report_as, 'label': label}
    return None


def _leased_upstream(A):
    """K3C8-1: declared energy of the leased asset, else area for office and
    warehouse (the only types with an area factor)."""
    out = []
    for row in _rows(A.get('K3C8-1')):
        kv = str(row.get('asset_type') or '')
        kwh = _number(row.get('declaration_kwh')) if _true(row.get('owner_declaration')) else None
        if kwh:
            a = _energy_activity(kwh, row.get('declaration_energy'), ('scope3', 'upstream_leased'), kv)
            if a:
                out.append(a)
            continue
        slug = {'KV-01': 'office-space', 'KV-03': 'warehouse'}.get(kv)
        area = _number(row.get('area_m2'))
        if slug and area:
            out.append({'slug': slug, 'quantity': area, 'label': kv})
    return out


_PROCESSING_SLUG = {'energy_intensive': 'processing-energy-intensive', 'light': 'processing-light',
                    'chemical': 'processing-chemical'}


def _processing_sold(A):
    out = []
    for row in _rows(A.get('K3C10-1')):
        slug, qty = _PROCESSING_SLUG.get(row.get('processing_type')), _number(row.get('quantity'))
        if not slug or not qty:
            continue
        kg = {'tonnes': qty * 1000, 'kg': qty}.get(row.get('unit'))
        if kg:
            out.append({'slug': slug, 'quantity': kg, 'label': str(row.get('product') or '').strip()})
    return out


def _use_of_sold(A):
    out = []
    for row in _rows(A.get('K3C11-1')):
        per, volume = _number(row.get('lca_kgco2e_per_unit')), _number(row.get('sales_volume'))
        if _true(row.get('lca_available')) and per and volume:
            out.append({'reported_kg': per * volume, 'report_as': ('scope3', 'use_of_sold'),
                        'label': f'{row.get("product_type") or ""} · {_fmt(volume)} {row.get("sales_unit") or ""}'
                                 f' × LCA {_fmt(per)} kg'})
    return out


def _end_of_life(A, factor_exists):
    """K3C12-1: units × unit weight, on the waste factor of the product's
    material and disposal method; the generic product factor only when the
    material is not given."""
    out = []
    for row in _rows(A.get('K3C12-1')):
        units, weight = _number(row.get('units_sold')), _number(row.get('weight_kg'))
        method = _DISPOSAL_SLUG.get(row.get('disposal_method'))
        if not units or not weight or not method:
            continue
        kg = units * weight
        label = str(row.get('product_name') or '').strip()
        material = str(row.get('primary_material') or '')
        if re.fullmatch(r'WT-\d\d', material):
            slug = f'{material.lower()}-{method}'
            if factor_exists(slug):
                out.append({'slug': slug, 'quantity': kg, 'label': label,
                            'report_as': ('scope3', 'end_of_life')})
        elif not material and method in ('landfill', 'recycling', 'incineration'):
            out.append({'slug': f'product-{method}', 'quantity': kg, 'label': label})
    return out


def _leased_downstream(A):
    out = []
    for row in _rows(A.get('K3C13-1')):
        label = str(row.get('asset_description') or '').strip()
        if _true(row.get('tenant_data_available')):
            kwh = _number(row.get('tenant_kwh'))
            a = _energy_activity(kwh, row.get('tenant_energy'), ('scope3', 'downstream_leased'), label) if kwh else None
            if a:
                out.append(a)
            continue
        area = _number(row.get('area_m2'))
        if area:
            out.append({'slug': 'leased-building-downstream', 'quantity': area, 'label': label})
    return out


def _franchises(A):
    """K3C14-1: the reported total only — outlets without a report are not
    estimated; the coverage is shown with the entry."""
    ans = A.get('K3C14-1')
    t = _number(ans.get('total_tco2e')) if isinstance(ans, dict) else None
    if not t:
        return []
    count, reporting = _number(ans.get('franchise_count')), _number(ans.get('reporting_count'))
    if count and reporting:
        coverage = f'{int(reporting)}/{int(count)} işletme raporlu'
    elif count:
        coverage = f'{int(count)} işletme, raporlu işletme sayısı girilmedi'
    else:
        coverage = ''
    return [{'reported_kg': t * 1000, 'report_as': ('scope3', 'franchises'),
             'label': f'{_fmt(t)} tCO2e' + (f' · {coverage}' if coverage else '')}]


_PCAF_CLASSES = {'VA-01', 'VA-02', 'VA-03', 'VA-07'}  # equity / bonds / project finance / private equity


def _investments(A):
    """K3C15-1, PCAF: investment / (company value + debt) × company emissions.
    The share is a ratio of amounts in one currency, so no conversion."""
    out = []
    for row in _rows(A.get('K3C15-1')):
        cls = str(row.get('asset_class') or '')
        inv, value = _number(row.get('investment_amount')), _number(row.get('company_value'))
        debt = _number(row.get('company_debt')) or 0
        emissions = _number(row.get('company_emissions_tco2e'))
        if cls not in _PCAF_CLASSES or not _true(row.get('ghg_report_available')) or not (inv and value and emissions):
            continue
        share = inv / (value + debt)
        if share > 1:
            continue
        out.append({'reported_kg': share * emissions * 1000, 'report_as': ('scope3', 'investments'),
                    'label': f'{cls} · PCAF %{_fmt(share * 100, 2)} × {_fmt(emissions)} tCO2e'})
    return out


# Each step that creates entries, and the yes/no question that has to allow it.
_GATES = {
    '3A-5': '3A-0', '3B-7': '3B-0', '3C-2': '3C-0', '4A-1': '4A-0', '4B-2': '4B-0',
    'K3C1-2': 'K3C1-0', 'K3C1-3a': 'K3C1-0', 'K3C1-4a': 'K3C1-0', 'K3C4-2': 'K3C4-0',
    'K3C4-2c': 'K3C4-0', 'K3C5-2': 'K3C5-0', 'K3C5-2b': 'K3C5-0', 'K3C5-2c': 'K3C5-0',
    'K3C5-1': 'K3C5-0', 'K3C6-2': 'K3C6-0', 'K3C6-2c': 'K3C6-0', 'K3C8-1': 'K3C8-0',
    'K3C9-1': 'K3C9-0', 'K3C10-1': 'K3C10-0', 'K3C11-1': 'K3C11-0', 'K3C12-1': 'K3C12-0',
    'K3C13-1': 'K3C13-0', 'K3C14-1': 'K3C14-0', 'K3C15-1': 'K3C15-0',
}

# Steps whose answers create EmissionEntry rows (the entry description names
# the step, so a rejected entry points back to the question to fix).
ENTRY_STEPS = (
    '3A-5', '3B-7', '3C-2', '4A-1', '4A-EV', '4B-2',
    'K3C1-2', 'K3C1-3a', 'K3C1-4a', 'K3C3-INFO', 'K3C4-2', 'K3C4-2c',
    'K3C5-2', 'K3C5-2b', 'K3C5-2c', 'K3C5-1', 'K3C6-2', 'K3C6-2c', 'K3C8-1', 'K3C9-1',
    'K3C10-1', 'K3C11-1', 'K3C12-1', 'K3C13-1', 'K3C14-1', 'K3C15-1',
)


def activities_for_report(answers, year, company=None, factor_exists=None):
    """{step_id: [activity]} for every step of ENTRY_STEPS, from all answers
    of the inventory ({step_id: stored answer})."""
    A = {k: _value(v) for k, v in (answers or {}).items()}
    factor_exists = factor_exists or (lambda slug: _factor_by_slug(slug) is not None)

    def own(step):
        return activities_for_step(step, {'answer': A.get(step)})

    biomass = _biomass_amount(A)
    g = {
        '3A-5': own('3A-5') + ([{'slug': _BIOMASS[biomass[0]][0], 'quantity': biomass[1], 'label': 'biomass'}]
                               if biomass else []),
        '3B-7': _vehicles(A),
        '3C-2': _process(A),
        '4A-1': own('4A-1'),
        '4A-EV': _ev_charging(A),
        '4B-2': _purchased_energy(A),
    }
    declared = _purchase_declarations(A, year)
    g['K3C1-4a'] = [a for rows in declared.values() for a in rows]
    g['K3C1-2'], g['K3C1-3a'] = _purchased_goods(A, declared)

    # The data level picked decides which of the level's questions count —
    # an answer left on a branch the user turned away from does not.
    level4, level5, level6 = A.get('K3C4-1'), A.get('K3C5-1'), A.get('K3C6-1')
    g['K3C4-2c'] = _provider_report(A, 'K3C4-2c', year, ('scope3', 'upstream_transport')) if level4 == 'S1' else []
    g['K3C4-2'] = own('K3C4-2') if level4 not in ('S1', 'S3') else []
    g['K3C5-2c'] = _provider_report(A, 'K3C5-2c', year, ('scope3', 'waste')) if level5 == 'S1' else []
    g['K3C5-2'] = own('K3C5-2') if level5 in (None, 'S2_type') or (level5 == 'S1' and not g['K3C5-2c']) else []
    g['K3C5-2b'], g['K3C5-1'] = [], []
    if level5 == 'S2_total':
        kg = _number(A.get('K3C5-2b'))
        if kg:
            from .serializers import is_turkish_company
            slug = 'landfill' if company is None or is_turkish_company(company) else 'general-landfill'
            g['K3C5-2b'] = [{'slug': slug, 'quantity': kg, 'label': ''}]
    elif level5 == 'S3':
        people = _employees(A)
        if people:
            g['K3C5-1'] = [{'slug': 'waste-per-employee-default', 'quantity': people, 'label': ''}]
    g['K3C6-2c'] = _provider_report(A, 'K3C6-2c', year, ('scope3', 'business_travel')) if level6 == 'S1' else []
    g['K3C6-2'] = _business_travel(A) if level6 not in ('S1', 'S3') else []

    g['K3C8-1'] = _leased_upstream(A)
    g['K3C9-1'] = own('K3C9-1')
    g['K3C10-1'] = _processing_sold(A)
    g['K3C11-1'] = _use_of_sold(A)
    g['K3C12-1'] = _end_of_life(A, factor_exists)
    g['K3C13-1'] = _leased_downstream(A)
    g['K3C14-1'] = _franchises(A)
    g['K3C15-1'] = _investments(A)

    for step, gate in _GATES.items():
        if A.get(gate) not in (None, '', 'yes'):
            g[step] = []
    # Upstream energy follows from the (gated) amounts above.
    g['K3C3-INFO'] = _upstream_energy(A, g)
    return g


# ── Supplier / facility-specific factors (3A/3B/3C/4A/4B-EF-a) ────────────────

_EF_DOCUMENT = {'3A-5': ('3A-EF', '3A-EF-a'), '3B-7': ('3B-EF', '3B-EF-a'), '3C-2': ('3C-EF', '3C-EF-a'),
                '4A-1': ('4A-EF', '4A-EF-a'), '4B-2': ('4B-EF', '4B-EF-a')}
# ef_unit -> (factor unit it is per, multiplier to kg CO2e per that unit).
# GJ / MWh are the same energy as kWh, only scaled.
_EF_UNITS = {
    'kgCO2e_m3': ('m3', 1), 'kgCO2e_kWh': ('kwh', 1), 'kgCO2e_MWh': ('kwh', 0.001),
    'kgCO2e_GJ': ('kwh', 1 / _GJ_TO_KWH), 'kgCO2e_litre': ('liters', 1), 'kgCO2e_kg': ('kg', 1),
    'kgCO2e_km': ('km', 1), 'kgCO2e_tonne_product': ('tonnes', 1), 'tCO2e_tonne_product': ('tonnes', 1000),
}
_FACTOR_UNIT_ALIASES = {'m³': 'm3', 'tonne': 'tonnes', 'litre': 'liters', 'l': 'liters'}


def _supplier_ef(A, step, year):
    """The step's supplier / facility-specific factor when it is valid for
    the reporting year: (factor unit, kg CO2e per unit, label) or None."""
    gate, doc = _EF_DOCUMENT[step]
    ans = A.get(doc)
    if A.get(gate) != 'yes' or not isinstance(ans, dict):
        return None
    value, unit = _number(ans.get('ef_value')), ans.get('ef_unit')
    if not value or unit not in _EF_UNITS or str(ans.get('ef_year') or '').strip() != str(year):
        return None
    per_unit, mult = _EF_UNITS[unit]
    source = str(ans.get('ef_source') or '').strip()
    return per_unit, value * mult, f'{source} ({_fmt(value)} {unit})'


def _factor_by_slug(slug):
    from emissions.models import EmissionFactor
    return (
        EmissionFactor.objects.filter(slug=slug, country='turkey', is_active=True, is_default=True).first()
        or EmissionFactor.objects.filter(slug=slug, country='global', is_active=True, is_default=True).first()
    )


# Names of the categories a calculated entry can belong to.
_CATEGORY_NAMES = {
    'stationary_combustion': ('stationary combustion', 'sabit yanma'),
    'mobile_combustion': ('mobile combustion', 'hareketli yanma'),
    'process_emissions': ('process emissions', 'proses emisyonları'),
    'electricity': ('electricity', 'elektrik'),
    'steam_heat': ('heat and steam', 'ısı ve buhar'),
    'purchased_goods': ('purchased goods and services', 'satın alınan mal ve hizmetler'),
    'upstream_transport': ('upstream transport', 'yukarı akış taşımacılık'),
    'waste': ('waste', 'atık'),
    'business_travel': ('business travel', 'iş seyahatleri'),
    'upstream_leased': ('upstream leased assets', 'kiralanan varlıklar'),
    'use_of_sold': ('use of sold products', 'satılan ürünlerin kullanımı'),
    'end_of_life': ('end of life of sold products', 'satılan ürünlerin ömür sonu'),
    'downstream_leased': ('downstream leased assets', 'kiraya verilen varlıklar'),
    'franchises': ('franchises', 'franchise işletmeleri'),
    'investments': ('investments', 'yatırımlar'),
}


def _calculated_factor(scope, category):
    """Factor 1 (quantity = kg CO2e) of this scope and category, for entries
    whose CO2e comes from a supplier factor, a declaration, a PCAF share or a
    catalog factor of another category. Inactive: never offered in the forms."""
    from emissions.models import EmissionFactor
    en, tr = _CATEGORY_NAMES.get(category, (category.replace('_', ' '),) * 2)
    names = dict(name=f'Calculated emissions — {en}', name_tr=f'Hesaplanmış emisyon — {tr}')
    factor, created = EmissionFactor.objects.get_or_create(
        slug=f'calculated-{scope}-{category}', country='global', year=2024,
        defaults=dict(
            **names, scope=scope, category=category, unit='kgco2e', factor_kg_co2e=1,
            source='custom', is_active=False, is_default=False,
            reference='Quantity is kg CO2e calculated from questionnaire answers with the factor '
                      'named in the entry description (supplier / facility-specific factor, '
                      'declaration, PCAF attribution, catalog factor of another category).'))
    if not created and (factor.name, factor.name_tr) != (names['name'], names['name_tr']):
        EmissionFactor.objects.filter(pk=factor.pk).update(**names)
    return factor


def _resolve(activity, company=None):
    """(factor, quantity Decimal, co2e_kg Decimal) for one activity, or None."""
    from emissions.factor_lookup import resolve_factor_and_amount
    if 'reported_kg' in activity:
        kg = Decimal(str(activity['reported_kg']))
        return _calculated_factor(*activity['report_as']), kg, kg
    if 'slug' in activity:
        factor = _factor_by_slug(activity['slug'])
        if not factor:
            return None
        try:
            qty = Decimal(str(activity['quantity']))
        except (InvalidOperation, ValueError):
            return None
        return factor, qty, qty * factor.factor_kg_co2e
    factor, qty, co2e, error = resolve_factor_and_amount(
        activity['activity'], activity['quantity'], activity['unit'], company)
    if error:
        logger.info('Questionnaire activity skipped (%s): %s', activity, error)
        return None
    return factor, qty, co2e


def _entry_specs(step, activities, A, year, company):
    """[(factor, quantity, label)] of one step: the catalog factor, or the
    "calculated" factor of the same scope / category when the CO2e comes
    from elsewhere (supplier factor, declaration, reporting category)."""
    resolved = [(a, r) for a, r in ((a, _resolve(a, company)) for a in activities) if r]
    supplier = _supplier_ef(A, step, year) if step in _EF_DOCUMENT else None
    target = None
    if supplier:
        matching = [a for a, (f, _q, _c) in resolved
                    if 'report_as' not in a
                    and _FACTOR_UNIT_ALIASES.get(f.unit.lower(), f.unit.lower()) == supplier[0]]
        # One activity in the document's unit: it is the one the document is
        # for. Several (two fuels in litres) would be a guess.
        target = matching[0] if len(matching) == 1 else None
    specs = []
    for activity, (factor, qty, co2e) in resolved:
        label = activity.get('label') or ''
        if activity is target:
            _unit, per, src = supplier
            specs.append((_calculated_factor(factor.scope, factor.category), qty * Decimal(str(per)),
                          ' · '.join(filter(None, [label, f'{_fmt(float(qty))} {factor.unit} × {src}']))))
        elif 'report_as' in activity and 'reported_kg' not in activity:
            specs.append((_calculated_factor(*activity['report_as']), co2e,
                          ' · '.join(filter(None, [label, f'{_fmt(float(qty))} {factor.unit} × '
                                                          f'{_fmt(float(factor.factor_kg_co2e))} ({factor.slug})']))))
        else:
            specs.append((factor, qty, label))
    return specs


def _step_entries(company, year, step_id):
    """Entries earlier saves of this step created ("Questionnaire step 4A-1",
    "Questionnaire step 4A-1 · …") — but not those of 4A-1a."""
    from django.db.models import Q
    from emissions.models import EmissionEntry
    base = f'{DESCRIPTION_PREFIX} {step_id}'
    return EmissionEntry.objects.filter(company=company, year=year).filter(
        Q(description=base) | Q(description__startswith=base + ' · '))


def questionnaire_total_kg(report):
    """kg CO2e of all entries this inventory's answers created."""
    from django.db.models import Sum
    from emissions.models import EmissionEntry
    if not report.company_id:
        return 0.0
    total = EmissionEntry.objects.filter(
        company_id=report.company_id, year=report.reporting_year or 2024,
        description__startswith=f'{DESCRIPTION_PREFIX} ').aggregate(t=Sum('calculated_co2e_kg'))['t']
    return float(total or 0)


def _q4(value):
    return Decimal(str(value)).quantize(Decimal('0.0001'))


def sync_step_entries(user, company, report, step_id, data=None):
    """
    Recalculate the entries of the whole inventory from its saved answers —
    an answer can change another step's entries (the fuel type of 3B-5 and
    the amount of 3B-7, a level question that switches K3C5-2 off, …).
    The saved step's own entries are always replaced — re-answering a step
    never leaves stale or duplicate rows, and they take the approval status
    of who answered — while another step's entries are replaced only when
    what they report changed, so their approvals stay. Returns the new entries.
    """
    from emissions.models import EmissionEntry
    from emissions.factor_lookup import _get_entry_status
    from emissions.notifications import notify_entry_submitted
    from .models import ReportStep
    if not company:
        return []
    year = report.reporting_year or 2024
    answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
    A = {k: _value(v) for k, v in answers.items()}
    groups = activities_for_report(answers, year, company)
    # Same approval rule as the form and the chat: an owner/admin/manager's
    # answers count at once, a data-entry member's wait for approval.
    status = _get_entry_status(user, company)

    created = []
    for step in ENTRY_STEPS:
        specs = _entry_specs(step, groups.get(step, []), A, year, company)
        base = f'{DESCRIPTION_PREFIX} {step}'
        many = len(specs) > 1
        # A calculated entry always names the factor it was calculated with.
        rows = [(factor, _q4(qty), f'{base} · {label}'
                 if label and (many or factor.slug.startswith('calculated-')) else base)
                for factor, qty, label in specs]
        existing = _step_entries(company, year, step)
        if step != step_id:
            before = sorted((e.emission_factor_id, _q4(e.quantity), e.description) for e in existing)
            if before == sorted((f.id, q, d) for f, q, d in rows):
                continue
        existing.delete()
        for factor, qty, description in rows:
            created.append(EmissionEntry.objects.create(
                user=user,
                company=company,
                emission_factor=factor,
                year=year,
                month=1,  # annual questionnaire data
                quantity=qty,
                calculated_co2e_kg=qty * factor.factor_kg_co2e,
                description=description,
                factor_value_snapshot=factor.factor_kg_co2e,
                factor_source_snapshot=factor.source,
                status=status,
            ))
    for entry in created:
        notify_entry_submitted(entry)  # no-op unless the entry awaits approval
    return created


# ── Answers that are kept but not calculated ─────────────────────────────────

def uncalculated_notes(answers, year):
    """[{step_id, tr, en}] for every answered amount that does not reach the
    dashboard and why — shown right after the answer and listed with the
    inventory's assumptions, so nobody takes a missing number for zero."""
    A = {k: _value(v) for k, v in (answers or {}).items()}
    out = []

    def note(step, tr, en):
        out.append({'step_id': step, 'tr': tr, 'en': en})

    def open_(step):
        gate = _GATES.get(step)
        return not gate or A.get(gate) in (None, '', 'yes')

    if open_('3A-5') and isinstance(A.get('3A-5'), dict):
        given = {f for f, raw in A['3A-5'].items() if _number(_split_amount_unit(raw)[0])}
        if 'biomass' in given and not _biomass_amount(A):
            kind = A.get('3A-5bio')
            if kind in _BIOMASS:
                unit = 'kg / ton' if _BIOMASS[kind][1] == 'kg' else 'kWh'
                note('3A-5bio', f'Biyokütle: bu biyokütle türü {unit} olarak girilmeli — hesaplanmadı.',
                     f'Biomass: this biomass type is entered in {unit} — not calculated.')
            else:
                note('3A-5bio', 'Biyokütle: türü (odun peleti, biyogaz) seçilmediği veya listede olmadığı için hesaplanmadı.',
                     'Biomass: not calculated — its type (wood pellets, biogas) is not chosen or not listed.')
        if 'other_fossil' in given:
            note('3A-5', 'Diğer fosil yakıt: yakıt türü ve fosil payı belirtilmediği için hesaplanmadı.',
                 'Other fossil fuel: not calculated — the fuel and its fossil share are not given.')

    if open_('3B-7') and isinstance(A.get('3B-7'), dict):
        fuels = A.get('3B-5') if isinstance(A.get('3B-5'), dict) else {}
        modes = A.get('3B-6') if isinstance(A.get('3B-6'), dict) else {}
        for key, raw in A['3B-7'].items():
            if not _number(_split_amount_unit(raw)[0]):
                continue
            base, fuel, mode = str(key).split('#')[0], fuels.get(key), modes.get(key)
            if mode == 'tonne_km':
                note('3B-7', f'{key}: ton-km taşımacılık hizmetine göredir, kendi aracınızın Kapsam 1 hesabında kullanılmaz — yakıt litresi girin.',
                     f'{key}: tonne-km is for freight services, not your own vehicle\'s Scope 1 — enter fuel litres.')
            elif mode == 'annual_km' and fuel == 'electric':
                note('3B-7', f'{key}: elektrikli araçlar km ile değil, şarj elektriğiyle (soru 76b) hesaplanır.',
                     f'{key}: electric vehicles are calculated from charging electricity (question 76b), not km.')
            elif mode == 'annual_km' and base != 'EQ-3B-01':
                note('3B-7', f'{key}: km yalnızca binek araçlarda hesaplanıyor — bu araç tipi için yakıt litresi girin.',
                     f'{key}: km is only calculated for passenger cars — enter fuel litres for this vehicle type.')
            elif mode == 'fuel_litres' and fuel in ('hybrid', 'electric'):
                note('3B-7', f'{key}: hibrit/elektrikli araç için litre faktörü seçilmedi.',
                     f'{key}: no litre factor has been chosen for hybrid/electric vehicles.')
            elif mode == 'fuel_litres' and base not in _ROAD_VEHICLES | _OFFROAD_MACHINES:
                note('3B-7', f'{key}: bu araç tipi (gemi, hava aracı, lokomotif, diğer) için emisyon faktörü yok.',
                     f'{key}: no emission factor for this vehicle type (ship, aircraft, locomotive, other).')

    if open_('3C-2') and isinstance(A.get('3C-2'), dict):
        missing = [k for k in A['3C-2'] if str(k).split('#')[0] not in _PROCESS_SLUG]
        if missing:
            note('3C-2', f'{", ".join(missing)}: bu proses için emisyon faktörü yok.',
                 f'{", ".join(missing)}: no emission factor for this process.')

    if isinstance(A.get('3D-4'), dict) and A['3D-4'] and A.get('3D-0') not in (None, ['none'], 'none'):
        note('3D-4', 'Soğutucu gaz kaçakları: GWP değerleri AR6 olarak birleştirilene kadar hesaplanmıyor.',
             'Refrigerant leaks: not calculated until the GWP values are unified to AR6.')

    if open_('4B-2') and isinstance(A.get('4B-2'), dict):
        for kind, raw in A['4B-2'].items():
            if _number(_split_amount_unit(raw)[0]) and not (kind in _PURCHASED_ENERGY_SLUG and _energy_kwh(raw)):
                label = {'steam': 'Buhar (ton)', 'compressed_air': 'Basınçlı hava'}.get(kind, kind)
                note('4B-2', f'{label}: bu birim / enerji türü için emisyon faktörü yok — GJ veya MWh girin.',
                     f'{label}: no emission factor for this unit / energy type — enter GJ or MWh.')

    for gate, doc, what_tr, what_en in (
            ('3A-EF', '3A-EF-a', 'Sabit yanma', 'Stationary combustion'),
            ('3B-EF', '3B-EF-a', 'Araçlar', 'Vehicles'),
            ('3C-EF', '3C-EF-a', 'Prosesler', 'Processes'),
            ('4A-EF', '4A-EF-a', 'Elektrik', 'Electricity'),
            ('4B-EF', '4B-EF-a', 'Isı / buhar / soğutma', 'Heat / steam / cooling')):
        ans = A.get(doc)
        if A.get(gate) == 'yes' and isinstance(ans, dict) and ans.get('ef_value') not in (None, ''):
            if str(ans.get('ef_year') or '').strip() != str(year):
                note(doc, f'{what_tr} — tedarikçi faktör belgesinin yılı ({ans.get("ef_year")}) raporlama yılı ({year}) değil; genel faktör kullanıldı.',
                     f'{what_en} — the supplier factor document\'s year ({ans.get("ef_year")}) is not the reporting year ({year}); the generic factor is used.')
            elif ans.get('ef_unit') not in _EF_UNITS:
                note(doc, f'{what_tr} — tedarikçi faktör belgesinin birimi tanınmadı; genel faktör kullanıldı.',
                     f'{what_en} — the supplier factor document\'s unit is not recognised; the generic factor is used.')

    declared = _purchase_declarations(A, year) if open_('K3C1-4a') else {}
    if open_('K3C1-2') and isinstance(A.get('K3C1-2'), dict):
        for cat, raw in A['K3C1-2'].items():
            amount, unit = _split_amount_unit(raw or '')
            if not _number(amount) or cat in declared:
                continue
            if unit.upper() != 'USD':
                note('K3C1-2', f'{cat}: yalnızca USD tutarlar hesaplanıyor ({unit or "birim yok"} için belgelenmiş kur yok).',
                     f'{cat}: only USD amounts are calculated (no documented rate for {unit or "no unit"}).')
            elif cat not in _SPEND_SLUG:
                note('K3C1-2', f'{cat}: bu kategori için harcama bazlı emisyon faktörü yok.',
                     f'{cat}: no spend-based emission factor for this category.')
    if open_('K3C1-3a') and A.get('K3C1-3') != 'no' and isinstance(A.get('K3C1-3a'), dict):
        materials = A.get('K3C1-3m') if isinstance(A.get('K3C1-3m'), dict) else {}
        for cat, raw in A['K3C1-3a'].items():
            amount, unit = _split_amount_unit(raw or '')
            if not _number(amount) or cat in declared:
                continue
            if cat in ('SC-01', 'SC-02', 'SC-03') and _kg(raw) is None:
                note('K3C1-3a', f'{cat}: miktar kg veya ton olarak girilmediği için hesaplanmadı.',
                     f'{cat}: not calculated — the quantity is not in kg or tonnes.')
            elif cat in ('SC-01', 'SC-02') and materials.get(cat) not in MATERIAL_SLUG:
                note('K3C1-3a', f'{cat}: malzeme seçilmedi veya listede yok — hesaplanmadı.',
                     f'{cat}: no listed material chosen — not calculated.')
            elif cat == 'SC-11' and unit.lower() not in ('m³', 'm3'):
                note('K3C1-3a', f'{cat}: su miktarı m³ olarak girilmediği için hesaplanmadı.',
                     f'{cat}: not calculated — the water quantity is not in m³.')
            elif cat not in ('SC-01', 'SC-02', 'SC-03', 'SC-11'):
                note('K3C1-3a', f'{cat}: bu kategori için miktar bazlı emisyon faktörü yok.',
                     f'{cat}: no quantity-based emission factor for this category.')
    if open_('K3C1-4a') and A.get('K3C1-4') != 'no':
        for row in _rows(A.get('K3C1-4a')):
            if not _number(row.get('value')):
                continue
            who = str(row.get('supplier') or row.get('category') or '').strip()
            if str(row.get('year') or '').strip() != str(year):
                note('K3C1-4a', f'{who}: beyan yılı ({row.get("year")}) raporlama yılı ({year}) değil — kullanılmadı.',
                     f'{who}: declaration year ({row.get("year")}) is not the reporting year ({year}) — not used.')
            elif not any(a['label'].startswith(f'{row.get("category")} · {str(row.get("supplier") or "").strip()} (')
                         for a in declared.get(str(row.get('category') or ''), [])):
                note('K3C1-4a', f'{who}: beyanın birimi bu kategorinin miktarıyla eşleşmediği için kullanılmadı.',
                     f'{who}: not used — the declaration\'s unit does not match this category\'s quantity.')

    if A.get('K3C2-0') == 'yes' and _rows(A.get('K3C2-1')):
        note('K3C2-1', 'Sermaye malları: harcama bazlı emisyon faktörü olmadığı için hesaplanmadı.',
             'Capital goods: not calculated — no spend-based emission factor.')
    if A.get('K3C3-INFO') == 'custom':
        note('K3C3-custom', 'Özel WTT / iletim kaybı faktörü: birimi doğrulanamadığı için uygulanmadı.',
             'Custom WTT / T&D factor: not applied — its unit cannot be verified.')

    for level_q, s1, rows_q, s3, label_tr, label_en in (
            ('K3C4-1', 'K3C4-2c', 'K3C4-2', 'K3C4-2b', 'Nakliye', 'Transport'),
            ('K3C6-1', 'K3C6-2c', 'K3C6-2', 'K3C6-2b', 'İş seyahati', 'Business travel')):
        if not open_(rows_q):
            continue
        level = A.get(level_q)
        if level == 'S3' and _number(A.get(s3)):
            note(s3, f'{label_tr} harcaması: harcama bazlı emisyon faktörü olmadığı için hesaplanmadı.',
                 f'{label_en} spend: not calculated — no spend-based emission factor.')
        if level == 'S1' and isinstance(A.get(s1), dict) and _number(A[s1].get('total_tco2e')) \
                and str(A[s1].get('year') or '').strip() != str(year):
            note(s1, f'{label_tr} — firma raporunun yılı raporlama yılı ({year}) değil; kullanılmadı.',
                 f'{label_en} — the provider report is not for the reporting year ({year}); not used.')
    if open_('K3C4-2') and A.get('K3C4-1') not in ('S1', 'S3'):
        if any(r.get('transport_mode') == 'TM-99' for r in _rows(A.get('K3C4-2'))):
            note('K3C4-2', 'TM-99 (diğer taşıma modu): emisyon faktörü yok.', 'TM-99 (other mode): no emission factor.')
    if open_('K3C9-1') and any(r.get('transport_mode') == 'TM-99' for r in _rows(A.get('K3C9-1'))):
        note('K3C9-1', 'TM-99 (diğer taşıma modu): emisyon faktörü yok.', 'TM-99 (other mode): no emission factor.')
    if open_('K3C6-2') and A.get('K3C6-1') not in ('S1', 'S3'):
        for row in _rows(A.get('K3C6-2')):
            if not _number(row.get('quantity')):
                continue
            mode = row.get('travel_mode')
            if mode == 'BT-99':
                note('K3C6-2', 'BT-99 (diğer seyahat): emisyon faktörü yok.', 'BT-99 (other travel): no emission factor.')
            elif mode in ('BT-02', 'BT-11') and (row.get('cabin_class') or 'economy') != 'economy':
                note('K3C6-2', f'{mode} business/first: kısa mesafe için bu kabin sınıfının faktörü yok.',
                     f'{mode} business/first: no short-haul factor for this cabin class.')
            elif mode == 'BT-07' and row.get('rental_fuel') not in _RENTAL_SLUG:
                note('K3C6-2', 'BT-07 kiralık araç: yakıt türü seçilmediği için hesaplanmadı.',
                     'BT-07 rental car: not calculated — no fuel type chosen.')

    if open_('K3C5-2'):
        level = A.get('K3C5-1')
        counted_rows = level in (None, 'S2_type') or (
            level == 'S1' and not _provider_report(A, 'K3C5-2c', year, ('scope3', 'waste')))
        if counted_rows:
            for row in _rows(A.get('K3C5-2')):
                wt, method = str(row.get('waste_type') or ''), row.get('disposal_method')
                if not _number(row.get('quantity_kg')):
                    continue
                slug = f'{wt.lower()}-{_DISPOSAL_SLUG.get(method, "")}'
                if not re.fullmatch(r'WT-\d\d', wt) or _factor_by_slug(slug) is None:
                    note('K3C5-2', f'{wt} / {method}: bu atık türü ve bertaraf yöntemi için emisyon faktörü yok.',
                         f'{wt} / {method}: no emission factor for this waste type and disposal method.')
        if level == 'S1' and isinstance(A.get('K3C5-2c'), dict) and _number(A['K3C5-2c'].get('total_tco2e')) \
                and str(A['K3C5-2c'].get('year') or '').strip() != str(year):
            note('K3C5-2c', f'Bertaraf firması beyanının yılı raporlama yılı ({year}) değil — kullanılmadı.',
                 f'The disposal company\'s declaration is not for the reporting year ({year}) — not used.')
        if level == 'S3' and not _employees(A):
            note('K3C7-1', 'Çalışan başına atık tahmini: çalışan sayısı (soru K3C7-1) girilmediği için hesaplanmadı.',
                 'Waste per employee: not calculated — the headcount (question K3C7-1) is missing.')

    if A.get('K3C7-0') in ('survey', 'estimate'):
        note('K3C7-0', 'Çalışan ulaşımı: gerçek iş günü sayısı ve ev ofisi faktörü belirlenene kadar hesaplanmıyor.',
             'Employee commuting: not calculated until the real working days and the homeworking factor are set.')

    if open_('K3C8-1'):
        for row in _rows(A.get('K3C8-1')):
            kv = str(row.get('asset_type') or '')
            has_kwh = _true(row.get('owner_declaration')) and _number(row.get('declaration_kwh'))
            if has_kwh and row.get('declaration_energy') not in ('electricity', 'natural_gas'):
                note('K3C8-1', f'{kv}: beyan edilen kWh\'nin enerji türü seçilmediği için hesaplanmadı.',
                     f'{kv}: not calculated — the energy type of the declared kWh is missing.')
            elif not has_kwh and kv not in ('KV-01', 'KV-03'):
                note('K3C8-1', f'{kv}: bu varlık türü yalnızca beyan edilen enerji (kWh) ile hesaplanır.',
                     f'{kv}: this asset type is only calculated from declared energy (kWh).')
    if open_('K3C10-1'):
        for row in _rows(A.get('K3C10-1')):
            if not _number(row.get('quantity')):
                continue
            name = str(row.get('product') or '').strip()
            if row.get('processing_type') not in _PROCESSING_SLUG:
                note('K3C10-1', f'{name}: işlem türü seçilmediği için hesaplanmadı.',
                     f'{name}: not calculated — no processing type chosen.')
            elif row.get('unit') not in ('tonnes', 'kg'):
                note('K3C10-1', f'{name}: yalnızca ton veya kg miktarlar hesaplanıyor.',
                     f'{name}: only tonnes or kg are calculated.')
    if open_('K3C11-1'):
        for row in _rows(A.get('K3C11-1')):
            if _number(row.get('sales_volume')) and not (_true(row.get('lca_available'))
                                                         and _number(row.get('lca_kgco2e_per_unit'))):
                note('K3C11-1', f'{row.get("product_type") or ""}: LCA değeri olmadan kullanım aşaması hesaplanmıyor.',
                     f'{row.get("product_type") or ""}: the use phase is not calculated without an LCA value.')
    if open_('K3C12-1'):
        for row in _rows(A.get('K3C12-1')):
            material, method = str(row.get('primary_material') or ''), _DISPOSAL_SLUG.get(row.get('disposal_method'))
            if not (_number(row.get('units_sold')) and _number(row.get('weight_kg')) and method):
                continue
            name = str(row.get('product_name') or '').strip()
            if re.fullmatch(r'WT-\d\d', material) and _factor_by_slug(f'{material.lower()}-{method}') is None:
                note('K3C12-1', f'{name}: {material} / {row.get("disposal_method")} için emisyon faktörü yok.',
                     f'{name}: no emission factor for {material} / {row.get("disposal_method")}.')
            elif not material and method not in ('landfill', 'recycling', 'incineration'):
                note('K3C12-1', f'{name}: bu bertaraf yöntemi için genel ürün faktörü yok.',
                     f'{name}: no generic product factor for this disposal method.')
    if open_('K3C13-1'):
        for row in _rows(A.get('K3C13-1')):
            if _true(row.get('tenant_data_available')) and _number(row.get('tenant_kwh')) \
                    and row.get('tenant_energy') not in ('electricity', 'natural_gas'):
                note('K3C13-1', f'{str(row.get("asset_description") or "").strip()}: kWh\'nin enerji türü seçilmediği için hesaplanmadı.',
                     f'{str(row.get("asset_description") or "").strip()}: not calculated — the energy type of the kWh is missing.')
    if A.get('K3C14-0') == 'no' and isinstance(A.get('K3C14-2'), dict) and _number(A['K3C14-2'].get('franchise_count')):
        note('K3C14-2', 'Franchise işletmeleri: raporlanmış emisyon olmadan tahmin yapılmıyor.',
             'Franchises: no estimate is made without reported emissions.')
    if open_('K3C15-1'):
        for row in _rows(A.get('K3C15-1')):
            cls = str(row.get('asset_class') or '')
            if not _number(row.get('investment_amount')):
                continue
            if cls not in _PCAF_CLASSES:
                note('K3C15-1', f'{cls}: bu varlık sınıfı için PCAF hesabı henüz yok.',
                     f'{cls}: no PCAF calculation for this asset class yet.')
            elif not (_true(row.get('ghg_report_available')) and _number(row.get('company_emissions_tco2e'))):
                note('K3C15-1', f'{cls}: şirketin raporlanmış emisyonu olmadan hesaplanmıyor.',
                     f'{cls}: not calculated without the company\'s reported emissions.')
    return out
