"""Notices about a finished inventory being changed.

A completed inventory backs the ISO report, so when a team member other than
the one who started it saves an answer, the company's owners and admins are
told — once a day per inventory and editor, not once per question.
"""
import logging

from django.utils import timezone

logger = logging.getLogger(__name__)

NOTIFY_ROLES = ('owner', 'admin')

# Section names by step id prefix, as the questionnaire's stages call them.
_SECTIONS = [
    ('K3', ('Kapsam 3', 'Scope 3')),
    ('2', ('Organizasyon Sınırı', 'Organisational Boundary')),
    ('3', ('Kapsam 1', 'Scope 1')),
    ('4', ('Kapsam 2', 'Scope 2')),
    ('6', ('Hariç Tutmalar ve Kabuller', 'Exclusions and Assumptions')),
    ('7', ('Rapor ve İmza', 'Report and Sign-off')),
]


def _section(step_id, lang):
    for prefix, names in _SECTIONS:
        if str(step_id).startswith(prefix):
            return names[0 if lang == 'tr' else 1]
    return 'Şirketi Tanıma' if lang == 'tr' else 'Company Profile'


def notify_completed_inventory_edited(report, editor, step_id):
    if report.status != 'completed' or report.created_by_id == editor.pk:
        return
    try:
        from accounts.models import Notification
        from companies.models import CompanyMembership
        name = editor.get_full_name() or editor.email or editor.username
        link = '/dashboard?tab=questionnaire'
        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        members = (CompanyMembership.objects
                   .filter(company_id=report.company_id, is_active=True, role__in=NOTIFY_ROLES)
                   .exclude(user_id=editor.pk).select_related('user', 'user__profile'))
        for m in members:
            profile = getattr(m.user, 'profile', None)
            lang = getattr(profile, 'language_preference', 'tr') if profile else 'tr'
            lang = lang if lang in ('tr', 'en') else 'tr'
            title = (f'Tamamlanmış envanter düzenlendi: {report.title}' if lang == 'tr'
                     else f'Completed inventory edited: {report.title}')
            if Notification.objects.filter(user=m.user, title=title, created_at__gte=today,
                                           message__startswith=name).exists():
                continue
            message = (f'{name}, {report.reporting_year} envanterinde "{_section(step_id, lang)}" '
                       f'bölümünde bir cevabı değiştirdi. ISO raporu bu cevaplardan oluşur; '
                       f'gözden geçirmek için envanteri açın.'
                       if lang == 'tr' else
                       f'{name} changed an answer in the "{_section(step_id, lang)}" section of the '
                       f'{report.reporting_year} inventory. The ISO report is built from these answers; '
                       f'open the inventory to review it.')
            Notification.objects.create(user=m.user, company_id=report.company_id,
                                        notification_type='system', title=title,
                                        message=message, link=link)
    except Exception:  # a notice must never break saving the answer
        logger.exception('Could not notify about edited inventory %s', report.pk)
