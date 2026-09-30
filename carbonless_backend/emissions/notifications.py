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
    qty = f'{entry.quantity:,.2f}'.rstrip('0').rstrip('.')
    if lang == 'tr':
        qty = qty.replace(',', '\x00').replace('.', ',').replace('\x00', '.')
    return f'{name} · {qty} {_unit(factor.unit, lang)} · {month} {entry.year}'.strip()


def _notify(user, notification_type, title, message, link='/dashboard', company_id=None):
    from accounts.models import Notification
    Notification.objects.create(
        user=user, company_id=company_id, notification_type=notification_type,
        title=title, message=message, link=link,
    )


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
        for membership in approvers:
            wants, lang = _prefs(membership.user)
            if not wants:
                continue
            if lang == 'tr':
                _notify(membership.user, 'entry_submitted', 'Onay bekleyen kayıt',
                        f'{author} yeni bir kayıt ekledi: {_describe(entry, lang)}. '
                        f'Onay Bekleyenler sayfasından inceleyebilirsiniz.', company_id=entry.company_id)
            else:
                _notify(membership.user, 'entry_submitted', 'Entry awaiting approval',
                        f'{author} added a new entry: {_describe(entry, lang)}. '
                        f'Review it on the Pending Review page.', company_id=entry.company_id)
    except Exception:  # a notification must never break saving the entry
        logger.exception('Could not notify approvers about entry %s', entry.pk)


def notify_entry_reviewed(entry, approved, reviewer):
    """Tell the entry's author that it was approved or rejected."""
    if not entry.user_id or entry.user_id == reviewer.pk:
        return
    try:
        wants, lang = _prefs(entry.user)
        if not wants:
            return
        what = _describe(entry, lang)
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
            _notify(entry.user, 'entry_rejected', 'Kaydınız reddedildi',
                    f'{what} reddedildi.' + (f' Neden: {reason}.' if reason else '') + fix, link, company_id=entry.company_id)
        else:
            fix = (' It comes from the questionnaire: use "Fix in questionnaire" on the Emissions page to correct that question.'
                   if from_questionnaire else ' You can edit the entry to send it again.')
            _notify(entry.user, 'entry_rejected', 'Your entry was rejected',
                    f'{what} was rejected.' + (f' Reason: {reason}.' if reason else '') + fix, link, company_id=entry.company_id)
    except Exception:
        logger.exception('Could not notify the author of entry %s', entry.pk)
