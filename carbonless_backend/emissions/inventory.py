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
    {'pending': {'count', 'total_kg'}, 'rejected': {'count', 'total_kg'},
     'changes': {'count'}, 'delete_requests': {'count'}}.

    'pending' holds new entries only. A waiting change to an approved entry
    (a form entry's edit, or an inventory answer's new rows next to its
    approved ones) and a deletion request are counted apart, without an
    amount: until approved the approved figure stands, so adding the change's
    whole amount would read as an increase it is not."""
    from questionnaire.step_entries import entry_group
    approved_groups = set()
    for desc, year in queryset.filter(status='approved', description__startswith=ANNUAL_PREFIX).values_list('description', 'year'):
        approved_groups.add((year, entry_group(desc)))
    new_n, new_kg, changes = 0, 0.0, 0
    # One inventory save is one change, however many rows it recalculated.
    batches = set()
    for e in queryset.filter(status='submitted').only('description', 'year', 'replaces_entry', 'calculated_co2e_kg',
                                                      'change_batch'):
        if e.replaces_entry_id or (is_annual(e) and (e.year, entry_group(e.description)) in approved_groups):
            if e.change_batch:
                if e.change_batch in batches:
                    continue
                batches.add(e.change_batch)
            changes += 1
        else:
            new_n += 1
            new_kg += float(e.calculated_co2e_kg or 0)
    rejected = queryset.filter(status='draft')
    return {
        'pending': {'count': new_n, 'total_kg': new_kg},
        'rejected': {
            'count': rejected.count(),
            'total_kg': float(rejected.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0),
        },
        'changes': {'count': changes},
        'delete_requests': {'count': queryset.filter(status='approved', delete_requested=True).count()},
    }


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
    out = []
    if parts:
        joined = ' ve '.join(parts) if tr else ' and '.join(parts)
        out.append(f'Bilgi: {joined} bu rapordaki toplamlara dahil değildir; yalnızca onaylanmış kayıtlar sayılır.'
                   if tr else
                   f"For information: {joined} {'is' if (pend.get('count') or 0) + (rej.get('count') or 0) == 1 else 'are'} "
                   'not included in the totals of this report; only approved entries are counted.')
    waiting = []
    ch, dl = (info.get('changes') or {}).get('count'), (info.get('delete_requests') or {}).get('count')
    if ch:
        waiting.append(f'{ch} değişiklik talebi' if tr else f"{ch} change request{'s' if ch != 1 else ''}")
    if dl:
        waiting.append(f'{dl} silme talebi' if tr else f"{dl} deletion request{'s' if dl != 1 else ''}")
    if waiting:
        joined = ' ve '.join(waiting) if tr else ' and '.join(waiting)
        out.append(f'{joined} onay bekliyor; onaylanana kadar onaylı değerler geçerlidir.' if tr
                   else f'{joined} await approval; until then the approved figures stand.')
    return ' '.join(out)


def previous_year_change(company, year, current_kg, today=None):
    """How *year* compares with the year before, for the dashboard:
    {'previous_year', 'previous_kg', 'current_kg', 'change_pct', 'months'}.

    A finished year is compared whole (questionnaire and custom-request
    amounts included, as in its total). The running year is compared month
    for month with the same months of last year — only when neither year holds
    annual questionnaire amounts, which can't be cut to months. None when
    there is nothing fair to compare."""
    from datetime import date
    from .models import CustomEmissionRequest, EmissionEntry
    today = today or date.today()
    try:
        year = int(year)
    except (TypeError, ValueError):
        return None
    if not company or year > today.year:
        return None
    prev_qs = EmissionEntry.objects.filter(company=company, year=year - 1, status='approved')
    if year < today.year:
        prev_kg = float(prev_qs.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
        prev_kg += float(CustomEmissionRequest.objects.filter(
            company=company, year=year - 1, status='approved', calculated_co2e_kg__isnull=False,
        electricity_method='',
        ).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
        cur_kg, months = float(current_kg or 0), 12
    else:
        cur_qs = EmissionEntry.objects.filter(company=company, year=year, status='approved')
        if (cur_qs.filter(description__startswith=ANNUAL_PREFIX).exists()
                or prev_qs.filter(description__startswith=ANNUAL_PREFIX).exists()):
            return None
        months = today.month
        cur_kg = float(cur_qs.filter(month__lte=months).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
        prev_kg = float(prev_qs.filter(month__lte=months).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    if prev_kg <= 0 or cur_kg <= 0:
        return None
    return {
        'previous_year': year - 1, 'previous_kg': prev_kg, 'current_kg': cur_kg,
        'change_pct': round((cur_kg - prev_kg) / prev_kg * 100, 1), 'months': months,
    }


def avoided_credit(entries):
    """The recycling credit inside an approved-entries queryset: {'total_kg'
    (negative), 'entries'} for the entries calculated with a negative factor
    (avoided virgin production), or None. Their source is unverified and the
    methodology decision is pending (emissions/NEGATIVE_FACTORS_REVIEW.md), so
    every place that presents a total says so."""
    from django.db.models import Count
    agg = entries.filter(emission_factor__factor_kg_co2e__lt=0).aggregate(
        t=Sum('calculated_co2e_kg'), n=Count('id'))
    if not (agg['n'] or 0):
        return None
    return {'total_kg': float(agg['t'] or 0), 'entries': agg['n']}


def avoided_credit_note(info, tr=False):
    """One sentence for a total that contains a recycling credit, or ''."""
    if not info:
        return ''
    from questionnaire.step_entries import _fmt
    t = _fmt(abs(info['total_kg']) / 1000, 3, 'tr' if tr else 'en')
    if tr:
        return (f'Bu toplam, geri dönüşümün kaçınılan üretim emisyonu olarak sayıldığı negatif faktörlerden '
                f'kaynaklanan {t} tCO₂e kredi içerir ve toplamı azaltır. Bu faktörlerin kaynağı doğrulanmamıştır; '
                f'yöntem kararı beklemektedir.')
    return (f'This total includes {t} tCO2e of credit from negative factors that count recycling as avoided '
            f'production, and it lowers the total. The source of these factors is not verified; the '
            f'methodology decision is pending.')

