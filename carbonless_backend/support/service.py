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
    ('data', r'veri(lerim)? (kayboldu|silindi|gitti)|kayıtlar(ım)? (kayboldu|silindi|görünmüyor)|geri (yükle|getir)|'
             r'(my |our )?(data|entries|records) (is |are |has |have )?(lost|missing|gone|deleted|disappeared)|restore (my )?data'),
    ('integration', r'\bapi\b|entegrasyon|\bsap\b|\berp\b|logo yazılım|integration'),
    ('legal', r'kvkk|gdpr|hizmet sözleşme|sözleşme(mi|yi)? (iptal|fesih|feshet)|yasal (sorumluluk|bağlayıcı)|akredit|'
              r'legal(ly)? binding|accredit|terminate (my |the )?contract'),
    ('other', r'(destek|müşteri hizmetleri|yetkili|uzman|insan|gerçek kişi|biriyle) (ekib\w*|ile)? ?(görüş|konuş|bağlan|yardım)|'
              r'(talk|speak) to (a |an )?(human|person|someone|support|expert)|contact support|'
              r'(destek|müşteri hizmetleri|yetkili|uzman|size|sizinle|ekibinize)\w* (ekib\w* )?(nasıl )?(ulaş|iletişim)|'
              r'telefon numara|iletişim (bilgi|numara|adres)|phone number|contact (number|details|e-?mail)'),
]


# Something in the app is broken. "çalışmıyor" / "error" alone also fit a
# generator that doesn't run or an emission factor's error margin, so those
# count only next to a part of the app.
_BUG_ALWAYS = (r'\bhata (veriyor|alıyorum|çıkıyor|mesajı)|donuyor|çöküyor|sayfa boş|kayded(il)?emiyorum|'
               r'indiremiyorum|yükleyemiyorum|açamıyorum|göremiyorum|(bas|tıkla)(ınca|dığımda) (bir şey|hiçbir şey) olmuyor|'
               r'\bbug\b|crash(es|ed)?|won.t load|cannot (save|download|upload|open)|can.t (save|download|upload|open)|'
               r'nothing happens')
_BUG_WORDS = r'hata var|sorun var|sorun yaşıyorum|çalışmıyor|açılmıyor|yüklenmiyor|görünmüyor|yanlış (gösteriyor|görünüyor|toplam)|\berror\b|not working|does ?n.t work|wrong totals?|shows wrong'
_APP_WORDS = (r'sayfa|ekran|buton|düğme|rapor|uygulama|site|sistem|platform|panel|dashboard|giriş|menü|grafik|pdf|excel|indir|yükle|'
              r'page|screen|button|app\b|report|login|chart|download|upload|totals?')


def _is_bug(t):
    return bool(re.search(_BUG_ALWAYS, t) or (re.search(_BUG_WORDS, t) and re.search(_APP_WORDS, t)))


# A message carrying an amount and a unit is activity data for the
# calculator, whatever else it says ("jeneratör çalışmıyor ama 200 litre…").
_ACTIVITY = re.compile(r'\d[\d.,]*\s*(kwh|mwh|gwh|m3|m³|lt\b|litre|liter|l\b|kg\b|ton|tonne|km\b|adet|gallon|ton-km)', re.I)


def support_topic(text):
    """The support topic a message is about, or None when the AI can
    handle it (carbon questions, the app's own how-to, data look-ups,
    activity data)."""
    t = (text or '').lower()
    if _ACTIVITY.search(t):
        return None
    for topic, rx in _TOPIC_PATTERNS:
        if re.search(rx, t, re.I):
            return topic
    if _is_bug(t):
        return 'bug'
    return None


# Things users can do themselves: a link to the place, with the support
# team still one click away.
_SELF_SERVICE = [
    (r'hesab(ım|ımı|imizi) (sil|kapat)|üyeliğ(im|imi) (sil|iptal)|delete my account|close my account',
     ('Hesabınızı kendiniz silebilirsiniz: Ayarlar → Veri bölümündeki «Hesabı sil». Şirketin sahibiyseniz sahiplik '
      'ekipteki bir yönetici/admin üyeye geçer; ekipte başka kimse yoksa şirketin verileri de silinir, bu yüzden önce '
      'aynı bölümden verilerinizi indirin.',
      'You can delete your account yourself: Settings → Data → «Delete account». If you own the company, ownership '
      'passes to an admin/manager on the team; if nobody else is on the team the company\'s data is deleted too, so '
      'download your data from the same page first.'),
     'data', ('Ayarlar → Veri', 'Settings → Data')),
    (r'şifre(mi|mizi)? (nasıl )?(değiştir|sıfırla|yenile|unuttum)|change (my )?password|reset (my )?password|forgot (my )?password',
     ('Şifrenizi Ayarlar → Güvenlik bölümünden değiştirebilirsiniz. Mevcut şifrenizi hatırlamıyorsanız çıkış yapıp '
      'giriş sayfasındaki «Şifremi unuttum» bağlantısıyla yeni şifre belirleyin.',
      'You can change your password in Settings → Security. If you don\'t remember the current one, sign out and use '
      '«Forgot password» on the sign-in page.'),
     'security', ('Ayarlar → Güvenlik', 'Settings → Security')),
]


def self_service(text, lang):
    """(text, link) when the user can do this themselves, else None."""
    t = (text or '').lower()
    for rx, texts, section, labels in _SELF_SERVICE:
        if re.search(rx, t):
            en = lang == 'en'
            return texts[1 if en else 0], {'href': f'/dashboard?tab=settings&section={section}',
                                           'label': labels[1 if en else 0]}
    return None


def _conversation(session, limit=8):
    if session is None:
        return ''
    msgs = list(session.messages.order_by('-created_at')[:limit])[::-1]
    return '\n\n'.join(f"[{'Kullanıcı' if m.role == 'user' else 'AI'}] {m.content[:1500]}" for m in msgs)


def _same_open_request(user, question):
    from datetime import timedelta
    from .models import SupportRequest
    norm = ' '.join((question or '').lower().split())
    since = timezone.now() - timedelta(days=1)
    for r in SupportRequest.objects.filter(user=user, status=SupportRequest.Status.OPEN, created_at__gte=since):
        if ' '.join(r.question.lower().split()) == norm:
            return r
    return None


def create_request(user, question, *, source='user', session=None, topic=None, lang='tr'):
    """A new request, or the user's same question still open from the last
    day (asking again doesn't open a second one or alert the team again)."""
    from companies.utils import get_current_company
    from .models import SupportRequest
    existing = _same_open_request(user, question)
    if existing:
        existing.already_open = True
        return existing
    req = SupportRequest.objects.create(
        user=user, company=get_current_company(user), session=session,
        source=source, topic=topic or support_topic(question) or 'other',
        question=(question or '').strip()[:4000], context=_conversation(session),
        language='en' if lang == 'en' else 'tr',
    )
    alert_team(req)
    return req


def referral_text(req, lang):
    if getattr(req, 'already_open', False):
        return (f"This question is already with our support team (request #{req.pk}); "
                f"you'll get a notification as soon as they answer." if lang == 'en' else
                f"Bu soru zaten destek ekibimizde (talep #{req.pk}); yanıt gelir gelmez bildirim alacaksınız.")
    by_ai = req.source == req.Source.AI
    # Asked how to reach us: the address too.
    from django.conf import settings
    contact = settings.SUPPORT_EMAIL or settings.CONTACT_EMAIL
    if lang == 'en':
        return ((f"This needs our support team — someone who can look at your account and the system directly. "
                 if by_ai else '') +
                f"I've passed your question on (request #{req.pk}); they will answer as soon as possible. "
                f"You'll get a notification and an e-mail, and the answer will also appear here in this chat." +
                (f" You can also write to us directly at {contact}." if req.topic == 'other' else ''))
    return (("Bu konuyu hesabınıza ve sisteme doğrudan bakabilen destek ekibimiz yanıtlamalı. " if by_ai else '') +
            f"Sorunuzu destek ekibine ilettim (talep #{req.pk}); en kısa sürede yanıt verecekler. "
            f"Yanıt geldiğinde bildirim ve e-posta alacaksınız; yanıt bu sohbete de eklenecek." +
            (f" Bize doğrudan {contact} adresinden de yazabilirsiniz." if req.topic == 'other' else ''))


def reopen_request(req, text):
    """The user wrote back on an answered request: it is open again and the
    team is told, with the earlier answer kept in the request's history."""
    stamp = timezone.localtime().strftime('%d.%m.%Y %H:%M')
    parts = [req.context]
    if req.answer:
        parts.append(f'[Destek yanıtı] {req.answer}')
    parts.append(f'[Kullanıcı · {stamp}] {text}')
    req.context = '\n\n'.join(p for p in parts if p)
    req.status = req.Status.OPEN
    req.save(update_fields=['context', 'status', 'updated_at'])
    alert_team(req, follow_up=text)


def alert_team(req, follow_up=''):
    """E-mail the support address and staff accounts; the admin dashboard
    and sidebar also show the open requests."""
    try:
        from django.conf import settings
        from django.contrib.auth.models import User
        from django.core.mail import send_mail
        to = {settings.SUPPORT_EMAIL or settings.CONTACT_EMAIL or 'info@carbonless.info'}
        to |= set(User.objects.filter(is_staff=True, is_active=True).exclude(email='').values_list('email', flat=True))
        frontend_admin = settings.BACKEND_URL
        link = f'{frontend_admin}/admin/support/supportrequest/{req.pk}/change/' if frontend_admin else f'/admin/support/supportrequest/{req.pk}/change/'
        who = req.user.get_full_name() or req.user.email or req.user.username
        company = req.company.legal_entity_name if req.company_id else '—'
        head = (f'Kullanıcı yanıt verdi, talep yeniden açıldı:\n{follow_up}\n\n' if follow_up
                else f'Yeni destek talebi ({req.get_source_display()}).\n\n')
        send_mail(
            f'[Carbonless destek] #{req.pk} {"yanıt" if follow_up else req.get_topic_display()} — {who}',
            f'{head}Kullanıcı: {who}\nŞirket: {company}\n'
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
