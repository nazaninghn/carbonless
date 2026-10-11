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


# The earliest year an entry can be for — the same bound inventories use.
# A year before it is a slip, not a period: the chat read "Ocak 1000 kWh"
# as January of the year 1000 and saved it where no total ever shows it.
EARLIEST_YEAR = 1990
INVALID_YEAR_CODE = 'invalid_year'
INVALID_YEAR_MESSAGE = {
    'en': f'Choose a year between {EARLIEST_YEAR} and this year.',
    'tr': f'{EARLIEST_YEAR} ile bu yıl arasında bir yıl seçin.',
}


def is_invalid_year(year):
    """True when *year* is before EARLIEST_YEAR (later years are caught by
    is_future_period)."""
    try:
        return int(year) < EARLIEST_YEAR
    except (TypeError, ValueError):
        return False


def invalid_year_message(lang):
    return INVALID_YEAR_MESSAGE['tr' if lang == 'tr' else 'en']
