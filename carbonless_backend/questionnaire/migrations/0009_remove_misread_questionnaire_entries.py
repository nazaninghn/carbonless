"""
Remove emission entries the questionnaire created from answers that are not
activity amounts: every number in any 3A/3B/3C/4A/4B step used to be read as
consumption, so e.g. a supplier EF document (value 5, year 2026) became
"2031 kWh natural gas", the unit electricity price became grid kWh and
on-site solar production was added to grid electricity.

Only rows whose description is exactly the auto-generated
"Questionnaire step <id>" of a step that no longer creates entries are
removed; 3A-5 (fuel) and 4A-1 (electricity) entries are kept.
"""
import re

from django.db import migrations

KEEP = {'3A-5', '4A-1'}
AUTO = re.compile(r'^Questionnaire step (\S+)$')


def remove(apps, schema_editor):
    EmissionEntry = apps.get_model('emissions', 'EmissionEntry')
    ids = []
    for pk, description in (EmissionEntry.objects
                            .filter(description__startswith='Questionnaire step ')
                            .values_list('pk', 'description')):
        m = AUTO.match(description or '')
        if m and m.group(1) not in KEEP:
            ids.append(pk)
    EmissionEntry.objects.filter(pk__in=ids).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('questionnaire', '0008_carbonreport_client_progress'),
        ('emissions', '0015_keep_company_data_on_user_delete'),
    ]

    operations = [
        migrations.RunPython(remove, migrations.RunPython.noop),
    ]
