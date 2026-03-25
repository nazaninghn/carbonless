from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import QuestionnaireSession
from .flow import get_question, process_answer, QUESTIONS


def extract_profile(session):
    """Extract structured profile data from completed questionnaire answers"""
    answers = session.answers or {}
    profile = {
        'is_complete': session.is_complete,
        'session_id': session.pk,
    }

    # S1: Reporting period
    s1 = answers.get('S1', {})
    sel = s1.get('selected', '')
    if sel == 'C1.1':
        profile['period_type'] = 'calendar_year'
        profile['period_year'] = s1.get('input_C1.1', '')
    elif sel == 'C1.2':
        profile['period_type'] = 'fiscal_year'
        profile['period_range'] = s1.get('input_C1.2', '')
    elif sel == 'C1.3':
        profile['period_type'] = 'custom'
        profile['period_range'] = s1.get('input_C1.3', '')

    # S2: Consistent reporting
    s2 = answers.get('S2', {})
    profile['consistent_reporting'] = s2.get('selected', '')

    # S3: Previous inventory
    s3 = answers.get('S3', {})
    sel3 = s3.get('selected', '')
    profile['has_previous_inventory'] = sel3 == 'C3.1'
    profile['has_unofficial_study'] = sel3 == 'C3.3'

    # S4: Base year
    s4 = answers.get('S4', {})
    sel4 = s4.get('selected', '')
    if sel4 == 'C4.1':
        profile['has_base_year'] = True
        profile['base_year'] = s4.get('input_C4.1', '')
    else:
        profile['has_base_year'] = False

    # S5: Purpose
    s5 = answers.get('S5', {})
    selected5 = s5.get('selected', [])
    if isinstance(selected5, str):
        selected5 = [selected5]
    purpose_map = {
        'C5.1': 'iso_14064_verification',
        'C5.2': 'internal_reporting',
        'C5.3': 'group_reporting',
        'C5.4': 'financing',
        'C5.5': 'export_pressure',
        'C5.6': 'other',
    }
    profile['purposes'] = [purpose_map.get(k, k) for k in selected5]
    if 'C5.6' in selected5:
        profile['purpose_other'] = s5.get('input_C5.6', '')

    # S6: Third-party verification
    s6 = answers.get('S6', {})
    sel6 = s6.get('selected', '')
    profile['verification_planned'] = sel6 == 'C6.1'
    profile['verification_within_12m'] = sel6 == 'C6.2'
    if sel6 == 'C6.1':
        profile['verification_date'] = s6.get('input_C6.1', '')

    # S7: Emission factor source preference
    s7 = answers.get('S7', {})
    sel7 = s7.get('selected', '')
    source_map = {
        'C7.1': 'national',
        'C7.2': 'defra',
        'C7.3': 'ipcc',
        'C7.4': 'mixed',
        'C7.5': 'unsure',
    }
    profile['preferred_factor_source'] = source_map.get(sel7, 'mixed')

    # S8: Public report
    s8 = answers.get('S8', {})
    profile['report_public'] = s8.get('selected', '') == 'C8.1'

    # S9: Report language
    s9 = answers.get('S9', {})
    sel9 = s9.get('selected', '')
    lang_map = {'C9.1': 'tr', 'C9.2': 'en', 'C9.3': 'bilingual'}
    profile['report_language'] = lang_map.get(sel9, 'tr')

    profile['warnings'] = session.warnings or []

    return profile


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_session(request):
    """Start a new questionnaire session or resume existing one"""
    # Check for existing incomplete session
    existing = QuestionnaireSession.objects.filter(
        user=request.user, is_complete=False
    ).first()
    if existing:
        lang = request.data.get('lang', 'tr')
        q = get_question(existing.current_question, lang)
        return Response({
            'session_id': existing.pk,
            'question': q,
            'answers': existing.answers,
            'warnings': existing.warnings,
            'resumed': True,
        })

    session = QuestionnaireSession.objects.create(user=request.user)
    lang = request.data.get('lang', 'tr')
    q = get_question('S1', lang)
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
    session_id = request.data.get('session_id')
    question_id = request.data.get('question_id')
    answer_data = request.data.get('answer', {})
    lang = request.data.get('lang', 'tr')

    try:
        session = QuestionnaireSession.objects.get(pk=session_id, user=request.user)
    except QuestionnaireSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=404)

    if session.is_complete:
        return Response({'error': 'Session already complete'}, status=400)

    # Save answer
    session.answers[question_id] = answer_data

    # Process and get next
    result = process_answer(session.answers, question_id, answer_data)

    if result.get('error'):
        return Response(result, status=400)

    # Save warnings
    if result['warnings']:
        session.warnings = session.warnings + result['warnings']

    if result['is_complete']:
        session.is_complete = True
        session.completed_at = timezone.now()
        session.current_question = 'DONE'
    else:
        session.current_question = result['next_question']

    session.save()

    response = {
        'session_id': session.pk,
        'warnings': result['warnings'],
        'is_complete': result['is_complete'],
        'all_warnings': session.warnings,
    }

    if not result['is_complete']:
        response['question'] = get_question(result['next_question'], lang)
    else:
        response['summary'] = session.answers

    return Response(response)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_sessions(request):
    """Get all questionnaire sessions for the user"""
    sessions = QuestionnaireSession.objects.filter(user=request.user)
    data = [{
        'id': s.pk,
        'started_at': s.started_at,
        'completed_at': s.completed_at,
        'is_complete': s.is_complete,
        'current_question': s.current_question,
        'answers': s.answers,
        'warnings': s.warnings,
    } for s in sessions]
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_session(request):
    """Delete incomplete sessions and start fresh"""
    QuestionnaireSession.objects.filter(user=request.user, is_complete=False).delete()
    return Response({'status': 'ok'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile(request):
    """Get the structured profile from the latest completed questionnaire"""
    session = QuestionnaireSession.objects.filter(
        user=request.user, is_complete=True
    ).first()

    if not session:
        # Check for incomplete
        incomplete = QuestionnaireSession.objects.filter(
            user=request.user, is_complete=False
        ).first()
        if incomplete:
            return Response({
                'status': 'incomplete',
                'current_question': incomplete.current_question,
                'progress': list(incomplete.answers.keys()),
            })
        return Response({'status': 'not_started'})

    profile = extract_profile(session)
    profile['status'] = 'complete'
    return Response(profile)
