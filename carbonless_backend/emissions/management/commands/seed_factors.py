from decimal import Decimal

from django.core.management.base import BaseCommand
from emissions.models import EmissionFactor
from emissions.seed_data import EMISSION_FACTORS


class Command(BaseCommand):
    help = 'Seed emission factors from Defra 2024, IPCC, Turkey ISO 14064-1 verified inventory, Turkey-specific'

    def handle(self, *args, **options):
        created = 0
        updated = 0
        stale_splits = 0

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

            # A factor's per-gas breakdown is expressed in kg CO2e per unit and
            # has to add up to the factor itself, so a changed factor value
            # invalidates the split that was derived from the old one. Clear it
            # here rather than leave a breakdown that no longer sums — the
            # report would then publish gas rows that disagree with their own
            # total. `seed_gas_splits` re-derives them; the reminder below says so.
            existing = EmissionFactor.objects.filter(
                slug=data['slug'], country=data.get('country', 'global'),
                year=data['year']).first()
            if (existing and existing.gas_split_basis
                    and existing.factor_kg_co2e != Decimal(str(data['factor_kg_co2e']))):
                data.update({f: None for f in EmissionFactor.GAS_FIELDS.values()})
                data['gas_split_basis'] = ''
                data['gas_split_reference'] = ''
                stale_splits += 1

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
        if stale_splits:
            self.stdout.write(self.style.WARNING(
                f'{stale_splits} factor value(s) changed, so their per-gas breakdown was '
                f'cleared.'))
        self.stdout.write('Run "manage.py seed_gas_splits" to (re)derive the per-gas '
                          'breakdown ISO 14064-1 reporting uses.')
