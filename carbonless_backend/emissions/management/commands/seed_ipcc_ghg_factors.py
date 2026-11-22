import json
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from emissions.models import EmissionFactor
from emissions.withheld import is_withheld

DATA = Path(__file__).resolve().parents[2] / 'data' / 'ipcc_ghg_factors.json'
GAS_FIELD = {'co2': 'factor_co2_kg_co2e', 'ch4': 'factor_ch4_kg_co2e', 'n2o': 'factor_n2o_kg_co2e',
             'hfc': 'factor_hfc_kg_co2e', 'sf6': 'factor_sf6_kg_co2e'}


# The GWP source and version each row was built with (build_ipcc_ghg_factors.py).
_GWP_DOC = 'as tabulated in GHG Protocol, IPCC Global Warming Potential Values v2.0 (Aug 2024)'
GWP_BASIS = {
    'ipcc': f'IPCC AR5 GWP100 {_GWP_DOC}',
    'ghg': f'IPCC AR6 GWP100 {_GWP_DOC}; methane: non-fossil value for combustion, fossil value for fugitive',
}


class Command(BaseCommand):
    help = ('Load the factors of the IPCC and GHG Protocol standards (standard="ipcc" / "ghg") from '
            'emissions/data/ipcc_ghg_factors.json, which build_ipcc_ghg_factors.py generates. Idempotent.')

    def handle(self, *args, **options):
        payload = json.loads(DATA.read_text(encoding='utf-8'))
        created = updated = 0
        with transaction.atomic():
            for row in payload['factors']:
                gas = {GAS_FIELD[g]: Decimal(v) for g, v in row['gas'].items()}
                data = {
                    'name': row['name'], 'name_tr': row['name_tr'], 'scope': row['scope'],
                    'category': row['category'], 'unit': row['unit'],
                    'factor_kg_co2e': Decimal(row['factor_kg_co2e']), 'source': 'ipcc_2006',
                    # A withheld row stays loaded but is never selected (emissions/withheld.py).
                    'is_active': not is_withheld(row['standard'], row['slug']),
                    'gwp_basis': GWP_BASIS[row['standard']],
                    # Never offered as a catalogue default: a standard's row is
                    # used only by an inventory that chose the standard.
                    'is_default': False, 'reference': row['reference'],
                    **{f: None for f in EmissionFactor.GAS_FIELDS.values()},
                    **gas,
                    'gas_split_basis': 'single_gas' if len(gas) == 1 else 'published',
                    'gas_split_reference': row['reference'],
                }
                _obj, was_created = EmissionFactor.objects.update_or_create(
                    slug=row['slug'], country='global', year=row['year'], standard=row['standard'], defaults=data)
                created += was_created
                updated += not was_created
        self.stdout.write(self.style.SUCCESS(f'IPCC / GHG Protocol factors: {created} created, {updated} updated.'))
