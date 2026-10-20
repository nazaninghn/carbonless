"""
Bring the questionnaire's existing entries up to date without changing what
the inventory reports:

- their bilingual calculation text (calc_detail) and current label — an
  entry is only touched when the answers still give the same factor, amount
  and facility for it;
- entries made before the electricity of each facility (4A-1) became its own
  entry: when the answers give the same factors and the same total amounts,
  only split by facility, the entry is replaced by one per facility with the
  same status, approval and proof document;
- proof documents an earlier version of this split left behind: a proof file
  in storage that no entry points at any more is attached again to the
  questionnaire rows of its source (see `reattach_orphan_proofs`).

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


def reattach_orphan_proofs():
    """Proof documents of questionnaire rows that were rebuilt (an answer
    saved again, or the facility split) before proofs were carried over: the
    file is still in storage but no entry points at it. The upload's history
    row ("… · Kanıt eklendi: <file>") names its company, source and year; the
    file is attached again to that year's questionnaire rows of the same
    source that have no proof. Entries deleted by a user (logged as
    entry_deleted) are left alone. Returns how many files were reattached."""
    from django.core.files.storage import default_storage
    from django.db.models import Q
    from accounts.history_text import _SEGMENT
    from accounts.models import ActivityLog
    from emissions.inventory import ANNUAL_PREFIX
    from emissions.models import EmissionEntry
    marker = 'Kanıt eklendi: '
    deleted = set(ActivityLog.objects.filter(action='entry_deleted', target_type='EmissionEntry')
                  .values_list('target_id', flat=True))
    done = 0
    for log in (ActivityLog.objects.filter(action='entry_updated', target_type='EmissionEntry',
                                           detail__contains=marker).order_by('created_at')):
        if log.target_id in deleted or EmissionEntry.objects.filter(pk=log.target_id).exists():
            continue
        summary, _sep, basename = log.detail.partition(' · ' + marker)
        name = f'proofs/{log.created_at:%Y/%m}/{basename.strip()}'
        m = _SEGMENT.match(summary)
        company_id = (log.metadata or {}).get('company_id')
        if not m or not company_id or EmissionEntry.objects.filter(proof_document=name).exists():
            continue
        try:
            if not default_storage.exists(name):
                continue
        except Exception:
            continue
        targets = (EmissionEntry.objects
                   .filter(company_id=company_id, year=int(m['year']), emission_factor__name=m['name'],
                           description__startswith=ANNUAL_PREFIX)
                   .filter(Q(proof_document='') | Q(proof_document__isnull=True)))
        if targets.update(proof_document=name):
            done += 1
    return done


class Command(BaseCommand):
    help = "Fill calc_detail / labels of questionnaire entries and split them by facility (no amount changes)."

    def handle(self, *args, **options):
        from emissions.models import EmissionEntry
        from questionnaire.models import CarbonReport, ReportStep
        from questionnaire.step_entries import (
            ENTRY_STEPS, activities_for_report, _entry_specs, _step_entries, _backfill_detail,
            _value, _q4, _step_rows, _facility_lookup, _row_key, _entry_key, recorded_connections)
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
            # A signed / completed inventory is split with the connections it was applied with.
            with recorded_connections(report):
                groups = activities_for_report(answers, year, company)
                facility_of = _facility_lookup(company)
                step_rows = {step: _step_rows(step, _entry_specs(step, groups.get(step, []), A, year, company),
                                              facility_of) for step in ENTRY_STEPS}
            for step in ENTRY_STEPS:
                rows = step_rows[step]
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
                    proof = next((e.proof_document.name for e in entries if e.proof_document), None)
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
                                status=first.status, approved_by=first.approved_by, approved_at=first.approved_at,
                                # the combined entry's invoice covers every facility's share
                                proof_document=proof)
                    split += 1
                else:
                    _backfill_detail(entries, rows)
        reattached = reattach_orphan_proofs()
        self.stdout.write(self.style.SUCCESS(
            f'Checked {checked} questionnaire entries; split {split} answer(s) by facility; '
            f'reattached {reattached} proof document(s).'))
