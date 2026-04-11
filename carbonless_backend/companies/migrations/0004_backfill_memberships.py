from django.db import migrations


def forwards(apps, schema_editor):
    Company = apps.get_model('companies', 'Company')
    CompanyMembership = apps.get_model('companies', 'CompanyMembership')

    for company in Company.objects.all():
        CompanyMembership.objects.get_or_create(
            company=company,
            user=company.user,
            defaults={'role': 'owner', 'is_active': True},
        )


class Migration(migrations.Migration):
    dependencies = [
        ('companies', '0003_companymembership'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
