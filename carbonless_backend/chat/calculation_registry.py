"""
Calculation Registry — decision engine for guided emission data collection.

Provides schemas for each activity family, normalization utilities, and
step-by-step guided-question logic used by the chat flow.
"""

import copy
import logging
import re
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_MONTH_NAMES = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9, 'oct': 10,
    'october': 10, 'nov': 11, 'november': 11, 'dec': 12, 'december': 12,
}


def resolve_period(value) -> tuple[int, int] | None:
    """Parse a period answer (quick-reply value or free text) into
    (month, year). Returns None if it can't be confidently parsed — the
    guided flow re-asks rather than guessing a date the user didn't give."""
    if not value:
        return None
    now = datetime.now(timezone.utc)
    s = str(value).strip().lower()

    if s in ('this_month', 'this month', 'current_month', 'current month'):
        return now.month, now.year
    if s in ('last_month', 'last month', 'previous_month', 'previous month'):
        month = now.month - 1 or 12
        year = now.year - 1 if now.month == 1 else now.year
        return month, year

    # "2024-03" / "2024/03"
    m = re.match(r'^(\d{4})[-/](\d{1,2})$', s)
    if m:
        year, month = int(m.group(1)), int(m.group(2))
        return (month, year) if 1 <= month <= 12 else None

    # "03/2024" / "03-2024"
    m = re.match(r'^(\d{1,2})[-/](\d{4})$', s)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        return (month, year) if 1 <= month <= 12 else None

    # "march 2024" / "mar 2024" / "march"
    m = re.match(r'^([a-zA-Z]+)\s*(\d{4})?$', s)
    if m and m.group(1) in _MONTH_NAMES:
        month = _MONTH_NAMES[m.group(1)]
        year = int(m.group(2)) if m.group(2) else now.year
        return month, year

    return None

# ---------------------------------------------------------------------------
# Calculation schemas
# ---------------------------------------------------------------------------

CALCULATION_SCHEMAS = {
    "stationary_fuel": {
        "scope": "1",
        "required": ["fuel_type", "quantity", "unit", "period"],
        "questions": {
            "fuel_type": {
                "text": "What type of fuel was burned?",
                "quick_replies": ["natural_gas", "diesel", "lpg", "coal", "fuel_oil"],
            },
            "quantity": {
                "text": "How much fuel was consumed?",
                # No quick-reply numbers — quantity is a precise measurement
                # the user must type themselves, not pick off a guessed list.
                "quick_replies": [],
            },
            "unit": {
                "text": "What unit is the quantity in?",
                "quick_replies": ["kWh", "litres", "kg", "m3", "therms"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
    "vehicle_distance": {
        "scope": "1",
        "required": ["vehicle_type", "fuel_type", "quantity", "unit", "period"],
        "questions": {
            "vehicle_type": {
                "text": "What type of vehicle?",
                "quick_replies": ["car", "van", "motorcycle", "bus", "truck"],
            },
            "fuel_type": {
                "text": "What fuel does the vehicle use?",
                "quick_replies": ["petrol", "diesel", "electric", "hybrid", "lpg"],
            },
            "quantity": {
                "text": "What distance was covered?",
                "quick_replies": [],
            },
            "unit": {
                "text": "What unit is the distance in?",
                "quick_replies": ["km", "miles"],
            },
            "vehicle_count": {
                "text": "How many vehicles?",
                "quick_replies": ["1", "2", "5", "10"],
            },
            "distance_basis": {
                "text": "Is the distance per vehicle or total fleet distance?",
                "quick_replies": ["per_vehicle", "fleet_total"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
    "electricity": {
        "scope": "2",
        "required": ["quantity", "unit", "period"],
        "questions": {
            "quantity": {
                "text": "How much electricity was consumed?",
                "quick_replies": [],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["kWh", "MWh"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
    "purchased_energy": {
        "scope": "2",
        "required": ["activity_type", "quantity", "unit", "period"],
        "questions": {
            "activity_type": {
                "text": "What type of purchased energy?",
                "quick_replies": ["steam", "heating", "cooling"],
            },
            "quantity": {
                "text": "How much energy was purchased?",
                "quick_replies": [],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["kWh", "MWh", "GJ"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
    "waste": {
        "scope": "3",
        "required": ["waste_method", "quantity", "unit", "period"],
        "questions": {
            "waste_method": {
                "text": "How was the waste treated?",
                "quick_replies": ["landfill", "incineration", "recycling", "composting", "anaerobic_digestion"],
            },
            "quantity": {
                "text": "How much waste?",
                "quick_replies": [],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["tonnes", "kg"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
    "flight": {
        "scope": "3",
        "required": ["flight_type", "quantity", "unit", "period"],
        "questions": {
            "flight_type": {
                "text": "What type of flight?",
                "quick_replies": ["domestic", "short_haul", "long_haul", "international"],
            },
            "quantity": {
                "text": "What distance was flown?",
                "quick_replies": [],
            },
            "unit": {
                # "passenger_km" removed — no flight factor is registered in
                # that unit (only km), so offering it as an option always
                # dead-ended in "no registered factor" (found while auditing
                # every schema unit option across scopes 1/2/3).
                "text": "What unit?",
                "quick_replies": ["km", "miles"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
    "freight": {
        "scope": "3",
        "required": ["transport_mode", "quantity", "unit", "period"],
        "questions": {
            "transport_mode": {
                "text": "What transport mode for freight?",
                "quick_replies": ["road", "rail", "sea", "air"],
            },
            "quantity": {
                "text": "What quantity (tonne-km)?",
                "quick_replies": [],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["tonne_km", "kg_km"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
    "commuting": {
        "scope": "3",
        "required": ["commute_mode", "quantity", "unit", "period"],
        "questions": {
            "commute_mode": {
                "text": "What mode of commuting?",
                "quick_replies": ["car", "bus", "train", "bicycle", "walking"],
            },
            "quantity": {
                "text": "What distance commuted?",
                "quick_replies": [],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["km", "miles"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
    "water": {
        "scope": "3",
        "required": ["water_type", "quantity", "unit", "period"],
        "questions": {
            "water_type": {
                "text": "What type of water usage?",
                "quick_replies": ["potable", "wastewater"],
            },
            "quantity": {
                "text": "How much water?",
                "quick_replies": [],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["m3", "litres"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
    "purchased_goods": {
        "scope": "3",
        "required": ["material_type", "quantity", "unit", "period"],
        "questions": {
            "material_type": {
                "text": "What type of material/goods?",
                "quick_replies": ["paper", "plastics", "metals", "textiles", "electronics"],
            },
            "quantity": {
                "text": "What quantity?",
                "quick_replies": [],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["kg", "tonnes"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
    "refrigerant": {
        "scope": "1",
        "required": ["refrigerant_type", "quantity", "unit", "period"],
        "questions": {
            "refrigerant_type": {
                "text": "What type of refrigerant?",
                "quick_replies": ["R-410A", "R-134a", "R-404A", "R-32", "R-22"],
            },
            "quantity": {
                "text": "How much refrigerant was released?",
                "quick_replies": [],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["kg"],
            },
            "period": {
                "text": "Which month and year was this for?",
                "quick_replies": ["this_month", "last_month"],
            },
        },
    },
}

# ---------------------------------------------------------------------------
# Aliases for normalization
# ---------------------------------------------------------------------------

FAMILY_ALIASES = {
    # Fuel-related
    "fuel": "stationary_fuel",
    "fuel_combustion": "stationary_fuel",
    "natural_gas": "stationary_fuel",
    "stationary": "stationary_fuel",
    "boiler": "stationary_fuel",
    # Vehicle
    "vehicle": "vehicle_distance",
    "driving": "vehicle_distance",
    "car": "vehicle_distance",
    "fleet": "vehicle_distance",
    "transport": "vehicle_distance",
    "passenger_vehicle": "vehicle_distance",
    # Electricity
    "electric": "electricity",
    "grid_electricity": "electricity",
    "power": "electricity",
    # Purchased energy
    "steam": "purchased_energy",
    "heating": "purchased_energy",
    "cooling": "purchased_energy",
    "district_heating": "purchased_energy",
    # Waste
    "waste_disposal": "waste",
    "landfill": "waste",
    "incineration": "waste",
    "recycling": "waste",
    # Flight
    "air_travel": "flight",
    "flights": "flight",
    "flying": "flight",
    "aviation": "flight",
    # Freight
    "shipping": "freight",
    "logistics": "freight",
    "goods_transport": "freight",
    # Commuting
    "commute": "commuting",
    "employee_commuting": "commuting",
    # Water
    "water_supply": "water",
    "water_treatment": "water",
    # Purchased goods
    "goods": "purchased_goods",
    "materials": "purchased_goods",
    "procurement": "purchased_goods",
    # Refrigerant
    "refrigerants": "refrigerant",
    "fugitive": "refrigerant",
    "f_gas": "refrigerant",
}

VALUE_ALIASES = {
    # Fuel type aliases
    "petrol": "petrol",
    "gasoline": "petrol",
    "gas": "natural_gas",
    "lng": "natural_gas",
    "oil": "fuel_oil",
    "heavy_fuel_oil": "fuel_oil",
    "propane": "lpg",
    # Vehicle type aliases
    "automobile": "car",
    "sedan": "car",
    "suv": "car",
    "pickup": "van",
    "lorry": "truck",
    "hgv": "truck",
    "motorbike": "motorcycle",
    # Unit aliases
    "kwh": "kWh",
    "mwh": "MWh",
    "kilometers": "km",
    "kilometres": "km",
    "kilometer": "km",
    "liters": "litres",
    "liter": "litres",
    "litre": "litres",
    "cubic_meters": "m3",
    "cubic_metres": "m3",
    "m³": "m3",
    "m^3": "m3",
    "metric_tons": "tonnes",
    "metric_tonnes": "tonnes",
    "ton": "tonnes",
    "tons": "tonnes",
    "tonne": "tonnes",
    "l": "litres",
    "lt": "litres",
    # Waste method aliases
    "landfilling": "landfill",
    "incinerated": "incineration",
    "burned": "incineration",
    "recycled": "recycling",
    "composted": "composting",
    # Flight type aliases
    "short": "short_haul",
    "long": "long_haul",
    "intl": "international",
}


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

def normalize_nlu(nlu_data: dict) -> dict:
    """Normalize NLU output using family/value aliases."""
    result = dict(nlu_data)

    # Normalize activity_family
    family = result.get("activity_family")
    if family and isinstance(family, str):
        normalized_family = FAMILY_ALIASES.get(family.lower().strip(), family)
        result["activity_family"] = normalized_family

    # Normalize value fields
    value_fields = [
        "fuel_type", "vehicle_type", "unit", "waste_method",
        "flight_type", "transport_mode", "commute_mode", "water_type",
        "material_type", "refrigerant_type",
    ]
    for field in value_fields:
        val = result.get(field)
        if val and isinstance(val, str):
            result[field] = VALUE_ALIASES.get(val.lower().strip(), val)

    # Reject an ambiguous/guessed unit instead of silently trusting it — e.g.
    # the NLU model (or the user's raw text) saying "kw" for electricity is a
    # POWER unit, not the kWh ENERGY unit this schema actually expects, and
    # treating them as interchangeable would silently calculate against the
    # wrong quantity. Clearing it here makes get_next_question_field() see
    # "unit" as missing, so the guided flow asks explicitly rather than
    # guessing.
    result_family = result.get("activity_family")
    if result_family and result.get("unit") and not is_valid_unit(result_family, result["unit"], result):
        result["unit"] = None

    return result


# ---------------------------------------------------------------------------
# Schema access
# ---------------------------------------------------------------------------

def get_schema(family: str) -> dict | None:
    """Return the calculation schema for a given activity family (or None)."""
    normalized = FAMILY_ALIASES.get(family.lower().strip(), family) if family else None
    return CALCULATION_SCHEMAS.get(normalized) if normalized else None


def get_question_fields(family: str) -> list:
    """Return ordered list of question field names for an activity family."""
    schema = get_schema(family)
    if not schema:
        return []
    return list(schema["questions"].keys())


def get_next_question_field(family: str, draft: dict) -> str | None:
    """Return the next field that must be collected before calculation."""
    schema = get_schema(family)
    if not schema:
        return None

    for field in schema["required"]:
        if field == "period":
            if not (draft.get("activity_month") and draft.get("activity_year")):
                logger.debug("[registry] Required field missing: period, returning it")
                return field
            continue
        if not draft.get(field):
            logger.debug(f"[registry] Required field missing: {field}, returning it")
            return field

    # Vehicle distance special case:
    # If the user mentioned multiple vehicles, "4500 km" is ambiguous.
    # It can mean total fleet distance OR per-vehicle distance.
    if family == "vehicle_distance":
        vehicle_count = draft.get("vehicle_count")
        logger.debug(f"[registry] vehicle_distance: vehicle_count={vehicle_count}, distance_basis={draft.get('distance_basis')}")

        try:
            vehicle_count_num = int(vehicle_count or 0)
        except (TypeError, ValueError):
            vehicle_count_num = 0

        if vehicle_count_num > 1 and not draft.get("distance_basis"):
            logger.debug(f"[registry] vehicle_count_num={vehicle_count_num} > 1: returning distance_basis")
            return "distance_basis"
        elif vehicle_count_num > 1:
            logger.debug(f"[registry] vehicle_count_num={vehicle_count_num} > 1 but distance_basis already set")
        else:
            logger.debug(f"[registry] vehicle_count_num={vehicle_count_num} <= 1: no distance_basis question")

    return None


def get_question_text(family: str, field: str) -> str:
    """Return the human-readable question text for a field."""
    schema = get_schema(family)
    if not schema or field not in schema["questions"]:
        return f"Please provide: {field}"
    return schema["questions"][field]["text"]


# Ground truth for which of stationary_fuel's generic unit options actually
# have a registered factor for each specific fuel — cross-checked against
# emissions/factor_lookup.py's ACTIVITY_TO_SLUG. The schema's "unit" question
# can't offer a single static list for every fuel (e.g. "kg" only resolves
# for coal, "kWh" doesn't resolve for coal at all) without dead-ending some
# combinations in "no registered factor" — found while auditing every schema
# unit option across scopes 1/2/3.
STATIONARY_FUEL_UNITS = {
    "natural_gas": ["kWh", "m3"],
    "diesel": ["kWh", "litres"],
    "lpg": ["litres"],
    "fuel_oil": ["litres"],
    "coal": ["kg"],
}

# Families with zero registered emission factors for any value — the guided
# flow would otherwise walk the user through several questions only to fail
# at the very last step. Surfaced explicitly instead of silently dead-ending.
UNSUPPORTED_FAMILIES = {"purchased_energy", "refrigerant"}


def get_quick_replies(family: str, field: str, draft: dict | None = None) -> list:
    """Return suggested quick-reply options for a field.

    For stationary_fuel's "unit" field, narrows the options to what's
    actually registered for the fuel_type already chosen in *draft* (see
    STATIONARY_FUEL_UNITS) instead of the same generic list for every fuel.
    """
    schema = get_schema(family)
    if not schema or field not in schema["questions"]:
        return []
    replies = schema["questions"][field].get("quick_replies", [])
    if family == "stationary_fuel" and field == "unit" and draft:
        fuel_type = draft.get("fuel_type")
        narrowed = STATIONARY_FUEL_UNITS.get(fuel_type)
        if narrowed:
            return narrowed
    return replies


def _canonical_unit(unit) -> str | None:
    """Normalize a unit string for comparison, applying the same aliases
    used elsewhere so 'kWh'/'kwh'/'KWH' all compare equal."""
    if not unit:
        return None
    s = str(unit).strip().lower()
    return VALUE_ALIASES.get(s, s).lower()


def is_valid_unit(family: str, unit, draft: dict | None = None) -> bool:
    """Check whether *unit* is one of the schema's recognized units for
    *family*. Used to reject ambiguous/guessed units — e.g. "kw" is a power
    unit, not the "kWh" energy unit the electricity schema expects — rather
    than silently treating them as equivalent. When *draft* is given and the
    family is stationary_fuel, validates against the fuel-specific list
    (see STATIONARY_FUEL_UNITS) rather than the generic one."""
    valid_units = get_quick_replies(family, "unit", draft)
    if not valid_units:
        return True  # family has no unit question — nothing to validate
    canonical = _canonical_unit(unit)
    if canonical is None:
        return False
    return canonical in {_canonical_unit(v) for v in valid_units}


# ---------------------------------------------------------------------------
# Guided draft management
# ---------------------------------------------------------------------------

def prepare_guided_draft(nlu_data: dict) -> dict:
    """
    Create a guided-collection draft from NLU data.
    Pre-fills any fields that were already extracted.
    """
    family = nlu_data.get("activity_family")
    if not family:
        return {}

    schema = get_schema(family)
    if not schema:
        return {}

    draft = {"activity_family": family}

    # Pre-fill extracted fields
    field_mappings = [
        "fuel_type", "vehicle_type", "vehicle_count", "quantity", "unit",
        "distance_basis", "waste_method", "transport_mode", "flight_type",
        "commute_mode", "water_type", "material_type", "refrigerant_type",
        "activity_type", "activity_month", "activity_year",
    ]
    for field in field_mappings:
        val = nlu_data.get(field)
        if val is not None:
            draft[field] = val

    return draft


def apply_guided_answer(draft: dict, field: str, value) -> dict:
    """Apply a user's answer to the guided draft, returning the updated draft."""
    updated = dict(draft)

    if field == "period":
        # Not a literal draft key — resolves into activity_month/activity_year.
        # If it can't be parsed, leave both unset so the guided flow re-asks
        # instead of silently guessing a date the user didn't actually give.
        resolved = resolve_period(value)
        if resolved:
            updated["activity_month"], updated["activity_year"] = resolved
        return updated

    # Normalize the value if it's a string
    if isinstance(value, str):
        value = VALUE_ALIASES.get(value.lower().strip(), value)

    if field == "unit":
        family = updated.get("activity_family")
        if family and not is_valid_unit(family, value, updated):
            # Don't store an unrecognized/ambiguous unit (e.g. "kw" typed in
            # answer to "What unit?" for electricity) — leave it unset so
            # get_next_question_field() asks again instead of calculating
            # against a unit the schema doesn't actually support.
            return updated

    updated[field] = value
    return updated


def build_guided_ui(family: str, draft: dict) -> dict:
    """
    Build the next guided-question UI payload.

    Returns dict with:
      - complete: True if all required fields are filled
      - field: the next field to ask about (if not complete)
      - question: human-readable question text
      - quick_replies: suggested options
      - draft: current draft state
    """
    next_field = get_next_question_field(family, draft)
    if next_field is None:
        return {"complete": True, "draft": draft}

    question_text = get_question_text(family, next_field)

    # Custom question text for distance_basis with context
    if family == "vehicle_distance" and next_field == "distance_basis":
        quantity = draft.get("quantity", 0)
        unit = draft.get("unit", "km")
        try:
            question_text = f"Is {float(quantity):g} {unit} total for all vehicles or per vehicle?"
        except (TypeError, ValueError):
            question_text = "Is the distance total for all vehicles or per vehicle?"

    # Dynamic period quick replies: show all 12 months + year selection
    if next_field == "period":
        now = datetime.now(timezone.utc)
        month_names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
        period_replies = ["this_month", "last_month"]
        for m in range(1, 13):
            period_replies.append(f"{month_names[m-1]} {now.year}")
        for m in range(1, 13):
            period_replies.append(f"{month_names[m-1]} {now.year - 1}")
        return {
            "complete": False,
            "field": next_field,
            "question": question_text,
            "quick_replies": period_replies,
            "draft": draft,
        }

    return {
        "complete": False,
        "field": next_field,
        "question": question_text,
        "quick_replies": get_quick_replies(family, next_field, draft),
        "draft": draft,
    }


# ---------------------------------------------------------------------------
# Readiness check + entry data conversion
# ---------------------------------------------------------------------------

def is_ready_to_calculate(family: str, draft: dict) -> bool:
    """Ready only when there is no required or ambiguity field left."""
    return get_next_question_field(family, draft) is None


def draft_to_entry_data(draft: dict) -> dict:
    """
    Convert a completed guided draft into an entry-data dict suitable
    for the emissions calculator/factor-lookup layer.
    """
    family = draft.get("activity_family")
    if not family:
        return {}

    entry = {
        "activity_family": family,
        "quantity": draft.get("quantity"),
        "unit": draft.get("unit"),
    }

    if family == "stationary_fuel":
        entry["activity_type"] = draft.get("fuel_type", "natural_gas")
        entry["fuel_type"] = draft.get("fuel_type")

    elif family == "vehicle_distance":
        entry["activity_type"] = draft.get("vehicle_type", "car")
        entry["fuel_type"] = draft.get("fuel_type")
        entry["vehicle_type"] = draft.get("vehicle_type")

        try:
            quantity = float(draft.get("quantity") or 0)
        except (TypeError, ValueError):
            quantity = draft.get("quantity")

        try:
            vehicle_count = int(draft.get("vehicle_count") or 0)
        except (TypeError, ValueError):
            vehicle_count = 0

        # Safe default: if ambiguity was not asked for any reason,
        # treat distance as total fleet distance, not per vehicle.
        distance_basis = draft.get("distance_basis") or "fleet_total"

        final_quantity = quantity

        if distance_basis == "per_vehicle" and vehicle_count > 1:
            try:
                final_quantity = float(quantity) * vehicle_count
            except (TypeError, ValueError):
                final_quantity = quantity

        entry["quantity"] = final_quantity
        entry["vehicle_count"] = vehicle_count or None
        entry["distance_basis"] = distance_basis

    elif family == "electricity":
        entry["activity_type"] = draft.get("activity_type", "grid_electricity")

    elif family == "purchased_energy":
        entry["activity_type"] = draft.get("activity_type", "steam")

    elif family == "waste":
        entry["activity_type"] = draft.get("waste_method", "landfill")
        entry["waste_method"] = draft.get("waste_method")

    elif family == "flight":
        entry["activity_type"] = draft.get("flight_type", "domestic")
        entry["flight_type"] = draft.get("flight_type")

    elif family == "freight":
        entry["activity_type"] = draft.get("transport_mode", "road")
        entry["transport_mode"] = draft.get("transport_mode")

    elif family == "commuting":
        entry["activity_type"] = draft.get("commute_mode", "car")
        entry["commute_mode"] = draft.get("commute_mode")

    elif family == "water":
        entry["activity_type"] = draft.get("water_type", "potable")
        entry["water_type"] = draft.get("water_type")

    elif family == "purchased_goods":
        entry["activity_type"] = draft.get("material_type", "paper")
        entry["material_type"] = draft.get("material_type")

    elif family == "refrigerant":
        entry["activity_type"] = draft.get("refrigerant_type", "R-410A")
        entry["refrigerant_type"] = draft.get("refrigerant_type")

    # Pass through extracted month/year from NLU (if available)
    if draft.get("activity_month"):
        entry["month"] = draft["activity_month"]
    if draft.get("activity_year"):
        entry["year"] = draft["activity_year"]

    return entry
