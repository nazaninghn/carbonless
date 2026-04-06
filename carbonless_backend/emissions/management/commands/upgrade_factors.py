"""
One-time command to upgrade EmissionFactors:
1. Set year from source field
2. Set is_default=True for all
3. Fix scope for Turkey transport factors (travel/commuting -> Scope 3)
"""
from django.core.management.base import BaseCommand
from emissions.models import EmissionFactor

SOURCE_YEAR_MAP = {
    'defra_2024': 2024,
    'ipcc_2006': 2006,
    'ipcc_2019': 2019,
    'turkey_grid': 2023,
    'atom_kablo': 2023,
    'icao': 2025,
    'turkey_fleet': 2025,
    'generic': 2024,
    'custom': 2024,
}

# Turkey mobile slugs that should be Scope 3
SCOPE3_FIXES = {
    'flight-domestic': 'business_travel',
    'flight-international': 'business_travel',
    'train': 'employee_commuting',
    'metro': 'employee_commuting',
    'bus': 'employee_commuting',
    'dolmus': 'employee_commuting',
}


class Command(BaseCommand):
    help = 'Upgrade emission factors with year, is_default, and scope fixes'

    def handle(self, *args, **options):
        updated = 0
        scope_fixed = 0

        for factor in EmissionFactor.objects.all():
            save_fields = []

            # Set year from source if still default
            year = SOURCE_YEAR_MAP.get(factor.source, 2024)
            if factor.year != year:
                factor.year = year
                save_fields.append('year')

            # Ensure is_default
            if not factor.is_default:
                factor.is_default = True
                save_fields.append('is_default')

            # Fix scope for Turkey transport
            if (factor.country == 'turkey'
                    and factor.category == 'mobile_combustion'
                    and factor.slug in SCOPE3_FIXES):
                new_cat = SCOPE3_FIXES[factor.slug]
                self.stdout.write(
                    f"  Scope fix: {factor.slug} -> scope3/{new_cat}"
                )
                factor.scope = 'scope3'
                factor.category = new_cat
                save_fields.extend(['scope', 'category'])
                scope_fixed += 1

            if save_fields:
                try:
                    factor.save(update_fields=save_fields)
                    updated += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(
                        f"  Skip {factor.slug}/{factor.country}: {e}"
                    ))

        self.stdout.write(self.style.SUCCESS(
            f"Done: {updated} updated, {scope_fixed} scope fixes. "
            f"Total: {EmissionFactor.objects.count()}"
        ))
