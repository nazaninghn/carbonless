"""Link each existing inventory to its records, where that is unambiguous.

Before multi-inventory support, emission entries and custom requests were kept per (company, year) and most
carry no inventory (inventory_id IS NULL). This migration:

1. adds `CarbonReport.ownership_linked` (False for every inventory that exists now);
2. for each (company, reporting year) with EXACTLY ONE inventory (and not a member of a legacy duplicate
   group), tags with that inventory's id the rows ITS OWN ANSWERS produced ("Questionnaire step ..." and
   "Workspace ... (report N)" entries) and marks the inventory linked. That attribution is unique, so
   nothing is guessed, moved to the "newest" inventory, or copied to two inventories. Chat and form entries
   and custom requests are NOT tagged: deleting an inventory has never removed those, and the inventory
   keeps reading them while it is the only one of its year (emissions/inventory_scope.py). Only rows whose
   inventory_id IS NULL are touched; amounts, factors, statuses and every other column stay as they are;
3. leaves every ambiguous group (two or more inventories for one company and year, i.e. the legacy duplicate
   groups) untouched and unlinked: their unassigned rows stay where they are and stay readable by each member
   as before, and the migration prints the groups so they can be reviewed
   (`manage.py review_duplicate_inventories`);
4. sets the column default to True for every inventory created afterwards.

Inventories without a reporting year have no entries (the application never wrote any), so they are linked.

Reverse: drops the column. The tags written in step 2 are only a link (nullable FK, SET_NULL) and are left in
place: they cannot be told apart from tags written by the application later, and removing them would only
detach correct data.
"""
from django.db import migrations, models
from django.db.models import Count


def link_unambiguous(apps, schema_editor):
    CarbonReport = apps.get_model('questionnaire', 'CarbonReport')
    EmissionEntry = apps.get_model('emissions', 'EmissionEntry')

    ambiguous = (CarbonReport.objects.filter(reporting_year__isnull=False)
                 .values('company_id', 'reporting_year').annotate(n=Count('id')).filter(n__gt=1))
    ambiguous_keys = {(g['company_id'], g['reporting_year']) for g in ambiguous}

    linked = tagged = 0
    for report in CarbonReport.objects.all().order_by('pk'):
        if report.legacy_duplicate_year or (report.company_id, report.reporting_year) in ambiguous_keys:
            continue
        if report.reporting_year is not None and report.company_id is not None:
            own = EmissionEntry.objects.filter(
                company_id=report.company_id, year=report.reporting_year, inventory__isnull=True)
            tagged += own.filter(description__startswith='Questionnaire step ').update(inventory_id=report.pk)
            tagged += own.filter(description__startswith='Workspace ',
                                 description__endswith=f'(report {report.pk})').update(inventory_id=report.pk)
        CarbonReport.objects.filter(pk=report.pk).update(ownership_linked=True)
        linked += 1
    if linked or ambiguous_keys:
        print(f'\n  questionnaire.0015: {linked} inventories linked to their records ({tagged} entries tagged); '
              f'{len(ambiguous_keys)} ambiguous (company, year) groups left untouched and unlinked.')


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0014_multi_inventory'),
        ('emissions', '0026_inventory_link'),
    ]

    operations = [
        migrations.AddField(
            model_name='carbonreport',
            name='ownership_linked',
            field=models.BooleanField(default=False, db_default=False),
        ),
        migrations.RunPython(link_unambiguous, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='carbonreport',
            name='ownership_linked',
            field=models.BooleanField(default=True, db_default=True),
        ),
    ]
