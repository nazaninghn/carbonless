from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import QuestionnaireSession
from .flow import get_question, process_answer, QUESTIONS, FIRST_QUESTION


# ─── Profile extractor ────────────────────────────────────────────────────────
def extract_profile(session):
    """Extract structured profile from completed questionnaire answers"""
    answers = session.answers or {}
    profile = {
        'is_complete': session.is_complete,
        'session_id': session.pk,
        'warnings': session.warnings or [],
        'answers': answers,
    }

    # Convenience helpers
    def get_val(qid):
        a = answers.get(qid, {})
        return a.get('value') or a.get('selected') or ''

    def get_selected(qid):
        a = answers.get(qid, {})
        s = a.get('selected', [])
        return [s] if isinstance(s, str) else list(s)

    # A1: Company name
    profile['company_name'] = get_val('A1')

    # A2: Tax number
    profile['tax_number'] = get_val('A2')

    # A3: Country of HQ
    profile['country_hq'] = get_val('A3')

    # A4: Reporting year
    profile['reporting_year'] = get_val('A4')

    # A5: Prepared by
    profile['prepared_by'] = get_val('A5')

    # A6: Report purpose
    profile['purposes'] = get_selected('A6')

    # A7: Previous report
    a7 = answers.get('A7', {})
    profile['has_previous_report'] = a7.get('value') == 'yes' or a7.get('selected') == 'yes'

    # A7a: Baseline year
    profile['baseline_year'] = get_val('A7a')

    # B1: Sector (NACE)
    profile['sector'] = get_val('B1')

    # B2: Activity description
    profile['activity_description'] = get_val('B2')

    # B3: Employee count band
    profile['employee_band'] = get_val('B3')

    # B4: Location count
    profile['location_count'] = get_val('B4')

    # Phase-level flags
    scope_answers = {k: v for k, v in answers.items() if k.startswith('3') or k.startswith('4') or k.startswith('5')}
    profile['has_scope1_data'] = any(k.startswith('3') for k in scope_answers)
    profile['has_scope2_data'] = any(k.startswith('4') for k in scope_answers)
    profile['has_scope3_data'] = any(k.startswith('5') for k in scope_answers)

    return profile


# ─── Views ────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_session(request):
    """Start a new questionnaire session or resume an existing one"""
    lang = request.data.get('lang', 'tr')

    # Resume existing incomplete session
    existing = QuestionnaireSession.objects.filter(
        user=request.user, is_complete=False
    ).first()

    if existing:
        q = get_question(existing.current_question, lang)
        return Response({
            'session_id': existing.pk,
            'question': q,
            'answers': existing.answers,
            'warnings': existing.warnings,
            'resumed': True,
        })

    # New session
    session = QuestionnaireSession.objects.create(
        user=request.user,
        current_question=FIRST_QUESTION,
    )
    q = get_question(FIRST_QUESTION, lang)
    return Response({
        'session_id': session.pk,
        'question': q,
        'answers': {},
        'warnings': [],
        'resumed': False,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def answer_question(request):
    """Submit an answer and get the next question"""
    session_id  = request.data.get('session_id')
    question_id = request.data.get('question_id')
    answer_data = request.data.get('answer', {})
    lang        = request.data.get('lang', 'tr')

    try:
        session = QuestionnaireSession.objects.get(pk=session_id, user=request.user)
    except QuestionnaireSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=404)

    if session.is_complete:
        return Response({'error': 'Session already complete'}, status=400)

    # Save this answer (even if skipped)
    session.answers[question_id] = answer_data

    # Process → get next question + warnings
    result = process_answer(session.answers, question_id, answer_data)

    if result.get('error'):
        return Response(result, status=400)

    # Accumulate warnings
    new_warnings = result.get('warnings', [])
    if new_warnings:
        session.warnings = (session.warnings or []) + new_warnings

    if result['is_complete']:
        session.is_complete  = True
        session.completed_at = timezone.now()
        session.current_question = 'DONE'
    else:
        session.current_question = result['next_question']

    session.save()

    response = {
        'session_id':    session.pk,
        'warnings':      new_warnings,
        'all_warnings':  session.warnings,
        'is_complete':   result['is_complete'],
    }

    if result['is_complete']:
        response['summary'] = session.answers
    else:
        response['question'] = get_question(result['next_question'], lang)

    return Response(response)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_sessions(request):
    """List questionnaire sessions for the current user"""
    sessions = QuestionnaireSession.objects.filter(user=request.user)
    return Response([{
        'id':               s.pk,
        'started_at':       s.started_at,
        'completed_at':     s.completed_at,
        'is_complete':      s.is_complete,
        'current_question': s.current_question,
        'answer_count':     len(s.answers or {}),
        'warning_count':    len(s.warnings or []),
    } for s in sessions])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_session(request):
    """Delete all incomplete sessions and start fresh"""
    QuestionnaireSession.objects.filter(user=request.user, is_complete=False).delete()
    return Response({'status': 'ok'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile(request):
    """Return structured profile from the latest completed session"""
    session = QuestionnaireSession.objects.filter(
        user=request.user, is_complete=True
    ).first()

    if not session:
        incomplete = QuestionnaireSession.objects.filter(
            user=request.user, is_complete=False
        ).first()
        if incomplete:
            total = len(QUESTIONS)
            done  = len(incomplete.answers or {})
            return Response({
                'status':           'incomplete',
                'current_question': incomplete.current_question,
                'progress_count':   done,
                'total_questions':  total,
                'progress_pct':     round(done / total * 100) if total else 0,
            })
        return Response({'status': 'not_started'})

    profile = extract_profile(session)
    profile['status'] = 'complete'
    return Response(profile)
