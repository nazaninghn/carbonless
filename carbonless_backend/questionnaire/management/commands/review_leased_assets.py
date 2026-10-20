"""List leased-asset rows (question 97, Scope 3 Category 8) that may overlap with
Scope 1/2 and need a person's decision.

Read-only: it writes nothing and excludes nothing. A row qualifies when it was
saved before the question asked "already reported in Scope 1/2?" (no answer),
is tied to no registered facility, is a building, and either the organisational
boundary is Operational Control or the inventory reports Scope 1/2 energy. Names
are never compared: the way to settle a row is to link it to a facility (then the
inventory's own Scope 1/2 entries decide) or to answer the question.

    python manage.py review_leased_assets            # every company
    python manage.py review_leased_assets --company 7
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "List legacy leased-asset rows that may overlap Scope 1/2 (read-only; nothing is changed)."

    def add_arguments(self, parser):
        parser.add_argument('--company', type=int, default=None, help='Only this company id.')

    def handle(self, *args, **options):
        from questionnaire.models import CarbonReport, ReportStep
        from questionnaire.step_entries import (
            _GATES, _has_scope12_energy, _number, _rows, _value, is_operational_control,
            leased_review_reasons, report_is_locked)
        reports = CarbonReport.objects.exclude(company=None).select_related('company').order_by(
            'company_id', '-reporting_year', '-id')
        if options['company']:
            reports = reports.filter(company_id=options['company'])
        found = checked = 0
        for report in reports:
            A = {k: _value(v) for k, v in ReportStep.objects.filter(report=report).values_list('step_id', 'answer')}
            if A.get(_GATES['K3C8-1']) not in (None, '', 'yes'):
                continue                       # the gate is closed: no leased asset counts
            rows = _rows(A.get('K3C8-1'))
            if not rows:
                continue
            checked += 1
            operational, scope12 = is_operational_control(A), _has_scope12_energy(A)
            for n, row in enumerate(rows, 1):
                reasons = leased_review_reasons(row, operational, scope12)
                if not reasons:
                    continue
                found += 1
                kwh, area = _number(row.get('declaration_kwh')), _number(row.get('area_m2'))
                self.stdout.write(
                    f'company {report.company_id} ({report.company.legal_entity_name}) · inventory #{report.pk} '
                    f'{report.reporting_year} [{"signed/completed" if report_is_locked(report) else "draft"}] · '
                    f'row {n}: {row.get("asset_type")} · area {area or "-"} m² · declared kWh {kwh or "-"} · '
                    f'reasons: {", ".join(reasons)} · counted in Category 8: yes')
        self.stdout.write(self.style.SUCCESS(
            f'{found} leased-asset row(s) to review in {checked} inventory(ies) with leased assets. '
            'Nothing was changed. Link each to a facility in Q97, or answer whether it is in Scope 1/2.'))
