"""
P2.2 Factor-Aware Registry

Build calculation schemas dynamically from EmissionFactor database.
Instead of hardcoding 15 schemas, generate them from actual factors.

This enables:
- 100+ activities to work in chat without hardcoding
- New factors automatically supported
- Minimal required questions per activity
"""

from emissions.factor_lookup import ACTIVITY_TO_SLUG, resolve_factor_and_amount


def get_minimal_questions_for_activity(activity_type: str, unit: str) -> dict:
    """
    Return minimal required questions for an activity.

    Examples:
    - vehicle_distance + km → need [vehicle_type, fuel_type, vehicle_count, distance_basis]
    - electricity + kwh → only [quantity]
    - waste + kg → [waste_method, quantity]
    """

    # Special cases that need more context
    special_mappings = {
        ('vehicle_distance', 'km'): {
            'required': ['vehicle_type', 'fuel_type', 'quantity', 'unit'],
            'ambiguity': ['distance_basis'],  # For vehicle_count > 1
        },
        ('stationary_fuel', 'liters'): {
            'required': ['fuel_type', 'quantity', 'unit'],
        },
        ('electricity', 'kwh'): {
            'required': ['quantity', 'unit'],
        },
        ('waste', 'kg'): {
            'required': ['waste_method', 'quantity', 'unit'],
        },
        ('flight', 'km'): {
            'required': ['flight_type', 'quantity', 'unit'],
        },
        ('freight', 'tonne-km'): {
            'required': ['transport_mode', 'quantity', 'unit'],
        },
        ('commuting', 'km'): {
            'required': ['commute_mode', 'quantity', 'unit'],
        },
        ('water', 'm3'): {
            'required': ['water_type', 'quantity', 'unit'],
        },
    }

    key = (activity_type, unit)
    if key in special_mappings:
        return special_mappings[key]

    # Generic fallback: only quantity required
    return {
        'required': ['quantity', 'unit'],
        'questions': {
            'quantity': {'text': f'How much {activity_type}?'},
            'unit': {'text': f'Unit? (typically {unit})'},
        }
    }


def get_factor_coverage_report() -> dict:
    """
    Report on how many activities are covered by factors.
    Used for diagnostics.
    """
    activities = {}

    for (activity, unit) in ACTIVITY_TO_SLUG.keys():
        if activity not in activities:
            activities[activity] = []
        activities[activity].append(unit)

    return {
        'total_activity_types': len(activities),
        'total_combos': len(ACTIVITY_TO_SLUG),
        'activities': activities,
    }


def is_activity_supported_in_chat(activity_type: str, unit: str) -> bool:
    """Check if activity+unit combo is in the factor database."""
    return (activity_type, unit) in ACTIVITY_TO_SLUG


def get_suggested_units_for_activity(activity_type: str) -> list:
    """Return all units available for an activity."""
    return sorted(set(u for (a, u) in ACTIVITY_TO_SLUG.keys() if a == activity_type))


if __name__ == '__main__':
    # Quick diagnostic
    report = get_factor_coverage_report()
    print(f"Factor Coverage: {report['total_activity_types']} activity types")
    print(f"Total combos: {report['total_combos']}")
    print("\nSample activities:")
    for activity, units in list(report['activities'].items())[:5]:
        print(f"  {activity}: {units}")
