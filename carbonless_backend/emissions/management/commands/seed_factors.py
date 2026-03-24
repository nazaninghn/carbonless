from django.core.management.base import BaseCommand
from emissions.models import EmissionFactor
from emissions.seed_data import EMISSION_FACTORS


class Command(BaseCommand):
    help = 'Seed emission factors from Defra 2024, IPCC, ATOM KABLO, Turkey-specific'

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for fd in EMISSION_FACTORS:
            obj, was_created = EmissionFactor.objects.update_or_create(
                slug=fd['slug'],
                country=fd.get('country', 'global'),
                defaults=fd
            )
            if was_created:
                created += 1
            else:
                updated += 1

        total = EmissionFactor.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f'Done: {created} created, {updated} updated. Total in DB: {total}'
        ))
