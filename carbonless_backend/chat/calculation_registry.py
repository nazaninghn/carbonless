"""
Calculation Registry — decision engine for guided emission data collection.

Provides schemas for each activity family, normalization utilities, and
step-by-step guided-question logic used by the chat flow.
"""

import copy
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Calculation schemas
# ---------------------------------------------------------------------------

CALCULATION_SCHEMAS = {
    "stationary_fuel": {
        "scope": "1",
        "required": ["fuel_type", "quantity", "unit"],
        "questions": {
            "fuel_type": {
                "text": "What type of fuel was burned?",
                "quick_replies": ["natural_gas", "diesel", "lpg", "coal", "fuel_oil"],
            },
            "quantity": {
                "text": "How much fuel was consumed?",
                "quick_replies": ["100", "500", "1000", "5000"],
            },
            "unit": {
                "text": "What unit is the quantity in?",
                "quick_replies": ["kWh", "litres", "kg", "m3", "therms"],
            },
        },
    },
    "vehicle_distance": {
        "scope": "1",
        "required": ["vehicle_type", "fuel_type", "quantity", "unit"],
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
                "quick_replies": ["50", "100", "500", "1000"],
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
        },
    },
    "electricity": {
        "scope": "2",
        "required": ["quantity", "unit"],
        "questions": {
            "quantity": {
                "text": "How much electricity was consumed?",
                "quick_replies": ["500", "1000", "5000", "10000"],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["kWh", "MWh"],
            },
        },
    },
    "purchased_energy": {
        "scope": "2",
        "required": ["activity_type", "quantity", "unit"],
        "questions": {
            "activity_type": {
                "text": "What type of purchased energy?",
                "quick_replies": ["steam", "heating", "cooling"],
            },
            "quantity": {
                "text": "How much energy was purchased?",
                "quick_replies": ["100", "500", "1000", "5000"],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["kWh", "MWh", "GJ"],
            },
        },
    },
    "waste": {
        "scope": "3",
        "required": ["waste_method", "quantity", "unit"],
        "questions": {
            "waste_method": {
                "text": "How was the waste treated?",
                "quick_replies": ["landfill", "incineration", "recycling", "composting", "anaerobic_digestion"],
            },
            "quantity": {
                "text": "How much waste?",
                "quick_replies": ["0.5", "1", "5", "10"],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["tonnes", "kg"],
            },
        },
    },
    "flight": {
        "scope": "3",
        "required": ["flight_type", "quantity", "unit"],
        "questions": {
            "flight_type": {
                "text": "What type of flight?",
                "quick_replies": ["domestic", "short_haul", "long_haul", "international"],
            },
            "quantity": {
                "text": "What distance or how many passenger-km?",
                "quick_replies": ["500", "1000", "5000", "10000"],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["km", "miles", "passenger_km"],
            },
        },
    },
    "freight": {
        "scope": "3",
        "required": ["transport_mode", "quantity", "unit"],
        "questions": {
            "transport_mode": {
                "text": "What transport mode for freight?",
                "quick_replies": ["road", "rail", "sea", "air"],
            },
            "quantity": {
                "text": "What quantity (tonne-km)?",
                "quick_replies": ["100", "500", "1000", "5000"],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["tonne_km", "kg_km"],
            },
        },
    },
    "commuting": {
        "scope": "3",
        "required": ["commute_mode", "quantity", "unit"],
        "questions": {
            "commute_mode": {
                "text": "What mode of commuting?",
                "quick_replies": ["car", "bus", "train", "bicycle", "walking"],
            },
            "quantity": {
                "text": "What distance commuted?",
                "quick_replies": ["10", "20", "50", "100"],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["km", "miles"],
            },
        },
    },
    "water": {
        "scope": "3",
        "required": ["water_type", "quantity", "unit"],
        "questions": {
            "water_type": {
                "text": "What type of water usage?",
                "quick_replies": ["potable", "wastewater"],
            },
            "quantity": {
                "text": "How much water?",
                "quick_replies": ["10", "50", "100", "500"],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["m3", "litres"],
            },
        },
    },
    "purchased_goods": {
        "scope": "3",
        "required": ["material_type", "quantity", "unit"],
        "questions": {
            "material_type": {
                "text": "What type of material/goods?",
                "quick_replies": ["paper", "plastics", "metals", "textiles", "electronics"],
            },
            "quantity": {
                "text": "What quantity?",
                "quick_replies": ["10", "100", "500", "1000"],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["kg", "tonnes"],
            },
        },
    },
    "refrigerant": {
        "scope": "1",
        "required": ["refrigerant_type", "quantity", "unit"],
        "questions": {
            "refrigerant_type": {
                "text": "What type of refrigerant?",
                "quick_replies": ["R-410A", "R-134a", "R-404A", "R-32", "R-22"],
            },
            "quantity": {
                "text": "How much refrigerant was released?",
                "quick_replies": ["0.5", "1", "2", "5"],
            },
            "unit": {
                "text": "What unit?",
                "quick_replies": ["kg"],
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
    "metric_tons": "tonnes",
    "metric_tonnes": "tonnes",
    "ton": "tonnes",
    "tonne": "tonnes",
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
        if not draft.get(field):
            return field

    # Vehicle distance special case:
    # If the user mentioned multiple vehicles, "4500 km" is ambiguous.
    # It can mean total fleet distance OR per-vehicle distance.
    if family == "vehicle_distance":
        vehicle_count = draft.get("vehicle_count")

        try:
            vehicle_count_num = int(vehicle_count or 0)
        except (TypeError, ValueError):
            vehicle_count_num = 0

        if vehicle_count_num > 1 and not draft.get("distance_basis"):
            return "distance_basis"

    return None


def get_question_text(family: str, field: str) -> str:
    """Return the human-readable question text for a field."""
    schema = get_schema(family)
    if not schema or field not in schema["questions"]:
        return f"Please provide: {field}"
    return schema["questions"][field]["text"]


def get_quick_replies(family: str, field: str) -> list:
    """Return suggested quick-reply options for a field."""
    schema = get_schema(family)
    if not schema or field not in schema["questions"]:
        return []
    return schema["questions"][field].get("quick_replies", [])


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
        "activity_type",
    ]
    for field in field_mappings:
        val = nlu_data.get(field)
        if val is not None:
            draft[field] = val

    return draft


def apply_guided_answer(draft: dict, field: str, value) -> dict:
    """Apply a user's answer to the guided draft, returning the updated draft."""
    updated = dict(draft)
    # Normalize the value if it's a string
    if isinstance(value, str):
        value = VALUE_ALIASES.get(value.lower().strip(), value)
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

    return {
        "complete": False,
        "field": next_field,
        "question": get_question_text(family, next_field),
        "quick_replies": get_quick_replies(family, next_field),
        "draft": draft,
    }


# ---------------------------------------------------------------------------
# Readiness check + entry data conversion
# ---------------------------------------------------------------------------

def is_ready_to_calculate(family: str, draft: dict) -> bool:
    """Check if all required fields for the family are filled in the draft."""
    schema = get_schema(family)
    if not schema:
        return False
    for field in schema["required"]:
        if not draft.get(field):
            return False

    # Vehicle distance special case: distance_basis must be answered for multi-vehicle
    if family == "vehicle_distance":
        vehicle_count = draft.get("vehicle_count")
        try:
            vehicle_count_num = int(vehicle_count or 0)
        except (TypeError, ValueError):
            vehicle_count_num = 0
        if vehicle_count_num > 1 and not draft.get("distance_basis"):
            return False

    return True


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

        # Handle distance_basis — per_vehicle multiplier
        vehicle_count = draft.get("vehicle_count")
        distance_basis = draft.get("distance_basis") or "fleet_total"
        quantity = draft.get("quantity")

        if distance_basis == "per_vehicle" and vehicle_count and quantity:
            try:
                total_distance = float(quantity) * int(vehicle_count)
                entry["quantity"] = total_distance
                entry["vehicle_count"] = int(vehicle_count)
                entry["distance_basis"] = "per_vehicle"
            except (ValueError, TypeError):
                pass
        else:
            if vehicle_count:
                entry["vehicle_count"] = int(vehicle_count) if vehicle_count else None
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

    return entry
