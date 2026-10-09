"""
Give the questionnaire's existing entries their bilingual calculation text
(calc_detail) and current label, without rebuilding any entry: an entry is
only touched when the inventory's answers still give the same factor and
amount for it, so approvals and amounts never change here.
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Fill calc_detail / labels of questionnaire entries (text only)."

    def handle(self, *args, **options):
        from questionnaire.models import CarbonReport, ReportStep
        from questionnaire.step_entries import (
            ENTRY_STEPS, activities_for_report, _entry_specs, _step_entries, _backfill_detail,
            _value, _q4, DESCRIPTION_PREFIX)
        done = 0
        seen = set()
        for report in CarbonReport.objects.exclude(company=None).exclude(reporting_year=None).order_by('-updated_at'):
            key = (report.company_id, report.reporting_year)
            if key in seen:  # entries belong to the company's year, newest inventory first
                continue
            seen.add(key)
            answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
            A = {k: _value(v) for k, v in answers.items()}
            year = report.reporting_year
            groups = activities_for_report(answers, year, report.company)
            for step in ENTRY_STEPS:
                specs = _entry_specs(step, groups.get(step, []), A, year, report.company)
                base = f'{DESCRIPTION_PREFIX} {step}'
                many = len(specs) > 1
                rows = [(f, _q4(q), f'{base} · {lab["tr"]}' if lab['tr'] and (many or f.slug.startswith('calculated-')) else base,
                         lab if lab['tr'] else None) for f, q, lab in specs]
                entries = list(_step_entries(report.company, year, step))
                if entries:
                    _backfill_detail(entries, rows)
                    done += len(entries)
        self.stdout.write(self.style.SUCCESS(f'Checked {done} questionnaire entries.'))
