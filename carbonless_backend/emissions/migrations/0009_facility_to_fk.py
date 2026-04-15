import django.db.models.deletion
from django.db import migrations, models


def clean_facility_data(apps, schema_editor):
    """Set facility to NULL for all entries before converting to FK"""
    EmissionEntry = apps.get_model('emissions', 'EmissionEntry')
    CustomEmissionRequest = apps.get_model('emissions', 'CustomEmissionRequest')
    # Clear text facility values so FK conversion works
    EmissionEntry.objects.all().update(facility=None)
    CustomEmissionRequest.objects.all().update(facility=None)


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0005_remove_company_user'),
        ('emissions', '0008_emissionentry_approved_at_emissionentry_approved_by'),
    ]

    operations = [
        # First remove facility_ref (added in earlier migration)
        migrations.RemoveField(
            model_name='customemissionrequest',
            name='facility_ref',
        ),
        migrations.RemoveField(
            model_name='emissionentry',
            name='facility_ref',
        ),
        # Clean data before FK conversion
        migrations.RunPython(clean_facility_data, migrations.RunPython.noop),
        # Convert facility from CharField to FK
        migrations.AlterField(
            model_name='customemissionrequest',
            name='facility',
            field=models.ForeignKey(blank=True, help_text='Structured facility reference', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='custom_emission_requests', to='companies.facility'),
        ),
        migrations.AlterField(
            model_name='emissionentry',
            name='facility',
            field=models.ForeignKey(blank=True, help_text='Structured facility reference', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='emission_entries', to='companies.facility'),
        ),
    ]
