"""
Commercial flights ('flight-domestic', 'flight-international') are Scope 3,
Category 6 business travel (GHG Protocol Scope 3 Standard; ISO 14064-1:2018
Category 3), not Scope 1 mobile combustion. Migration 0012 made that change,
but seed_factors re-created them in Scope 1 on every deploy; the seed data is
fixed alongside this migration. Factor values are unchanged.
"""
from django.db import migrations


def move_to_scope3(apps, schema_editor):
    EmissionFactor = apps.get_model('emissions', 'EmissionFactor')
    EmissionFactor.objects.filter(slug__in=('flight-domestic', 'flight-international')).update(
        scope='scope3', category='business_travel')


class Migration(migrations.Migration):

    dependencies = [
        ('emissions', '0016_approve_legacy_approver_entries'),
    ]

    operations = [
        migrations.RunPython(move_to_scope3, migrations.RunPython.noop),
    ]
