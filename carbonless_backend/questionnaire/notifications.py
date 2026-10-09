"""Notices about a finished inventory being changed.

A completed inventory backs the ISO report, so when a team member other than
the one who started it saves an answer, the company's owners and admins are
told — once a day per inventory and editor, not once per question.
"""
import logging
import re

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


# Answers that only move around the survey ("fix a section" on the sign-off
# screen, section pickers) change nothing in the inventory.
_NAVIGATION_STEPS = {'7C-1', 'TY-edit', '4C-edit', 'K3-TY-edit', '7C-edit'}


def notify_completed_inventory_edited(report, editor, step_id):
    if report.status != 'completed' or report.created_by_id == editor.pk or step_id in _NAVIGATION_STEPS:
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
            section = _section(step_id, lang)
            earlier = Notification.objects.filter(user=m.user, title=title, created_at__gte=today,
                                                  message__startswith=name).first()
            # Once a day per editor; a change in another section is added to
            # that day's notice instead of being left out.
            sections = [section]
            if earlier:
                if f'"{section}"' in earlier.message:
                    continue
                sections = re.findall(r'"([^"]+)"', earlier.message.split(' bölüm')[0] if lang == 'tr'
                                      else earlier.message.split(' section')[0]) + [section]
            quoted = ', '.join(f'"{x}"' for x in sections)
            message = (f'{name}, {report.reporting_year} envanterinde {quoted} '
                       f'bölüm{"lerinde" if len(sections) > 1 else "ünde"} cevap değiştirdi. ISO raporu bu cevaplardan oluşur; '
                       f'gözden geçirmek için envanteri açın.'
                       if lang == 'tr' else
                       f'{name} changed answers in the {quoted} section{"s" if len(sections) > 1 else ""} of the '
                       f'{report.reporting_year} inventory. The ISO report is built from these answers; '
                       f'open the inventory to review it.')
            if earlier:
                Notification.objects.filter(pk=earlier.pk).update(message=message, is_read=False)
                continue
            Notification.objects.create(user=m.user, company_id=report.company_id,
                                        notification_type='system', title=title,
                                        message=message, link=link)
    except Exception:  # a notice must never break saving the answer
        logger.exception('Could not notify about edited inventory %s', report.pk)
