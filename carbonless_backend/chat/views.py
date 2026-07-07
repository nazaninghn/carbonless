import logging
import os
import re
from datetime import datetime, timezone
from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ChatSession, ChatMessage
from .local_parser import try_local_emission_parse, try_guided_draft_parse
from .nlu_extractor import extract_emission_intent
from .calculation_registry import (
    normalize_nlu, get_schema, prepare_guided_draft,
    apply_guided_answer, build_guided_ui, is_ready_to_calculate,
    draft_to_entry_data,
)
from emissions.factor_lookup import create_entry_from_activity, get_emission_factor_reference

try:
    from groq import RateLimitError
except Exception:
    RateLimitError = None

logger = logging.getLogger(__name__)

# Fix #75: module-level singleton so we don't reconstruct the Groq HTTP client
# (and its internal connection pool) on every single chat message.
# Re-initialises automatically if GROQ_API_KEY changes at runtime.
_groq_client_cache = None
_groq_client_key_cache = None

# Fix #72: hard cap on user message length sent to the Groq API.
# Prevents runaway token spend and HTTP 413 errors from the upstream model.
MAX_MESSAGE_LENGTH = 4000

BASE_SYSTEM_PROMPT = """You are CarbonIQ, a carbon accounting assistant for ISO 14064-1 reporting.

CRITICAL RULES:
1. Never show internal JSON blocks to the user.
2. Never show EMISSION FACTOR REFERENCE values to the user.
3. Never show DATA CONTEXT to the user.
4. Never list all available emission factors.
5. Never invent or guess emission factors.
6. Never show formulas like "quantity × factor = result" to the user.
7. The backend is the source of truth for factors, calculations, saving, and dashboard totals.
8. If the user provides quantity + unit + activity (e.g. "18000 kWh electricity"), extract the data silently. Include ONLY an internal emission_entry JSON block — nothing visible about it.
9. If the user asks to calculate but does NOT provide quantity, unit, and activity, ask them to provide data in this format: amount + unit + activity.
10. For general questions about carbon, sustainability, ISO 14064-1, or reduction strategies, answer normally and concisely.
11. Keep responses SHORT — 1-3 sentences max for data entry confirmations.
12. If asked in Turkish, respond in Turkish. If asked in Persian/Farsi, respond in Persian.
13. NEVER say "saved", "entry saved", or "saved to dashboard". Only the backend confirm-entry endpoint saves data after explicit user confirmation.

INTERNAL DATA ENTRY FORMAT (never show this to the user):
Only when the user provides real activity data, include one hidden block:

```emission_entry
{"fuel_type": "activity_type_here", "quantity": 123, "unit": "unit_here", "month": 1, "year": 2025, "description": "brief description"}
```

The system parses this invisibly and shows the user a clean result with Yes/No save buttons.
Do NOT explain the JSON or show it in your text response. Just acknowledge the data briefly."""


# The activity→slug map, unit resolution, and factor lookup are shared with the
# guided questionnaire (questionnaire/views.py) via emissions/factor_lookup.py,
# so the AI chat and the questionnaire always agree with each other and with
# the dashboard on what a given activity is worth.
_get_emission_factor_reference = get_emission_factor_reference


def _build_scope3_category_prompt():
    """
    Build a Scope 3 category listing section for the AI system prompt.

    Includes all 15 GHG Protocol categories with valid sub-types and units,
    so the AI can compose the correct activity_type key.

    Kept deliberately compact (one line per category, English keys only — the
    AI still replies in the user's language regardless) — this block plus the
    emission factor reference plus conversation history must all fit under
    Groq's per-minute token budget, and the previous, fully-verbose version of
    this function alone was ~1900 tokens, which is what caused every chat
    message to fail with a 413 'rate_limit_exceeded' token-budget error.
    """
    try:
        from emissions.scope3_categories import SCOPE3_CATEGORIES
    except ImportError:
        return ''  # Gracefully degrade if scope3_categories not yet deployed
    lines = [
        '',
        'SCOPE 3 CATEGORIES (activity_type = "{category}_{subtype}", unit as shown; '
        'franchises uses activity_type="franchises" with no subtype):',
    ]

    for cat_key, cat_data in SCOPE3_CATEGORIES.items():
        ghg_num = cat_data.get('ghg_number')
        # Skip non-GHG-Protocol categories (water has ghg_number=None)
        if ghg_num is None:
            continue

        subtypes = cat_data.get('subtypes', {})
        if cat_key == 'franchises':
            parts = 'franchises(units)'
        else:
            parts = ' '.join(f'{cat_key}_{st_key}({st_data["unit"]})' for st_key, st_data in subtypes.items())
        lines.append(f'Cat{ghg_num} {cat_data["name_en"]}: {parts}')

    # Also include water (non-standard but supported)
    water = SCOPE3_CATEGORIES.get('water')
    if water:
        parts = ' '.join(f'water_{st_key}({st_data["unit"]})' for st_key, st_data in water.get('subtypes', {}).items())
        lines.append(f'Water: {parts}')

    lines.append(
        'If ambiguous which sub-type applies, ask. Category/sub-type names above are English '
        'keys only — respond to the user in their own language as usual.'
    )

    return '\n'.join(lines)


def _get_user_emission_context(user):
    """Fetch the user's real emission data to inject into the AI system prompt."""
    try:
        from django.db.models import Sum
        from emissions.models import EmissionEntry
        from companies.utils import get_current_company

        company = get_current_company(user)
        if not company:
            return ''

        # Fix #84: datetime.now() is naïve (no tzinfo) and returns local server time,
        # which diverges from UTC on non-UTC servers and breaks year boundaries at
        # midnight.  datetime.now(timezone.utc) is always correct regardless of the
        # server's TZ setting.
        year = datetime.now(timezone.utc).year
        entries = EmissionEntry.objects.filter(company=company, year=year).select_related('emission_factor')
        # Fix #71 (query 1 of 2): combined total + count in one aggregate instead of
        # separate aggregate(Sum) + .count() — saves one DB round-trip per AI message.
        agg = entries.aggregate(t=Sum('calculated_co2e_kg'), count=Count('id'))
        total_kg = float(agg['t'] or 0)
        entry_count = agg['count'] or 0

        if total_kg == 0:
            # Try previous year
            year -= 1
            entries = EmissionEntry.objects.filter(company=company, year=year).select_related('emission_factor')
            agg = entries.aggregate(t=Sum('calculated_co2e_kg'), count=Count('id'))
            total_kg = float(agg['t'] or 0)
            entry_count = agg['count'] or 0

        if total_kg == 0:
            return f'\n\nDATA CONTEXT:\nCompany: {company.legal_entity_name}\nNo emission entries recorded yet.'

        # Fix #71 (query 2 of 2): single GROUP BY for all three scope totals instead of
        # three separate aggregate() calls (scope1, scope2, scope3 → was 3 queries, now 1).
        scope_agg = entries.values('emission_factor__scope').annotate(t=Sum('calculated_co2e_kg'))
        scope_map = {row['emission_factor__scope']: float(row['t'] or 0) for row in scope_agg}
        s1 = scope_map.get('scope1', 0.0)
        s2 = scope_map.get('scope2', 0.0)
        s3 = scope_map.get('scope3', 0.0)

        # Category breakdown
        cats = (
            entries.values('emission_factor__scope', 'emission_factor__category')
            .annotate(total=Sum('calculated_co2e_kg'))
            .order_by('emission_factor__scope', '-total')[:10]
        )
        cat_lines = []
        for c in cats:
            scope = c['emission_factor__scope'].replace('scope', 'Scope ')
            cat = c['emission_factor__category'].replace('_', ' ').title()
            kg = float(c['total'])
            cat_lines.append(f'  - {scope} / {cat}: {kg/1000:.3f} tCO2e')

        # Fix #43: Replace 12 per-month aggregate queries with a single GROUP BY
        # (same pattern as Bug #33 fixed in emission_summary).
        month_names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        monthly_qs = (
            entries.values('month')
            .annotate(t=Sum('calculated_co2e_kg'))
            .order_by('month')
        )
        monthly_map = {row['month']: float(row['t'] or 0) for row in monthly_qs}
        monthly = [
            f'  {month_names[m-1]}: {monthly_map[m]/1000:.3f} tCO2e'
            for m in range(1, 13)
            if monthly_map.get(m, 0) > 0
        ]

        lines = [
            '',
            '--- DATA CONTEXT (User\'s real emission data — use this to answer any report/summary requests) ---',
            f'Company: {company.legal_entity_name}',
            f'Reporting Year: {year}',
            f'Standard: ISO 14064-1:2018 | Boundary: Operational Control',
            f'',
            f'TOTAL EMISSIONS: {total_kg/1000:.3f} tCO2e ({total_kg:,.0f} kg CO2e)',
            f'  Scope 1 (Direct):          {s1/1000:.3f} tCO2e  ({s1/total_kg*100:.1f}%)',
            f'  Scope 2 (Energy Indirect): {s2/1000:.3f} tCO2e  ({s2/total_kg*100:.1f}%)',
            f'  Scope 3 (Other Indirect):  {s3/1000:.3f} tCO2e  ({s3/total_kg*100:.1f}%)',
            f'  Total entries logged: {entry_count}',
        ]
        if cat_lines:
            lines += ['', 'TOP CATEGORIES:'] + cat_lines
        if monthly:
            lines += ['', 'MONTHLY BREAKDOWN:'] + monthly
        lines.append('--- END DATA CONTEXT ---')

        return '\n'.join(lines)
    except Exception:
        return ''


def _get_groq_client():
    # Fix #75: reuse the same client instance across requests so the underlying
    # HTTP connection pool is shared.  Re-creates if the API key changes.
    global _groq_client_cache, _groq_client_key_cache
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        return None
    if _groq_client_cache is None or _groq_client_key_cache != api_key:
        try:
            from groq import Groq
            _groq_client_cache = Groq(api_key=api_key)
            _groq_client_key_cache = api_key
        except Exception:
            return None
    return _groq_client_cache


# ── NLU / Registry → factor_lookup adapter ────────────────────────────────────

def _normalise_nlu_unit(unit):
    """Normalize units from NLU output to factor_lookup-compatible units."""
    if not unit:
        return unit

    u = str(unit).strip().lower()

    unit_map = {
        'litre': 'liters',
        'litres': 'liters',
        'liter': 'liters',
        'l': 'liters',
        'lt': 'liters',
        'm³': 'm3',
        'm^3': 'm3',
        'tonnes': 'tonne',
        'tons': 'tonne',
        'tonne_km': 'tonne-km',
        'tonne km': 'tonne-km',
        'tkm': 'tonne-km',
        'kwh': 'kwh',
    }

    return unit_map.get(u, u)


def _map_registry_entry_to_factor_entry(registry_entry):
    """
    Adapter: map calculation_registry.draft_to_entry_data() output into a dict
    that _build_pending_entries_from_data / factor_lookup can understand.
    """
    family = registry_entry.get('activity_family')
    raw_activity = (
        registry_entry.get('activity_type')
        or registry_entry.get('fuel_type')
        or ''
    )
    raw_activity = str(raw_activity).strip().lower()

    unit = _normalise_nlu_unit(registry_entry.get('unit'))

    activity_type = raw_activity

    if family == 'electricity':
        activity_type = 'electricity'

    elif family == 'stationary_fuel':
        activity_type = registry_entry.get('fuel_type') or raw_activity

    elif family == 'vehicle_distance':
        activity_type = 'road_travel'

    elif family == 'waste':
        waste_map = {
            'landfill': 'waste_landfill',
            'recycling': 'waste_recyclable',
            'recyclable': 'waste_recyclable',
            'composting': 'waste_organic_compost',
            'organic_compost': 'waste_organic_compost',
            'incineration': 'waste_incineration',
        }
        activity_type = waste_map.get(raw_activity, raw_activity)

    elif family == 'flight':
        flight_map = {
            'domestic': 'flight_domestic',
            'short_haul': 'flight_short_haul',
            'medium_haul': 'flight_medium_haul',
            'long_haul': 'flight_long_haul',
            'international': 'flight_long_haul',
        }
        activity_type = flight_map.get(raw_activity, raw_activity)

    elif family == 'freight':
        freight_map = {
            'road': 'truck_freight',
            'truck': 'truck_freight',
            'rail': 'rail_freight',
            'sea': 'sea_freight',
            'air': 'air_freight',
        }
        activity_type = freight_map.get(raw_activity, raw_activity)

    elif family == 'commuting':
        commute_map = {
            'car': 'employee_commuting_car_commute',
            'bus': 'employee_commuting_bus_commute',
            'train': 'employee_commuting_train_commute',
            'motorcycle': 'employee_commuting_motorcycle_commute',
            'bicycle': 'employee_commuting_bicycle_commute',
            'walking': 'employee_commuting_bicycle_commute',
        }
        activity_type = commute_map.get(raw_activity, raw_activity)

    elif family == 'water':
        water_map = {
            'potable': 'water_water_supply',
            'supply': 'water_water_supply',
            'water_supply': 'water_water_supply',
            'wastewater': 'water_water_treatment',
            'treatment': 'water_water_treatment',
            'water_treatment': 'water_water_treatment',
        }
        activity_type = water_map.get(raw_activity, raw_activity)

    elif family == 'purchased_goods':
        material_map = {
            'paper': 'purchased_goods_paper_mixed',
            'plastic': 'purchased_goods_plastic_average',
            'plastics': 'purchased_goods_plastic_average',
            'glass': 'purchased_goods_glass',
            'steel': 'purchased_goods_metal_steel',
            'metals': 'purchased_goods_metal_steel',
            'metal': 'purchased_goods_metal_steel',
            'aluminium': 'purchased_goods_metal_aluminium',
            'aluminum': 'purchased_goods_metal_aluminium',
        }
        activity_type = material_map.get(raw_activity, raw_activity)

    return {
        'fuel_type': activity_type,
        'quantity': registry_entry.get('quantity'),
        'unit': unit,
        'month': datetime.now(timezone.utc).month,
        'year': datetime.now(timezone.utc).year,
        'description': registry_entry.get('description') or f'AI Chat: {activity_type}',
    }


def _quick_reply_label(value):
    """Map quick-reply values to user-friendly labels with emoji."""
    label_map = {
        'petrol': '⛽ Petrol',
        'diesel': '🛢️ Diesel',
        'electric': '⚡ Electric',
        'hybrid': '🔋 Hybrid',
        'lpg': '🔥 LPG',
        'natural_gas': '🌱 Natural gas',
        'coal': '⚫ Coal',
        'fuel_oil': '🛢️ Fuel oil',

        'landfill': '🗑️ Landfill',
        'recycling': '♻️ Recycling',
        'recyclable': '♻️ Recycling',
        'composting': '🌱 Composting',
        'incineration': '🔥 Incineration',

        'road': '🚛 Road / Truck',
        'truck': '🚛 Truck',
        'rail': '🚆 Rail',
        'sea': '🚢 Sea',
        'air': '✈️ Air',

        'car': '🚗 Car',
        'bus': '🚌 Bus',
        'train': '🚆 Train',
        'motorcycle': '🏍️ Motorcycle',
        'bicycle': '🚲 Bicycle',
        'walking': '🚶 Walking',

        'potable': '💧 Water supply',
        'supply': '� Water supply',
        'wastewater': '🚰 Water treatment',
        'treatment': '🚰 Water treatment',

        'domestic': '🏠 Domestic',
        'short_haul': '✈️ Short haul',
        'medium_haul': '🌍 Medium haul',
        'long_haul': '🛫 Long haul',
        'international': '🌍 International',

        'per_vehicle': 'Per vehicle',
        'fleet_total': 'Total for all vehicles',
        'total': 'Total for all vehicles',

        'cancel': '❌ Cancel',
    }

    return label_map.get(value, str(value).replace('_', ' ').title())


def _format_quick_replies(raw_replies, field):
    """Convert registry quick replies (plain strings) to frontend-ready dicts."""
    replies = []

    for item in raw_replies or []:
        if isinstance(item, dict):
            replies.append(item)
        else:
            replies.append({
                'label': _quick_reply_label(item),
                'value': item,
                'kind': field,
            })

    if not any(r.get('value') == 'cancel' for r in replies):
        replies.append({
            'label': '❌ Cancel',
            'value': 'cancel',
            'kind': 'cancel',
        })

    return replies


# ── NLU-based guided flow helpers ─────────────────────────────────────────────

def _assistant_response(session, text, pending_entries=None, ui=None, source='nlu_guided'):
    """Create assistant message and return Response with standard shape."""
    ai_msg = ChatMessage.objects.create(
        session=session, role='assistant', content=text,
        ui=ui or {},
    )
    session.save(update_fields=['updated_at'])
    resp = {
        'id': ai_msg.id,
        'role': 'assistant',
        'content': text,
        'created_at': ai_msg.created_at,
        'session_title': session.title,
        'pending_entries': pending_entries or [],
        'source': source,
    }
    if ui:
        resp['ui'] = ui
    return Response(resp)


def _ask_guided_question(session, family, draft):
    """Ask the next guided question for an NLU-triggered draft."""
    guided_ui = build_guided_ui(family, draft)

    if guided_ui.get('complete'):
        return _complete_guided_draft(session, draft)

    field = guided_ui['field']
    question_text = guided_ui['question']
    raw_replies = guided_ui['quick_replies']
    quick_replies = _format_quick_replies(raw_replies, field)

    # Store the guided_draft in session state
    session.state = {
        **(session.state or {}),
        'guided_draft': {**draft, '_nlu_flow': True, '_next_field': field},
    }
    session.save(update_fields=['state', 'updated_at'])

    ui = {'quick_replies': quick_replies, 'flow': f'nlu_{family}'}
    text = f"I can calculate this, but I need one more detail.\n\n**{question_text}**"
    return _assistant_response(session, text, ui=ui, source='nlu_guided')


def _cancel_guided_flow(session):
    """Cancel any active NLU guided draft."""
    session.state = {**(session.state or {}), 'guided_draft': None}
    session.save(update_fields=['state', 'updated_at'])
    return _assistant_response(session, "Okay, calculation cancelled.", source='nlu_guided')


def _complete_guided_draft(session, draft):
    """All fields collected — calculate and return pending entries."""
    family = draft.get('activity_family')
    registry_entry = draft_to_entry_data(draft)
    factor_entry = _map_registry_entry_to_factor_entry(registry_entry)
    pending_entries = _build_pending_entries_from_data([factor_entry])

    # Clear guided draft
    session.state = {**(session.state or {}), 'guided_draft': None}
    session.save(update_fields=['state', 'updated_at'])

    if pending_entries:
        clean_text = _build_pending_entries_text(pending_entries)
        return _assistant_response(session, clean_text, pending_entries=pending_entries, source='nlu_calculator')

    # Factor not found — tell the user
    return _assistant_response(
        session,
        f"Sorry, I couldn't find a registered emission factor for that activity ({family}). "
        "Please try providing the data in a different format.",
        source='nlu_calculator',
    )


def _handle_nlu_guided_reply(request, session, content):
    """
    Handle a reply to an NLU-based guided flow question.
    Returns a Response if handled, or None if not an NLU guided flow.
    """
    draft = (session.state or {}).get('guided_draft')
    if not draft or not draft.get('_nlu_flow'):
        return None  # Not an NLU guided flow

    selected = content.strip().lower()

    # Cancel
    if selected == 'cancel':
        return _cancel_guided_flow(session)

    # Apply the answer to the draft
    field = draft.get('_next_field')
    if not field:
        return _cancel_guided_flow(session)

    family = draft.get('activity_family')
    updated_draft = apply_guided_answer(draft, field, selected)
    # Remove internal tracking keys temporarily for readiness check
    clean_draft = {k: v for k, v in updated_draft.items() if not k.startswith('_')}

    if is_ready_to_calculate(family, clean_draft):
        return _complete_guided_draft(session, clean_draft)

    # Ask the next question
    return _ask_guided_question(session, family, clean_draft)


def _extract_vehicle_count_from_text(text):
    """Extract vehicle count from user text as a fallback when NLU misses it."""
    if not text:
        return None

    t = text.lower()

    patterns = [
        r'(?P<count>\d+)\s*(?:private\s*)?(?:car|cars|vehicle|vehicles|truck|trucks|van|vans)\b',
        r'(?:car|cars|vehicle|vehicles|truck|trucks|van|vans)\s*[:=]?\s*(?P<count>\d+)\b',
    ]

    for pattern in patterns:
        match = re.search(pattern, t)
        if match:
            try:
                count = int(match.group("count"))
                if count > 0:
                    return count
            except (TypeError, ValueError):
                continue

    return None


def _handle_groq_nlu_result(session, nlu_result, original_text=None):
    """
    Process NLU extraction result:
    - If complete calculation → adapter → pending entries → save card
    - If incomplete → guided draft + quick replies
    - If general_question or low confidence → return None (fall through to Groq conversational)
    """
    mode = nlu_result.get('mode')
    confidence = nlu_result.get('confidence', 0)

    # If general question or unknown or low confidence → fall through
    if mode != 'calculation' or confidence < 0.5:
        return None

    # Normalize NLU data
    normalized = normalize_nlu(nlu_result)
    family = normalized.get('activity_family')
    if not family:
        return None

    # Fallback: extract vehicle_count from text if NLU missed it
    if family == 'vehicle_distance' and not normalized.get('vehicle_count'):
        extracted_count = _extract_vehicle_count_from_text(original_text)
        if extracted_count:
            normalized['vehicle_count'] = extracted_count

    # Ensure vehicle_count is an integer
    if normalized.get('vehicle_count') is not None:
        try:
            normalized['vehicle_count'] = int(normalized['vehicle_count'])
        except (TypeError, ValueError):
            normalized['vehicle_count'] = None

    # Prepare guided draft from NLU data
    draft = prepare_guided_draft(normalized)
    if not draft:
        return None

    logger.info(
        'NLU draft prepared: family=%s vehicle_count=%s ready=%s',
        family, draft.get('vehicle_count'), is_ready_to_calculate(family, draft),
    )

    # Check if all required fields are filled
    if is_ready_to_calculate(family, draft):
        return _complete_guided_draft(session, draft)

    # Incomplete — start guided flow
    return _ask_guided_question(session, family, draft)


def _parse_emission_entry(ai_text):
    """
    Parse ```emission_entry JSON blocks from AI response.
    Also handles ```json blocks that contain emission entry data.
    Returns list of parsed emission data dicts, or empty list if none found.
    """
    import json
    import re
    entries = []
    # Find ```emission_entry ... ``` blocks (primary format)
    pattern = r'```emission_entry\s*\n(.*?)\n```'
    matches = re.findall(pattern, ai_text, re.DOTALL)
    # Also find ```json blocks that look like emission entries (fallback)
    if not matches:
        json_pattern = r'```json\s*\n(.*?)\n```'
        json_matches = re.findall(json_pattern, ai_text, re.DOTALL)
        for match in json_matches:
            try:
                data = json.loads(match.strip())
                if data.get('fuel_type') and data.get('quantity'):
                    matches.append(match)
            except (json.JSONDecodeError, ValueError):
                continue
    # Also try bare ``` blocks without language tag
    if not matches:
        bare_pattern = r'```\s*\n(.*?)\n```'
        bare_matches = re.findall(bare_pattern, ai_text, re.DOTALL)
        for match in bare_matches:
            try:
                data = json.loads(match.strip())
                if data.get('fuel_type') and data.get('quantity'):
                    matches.append(match)
            except (json.JSONDecodeError, ValueError):
                continue
    for match in matches:
        try:
            data = json.loads(match.strip())
            if data.get('fuel_type') and data.get('quantity'):
                entries.append(data)
        except (json.JSONDecodeError, ValueError):
            continue
    return entries


def _create_emission_from_chat(user, entry_data):
    """
    Create an EmissionEntry from AI-parsed chat data.

    The AI only ever supplies (activity_type, quantity, unit) — it never supplies or
    influences the numeric emission factor; create_entry_from_activity (shared with
    the guided questionnaire) resolves the real registered factor and rejects
    anything that doesn't match a real factor for that exact unit.

    Returns (entry, error_message) tuple.
    """
    from companies.utils import get_current_company

    company = get_current_company(user)
    activity_type = entry_data.get('fuel_type', '')
    quantity = entry_data.get('quantity')
    unit = entry_data.get('unit', '')
    month = entry_data.get('month', datetime.now(timezone.utc).month)
    year = entry_data.get('year', datetime.now(timezone.utc).year)
    description = entry_data.get('description', '') or f'AI Chat: {activity_type} {quantity} {unit}'

    return create_entry_from_activity(user, company, activity_type, quantity, unit, year, month, description)


_LANGUAGE_NAMES = {'tr': 'Turkish', 'en': 'English'}


def _call_groq(messages_history, user_context='', ui_language=None):
    """Call Groq API. Returns (ai_text, error, status_code)."""
    client = _get_groq_client()
    if not client:
        logger.error('GROQ_API_KEY not set or Groq client failed to initialise')
        return None, 'AI service not available.', 503

    model = os.environ.get('GROQ_MODEL', 'llama-3.1-8b-instant')
    max_tokens = int(os.environ.get('GROQ_MAX_TOKENS', '700'))
    history_limit = int(os.environ.get('GROQ_HISTORY_MESSAGES', '6'))

    # The frontend's own EN/TR toggle is authoritative — without this, the AI
    # was guessing the reply language from the message text alone and would
    # default to Turkish even when the user had EN selected and wrote in
    # English (e.g. a short, ambiguous message like "i need help").
    lang_name = _LANGUAGE_NAMES.get(ui_language)
    if lang_name:
        language_directive = (
            f'\n\nLANGUAGE: The user has {lang_name} selected in the chat language toggle. '
            f'Reply in {lang_name} UNLESS their message is clearly written in a different '
            f'language, in which case match their message instead.'
        )
    else:
        language_directive = ''

    system_prompt = (
        BASE_SYSTEM_PROMPT + language_directive
        + _build_scope3_category_prompt() + _get_emission_factor_reference() + user_context
    )

    groq_messages = [{'role': 'system', 'content': system_prompt}]
    for msg in messages_history[-history_limit:]:
        groq_messages.append({'role': msg['role'], 'content': msg['content'][:1200]})

    try:
        response = client.chat.completions.create(
            model=model,
            messages=groq_messages,
            temperature=0.1,
            max_tokens=max_tokens,
            timeout=30,
        )
        return response.choices[0].message.content, None, 200
    except Exception as e:
        if RateLimitError and isinstance(e, RateLimitError):
            logger.warning('Groq rate limit reached: %s', e)
            return None, 'AI usage limit reached. Please try again later.', 429
        logger.error('Groq API error: %s', e, exc_info=True)
        return None, 'AI service temporarily unavailable. Please try again.', 502


def _session_to_dict(session, include_messages=False):
    # Fix #26: list_sessions now annotates message_count directly on the queryset
    # so we avoid loading every message just to call .count().  For detail views
    # (include_messages=True) the messages relation is still fetched lazily — that
    # is fine because session_detail is a single-row lookup and we need the
    # message bodies anyway.
    count = getattr(session, 'message_count', None)
    if count is None:
        count = session.messages.count()
    data = {
        'id': session.id,
        'title': session.title,
        'created_at': session.created_at,
        'updated_at': session.updated_at,
        'message_count': count,
    }
    if include_messages:
        # Fix #80: cap at the 100 most-recent messages — loading every message in a
        # long session would send a huge JSON blob and make the browser render
        # hundreds of Bubble/Markdown components at once, freezing the UI.
        # Fetch DESC so the DB index is used, then reverse for chronological display.
        msgs = list(session.messages.order_by('-created_at')[:100])
        msgs.reverse()
        data['messages'] = [
            {'id': m.id, 'role': m.role, 'content': m.content, 'created_at': m.created_at, 'ui': m.ui or {}}
            for m in msgs
        ]
    return data


# ── Local emission calculator (no Groq needed) ────────────────────────────────
# Moved to chat/local_parser.py — imported at module top as try_local_emission_parse.


def _build_pending_entries_from_data(emission_blocks):
    """Resolve emission data dicts to pending entries using factor_lookup."""
    from emissions.factor_lookup import resolve_factor_and_amount
    pending_entries = []
    for entry_data in emission_blocks:
        activity_type = entry_data.get('fuel_type', '')
        quantity = entry_data.get('quantity')
        unit = entry_data.get('unit', '')
        month = entry_data.get('month', datetime.now(timezone.utc).month)
        year = entry_data.get('year', datetime.now(timezone.utc).year)
        description = entry_data.get('description', '') or f'AI Chat: {activity_type} {quantity} {unit}'

        factor, qty, co2e_kg, err = resolve_factor_and_amount(activity_type, quantity, unit)
        if factor and co2e_kg is not None:
            pending_entries.append({
                'fuel_type': activity_type,
                'quantity': float(qty),
                'unit': unit,
                'month': month,
                'year': year,
                'description': description,
                'co2e_kg': float(co2e_kg),
                'co2e_tonne': float(co2e_kg) / 1000,
                'factor_used': float(factor.factor_kg_co2e),
                'factor_unit': factor.unit,
                'factor_id': factor.pk,
                'factor_name': getattr(factor, 'name', ''),
                'factor_source': getattr(factor, 'source', ''),
                'factor_source_label': factor.get_source_display() if hasattr(factor, 'get_source_display') else getattr(factor, 'source', ''),
                'factor_reference': getattr(factor, 'reference', ''),
                'scope': factor.scope,
            })
        elif err:
            logger.warning('Local emission resolve failed: %s', err)
    return pending_entries


def _build_pending_entries_text(pending_entries):
    """Build clean result text — no formula, no quantity, just result + source."""
    confirmations = []
    for pe in pending_entries:
        scope_label = pe.get('scope', '').replace('scope', 'Scope ') if pe.get('scope') else ''
        activity = pe.get('fuel_type', '').replace('_', ' ').title()
        raw_source = pe.get('factor_source_label') or pe.get('factor_source') or ''
        source_label = f'Registered factor — {raw_source}' if raw_source else 'Registered emission factor'
        confirmations.append(
            f"✅ **{scope_label}: {activity} result**\n"
            f"**{pe['co2e_kg']:,.2f} kgCO₂e** ({pe['co2e_tonne']:.2f} tCO₂e)\n"
            f"Source: {source_label}"
        )
    return '\n\n'.join(confirmations)


# ── Calculation help triggers ─────────────────────────────────────────────────

CALCULATE_HELP_TRIGGERS = {
    'calculate my emissions factors',
    'calculate my emission factors',
    'calculate emissions',
    'calculate my emissions',
    'calculate',
    'hesapla',
    'emisyon hesapla',
}


def _is_calculation_help_prompt(text):
    return (text or '').strip().lower() in CALCULATE_HELP_TRIGGERS


def _calculation_help_text():
    return (
        "I can calculate emissions when you provide activity data.\n\n"
        "Please send **amount + unit + activity**, for example:\n"
        "• `18000 kWh electricity`\n"
        "• `5000 m3 natural gas`\n"
        "• `200 liters diesel`\n"
        "• `4000 km road travel`\n\n"
        "After calculation, you can save it to your dashboard."
    )


# ── Guided flow helpers ───────────────────────────────────────────────────────

def _fuel_quick_replies():
    return [
        {'label': 'Diesel', 'value': 'diesel', 'kind': 'fuel_type'},
        {'label': 'Petrol', 'value': 'petrol', 'kind': 'fuel_type'},
        {'label': 'LPG', 'value': 'lpg', 'kind': 'fuel_type'},
        {'label': 'Natural Gas', 'value': 'natural_gas', 'kind': 'fuel_type'},
        {'label': "Other / I'll type", 'value': 'other', 'kind': 'free_text'},
        {'label': '❌ Cancel', 'value': 'cancel', 'kind': 'cancel'},
    ]


def _get_quick_replies_for_draft(draft):
    """Return the appropriate quick replies based on what's missing."""
    missing = draft.get('missing', [])
    flow = draft.get('flow', '')

    if 'fuel_type' in missing:
        # Private car gets more options (electric, hybrid)
        if flow == 'private_car_distance':
            return [
                {'label': '⛽ Petrol', 'value': 'petrol', 'kind': 'fuel_type'},
                {'label': '🛢️ Diesel', 'value': 'diesel', 'kind': 'fuel_type'},
                {'label': '🔥 LPG', 'value': 'lpg', 'kind': 'fuel_type'},
                {'label': '⚡ Electric', 'value': 'electric', 'kind': 'fuel_type'},
                {'label': '🔋 Hybrid', 'value': 'hybrid', 'kind': 'fuel_type'},
                {'label': '❌ Cancel', 'value': 'cancel', 'kind': 'cancel'},
            ]
        return [
            {'label': 'Diesel', 'value': 'diesel', 'kind': 'fuel_type'},
            {'label': 'Petrol', 'value': 'petrol', 'kind': 'fuel_type'},
            {'label': 'LPG', 'value': 'lpg', 'kind': 'fuel_type'},
            {'label': 'Natural Gas', 'value': 'natural_gas', 'kind': 'fuel_type'},
            {'label': "Other / I'll type", 'value': 'other', 'kind': 'free_text'},
            {'label': '❌ Cancel', 'value': 'cancel', 'kind': 'cancel'},
        ]

    if 'haul_type' in missing:
        return [
            {'label': 'Domestic (<500 km)', 'value': 'flight_domestic', 'kind': 'activity'},
            {'label': 'Short haul (500-1500 km)', 'value': 'flight_short_haul', 'kind': 'activity'},
            {'label': 'Medium haul (1500-4000 km)', 'value': 'flight_medium_haul', 'kind': 'activity'},
            {'label': 'Long haul (>4000 km)', 'value': 'flight_long_haul', 'kind': 'activity'},
            {'label': '❌ Cancel', 'value': 'cancel', 'kind': 'cancel'},
        ]

    if 'transport_mode' in missing and draft.get('flow') == 'freight_mode':
        return [
            {'label': '🚛 Truck', 'value': 'truck_freight', 'kind': 'activity'},
            {'label': '🚂 Rail', 'value': 'rail_freight', 'kind': 'activity'},
            {'label': '🚢 Sea', 'value': 'sea_freight', 'kind': 'activity'},
            {'label': '✈️ Air', 'value': 'air_freight', 'kind': 'activity'},
            {'label': '❌ Cancel', 'value': 'cancel', 'kind': 'cancel'},
        ]

    if 'disposal_method' in missing:
        return [
            {'label': '🗑️ Landfill', 'value': 'waste_landfill', 'kind': 'activity'},
            {'label': '♻️ Recycling', 'value': 'waste_recyclable', 'kind': 'activity'},
            {'label': '🌱 Composting', 'value': 'waste_organic_compost', 'kind': 'activity'},
            {'label': '🔥 Incineration', 'value': 'waste_incineration', 'kind': 'activity'},
            {'label': '❌ Cancel', 'value': 'cancel', 'kind': 'cancel'},
        ]

    if 'transport_mode' in missing and draft.get('flow') == 'commute_mode':
        return [
            {'label': '🚗 Car', 'value': 'employee_commuting_car_commute', 'kind': 'activity'},
            {'label': '🚌 Bus', 'value': 'employee_commuting_bus_commute', 'kind': 'activity'},
            {'label': '🚆 Train', 'value': 'employee_commuting_train_commute', 'kind': 'activity'},
            {'label': '❌ Cancel', 'value': 'cancel', 'kind': 'cancel'},
        ]

    if 'water_type' in missing:
        return [
            {'label': '💧 Water Supply', 'value': 'water_water_supply', 'kind': 'activity'},
            {'label': '🚿 Water Treatment', 'value': 'water_water_treatment', 'kind': 'activity'},
            {'label': '❌ Cancel', 'value': 'cancel', 'kind': 'cancel'},
        ]

    return []


def _guided_question_text(draft):
    missing = draft.get('missing', [])
    vehicle = draft.get('vehicle_type', '')
    flow = draft.get('flow', '')

    if flow == 'private_car_distance' and 'fuel_type' in missing:
        count = draft.get('vehicle_count')
        qty = draft.get('quantity', 0)
        if count and count > 1:
            return (
                f"I can calculate this, but I need one more detail.\n\n"
                f"You mentioned **{count} cars** and **{qty:g} km**.\n\n"
                f"**What fuel do your cars use?**"
            )
        return "I can calculate this, but I need one more detail.\n\n**What fuel does your car use?**"

    if 'fuel_type' in missing:
        return f"I can calculate this, but I need one more detail.\n\n**What fuel do your {vehicle}s use?**"
    if 'haul_type' in missing:
        return "I can calculate this, but I need one more detail.\n\n**What type of flight is this?**"
    if 'transport_mode' in missing and flow == 'freight_mode':
        return "I can calculate this, but I need one more detail.\n\n**How was the freight transported?**"
    if 'disposal_method' in missing:
        return "I can calculate this, but I need one more detail.\n\n**How was the waste disposed?**"
    if 'transport_mode' in missing and flow == 'commute_mode':
        return "I can calculate this, but I need one more detail.\n\n**What transport mode for commuting?**"
    if 'water_type' in missing:
        return "I can calculate this, but I need one more detail.\n\n**Water supply or water treatment?**"

    return "I need one more detail to calculate this."


def _handle_guided_reply(request, session, content):
    """Handle a reply to a guided flow question (e.g. fuel type selection)."""
    draft = (session.state or {}).get('guided_draft')
    if not draft:
        return None

    selected = content.strip().lower()

    # ── Cancel handling ───────────────────────────────────────────────────
    if selected == 'cancel':
        session.state = {**(session.state or {}), 'guided_draft': None}
        session.save(update_fields=['state', 'updated_at'])
        clean_text = "Okay, calculation cancelled."
        ai_msg = ChatMessage.objects.create(session=session, role='assistant', content=clean_text)
        return Response({
            'id': ai_msg.id, 'role': 'assistant', 'content': clean_text,
            'created_at': ai_msg.created_at, 'session_title': session.title,
            'pending_entries': [], 'source': 'guided_flow',
        })

    # ── Fuel type selection (truck/car flow) ─────────────────────────────
    fuel_map = {
        'diesel': 'diesel',
        'petrol': 'petrol',
        'gasoline': 'petrol',
        'benzin': 'petrol',
        'lpg': 'lpg',
        'natural gas': 'natural_gas',
        'natural_gas': 'natural_gas',
        'electric': 'electric',
        'hybrid': 'hybrid',
    }

    fuel_type = fuel_map.get(selected)

    # ── Direct activity type selections (flight, freight, waste, commuting, water) ──
    activity_direct_map = {
        'flight_domestic': 'flight_domestic',
        'flight_short_haul': 'flight_short_haul',
        'flight_medium_haul': 'flight_medium_haul',
        'flight_long_haul': 'flight_long_haul',
        'truck_freight': 'truck_freight',
        'rail_freight': 'rail_freight',
        'sea_freight': 'sea_freight',
        'air_freight': 'air_freight',
        'waste_landfill': 'waste_landfill',
        'waste_recyclable': 'waste_recyclable',
        'waste_organic_compost': 'waste_organic_compost',
        'waste_incineration': 'waste_incineration',
        'employee_commuting_car_commute': 'employee_commuting_car_commute',
        'employee_commuting_bus_commute': 'employee_commuting_bus_commute',
        'employee_commuting_train_commute': 'employee_commuting_train_commute',
        'water_water_supply': 'water_water_supply',
        'water_water_treatment': 'water_water_treatment',
    }

    direct_activity = activity_direct_map.get(selected)

    if fuel_type:
        # Build the entry using road_travel factor (distance-based)
        entry_data = {
            'fuel_type': 'road_travel',
            'quantity': draft['quantity'],
            'unit': draft['unit'],
            'month': datetime.now(timezone.utc).month,
            'year': datetime.now(timezone.utc).year,
            'description': f"{draft.get('vehicle_type', 'vehicle')} travel using {fuel_type}",
        }
    elif direct_activity:
        entry_data = {
            'fuel_type': direct_activity,
            'quantity': draft['quantity'],
            'unit': draft['unit'],
            'month': datetime.now(timezone.utc).month,
            'year': datetime.now(timezone.utc).year,
            'description': f"{draft.get('vehicle_type', '')} — {direct_activity.replace('_', ' ')}",
        }
    else:
        # Unrecognized — ask again
        quick_replies = _get_quick_replies_for_draft(draft)
        clean_text = "Please choose an option or type it manually."
        ai_msg = ChatMessage.objects.create(
            session=session,
            role='assistant',
            content=clean_text,
            ui={'quick_replies': quick_replies},
        )
        return Response({
            'id': ai_msg.id,
            'role': 'assistant',
            'content': clean_text,
            'created_at': ai_msg.created_at,
            'session_title': session.title,
            'pending_entries': [],
            'ui': ai_msg.ui,
            'source': 'guided_flow',
        })

    pending_entries = _build_pending_entries_from_data([entry_data])

    # Clear guided draft from session state
    session.state = {**(session.state or {}), 'guided_draft': None}
    session.save(update_fields=['state', 'updated_at'])

    if pending_entries:
        clean_text = _build_pending_entries_text(pending_entries)
        ai_msg = ChatMessage.objects.create(
            session=session, role='assistant', content=clean_text,
        )
        return Response({
            'id': ai_msg.id,
            'role': 'assistant',
            'content': clean_text,
            'created_at': ai_msg.created_at,
            'session_title': session.title,
            'pending_entries': pending_entries,
            'source': 'guided_calculator',
        })

    return None


def _strip_internal_ai_artifacts(text):
    """
    Remove hidden/internal model artifacts before saving assistant message.
    Never show emission_entry JSON, factor registry dumps, or DATA CONTEXT to users.
    """
    if not text:
        return ''

    def remove_internal_block(match):
        block = match.group(0)
        lower = block.lower()
        internal_markers = [
            'emission_entry', '"fuel_type"', '"activity_type"', '"activitytype"',
            'factor_kg_co2e', 'factor_used', 'emission factor reference',
            'data context', '"quantity"', '"unit"',
        ]
        if any(marker in lower for marker in internal_markers):
            return ''
        return block

    # Remove fenced code blocks that contain internal emission data
    text = re.sub(r'```[\s\S]*?```', remove_internal_block, text, flags=re.IGNORECASE)

    # Hard remove leaked internal sections
    leak_markers = [
        'EMISSION FACTOR REFERENCE',
        'DATA CONTEXT',
        '--- DATA CONTEXT',
        '--- END DATA CONTEXT',
        '--- EMISSION FACTOR REFERENCE',
        '--- END EMISSION FACTOR REFERENCE',
    ]
    for marker in leak_markers:
        idx = text.find(marker)
        if idx != -1:
            text = text[:idx].strip()

    # Remove formula lines like "4500 km × 69.555 kg CO2e/GJ = 309.5 t CO2e"
    text = re.sub(r'\d+[\s\S]*?×[\s\S]*?=[\s\S]*?(?:kgCO2e?|tCO2e?|kg CO2e?|t CO2e?).*', '', text, flags=re.IGNORECASE)
    # Remove lines mentioning factor values
    text = re.sub(r'.*(?:emission factor|factor.*(?:kgCO2|kg CO2)).*\n?', '', text, flags=re.IGNORECASE)

    return text.strip()


# ── List sessions ─────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_sessions(request):
    # Fix #26: annotate() computes the count in a single SQL query instead of
    # issuing a separate COUNT(*) per session via prefetch_related('messages').
    # The old prefetch loaded *all* message rows into Python just for .count().
    # Fix #78: cap at the 50 most-recent sessions — returning every session a
    # user ever created would cause unbounded memory use and a bloated sidebar.
    sessions = (
        ChatSession.objects
        .filter(user=request.user)
        .annotate(message_count=Count('messages'))
        .order_by('-updated_at')[:50]
    )
    return Response([_session_to_dict(s) for s in sessions])


# ── Create session ────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_session(request):
    # Fix #79: strip + truncate to model max_length (200) so an overlong client
    # payload doesn't hit the DB and raise an unhandled DataError → 500.
    title = (request.data.get('title') or 'New Chat').strip()[:200] or 'New Chat'
    session = ChatSession.objects.create(user=request.user, title=title)
    return Response(_session_to_dict(session), status=201)


# ── Get session with messages ─────────────────────────────────────────────────
@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def session_detail(request, session_id):
    try:
        session = ChatSession.objects.get(id=session_id, user=request.user)
    except ChatSession.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    if request.method == 'DELETE':
        session.delete()
        # Fix #85: DELETE must return 204 No Content — returning 200 with a JSON body
        # is non-standard (RFC 9110 §9.3.5) and causes some HTTP clients/caches to
        # treat the response body as a stale resource representation.
        return Response(status=204)

    return Response(_session_to_dict(session, include_messages=True))


# ── Send message ──────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request, session_id):
    try:
        session = ChatSession.objects.get(id=session_id, user=request.user)
    except ChatSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=404)

    content = (request.data.get('content') or '').strip()
    ui_language = (request.data.get('language') or '').strip().lower()
    attachment = request.FILES.get('attachment')

    if not content and not attachment:
        return Response({'error': 'content or attachment is required'}, status=400)
    if not content:
        content = '[File attached]'
    # Fix #72: reject payloads that would blow up the Groq token budget or
    # trip the upstream 413 / context-length limit.
    if len(content) > MAX_MESSAGE_LENGTH:
        return Response(
            {'error': f'Message too long (max {MAX_MESSAGE_LENGTH} characters).'},
            status=400,
        )

    # Validate attachment if present
    attachment_name = ''
    if attachment:
        # Max 10MB
        if attachment.size > 10 * 1024 * 1024:
            return Response({'error': 'File too large (max 10MB).'}, status=400)
        allowed_extensions = ['.pdf', '.csv', '.xlsx', '.xls', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg']
        ext = os.path.splitext(attachment.name)[1].lower()
        if ext not in allowed_extensions:
            return Response({'error': f'File type {ext} not supported.'}, status=400)
        attachment_name = attachment.name

    # Subscription-based AI rate limiting — DISABLED until payment system is connected
    # try:
    #     from subscriptions.views import get_or_create_subscription
    #     sub = get_or_create_subscription(request.user)
    #     if not sub.can_send_ai_message:
    #         limit = sub.ai_message_limit
    #         return Response(
    #             {'error': f'Monthly AI message limit reached ({limit}). Upgrade to Pro for unlimited access.'},
    #             status=429,
    #         )
    # except Exception:
    #     pass  # If subscriptions app fails, don't block the user

    # Save user message
    user_msg = ChatMessage.objects.create(
        session=session, role='user', content=content,
        attachment=attachment if attachment else None,
        attachment_name=attachment_name,
    )

    # Fix #61: Limit the DB query to the last 20 messages so we never load an
    # unbounded message history into Python.  _call_groq already slices [-20:]
    # but that still triggered a full table scan for long sessions.
    recent = session.messages.order_by('-created_at')[:20]
    history = [
        {'role': m.role, 'content': m.content}
        for m in reversed(list(recent))
    ]

    # If attachment present, append file info to the content for AI context
    if attachment:
        history[-1]['content'] += f'\n\n[User attached file: {attachment_name}]'

    # Auto-title: use first user message — strip newlines/extra whitespace so
    # multi-line openers don't embed literal \n characters in the sidebar title.
    # Fix #74: content[:80].replace('\n',' ') normalises whitespace before storing.
    if session.title == 'New Chat' and len(history) == 1:
        session.title = ' '.join(content[:80].split()).strip() or 'New Chat'
        session.save(update_fields=['title'])

    # ─── 0) CALCULATION HELP: generic "calculate" prompts get a guide ─────
    if _is_calculation_help_prompt(content):
        clean_text = _calculation_help_text()
        ai_msg = ChatMessage.objects.create(
            session=session, role='assistant', content=clean_text,
        )
        session.save(update_fields=['updated_at'])
        return Response({
            'id': ai_msg.id,
            'role': 'assistant',
            'content': clean_text,
            'created_at': ai_msg.created_at,
            'session_title': session.title,
            'pending_entries': [],
            'source': 'calculation_guide',
        })

    # ─── 0.5) GUIDED FLOW REPLY: continue incomplete calculation ──────
    # Check NLU-based guided flow first, then legacy guided flow
    nlu_guided_response = _handle_nlu_guided_reply(request, session, content)
    if nlu_guided_response:
        return nlu_guided_response

    guided_response = _handle_guided_reply(request, session, content)
    if guided_response:
        return guided_response

    # ─── 1) LOCAL CALCULATOR: handle simple data entries without Groq ─────
    if not attachment:
        local_entry = try_local_emission_parse(content)
        if local_entry:
            pending_entries = _build_pending_entries_from_data([local_entry])
            if pending_entries:
                clean_text = _build_pending_entries_text(pending_entries)
                ai_msg = ChatMessage.objects.create(
                    session=session, role='assistant', content=clean_text,
                )
                session.save(update_fields=['updated_at'])
                return Response({
                    'id': ai_msg.id,
                    'role': 'assistant',
                    'content': clean_text,
                    'created_at': ai_msg.created_at,
                    'session_title': session.title,
                    'pending_entries': pending_entries,
                    'source': 'local_calculator',
                })

    # ─── 2) GROQ NLU: extract structured intent from message ─────────────
    if not attachment:
        nlu_result = extract_emission_intent(content)
        nlu_source = nlu_result.get('_source', 'default')

        # Only use NLU result if Groq actually responded successfully
        if nlu_source in ('groq_json_mode', 'groq_text_mode'):
            nlu_response = _handle_groq_nlu_result(session, nlu_result, content)
            if nlu_response:
                return nlu_response

    # ─── 2.5) LEGACY GUIDED DRAFT: fallback if NLU didn't handle it ───────
    if not attachment:
        guided_draft = try_guided_draft_parse(content)
        if guided_draft:
            session.state = {**(session.state or {}), 'guided_draft': guided_draft}
            session.save(update_fields=['state', 'updated_at'])

            clean_text = _guided_question_text(guided_draft)
            quick_replies = _get_quick_replies_for_draft(guided_draft)
            ai_msg = ChatMessage.objects.create(
                session=session, role='assistant', content=clean_text,
                ui={'quick_replies': quick_replies, 'flow': guided_draft.get('flow')},
            )
            return Response({
                'id': ai_msg.id,
                'role': 'assistant',
                'content': clean_text,
                'created_at': ai_msg.created_at,
                'session_title': session.title,
                'pending_entries': [],
                'ui': ai_msg.ui,
                'source': 'guided_flow',
            })

    # ─── 3) GROQ CONVERSATIONAL: for general questions, analysis ──────────
    if _get_groq_client() is None:
        return Response({'error': 'AI service not available.'}, status=503)

    # Fetch user's real emission data to give AI full context
    user_context = _get_user_emission_context(request.user)

    # Call Groq
    ai_text, error, status_code = _call_groq(history, user_context, ui_language)
    if error:
        return Response({'error': error}, status=status_code)

    # P2: Groq conversational is ONLY for general answers.
    # Save is ONLY via confirm-entry endpoint. Do NOT parse emission_entry from AI text.
    pending_entries = []

    # Clean the AI response — strip all internal artifacts (JSON blocks, factor references, etc.)
    clean_text = _strip_internal_ai_artifacts(ai_text)

    if not clean_text:
        clean_text = (
            "I can help calculate emissions. Please send amount, unit, and activity, "
            "for example: `18000 kWh electricity`."
        )

    # Save assistant message
    ai_msg = ChatMessage.objects.create(session=session, role='assistant', content=clean_text)
    session.save(update_fields=['updated_at'])

    return Response({
        'id': ai_msg.id,
        'role': 'assistant',
        'content': clean_text,
        'created_at': ai_msg.created_at,
        'session_title': session.title,
        'pending_entries': pending_entries,
    })


# ── Confirm and save pending emission entry ───────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_entry(request):
    """
    Save a pending emission entry that was calculated but not yet saved.
    Frontend sends the pending_entry data after user confirms.
    """
    entry_data = request.data
    if not entry_data or not entry_data.get('fuel_type') or not entry_data.get('quantity'):
        return Response({'error': 'Invalid entry data.'}, status=400)

    entry, err = _create_emission_from_chat(request.user, entry_data)
    if err:
        return Response({'error': err}, status=400)

    return Response({
        'id': entry.id,
        'fuel_type': entry_data.get('fuel_type'),
        'quantity': float(entry.quantity),
        'unit': entry_data.get('unit', ''),
        'co2e_kg': float(entry.calculated_co2e_kg),
        'co2e_tonne': float(entry.calculated_co2e_kg) / 1000,
        'scope': entry.emission_factor.scope if entry.emission_factor else '',
        'status': entry.status,
        'entry_status': entry.status,
    }, status=201)
