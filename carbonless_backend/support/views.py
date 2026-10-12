from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AnswerFeedback, SupportRequest


def _request_dict(r):
    return {
        'id': r.id, 'question': r.question, 'topic': r.topic, 'source': r.source, 'status': r.status,
        'answer': r.answer, 'answered_at': r.answered_at, 'created_at': r.created_at,
        'session_id': r.session_id,
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def support_requests(request):
    """GET: the user's own requests (with the team's answers).
    POST {question, session_id?, language?}: ask the support team."""
    if request.method == 'GET':
        rows = SupportRequest.objects.filter(user=request.user)[:50]
        return Response([_request_dict(r) for r in rows])
    from chat.models import ChatSession
    from .service import create_request, referral_text
    question = (request.data.get('question') or '').strip()
    if len(question) < 3:
        return Response({'error': 'Write your question.', 'code': 'empty_question'}, status=400)
    session = None
    if request.data.get('session_id'):
        session = ChatSession.objects.filter(user=request.user, pk=request.data.get('session_id')).first()
    lang = 'en' if request.data.get('language') == 'en' else 'tr'
    req = create_request(request.user, question, source='user', session=session, lang=lang)
    text = referral_text(req, lang)
    message_id = None
    if session is not None:
        # Kept in the chat, so it is still there when the chat is reopened.
        msg = session.messages.create(role='assistant', content=text,
                                      ui={'support_request_id': req.pk, 'referred': True})
        session.save(update_fields=['updated_at'])
        message_id = msg.id
    return Response({**_request_dict(req), 'message': text, 'message_id': message_id}, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def answer_feedback(request):
    """POST {message_id, helpful, comment?}: 👍 / 👎 on an assistant answer
    (sending again changes it)."""
    from chat.models import ChatMessage
    from companies.utils import get_current_company
    msg = (ChatMessage.objects.filter(pk=request.data.get('message_id'), role='assistant',
                                      session__user=request.user).select_related('session').first())
    if msg is None:
        return Response({'error': 'Message not found'}, status=404)
    helpful = request.data.get('helpful')
    if not isinstance(helpful, bool):
        return Response({'error': 'helpful must be true or false'}, status=400)
    asked = (msg.session.messages.filter(role='user', created_at__lte=msg.created_at)
             .order_by('-created_at').values_list('content', flat=True).first()) or ''
    fb, _ = AnswerFeedback.objects.update_or_create(
        user=request.user, message=msg,
        defaults={'helpful': helpful, 'comment': (request.data.get('comment') or '').strip()[:2000],
                  'company': get_current_company(request.user), 'question': asked[:4000],
                  'answer': msg.content[:4000]})
    return Response({'id': fb.id, 'helpful': fb.helpful})
