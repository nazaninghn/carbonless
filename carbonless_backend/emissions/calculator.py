"""
GHG Emission Calculator Engine
Based on ISO 14064-1 and GHG Protocol
Supports: Global (Defra 2024 + IPCC) and Turkey (ATOM KABLO + national)
"""
from .models import EmissionFactor


def calculate_emissions(factor_id, activity_data):
    """
    Calculate CO2e emissions.
    Args:
        factor_id: EmissionFactor primary key
        activity_data: float, activity amount in the factor's unit
    Returns:
        dict with emissions_kg, emissions_tonne, factor details
    """
    try:
        factor = EmissionFactor.objects.get(pk=factor_id, is_active=True)
    except EmissionFactor.DoesNotExist:
        return {'error': f'Emission factor {factor_id} not found'}

    emissions_kg = float(activity_data) * float(factor.factor_kg_co2e)
    return {
        'emissions_kg': round(emissions_kg, 4),
        'emissions_tonne': round(emissions_kg / 1000, 6),
        'factor': float(factor.factor_kg_co2e),
        'unit': factor.unit,
        'source_name': factor.name,
        'activity_data': float(activity_data),
        'country': factor.country,
        'category': factor.category,
        'scope': factor.scope,
        'reference': factor.reference,
    }


def get_factors_by_country(country='global'):
    """Get all active emission factors for a country."""
    return EmissionFactor.objects.filter(
        country=country, is_active=True
    ).order_by('scope', 'category', 'name')


def get_available_countries():
    """Returns supported countries."""
    return {
        'global': 'Global average / Defra 2024 + IPCC',
        'turkey': 'Turkey (Türkiye) – ATOM KABLO / national mix',
    }
