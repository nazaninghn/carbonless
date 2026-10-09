"""
Which emission entries make up the inventory.

Only approved entries count: totals, scope/category/month breakdowns, the
dashboard, targets and every report (Emissions PDF, ISO 14064-1 report,
inventory profile). An entry waiting for approval ('submitted') or rejected
(a rejection moves it back to 'draft') is left out; `not_counted()` reports
them separately so the client can still see them, marked as informational.
"""
from django.db.models import Sum

# Entries the questionnaire makes hold a whole year's amount (a year's
# electricity, a year's purchases); they are stored with month=1 only because
# the field needs a value. Monthly breakdowns leave them out and show them as
# one annual figure, so January doesn't look like the month all of it happened.
ANNUAL_PREFIX = 'Questionnaire step '


def is_annual(entry):
    return (entry.description or '').startswith(ANNUAL_PREFIX)


def monthly_split(queryset):
    """([kg for months 1..12] of the monthly entries, kg of the annual ones)."""
    monthly_qs = (queryset.exclude(description__startswith=ANNUAL_PREFIX)
                  .values('month').annotate(t=Sum('calculated_co2e_kg')).order_by('month'))
    by_month = {row['month']: float(row['t'] or 0) for row in monthly_qs}
    annual = float(queryset.filter(description__startswith=ANNUAL_PREFIX)
                   .aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    return [by_month.get(m, 0.0) for m in range(1, 13)], annual


def not_counted(queryset):
    """Pending and rejected entries of `queryset`, for an informational note:
    {'pending': {'count', 'total_kg'}, 'rejected': {'count', 'total_kg'}}."""
    out = {}
    for key, status in (('pending', 'submitted'), ('rejected', 'draft')):
        qs = queryset.filter(status=status)
        out[key] = {
            'count': qs.count(),
            'total_kg': float(qs.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0),
        }
    return out


def _t(kg, tr):
    s = f'{kg / 1000:,.3f}'
    return s.replace(',', '\x00').replace('.', ',').replace('\x00', '.') if tr else s


def not_counted_note(info, tr=False):
    """One informational sentence for reports about the entries `not_counted`
    left out, or '' when there are none."""
    parts = []
    pend, rej = info.get('pending', {}), info.get('rejected', {})
    if pend.get('count'):
        parts.append(f"{pend['count']} onay bekleyen kayıt ({_t(pend['total_kg'], tr)} tCO₂e)" if tr
                     else f"{pend['count']} entr{'y' if pend['count'] == 1 else 'ies'} awaiting approval ({_t(pend['total_kg'], tr)} tCO₂e)")
    if rej.get('count'):
        parts.append(f"{rej['count']} reddedilen kayıt ({_t(rej['total_kg'], tr)} tCO₂e)" if tr
                     else f"{rej['count']} rejected entr{'y' if rej['count'] == 1 else 'ies'} ({_t(rej['total_kg'], tr)} tCO₂e)")
    if not parts:
        return ''
    joined = ' ve '.join(parts) if tr else ' and '.join(parts)
    return (f'Bilgi: {joined} bu rapordaki toplamlara dahil değildir; yalnızca onaylanmış kayıtlar sayılır.'
            if tr else
            f'For information: {joined} are not included in the totals of this report; only approved entries are counted.')
