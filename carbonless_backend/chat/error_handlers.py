"""
P2.3 Error Handlers & User-Friendly Messages

Define clear, actionable error messages for:
- Missing factors
- Ambiguous inputs
- Validation failures
- State cleanup
"""

def format_factor_missing_error(activity_type: str, unit: str) -> str:
    """When no factor exists for activity+unit."""
    return (
        f"Sorry, I couldn't find an emission factor for **{activity_type}** in **{unit}**.\n\n"
        f"Try one of these formats:\n"
        f"- Specify a different unit\n"
        f"- Provide more context (e.g., 'diesel' instead of 'fuel')\n"
        f"- Ask me what units are available for this activity"
    )


def format_ambiguous_input_error(activity_type: str, missing_fields: list) -> str:
    """When input is incomplete."""
    fields_text = ", ".join(missing_fields)
    return (
        f"I understand you're talking about **{activity_type}**, "
        f"but I need a bit more info:\n"
        f"**{fields_text}**"
    )


def format_validation_error(field: str, error: str) -> str:
    """When user input fails validation."""
    messages = {
        'tax_id': "Tax ID must be 10 or 11 digits. Try again.",
        'quantity': "I need a valid number for the quantity.",
        'unit': "I don't recognize that unit. Try: km, liters, kg, kWh, etc.",
        'vehicle_count': "I need the number of vehicles.",
    }
    return messages.get(field, f"Invalid {field}: {error}")


def format_state_error() -> str:
    """When flow state is corrupted."""
    return (
        "Something got confused in the flow. "
        "Let's start fresh. What would you like to calculate?"
    )


def format_calculation_error(reason: str) -> str:
    """When calculation itself fails."""
    return (
        f"I couldn't calculate that: {reason}\n"
        f"Try rephrasing or providing different data."
    )


# Response templates for different scenarios

RESPONSE_TEMPLATES = {
    'activity_not_recognized': (
        "I didn't catch the activity type. "
        "I can help with emissions from:\n"
        "🚗 Vehicle travel\n"
        "✈️ Flights\n"
        "🗑️ Waste\n"
        "🚛 Freight\n"
        "💡 Electricity\n"
        "🚆 Commuting\n"
        "What are you calculating?"
    ),

    'unit_not_recognized': (
        "I don't recognize that unit. "
        "Common ones: km, liters, kg, kWh, m³, tonne-km"
    ),

    'quantity_not_recognized': (
        "I need a number for the quantity. "
        "Example: '5000 km' or '500 kg'"
    ),

    'clarification_needed': (
        "Got it! Just to be clear:"
    ),

    'calculation_complete': (
        "✅ Calculated!"
    ),

    'entry_saved': (
        "✓ Saved to your dashboard"
    ),

    'ask_confirmation': (
        "Does this look right?"
    ),
}


def build_user_friendly_error(error_type: str, context: dict = None) -> str:
    """
    Build a user-friendly error message.

    Args:
        error_type: One of the keys above or a custom type
        context: Additional context dict (activity_type, unit, field, etc.)

    Returns:
        User-friendly error message
    """
    context = context or {}

    if error_type == 'factor_missing':
        return format_factor_missing_error(
            context.get('activity_type', 'activity'),
            context.get('unit', 'unit')
        )
    elif error_type == 'ambiguous':
        return format_ambiguous_input_error(
            context.get('activity_type', 'that activity'),
            context.get('missing_fields', [])
        )
    elif error_type == 'validation':
        return format_validation_error(
            context.get('field', 'field'),
            context.get('error', 'Invalid')
        )
    elif error_type == 'state':
        return format_state_error()
    elif error_type == 'calculation':
        return format_calculation_error(
            context.get('reason', 'Unknown error')
        )
    else:
        return RESPONSE_TEMPLATES.get(error_type, "Something went wrong. Try again.")
