from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AnswerFeedback, SupportRequest


def _request_dict(r):
    return {
        'id': r.id, 'question': r.question, 'topic': r.topic, 'source': r.source, 'status': r.status,
        'answer': r.answer, 'answered_at': r.answered_at, 'created_at': r.created_at,
        'session_id': r.session_id, 'updated_at': r.updated_at,
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def support_requests(request):
    """GET: the user's own requests (with the team's answers).
    POST {question, session_id?, language?}: ask the support team."""
    if request.method == 'GET':
        rows = SupportRequest.objects.filter(user=request.user).order_by('-updated_at')[:50]
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
    return Response({**_request_dict(req), 'message': text, 'message_id': message_id},
                    status=200 if getattr(req, 'already_open', False) else 201)


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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reply_to_request(request, pk):
    """POST {message}: the user writes back on their request ("still not
    working"); it is opened again and the team is told."""
    from .service import reopen_request
    req = SupportRequest.objects.filter(pk=pk, user=request.user).select_related('session').first()
    if req is None:
        return Response({'error': 'Not found'}, status=404)
    text = (request.data.get('message') or '').strip()[:4000]
    if len(text) < 2:
        return Response({'error': 'Write your message.', 'code': 'empty_message'}, status=400)
    reopen_request(req, text)
    messages = []
    if req.session_id:
        en = req.language == 'en'
        note = (f"I've passed your reply to the support team (request #{req.pk}); they'll get back to you here."
                if en else f"Yanıtınızı destek ekibine ilettim (talep #{req.pk}); size buradan dönecekler.")
        for role, content, ui in (('user', text, {}),
                                  ('assistant', note, {'support_request_id': req.pk, 'referred': True})):
            m = req.session.messages.create(role=role, content=content, ui=ui)
            messages.append({'id': m.id, 'role': role, 'content': content, 'ui': ui, 'created_at': m.created_at})
        req.session.save(update_fields=['updated_at'])
    return Response({**_request_dict(req), 'messages': messages})
