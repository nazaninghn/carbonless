"""
Bring the questionnaire's existing entries up to date without changing what
the inventory reports:

- their bilingual calculation text (calc_detail) and current label — an
  entry is only touched when the answers still give the same factor, amount
  and facility for it;
- entries made before the electricity of each facility (4A-1) became its own
  entry: when the answers give the same factors and the same total amounts,
  only split by facility, the entry is replaced by one per facility with the
  same status and approval.

Amounts, totals and approvals never change here.
"""
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction


def _totals(pairs):
    out = defaultdict(lambda: 0)
    for factor_id, qty in pairs:
        out[factor_id] += qty
    return dict(out)


class Command(BaseCommand):
    help = "Fill calc_detail / labels of questionnaire entries and split them by facility (no amount changes)."

    def handle(self, *args, **options):
        from emissions.models import EmissionEntry
        from questionnaire.models import CarbonReport, ReportStep
        from questionnaire.step_entries import (
            ENTRY_STEPS, activities_for_report, _entry_specs, _step_entries, _backfill_detail,
            _value, _q4, _step_rows, _facility_lookup, _row_key, _entry_key)
        checked = split = 0
        seen = set()
        for report in CarbonReport.objects.exclude(company=None).exclude(reporting_year=None).order_by('-updated_at'):
            key = (report.company_id, report.reporting_year)
            if key in seen:  # entries belong to the company's year, newest inventory first
                continue
            seen.add(key)
            answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
            A = {k: _value(v) for k, v in answers.items()}
            year, company = report.reporting_year, report.company
            groups = activities_for_report(answers, year, company)
            facility_of = _facility_lookup(company)
            for step in ENTRY_STEPS:
                rows = _step_rows(step, _entry_specs(step, groups.get(step, []), A, year, company), facility_of)
                entries = list(_step_entries(company, year, step))
                if not entries:
                    continue
                checked += len(entries)
                statuses = {e.status for e in entries}
                if (sorted(_row_key(r) for r in rows) != sorted(_entry_key(e) for e in entries)
                        and len(statuses) == 1
                        and _totals((r[0].id, r[1]) for r in rows)
                        == _totals((e.emission_factor_id, _q4(e.quantity)) for e in entries)):
                    first = entries[0]
                    old_by_factor = {e.emission_factor_id: e for e in entries}
                    with transaction.atomic():
                        for e in entries:
                            e.delete()
                        for factor, qty, description, detail, facility in rows:
                            EmissionEntry.objects.create(
                                user=first.user, company=company, emission_factor=factor, year=year,
                                month=first.month, quantity=qty, calculated_co2e_kg=qty * factor.factor_kg_co2e,
                                description=description, calc_detail=detail, facility=facility,
                                # the factor the old entry was snapshotted with
                                factor_value_snapshot=old_by_factor[factor.id].factor_value_snapshot,
                                factor_source_snapshot=old_by_factor[factor.id].factor_source_snapshot,
                                status=first.status, approved_by=first.approved_by, approved_at=first.approved_at)
                    split += 1
                else:
                    _backfill_detail(entries, rows)
        self.stdout.write(self.style.SUCCESS(
            f'Checked {checked} questionnaire entries; split {split} answer(s) by facility.'))
