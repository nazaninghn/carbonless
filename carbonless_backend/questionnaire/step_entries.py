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
  - K3C3  "confirmed": upstream electricity + T&D losses on 4A-1 kWh
          (not on the kWh of a facility whose electricity is not calculated),
          fuel extraction on litres of liquid fuel
  - K3C4-2 / K3C9-1 transport rows       -> the CarbonIQ catalog factor whose
    slug is the TM code (tm-01, tm-01-ds …), in tonne-km = load × distance
  - K3C5-2 waste rows                    -> the catalog factor whose slug is the
    WT code + disposal method (wt-01-landfill …), in kg
  - K3C6-2 business travel by BT code; hotel nights -> hotel-turkey
  - K3C8 … K3C15 leased assets, processing / use / end of life of sold
    products, franchises (reported total only), investments (PCAF)
An answer without a registered factor is skipped, never guessed.

Electricity (4A-1) is location-based: each facility's own country grid, or
the factor an admin approved for that facility and year (Özel Talep,
location-based), which replaces the grid factor rather than adding a second
amount. The electricity supplier's declaration (4A-EF-a) and a market-based
approved request only feed the separate market-based result
(scope2_market_based), never the inventory total.

A supplier / facility-specific factor (3A/3B/3C/4B-EF-a), a supplier or
provider declaration and a PCAF attribution are not catalog factors: such an
entry is stored as kg CO2e on a "calculated" factor of the same scope and
category (factor 1), with the real factor named in its description. The same
holds for a catalog factor used under another category (LPG burnt in
vehicles, declared energy of a leased building, waste factors for the end of
life of sold products).
"""
import contextlib
import contextvars
import copy
import functools
import logging
import re

from django.utils import timezone
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


def _fmt(n, decimals=4, lang='tr'):
    """A number in an entry's calculation text: Turkish style (1.200,5) or
    English (1,200.5) — "1.200" in an English line would read as 1.2."""
    text = f'{n:,.{decimals}f}'.rstrip('0').rstrip('.') if decimals else f'{n:,.0f}'
    if lang == 'tr':
        text = text.replace(',', ' ').replace('.', ',').replace(' ', '.')
    return text


def _bi(build):
    """A label in both languages: build(lang) -> text."""
    return {'tr': build('tr'), 'en': build('en')}


def _lab(label):
    """Any label as {'tr', 'en'} (a code like TM-01 reads the same in both)."""
    if isinstance(label, dict):
        return {'tr': label.get('tr') or '', 'en': label.get('en') or label.get('tr') or ''}
    return {'tr': label or '', 'en': label or ''}


_FUEL_NAMES = {
    'natural_gas': {'tr': 'Doğalgaz', 'en': 'Natural gas'}, 'fuel_oil': {'tr': 'Fuel oil', 'en': 'Fuel oil'},
    'diesel': {'tr': 'Motorin', 'en': 'Diesel'}, 'lpg': {'tr': 'LPG', 'en': 'LPG'},
    'coal': {'tr': 'Kömür', 'en': 'Coal'},
}

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
                    'label': _FUEL_NAMES.get(fuel, fuel)})
    return out


def _collapse_fuel_site(activities, facilities_answer):
    """Attribute 3A-5 stationary-fuel activities to the single 3A-2 site, if any.

    Fuel use (3A-5) is entered as a per-fuel total, not per equipment, so there
    is no 1:1 fuel->equipment link to a 3A-2 site. 3A-2 has the shape
    {equipmentKey: {unit_count, site, group_count}} where 'site' is a facility
    name string. When the distinct non-empty sites collapse to exactly ONE, that
    site is set as facility_name on each fuel activity (activity in
    _STATIONARY_FUELS); zero or more than one site -> leave unassigned (no guess).
    The biomass activity has no 'activity' key, so it is never selected here;
    nothing about quantity/unit/slug/factor is touched -- only the facility bucket.
    """
    equipment = facilities_answer if isinstance(facilities_answer, dict) else {}
    sites = {str(v.get('site')).strip() for v in equipment.values()
             if isinstance(v, dict) and str(v.get('site') or '').strip()}
    if len(sites) != 1:
        return activities
    site = next(iter(sites))
    for a in activities:
        if a.get('activity') in _STATIONARY_FUELS:
            a['facility_name'] = site
    return activities


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
    """4A-1: {site: "amount kWh|MWh"} (or one string) -> one grid electricity
    activity per site ('site' is the facility loop key), so each facility's
    electricity is its own entry."""
    sites = list(answer.items()) if isinstance(answer, dict) else [(None, answer)]
    out = []
    for site, raw in sites:
        amount, unit = _split_amount_unit(raw)
        qty = _number(amount)
        if not qty:
            continue
        unit = unit.lower()
        if unit in ('', 'kwh'):
            kwh = qty
        elif unit == 'mwh':
            kwh = qty * 1000
        else:
            continue
        out.append({'activity': 'electricity', 'quantity': kwh, 'unit': 'kwh', 'label': '', 'site': site})
    return out


def _named_sites(activities, facilities_answer):
    """The facility name (2A-2) of each per-site activity, as its label and
    the facility its entry is linked to."""
    names = facilities_answer if isinstance(facilities_answer, dict) else {}
    for a in activities:
        item = names.get(str(a.get('site'))) if a.get('site') is not None else None
        name = str(item.get('name') or '').strip() if isinstance(item, dict) else ''
        if name:
            a['label'] = {'tr': name, 'en': name}
            a['facility_name'] = name
    return activities


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
_ENERGY_NAMES = {'heat': {'tr': 'Isı', 'en': 'Heat'}, 'steam': {'tr': 'Buhar', 'en': 'Steam'},
                 'cooling': {'tr': 'Soğutma', 'en': 'Cooling'}}


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
            out.append({'slug': slug, 'quantity': kwh, 'label': _ENERGY_NAMES[kind]})
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
                'label': _bi(lambda lg: f'{cat} · {supplier} ({_fmt(value, lang=lg)} {unit})')})
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


def _upstream_energy(A, groups, skip_sites=frozenset(), uk_sites=frozenset(), year=None):
    """K3C3 "confirmed": upstream electricity and T&D losses on the kWh of
    4A-1 (and of EV charging counted in 4A-EV); fuel extraction on litres of
    liquid fuel (3A-5 diesel / fuel oil / LPG, vehicles). The kWh of a
    facility whose electricity is not calculated (`skip_sites`, lower-case
    names) stays out here too — it is reported as pending, not counted in one
    category and missing from the other."""
    if A.get('K3C3-INFO') != 'confirmed':
        return []
    site = lambda a: str(a.get('facility_name') or '').strip().lower()
    kwh = sum(a['quantity'] for a in groups.get('4A-1', []) if site(a) not in skip_sites)
    # A UK facility's T&D losses use the DESNZ UK factor of a year up to the
    # inventory's (none earlier: the generic estimate, as before).
    uk_kwh = (sum(a['quantity'] for a in groups.get('4A-1', []) if site(a) in uk_sites and site(a) not in skip_sites)
              if uk_sites and _uk_td_available(year) else 0)
    kwh += sum(a.get('kwh', 0) for a in groups.get('4A-EV', []))
    litres = 0.0
    if groups.get('3A-5') and isinstance(A.get('3A-5'), dict):
        for fuel in ('diesel', 'fuel_oil', 'lpg'):
            litres += _litres(A['3A-5'].get(fuel)) or 0
    litres += sum(a.get('litres', 0) for a in groups.get('3B-7', []))
    out = []
    if kwh:
        out.append({'slug': 'upstream-electricity', 'quantity': kwh,
                    'label': {'tr': 'Elektrik üretim zinciri (WTT)', 'en': 'Electricity supply chain (WTT)'}})
        if kwh - uk_kwh:
            out.append({'slug': 'transmission-losses', 'quantity': kwh - uk_kwh,
                        'label': {'tr': 'İletim ve dağıtım kayıpları', 'en': 'Transmission and distribution losses'}})
        if uk_kwh:
            out.append({'slug': 'uk-transmission-losses', 'quantity': uk_kwh,
                        'label': {'tr': 'İletim ve dağıtım kayıpları (Birleşik Krallık)',
                                  'en': 'Transmission and distribution losses (UK)'}})
    if litres:
        out.append({'slug': 'fuel-extraction', 'quantity': litres,
                    'label': {'tr': 'Yakıt üretim zinciri (WTT)', 'en': 'Fuel supply chain (WTT)'}})
    return out


def _uk_td_available(year):
    from emissions.models import EmissionFactor
    try:
        y = int(year)
    except (TypeError, ValueError):
        return False
    return EmissionFactor.objects.filter(slug='uk-transmission-losses', is_active=True, year__lte=y).exists()


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
             'label': _bi(lambda lg: f'{provider} ({_fmt(t, lang=lg)} tCO2e)')}]


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


def _scope12_sites(A):
    """Facilities (lower-case names, as answered in 2A-2) whose energy the
    Scope 1/2 steps already count in this inventory: the evidence that a leased
    asset linked to one of them is not Category 8's to count."""
    own = lambda step: activities_for_step(step, {'answer': A.get(step)})
    sources = (('4A-1', lambda: _named_sites(own('4A-1'), A.get('2A-2'))),
               ('3A-5', lambda: _collapse_fuel_site(own('3A-5'), A.get('3A-2'))))
    sites = set()
    for step, activities in sources:
        gate = _GATES.get(step)
        if gate and A.get(gate) not in (None, '', 'yes'):
            continue
        sites.update(str(a['facility_name']).strip().lower() for a in activities() if a.get('facility_name'))
    return sites


def _leased_already_counted(row, scope12_sites):
    """Why a K3C8-1 asset is not counted in Category 8, or None:
    'declared'  - the answer says its energy is already in Scope 1/2;
    'facility'  - the asset is one of the company's registered sites (chosen
                  from the facility list, not typed) and that site's energy is
                  in Scope 1/2 of this same inventory, whatever the answer says.
    The facility is the identity; the Scope 1/2 entries are the evidence."""
    if row.get('in_scope12') == 'included':
        return 'declared'
    linked = str(row.get('facility') or '').strip().lower()
    if linked and linked in scope12_sites:
        return 'facility'
    return None


_LEASED_BUILDINGS = ('KV-01', 'KV-02', 'KV-03', 'KV-05')   # KV-04 is equipment: it has no site to overlap


def _has_scope12_energy(A):
    """Whether the inventory reports any Scope 1/2 energy of its own (stationary
    fuel or purchased electricity), whether or not it is tied to a facility."""
    own = lambda step: activities_for_step(step, {'answer': A.get(step)})
    for step in ('4A-1', '3A-5'):
        gate = _GATES.get(step)
        if gate and A.get(gate) not in (None, '', 'yes'):
            continue
        if own(step):
            return True
    return False


def is_operational_control(A):
    """Whether the inventory's organisational boundary is Operational Control."""
    d3 = A.get('D3')
    return isinstance(d3, dict) and d3.get('boundary_approach') == 'operational_control'


def leased_review_reasons(row, operational, scope12_energy):
    """Why a K3C8-1 row needs a person's review for a possible overlap with Scope
    1/2 — never a reason to leave it out. Only a row saved before the question
    asked "already in Scope 1/2?" (no answer) and tied to no facility qualifies,
    and only a building (equipment has no site):
      'operational_control' — under Operational Control a building the company
                              uses is normally one of its sites;
      'scope12_energy'      — the inventory reports Scope 1/2 energy, and nothing
                              says this asset is not part of it."""
    if 'in_scope12' in row or str(row.get('facility') or '').strip():
        return []
    if str(row.get('asset_type') or '') not in _LEASED_BUILDINGS:
        return []
    return [r for r, on in (('operational_control', operational), ('scope12_energy', scope12_energy)) if on]


def _leased_upstream(A, scope12_sites=None):
    """K3C8-1: declared energy of the leased asset, else area for office and
    warehouse (the only types with an area factor)."""
    out = []
    if scope12_sites is None:
        scope12_sites = _scope12_sites(A)
    for row in _rows(A.get('K3C8-1')):
        # Already reported in Scope 1/2 (one of the company's own sites):
        # Category 8 would count it twice. A row saved before the question
        # asked this keeps its earlier calculation; uncalculated_notes flags
        # it under Operational Control.
        if _leased_already_counted(row, scope12_sites):
            continue
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
                        'label': _bi(lambda lg: f'{row.get("product_type") or ""} · {_fmt(volume, lang=lg)} '
                                                f'{row.get("sales_unit") or ""} × LCA {_fmt(per, lang=lg)} kg')})
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

    def coverage(lg):
        if count and reporting:
            return (f'{int(reporting)}/{int(count)} işletme raporlu' if lg == 'tr'
                    else f'{int(reporting)} of {int(count)} outlets reporting')
        if count:
            return (f'{int(count)} işletme, raporlu işletme sayısı girilmedi' if lg == 'tr'
                    else f'{int(count)} outlets, number reporting not given')
        return ''
    return [{'reported_kg': t * 1000, 'report_as': ('scope3', 'franchises'),
             'label': _bi(lambda lg: f'{_fmt(t, lang=lg)} tCO2e' + (f' · {coverage(lg)}' if coverage(lg) else ''))}]


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
                    'label': _bi(lambda lg: f'{cls} · PCAF ' + (f'%{_fmt(share * 100, 2, lg)}' if lg == 'tr'
                                                                   else f'{_fmt(share * 100, 2, lg)}%')
                                 + f' × {_fmt(emissions, lang=lg)} tCO2e')})
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
        '3A-5': _collapse_fuel_site(
            own('3A-5') + ([{'slug': _BIOMASS[biomass[0]][0], 'quantity': biomass[1],
                             'label': {'tr': 'Biyokütle', 'en': 'Biomass'}}]
                           if biomass else []),
            A.get('3A-2')),
        '3B-7': _vehicles(A),
        '3C-2': _process(A),
        '4A-1': _named_sites(own('4A-1'), A.get('2A-2')),
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
    skip, uk = frozenset(), frozenset()
    if company is not None:
        skip = frozenset([n.strip().lower() for n, _c, _k in sites_without_grid(A, company, year)]
                         + [n.strip().lower() for n, _k in sites_pending_connection(A, company, year)])
        from companies.models import Facility
        uk = frozenset(f.name.strip().lower() for f in Facility.objects.filter(company=company)
                       if (f.country or '').strip().upper() in ('GB', 'UK'))
    g['K3C3-INFO'] = _upstream_energy(A, g, skip, uk, year)
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
    return per_unit, value * mult, _bi(lambda lg: f'{source} ({_fmt(value, lang=lg)} {unit})')


_DOC_SOURCE = {doc: step for step, (_gate, doc) in _EF_DOCUMENT.items()}
# How far a document's factor may be from the catalog factor of the same
# activity (supplied ÷ reference). Fuel and process factors are bound by
# chemistry, so 100 kg CO2e/m³ for natural gas (≈ 50×) or 0.825 kg for a tonne
# of clinker (≈ 1/600) is a typo, not a supplier's figure. Electricity and
# purchased heat may legitimately be near zero (renewable supply): only the
# upper bound applies to them.
_EF_PLAUSIBLE_RATIO = {'3A-5': (0.2, 5), '3B-7': (0.2, 5), '3C-2': (0.2, 5), '4A-1': (None, 5), '4B-2': (None, 5)}
_UNIT_WORDS = {'m3': 'm³', 'kwh': 'kWh', 'liters': 'litre', 'tonnes': 'tonne', 'kg': 'kg', 'km': 'km'}


def supplier_factor_problem(doc_step, doc_answer, answers, year, company=None, lang='en'):
    """Why a supplier / facility-specific factor document (3A/3B/3C/4A/4B-EF-a)
    cannot be used for the amounts of its step, or None:

    - 'unit': no amount of the step is in the document's unit, so the factor
      applies to nothing (it used to be dropped without a word, and the
      generic factor used instead);
    - 'implausible': the value is outside _EF_PLAUSIBLE_RATIO of the catalog
      factor of the amount it would replace (a typo such as 100 instead of
      2.02 made the inventory 50 times larger).

    Returns {'code', 'tr', 'en'}. None while the step has no amount yet."""
    source = _DOC_SOURCE.get(doc_step)
    if not source or not isinstance(doc_answer, dict):
        return None
    unit, value = doc_answer.get('ef_unit'), _number(doc_answer.get('ef_value'))
    if unit not in _EF_UNITS or not value:
        return None  # the field checks report a missing or unknown value
    per_unit, mult = _EF_UNITS[unit]
    merged = {**(answers or {}), doc_step: {'answer': doc_answer}}
    activities = activities_for_report(merged, year, company).get(source) or []
    facility_of = _facility_lookup(company) if company else None
    resolved = []
    for a in activities:
        if 'report_as' in a or 'reported_kg' in a:
            continue
        r = _resolve(a, company, facility_of, year)
        if r:
            resolved.append(r[0])
    if not resolved:
        return None

    def unit_of(f):
        return _FACTOR_UNIT_ALIASES.get(f.unit.lower(), f.unit.lower())

    matching = [f for f in resolved if unit_of(f) == per_unit]
    if not matching:
        entered = ', '.join(sorted({_UNIT_WORDS.get(unit_of(f), unit_of(f)) for f in resolved}))
        return {
            'code': 'unit',
            'tr': f'Belgenin birimi ({unit}) bu adımdaki miktarların birimiyle ({entered}) uyuşmuyor; '
                  'bu faktör hiçbir miktara uygulanamaz. Belgedeki birimi kontrol edin.',
            'en': f'The document\'s unit ({unit}) does not match the unit of the amounts in this step ({entered}), '
                  'so the factor cannot be applied to any of them. Check the unit on the document.',
        }
    low, high = _EF_PLAUSIBLE_RATIO.get(source, (None, None))
    supplied = float(value) * mult
    for f in matching:
        ref = float(f.factor_kg_co2e)
        if ref <= 0:
            continue
        ratio = supplied / ref
        if (low is not None and ratio < low) or (high is not None and ratio > high):
            word = _UNIT_WORDS.get(per_unit, per_unit)
            span = f'{low}–{high}' if low is not None else f'≤ {high}'
            return {
                'code': 'implausible',
                'tr': f'Bu faktör ({_fmt(supplied, 6, "tr")} kg CO2e/{word}) aynı kaynağın referans faktörünün '
                      f'({f.name}: {_fmt(ref, 6, "tr")} kg CO2e/{word}) {_fmt(ratio, 2, "tr")} katı. Tedarikçi ve '
                      f'tesise özgü faktörler bu değerin {span} katı aralığında olur; belgedeki değeri ve birimi kontrol edin.',
                'en': f'This factor ({_fmt(supplied, 6, "en")} kg CO2e/{word}) is {_fmt(ratio, 2, "en")} times the '
                      f'reference factor of the same source ({f.name}: {_fmt(ref, 6, "en")} kg CO2e/{word}). Supplier '
                      f'and facility-specific factors stay within {span} times it; check the value and unit on the document.',
            }
    return None


def _factor_by_slug(slug, year=None):
    """The active catalog factor of `slug` (Turkey row first) for the
    inventory year — see emissions.factor_lookup.pick_factor."""
    from emissions.factor_lookup import pick_factor
    return pick_factor(slug, 'turkey', year) or pick_factor(slug, 'global', year)


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


def _resolve(activity, company=None, facility_of=None, year=None):
    """(factor, quantity Decimal, co2e_kg Decimal) for one activity, or None.
    A per-facility activity uses that facility (its country's electricity grid)."""
    from emissions.factor_lookup import resolve_factor_and_amount
    if 'reported_kg' in activity:
        kg = Decimal(str(activity['reported_kg']))
        return _calculated_factor(*activity['report_as']), kg, kg
    if 'slug' in activity:
        factor = _factor_by_slug(activity['slug'], year)
        if not factor:
            return None
        try:
            qty = Decimal(str(activity['quantity']))
        except (InvalidOperation, ValueError):
            return None
        return factor, qty, qty * factor.factor_kg_co2e
    facility = facility_of(activity.get('facility_name')) if facility_of else None
    factor, qty, co2e, error = resolve_factor_and_amount(
        activity['activity'], activity['quantity'], activity['unit'], company, facility, year)
    if error:
        logger.info('Questionnaire activity skipped (%s): %s', activity, error)
        return None
    return factor, qty, co2e


def _entry_specs(step, activities, A, year, company):
    """[(factor, quantity, label, facility name)] of one step: the catalog factor, or the
    "calculated" factor of the same scope / category when the CO2e comes
    from elsewhere (supplier factor, declaration, reporting category)."""
    facility_of = _facility_lookup(company) if company else None
    # 4A-1: a facility with an approved location-based factor (Özel Talep)
    # for this year is calculated with that factor instead of the grid.
    requested = approved_electricity_requests(company, year) if step == '4A-1' and company else {}
    by_request = []
    if requested:
        rest = []
        for a in activities:
            fac = facility_of(a.get('facility_name'))
            if fac is not None and fac.pk in requested:
                by_request.append((a, requested[fac.pk]))
            else:
                rest.append(a)
        activities = rest
    resolved = [(a, r) for a, r in ((a, _resolve(a, company, facility_of, year)) for a in activities) if r]
    # The electricity supplier's factor is market-based: it never replaces
    # the location-based grid factor of 4A-1 (see scope2_market_based).
    supplier = _supplier_ef(A, step, year) if step in _EF_DOCUMENT and step != '4A-1' else None
    # An implausible factor (saved before the step refused it) is not
    # applied; uncalculated_notes says why the generic factor is used.
    if supplier and supplier_factor_problem(_EF_DOCUMENT[step][1], A.get(_EF_DOCUMENT[step][1]), A, year, company):
        supplier = None
    targets = []
    if supplier:
        matching = [a for a, (f, _q, _c) in resolved
                    if 'report_as' not in a
                    and _FACTOR_UNIT_ALIASES.get(f.unit.lower(), f.unit.lower()) == supplier[0]]
        # One activity in the document's unit: it is the one the document is
        # for. Several (two fuels in litres) would be a guess — except the
        # same activity split by site (4A-1 electricity of each facility).
        if len(matching) == 1 or (matching and all(a.get('site') is not None for a in matching)):
            targets = matching
    from emissions.notifications import _unit

    def joined(*parts):
        return {lg: ' · '.join(filter(None, [p[lg] for p in parts])) for lg in ('tr', 'en')}

    specs = []
    for activity, req in by_request:
        qty, per = Decimal(str(activity['quantity'])), req.approved_factor_kg_co2e
        specs.append((_calculated_factor('scope2', 'electricity'), qty * per, joined(
            _lab(activity.get('label')),
            _bi(lambda lg: f'{_fmt(float(qty), lang=lg)} kWh × {_fmt(float(per), 6, lg)} kg CO2e/kWh '
                           f'({"Özel Talep" if lg == "tr" else "Custom Request"} #{req.pk})')),
            activity.get('facility_name')))
    for activity, (factor, qty, co2e) in resolved:
        label = _lab(activity.get('label'))
        site = activity.get('facility_name')
        if any(activity is t for t in targets):
            _u, per, src = supplier
            specs.append((_calculated_factor(factor.scope, factor.category), qty * Decimal(str(per)), joined(
                label, _bi(lambda lg: f'{_fmt(float(qty), lang=lg)} {_unit(factor.unit.lower(), lg)} × {src[lg]}')),
                site))
        elif 'report_as' in activity and 'reported_kg' not in activity:
            specs.append((_calculated_factor(*activity['report_as']), co2e, joined(
                label, _bi(lambda lg: f'{_fmt(float(qty), lang=lg)} {_unit(factor.unit.lower(), lg)} × '
                                      f'{_fmt(float(factor.factor_kg_co2e), lang=lg)} ({factor.slug})')), site))
        else:
            specs.append((factor, qty, label, site))
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
    """kg CO2e of all entries this inventory's answers created (effective)."""
    return questionnaire_totals(report)[0]


def _q4(value):
    return Decimal(str(value)).quantize(Decimal('0.0001'))


def question_label(step_id, lang='tr'):
    """How an entry names its question: "Soru 68" (step codes like 4A-1 or
    K3C3-INFO mean nothing to a user)."""
    from .carboniq_validation import _load_schema
    number = (_load_schema().get(step_id) or {}).get('number')
    if number in (None, ''):
        return step_id
    return f'Soru {number}' if lang == 'tr' else f'Question {number}'


def entry_group(description):
    """The step a questionnaire entry belongs to ("Questionnaire step 4A-1 · …" -> 4A-1)."""
    desc = description or ''
    if not desc.startswith(DESCRIPTION_PREFIX + ' '):
        return None
    return desc[len(DESCRIPTION_PREFIX) + 1:].split(' ')[0]


def resync_inventory(company, year, user):
    """Recalculate the company's inventory of `year` from its saved answers
    after a factor it uses was approved or withdrawn (Özel Talep) — as an
    approved change: the factor was reviewed, the answers did not change."""
    from .models import CarbonReport
    report = (CarbonReport.objects.filter(company=company, reporting_year=year)
              .order_by('-updated_at').first())
    if report is None:
        return []
    locked = report_is_locked(report)
    before = questionnaire_totals(report)[1] if locked else 0.0
    from .year_guard import InventoryYearConflict
    try:
        created = sync_step_entries(user, company, report, '4A-1', as_status='approved')
    except InventoryYearConflict:
        logger.warning('resync of %s skipped: more than one inventory covers it', year)
        return []
    if locked and abs(questionnaire_totals(report)[1] - before) > 1e-6:
        # An approved factor moved a signed / completed inventory: that is a
        # change after signing, so it is flagged and named in the history.
        if report.signed_at:
            CarbonReport.objects.filter(pk=report.pk).update(edited_after_signing_at=timezone.now())
        from emissions.audit import log_company_activity
        log_company_activity(
            user, company.pk, 'inventory_recalculated',
            f'{year} envanteri ({report.title or year}) onaylanan bir faktör nedeniyle yeniden hesaplandı '
            f'(imzalı/tamamlanmış envanter; "imzadan sonra düzenlendi" olarak işaretlendi).',
            f'The {year} inventory ({report.title or year}) was recalculated because a factor was approved '
            f'(signed/completed inventory; marked as edited after signing).',
            target_type='CarbonReport', target_id=report.pk, reporting_year=year)
    return created


def sync_step_entries(user, company, report, step_id, data=None, as_status=None):
    """Recalculate an inventory's entries (see _sync_step_entries); a signed or
    completed inventory keeps the grid connections it was applied with
    (CarbonReport.applied_grid_connections), not the facilities' current ones."""
    from .year_guard import InventoryYearConflict, other_inventories_for_year
    year = report.reporting_year
    if not year:
        return []        # no year, no entries: they used to land in 2024, in another inventory's numbers
    others = other_inventories_for_year(report.company_id, year, exclude_pk=report.pk)
    if others:
        raise InventoryYearConflict(others, year)
    with recorded_connections(report):
        return _sync_step_entries(user, company, report, step_id, data, as_status)


def _sync_step_entries(user, company, report, step_id, data=None, as_status=None):
    """
    Recalculate the entries of the whole inventory from its saved answers —
    an answer can change another step's entries (the fuel type of 3B-5 and
    the amount of 3B-7, a level question that switches K3C5-2 off, …).

    A step's entries are replaced only when what they report changed. An
    owner / admin / manager's change counts at once. A data-entry member's
    change waits for approval *next to* the approved rows it would replace:
    those stay in the totals until the new rows are approved (approving them
    removes the old ones), so one edit no longer takes a whole source out of
    the dashboard. Saving the saved step again with the same answer as an
    approver confirms what is pending. Returns the new entries.
    """
    from emissions.models import EmissionEntry
    from emissions.factor_lookup import _get_entry_status
    from emissions.notifications import notify_questionnaire_change
    from emissions.audit import log_answer_change
    from .models import ReportStep
    if not company:
        return []
    year = report.reporting_year or 2024
    answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
    A = {k: _value(v) for k, v in answers.items()}
    groups = activities_for_report(answers, year, company)
    # Same approval rule as the form and the chat: an owner/admin/manager's
    # answers count at once, a data-entry member's wait for approval.
    status = as_status or _get_entry_status(user, company)
    # One save, one change: rows it leaves waiting carry the step that was
    # saved, so they are reviewed (and counted) together.
    import uuid
    batch = f'{step_id}:{uuid.uuid4().hex[:12]}' if status == 'submitted' else ''

    def sig(items):
        return sorted(items)

    facility_of = _facility_lookup(company)

    created, changes, deletions = [], [], []
    for step in ENTRY_STEPS:
        specs = _entry_specs(step, groups.get(step, []), A, year, company)
        rows = _step_rows(step, specs, facility_of)
        # What a step reports is its factors, amounts and facilities; the label
        # text may change between versions (heat -> Isı) without the inventory changing.
        new_sig = sig(_row_key(r) for r in rows)
        existing = list(_step_entries(company, year, step))
        approved = [e for e in existing if e.status == 'approved']
        waiting = [e for e in existing if e.status != 'approved']
        current = waiting or approved
        unchanged = sig(_entry_key(e) for e in current) == new_sig
        same_as_approved = sig(_entry_key(e) for e in approved) == new_sig

        asked_deleted = [e for e in approved if e.delete_requested]
        if status == 'approved':
            if unchanged and not waiting:
                _backfill_detail(existing, rows)
                continue
            if unchanged and step != step_id:
                continue  # someone else's change still waits for review
            if not rows and step != step_id and asked_deleted:
                continue  # a deletion request waiting for review, not this save's
            to_delete, keep_approved = existing, False
        else:
            if same_as_approved and approved:
                _backfill_detail(approved, rows)
                _clear_delete_request(asked_deleted)       # the answer is back
                to_delete, keep_approved = waiting, True   # back to the approved value
                rows = []
            elif unchanged:
                _backfill_detail(existing, rows)
                continue
            elif not rows and approved:
                # A data-entry member removed an approved answer: its rows stay
                # (and count) with a deletion request until it is reviewed.
                for e in waiting:
                    e.delete()
                newly = [e for e in approved if not e.delete_requested]
                if newly:
                    EmissionEntry.objects.filter(pk__in=[e.pk for e in newly]).update(delete_requested=True)
                    log_answer_change(user, company, year, step, approved, [], 'submitted')
                    deletions.append(approved[0])
                continue
            elif not rows:
                to_delete, keep_approved = existing, False
            else:
                _clear_delete_request(asked_deleted)       # a new value, not a deletion
                to_delete, keep_approved = waiting, True
        before = list(approved or waiting)
        # An approver's save keeps the rows that report the same thing (same
        # factor, amount and facility) as they are — with their proof
        # document and approval — and rebuilds only the ones that changed.
        kept = []
        if status == 'approved':
            pool, fresh = list(to_delete), []
            for r in rows:
                match = next((e for e in pool if _entry_key(e) == _row_key(r)), None)
                if match is None:
                    fresh.append(r)
                    continue
                pool.remove(match)
                kept.append(match)
                _clear_delete_request([match])
                if match.status != 'approved':   # confirming a waiting change
                    match.status, match.approved_by, match.approved_at = 'approved', user, timezone.now()
                    match.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
                _backfill_detail([match], [r])
            to_delete, rows = pool, fresh
        # A proof document stays with its facility's source: a row rebuilt for
        # the same factor and facility gets the proof of the row it replaces
        # (noted, since it was attached to the earlier value).
        proof_of = {}
        for e in list(to_delete) + (approved if keep_approved else []):
            if e.proof_document:
                proof_of.setdefault((e.emission_factor_id, e.facility_id), e)
        for e in to_delete:
            e.delete()
        new_entries = [EmissionEntry.objects.create(
            user=user,
            company=company,
            emission_factor=factor,
            year=year,
            month=1,  # annual questionnaire data
            quantity=qty,
            calculated_co2e_kg=qty * factor.factor_kg_co2e,
            description=description,
            calc_detail=detail,
            factor_value_snapshot=factor.factor_kg_co2e,
            factor_source_snapshot=factor.source,
            facility=facility,
            status=status,
            change_batch=batch,
        ) for factor, qty, description, detail, facility in rows]
        carried = []
        for e in new_entries:
            src = proof_of.get((e.emission_factor_id, e.facility_id))
            if src is not None:
                type(e).objects.filter(pk=e.pk).update(proof_document=src.proof_document.name)
                e.proof_document = src.proof_document.name
                carried.append((src.proof_document.name.rsplit('/', 1)[-1], _q4(src.quantity) != _q4(e.quantity)))
        created.extend(new_entries)
        # Change history: what the answer reported before and what it reports now.
        if new_entries or (to_delete and kept):
            log_answer_change(user, company, year, step, before, kept + new_entries, status, carried)
        elif keep_approved and waiting:   # a waiting change taken back: the approved value again
            log_answer_change(user, company, year, step, waiting, approved, 'approved')
        elif to_delete:
            log_answer_change(user, company, year, step, before, [], status)
        if status == 'submitted' and new_entries:
            changes.append((step, new_entries, approved if keep_approved else []))
    if changes:
        # One notice per save: the answer that was changed, with what it
        # recalculated elsewhere (a fuel amount also moves its upstream WTT
        # rows) — updated while it is still unread.
        steps = [c[0] for c in changes]
        main = step_id if step_id in steps else steps[0]
        # The question that was edited may create no entries itself (Q24's
        # grid connection recalculates Q68): name it, not the first one recalculated.
        notify_questionnaire_change(
            user, company, year, main,
            [e for c in changes for e in c[1]], [e for c in changes for e in c[2]],
            also=[s for s in steps if s != main],
            edited=step_id if step_id not in steps else None)
    if deletions:
        from emissions.notifications import notify_delete_requested
        for entry in deletions:
            notify_delete_requested(user, entry)
    return created


def _clear_delete_request(entries):
    from emissions.models import EmissionEntry
    ids = [e.pk for e in entries if getattr(e, 'delete_requested', False)]
    if ids:
        EmissionEntry.objects.filter(pk__in=ids).update(delete_requested=False)
        for e in entries:
            e.delete_requested = False


def _step_rows(step, specs, facility_of):
    """[(factor, quantity, description, calc_detail, facility)] a step's entries
    are made of. A calculated entry always names the factor it was calculated with."""
    base = f'{DESCRIPTION_PREFIX} {step}'
    many = len(specs) > 1
    rows = []
    for factor, qty, label, site in specs:
        shown = bool(label['tr']) and (many or factor.slug.startswith('calculated-'))
        facility = facility_of(site)
        if facility is not None and facility.pk is None:
            facility = None      # a facility rebuilt from a signed inventory's record (deleted since): no link
        rows.append((factor, _q4(qty), f'{base} · {label["tr"]}' if shown else base,
                     label if label['tr'] else None, facility))
    return rows


def refresh_entry_text(report):
    """Give the entries of `report`'s answers their current label and
    calc_detail where the answers still report the same factor, amount and
    facility (text only; nothing is rebuilt, approvals stay)."""
    with recorded_connections(report):
        _refresh_entry_text(report)


def _refresh_entry_text(report):
    from .models import ReportStep
    company, year = report.company, report.reporting_year
    if not company or not year:
        return
    answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
    A = {k: _value(v) for k, v in answers.items()}
    groups = activities_for_report(answers, year, company)
    facility_of = _facility_lookup(company)
    for step in ENTRY_STEPS:
        entries = list(_step_entries(company, year, step))
        if entries:
            rows = _step_rows(step, _entry_specs(step, groups.get(step, []), A, year, company), facility_of)
            _backfill_detail(entries, rows)


# {facility id (str): grid connection} an inventory was calculated with, for the
# signed / completed inventory being calculated or reported, else None.
_APPLIED_CONNECTIONS = contextvars.ContextVar('applied_grid_connections', default=None)


def report_is_locked(report):
    """A signed or completed inventory: its figures are history, and a change
    made elsewhere (Settings) must not move them."""
    from .models import CarbonReport
    return bool(report.signed_at) or report.status == CarbonReport.Status.COMPLETED


@contextlib.contextmanager
def recorded_connections(report):
    """Calculate or report a signed / completed inventory with the grid
    connection it was *applied* with (CarbonReport.applied_grid_connections),
    not the facility's current one. The Turkish grid factor follows the
    connection, and Settings changes it for the facility as a whole: without
    this, any later recalculation of last year's signed inventory would quietly
    use this year's connection.

    The snapshot holds applied values only — what an approver set — never what a
    data-entry member proposed in Q24 and nobody has accepted, so a proposal
    cannot move an approved calculation. Does nothing for a draft, or for a
    facility whose connection has not changed since the inventory was locked
    (no key: its current connection is the applied one)."""
    from .models import CarbonReport
    applied, countries = None, {}
    if report is not None and getattr(report, 'pk', None):
        # Read fresh: the object in hand may predate a snapshot taken a moment ago.
        row = CarbonReport.objects.filter(pk=report.pk).values('signed_at', 'status', 'applied_grid_connections').first()
        if row and (row['signed_at'] or row['status'] == CarbonReport.Status.COMPLETED):
            applied = {str(k): v for k, v in (row['applied_grid_connections'] or {}).items()}
            countries = _stated_facilities(report)
    token = _APPLIED_CONNECTIONS.set(applied)
    country_token = _APPLIED_COUNTRIES.set(countries)
    try:
        yield
    finally:
        _APPLIED_COUNTRIES.reset(country_token)
        _APPLIED_CONNECTIONS.reset(token)


# {facility name (lower): country} the signed / completed inventory states in its own 2A-2 answer.
# The grid factor follows the facility's country as well as its connection; a country changed later in
# Settings (or by another inventory's 2A-2) must not move this inventory's next recalculation — it
# would otherwise drop or re-price approved electricity. A country changed in this inventory's own
# 2A-2 is stated there, so it follows (flagged as edited then).
_APPLIED_COUNTRIES = contextvars.ContextVar('applied_facility_countries', default={})


def _stated_facilities(report):
    """{facility name (lower): {'name', 'country', 'connection'}} as the inventory's own 2A-2 answer
    records them ('connection' '' when not stated / "I don't know")."""
    from .models import ReportStep
    from .facility_sync import CONNECTIONS
    stored = ReportStep.objects.filter(report_id=report.pk, step_id='2A-2').values_list('answer', flat=True).first()
    answer = stored.get('answer', stored) if isinstance(stored, dict) else None
    out = {}
    for row in answer.values() if isinstance(answer, dict) else ():
        if isinstance(row, dict) and str(row.get('name') or '').strip():
            conn = row.get('grid_connection')
            out[str(row['name']).strip().lower()] = {
                'name': str(row['name']).strip()[:255], 'country': str(row.get('country') or '').strip()[:100],
                'connection': conn if conn in CONNECTIONS else ''}
    return out


def _facility_lookup(company):
    """facility name (2A-2 answer) -> the company's Facility of that name, or None."""
    from companies.models import Facility
    by_name = {f.name.strip().lower(): f for f in Facility.objects.filter(company=company)}

    def find(name):
        if not name:
            return None
        key = str(name).strip().lower()
        facility = by_name.get(key)
        applied = _APPLIED_CONNECTIONS.get()
        if facility is not None and applied is not None:
            connection = applied.get(str(facility.pk))
            if connection is not None and connection != facility.grid_connection:
                facility = copy.copy(facility)   # same pk; only this calculation sees the applied connection
                facility.grid_connection = connection
            country = (_APPLIED_COUNTRIES.get().get(key) or {}).get('country')
            if country and country != facility.country:
                facility = copy.copy(facility)   # likewise the country this inventory was calculated with
                facility.country = country
        elif facility is None and applied is not None and key in _APPLIED_COUNTRIES.get():
            # The facility was deleted after this inventory was signed. Its figures are history: they are
            # recalculated with the facility as the inventory's own 2A-2 recorded it (country, grid
            # connection), never with the company default. Unsaved, so no entry is linked to it.
            from companies.models import Facility
            stated = _APPLIED_COUNTRIES.get()[key]
            facility = Facility(company=company, name=stated['name'], country=stated['country'],
                                grid_connection=stated['connection'])
        return facility
    return find


def _row_key(row):
    factor, qty, _desc, _detail, facility = row
    return (factor.id, qty, facility.pk if facility else 0)


def _entry_key(entry):
    return (entry.emission_factor_id, _q4(entry.quantity), entry.facility_id or 0)


def _backfill_detail(entries, rows):
    """Unchanged entries get the current label text and calc_detail in
    place (entries made before calc_detail, or before a label was renamed)
    without being rebuilt — their approval stays."""
    free = list(rows)
    for e in entries:
        match = next((r for r in free if _row_key(r) == _entry_key(e)), None)
        if not match:
            continue
        free.remove(match)
        _f, _q, description, detail, _facility = match
        if e.description != description or e.calc_detail != detail:
            type(e).objects.filter(pk=e.pk).update(description=description, calc_detail=detail)


def questionnaire_totals(report):
    """(effective kg, approved kg) of this inventory's entries: effective
    counts a step's waiting rows instead of its approved ones — what the
    inventory says once everything is approved."""
    from emissions.models import EmissionEntry
    if not report.company_id:
        return 0.0, 0.0
    by_step = {}
    for e in EmissionEntry.objects.filter(
            company_id=report.company_id, year=report.reporting_year or 2024,
            description__startswith=f'{DESCRIPTION_PREFIX} ').only('description', 'status', 'calculated_co2e_kg'):
        bucket = by_step.setdefault(entry_group(e.description), {'approved': 0.0, 'waiting': 0.0, 'has_waiting': False})
        if e.status == 'approved':
            bucket['approved'] += float(e.calculated_co2e_kg)
        else:
            bucket['waiting'] += float(e.calculated_co2e_kg)
            bucket['has_waiting'] = True
    effective = sum(b['waiting'] if b['has_waiting'] else b['approved'] for b in by_step.values())
    approved = sum(b['approved'] for b in by_step.values())
    return effective, approved


# ── Answers that are kept but not calculated ─────────────────────────────────

def approved_electricity_requests(company, year, method='location_based'):
    """{facility id: CustomEmissionRequest} — the electricity factor an admin
    approved (Özel Talep) for a facility and reporting year, for one Scope 2
    method. Unique per facility + year + method (admin validation); should
    two exist anyway, the latest approval wins."""
    from emissions.models import CustomEmissionRequest
    if company is None or not year:
        return {}
    qs = CustomEmissionRequest.objects.filter(
        company=company, year=year, status='approved', electricity_method=method,
        facility__isnull=False, approved_factor_kg_co2e__isnull=False).order_by('updated_at', 'pk')
    return {r.facility_id: r for r in qs}


def sites_without_grid(A, company, year=None):
    """[(facility name, country code, kWh)] of the 4A-1 electricity answered
    for facilities whose country has no grid factor of its own and no
    approved location-based factor for `year` (not calculated — pending).
    `A` is the unwrapped answers ({step: value})."""
    from emissions.factor_lookup import facility_grid_slug
    if company is None or A.get('4A-1') in (None, ''):
        return []
    facility_of = _facility_lookup(company)
    requested = approved_electricity_requests(company, year) if year else {}
    out = []
    for a in _named_sites(_electricity(A.get('4A-1')), A.get('2A-2')):
        fac = facility_of(a.get('facility_name'))
        code = (getattr(fac, 'country', '') or '').strip().upper()
        if fac is not None and code and not facility_grid_slug(code) and fac.pk not in requested:
            out.append((fac.name, code, float(a['quantity'])))
    return out


def sites_pending_connection(A, company, year=None):
    """[(facility name, kWh)] of the 4A-1 electricity of facilities in Turkey
    whose grid connection (transmission / distribution) is not chosen — the
    official factor depends on it, so it waits (not calculated) — unless an
    approved location-based factor of the year covers it."""
    from emissions.factor_lookup import facility_grid_slug
    if company is None or A.get('4A-1') in (None, ''):
        return []
    facility_of = _facility_lookup(company)
    requested = approved_electricity_requests(company, year) if year else {}
    out = []
    for a in _named_sites(_electricity(A.get('4A-1')), A.get('2A-2')):
        fac = facility_of(a.get('facility_name'))
        if (fac is not None and facility_grid_slug(fac.country) == 'turkey-grid'
                and not fac.grid_connection and fac.pk not in requested):
            out.append((fac.name, float(a['quantity'])))
    return out


def sites_on_superseded_grid(company, year):
    """{facility name: kWh} of 4A-1 electricity still counted with the single
    Turkey grid factor ('turkey-grid'), which the connection-based official
    factors replaced: entries saved before that change keep it until the
    inventory is saved again (owner's decision) — so they are in the totals
    with it, not pending."""
    if company is None or not year:
        return {}
    out = {}
    for e in (_step_entries(company, year, '4A-1')
              .filter(status='approved', emission_factor__slug='turkey-grid', facility__isnull=False)
              .select_related('facility')):
        out[e.facility.name] = out.get(e.facility.name, 0.0) + float(e.quantity or 0)
    return out


def scope2_market_based(answers, year, company=None):
    """The market-based Scope 2 of the purchased electricity (4A-1 sites and
    EV charging counted in 4A-EV) — reported next to, never added to, the
    location-based inventory total. Per activity, in this order:
      1. the market-based factor approved for that facility and year (Özel Talep);
      2. the electricity supplier's declaration (4A-EF-a) valid for the year,
         only for activities in the market the declaration covers (its
         ef_market country; the company's country when not given) — a
         Turkish supplier's factor is never applied to a site in Austria;
      3. a residual mix — none is registered, so this level is skipped;
      4. the location-based factor of the activity (its grid / approved request).
    Activities with none of these are listed as not calculated.
    Returns None when no electricity is answered, else
    {'total_kg', 'rows': [{site, kwh, factor, basis, kg}], 'missing': [(site, kwh)],
     'has_instrument': bool, 'supplier_market': code or None,
     'outside_market': [site], 'pending_connection': [site]} — the missing
    sites that wait for their grid connection (Turkey), not for a factor."""
    A = {k: _value(v) for k, v in (answers or {}).items()}
    groups = activities_for_report(answers, year, company)
    acts = list(groups.get('4A-1', [])) + list(groups.get('4A-EV', []))
    if not acts:
        return None
    facility_of = _facility_lookup(company) if company else (lambda _n: None)
    market = approved_electricity_requests(company, year, 'market_based') if company else {}
    location = approved_electricity_requests(company, year) if company else {}
    supplier = _supplier_ef(A, '4A-1', year)
    supplier_per = supplier[1] if supplier and supplier[0] == 'kwh' else None
    supplier_market = supplier_market_code(A, company) if supplier_per is not None else None
    home = _market_code(getattr(company, 'country_of_headquarters', '') if company else '')
    rows, missing, outside = [], [], []
    for a in acts:
        site = a.get('facility_name') or _lab(a.get('label'))['tr'] or ''
        kwh = float(a['quantity'])
        fac = facility_of(a.get('facility_name'))
        where = _market_code(getattr(fac, 'country', '')) if fac is not None else ''
        where = where or home
        factor = basis = None
        if fac is not None and fac.pk in market:
            factor, basis = float(market[fac.pk].approved_factor_kg_co2e), 'facility_request'
        elif supplier_per is not None and supplier_market and where == supplier_market:
            factor, basis = float(supplier_per), 'supplier'
        elif fac is not None and fac.pk in location:
            factor, basis = float(location[fac.pk].approved_factor_kg_co2e), 'location_fallback'
        else:
            r = _resolve(a, company, facility_of, year)
            if r:
                factor, basis = float(r[0].factor_kg_co2e), 'location_fallback'
        if supplier_per is not None and basis != 'facility_request' and where != supplier_market:
            outside.append(site)   # the declaration does not cover this market
        if factor is None:
            missing.append((site, kwh))
            continue
        rows.append({'site': site, 'kwh': kwh, 'factor': factor, 'basis': basis, 'kg': kwh * factor,
                     'source': supplier[2] if basis == 'supplier' else None})
    waiting = ({n.strip().lower() for n, _k in sites_pending_connection(A, company, year)}
               if company else set())
    return {'total_kg': sum(r['kg'] for r in rows), 'rows': rows, 'missing': missing,
            'has_instrument': any(r['basis'] != 'location_fallback' for r in rows),
            'supplier_market': supplier_market, 'outside_market': outside,
            'pending_connection': [site for site, _k in missing if str(site).strip().lower() in waiting]}


def avoided_emission_credit_kg(company, year):
    """kg CO2e (negative) that the approved entries of the company's inventory
    year take off the total through factors with a negative value — recycling
    credits for avoided virgin production. 0 when there are none."""
    from django.db.models import Sum
    from emissions.models import EmissionEntry
    if company is None or not year:
        return 0.0
    total = (EmissionEntry.objects.filter(company=company, year=year, status='approved',
                                          emission_factor__factor_kg_co2e__lt=0)
             .aggregate(t=Sum('calculated_co2e_kg'))['t'])
    return float(total or 0)


def factor_reference_years(company, year):
    """[(name_tr, name_en, factor year)] of the catalog factors this
    inventory's approved entries use whose reference year is not the
    reporting year — used as an estimate and said so in the report."""
    from emissions.models import EmissionEntry
    if company is None or not year:
        return []
    rows = (EmissionEntry.objects.filter(company=company, year=year, status='approved')
            .exclude(emission_factor__slug__startswith='calculated-')
            .exclude(emission_factor__year=year)
            .values_list('emission_factor__name_tr', 'emission_factor__name', 'emission_factor__year')
            .distinct())
    return sorted({(tr or en, en, y) for tr, en, y in rows if y}, key=lambda r: (r[2], r[1]))


def _market_code(country):
    """A country as the electricity market it stands for: 'TR' for every
    spelling of Turkey, else the upper-case code."""
    from .serializers import TURKEY_CODES
    code = (country or '').strip().upper()
    return 'TR' if code in TURKEY_CODES else code


def supplier_market_code(A, company=None):
    """The market (country code) the electricity supplier's declaration
    (4A-EF-a) covers: its ef_market answer, or the company's country for
    declarations saved before the question asked it."""
    ans = A.get('4A-EF-a') if isinstance(A.get('4A-EF-a'), dict) else {}
    return _market_code(ans.get('ef_market')) or _market_code(
        getattr(company, 'country_of_headquarters', '') if company else '')



# Catalog codes as they appear in an answer ("EQ-3B-22", "SC-01", "TM-99"),
# with the "#n" of a group of one type ("EQ-3B-22#7").
_NOTE_CODE_RE = re.compile(r'\b((?:EQ-\d[A-Z]|SC|WT|TM|BT|KV|VA|CG|P)-\d{2})(#\d+)?\b')


_NOT_CALCULATED_SUFFIX_RE = re.compile(r'\s+—\s+(?:recorded, not calculated yet|kaydedilir, henüz hesaplanmaz)$')


@functools.lru_cache(maxsize=1)
def _code_words():
    """{code: {'tr', 'en'}} from the survey's own option labels, without the
    code prefix ("EQ-3B-22 — Diesel locomotive" → "Diesel locomotive")."""
    from .answer_text import _labels
    out = {}
    for q in _labels().values():
        option_maps = [q.get('options') or {}] + [f.get('options') or {} for f in (q.get('fields') or {}).values()]
        for options in option_maps:
            for code, words in options.items():
                if _NOTE_CODE_RE.fullmatch(code) and isinstance(words, dict) and code not in out:
                    # Without the code prefix and the questionnaire's
                    # "— recorded, not calculated yet" (the note says why).
                    out[code] = {lg: _NOT_CALCULATED_SUFFIX_RE.sub('', re.sub(
                        r'^\S+\s+[—–-]\s+', '', words.get(lg) or words.get('en') or code)) for lg in ('tr', 'en')}
    return out


# A factor named by its slug in a calculation text: "× 0.469 (turkey-grid-distribution)".
_FACTOR_SLUG_RE = re.compile(r'\(([a-z0-9]+(?:-[a-z0-9]+)+)\)')


@functools.lru_cache(maxsize=512)
def _factor_names(slug):
    from emissions.models import EmissionFactor
    f = EmissionFactor.objects.filter(slug=slug).only('name', 'name_tr').first()
    return {'en': f.name, 'tr': f.name_tr or f.name} if f else None


def readable_text(text, lang):
    """A calculation text as people read it: catalog codes become their names
    ("KV-01" → "Leased office building", "EQ-3B-05#2" → "… (group 2)") and a
    factor slug in brackets becomes the factor's name. Applied where the text
    is shown — the stored description and calc_detail keep the codes, which
    the questionnaire uses to find its entries (technical traceability)."""
    if not text or not isinstance(text, str):
        return text
    words = _code_words()

    def code(m):
        name = words.get(m.group(1), {}).get(lang, m.group(1))
        if m.group(2):
            name += f' ({"grup" if lang == "tr" else "group"} {m.group(2)[1:]})'
        return name

    def slug(m):
        names = _factor_names(m.group(1))
        return f'({names[lang]})' if names else m.group(0)

    return _FACTOR_SLUG_RE.sub(slug, _NOTE_CODE_RE.sub(code, text))


def readable_calc_detail(detail):
    """calc_detail ({'tr', 'en'}) with readable_text in each language."""
    if not isinstance(detail, dict):
        return detail
    return {lg: readable_text(v, lg) for lg, v in detail.items()}


def _readable_notes(notes):
    """Notes as a reader can use them: a catalog code becomes its name
    ("Diesel locomotive", not "EQ-3B-22#7"), and one note per group of the
    same type (twenty "#2 … #20" lines) becomes a single note that says how
    many groups it covers."""
    words = _code_words()
    merged, order = {}, []
    for n in notes:
        groups = {m.group(2) for m in _NOTE_CODE_RE.finditer(n['en']) if m.group(2)}
        key = (n['step_id'], n.get('kind'), _NOTE_CODE_RE.sub(lambda m: m.group(1), n['en']))
        if key not in merged:
            out = dict(n)
            for lg in ('tr', 'en'):
                out[lg] = _NOTE_CODE_RE.sub(lambda m, lg=lg: words.get(m.group(1), {}).get(lg, m.group(1)), n[lg])
            merged[key] = {'note': out, 'count': 0}
            order.append(key)
        merged[key]['count'] += 1 if groups or merged[key]['count'] == 0 else 0
    result = []
    for key in order:
        note, count = merged[key]['note'], merged[key]['count']
        if count > 1:
            note['tr'] += f' ({count} grup)'
            note['en'] += f' ({count} groups)'
        result.append(note)
    return result


# Registered factor units as a user reads them in a note (display only; no stored token or map is touched).
_UNIT_DISPLAY = {'m3': 'm³', 'kwh': 'kWh', 'liters': 'litre', 'kg': 'kg', 'gj': 'GJ'}


def uncalculated_notes(answers, year, company=None):
    """[{step_id, tr, en}] for every answered amount that does not reach the
    dashboard and why — shown right after the answer and listed with the
    inventory's assumptions, so nobody takes a missing number for zero."""
    A = {k: _value(v) for k, v in (answers or {}).items()}
    out = []

    def note(step, tr, en, kind='not_calculated', report_tr=None, report_en=None):
        out.append({'step_id': step, 'tr': tr, 'en': en, 'kind': kind})
        if report_tr and report_en:       # the report prefixes "Not calculated —": its wording must not repeat it
            out[-1].update(report_tr=report_tr, report_en=report_en)

    def open_(step):
        gate = _GATES.get(step)
        return not gate or A.get(gate) in (None, '', 'yes')

    def _has_amount(step):
        """True when the step's own answer carries a numeric amount, mirroring
        the entry extractors' amount detection — a dict answer has an amount
        when any present value yields a number from its '<n> <unit>' string
        (or a row's quantity field), a scalar answer when it parses to one."""
        raw = A.get(step)
        if isinstance(raw, dict):
            if any(_number(row.get('quantity_kg')) or _number(row.get('load_tonne'))
                   or _number(row.get('quantity')) for row in _rows(raw) if isinstance(row, dict)):
                return True
            return any(_number(_split_amount_unit(v)[0]) for v in raw.values()
                       if not isinstance(v, (dict, list)))
        if isinstance(raw, list):
            return any(_number(row.get('quantity_kg')) or _number(row.get('load_tonne'))
                       or _number(row.get('quantity')) for row in _rows(raw) if isinstance(row, dict))
        return bool(_number(_split_amount_unit(raw)[0])) if raw not in (None, '') else False

    # An amount entered after its scope gate was answered 'no' is intentionally
    # dropped by activities_for_report (the user said the source is absent),
    # but a silent zero is indistinguishable from a calculation miss — flag
    # that the figure was not counted because the scope was marked absent.
    # Only when the gate is a non-yes answer AND an amount is actually present;
    # this runs independently of the open_()-guarded blocks below (those only
    # fire when the gate is open), so there is no double-note.
    # Each facility's electricity uses its own country's grid factor; a
    # country without one is not calculated (no other country's grid in its
    # place) until the right factor is set. The app tells the user what to
    # do; the report states the exclusion and its amount.
    # The same kWh stays out of Scope 3 Category 3 (upstream electricity and
    # T&D losses), and the report says it is pending — not zero consumption.
    if company is not None and open_('4A-1'):
        cat3 = A.get('K3C3-INFO') == 'confirmed'
        for name, code, kwh in sites_without_grid(A, company, year):
            amount_tr, amount_en = _fmt(kwh, 0, 'tr'), _fmt(kwh, 0, 'en')
            out.append({
                'step_id': '4A-1',
                'tr': f'{name} ({code}) elektriği ({amount_tr} kWh) hesaplanmadı — bu ülke için kayıtlı bir '
                      f'elektrik şebekesi faktörü yok'
                      + (' (Kapsam 3 Kategori 3\'e de dahil edilmedi)' if cat3 else '')
                      + '. Tüketim kayıtlı ve tamamlanmayı bekliyor: doğru faktörün belirlenmesi için '
                        'Özel Talep gönderin.',
                'en': f'The electricity of {name} ({code}, {amount_en} kWh) was not calculated — there is no '
                      f'registered electricity grid factor for that country'
                      + (' (also left out of Scope 3 Category 3)' if cat3 else '')
                      + '. The consumption is kept and pending: send a Custom Request so the right '
                        'factor can be set.',
                'report_tr': f'{name} ({code}) elektrik tüketimi ({amount_tr} kWh), bu ülke için kayıtlı bir '
                             f'elektrik şebekesi emisyon faktörü bulunmadığından envantere dahil edilmemiştir'
                             + (' (Kapsam 2 ve Kapsam 3 Kategori 3 — elektrik üretim zinciri ve iletim '
                                'kayıpları)' if cat3 else ' (Kapsam 2)')
                             + '. Bu tüketim, faktör belirlenene kadar tamamlanmayı bekleyen veri olarak '
                               'izlenmektedir; sıfır tüketim anlamına gelmez.',
                'report_en': f'The electricity consumption of {name} ({code}, {amount_en} kWh) is not included '
                             f'in the inventory, as no registered grid emission factor exists for that country'
                             + (' (Scope 2 and Scope 3 Category 3 — upstream electricity and T&D losses)'
                                if cat3 else ' (Scope 2)')
                             + '. It is tracked as pending data until the factor is set; it does not mean '
                               'zero consumption.',
            })

        # Turkey: the official factor follows the grid connection; until it
        # is chosen the facility's electricity waits (here and in Category 3).
        superseded = sites_on_superseded_grid(company, year)
        for name, kwh in sites_pending_connection(A, company, year):
            amount_tr, amount_en = _fmt(kwh, 0, 'tr'), _fmt(kwh, 0, 'en')
            if name in superseded:
                # Saved before the connection-based factors: still counted
                # with the earlier single factor until it is recalculated.
                out.append({
                    'step_id': '4A-1', 'kind': 'method', 'related_steps': ['2A-2'],
                    'tr': f'{name} elektriği ({amount_tr} kWh) hâlâ önceki tek Türkiye şebeke faktörüyle '
                          f'hesaplı; resmi faktör tesisin şebeke bağlantı türüne (iletim / dağıtım) göre değişir. '
                          f'Bağlantı türünü Soru 24\'te veya Ayarlar › Tesisler\'de seçin; envanter yeniden hesaplanır.',
                    'en': f'The electricity of {name} ({amount_en} kWh) is still calculated with the earlier single '
                          f'Turkey grid factor; the official factor depends on the facility\'s grid connection '
                          f'(transmission / distribution). Choose it in Question 24 or Settings › Facilities and the '
                          f'inventory is recalculated.',
                    'report_tr': f'{name} elektrik tüketimi ({amount_tr} kWh), tesisin şebeke bağlantı türü (iletim / '
                                 f'dağıtım) belirtilmediğinden, yerini bağlantı türüne göre resmi faktörlere bırakan '
                                 f'önceki tek Türkiye şebeke faktörüyle hesaplanmıştır (Kapsam 2 ve Kapsam 3 Kategori 3).',
                    'report_en': f'The electricity consumption of {name} ({amount_en} kWh) is calculated with the '
                                 f'earlier single Turkey grid factor, since replaced by the official connection-based '
                                 f'factors, as the facility\'s grid connection (transmission / distribution) is not '
                                 f'given (Scope 2 and Scope 3 Category 3).',
                })
                continue
            out.append({
                'step_id': '4A-1', 'related_steps': ['2A-2'],
                'tr': f'{name} elektriği ({amount_tr} kWh) hesaplanmadı — tesisin şebeke bağlantı türü '
                      f'(iletim / dağıtım) seçilmedi; resmi faktör buna göre değişir. Bağlantı türünü Soru 24\'te '
                      f'veya Ayarlar › Tesisler\'de seçin; tüketim kayıtlı ve tamamlanmayı bekliyor.',
                'en': f'The electricity of {name} ({amount_en} kWh) was not calculated — the facility\'s grid '
                      f'connection (transmission / distribution) is not chosen, and the official factor depends '
                      f'on it. Choose it in Question 24 or Settings › Facilities; the consumption is kept and pending.',
                'report_tr': f'{name} elektrik tüketimi ({amount_tr} kWh), tesisin şebeke bağlantı türü (iletim / '
                             f'dağıtım) belirtilmediğinden envantere dahil edilmemiştir (Kapsam 2 ve Kapsam 3 '
                             f'Kategori 3). Tamamlanmayı bekleyen veridir; sıfır tüketim anlamına gelmez.',
                'report_en': f'The electricity consumption of {name} ({amount_en} kWh) is not included in the '
                             f'inventory, as the facility\'s grid connection (transmission / distribution) is not '
                             f'given (Scope 2 and Scope 3 Category 3). It is pending data, not zero consumption.',
            })
        # Electricity not tied to a facility in Turkey: the distribution
        # factor, as an assumption (owner's decision).
        from .serializers import is_turkish_company
        if is_turkish_company(company):
            facility_of = _facility_lookup(company)
            loose = [a for a in _named_sites(_electricity(A.get('4A-1')), A.get('2A-2'))
                     if facility_of(a.get('facility_name')) is None] if A.get('4A-1') not in (None, '') else []
            if loose:
                note('4A-1', 'Bir tesise bağlı olmayan elektrik tüketimi için şebeke bağlantısı bilinmediğinden '
                             'dağıtım bağlantısı faktörü (0,469 kg CO₂e/kWh, ETKB 2023 veri yılı) varsayılmıştır.',
                     'For electricity not tied to a facility the grid connection is unknown, so the distribution '
                     'connection factor (0.469 kg CO₂e/kWh, ETKB data year 2023) is assumed.', kind='method')

    for step, gate in _GATES.items():
        if A.get(gate) not in (None, '', 'yes') and _has_amount(step):
            note(step,
                 "Bu miktar sayılmadı — ilgili kapsam 'yok' olarak işaretlendi (geçit sorusuna 'hayır').",
                 "This amount was not counted — the scope was marked as not present "
                 "(answer 'no' to its gate question).")

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
        # A fuel amount in a unit its factor is not registered in (LPG / fuel oil in kg: the factors are per
        # litre and no density conversion exists) never becomes an entry: say so, and leave the value as entered.
        from emissions.factor_lookup import ACTIVITY_TO_SLUG, _resolve_unit_and_multiplier
        for fuel, raw in A['3A-5'].items():
            if fuel not in _STATIONARY_FUELS:
                continue
            amount, entered = _split_amount_unit(raw)
            if not _number(amount):
                continue
            unit = _UNIT_ALIASES.get(entered.lower(), entered.lower())    # as _stationary_fuels reads it
            if unit and _resolve_unit_and_multiplier(fuel, unit.replace(' ', ''))[0]:
                continue
            name = _FUEL_NAMES[fuel]
            supported = ', '.join(_UNIT_DISPLAY.get(u, u) for u in sorted({u for a, u in ACTIVITY_TO_SLUG if a == fuel}))
            if not unit:
                note('3A-5', f'{name["tr"]}: miktarın birimi girilmedi — hesaplanmadı. Miktarı birimiyle girin ({supported}).',
                     f'{name["en"]}: no unit was given with the amount — not calculated. Enter the amount with a unit ({supported}).',
                     report_tr=f'{name["tr"]}: miktarın birimi girilmedi. Miktarı birimiyle girin ({supported}).',
                     report_en=f'{name["en"]}: no unit was given with the amount. Enter the amount with a unit ({supported}).')
            elif unit == 'kg' and fuel in ('lpg', 'fuel_oil'):
                note('3A-5', f'{name["tr"]}: kg cinsinden girilen miktar ({amount.strip()} kg) hesaplanmadı — bu yakıtın emisyon '
                             f'faktörü litre başınadır ve yoğunluk dönüşümü yapılmaz. Girilen değer değiştirilmedi; '
                             f'hesaplanması için litre cinsinden girin.',
                     f'{name["en"]}: the amount entered in kg ({amount.strip()} kg) was not calculated — the emission factor '
                     f'for this fuel is per litre and no density conversion is applied. The entered value is unchanged; '
                     f'enter litres to have it calculated.',
                     report_tr=f'{name["tr"]}: kg cinsinden girilen miktar ({amount.strip()} kg) için eşleşen bir emisyon faktörü yok — '
                               f'bu yakıtın faktörü litre başınadır ve yoğunluk dönüşümü yapılmaz. Girilen değer değiştirilmedi; '
                               f'hesaplanması için litre cinsinden girin.',
                     report_en=f'{name["en"]}: the amount entered in kg ({amount.strip()} kg) has no matching emission factor — '
                               f'the factor for this fuel is per litre and no density conversion is applied. The entered value is '
                               f'unchanged; enter litres to have it calculated.')
            else:
                note('3A-5', f'{name["tr"]}: "{entered}" bu yakıt için desteklenen bir birim değil — hesaplanmadı. '
                             f'Hesaplanan birimler: {supported}.',
                     f'{name["en"]}: "{entered}" is not a supported unit for this fuel — not calculated. '
                     f'Calculated units: {supported}.',
                     report_tr=f'{name["tr"]}: "{entered}" bu yakıt için desteklenen bir birim değil. '
                               f'Hesaplanan birimler: {supported}.',
                     report_en=f'{name["en"]}: "{entered}" is not a supported unit for this fuel. '
                               f'Calculated units: {supported}.')

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
            amount, entered = _split_amount_unit(raw)
            if _number(amount) and not (kind in _PURCHASED_ENERGY_SLUG and _energy_kwh(raw)):
                label = {'steam': 'Buhar (ton)', 'compressed_air': 'Basınçlı hava'}.get(kind, kind)
                if kind == 'compressed_air':
                    # No factor exists for compressed air in any unit: GJ / MWh would not help.
                    note('4B-2', 'Basınçlı hava: hiçbir birimde (GJ, m³) emisyon faktörü yok — hesaplanmadı. '
                                 'Girilen değer değiştirilmedi.',
                         'Compressed air: not calculated — there is no emission factor for compressed air in any unit '
                         '(GJ, m³). The entered value is unchanged.',
                         report_tr='Basınçlı hava: basınçlı hava için hiçbir birimde (GJ, m³) emisyon faktörü yok. '
                                   'Girilen değer değiştirilmedi.',
                         report_en='Compressed air: there is no emission factor for compressed air in any unit '
                                   '(GJ, m³). The entered value is unchanged.')
                elif not entered:
                    note('4B-2', f'{label}: miktarın birimi girilmedi — hesaplanmadı. GJ veya MWh olarak girin.',
                         f'{label}: no unit was given with the amount — not calculated. Enter GJ or MWh.',
                         report_tr=f'{label}: miktarın birimi girilmedi. GJ veya MWh olarak girin.',
                         report_en=f'{label}: no unit was given with the amount. Enter GJ or MWh.')
                else:
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
            elif gate != '4A-EF' and (problem := supplier_factor_problem(doc, ans, A, year, company)):
                # A factor in no amount's unit, or far outside the reference
                # factor, is not applied — said, not left for a reader to guess.
                note(doc, f'{what_tr} — tedarikçi / tesise özgü faktör kullanılmadı, genel faktör kullanıldı: {problem["tr"]}',
                     f'{what_en} — the supplier / facility-specific factor was not used; the generic factor is used: {problem["en"]}')
            elif gate == '4A-EF':
                # Not a gap: the answer is used, in the market-based result —
                # only for the sites in the market the declaration covers.
                mkt = supplier_market_code(A, company) or '—'
                note(doc, 'Elektrik tedarikçi faktörü yalnızca piyasa bazlı Kapsam 2 sonucunda kullanılır; '
                          'envanter toplamı konum bazlıdır (her tesisin kendi ülkesinin şebeke faktörü). '
                          f'Beyan {mkt} pazarını kapsar; başka ülkedeki tesislere uygulanmaz. '
                          'İki sonuç ayrı raporlanır, toplanmaz.',
                     'The electricity supplier factor is used only in the market-based Scope 2 result; the '
                     'inventory total is location-based (each facility\'s own country grid). '
                     f'The declaration covers the {mkt} market and is not applied to facilities in other '
                     'countries. The two results are reported separately, never added together.', kind='method')

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
            elif cat in ('SC-01', 'SC-02') and (chosen := materials.get(cat)) and chosen not in MATERIAL_SLUG:
                # Only warn once the material TYPE (K3C1-3m) has actually been
                # answered with something off-catalog. A falsy chosen (None/'')
                # means the type step is still unanswered — the quantity is
                # pending by design (type is asked after quantity), so stay
                # silent rather than show a misleading "no material chosen" note.
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
            elif not any(a['label']['tr'].startswith(f'{row.get("category")} · {str(row.get("supplier") or "").strip()} (')
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
        operational = (A.get('D3') or {}).get('boundary_approach') == 'operational_control' \
            if isinstance(A.get('D3'), dict) else False
        scope12_sites = _scope12_sites(A)
        scope12_energy = _has_scope12_energy(A)
        site_of = _facility_lookup(company) if company else (lambda _n: None)
        for row in _rows(A.get('K3C8-1')):
            kv = str(row.get('asset_type') or '')
            has_kwh = _true(row.get('owner_declaration')) and _number(row.get('declaration_kwh'))
            counted = _leased_already_counted(row, scope12_sites)
            if counted == 'facility':
                # The answer said "not in Scope 1/2", but the facility it names is:
                # the inventory's own entries decide, so it is not counted twice.
                site = str(row.get('facility')).strip()
                note('K3C8-1', f'{kv} ({site}): {site} tesisinin enerjisi Kapsam 1/2\'de zaten raporlandığı için '
                               'Kategori 8\'de tekrar sayılmadı (cevaptaki "Hayır" yerine envanterdeki kayıtlar '
                               'esas alındı).',
                     f'{kv} ({site}): not counted again in Category 8 — the energy of {site} is already '
                     'reported in Scope 1/2 (the inventory\'s own entries were used instead of the "No" answer).',
                     kind='method')
                continue
            if counted == 'declared':
                # Not a gap: its emissions are in the inventory, in Scope 1/2.
                note('K3C8-1', f'{kv}: enerjisi Kapsam 1/2\'de (tesis olarak) raporlandığı için Kategori 8\'de '
                               'tekrar sayılmadı.',
                     f'{kv}: not counted again in Category 8 — its energy is already reported in Scope 1/2 '
                     'as one of the sites.', kind='method')
                continue
            linked = str(row.get('facility') or '').strip()
            if linked and operational and site_of(linked) is not None:
                # A registered site whose energy is not in Scope 1/2 (yet): counted here
                # so nothing is lost, and the answer is told where it belongs.
                note('K3C8-1', f'{kv} ({linked}): kayıtlı tesisinizdir; İşletme Kontrolü yaklaşımında enerjisi '
                               'Kapsam 1/2\'dedir. Elektriğini Soru 68\'e girin; girildiğinde burada otomatik '
                               'olarak tekrar sayılmaz.',
                     f'{kv} ({linked}): a registered site; under Operational Control its energy belongs in '
                     'Scope 1/2. Enter its electricity in Question 68 — it is then excluded here automatically.',
                     kind='method')
            reasons = leased_review_reasons(row, operational, scope12_energy)
            if 'operational_control' in reasons:
                # Saved before the question asked it: still counted, but under
                # Operational Control a leased building the company uses is
                # normally one of its sites — say so instead of guessing.
                note('K3C8-1', f'{kv}: İşletme Kontrolü yaklaşımında kiralık ve işlettiğiniz bir bina genellikle '
                               'tesisleriniz arasındadır ve enerjisi Kapsam 2\'dedir. Soru 97\'de bu varlığın '
                               'Kapsam 1/2\'de raporlanıp raporlanmadığını belirtin; aksi halde iki kez sayılabilir.',
                     f'{kv}: under Operational Control a leased building you use is normally one of your sites '
                     'with its energy in Scope 2. State in Question 97 whether this asset is already reported in '
                     'Scope 1/2; otherwise it may be counted twice.', kind='method')
            elif 'scope12_energy' in reasons:
                note('K3C8-1', f'{kv}: envanteriniz Kapsam 1/2 enerjisi bildiriyor; bu kiralık varlık bir tesise '
                               'bağlı değil ve Soru 97 yanıtlanmamış. Burada sayılıyor ancak Kapsam 1/2 ile çakışabilir: '
                               'varlığı kayıtlı bir tesise bağlayın veya Kapsam 1/2\'de olup olmadığını belirtin.',
                     f'{kv}: your inventory reports Scope 1/2 energy; this leased asset is not linked to a facility '
                     'and Question 97 was not answered. It is counted here but may overlap with Scope 1/2 — link it '
                     'to a registered facility or state whether it is already in Scope 1/2 (it may be counted twice).',
                     kind='method')
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
        # What was recorded, and why it is not in the totals — the category
        # is applicable, its emissions are just not known.
        count = _fmt(_number(A['K3C14-2'].get('franchise_count')), 0, 'en')
        area = _number(A['K3C14-2'].get('total_area_m2'))
        area_en = f', {_fmt(area, 0, "en")} m²' if area else ''
        area_tr = f', {_fmt(area, 0, "tr")} m²' if area else ''
        note('K3C14-2', f'Franchise işletmeleri ({_fmt(_number(A["K3C14-2"].get("franchise_count")), 0, "tr")} işletme'
                        f'{area_tr}): işletmelerin emisyon verisi olmadığı ve onaylı alan bazlı bir faktör '
                        'bulunmadığı için hesaplanmadı. Kategori geçerlidir; emisyonu bilinmiyor.',
             f'Franchises ({count} outlets{area_en}): not calculated — the franchisees have no emission data and '
             'there is no approved per-area factor. The category applies; its emissions are not known.')
    if A.get('K3C14-0') == 'yes':
        ans = A.get('K3C14-1')
        given = ans.get('total_tco2e') if isinstance(ans, dict) else None
        if str(given if given is not None else '').strip() == '':
            # Franchises are declared, their emissions are not: unknown, not none.
            note('K3C14-1', 'Franchise işletmeleri beyan edildi ancak toplam emisyon (tCO₂e) girilmedi; '
                            'hesaplanmadı. Kategori geçerlidir; emisyonu bilinmiyor.',
                 'Franchises are declared but their total emissions (tCO2e) were not given — not calculated. '
                 'The category applies; its emissions are not known.')
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
    return _readable_notes(out)
