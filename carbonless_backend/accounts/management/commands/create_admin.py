import os
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Create default admin superuser with company if not exists'

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME', 'admin')
        password = os.environ.get('ADMIN_PASSWORD', 'admin123456')
        email = os.environ.get('ADMIN_EMAIL', 'admin@carbonless.com')

        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email, 'is_staff': True, 'is_superuser': True}
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Superuser "{username}" created'))
        else:
            self.stdout.write(f'Superuser "{username}" already exists')

        # Ensure admin has a company and membership
        from companies.models import Company, CompanyMembership
        membership = CompanyMembership.objects.filter(user=user, is_active=True).first()
        if not membership:
            company, _ = Company.objects.get_or_create(
                legal_entity_name='Carbonless Admin',
                defaults={
                    'tax_number': '0000000000',
                    'country_of_headquarters': 'Turkey',
                    'countries_of_operation': 'Turkey',
                    'main_activity_description': 'Platform administration',
                    'number_of_employees': '1-10',
                    'annual_turnover_range': '<1M',
                    'number_of_facilities': 1,
                }
            )
            CompanyMembership.objects.get_or_create(
                user=user,
                company=company,
                defaults={'role': 'owner', 'is_active': True}
            )
            self.stdout.write(self.style.SUCCESS(f'Company + membership created for "{username}"'))
        else:
            self.stdout.write(f'Membership already exists for "{username}"')
