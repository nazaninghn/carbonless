"""List companies that have more than one inventory for the same reporting year.

A company can have one inventory per year: emission entries belong to the company
and year, so a second inventory shares (and used to overwrite) the first one's
numbers. Groups that existed when the rule was introduced were flagged by migration
0012 (`legacy_duplicate_year`) and left exactly as they were. None of their members
can be saved until the duplicate is resolved — by deleting the extra inventory in
the app (Carbon Inventory > Delete) — and this command shows what is waiting.

    python manage.py review_duplicate_inventories                  # read-only
    python manage.py review_duplicate_inventories --company 7
    python manage.py review_duplicate_inventories --clear-resolved # clears the flag of rows that are
                                                                   # alone in their year now (nothing else)
Nothing is ever deleted or recalculated here.
"""
from django.core.management.base import BaseCommand
from django.db.models import Count


class Command(BaseCommand):
    help = "List duplicate (company, year) inventory groups (read-only; --clear-resolved clears resolved flags only)."

    def add_arguments(self, parser):
        parser.add_argument('--company', type=int, default=None, help='Only this company id.')
        parser.add_argument('--clear-resolved', action='store_true',
                            help='Clear legacy_duplicate_year on inventories that are the only one of their year now.')

    def handle(self, *args, **options):
        from questionnaire.models import CarbonReport
        reports = CarbonReport.objects.filter(reporting_year__isnull=False)
        if options['company']:
            reports = reports.filter(company_id=options['company'])
        groups = (reports.values('company_id', 'reporting_year').annotate(n=Count('id')).filter(n__gt=1)
                  .order_by('company_id', '-reporting_year'))
        shown = 0
        for g in groups:
            members = list(reports.filter(company_id=g['company_id'], reporting_year=g['reporting_year'])
                           .select_related('company').order_by('id'))
            shown += 1
            self.stdout.write(f'company {g["company_id"]} ({members[0].company.legal_entity_name}) · {g["reporting_year"]} · '
                              f'{g["n"]} inventories:')
            for r in members:
                state = 'signed' if r.signed_at else str(r.status)
                self.stdout.write(f'    #{r.pk}  {state:12} flagged_legacy={r.legacy_duplicate_year}  '
                                  f'updated {r.updated_at:%Y-%m-%d %H:%M}  "{r.title}"')
        resolved = list(reports.filter(legacy_duplicate_year=True).exclude(
            pk__in=[r.pk for g in groups for r in reports.filter(company_id=g['company_id'], reporting_year=g['reporting_year'])]))
        if resolved:
            self.stdout.write(f'{len(resolved)} flagged inventor{"y" if len(resolved) == 1 else "ies"} no longer share their year: '
                              + ', '.join(f'#{r.pk}' for r in resolved))
            if options['clear_resolved']:
                n = CarbonReport.objects.filter(pk__in=[r.pk for r in resolved]).update(legacy_duplicate_year=False)
                self.stdout.write(self.style.SUCCESS(f'cleared the flag on {n} (nothing else was changed).'))
        self.stdout.write(self.style.SUCCESS(
            f'{shown} duplicate group(s). Delete the extra inventory in the app to resolve one; nothing was changed here'
            + ('' if not options['clear_resolved'] else ' except the cleared flags') + '.'))
