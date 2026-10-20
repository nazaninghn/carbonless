"""One inventory per company and reporting year, enforced by the database.

Emission entries are stored per company and year, so two inventories of one year
share (and overwrite) one set of numbers. This migration:

1. adds `legacy_duplicate_year` (db_default False — instances still running the code
   from before it insert reports without it);
2. flags the members of every duplicate group that ALREADY exists. It changes no
   answer, status, signature, year or entry, deletes nothing and refuses nothing — only
   this flag, with a plain UPDATE (updated_at is not touched). Flagged rows are left
   exactly as they are; they are exempt from the constraint, and the application refuses
   writes to them until the duplicate is resolved
   (`manage.py review_duplicate_inventories` lists them);
3. adds the partial unique constraint for every other inventory, so no new duplicate can
   be created — by any code path, or by two requests at once.

Reverse: drops the constraint and the column (nothing else was changed). Safe to run on
a database with duplicates (the dev database has a group of 22) and on one without.
"""
from django.db import migrations, models
from django.db.models import Count


def flag_existing_duplicates(apps, schema_editor):
    CarbonReport = apps.get_model('questionnaire', 'CarbonReport')
    groups = (CarbonReport.objects.filter(reporting_year__isnull=False)
              .values('company_id', 'reporting_year').annotate(n=Count('id')).filter(n__gt=1))
    flagged = 0
    for g in groups:
        flagged += (CarbonReport.objects
                    .filter(company_id=g['company_id'], reporting_year=g['reporting_year'])
                    .update(legacy_duplicate_year=True))
    if flagged:
        print(f'\n  questionnaire.0012: flagged {flagged} inventories in existing duplicate '
              f'(company, year) groups as legacy; no value was changed. '
              f'Run `manage.py review_duplicate_inventories` to review them.')


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0010_facility_grid_connection'),
        ('questionnaire', '0011_report_applied_grid_connections'),
    ]

    operations = [
        migrations.AddField(
            model_name='carbonreport',
            name='legacy_duplicate_year',
            field=models.BooleanField(db_default=False, default=False),
        ),
        migrations.RunPython(flag_existing_duplicates, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='carbonreport',
            constraint=models.UniqueConstraint(
                condition=models.Q(('legacy_duplicate_year', False), ('reporting_year__isnull', False)),
                fields=('company', 'reporting_year'), name='uniq_inventory_per_company_year'),
        ),
    ]
