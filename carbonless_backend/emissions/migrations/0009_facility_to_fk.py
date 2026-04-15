import django.db.models.deletion
from django.db import migrations, models


def clean_facility_data(apps, schema_editor):
    """Set facility to empty string then NULL after making nullable"""
    from django.db import connection
    with connection.cursor() as cursor:
        # Direct SQL to bypass Django model validation
        cursor.execute("UPDATE emissions_emissionentry SET facility = NULL")
        cursor.execute("UPDATE emissions_customemissionrequest SET facility = NULL")


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0005_remove_company_user'),
        ('emissions', '0008_emissionentry_approved_at_emissionentry_approved_by'),
    ]

    operations = [
        # Step 1: Remove facility_ref FK (added in migration 0007)
        migrations.RemoveField(
            model_name='customemissionrequest',
            name='facility_ref',
        ),
        migrations.RemoveField(
            model_name='emissionentry',
            name='facility_ref',
        ),

        # Step 2: Make facility CharField nullable first
        migrations.AlterField(
            model_name='emissionentry',
            name='facility',
            field=models.CharField(max_length=255, blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='customemissionrequest',
            name='facility',
            field=models.CharField(max_length=255, blank=True, null=True),
        ),

        # Step 3: Clean data (set all to NULL)
        migrations.RunPython(clean_facility_data, migrations.RunPython.noop),

        # Step 4: Convert to ForeignKey
        migrations.AlterField(
            model_name='emissionentry',
            name='facility',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='emission_entries',
                to='companies.facility',
                help_text='Structured facility reference',
            ),
        ),
        migrations.AlterField(
            model_name='customemissionrequest',
            name='facility',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='custom_emission_requests',
                to='companies.facility',
                help_text='Structured facility reference',
            ),
        ),
    ]
