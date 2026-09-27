"""
Signup used to send the legal entity name as the user's first_name, so every
profile's "Full name" showed the company name. Clear it where that is clearly
what happened: first_name equals the name of a company the user owns and no
last name was ever set. Anything the user typed themselves is left alone.
"""
from django.db import migrations


def clear(apps, schema_editor):
    CompanyMembership = apps.get_model('companies', 'CompanyMembership')
    for m in (CompanyMembership.objects
              .filter(role='owner')
              .select_related('user', 'company')):
        user = m.user
        if (user.first_name and not user.last_name
                and user.first_name.strip() == (m.company.legal_entity_name or '').strip()):
            user.first_name = ''
            user.save(update_fields=['first_name'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_contact_message_and_entry_notifications'),
        ('companies', '0008_company_certificates_and_more'),
    ]

    operations = [
        migrations.RunPython(clear, migrations.RunPython.noop),
    ]
