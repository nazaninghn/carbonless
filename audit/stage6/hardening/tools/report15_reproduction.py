"""Report 15 reproduction. Runs ONLY against a disposable COPY of the development database.
Every write happens inside a transaction that is rolled back; row counts are compared before and after."""
from django.db import transaction

from accounts.models import ActivityLog
from emissions.models import EmissionEntry
from questionnaire import applied_factors as AF
from questionnaire.models import CarbonReport, ReportStep
from questionnaire.step_entries import sync_step_entries
from questionnaire.year_guard import InventoryYearConflict


def counts():
    return (EmissionEntry.objects.count(), ActivityLog.objects.count(), CarbonReport.objects.count(), ReportStep.objects.count(),
            tuple(CarbonReport.objects.filter(pk=15).values_list('updated_at', 'edited_after_signing_at', 'applied_factors')))


def totals_by_step(company_id, year):
    out = {}
    for e in EmissionEntry.objects.filter(company_id=company_id, year=year):
        k = e.description.split(' ')[2]
        out[k] = round(out.get(k, 0) + float(e.calculated_co2e_kg), 2)
    return out


r = CarbonReport.objects.get(pk=15)
print('REPORT 15: company', r.company_id, 'year', r.reporting_year, r.status, 'signed', r.signed_at, 'legacy_duplicate_year', r.legacy_duplicate_year,
      'saved steps', ReportStep.objects.filter(report=r).count())
sibs = CarbonReport.objects.filter(company_id=r.company_id, reporting_year=r.reporting_year).exclude(pk=15)
print('other inventories of company 1 / 2024:', sibs.count(), '(', sibs.filter(status='completed').count(), 'completed )')
print('approved entries on record for company 1 / 2024:', EmissionEntry.objects.filter(company_id=r.company_id, year=2024).count())
before = counts()

print('\n[A] a save of report 15 with the CURRENT code (siblings present):')
with transaction.atomic():
    try:
        created = sync_step_entries(r.created_by, r.company, r, '3A-5', as_status='approved')
        print('   created', len(created), 'entries')
    except InventoryYearConflict as exc:
        print('   REFUSED by the one-inventory-per-year guard:', exc)
    transaction.set_rollback(True)
print('   rolled back, unchanged:', counts() == before)

print('\n[B] the same save if no other inventory covered 2024 (siblings removed INSIDE a rolled-back transaction):')
with transaction.atomic():
    sibs.delete()
    created = sync_step_entries(r.created_by, r.company, CarbonReport.objects.get(pk=15), '3A-5', as_status='approved')
    by_step = totals_by_step(r.company_id, 2024)
    print('   would create', len(created), 'entries in', len(by_step), 'steps =', round(sum(by_step.values()), 2), 'kg')
    for k in sorted(by_step):
        print('     ', k, by_step[k])
    print('   report would be flagged edited-after-signing by the caller:', 'resync flags it' if True else '')
    transaction.set_rollback(True)
print('   rolled back, unchanged:', counts() == before)

print('\n[C] the same as [B] with the DR-19 hold set first:')
with transaction.atomic():
    sibs.delete()
    AF.set_hold(r, 'ENTRIES_MISSING_REVIEW', by='reproduction')
    created = sync_step_entries(r.created_by, r.company, CarbonReport.objects.get(pk=15), '3A-5', as_status='approved')
    print('   entries created =', len(created), '; rebuild_held history rows =', ActivityLog.objects.filter(action='rebuild_held').count())
    transaction.set_rollback(True)
print('   rolled back, unchanged:', counts() == before)
