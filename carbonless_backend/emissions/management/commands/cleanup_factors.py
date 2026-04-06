"""Remove duplicate factors, keep only the one with correct year per slug+country."""
from django.core.management.base import BaseCommand
from emissions.models import EmissionFactor
from django.db.models import Count

SOURCE_YEAR = {
    'defra_2024': 2024, 'ipcc_2006': 2006, 'ipcc_2019': 2019,
    'turkey_grid': 2023, 'atom_kablo': 2023, 'icao': 2025,
    'turkey_fleet': 2025, 'generic': 2024, 'custom': 2024,
}


class Command(BaseCommand):
    help = 'Cleanup duplicate emission factors'

    def handle(self, *args, **options):
        # First update all factors with correct year based on source
        for f in EmissionFactor.objects.all():
            correct_year = SOURCE_YEAR.get(f.source, 2024)
            if f.year != correct_year:
                # Check if a factor with correct year already exists
                exists = EmissionFactor.objects.filter(
                    slug=f.slug, country=f.country, year=correct_year
                ).exclude(pk=f.pk).exists()
                if exists:
                    # This is a duplicate with wrong year, check if referenced
                    if not f.emission_entries.exists():
                        f.delete()
                        self.stdout.write(f"  Deleted duplicate: {f.slug}/{f.country} year={f.year}")
                    else:
                        self.stdout.write(f"  Kept (has entries): {f.slug}/{f.country} year={f.year}")
                else:
                    f.year = correct_year
                    f.is_default = True
                    try:
                        f.save()
                    except Exception:
                        # If save fails due to unique constraint, delete if no entries
                        if not f.emission_entries.exists():
                            f.delete()
                            self.stdout.write(f"  Deleted conflict: {f.slug}/{f.country}")

        # Set all remaining as is_default=True
        EmissionFactor.objects.all().update(is_default=True)

        self.stdout.write(self.style.SUCCESS(
            f"Done. Total factors: {EmissionFactor.objects.count()}"
        ))
