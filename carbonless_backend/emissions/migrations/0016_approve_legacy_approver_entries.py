"""
Totals and reports now count approved entries only (emissions/inventory.py).

An entry an owner/admin/manager saves is approved on creation, but entries
saved before that rule existed may still sit at the model default
('submitted') with nobody expected to approve them. Approve exactly those —
still 'submitted', no rejection reason, author currently an active
owner/admin/manager of the entry's company — so a company's existing totals
don't shrink when the rule changes. Entries from data-entry members, or from
authors who are no longer approvers, stay pending for review.
"""
from django.db import migrations

APPROVER_ROLES = ('owner', 'admin', 'manager')


def approve_legacy(apps, schema_editor):
    EmissionEntry = apps.get_model('emissions', 'EmissionEntry')
    CompanyMembership = apps.get_model('companies', 'CompanyMembership')
    approvers = set(
        CompanyMembership.objects
        .filter(is_active=True, role__in=APPROVER_ROLES)
        .values_list('company_id', 'user_id')
    )
    ids = [
        pk for pk, company_id, user_id in
        EmissionEntry.objects.filter(status='submitted', rejected_reason='')
        .exclude(user_id__isnull=True).exclude(company_id__isnull=True)
        .values_list('id', 'company_id', 'user_id')
        if (company_id, user_id) in approvers
    ]
    if ids:
        EmissionEntry.objects.filter(id__in=ids).update(status='approved')


class Migration(migrations.Migration):

    dependencies = [
        ('emissions', '0015_keep_company_data_on_user_delete'),
        ('companies', '0008_company_certificates_and_more'),
    ]

    operations = [
        migrations.RunPython(approve_legacy, migrations.RunPython.noop),
    ]
