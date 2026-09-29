"""
Public transport factors (Turkey: train, metro, bus, dolmuş) are business
travel in vehicles owned by third parties: Scope 3, Category 6 (GHG Protocol
Scope 3 Standard), not Scope 1 mobile combustion. Same rule and fix as 0017
for commercial flights; the seed data is changed alongside. Values unchanged.
"""
from django.db import migrations


def move_to_scope3(apps, schema_editor):
    EmissionFactor = apps.get_model('emissions', 'EmissionFactor')
    EmissionFactor.objects.filter(slug__in=('train', 'metro', 'bus', 'dolmus'), country='turkey').update(
        scope='scope3', category='business_travel')


class Migration(migrations.Migration):

    dependencies = [
        ('emissions', '0017_commercial_flights_scope3'),
    ]

    operations = [
        migrations.RunPython(move_to_scope3, migrations.RunPython.noop),
    ]
