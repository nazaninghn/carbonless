"""
Unit conversion layer for emission calculations.
Converts user input to the unit expected by the emission factor.
"""

# Conversion table: (from_unit, to_unit) -> multiplier
CONVERSIONS = {
    # Energy
    ('mwh', 'kwh'): 1000,
    ('gwh', 'kwh'): 1_000_000,
    ('gj', 'kwh'): 277.778,
    ('kwh', 'gj'): 0.0036,
    ('mwh', 'gj'): 3.6,
    ('mj', 'gj'): 0.001,
    ('btu', 'gj'): 0.000001055,
    ('mmbtu', 'gj'): 1.055,

    # Volume
    ('gallons', 'liters'): 3.78541,
    ('us_gallons', 'liters'): 3.78541,
    ('uk_gallons', 'liters'): 4.54609,
    ('barrels', 'liters'): 158.987,
    ('m3', 'liters'): 1000,

    # Mass
    ('tonne', 'kg'): 1000,
    ('tonnes', 'kg'): 1000,
    ('ton', 'kg'): 1000,
    ('lb', 'kg'): 0.453592,
    ('lbs', 'kg'): 0.453592,
    ('g', 'kg'): 0.001,
    ('mg', 'kg'): 0.000001,

    # Distance
    ('miles', 'km'): 1.60934,
    ('mi', 'km'): 1.60934,
    ('m', 'km'): 0.001,
    ('nm', 'km'): 1.852,  # nautical miles

    # Area
    ('ft2', 'm2'): 0.092903,
    ('sqft', 'm2'): 0.092903,
    ('ha', 'm2'): 10000,
    ('acre', 'm2'): 4046.86,
}


def convert_unit(value, from_unit, to_unit):
    """
    Convert value from one unit to another.
    Returns (converted_value, was_converted).
    If no conversion needed or available, returns original value.
    """
    from_unit = from_unit.lower().strip()
    to_unit = to_unit.lower().strip()

    if from_unit == to_unit:
        return float(value), False

    key = (from_unit, to_unit)
    if key in CONVERSIONS:
        return float(value) * CONVERSIONS[key], True

    # Try reverse
    reverse_key = (to_unit, from_unit)
    if reverse_key in CONVERSIONS:
        return float(value) / CONVERSIONS[reverse_key], True

    # No conversion available
    return float(value), False


def get_supported_conversions(target_unit):
    """Get list of units that can be converted to target_unit."""
    target = target_unit.lower().strip()
    result = [target]
    for (from_u, to_u), _ in CONVERSIONS.items():
        if to_u == target:
            result.append(from_u)
        elif from_u == target:
            result.append(to_u)
    return list(set(result))
