"""Allow multiple inventories per company and reporting year.

Drops the unique constraint 'uniq_inventory_per_company_year' so two inventories
of the same year can coexist, with entries stored per inventory (via the
EmissionEntry.inventory FK) rather than per company+year.

Reverse operation: re-adds the constraint only when no (company, reporting_year)
duplicates exist in the current data. If duplicates exist it prints a warning and
skips, exactly mirroring the safety pattern in 0012.
"""
from django.db import migrations, models


def _readd_constraint_if_safe(apps, schema_editor):
    CarbonReport = apps.get_model('questionnaire', 'CarbonReport')
    from django.db.models import Count
    duplicates = (
        CarbonReport.objects
        .filter(reporting_year__isnull=False, legacy_duplicate_year=False)
        .values('company_id', 'reporting_year')
        .annotate(n=Count('id'))
        .filter(n__gt=1)
    )
    if duplicates.exists():
        print(
            '\n  questionnaire.0014 reverse: cannot re-add uniq_inventory_per_company_year '
            '— (company, year) duplicates exist in the data. '
            'Skipping the constraint; run manage.py review_duplicate_inventories to inspect them.'
        )
        return
    schema_editor.execute(
        "ALTER TABLE questionnaire_carbonreport ADD CONSTRAINT "
        "uniq_inventory_per_company_year UNIQUE (company_id, reporting_year) "
        "DEFERRABLE INITIALLY DEFERRED"
    )


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0013_report_pending_questions'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='carbonreport',
            name='uniq_inventory_per_company_year',
        ),
    ]
