import logging
import os
import re
from datetime import datetime, timezone
from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ChatSession, ChatMessage
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

BASE_SYSTEM_PROMPT = """You are CarbonIQ, an expert AI assistant specialized in carbon accounting,
greenhouse gas (GHG) reporting, and sustainability. You help companies measure, report, and reduce
their carbon footprint following ISO 14064-1 standards and GHG Protocol.

You can help with:
- Scope 1, 2, and 3 emissions calculations and methodology
- ISO 14064-1 reporting requirements and structure
- Emission factors and activity data guidance
- Carbon reduction strategies and best practices
- GHG inventory boundary setting (operational control, financial control, equity share)
- Data quality, uncertainty, and verification
- Turkish and English language support

Always be professional, accurate, and helpful. Keep responses concise but complete.
If asked in Turkish, respond in Turkish.

IMPORTANT: When the user asks for a report, summary, or analysis of their emissions, use the
real data provided in the DATA CONTEXT section below. Do NOT ask them to provide data you already have.
Generate a professional ISO 14064-1 style summary using their actual numbers.

CRITICAL — EMISSION FACTORS ARE PROVIDED, NEVER GUESSED:
An "EMISSION FACTOR REFERENCE" section below lists every activity type this system can currently
calculate, with its exact registered emission factor. You MUST use ONLY those numbers and cite the
source given there. NEVER use a DEFRA/IPCC/IEA/GLEC figure from your own training data — even if the
user's activity looks like a textbook example, the registered value in the reference below is the one
this company's report is legally based on, and it may differ from generic published averages.
If the user's activity/unit does not appear in the reference, say so plainly and ask them to enter it
manually in the dashboard — do NOT estimate a number yourself.

CRITICAL — EMISSION DATA ENTRY:
When the user provides activity data for something that IS listed in the EMISSION FACTOR REFERENCE
(e.g. "5000 m³ natural gas", "18000 kWh electricity", "2000 km road travel", "45 tonnes shipped 1200 km
by truck"), you MUST include a JSON block in your response so the system can save it. The system —
not you — performs the final kg CO2e multiplication using the real registered factor, so you do not
need to (and should not try to) compute the total yourself; just extract the structured activity data.

IMPORTANT: When you show the calculation to the user, use the EXACT factor value from the EMISSION
FACTOR REFERENCE below. The result you show in text MUST match the system's saved result. Use this
formula: quantity × factor_from_reference = total kgCO2e. Round to 2 decimal places for kgCO2e and
4 decimal places for tCO2e. This ensures the chat and dashboard always show the same numbers.

Format your response like this:

1. A SHORT confirmation (1-2 sentences max) that you understood the data
2. Show the calculation in ONE line: quantity × factor = result kgCO₂e
3. Then include this EXACT JSON block (the system will parse it and save it):

```emission_entry
{
  "fuel_type": "natural_gas",
  "quantity": 5000,
  "unit": "m3",
  "month": 1,
  "year": 2024,
  "description": "Natural gas consumption"
}
```

IMPORTANT FORMATTING RULES:
- Keep your text response SHORT and to the point. No lengthy explanations.
- Do NOT show the JSON block to the user or explain it — the system handles it invisibly.
- Do NOT repeat the emission factor reference or list available activities unless asked.
- Just confirm, show the one-line calculation, and include the hidden JSON block.
- The JSON block MUST use ```emission_entry as the fence language (not ```json).

`fuel_type` must be one of the exact `activity_type` values listed in the EMISSION FACTOR REFERENCE
below and `unit` must be one of that activity's listed units, exactly as written there.
If month is not specified, use the current month. If year is not specified, use the current year.
Always ask for clarification if the activity type or unit is ambiguous.
If the user says something like "monthly" or "per month", create ONE entry for the current month.
DO NOT create emission entries for hypothetical questions or examples — only for actual consumption/activity data."""


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
            {'id': m.id, 'role': m.role, 'content': m.content, 'created_at': m.created_at}
            for m in msgs
        ]
    return data


# ── Local emission calculator (no Groq needed) ────────────────────────────────

LOCAL_ACTIVITY_ALIASES = {
    'electricity': ['electricity', 'elektrik', 'grid electricity', 'برق'],
    'natural_gas': ['natural gas', 'doğalgaz', 'dogalgaz', 'gas', 'گاز'],
    'diesel': ['diesel', 'mazot', 'دیزل', 'گازوییل'],
    'petrol': ['petrol', 'gasoline', 'benzin', 'بنزین'],
    'lpg': ['lpg'],
    'coal': ['coal', 'kömür', 'komur', 'زغال'],
    'road_travel': ['car', 'road', 'drive', 'araba', 'ماشین', 'خودرو'],
    'water_water_supply': ['water supply', 'su', 'آب'],
}


def _normalise_unit(unit):
    unit = (unit or '').strip().lower()
    return {
        'm³': 'm3', 'm^3': 'm3',
        'kw/h': 'kwh', 'kw h': 'kwh',
        'liter': 'liters', 'litre': 'liters', 'litres': 'liters', 'l': 'liters', 'lt': 'liters',
        'ton': 'tonne', 'tons': 'tonne', 'tonnes': 'tonne',
        'tkm': 'tonne-km',
    }.get(unit, unit)


def _detect_activity_type(text):
    t = text.lower()
    for activity_type, aliases in LOCAL_ACTIVITY_ALIASES.items():
        if any(alias in t for alias in aliases):
            return activity_type
    if 'kwh' in t or 'kw/h' in t:
        return 'electricity'
    if ('m3' in t or 'm³' in t or 'm^3' in t) and 'gas' in t:
        return 'natural_gas'
    return None


def _try_local_emission_parse(text):
    """Try to parse a simple emission data entry from user text without Groq."""
    if not text:
        return None

    lower_text = text.lower()

    # Skip questions / analysis requests
    question_words = [
        'how', 'why', 'what', 'explain', 'summarize', 'report', 'reduce', 'strategy',
        'iso', 'ghg', 'nasıl', 'neden', 'nedir', 'özetle', 'rapor',
        'چطور', 'چگونه', 'چرا', 'چیست', 'گزارش', 'توضیح',
    ]
    if '?' in text or any(q in lower_text for q in question_words):
        return None

    pattern = (
        r'(?P<quantity>\d+(?:[.,]\d+)?)\s*'
        r'(?P<unit>kwh|kw/h|m3|m³|m\^3|liters?|litres?|l|lt|kg|km|tonne-km|tkm|gj)\b'
    )
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None

    activity_type = _detect_activity_type(text)
    if not activity_type:
        return None

    quantity = match.group('quantity').replace(',', '.')
    unit = _normalise_unit(match.group('unit'))

    return {
        'fuel_type': activity_type,
        'quantity': float(quantity),
        'unit': unit,
        'month': datetime.now(timezone.utc).month,
        'year': datetime.now(timezone.utc).year,
        'description': f'AI Chat: {activity_type} {quantity} {unit}',
    }


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
                'scope': factor.scope,
            })
        elif err:
            logger.warning('Local emission resolve failed: %s', err)
    return pending_entries


def _build_pending_entries_text(pending_entries):
    """Build clean display text for pending entries."""
    confirmations = []
    for pe in pending_entries:
        scope_label = pe['scope'].replace('scope', 'Scope ') if pe['scope'] else ''
        confirmations.append(
            f"✅ **{scope_label}**: "
            f"{pe['fuel_type'].replace('_', ' ').title()} — "
            f"{pe['quantity']:g} {pe['unit']} × {pe['factor_used']:.4f} = "
            f"**{pe['co2e_kg']:.2f} kgCO₂e** ({pe['co2e_tonne']:.4f} tCO₂e)"
        )
    return '\n'.join(confirmations)


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

    # ─── 1) LOCAL CALCULATOR: handle simple data entries without Groq ─────
    if not attachment:
        local_entry = _try_local_emission_parse(content)
        if local_entry:
            pending_entries = _build_pending_entries_from_data([local_entry])
            if pending_entries:
                clean_text = _build_pending_entries_text(pending_entries)
                clean_text += '\n\nWould you like to save this to your dashboard?'
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

    # ─── 2) GROQ: for questions, analysis, complex inputs ─────────────────
    if _get_groq_client() is None:
        return Response({'error': 'AI service not available.'}, status=503)

    # Fetch user's real emission data to give AI full context
    user_context = _get_user_emission_context(request.user)

    # Call Groq
    ai_text, error, status_code = _call_groq(history, user_context, ui_language)
    if error:
        return Response({'error': error}, status=status_code)

    # Parse emission entries from AI response — DO NOT save yet, return as pending
    pending_entries = _build_pending_entries_from_data(_parse_emission_entry(ai_text))

    # Clean the AI response — strip all internal artifacts (JSON blocks, factor references, etc.)
    clean_text = _strip_internal_ai_artifacts(ai_text)

    # If pending entries exist, replace response with clean calculation summary
    if pending_entries:
        clean_text = _build_pending_entries_text(pending_entries)
        clean_text += '\n\nWould you like to save this to your dashboard?'
    elif not clean_text:
        clean_text = (
            "I can help calculate emissions. Please send amount, unit, and activity, "
            "for example: `18000 kWh electricity`."
        )

    # Save assistant message
    ai_msg = ChatMessage.objects.create(session=session, role='assistant', content=clean_text)
    session.save(update_fields=['updated_at'])

    # Track AI usage — DISABLED until payment system is connected
    # try:
    #     from subscriptions.views import get_or_create_subscription
    #     sub = get_or_create_subscription(request.user)
    #     sub.increment_ai_usage()
    # except Exception:
    #     pass

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
        'status': 'saved',
    }, status=201)
