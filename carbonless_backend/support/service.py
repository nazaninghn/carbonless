"""Referring a question to the support team, alerting the team, and taking
the team's answer back to the user."""
import logging
import re

from django.utils import timezone

logger = logging.getLogger(__name__)

# What the AI should not try to settle itself: the user's account or money,
# something broken, data that went missing, integrations, and legal or
# contractual questions. Asked for a person outright, too.
_TOPIC_PATTERNS = [
    ('billing', r'carbonless fatura|ödeme(m|miz)? (yapamıyorum|alınmadı|başarısız|geçmedi)|abonelik|aboneliğ|para iade|'
                r'iade (talep|istiyorum)|ücretlendirme|fiyatlandırma|kredi kart|paket(imi|imizi)? (yükselt|değiştir|iptal)|'
                r'\bbilling\b|\bpayment\b|\brefund\b|\bsubscription\b|\binvoice (is )?wrong\b'),
    ('account', r'giriş yapamıyorum|şifre(mi)? (unuttum|sıfırla|değiştiremiyorum)|hesab(ım|ımı) (sil|kapat|kilitlendi|açılmıyor)|'
                r'iki adımlı|2fa|doğrulama kodu gelmiyor|e-?posta (gelmiyor|değiştir)|'
                r"can'?t log ?in|cannot log ?in|locked out|delete my account|reset (my )?password|verification code"),
    ('bug', r'\bhata (veriyor|alıyorum|çıkıyor)|çalışmıyor|açılmıyor|yüklenmiyor|donuyor|çöküyor|sayfa boş|kayded(il)?emiyorum|'
            r'\bbug\b|\berror\b|not working|does ?n.t work|crash(es|ed)?|won.t load|cannot save|can.t save'),
    ('data', r'veri(lerim)? (kayboldu|silindi|gitti)|kayıtlar(ım)? (kayboldu|silindi|görünmüyor)|geri (yükle|getir)|'
             r'(data|entries) (is |are )?(lost|missing|gone|deleted)|restore (my )?data'),
    ('integration', r'\bapi\b|entegrasyon|\bsap\b|\berp\b|logo yazılım|integration'),
    ('legal', r'kvkk|gdpr|hizmet sözleşme|sözleşme(mi|yi)? (iptal|fesih|feshet)|yasal (sorumluluk|bağlayıcı)|akredit|'
              r'legal(ly)? binding|accredit|terminate (my |the )?contract'),
    ('other', r'(destek|müşteri hizmetleri|yetkili|uzman|insan|gerçek kişi|biriyle) (ekib\w*|ile)? ?(görüş|konuş|bağlan|yardım)|'
              r'(talk|speak) to (a |an )?(human|person|support|expert)|contact support'),
]


def support_topic(text):
    """The support topic a message is about, or None when the AI can
    handle it (carbon questions, the app's own how-to, data look-ups)."""
    t = (text or '').lower()
    for topic, rx in _TOPIC_PATTERNS:
        if re.search(rx, t, re.I):
            return topic
    return None


def _conversation(session, limit=8):
    if session is None:
        return ''
    msgs = list(session.messages.order_by('-created_at')[:limit])[::-1]
    return '\n\n'.join(f"[{'Kullanıcı' if m.role == 'user' else 'AI'}] {m.content[:1500]}" for m in msgs)


def create_request(user, question, *, source='user', session=None, topic=None, lang='tr'):
    from companies.utils import get_current_company
    from .models import SupportRequest
    req = SupportRequest.objects.create(
        user=user, company=get_current_company(user), session=session,
        source=source, topic=topic or support_topic(question) or 'other',
        question=(question or '').strip()[:4000], context=_conversation(session),
        language='en' if lang == 'en' else 'tr',
    )
    alert_team(req)
    return req


def referral_text(req, lang):
    by_ai = req.source == req.Source.AI
    if lang == 'en':
        return ((f"This needs our support team — someone who can look at your account and the system directly. "
                 if by_ai else '') +
                f"I've passed your question on (request #{req.pk}); they will answer as soon as possible. "
                f"You'll get a notification and an e-mail, and the answer will also appear here in this chat.")
    return (("Bu konuyu hesabınıza ve sisteme doğrudan bakabilen destek ekibimiz yanıtlamalı. " if by_ai else '') +
            f"Sorunuzu destek ekibine ilettim (talep #{req.pk}); en kısa sürede yanıt verecekler. "
            f"Yanıt geldiğinde bildirim ve e-posta alacaksınız; yanıt bu sohbete de eklenecek.")


def alert_team(req):
    """E-mail the support address and staff accounts; the admin dashboard
    and sidebar also show the open requests."""
    try:
        from django.conf import settings
        from django.contrib.auth.models import User
        from django.core.mail import send_mail
        to = {getattr(settings, 'SUPPORT_EMAIL', '') or getattr(settings, 'CONTACT_EMAIL', '') or 'info@carbonless.info'}
        to |= set(User.objects.filter(is_staff=True, is_active=True).exclude(email='').values_list('email', flat=True))
        frontend_admin = (getattr(settings, 'BACKEND_URL', '') or '').rstrip('/')
        link = f'{frontend_admin}/admin/support/supportrequest/{req.pk}/change/' if frontend_admin else f'/admin/support/supportrequest/{req.pk}/change/'
        who = req.user.get_full_name() or req.user.email or req.user.username
        company = req.company.legal_entity_name if req.company_id else '—'
        send_mail(
            f'[Carbonless destek] #{req.pk} {req.get_topic_display()} — {who}',
            f'Yeni destek talebi ({req.get_source_display()}).\n\nKullanıcı: {who}\nŞirket: {company}\n'
            f'Konu: {req.get_topic_display()}\n\nSoru:\n{req.question}\n\nSohbet:\n{req.context or "—"}\n\n'
            f'Yanıtlamak için: {link}',
            settings.DEFAULT_FROM_EMAIL, sorted(to), fail_silently=True,
        )
    except Exception:
        logger.exception('Could not alert the team about support request %s', req.pk)


def deliver_answer(req):
    """The team's answer reaches the user three ways: an in-app notice, an
    e-mail, and a message in the chat the question came from."""
    from accounts.models import Notification
    from emissions.notifications import _send_email, _frontend
    lang = req.language
    title = 'Destek ekibinden yanıt' if lang == 'tr' else 'Answer from our support team'
    short = req.answer if len(req.answer) <= 400 else req.answer[:400] + '…'
    link = f'/dashboard?tab=ai_carbon&chat={req.session_id}' if req.session_id else '/dashboard?tab=ai_carbon'
    Notification.objects.create(
        user=req.user, company_id=req.company_id, notification_type='system',
        title=f'{title} (#{req.pk})', message=short, link=link)
    head = f'Talep #{req.pk}: {req.question[:200]}' if lang == 'tr' else f'Request #{req.pk}: {req.question[:200]}'
    _send_email(req.user, f'Carbonless: {title.lower()} (#{req.pk})',
                f'{head}\n\n{req.answer}\n\n{_frontend()}{link}\n\n— Carbonless')
    if req.session_id:
        from chat.models import ChatMessage
        ChatMessage.objects.create(
            session=req.session, role='assistant',
            content=(f'🛟 **Destek ekibinin yanıtı (talep #{req.pk})**\n\n{req.answer}' if lang == 'tr'
                     else f'🛟 **Answer from our support team (request #{req.pk})**\n\n{req.answer}'),
            ui={'support_request_id': req.pk})
        req.session.save(update_fields=['updated_at'])


def record_answer(req, answer, by):
    req.answer = answer
    req.answered_by = by
    req.answered_at = timezone.now()
    req.status = req.Status.ANSWERED
    req.save()
    deliver_answer(req)
