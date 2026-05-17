import os
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import ChatSession, ChatMessage

SYSTEM_PROMPT = """You are CarbonIQ, an expert AI assistant specialized in carbon accounting,
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
(e.g. IPCC, DEFRA, IEA). Keep responses concise but complete. If asked in Turkish, respond in Turkish."""


def _get_groq_client():
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        return None
    try:
        from groq import Groq
        return Groq(api_key=api_key)
    except Exception:
        return None


def _call_groq(messages_history):
    """Call Groq API with conversation history. Returns (text, error)."""
    client = _get_groq_client()
    if not client:
        return None, 'GROQ_API_KEY not configured'

    groq_messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]
    # Keep last 20 messages for context
    for msg in messages_history[-20:]:
        groq_messages.append({'role': msg['role'], 'content': msg['content']})

    try:
        response = client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=groq_messages,
            temperature=0.7,
            max_tokens=1024,
        )
        return response.choices[0].message.content, None
    except Exception as e:
        return None, str(e)


def _session_to_dict(session, include_messages=False):
    data = {
        'id': session.id,
        'title': session.title,
        'created_at': session.created_at,
        'updated_at': session.updated_at,
        'message_count': session.messages.count(),
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
    sessions = ChatSession.objects.filter(user=request.user).prefetch_related('messages')
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

    # Call Groq
    ai_text, error = _call_groq(history)
    if error:
        return Response({'error': f'AI error: {error}'}, status=502)

    # Save assistant message
    ai_msg = ChatMessage.objects.create(session=session, role='assistant', content=ai_text)
    session.save(update_fields=['updated_at'])  # bump updated_at

    return Response({
        'id': ai_msg.id,
        'role': 'assistant',
        'content': ai_text,
        'created_at': ai_msg.created_at,
        'session_title': session.title,
    })
