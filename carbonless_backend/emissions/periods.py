"""
Reporting periods an entry may be recorded for.

Activity data describes what already happened, so an entry can't be for a
month that hasn't started yet: October in September is almost always a typo
(wrong month or year picked) and would land in next month's and the year's
totals. The current month is allowed — bills for it can already be in.
"""
from datetime import date

FUTURE_PERIOD_CODE = 'future_period'
FUTURE_PERIOD_MESSAGE = {
    'en': 'This period has not started yet. Choose the current month or an earlier one.',
    'tr': 'Bu dönem henüz başlamadı. Bu ayı veya daha önceki bir ayı seçin.',
}


def is_future_period(year, month, today=None):
    """True when (year, month) is after the current month."""
    today = today or date.today()
    try:
        year, month = int(year), int(month)
    except (TypeError, ValueError):
        return False
    return (year, month) > (today.year, today.month)


def future_period_message(lang):
    return FUTURE_PERIOD_MESSAGE['tr' if lang == 'tr' else 'en']
