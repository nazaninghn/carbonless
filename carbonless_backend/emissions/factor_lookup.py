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

from django.db import DataError

from .models import EmissionFactor, EmissionEntry

# DB column ceilings (emissions/models.py :: EmissionEntry):
#   quantity          = DecimalField(max_digits=14, decimal_places=4) -> integer part < 1e10
#   calculated_co2e_kg = DecimalField(max_digits=16, decimal_places=4) -> integer part < 1e12
# A value whose integer part reaches these would overflow on save() and raise
# decimal.InvalidOperation; we reject it cleanly here instead. These are the
# post-conversion ceilings — the check runs after any unit multiplier is applied.
MAX_QUANTITY = Decimal('1e10')
MAX_CO2E_KG = Decimal('1e12')

# Stable sentinel so the chat layer (chat/views.py :: confirm_entry) can tell
# an over-capacity rejection apart from any other resolver/creation error and
# attach a bilingual message with code 'amount_too_large'.
AMOUNT_TOO_LARGE_ERROR = (
    'AMOUNT_TOO_LARGE: the amount is too large to record — please check the value.'
)
try:
    from .scope3_categories import SCOPE3_CATEGORIES
except ImportError:
    SCOPE3_CATEGORIES = {}

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

# Same-quantity unit synonyms — pure spelling/notation normalization, no scaling
# (litre and liters are literally the same quantity). Anything requiring a
# fuel-specific conversion (e.g. m³ → GJ, which depends on calorific value)
# must NOT be added here; it belongs in ACTIVITY_TO_SLUG as its own real,
# registered unit instead of a guessed conversion.
UNIT_SYNONYMS = {
    'm³': 'm3', 'm^3': 'm3',
    'litre': 'liters', 'liter': 'liters', 'l': 'liters',
    'pkm': 'km', 'tkm': 'tonne-km',
    # 'kw' and bare 'kilowatt' are deliberately NOT here — kW is a power
    # (rate) unit, not the kWh energy unit these factors are registered in,
    # and treating them as the same quantity would silently miscalculate.
    'kilowatthour': 'kwh', 'kilowatthours': 'kwh',
}

# Fixed, real-world dimensional conversions: qty_in_to_unit = qty_in_from_unit * multiplier.
# Applied only when the FROM unit has no registered factor for the activity but
# the TO unit does — e.g. a user reports "5 MWh" for an activity only registered
# in kWh. Every multiplier here is an exact physical/SI conversion, not a
# fuel-specific energy-content guess (those still belong in ACTIVITY_TO_SLUG as
# their own registered unit). US gallon and US ton (short ton) are used, since
# that's the more common casual-English usage this system's users default to.
UNIT_CONVERSIONS = {
    ('g', 'kg'): Decimal('0.001'),
    ('lb', 'kg'): Decimal('0.45359237'),
    ('lbs', 'kg'): Decimal('0.45359237'),
    ('tonne', 'kg'): Decimal('1000'),
    ('wh', 'kwh'): Decimal('0.001'),
    ('mwh', 'kwh'): Decimal('1000'),
    ('gwh', 'kwh'): Decimal('1000000'),
    ('mile', 'km'): Decimal('1.609344'),
    ('miles', 'km'): Decimal('1.609344'),
    ('gallon', 'liters'): Decimal('3.785411784'),
    ('gallons', 'liters'): Decimal('3.785411784'),
    # water schema offers "litres" as a unit option, but water factors are
    # only registered in m3 — without this, every litres-based water entry
    # failed with "no registered factor" (found while auditing all schema
    # unit options across scopes 1/2/3).
    ('liters', 'm3'): Decimal('0.001'),
    # freight schema offers "kg_km" as a unit option, but freight factors are
    # only registered in tonne-km (same audit as above).
    ('kg_km', 'tonne-km'): Decimal('0.001'),
}


def _resolve_unit_and_multiplier(activity_type, raw_unit):
    """
    Finds a registered unit for (activity_type, raw_unit), trying the unit
    as-is (after spelling normalization) first, then any real dimensional
    conversion that lands on a registered unit for this activity.
    Returns (matched_unit, multiplier) or (None, None) if nothing matches —
    multiplier is 1 when no scaling was needed.
    """
    norm_unit = UNIT_SYNONYMS.get(raw_unit, raw_unit)
    if (activity_type, norm_unit) in ACTIVITY_TO_SLUG:
        return norm_unit, Decimal('1')

    for (from_unit, to_unit), mult in UNIT_CONVERSIONS.items():
        if from_unit == norm_unit and (activity_type, to_unit) in ACTIVITY_TO_SLUG:
            return to_unit, mult
    return None, None


# Electricity grid factor for a company based outside Turkey, by the ISO code
# of its headquarters country. EU members without their own grid factor use
# the EU average; anything else the global grid average.
GRID_BY_COUNTRY = {
    'GB': 'uk-grid', 'UK': 'uk-grid', 'US': 'us-grid', 'CN': 'china-grid', 'DE': 'germany-grid',
    'FR': 'france-grid', 'IN': 'india-grid', 'JP': 'japan-grid', 'BR': 'brazil-grid',
    'AU': 'australia-grid', 'CA': 'canada-grid', 'KR': 'south-korea-grid',
    'SA': 'saudi-arabia-grid', 'AE': 'uae-grid',
}
EU_COUNTRIES = {
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'GR', 'HU', 'IE', 'IT', 'LV',
    'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
}


# A facility's electricity uses its own country's grid factor. A country
# without one is not calculated (no EU / global average, no headquarters
# grid in its place) until the right factor is set — e.g. via a custom
# request.
FACILITY_GRID_MISSING = 'facility_grid_missing'


def facility_grid_slug(country):
    """The grid factor slug for a facility in `country` (a country code), or
    None when that country has no registered grid factor of its own."""
    from questionnaire.serializers import TURKEY_CODES
    code = (country or '').strip().upper()
    if not code:
        return None
    if code in TURKEY_CODES:
        return 'turkey-grid'
    return GRID_BY_COUNTRY.get(code)


# Turkey: the official consumption factor depends on the grid connection.
TURKEY_GRID_BY_CONNECTION = {'transmission': 'turkey-grid-transmission',
                             'distribution': 'turkey-grid-distribution'}
# Electricity not tied to a facility (no connection known) — the owner's
# decision: the distribution factor, stated as an assumption.
TURKEY_GRID_DEFAULT = 'turkey-grid-distribution'
TURKEY_GRID_SLUGS = {'turkey-grid', *TURKEY_GRID_BY_CONNECTION.values()}


def turkey_grid_slug(connection):
    """The Turkish grid factor slug of a grid connection, or None."""
    return TURKEY_GRID_BY_CONNECTION.get((connection or '').strip())


def pick_factor(slug, country=None, year=None):
    """The active default factor of `slug` (and country) for an inventory
    year: that year's row, else the latest earlier one, else the earliest —
    the report states the reference year of a factor of another year."""
    qs = EmissionFactor.objects.filter(slug=slug, is_active=True, is_default=True)
    if country:
        qs = qs.filter(country=country)
    rows = list(qs.order_by('year', 'pk'))
    if not rows:
        return None
    try:
        y = int(year) if year else None
    except (TypeError, ValueError):
        y = None
    if y is None:
        return rows[-1]
    earlier = [r for r in rows if r.year <= y]
    return earlier[-1] if earlier else rows[0]


def facility_grid_missing_message(facility, lang='en', year=None):
    name = getattr(facility, 'name', '') or ''
    code = (getattr(facility, 'country', '') or '').strip().upper()
    req = _approved_location_request(facility, year)
    if req is not None:
        # The factor is already approved: it applies to this facility's
        # electricity in the inventory, so asking for another request would
        # send the user in a circle.
        per = f'{float(req.approved_factor_kg_co2e):g}'
        if lang == 'tr':
            return (f'{name} tesisinin {year} elektrik faktörü Özel Talep #{req.pk} ile onaylandı '
                    f'({per.replace(".", ",")} kg CO₂e/kWh). Bu faktör envanterin elektrik sorusunda (Soru 68) '
                    f'uygulanır; bu tesisin elektrik tüketimini orada girin veya güncelleyin.')
        return (f'The {year} electricity factor of {name} was approved with Custom Request #{req.pk} '
                f'({per} kg CO₂e/kWh). It applies in the inventory\'s electricity question (Q68): enter or '
                f'update this facility\'s electricity consumption there.')
    if facility_grid_slug(code) == 'turkey-grid':
        # In Turkey the factor follows the grid connection, not chosen yet.
        if lang == 'tr':
            return (f'{name} tesisinin şebeke bağlantı türü (iletim / dağıtım) seçilmedi; bu elektrik kaydı '
                    f'hesaplanmadı ve tamamlanmayı bekliyor. Bağlantı türünü Ayarlar › Tesisler\'den veya '
                    f'envanterde Soru 24\'ten seçin.')
        return (f'The grid connection (transmission / distribution) of {name} is not chosen, so this '
                f'electricity was not calculated and is pending. Choose it in Settings › Facilities or in '
                f'Question 24 of the inventory.')
    if lang == 'tr':
        return (f'{name} tesisinin ülkesi ({code}) için kayıtlı bir elektrik şebekesi faktörü yok; '
                f'bu elektrik kaydı hesaplanmadı. Doğru faktörün belirlenmesi için Özel Talep gönderin.')
    return (f'There is no registered electricity grid factor for the country of {name} ({code}), '
            f'so this electricity was not calculated. Send a Custom Request so the right factor can be set.')


def _approved_location_request(facility, year):
    from .models import CustomEmissionRequest
    if facility is None or not getattr(facility, 'pk', None) or not year:
        return None
    try:
        year = int(year)
    except (TypeError, ValueError):
        return None
    return (CustomEmissionRequest.objects
            .filter(facility=facility, year=year, status='approved', electricity_method='location_based',
                    approved_factor_kg_co2e__isnull=False)
            .order_by('-updated_at').first())


def grid_matches_country(factor, country):
    """Whether an electricity grid factor stands for `country` (a facility's
    country code): True / False, or None when it does not apply (not a
    country grid, or no country). Only used to tell the user; the factor
    choice itself is unchanged."""
    from questionnaire.serializers import TURKEY_CODES
    code = (country or '').strip().upper()
    slug = getattr(factor, 'slug', '') or ''
    if not code or not slug:
        return None
    if code in TURKEY_CODES:
        code = 'TR'
    if slug in TURKEY_GRID_SLUGS:
        return code == 'TR'
    if slug == 'eu-grid':
        return code in EU_COUNTRIES
    countries = {c for c, g in GRID_BY_COUNTRY.items() if g == slug}
    if not countries:
        return None
    return code in countries


def _foreign_country(company):
    """HQ country code of a company based outside Turkey, else None."""
    if company is None:
        return None
    from questionnaire.serializers import is_turkish_company
    if is_turkish_company(company):
        return None
    return (company.country_of_headquarters or '').strip().upper()


def resolve_factor(activity_type, unit, company=None, facility=None, year=None):
    """
    Resolves (activity_type, unit) to a real EmissionFactor, preferring the
    Turkey-specific row and falling back to global. For a company based
    outside Turkey (when `company` is given) the global row comes first and
    electricity uses that country's grid factor. With a `facility` that has a
    country, grid electricity uses that country's own grid factor, or returns
    the FACILITY_GRID_MISSING error when it has none — or, in Turkey, when
    the facility's grid connection is not chosen (the factor depends on it).
    Electricity in Turkey without a facility uses the distribution factor.
    A factor with rows of several years is taken for the inventory `year`.
    Returns (factor, normalized_unit, quantity_multiplier, error) — multiplier
    is 1 unless a dimensional conversion (e.g. MWh -> kWh) was needed to reach
    a registered unit.
    """
    activity_type = (activity_type or '').strip().lower().replace(' ', '_')
    raw_unit = (unit or '').strip().lower().replace(' ', '')

    norm_unit, multiplier = _resolve_unit_and_multiplier(activity_type, raw_unit)
    if not norm_unit:
        supported = sorted({u for (a, u) in ACTIVITY_TO_SLUG if a == activity_type})
        if supported:
            return None, raw_unit, None, (
                f"No registered emission factor for '{activity_type}' in unit '{unit}'. "
                f"This activity is only available in: {', '.join(supported)}."
            )
        return None, raw_unit, None, f"'{activity_type}' is not a supported activity type yet."

    slug = ACTIVITY_TO_SLUG[(activity_type, norm_unit)]
    countries = ('turkey', 'global')
    foreign = _foreign_country(company)
    facility_country = (getattr(facility, 'country', '') or '').strip()
    if slug == 'turkey-grid' and facility_country:
        grid = facility_grid_slug(facility_country)
        if grid == 'turkey-grid':
            grid = turkey_grid_slug(getattr(facility, 'grid_connection', ''))
        factor = None
        if grid:
            factor = (pick_factor(grid, 'turkey' if grid in TURKEY_GRID_SLUGS else 'global', year)
                      or pick_factor(grid, None, year))
        if not factor:
            return None, norm_unit, None, FACILITY_GRID_MISSING
        return factor, norm_unit, multiplier, None
    if foreign:
        countries = ('global', 'turkey')
        if slug == 'turkey-grid':
            # The country's own grid, else the EU average for an EU member,
            # else the global grid average — never Turkey's grid.
            candidates = [GRID_BY_COUNTRY.get(foreign), 'eu-grid' if foreign in EU_COUNTRIES else None, 'grid-average']
            for grid in filter(None, candidates):
                if EmissionFactor.objects.filter(slug=grid, country='global', is_active=True, is_default=True).exists():
                    slug = grid
                    break
    elif slug == 'turkey-grid':
        slug = TURKEY_GRID_DEFAULT
    factor = None
    for country in countries:
        factor = pick_factor(slug, country, year)
        if factor:
            break
    if not factor:
        return None, norm_unit, None, f"No active emission factor found for '{activity_type}' ({unit})."
    return factor, norm_unit, multiplier, None


def resolve_factor_and_amount(activity_type, quantity, unit, company=None, facility=None, year=None):
    """
    Resolves (activity_type, unit) to a real factor AND normalizes quantity for
    any dimensional conversion (e.g. tonne -> kg, MWh -> kWh, mile -> km,
    gallon -> liters) the resolved unit required.
    Returns (factor, normalized_quantity, co2e_kg, error).
    """
    try:
        qty = Decimal(str(quantity))
    except (InvalidOperation, TypeError, ValueError):
        return None, None, None, f'Invalid quantity: {quantity!r}.'
    if qty <= 0:
        return None, None, None, 'Quantity must be greater than zero.'

    factor, norm_unit, multiplier, error = resolve_factor(activity_type, unit, company, facility, year)
    if error:
        return None, None, None, error

    # Apply the dimensional conversion BEFORE the capacity check so the ceiling
    # sees the real stored quantity (e.g. "10000 MWh" becomes 1e7 kWh).
    if multiplier and multiplier != 1:
        qty = qty * multiplier

    co2e = qty * factor.factor_kg_co2e
    # Capacity ceiling — the accepted quantity AND the resulting co2e must both
    # fit their DB columns, otherwise EmissionEntry.save() overflows with a
    # decimal.InvalidOperation. Reject cleanly instead of 500ing. This is not a
    # real-world limit: realistic values (e.g. 5,000,000 kWh -> co2e ~2.1e9)
    # pass; a typo'd/malicious "999000000000 kWh" does not.
    if qty >= MAX_QUANTITY or co2e >= MAX_CO2E_KG:
        return None, None, None, AMOUNT_TOO_LARGE_ERROR

    return factor, qty, co2e, None


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


def _get_entry_status(user, company):
    """Determine entry status based on user role in company."""
    try:
        from companies.models import CompanyMembership
        membership = CompanyMembership.objects.filter(user=user, company=company, is_active=True).first()
        if membership and membership.role in ('owner', 'admin', 'manager'):
            return 'approved'
    except Exception:
        pass
    return 'submitted'


def create_entry_from_activity(user, company, activity_type, quantity, unit, year, month, description='', facility=None):
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

    factor, qty, co2e_kg, error = resolve_factor_and_amount(activity_type, quantity, unit, company, facility, year)
    if error:
        if error == FACILITY_GRID_MISSING:
            return None, facility_grid_missing_message(facility, year=year)
        return None, error

    # Belt-and-braces behind the resolver ceiling above: EmissionEntry.save()
    # recomputes co2e from quantity * factor, so any magnitude that still
    # overflows the DB columns raises here — degrade to a clean error, never a 500.
    try:
        entry = EmissionEntry.objects.create(
            user=user,
            company=company,
            emission_factor=factor,
            year=year,
            month=month,
            quantity=qty,
            calculated_co2e_kg=co2e_kg,
            description=description or f'{activity_type} {quantity} {unit}',
            facility=facility,
            factor_value_snapshot=factor.factor_kg_co2e,
            factor_source_snapshot=factor.source,
            status=_get_entry_status(user, company),
        )
        # Company change history (Settings → History) lists chat entries too.
        from accounts.models import ActivityLog
        ActivityLog.objects.create(
            user=user, action='entry_created', target_type='EmissionEntry', target_id=str(entry.id),
            detail=f'{factor.name} · {year}/{int(month):02d} · {format(qty.normalize(), "f") if hasattr(qty, "normalize") else qty} {factor.unit}',
            metadata={'company_id': company.id, 'via': 'chat'},
        )
    except (InvalidOperation, DataError):
        return None, AMOUNT_TOO_LARGE_ERROR
    return entry, None


def get_emission_factor_reference():
    """
    RAG context block: the real, currently-registered emission factor for every
    activity type this system supports, read live from the DB so any AI prompt
    that includes it always cites (and the backend always uses) the actual
    current value — never a stale hardcoded number.

    Kept to ONE compact line per activity (all its units inline, no per-line
    source citation, no category headers). The previous, fully-verbose/grouped
    version of this function — one line per (activity, unit) pair, with a
    header per Scope 3 category and a full source name on every line — grew
    to several thousand tokens once ACTIVITY_TO_SLUG expanded to cover all 15
    Scope 3 categories, and was the single largest contributor to every chat
    request exceeding Groq's per-minute token budget (413 rate_limit_exceeded).
    """
    try:
        lines = ['', 'REGISTERED EMISSION FACTORS (kgCO2e per unit — use ONLY these numbers):']
        by_activity = {}
        for (activity, unit), slug in ACTIVITY_TO_SLUG.items():
            by_activity.setdefault(activity, []).append((unit, slug))

        for activity in sorted(by_activity):
            parts = []
            for unit, slug in by_activity[activity]:
                factor = (
                    EmissionFactor.objects.filter(slug=slug, country='turkey', is_active=True, is_default=True).first()
                    or EmissionFactor.objects.filter(slug=slug, country='global', is_active=True, is_default=True).first()
                )
                if factor:
                    parts.append(f'{unit}={factor.factor_kg_co2e}')
            if parts:
                lines.append(f'{activity}: {" ".join(parts)}')

        return '\n'.join(lines)
    except Exception:
        return ''
