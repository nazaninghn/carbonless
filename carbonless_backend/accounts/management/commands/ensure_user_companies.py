"""
Management command: ensure_user_companies

Ensures every user has an active CompanyMembership. Users without a company
get a default one created automatically. Also fixes any EmissionEntries
that have company=None by linking them to the user's company.

Run on every deploy via build.sh to prevent the "dashboard shows 0" bug
when a user exists without a company association.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Ensure all users have a company + membership. Fix orphan entries.'

    def handle(self, *args, **options):
        from companies.models import Company, CompanyMembership
        from companies.utils import get_current_company
        from emissions.models import EmissionEntry

        users_fixed = 0
        entries_fixed = 0

        for user in User.objects.all():
            company = get_current_company(user)

            if not company:
                # Create a default company for this user
                company_name = f"{user.username}'s Company"
                try:
                    company = Company.objects.create(
                        legal_entity_name=company_name,
                        tax_number='0000000000',
                        country_of_headquarters='Turkey',
                        countries_of_operation='Turkey',
                        nace_code='62.01',
                        main_activity_description='Auto-created on deploy',
                        number_of_employees='1-10',
                        annual_turnover_range='<1M',
                        number_of_facilities=1,
                        has_overseas_operations=False,
                        number_of_subsidiaries=0,
                        has_iso_14001=False,
                        has_iso_50001=False,
                        has_iso_14064_work=False,
                        target_iso_14064_verification=False,
                        has_3rd_party_audit_plan=False,
                        is_for_financing=False,
                        is_due_to_export_pressure=False,
                        is_for_group_reporting=False,
                    )
                    CompanyMembership.objects.create(
                        user=user,
                        company=company,
                        role='admin',
                        is_active=True,
                    )
                    users_fixed += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'  Created company for user "{user.username}"')
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.WARNING(f'  Could not create company for "{user.username}": {e}')
                    )
                    continue

            # Fix any orphan entries (company=None) for this user
            orphans = EmissionEntry.objects.filter(user=user, company__isnull=True)
            count = orphans.update(company=company)
            if count:
                entries_fixed += count
                self.stdout.write(f'  Fixed {count} orphan entries for "{user.username}"')

        if users_fixed or entries_fixed:
            self.stdout.write(self.style.SUCCESS(
                f'Done: {users_fixed} users got companies, {entries_fixed} orphan entries fixed.'
            ))
        else:
            self.stdout.write('All users already have companies. Nothing to fix.')
