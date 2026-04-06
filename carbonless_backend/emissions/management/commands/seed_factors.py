from django.core.management.base import BaseCommand
from emissions.models import EmissionFactor
from emissions.seed_data import EMISSION_FACTORS


class Command(BaseCommand):
    help = 'Seed emission factors from Defra 2024, IPCC, ATOM KABLO, Turkey-specific'

    def handle(self, *args, **options):
        created = 0
        updated = 0

        # Source -> year mapping for factors that don't have explicit year
        source_year = {
            'defra_2024': 2024, 'ipcc_2006': 2006, 'ipcc_2019': 2019,
            'turkey_grid': 2023, 'atom_kablo': 2023, 'icao': 2025,
            'turkey_fleet': 2025, 'generic': 2024, 'custom': 2024,
        }

        for fd in EMISSION_FACTORS:
            data = dict(fd)
            # Add year if not present
            if 'year' not in data:
                data['year'] = source_year.get(data.get('source', 'generic'), 2024)
            # Add is_active/is_default if not present
            data.setdefault('is_active', True)
            data.setdefault('is_default', True)

            obj, was_created = EmissionFactor.objects.update_or_create(
                slug=data['slug'],
                country=data.get('country', 'global'),
                year=data['year'],
                defaults=data
            )
            if was_created:
                created += 1
            else:
                updated += 1

        total = EmissionFactor.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f'Done: {created} created, {updated} updated. Total in DB: {total}'
        ))
