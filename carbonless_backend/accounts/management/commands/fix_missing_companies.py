"""
Management command: creates a default Company + owner membership for every
user who doesn't have one yet. Safe to run multiple times (idempotent).

Usage:
  python manage.py fix_missing_companies
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from companies.models import Company, CompanyMembership


class Command(BaseCommand):
    help = 'Create a default company for users who do not have one'

    def handle(self, *args, **options):
        users_without_company = User.objects.exclude(
            company_memberships__isnull=False
        )
        created = 0
        for user in users_without_company:
            company = Company.objects.create(
                legal_entity_name=f"{user.username}'s Company",
                tax_number='—',
                country_of_headquarters='Not set',
                countries_of_operation='Not set',
                nace_code='',
                main_activity_description='Not set',
                number_of_employees='1-10',
                annual_turnover_range='Not set',
                number_of_facilities=1,
            )
            CompanyMembership.objects.create(user=user, company=company, role='owner')
            created += 1
            self.stdout.write(f'  Created company for: {user.username}')

        self.stdout.write(self.style.SUCCESS(f'Done. Created {created} companies.'))
