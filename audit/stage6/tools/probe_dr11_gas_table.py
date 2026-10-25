"""DR-11 probe (isolated copy, disposable test DB): the ISO gas table of the Stage 3 representative inventory under
alternative methane GWP / IPCC tier assumptions. Nothing is applied to the repository; the constants are patched in
memory for each scenario and the per-gas splits are re-derived with the real seed_gas_splits command."""
import csv
import json
import os
from decimal import Decimal as D
from unittest import mock

from django.core.management import call_command

from emissions import gas_split_data as G
from emissions.models import EmissionEntry, EmissionFactor
from .test_stage3_oracle import RepresentativeInventoryTests

OUT = r'D:\ACADEMIA PROJECTS\CARBONLESS\carbonless\audit\stage6'

# IPCC 2006 Vol.2 Ch.2 Table 2.3 (manufacturing industries and construction), retrieved: kg gas per TJ (CH4, N2O)
MANUFACTURING = {'natural_gas_stationary': (1, 0.1), 'gas_oil_stationary': (3, 0.6), 'lpg_stationary': (1, 0.1),
                 'residual_fuel_oil': (3, 0.6)}      # coal profile is already the manufacturing row (10 / 1.5)

SCENARIOS = {
    'S0 current (CH4 29.8, stored tiers)': dict(ch4=29.8, tier=False),
    'S1 CH4 27.9 (AR6 7.SM.7; owner documents)': dict(ch4=27.9, tier=False),
    'S2 CH4 27.0 (GHG Protocol: non-fossil value for combustion)': dict(ch4=27.0, tier=False),
    'S3 CH4 27.9 + manufacturing tier': dict(ch4=27.9, tier=True),
    'S4 CH4 27.0 + manufacturing tier': dict(ch4=27.0, tier=True),
}


def profiles(tier):
    p = dict(G.IPCC_FUEL_PROFILES)
    if tier:
        for k, (ch4, n2o) in MANUFACTURING.items():
            co2, _c, _n, ref = p[k]
            p[k] = (co2, ch4, n2o, ref.replace('commercial/institutional', 'manufacturing industries'))
    return p


class DR11GasTable(RepresentativeInventoryTests):
    def columns(self):
        total = sum(float(e.calculated_co2e_kg) for e in EmissionEntry.objects.filter(company=self.company, year=2025))
        ch4 = n2o = 0.0
        for e in EmissionEntry.objects.filter(company=self.company, year=2025).select_related('emission_factor'):
            e.emission_factor.refresh_from_db()
            for gas, share in (e.emission_factor.gas_split_shares() or {}).items():
                if gas == 'CH4':
                    ch4 += float(e.calculated_co2e_kg) * float(share)
                elif gas == 'N2O':
                    n2o += float(e.calculated_co2e_kg) * float(share)
        return total, total - ch4 - n2o, ch4, n2o

    def test_probe(self):
        results, shares = [], []
        for name, sc in SCENARIOS.items():
            with mock.patch.object(G, 'GWP_CH4_FOSSIL', sc['ch4']), mock.patch.object(G, 'IPCC_FUEL_PROFILES', profiles(sc['tier'])):
                call_command('seed_gas_splits', verbosity=0)
                total, co2, ch4, n2o = self.columns()
                results.append((name, total, co2, ch4, n2o))
                for f in EmissionFactor.objects.exclude(gas_split_basis='').filter(gas_split_basis='apportioned').order_by('slug', 'country'):
                    s = f.gas_split_shares() or {}
                    shares.append((name, f.slug, f.country, float(f.factor_kg_co2e), s.get('CO2', 0), s.get('CH4', 0), s.get('N2O', 0)))
        base = results[0]
        with open(os.path.join(OUT, 'dr11_gas_table.csv'), 'w', encoding='utf-8-sig', newline='') as fh:
            w = csv.writer(fh)
            w.writerow(['scenario', 'total_kg (must not change)', 'CO2_t', 'CH4_t', 'N2O_t', 'CO2_delta_kg', 'CH4_delta_kg', 'N2O_delta_kg', 'total_delta_kg'])
            for name, total, co2, ch4, n2o in results:
                w.writerow([name, round(total, 4), round(co2 / 1000, 4), round(ch4 / 1000, 4), round(n2o / 1000, 4),
                            round(co2 - base[2], 3), round(ch4 - base[3], 3), round(n2o - base[4], 3), round(total - base[1], 6)])
        with open(os.path.join(OUT, 'dr11_gas_shares_per_factor.csv'), 'w', encoding='utf-8-sig', newline='') as fh:
            w = csv.writer(fh)
            w.writerow(['scenario', 'slug', 'country', 'factor_kg_co2e', 'CO2_share', 'CH4_share', 'N2O_share'])
            for r in shares:
                w.writerow([r[0], r[1], r[2], r[3], round(r[4], 6), round(r[5], 6), round(r[6], 6)])
        for name, total, co2, ch4, n2o in results:
            print('DR11', name, '| total', round(total, 4), '| CO2 t', round(co2 / 1000, 4), '| CH4 t', round(ch4 / 1000, 4), '| N2O t', round(n2o / 1000, 4))
            self.assertAlmostEqual(total, base[1], places=4)                     # totals never move
        print('DR11 apportioned factors:', len({(s[1], s[2]) for s in shares}))
