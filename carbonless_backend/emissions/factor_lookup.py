"""
Single resolver for turning a human-described activity (type + quantity + unit)
into a real, registered EmissionFactor and a saved EmissionEntry.

This exists because the AI chat (chat/views.py) and the guided questionnaire
(questionnaire/views.py) each used to keep their own copy of a fuel→slug map and
their own unit-matching logic — both had the same bug: looking up a factor by
slug alone, with no check that the factor's actual unit matched the activity's
unit, so a distance-based activity (km) could silently get multiplied by an
energy-based factor (kgCO2e/GJ) meant for a completely different unit.

ACTIVITY_TO_SLUG pins each (activity_type, unit) pair to an exact slug, so a
matching row is guaranteed to be in the same unit — no runtime conversion
guessing, and no `slug__icontains` fuzzy fallback that could match the wrong row.
"""
from decimal import Decimal, InvalidOperation

from .models import EmissionFactor, EmissionEntry

# (activity_type, normalized_unit) -> EmissionFactor.slug
ACTIVITY_TO_SLUG = {
    ('natural_gas', 'm3'):  'natural-gas-m3',
    ('natural_gas', 'kwh'): 'natural-gas-kwh',
    ('natural_gas', 'gj'):  'natural-gas',
    ('diesel', 'liters'):   'diesel',
    ('diesel', 'kwh'):      'diesel-kwh',
    ('lpg', 'liters'):      'lpg',
    ('fuel_oil', 'liters'): 'fuel-oil',
    ('coal', 'kg'):         'coal',
    ('petrol', 'gj'):       'motor-gasoline',
    ('petrol', 'liters'):   'gasoline-generic',
    ('electricity', 'kwh'): 'turkey-grid',
    ('road_travel', 'km'):        'road-travel',
    ('car_rental', 'km'):         'road-travel',
    ('flight_domestic', 'km'):    'flight-domestic',
    ('flight_short_haul', 'km'):  'flight-short',
    ('flight_medium_haul', 'km'): 'flight-medium',
    ('flight_long_haul', 'km'):   'flight-long',
    ('train', 'km'):              'train',
    ('truck_freight', 'tonne-km'): 'truck-freight',
    ('rail_freight', 'tonne-km'):  'rail-freight',
    ('sea_freight', 'tonne-km'):   'sea-freight',
    ('air_freight', 'tonne-km'):   'air-freight',
}

# Same-quantity unit synonyms — only exact dimensional equivalents (litre == liters,
# tonne == 1000 kg). Anything requiring a fuel-specific conversion (e.g. m³ → GJ,
# which depends on calorific value) must NOT be added here; it belongs in
# ACTIVITY_TO_SLUG as its own real, registered unit instead of a guessed conversion.
UNIT_SYNONYMS = {
    'm³': 'm3', 'm^3': 'm3',
    'litre': 'liters', 'liter': 'liters', 'l': 'liters',
    'pkm': 'km', 'tkm': 'tonne-km',
}


def resolve_factor(activity_type, unit):
    """
    Resolves (activity_type, unit) to a real EmissionFactor, preferring the
    Turkey-specific row and falling back to global. Returns (factor, normalized_unit, error).
    """
    activity_type = (activity_type or '').strip().lower().replace(' ', '_')
    raw_unit = (unit or '').strip().lower().replace(' ', '')
    norm_unit = UNIT_SYNONYMS.get(raw_unit, raw_unit)

    # Same-quantity mass conversion (tonne -> kg) when only the kg slug is registered
    if norm_unit == 'tonne' and (activity_type, 'kg') in ACTIVITY_TO_SLUG:
        norm_unit = 'kg'

    slug = ACTIVITY_TO_SLUG.get((activity_type, norm_unit))
    if not slug:
        supported = sorted({u for (a, u) in ACTIVITY_TO_SLUG if a == activity_type})
        if supported:
            return None, norm_unit, (
                f"No registered emission factor for '{activity_type}' in unit '{unit}'. "
                f"This activity is only available in: {', '.join(supported)}."
            )
        return None, norm_unit, f"'{activity_type}' is not a supported activity type yet."

    factor = (
        EmissionFactor.objects.filter(slug=slug, country='turkey', is_active=True, is_default=True).first()
        or EmissionFactor.objects.filter(slug=slug, country='global', is_active=True, is_default=True).first()
    )
    if not factor:
        return None, norm_unit, f"No active emission factor found for '{activity_type}' ({unit})."
    return factor, norm_unit, None


def resolve_factor_and_amount(activity_type, quantity, unit):
    """
    Resolves (activity_type, unit) to a real factor AND normalizes quantity for any
    same-dimension conversion (e.g. tonne -> kg) the resolved unit required.
    Returns (factor, normalized_quantity, co2e_kg, error).
    """
    try:
        qty = Decimal(str(quantity))
    except (InvalidOperation, TypeError, ValueError):
        return None, None, None, f'Invalid quantity: {quantity!r}.'
    if qty <= 0:
        return None, None, None, 'Quantity must be greater than zero.'

    norm_unit_for_mass = (unit or '').strip().lower()
    factor, norm_unit, error = resolve_factor(activity_type, unit)
    if error:
        return None, None, None, error
    if norm_unit_for_mass == 'tonne' and norm_unit == 'kg':
        qty = qty * 1000

    return factor, qty, qty * factor.factor_kg_co2e, None


def create_entry_from_activity(user, company, activity_type, quantity, unit, year, month, description=''):
    """
    Resolves the activity to a real factor and creates the EmissionEntry.
    This is the ONLY place that should call EmissionEntry.objects.create() for
    AI/questionnaire-derived data, so every calculation path (chat, guided
    questionnaire) produces numbers that agree with each other and with the
    dashboard, which reads the same EmissionEntry rows.
    Returns (entry, error_message).
    """
    if not company:
        return None, 'No company found. Please create a company first.'

    factor, qty, co2e_kg, error = resolve_factor_and_amount(activity_type, quantity, unit)
    if error:
        return None, error

    entry = EmissionEntry.objects.create(
        user=user,
        company=company,
        emission_factor=factor,
        year=year,
        month=month,
        quantity=qty,
        calculated_co2e_kg=co2e_kg,
        description=description or f'{activity_type} {quantity} {unit}',
        factor_value_snapshot=factor.factor_kg_co2e,
        factor_source_snapshot=factor.source,
        status='approved',
    )
    return entry, None


def get_emission_factor_reference():
    """
    RAG context block: the real, currently-registered emission factor for every
    activity type this system supports, read live from the DB so any AI prompt
    that includes it always cites (and the backend always uses) the actual
    current value — never a stale hardcoded number.
    """
    try:
        lines = ['', '--- EMISSION FACTOR REFERENCE (use ONLY these values — never your own training data) ---']
        by_activity = {}
        for (activity, unit), slug in ACTIVITY_TO_SLUG.items():
            by_activity.setdefault(activity, []).append((unit, slug))

        for activity in sorted(by_activity):
            for unit, slug in by_activity[activity]:
                factor = (
                    EmissionFactor.objects.filter(slug=slug, country='turkey', is_active=True, is_default=True).first()
                    or EmissionFactor.objects.filter(slug=slug, country='global', is_active=True, is_default=True).first()
                )
                if not factor:
                    continue
                lines.append(
                    f'  - activity_type="{activity}", unit="{unit}": '
                    f'{factor.factor_kg_co2e} kgCO2e/{unit} (source: {factor.get_source_display()})'
                )
        lines.append('--- END EMISSION FACTOR REFERENCE ---')
        return '\n'.join(lines)
    except Exception:
        return ''
