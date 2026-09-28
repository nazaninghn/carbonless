"""
Turn questionnaire answers into EmissionEntry rows.

Only questions that really ask for an activity amount create entries. The old
code treated every number in any Scope 1/2 step as a consumption amount, so
e.g. a supplier EF document (value 5, year 2026) became "2031 kWh natural gas",
the unit electricity price became kWh of grid electricity, and Scope 3 answers
(step ids K3…) never produced anything.

This module does not choose or change any emission factor. Each answer is
matched to an EmissionFactor that is already registered:
  - 3A-5  per fuel type the user picked -> emissions.factor_lookup (same as chat)
  - 4A-1  electricity per site           -> emissions.factor_lookup
  - K3C4-2 / K3C9-1 transport rows       -> the CarbonIQ catalog factor whose
    slug is the TM code (tm-01, tm-01-ds …), in tonne-km = load × distance
  - K3C5-2 waste rows                    -> the catalog factor whose slug is the
    WT code + disposal method (wt-01-landfill …), in kg
An answer without a registered factor is skipped, never guessed.
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
    """The activity amounts a step's answer reports; [] for any other question."""
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


def _factor_by_slug(slug):
    from emissions.models import EmissionFactor
    return (
        EmissionFactor.objects.filter(slug=slug, country='turkey', is_active=True, is_default=True).first()
        or EmissionFactor.objects.filter(slug=slug, country='global', is_active=True, is_default=True).first()
    )


def _resolve(activity):
    """(factor, quantity Decimal, co2e_kg Decimal) for one activity, or None."""
    from emissions.factor_lookup import resolve_factor_and_amount
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
        activity['activity'], activity['quantity'], activity['unit'])
    if error:
        logger.info('Questionnaire activity skipped (%s): %s', activity, error)
        return None
    return factor, qty, co2e


def _step_entries(company, year, step_id):
    """Entries earlier saves of this step created ("Questionnaire step 4A-1",
    "Questionnaire step 4A-1 · …") — but not those of 4A-1a."""
    from django.db.models import Q
    from emissions.models import EmissionEntry
    base = f'{DESCRIPTION_PREFIX} {step_id}'
    return EmissionEntry.objects.filter(company=company, year=year).filter(
        Q(description=base) | Q(description__startswith=base + ' · '))


def sync_step_entries(user, company, report, step_id, data):
    """
    Replace the entries this questionnaire step created with what its current
    answer reports. Re-answering a step (or going back and changing it)
    therefore never leaves stale or duplicate rows. Returns the new entries.
    """
    from emissions.models import EmissionEntry
    from emissions.factor_lookup import _get_entry_status
    from emissions.notifications import notify_entry_submitted
    if not company:
        return []
    year = report.reporting_year or 2024
    # Same approval rule as the form and the chat: an owner/admin/manager's
    # answers count at once, a data-entry member's wait for approval.
    status = _get_entry_status(user, company)
    activities = activities_for_step(step_id, data)
    resolved = [(a, _resolve(a)) for a in activities]

    _step_entries(company, year, step_id).delete()

    base = f'{DESCRIPTION_PREFIX} {step_id}'
    many = len(resolved) > 1
    created = []
    for activity, result in resolved:
        if not result:
            continue
        factor, qty, co2e = result
        description = f'{base} · {activity["label"]}' if many and activity['label'] else base
        created.append(EmissionEntry.objects.create(
            user=user,
            company=company,
            emission_factor=factor,
            year=year,
            month=1,  # annual questionnaire data
            quantity=qty,
            calculated_co2e_kg=co2e,
            description=description,
            factor_value_snapshot=factor.factor_kg_co2e,
            factor_source_snapshot=factor.source,
            status=status,
        ))
    for entry in created:
        notify_entry_submitted(entry)  # no-op unless the entry awaits approval
    return created
