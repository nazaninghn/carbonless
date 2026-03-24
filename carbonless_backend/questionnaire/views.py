from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import QuestionnaireSession
from .flow import get_question, process_answer, QUESTIONS


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
