"""
GHG Emission Calculator Engine
Based on ISO 14064-1 and GHG Protocol

Lookup: slug + country + category + optional year → default/latest factor
Year is hidden from user by default; system picks best match.
"""
from typing import Optional, Dict, Any
from .models import EmissionFactor
from .unit_converter import convert_unit


def get_emission_factor(
    slug: str,
    country: str,
    category: str,
    year: Optional[int] = None,
) -> Optional[EmissionFactor]:
    """
    Safe year-aware lookup.
    - year=None → is_default first, then latest year
    - year=N   → closest factor with year <= N, fallback to earliest
    """
    qs = EmissionFactor.objects.filter(
        slug=slug, country=country, category=category, is_active=True
    )
    if not qs.exists():
        return None

    if year is None:
        default = qs.filter(is_default=True).order_by('-year').first()
        if default:
            return default
        return qs.order_by('-year').first()

    # Year given: find closest <= year
    valid = qs.filter(year__lte=year).order_by('-year').first()
    if valid:
        return valid
    # Fallback: earliest available
    return qs.order_by('year').first()


def calculate_emissions(factor_id: int, activity_data: float, input_unit: str = None) -> Dict[str, Any]:
    """Calculate CO2e by factor primary key (used by dashboard entry form)."""
    try:
        factor = EmissionFactor.objects.get(pk=factor_id, is_active=True)
    except EmissionFactor.DoesNotExist:
        return {'error': f'Emission factor {factor_id} not found'}

    if activity_data < 0:
        return {'error': 'Activity data cannot be negative'}

    # Unit conversion if needed
    converted_qty = float(activity_data)
    unit_converted = False
    if input_unit and input_unit.lower() != factor.unit.lower():
        converted_qty, unit_converted = convert_unit(activity_data, input_unit, factor.unit)

    emissions_kg = converted_qty * float(factor.factor_kg_co2e)
    result = {
        'emissions_kg': round(emissions_kg, 4),
        'emissions_tonne': round(emissions_kg / 1000, 6),
        'factor_kg_co2e': float(factor.factor_kg_co2e),
        'unit': factor.unit,
        'source_name': factor.name,
        'activity_data': float(activity_data),
        'country': factor.country,
        'category': factor.category,
        'scope': factor.scope,
        'source_dataset': factor.source,
        'factor_year_used': factor.year,
        'reference': factor.reference,
    }
    if unit_converted:
        result['input_unit'] = input_unit
        result['converted_quantity'] = round(converted_qty, 4)
        result['unit_converted'] = True
    return result


def calculate_by_slug(
    slug: str,
    country: str,
    category: str,
    activity_data: float,
    year: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Calculate emissions using slug-based year-aware lookup.
    This is the production API — no factor ID needed.
    """
    factor = get_emission_factor(slug, country, category, year)
    if not factor:
        return {'error': f'Factor not found: {slug}/{country}/{category}'}

    if activity_data < 0:
        return {'error': 'Activity data cannot be negative'}

    emissions_kg = float(activity_data) * float(factor.factor_kg_co2e)
    return {
        'activity_data': float(activity_data),
        'unit': factor.unit,
        'factor_kg_co2e': float(factor.factor_kg_co2e),
        'emissions_kg': round(emissions_kg, 6),
        'emissions_tonne': round(emissions_kg / 1000, 6),
        'slug': factor.slug,
        'country': factor.country,
        'category': factor.category,
        'scope': factor.scope,
        'source_dataset': factor.source,
        'factor_year_used': factor.year,
        'reference': factor.reference,
        'factor_id': factor.pk,
    }


def get_factors_by_country(country='global'):
    """Get all active default emission factors for a country."""
    return EmissionFactor.objects.filter(
        country=country, is_active=True, is_default=True
    ).order_by('scope', 'category', 'name')


def get_available_countries():
    """Returns supported countries."""
    return {
        'global': 'Global average / Defra 2024 + IPCC',
        'turkey': 'Turkey (Türkiye) – ATOM KABLO / national mix',
    }


def validate_emission_factors(factors):
    """Validate a list of factor dicts before seeding."""
    required = {'slug', 'name', 'name_tr', 'scope', 'category', 'country',
                'unit', 'factor_kg_co2e', 'source', 'reference'}
    errors = []
    for i, f in enumerate(factors):
        missing = required - set(f.keys())
        if missing:
            errors.append(f'Factor #{i} ({f.get("slug","?")}) missing: {missing}')
        if f.get('factor_kg_co2e', 0) < 0:
            errors.append(f'Factor #{i} ({f.get("slug","?")}) negative factor')
        if 'year' in f and not isinstance(f['year'], int):
            errors.append(f'Factor #{i} ({f.get("slug","?")}) year must be int')
    return errors
