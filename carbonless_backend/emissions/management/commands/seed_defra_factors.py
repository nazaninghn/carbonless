import json
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from emissions.models import EmissionFactor
from emissions.withheld import is_withheld

DATA = Path(__file__).resolve().parents[2] / 'data' / 'defra_factors.json'
Q = Decimal('0.000001')


def gwp_basis(year):
    """The GWP basis of a DEFRA edition is fixed by its publisher and is not
    re-based here. Only the 2026 edition's statement has been read."""
    if year == 2026:
        return ('As published in the DEFRA/DESNZ 2026 edition: IPCC AR5 GWP100, with AR4 remnants in some rows '
                '(methodology paper 2026, Table 1)')
    return (f'As published in the DEFRA/DESNZ {year} edition; GWP basis fixed by the publisher '
            f'(see that edition\'s methodology paper)')


class Command(BaseCommand):
    help = ('Load the DEFRA / DESNZ conversion factors (standard="defra") of every published '
            'edition 2014-2026 from emissions/data/defra_factors.json. Idempotent.')

    def handle(self, *args, **options):
        payload = json.loads(DATA.read_text(encoding='utf-8'))
        created = updated = 0
        with transaction.atomic():
            for row in payload['factors']:
                value = Decimal(str(row['factor_kg_co2e'])).quantize(Q)
                data = {
                    'name': row['name'], 'name_tr': row.get('name_tr', ''),
                    'scope': row['scope'], 'category': row['category'], 'unit': row['unit'],
                    'factor_kg_co2e': value, 'source': 'defra',
                    # A withheld mapping stays loaded but is never selected (emissions/withheld.py).
                    'is_active': not is_withheld('defra', row['slug']),
                    'gwp_basis': gwp_basis(row['year']),
                    # Never offered as a catalogue default: a standard's row is
                    # used only by an inventory that chose the standard.
                    'is_default': False,
                    'reference': (f"UK Government GHG Conversion Factors {row['year']} (DESNZ/Defra) — "
                                  f"{row['defra_row']}: {row['defra_value']} kg CO2e per {row['defra_uom']}"
                                  + ('' if row['match'] == 'same item' else f" [{row['match']}]")),
                    **{f: None for f in EmissionFactor.GAS_FIELDS.values()},
                    'gas_split_basis': '', 'gas_split_reference': '',
                }
                gas = row.get('gas')
                if gas:
                    minor = {g: Decimal(str(gas[g])).quantize(Q) for g in ('ch4', 'n2o')}
                    data.update(
                        # CO2 takes the remainder so the three add up to the factor exactly.
                        factor_co2_kg_co2e=value - sum(minor.values()),
                        factor_ch4_kg_co2e=minor['ch4'], factor_n2o_kg_co2e=minor['n2o'],
                        gas_split_basis='published',
                        gas_split_reference=f"UK Government GHG Conversion Factors {row['year']} — CO2, CH4, N2O rows of the same factor",
                    )
                _obj, was_created = EmissionFactor.objects.update_or_create(
                    slug=row['slug'], country='global', year=row['year'], standard='defra', defaults=data)
                created += was_created
                updated += not was_created
        self.stdout.write(self.style.SUCCESS(f'DEFRA factors: {created} created, {updated} updated.'))
