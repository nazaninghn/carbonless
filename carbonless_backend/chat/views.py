import logging
import os
from datetime import datetime, timezone
from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ChatSession, ChatMessage

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

Always be professional, accurate, and helpful. When giving numerical data, cite your source
(e.g. IPCC, DEFRA, IEA). Keep responses concise but complete. If asked in Turkish, respond in Turkish.

IMPORTANT: When the user asks for a report, summary, or analysis of their emissions, use the
real data provided in the DATA CONTEXT section below. Do NOT ask them to provide data you already have.
Generate a professional ISO 14064-1 style summary using their actual numbers.

CRITICAL — EMISSION DATA ENTRY:
When the user provides emission/consumption data (e.g. "5000 m³ natural gas", "18000 kWh electricity",
"500 liters diesel"), you MUST include a JSON block in your response to save it to the database.
Format your response like this:

1. First give a normal text response acknowledging the data
2. Then include this EXACT JSON block (the system will parse and save it automatically):

```emission_entry
{
  "fuel_type": "natural_gas",
  "quantity": 5000,
  "unit": "m³",
  "month": 1,
  "year": 2024,
  "description": "Natural gas consumption - head office"
}
```

Valid fuel_type values: natural_gas, diesel, lpg, fuel_oil, coal, electricity, petrol, kerosene, biodiesel
Valid units: m³, kWh, litre, kg, tonne, GJ, MWh
If month is not specified, use the current month. If year is not specified, use the current year.
Always ask for clarification if the fuel type or unit is ambiguous.
If the user says something like "monthly" or "per month", create ONE entry for the current month.
DO NOT create emission entries for hypothetical questions or examples — only for actual consumption data."""


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
    Returns list of parsed emission data dicts, or empty list if none found.
    """
    import json
    import re
    entries = []
    # Find all ```emission_entry ... ``` blocks
    pattern = r'```emission_entry\s*\n(.*?)\n```'
    matches = re.findall(pattern, ai_text, re.DOTALL)
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
    Returns (entry, error_message) tuple.
    """
    from emissions.models import EmissionFactor, EmissionEntry as EEntry
    from companies.utils import get_current_company

    company = get_current_company(user)
    if not company:
        return None, 'No company found. Please create a company first.'

    fuel_type = entry_data.get('fuel_type', '').lower().replace(' ', '_')
    quantity = entry_data.get('quantity')
    unit = entry_data.get('unit', '')
    month = entry_data.get('month', datetime.now(timezone.utc).month)
    year = entry_data.get('year', datetime.now(timezone.utc).year)
    description = entry_data.get('description', '')

    # Map fuel_type to slug patterns for EmissionFactor lookup
    fuel_to_slug = {
        'natural_gas': 'natural-gas',
        'diesel': 'diesel',
        'lpg': 'lpg',
        'fuel_oil': 'fuel-oil',
        'coal': 'coal',
        'petrol': 'motor-gasoline',
        'kerosene': 'kerosene',
        'biodiesel': 'biodiesel',
        'electricity': 'grid-electricity',
    }

    slug = fuel_to_slug.get(fuel_type, fuel_type.replace('_', '-'))

    # Common unit conversions to match available factors
    # Natural gas: 1 m³ ≈ 0.0388 GJ (gross calorific value)
    # Electricity is in kWh, factors might be in kWh or GJ
    UNIT_CONVERSIONS = {
        ('natural_gas', 'm3'): ('gj', 0.0388),
        ('natural_gas', 'm³'): ('gj', 0.0388),
        ('diesel', 'litre'): ('liters', 1.0),
        ('diesel', 'liter'): ('liters', 1.0),
        ('diesel', 'l'): ('liters', 1.0),
        ('lpg', 'litre'): ('liters', 1.0),
        ('lpg', 'liter'): ('liters', 1.0),
        ('lpg', 'l'): ('liters', 1.0),
        ('fuel_oil', 'litre'): ('liters', 1.0),
        ('fuel_oil', 'liter'): ('liters', 1.0),
        ('electricity', 'kwh'): ('kWh', 1.0),
        ('electricity', 'mwh'): ('kWh', 1000.0),
    }

    # Determine the scope
    if fuel_type == 'electricity':
        scope = 'scope2'
    else:
        scope = 'scope1'

    # Normalize unit and apply conversion
    unit_lower = unit.lower().replace(' ', '')
    conversion_key = (fuel_type, unit_lower)
    converted_quantity = float(quantity)
    target_unit = unit

    if conversion_key in UNIT_CONVERSIONS:
        target_unit, factor_mult = UNIT_CONVERSIONS[conversion_key]
        converted_quantity = float(quantity) * factor_mult

    # Find matching emission factor by slug
    factor = EmissionFactor.objects.filter(
        slug=slug,
        is_active=True,
        is_default=True,
    ).first()

    # Try contains match
    if not factor:
        factor = EmissionFactor.objects.filter(
            slug__icontains=slug,
            is_active=True,
            is_default=True,
        ).first()

    # Fallback: try broader name search
    if not factor:
        search_name = fuel_type.replace('_', ' ')
        factor = EmissionFactor.objects.filter(
            name__icontains=search_name,
            is_active=True,
            is_default=True,
        ).first()

    if not factor:
        return None, f'No emission factor found for {fuel_type} ({unit}). Please add it manually in the dashboard.'

    # Calculate CO2e
    from decimal import Decimal
    qty = Decimal(str(converted_quantity))
    co2e_kg = qty * factor.factor_kg_co2e

    # Create entry
    entry = EEntry.objects.create(
        user=user,
        company=company,
        emission_factor=factor,
        year=year,
        month=month,
        quantity=qty,
        calculated_co2e_kg=co2e_kg,
        description=description or f'AI Chat: {fuel_type} {quantity} {unit}',
        factor_value_snapshot=factor.factor_kg_co2e,
        factor_source_snapshot=factor.source,
        status='approved',
    )

    return entry, None


def _call_groq(messages_history, user_context=''):
    """Call Groq API with conversation history and optional user data context."""
    client = _get_groq_client()
    if not client:
        # Fix #97: never expose internal config details (missing API key) to the
        # client — log server-side only and return a generic message.
        logger.error('GROQ_API_KEY not set or Groq client failed to initialise')
        return None, 'AI service not available.'

    system_prompt = BASE_SYSTEM_PROMPT + user_context

    groq_messages = [{'role': 'system', 'content': system_prompt}]
    for msg in messages_history[-20:]:
        groq_messages.append({'role': msg['role'], 'content': msg['content']})

    try:
        # Fix #73: 30-second timeout prevents the Django worker thread from blocking
        # indefinitely when Groq is slow or unreachable.
        response = client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=groq_messages,
            temperature=0.7,
            max_tokens=1500,
            timeout=30,
        )
        return response.choices[0].message.content, None
    except Exception as e:
        # Fix #96: log the raw exception server-side for debugging, but return a
        # generic string to the caller so internal details (SDK error messages,
        # rate-limit headers, potential stack info) are never sent to the browser.
        logger.error('Groq API error: %s', e, exc_info=True)
        return None, 'AI service temporarily unavailable. Please try again.'


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

    # Fix #102: verify the AI client is available BEFORE writing the user message
    # to the DB.  Without this check, a missing GROQ_API_KEY would save the user
    # message and then immediately return 502, leaving an orphaned message in the
    # session that reappears on every reload with no corresponding AI response.
    if _get_groq_client() is None:
        return Response({'error': 'AI service not available.'}, status=503)

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

    # Fetch user's real emission data to give AI full context
    user_context = _get_user_emission_context(request.user)

    # Call Groq
    ai_text, error = _call_groq(history, user_context)
    if error:
        # Fix #107: _call_groq already returns a user-friendly message; wrapping
        # it in "AI error: ..." created an awkward double-prefix in the UI.
        return Response({'error': error}, status=502)

    # Parse and create emission entries from AI response
    saved_entries = []
    emission_blocks = _parse_emission_entry(ai_text)
    for entry_data in emission_blocks:
        entry, err = _create_emission_from_chat(request.user, entry_data)
        if entry:
            saved_entries.append({
                'id': entry.id,
                'fuel_type': entry_data.get('fuel_type'),
                'quantity': float(entry.quantity),
                'unit': entry_data.get('unit'),
                'co2e_kg': float(entry.calculated_co2e_kg),
                'co2e_tonne': float(entry.calculated_co2e_kg) / 1000,
            })
            logger.info('AI Chat created EmissionEntry id=%s for user=%s: %s %s %s → %.2f kgCO2e',
                        entry.id, request.user.username, entry_data.get('fuel_type'),
                        entry.quantity, entry_data.get('unit'), float(entry.calculated_co2e_kg))

    # Clean the AI response — remove the ```emission_entry blocks before saving
    import re
    clean_text = re.sub(r'```emission_entry\s*\n.*?\n```', '', ai_text, flags=re.DOTALL).strip()

    # If entries were saved, append a confirmation to the visible message
    if saved_entries:
        confirmations = []
        for se in saved_entries:
            confirmations.append(
                f"✅ **Saved:** {se['fuel_type'].replace('_',' ').title()} — "
                f"{se['quantity']} {se['unit']} → {se['co2e_tonne']:.3f} tCO₂e"
            )
        clean_text += '\n\n' + '\n'.join(confirmations)

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
        'saved_entries': saved_entries,
    })
