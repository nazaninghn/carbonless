"""Warn before the same activity is recorded twice.

Saving "12,000 kWh electricity, August" a second time silently doubles it in
every total and report. An entry counts as a likely duplicate when the same
company already has one with the same emission factor, period and quantity.
Rejected entries don't count: re-entering those is the fix, not a duplicate.
Two genuinely separate identical readings are possible, so this only warns:
the client can resend with confirm_duplicate=true to save anyway.
"""
from rest_framework import status
from rest_framework.exceptions import APIException


class PossibleDuplicate(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'possible_duplicate'

    def __init__(self, existing):
        super().__init__(detail={
            'error': 'An entry with the same source, period and quantity already exists.',
            'code': 'possible_duplicate',
            'existing_id': existing.pk,
            'existing_status': existing.status,
        })


def is_confirmed(data):
    return str(data.get('confirm_duplicate', '')).strip().lower() in ('1', 'true', 'yes', 'on')


def find_duplicate(company, factor, year, month, quantity):
    from .models import EmissionEntry
    if not company or factor is None or quantity is None:
        return None
    return (
        EmissionEntry.objects
        .filter(company=company, emission_factor=factor, year=year, month=month, quantity=quantity)
        .exclude(status='draft')
        .first()
    )


class AnnualOverlap(APIException):
    """The year's inventory already holds this source as an annual amount."""
    status_code = status.HTTP_409_CONFLICT
    default_code = 'annual_overlap'

    def __init__(self, overlap):
        super().__init__(detail={'error': overlap['en'], 'code': 'annual_overlap', **overlap})


def find_annual_overlap(company, factor, year, facility=None):
    """A monthly entry of a source the year's questionnaire already reports as
    an annual amount (a month of electricity on top of the year's electricity)
    would be counted twice. Returns {'tr', 'en', 'message_tr', 'message_en'}
    describing the annual amount, or None. Same category and scope; when the
    new entry names a facility, only that facility's annual amount counts."""
    from .inventory import ANNUAL_PREFIX
    from .models import EmissionEntry
    if not company or factor is None or not year:
        return None
    qs = (EmissionEntry.objects
          .filter(company=company, year=year, description__startswith=ANNUAL_PREFIX,
                  emission_factor__scope=factor.scope, emission_factor__category=factor.category)
          .exclude(status='draft').select_related('emission_factor', 'facility'))
    if facility is not None and qs.filter(facility=facility).exists():
        qs = qs.filter(facility=facility)
    rows = list(qs)
    if not rows:
        return None
    from questionnaire.step_entries import entry_group, question_label
    from .notifications import _summary
    step = entry_group(rows[0].description)
    where_fac = rows[0].facility.name if facility is not None and rows[0].facility_id == getattr(facility, 'pk', None) else None
    texts = {}
    for lang in ('tr', 'en'):
        what = _summary(rows, lang)
        q = question_label(step, lang)
        if lang == 'tr':
            texts['message_tr'] = (
                f'{year} envanterinde ({q}) '
                + (f'{where_fac} için ' if where_fac else '')
                + f'bu kaynağın yıllık tutarı zaten var ({what}). Bu kayıt ona eklenir — aynı tüketim iki kez sayılabilir.')
        else:
            texts['message_en'] = (
                f'The {year} inventory ({q}) already holds the annual amount of this source'
                + (f' for {where_fac}' if where_fac else '')
                + f' ({what}). This entry is added on top of it — the same consumption may be counted twice.')
    return {'tr': texts['message_tr'], 'en': texts['message_en'], **texts}
