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
