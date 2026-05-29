import os
from datetime import datetime
from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ChatSession, ChatMessage

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
Generate a professional ISO 14064-1 style summary using their actual numbers."""


def _get_user_emission_context(user):
    """Fetch the user's real emission data to inject into the AI system prompt."""
    try:
        from django.db.models import Sum
        from emissions.models import EmissionEntry
        from companies.utils import get_current_company

        company = get_current_company(user)
        if not company:
            return ''

        year = datetime.now().year
        entries = EmissionEntry.objects.filter(company=company, year=year).select_related('emission_factor')
        total_kg = float(entries.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)

        if total_kg == 0:
            # Try previous year
            year -= 1
            entries = EmissionEntry.objects.filter(company=company, year=year).select_related('emission_factor')
            total_kg = float(entries.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)

        if total_kg == 0:
            return f'\n\nDATA CONTEXT:\nCompany: {company.legal_entity_name}\nNo emission entries recorded yet.'

        s1 = float(entries.filter(emission_factor__scope='scope1').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
        s2 = float(entries.filter(emission_factor__scope='scope2').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
        s3 = float(entries.filter(emission_factor__scope='scope3').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
        entry_count = entries.count()

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
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        return None
    try:
        from groq import Groq
        return Groq(api_key=api_key)
    except Exception:
        return None


def _call_groq(messages_history, user_context=''):
    """Call Groq API with conversation history and optional user data context."""
    client = _get_groq_client()
    if not client:
        return None, 'GROQ_API_KEY not configured'

    system_prompt = BASE_SYSTEM_PROMPT + user_context

    groq_messages = [{'role': 'system', 'content': system_prompt}]
    for msg in messages_history[-20:]:
        groq_messages.append({'role': msg['role'], 'content': msg['content']})

    try:
        response = client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=groq_messages,
            temperature=0.7,
            max_tokens=1500,
        )
        return response.choices[0].message.content, None
    except Exception as e:
        return None, str(e)


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
        data['messages'] = [
            {'id': m.id, 'role': m.role, 'content': m.content, 'created_at': m.created_at}
            for m in session.messages.all()
        ]
    return data


# ── List sessions ─────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_sessions(request):
    # Fix #26: annotate() computes the count in a single SQL query instead of
    # issuing a separate COUNT(*) per session via prefetch_related('messages').
    # The old prefetch loaded *all* message rows into Python just for .count().
    sessions = (
        ChatSession.objects
        .filter(user=request.user)
        .annotate(message_count=Count('messages'))
        .order_by('-updated_at')
    )
    return Response([_session_to_dict(s) for s in sessions])


# ── Create session ────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_session(request):
    title = request.data.get('title', 'New Chat')
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
        return Response({'status': 'ok'})

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
    if not content:
        return Response({'error': 'content is required'}, status=400)

    # Save user message
    ChatMessage.objects.create(session=session, role='user', content=content)

    # Build history for Groq
    history = [
        {'role': m.role, 'content': m.content}
        for m in session.messages.all()
    ]

    # Auto-title: use first user message (truncated)
    if session.title == 'New Chat' and len(history) == 1:
        session.title = content[:80]
        session.save(update_fields=['title'])

    # Fetch user's real emission data to give AI full context
    user_context = _get_user_emission_context(request.user)

    # Call Groq
    ai_text, error = _call_groq(history, user_context)
    if error:
        return Response({'error': f'AI error: {error}'}, status=502)

    # Save assistant message
    ai_msg = ChatMessage.objects.create(session=session, role='assistant', content=ai_text)
    session.save(update_fields=['updated_at'])

    return Response({
        'id': ai_msg.id,
        'role': 'assistant',
        'content': ai_text,
        'created_at': ai_msg.created_at,
        'session_title': session.title,
    })
