"""List emission entries written by the old workspace "Data Panel" (read-only).

That panel saved fuel / electricity / transport / travel figures as their own
entries ("Workspace 3A (report 14)" …) next to the inventory's answers to the
same questions, so a figure entered in both was counted twice. This lists
them, and flags those whose company and year also have an inventory entry
with the same emission factor — the likely doubles. Nothing is changed.

    python manage.py list_workspace_entries
"""
from django.core.management.base import BaseCommand

from emissions.models import EmissionEntry


class Command(BaseCommand):
    help = 'List entries created by the workspace Data Panel (nothing is changed)'

    def handle(self, *args, **options):
        rows = (
            EmissionEntry.objects
            .filter(description__startswith='Workspace ', description__contains='(report ')
            .select_related('company', 'emission_factor')
            .order_by('company_id', 'year', 'id')
        )
        if not rows:
            self.stdout.write('No Data Panel entries.')
            return
        doubles = 0
        for e in rows:
            twin = EmissionEntry.objects.filter(
                company=e.company, year=e.year, emission_factor=e.emission_factor,
                description__startswith='Questionnaire step ',
            ).exclude(status='rejected').first()
            if twin:
                doubles += 1
            self.stdout.write(
                f'#{e.id}  {e.company.legal_entity_name if e.company else "-"}  {e.year}  '
                f'{e.description}  {e.quantity} → {e.calculated_co2e_kg} kg  [{e.status}]'
                + (f'  ← also in the inventory: #{twin.id} {twin.description}' if twin else '')
            )
        self.stdout.write(f'{rows.count()} Data Panel entries, {doubles} likely counted twice.')
