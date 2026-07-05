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
from .scope3_categories import SCOPE3_CATEGORIES, SCOPE3_GHG_NUMBER

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

    # ─── Scope 3 Full Categories ─────────────────────────────────────────────────

    # Purchased Goods (Cat 1)
    ('purchased_goods_electrical_large', 'kg'): 'electrical-large',
    ('purchased_goods_electrical_small', 'kg'): 'electrical-small',
    ('purchased_goods_electrical_it', 'kg'): 'electrical-it',
    ('purchased_goods_glass', 'kg'): 'glass',
    ('purchased_goods_metal_aluminium', 'kg'): 'metal-aluminium',
    ('purchased_goods_metal_steel', 'kg'): 'metal-steel-cans',
    ('purchased_goods_paper_mixed', 'kg'): 'paper-mixed',
    ('purchased_goods_plastic_average', 'kg'): 'plastic-average',
    ('purchased_goods_plastic_hdpe', 'kg'): 'plastic-hdpe',
    ('purchased_goods_wood', 'kg'): 'wood',
    ('purchased_goods_chemical', 'kg'): 'chemical',
    ('purchased_goods_mineral_oil', 'kg'): 'mineral-oil',

    # Capital Goods (Cat 2)
    ('capital_goods_machinery', 'units'): 'machinery',
    ('capital_goods_vehicles', 'units'): 'vehicles',
    ('capital_goods_buildings', 'm2'): 'buildings',
    ('capital_goods_it_equipment', 'units'): 'it-equipment',

    # Fuel & Energy (Cat 3)
    ('fuel_energy_upstream_electricity', 'kwh'): 'upstream-electricity',
    ('fuel_energy_transmission_losses', 'kwh'): 'transmission-losses',
    ('fuel_energy_fuel_extraction', 'liters'): 'fuel-extraction',

    # Waste (Cat 5)
    ('waste_landfill', 'kg'): 'general-landfill',
    ('waste_recyclable', 'kg'): 'recyclable',
    ('waste_organic_compost', 'kg'): 'organic-compost',
    ('waste_incineration', 'kg'): 'incineration',

    # Employee Commuting (Cat 7)
    ('employee_commuting_car_commute', 'km'): 'car-commute',
    ('employee_commuting_bus_commute', 'km'): 'bus-commute',
    ('employee_commuting_train_commute', 'km'): 'train-commute',
    ('employee_commuting_motorcycle_commute', 'km'): 'motorcycle-commute',
    ('employee_commuting_bicycle_commute', 'km'): 'bicycle-commute',

    # Upstream Leased (Cat 8)
    ('upstream_leased_office_space', 'm2'): 'office-space',
    ('upstream_leased_warehouse', 'm2'): 'warehouse',
    ('upstream_leased_leased_vehicles', 'units'): 'leased-vehicles',

    # Downstream Transport (Cat 9)
    ('downstream_transport_truck_delivery', 'tonne-km'): 'truck-delivery',
    ('downstream_transport_courier', 'packages'): 'courier',
    ('downstream_transport_postal', 'packages'): 'postal',

    # Processing of Sold Products (Cat 10)
    ('processing_sold_energy_intensive', 'kg'): 'processing-energy-intensive',
    ('processing_sold_light', 'kg'): 'processing-light',
    ('processing_sold_chemical', 'kg'): 'processing-chemical',

    # Use of Sold Products (Cat 11)
    ('use_of_sold_electricity', 'kwh'): 'product-electricity-use',
    ('use_of_sold_fuel', 'liters'): 'product-fuel-use',
    ('use_of_sold_gas', 'gj'): 'product-gas-use',

    # End of Life (Cat 12)
    ('end_of_life_product_recycling', 'kg'): 'product-recycling',
    ('end_of_life_product_landfill', 'kg'): 'product-landfill',
    ('end_of_life_product_incineration', 'kg'): 'product-incineration',

    # Downstream Leased (Cat 13)
    ('downstream_leased_leased_building', 'm2'): 'leased-building-downstream',
    ('downstream_leased_leased_equipment', 'units'): 'leased-equipment-downstream',

    # Franchises (Cat 14)
    ('franchises', 'franchises'): 'franchise-operations',

    # Investments (Cat 15)
    ('investments_equity_investments', 'usd'): 'equity-investments',
    ('investments_debt_investments', 'usd'): 'debt-investments',

    # Water
    ('water_water_supply', 'm3'): 'water-supply',
    ('water_water_treatment', 'm3'): 'water-treatment',
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


def resolve_scope3_activity(category, subtype, quantity, unit):
    """
    High-level resolver for Scope 3 activities.  Validates the (category, subtype, unit)
    triple against the SCOPE3_CATEGORIES registry, composes the correct activity_type key,
    and delegates to resolve_factor_and_amount().

    Returns (factor, normalized_quantity, co2e_kg, error) — same signature as
    resolve_factor_and_amount().
    """
    # Normalize inputs
    category = (category or '').strip().lower()
    subtype = (subtype or '').strip().lower()
    unit = (unit or '').strip().lower()

    # 1. Validate category exists
    if category not in SCOPE3_CATEGORIES:
        return None, None, None, f"'{category}' is not a supported Scope 3 category."

    category_meta = SCOPE3_CATEGORIES[category]
    subtypes = category_meta['subtypes']

    # 2. Validate subtype exists for this category
    if subtype not in subtypes:
        supported = sorted(subtypes.keys())
        return None, None, None, (
            f"No registered sub-type '{subtype}' for category '{category}'. "
            f"Supported: {supported}"
        )

    # 3. Validate unit matches expected unit for the subtype
    expected_unit = subtypes[subtype]['unit']
    if unit != expected_unit:
        return None, None, None, (
            f"Unit '{unit}' not valid for '{subtype}'. Expected: '{expected_unit}'"
        )

    # 4. Compose activity_type key — special case for franchises
    if category == 'franchises':
        activity_type = 'franchises'
    else:
        activity_type = f'{category}_{subtype}'

    # 5. Delegate to resolve_factor_and_amount
    return resolve_factor_and_amount(activity_type, quantity, unit)


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

    Output is grouped: Scope 1 & 2 activities first (alphabetical), then
    Scope 3 activities grouped by GHG Protocol category number with headers.
    """
    try:
        lines = ['', '--- EMISSION FACTOR REFERENCE (use ONLY these values — never your own training data) ---']

        # Build a set of all Scope 3 category prefixes for quick membership checks
        scope3_prefixes = set(SCOPE3_CATEGORIES.keys())

        # Separate activities into non-Scope-3 (Scope 1 & 2) and Scope 3
        by_activity = {}
        for (activity, unit), slug in ACTIVITY_TO_SLUG.items():
            by_activity.setdefault(activity, []).append((unit, slug))

        non_scope3_activities = {}
        scope3_activities = {}

        for activity, entries in by_activity.items():
            # An activity belongs to a Scope 3 category if it starts with a category key
            matched_category = None
            for prefix in scope3_prefixes:
                if activity == prefix or activity.startswith(prefix + '_'):
                    matched_category = prefix
                    break
            if matched_category:
                scope3_activities.setdefault(matched_category, {})[activity] = entries
            else:
                non_scope3_activities[activity] = entries

        # --- Scope 1 & 2 activities (alphabetical) ---
        if non_scope3_activities:
            lines.append('')
            lines.append('  [Scope 1 & 2]')
            for activity in sorted(non_scope3_activities):
                for unit, slug in non_scope3_activities[activity]:
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

        # --- Scope 3 activities grouped by category number ---
        # Sort categories by GHG number (water with None goes last)
        sorted_categories = sorted(
            scope3_activities.keys(),
            key=lambda c: (SCOPE3_GHG_NUMBER.get(c, 999), c)
        )

        for category_key in sorted_categories:
            cat_meta = SCOPE3_CATEGORIES[category_key]
            ghg_num = SCOPE3_GHG_NUMBER.get(category_key)
            cat_name = cat_meta['name_en']

            if ghg_num:
                header = f'  [Cat {ghg_num} - {cat_name}]'
            else:
                header = f'  [{cat_name}]'

            lines.append('')
            lines.append(header)

            activities_in_cat = scope3_activities[category_key]
            for activity in sorted(activities_in_cat):
                for unit, slug in activities_in_cat[activity]:
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

        lines.append('')
        lines.append('--- END EMISSION FACTOR REFERENCE ---')
        return '\n'.join(lines)
    except Exception:
        return ''
