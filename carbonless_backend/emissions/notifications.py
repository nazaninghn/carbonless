"""In-app notifications for the entry approval workflow.

- A data-entry member saves an entry that waits for review -> every approver
  (owner/admin/manager) of that company is told.
- An approver approves or rejects an entry -> its author is told, with the
  reason for a rejection.

Each notification is written in the recipient's language preference and is
skipped when they switched approval notifications off in Settings.
"""
import logging

logger = logging.getLogger(__name__)

APPROVER_ROLES = ('owner', 'admin', 'manager')

_MONTHS = {
    'tr': ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz',
           'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July',
           'August', 'September', 'October', 'November', 'December'],
}


# Unit spellings for messages (EmissionFactor.unit is a lower-case code).
_UNITS = {
    'kwh': 'kWh', 'mwh': 'MWh', 'gj': 'GJ', 'm3': 'm³', 'm2': 'm²', 'kg': 'kg', 'km': 'km', 'usd': 'USD',
    'liters': {'tr': 'litre', 'en': 'litres'}, 'tonne': {'tr': 'ton', 'en': 'tonnes'},
    'tonnes': {'tr': 'ton', 'en': 'tonnes'}, 'tonne-km': {'tr': 'ton-km', 'en': 'tonne-km'},
    'pkm': {'tr': 'yolcu-km', 'en': 'passenger-km'}, 'person-km': {'tr': 'yolcu-km', 'en': 'passenger-km'},
    'night': {'tr': 'gece', 'en': 'nights'}, 'nights': {'tr': 'gece', 'en': 'nights'},
    'units': {'tr': 'adet', 'en': 'units'}, 'packages': {'tr': 'paket', 'en': 'packages'},
    'days': {'tr': 'gün', 'en': 'days'}, 'employees': {'tr': 'çalışan', 'en': 'employees'},
    'franchises': {'tr': 'franchise', 'en': 'franchises'},
    'kgco2e': 'kg CO₂e',
}


def _unit(code, lang):
    u = _UNITS.get(code, code)
    return u[lang] if isinstance(u, dict) else u


def _prefs(user):
    """(wants approval notifications, language) for a user."""
    profile = getattr(user, 'profile', None)
    if profile is None:
        return True, 'tr'
    lang = profile.language_preference if profile.language_preference in ('tr', 'en') else 'tr'
    return profile.notify_approvals, lang


def _describe(entry, lang):
    factor = entry.emission_factor
    name = (factor.name_tr or factor.name) if lang == 'tr' else factor.name
    month = _MONTHS[lang][entry.month - 1] if 1 <= (entry.month or 0) <= 12 else ''
    return f'{name} · {_qty(entry, lang)} · {month} {entry.year}'.strip()


def _qty(entry, lang):
    qty = f'{entry.quantity:,.2f}'.rstrip('0').rstrip('.')
    if lang == 'tr':
        qty = qty.replace(',', '\x00').replace('.', ',').replace('\x00', '.')
    return f'{qty} {_unit(entry.emission_factor.unit, lang)}'


def _describe_change(old, new, lang):
    """'Türkiye ulusal şebekesi · 4.000 kWh → 3.200 kWh · Nisan 2026', with
    the period and the facility when those changed too."""
    factor = new.emission_factor
    name = (factor.name_tr or factor.name) if lang == 'tr' else factor.name
    if old.emission_factor_id != new.emission_factor_id:
        of = old.emission_factor
        name = f"{(of.name_tr or of.name) if lang == 'tr' else of.name} → {name}"

    def period(e):
        m = _MONTHS[lang][e.month - 1] if 1 <= (e.month or 0) <= 12 else ''
        return f'{m} {e.year}'.strip()
    parts = [name]
    parts.append(f'{_qty(old, lang)} → {_qty(new, lang)}' if old.quantity != new.quantity or
                 old.emission_factor_id != new.emission_factor_id else _qty(new, lang))
    parts.append(f'{period(old)} → {period(new)}' if (old.year, old.month) != (new.year, new.month) else period(new))
    if old.facility_id != new.facility_id:
        parts.append(f"{old.facility.name if old.facility_id else '—'} → {new.facility.name if new.facility_id else '—'}")
    return ' · '.join(parts)


def _notify(user, notification_type, title, message, link='/dashboard', company_id=None):
    from accounts.models import Notification
    Notification.objects.create(
        user=user, company_id=company_id, notification_type=notification_type,
        title=title, message=message, link=link,
    )


def _frontend():
    import os
    return (os.environ.get('FRONTEND_URL') or 'http://localhost:3000').strip().rstrip('/')


def _send_email(user, subject, body):
    """An e-mail next to the in-app notice — never raises (a notification
    must not break saving or reviewing an entry)."""
    if not getattr(user, 'email', ''):
        return False
    try:
        from django.conf import settings
        from django.core.mail import send_mail
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)
        return True
    except Exception:
        logger.exception('Could not e-mail %s', user.pk)
        return False


def _email_approver(user, company_id, lang, latest):
    """Tell an approver by e-mail that entries are waiting — at most once a
    day, counting everything waiting in the company at that moment. The
    in-app bell is only seen by someone who logs in."""
    from datetime import timedelta
    from django.utils import timezone
    from accounts.models import UserProfile
    from emissions.models import EmissionEntry
    profile = getattr(user, 'profile', None)
    now = timezone.now()
    if profile is None or (profile.approval_email_sent_at
                           and now - profile.approval_email_sent_at < timedelta(hours=24)):
        return
    from django.db.models import Q
    waiting = EmissionEntry.objects.filter(
        Q(status='submitted') | Q(status='approved', delete_requested=True), company_id=company_id).count()
    if not waiting:
        return
    from companies.models import Company
    company = Company.objects.filter(pk=company_id).values_list('legal_entity_name', flat=True).first() or ''
    hello = user.first_name or user.email
    link = f'{_frontend()}/dashboard?tab=review&company={company_id}'
    if lang == 'tr':
        # Sent when the first entry arrives: more may follow the same day
        # without another e-mail, so the count is "at least".
        subject = 'Carbonless: onayınızı bekleyen kayıtlar var'
        body = (f'Merhaba {hello},\n\n{company} için şu an onayınızı bekleyen en az {waiting} kayıt var.\n'
                f'Son gelen: {latest}\n\nOnaylanana kadar bu kayıtlar toplamlara girmez. Güncel liste için:\n{link}\n\n'
                'Bu e-postayı en fazla günde bir kez gönderiyoruz; gün içinde gelen yeni kayıtlar listede görünür. '
                'Ayarlar → Bildirimler bölümünden kapatabilirsiniz.\n\n— Carbonless')
    else:
        subject = 'Carbonless: entries are waiting for your approval'
        body = (f'Hello {hello},\n\nAt least {waiting} entries of {company} are waiting for your approval right now.\n'
                f'Latest: {latest}\n\nUntil approved they are not in the totals. See the current list:\n{link}\n\n'
                'We send this e-mail at most once a day; entries arriving later that day show in the list. '
                'You can turn it off in Settings → Notifications.\n\n— Carbonless')
    if _send_email(user, subject, body):
        UserProfile.objects.filter(pk=profile.pk).update(approval_email_sent_at=now)


def notify_entry_submitted(entry):
    """Tell the company's approvers that `entry` is waiting for their review."""
    if entry.status != 'submitted' or not entry.company_id:
        return
    try:
        from companies.models import CompanyMembership
        # The same name the Onay Bekleyenler list shows ("Giren: Emre"),
        # not the login name, which for many accounts is an e-mail address.
        u = entry.user
        author = (u.get_full_name() or u.email or u.username) if u else '—'
        approvers = (
            CompanyMembership.objects
            .filter(company_id=entry.company_id, is_active=True, role__in=APPROVER_ROLES)
            .exclude(user_id=entry.user_id)
            .select_related('user', 'user__profile')
        )
        old = entry.replaces_entry if entry.replaces_entry_id else None
        for membership in approvers:
            wants, lang = _prefs(membership.user)
            if not wants:
                continue
            if old is not None:
                # A change to an approved entry, not a new one: what it was
                # and what it would become.
                what = _describe_change(old, entry, lang)
                if lang == 'tr':
                    _notify(membership.user, 'entry_submitted', 'Değişiklik talebi',
                            f'{author} onaylı bir kaydı değiştirmek istiyor: {what}. '
                            'Onaylanana kadar onaylı değer toplamlarda kalır.',
                            link=f'/dashboard?tab=review&entry={entry.id}', company_id=entry.company_id)
                else:
                    _notify(membership.user, 'entry_submitted', 'Change request',
                            f'{author} asks to change an approved entry: {what}. '
                            'Until approved the approved value stays in the totals.',
                            link=f'/dashboard?tab=review&entry={entry.id}', company_id=entry.company_id)
                _email_approver(membership.user, entry.company_id, lang,
                                f'{author} — ' + ('değişiklik talebi: ' if lang == 'tr' else 'change request: ') + what)
                continue
            if lang == 'tr':
                _notify(membership.user, 'entry_submitted', 'Onay bekleyen kayıt',
                        f'{author} yeni bir kayıt ekledi: {_describe(entry, lang)}. '
                        f'Onay Bekleyenler sayfasından inceleyebilirsiniz.',
                        link=f'/dashboard?tab=review&entry={entry.id}', company_id=entry.company_id)
            else:
                _notify(membership.user, 'entry_submitted', 'Entry awaiting approval',
                        f'{author} added a new entry: {_describe(entry, lang)}. '
                        f'Review it on the Pending Review page.',
                        link=f'/dashboard?tab=review&entry={entry.id}', company_id=entry.company_id)
            _email_approver(membership.user, entry.company_id, lang, f'{author} — {_describe(entry, lang)}')
    except Exception:  # a notification must never break saving the entry
        logger.exception('Could not notify approvers about entry %s', entry.pk)


def notify_delete_requested(author, entry):
    """A data-entry member asked to delete an approved entry: tell the
    approvers, like a new entry waiting for them."""
    try:
        from companies.models import CompanyMembership
        name = (author.get_full_name() or author.email or author.username) if author else '—'
        approvers = (CompanyMembership.objects
                     .filter(company_id=entry.company_id, is_active=True, role__in=APPROVER_ROLES)
                     .exclude(user_id=getattr(author, 'pk', None))
                     .select_related('user', 'user__profile'))
        for membership in approvers:
            wants, lang = _prefs(membership.user)
            if not wants:
                continue
            what = _describe(entry, lang)
            if lang == 'tr':
                _notify(membership.user, 'entry_submitted', 'Silme talebi',
                        f'{name} onaylı bir kaydın silinmesini istiyor: {what}. Onaylanana kadar kayıt toplamlarda kalır.',
                        link=f'/dashboard?tab=review&entry={entry.id}', company_id=entry.company_id)
            else:
                _notify(membership.user, 'entry_submitted', 'Deletion request',
                        f'{name} asks to delete an approved entry: {what}. Until approved it stays in the totals.',
                        link=f'/dashboard?tab=review&entry={entry.id}', company_id=entry.company_id)
            _email_approver(membership.user, entry.company_id, lang,
                            f'{name} — ' + ('silme talebi: ' if lang == 'tr' else 'deletion request: ') + what)
    except Exception:
        logger.exception('Could not notify approvers about a deletion request (%s)', entry.pk)


def notify_delete_refused(entry, reason, reviewer):
    """Tell the author that their deletion request was refused, with the
    reviewer's reason: the entry stays approved and in the totals."""
    author = entry.user
    if author is None or author.pk == reviewer.pk:
        return
    try:
        wants, lang = _prefs(author)
        if not wants:
            return
        what = _describe(entry, lang)
        link = f'/dashboard?tab=emissions&year={entry.year}'
        if lang == 'tr':
            _notify(author, 'entry_rejected', 'Silme talebiniz reddedildi',
                    f'{what} silinmedi.' + (f' Neden: {reason}.' if reason else '')
                    + ' Kayıt onaylı haliyle duruyor.', link, company_id=entry.company_id)
        else:
            _notify(author, 'entry_rejected', 'Your deletion request was refused',
                    f'{what} was not deleted.' + (f' Reason: {reason}.' if reason else '')
                    + ' The entry stays approved.', link, company_id=entry.company_id)
    except Exception:
        logger.exception('Could not notify the author of entry %s', entry.pk)


def notify_questionnaire_change(author, company, year, step, entries, replaced, also=()):
    """A data-entry member changed an inventory answer: tell the approvers
    what it is now and what it replaces. One notice per answer — while it is
    unread, a later save of the same answer updates it instead of adding
    another (saving each facility used to send a copy each)."""
    try:
        from accounts.models import Notification
        from companies.models import CompanyMembership
        from questionnaire.step_entries import question_label
        name = (author.get_full_name() or author.email or author.username) if author else '—'
        link = f'/dashboard?tab=review&inventory={year}-{step}'
        approvers = (CompanyMembership.objects
                     .filter(company=company, is_active=True, role__in=APPROVER_ROLES)
                     .exclude(user_id=getattr(author, 'pk', None))
                     .select_related('user', 'user__profile'))
        for membership in approvers:
            wants, lang = _prefs(membership.user)
            if not wants:
                continue
            now = _summary(entries, lang)
            before = _summary(replaced, lang) if replaced else ''
            where = question_label(step, lang)
            if also:
                others = ', '.join(dict.fromkeys(question_label(x, lang) for x in also))
                where += (f'; bağlı hesaplamalar: {others}' if lang == 'tr' else f'; recalculated with it: {others}')
            if lang == 'tr':
                title = 'Onay bekleyen değişiklik' if before else 'Onay bekleyen kayıt'
                message = (f'{name} {year} envanterinde bir cevabı değiştirdi ({where}): '
                           + (f'{before} → {now}' if before else now)
                           + '. Onaylanana kadar önceki değer toplamlarda kalır. '
                             'Onay Bekleyenler sayfasından inceleyebilirsiniz.')
            else:
                title = 'Change awaiting approval' if before else 'Entry awaiting approval'
                message = (f'{name} changed an answer of the {year} inventory ({where}): '
                           + (f'{before} → {now}' if before else now)
                           + '. Until it is approved the previous value stays in the totals. '
                             'Review it on the Pending Review page.')
            open_notice = Notification.objects.filter(
                user=membership.user, notification_type='entry_submitted', link=link, is_read=False).first()
            if open_notice:
                from django.utils import timezone
                Notification.objects.filter(pk=open_notice.pk).update(
                    title=title, message=message, created_at=timezone.now())
            else:
                _notify(membership.user, 'entry_submitted', title, message, link=link, company_id=company.pk)
            _email_approver(membership.user, company.pk, lang,
                            f'{name} — {year} ' + ('envanteri, ' if lang == 'tr' else 'inventory, ') + where)
    except Exception:  # a notification must never break saving the answer
        logger.exception('Could not notify approvers about a questionnaire change (%s)', step)


def _summary(entries, lang):
    """One entry described; several summed in t CO2e."""
    entries = list(entries)
    if len(entries) == 1:
        return _describe(entries[0], lang).rsplit(' · ', 1)[0]
    kg = sum(float(e.calculated_co2e_kg) for e in entries)
    text = f'{kg / 1000:,.2f} t CO₂e'
    if lang == 'tr':
        text = text.replace(',', '\x00').replace('.', ',').replace('\x00', '.')
    return (f'{len(entries)} kayıt, {text}' if lang == 'tr' else f'{len(entries)} entries, {text}')


def notify_entry_reviewed(entry, approved, reviewer):
    """Tell the entry's author that it was approved or rejected."""
    if not entry.user_id or entry.user_id == reviewer.pk:
        return
    try:
        wants, lang = _prefs(entry.user)
        if not wants:
            return
        what = _describe(entry, lang)
        # A change to an approved entry: rejected, the approved figure stays.
        old = entry.replaces_entry if entry.replaces_entry_id else None
        if approved:
            if lang == 'tr':
                _notify(entry.user, 'entry_approved', 'Kaydınız onaylandı', f'{what} onaylandı.', f'/dashboard?tab=emissions&year={entry.year}', company_id=entry.company_id)
            else:
                _notify(entry.user, 'entry_approved', 'Your entry was approved', f'{what} was approved.', f'/dashboard?tab=emissions&year={entry.year}', company_id=entry.company_id)
            return
        reason = (entry.rejected_reason or '').strip()
        # Opens Emisyon Yönetimi on the entry's own year.
        link = f'/dashboard?tab=emissions&year={entry.year}'
        from_questionnaire = (entry.description or '').startswith('Questionnaire step ')
        if lang == 'tr':
            fix = (' Kayıt anketten geldi: Emisyon Yönetimi\'nde "Ankette düzelt" ile ilgili soruyu açıp düzeltin.'
                   if from_questionnaire else ' Kaydı düzenleyip tekrar gönderebilirsiniz.')
            if old is not None:
                fix = f' Onaylı kayıt ({_describe(old, lang)}) geçerli kalıyor.' + fix
            _notify(entry.user, 'entry_rejected',
                    'Değişiklik talebiniz reddedildi' if old is not None else 'Kaydınız reddedildi',
                    f'{what} reddedildi.' + (f' Neden: {reason}.' if reason else '') + fix, link, company_id=entry.company_id)
            _send_email(entry.user, 'Carbonless: kaydınız reddedildi',
                        f'Merhaba {entry.user.first_name or entry.user.email},\n\n{what} reddedildi.'
                        + (f'\nNeden: {reason}' if reason else '') + f'\n\n{fix.strip()}\n{_frontend()}{link}&company={entry.company_id}\n\n'
                        'Ayarlar → Bildirimler bölümünden bu e-postaları kapatabilirsiniz.\n\n— Carbonless')
        else:
            fix = (' It comes from the questionnaire: use "Fix in questionnaire" on the Emissions page to correct that question.'
                   if from_questionnaire else ' You can edit the entry to send it again.')
            if old is not None:
                fix = f' The approved entry ({_describe(old, lang)}) stays as it is.' + fix
            _notify(entry.user, 'entry_rejected',
                    'Your change was rejected' if old is not None else 'Your entry was rejected',
                    f'{what} was rejected.' + (f' Reason: {reason}.' if reason else '') + fix, link, company_id=entry.company_id)
            _send_email(entry.user, 'Carbonless: your entry was rejected',
                        f'Hello {entry.user.first_name or entry.user.email},\n\n{what} was rejected.'
                        + (f'\nReason: {reason}' if reason else '') + f'\n\n{fix.strip()}\n{_frontend()}{link}&company={entry.company_id}\n\n'
                        'You can turn these e-mails off in Settings → Notifications.\n\n— Carbonless')
    except Exception:
        logger.exception('Could not notify the author of entry %s', entry.pk)
