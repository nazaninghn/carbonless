"""Stage 3 audit: independent recalculation of a representative inventory.

One inventory with fuels, electricity at two facilities on both grid connections, transport, waste (a credit
and a landfill), a spend-based purchase, travel and a reported franchise total is calculated by the real
questionnaire with the real seeded catalog, and recalculated here from the raw answers with this file's own
arithmetic. Factor values are pinned below (read from the catalog, seed_data.py) so a silent change of any of
them fails the reconciliation instead of moving every figure with it.

Nothing here changes a factor, a formula or a unit conversion."""
import csv
import io
from decimal import Decimal as D, ROUND_HALF_UP

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from openpyxl import load_workbook

from emissions.models import EmissionEntry, EmissionFactor
from . import tests as _base
from .step_entries import questionnaire_totals

# slug -> (kg CO2e per unit, unit, scope)
PINNED = {
    'natural-gas-m3': (D('2.02'), 'm3', 'scope1'),
    'diesel': (D('2.68'), 'liters', 'scope1'),
    'turkey-grid-distribution': (D('0.469'), 'kwh', 'scope2'),
    'turkey-grid-transmission': (D('0.436'), 'kwh', 'scope2'),
    'tm-01': (D('0.062'), 'tonne-km', 'scope3'),
    'wt-01-recycling': (D('-0.125'), 'kg', 'scope3'),
    'wt-01-landfill': (D('1.29'), 'kg', 'scope3'),
    'legal-accounting': (D('0.13'), 'usd', 'scope3'),
    'flight-long-business': (D('0.429'), 'person-km', 'scope3'),
    'hotel-turkey': (D('32.1'), 'nights', 'scope3'),
}
Q = D('0.0001')


def kg(quantity, slug):
    """Independent CO2e: quantity (in the factor's unit) x the pinned factor, to 4 decimals."""
    return (D(str(quantity)) * PINNED[slug][0]).quantize(Q, rounding=ROUND_HALF_UP)


class RepresentativeInventoryTests(TestCase):
    # (step, slug, quantity in the factor's unit, how the quantity follows from the answer)
    TRACE = [
        ('3A-5', 'natural-gas-m3', D('10000'), 'answer "10000 m³" -> 10,000 m3'),
        ('3A-5', 'diesel', D('1000'), 'answer "1.000 litre" -> 1,000 L ("." is the Turkish thousands mark)'),
        ('4A-1', 'turkey-grid-distribution', D('50000'), 'Gebze: 50,000 kWh, distribution grid'),
        ('4A-1', 'turkey-grid-transmission', D('20000'), 'Depo: 20,000 kWh, transmission grid'),
        ('K3C4-2', 'tm-01', D('500'), 'TM-01: 5 t x 100 km = 500 tonne-km'),
        ('K3C5-2', 'wt-01-recycling', D('400'), 'WT-01 recycling, 400 kg (a credit)'),
        ('K3C5-2', 'wt-01-landfill', D('100'), 'WT-01 landfill, 100 kg'),
        ('K3C1-2', 'legal-accounting', D('1000'), 'SC-07: 1,000 USD of legal / accounting services'),
        ('K3C6-2', 'flight-long-business', D('1000'), 'BT-03 business, 1,000 person-km (no RFI multiplier)'),
        ('K3C6-2', 'hotel-turkey', D('3'), 'BT-10: 3 nights'),
    ]
    FRANCHISE_KG = D('340500')       # K3C14-1: 340.5 tCO2e reported by the franchisor, taken as stated

    def setUp(self):
        _base.StepEntriesTests.setUp(self)           # Turkish company, owner, inventory 2025
        call_command('seed_factors', verbosity=0)
        call_command('seed_gas_splits', verbosity=0)
        def step(test, step_id, answer):
            cache.clear()                        # the step endpoint is rate-limited per user (cache)
            return _base.StepEntriesTests._step(test, step_id, answer)
        step(self, '2A-2', {'1': {'name': 'Gebze', 'country': 'TR', 'grid_connection': 'distribution'},
                            '2': {'name': 'Depo', 'country': 'TR', 'grid_connection': 'transmission'}})
        step(self, '3A-5', {'natural_gas': '10000 m³', 'diesel': '1.000 litre'})
        step(self, '4A-1', {'1': '50000 kWh', '2': '20000 kWh'})
        step(self, 'K3C4-2', {'items': [{'transport_mode': 'TM-01', 'load_tonne': '5', 'distance_km': '100'}]})
        step(self, 'K3C5-2', {'items': [{'waste_type': 'WT-01', 'quantity_kg': '400', 'disposal_method': 'recycling'},
                                        {'waste_type': 'WT-01', 'quantity_kg': '100', 'disposal_method': 'landfill'}]})
        step(self, 'K3C1-2', {'SC-07': '1000 USD'})
        step(self, 'K3C6-2', {'items': [
            {'travel_mode': 'BT-03', 'quantity': '1000', 'cabin_class': 'business', 'rfi_applied': False},
            {'travel_mode': 'BT-10', 'quantity': '3', 'hotel_class': 'luxury'}]})
        step(self, 'K3C14-0', 'yes')
        step(self, 'K3C14-1', {'franchise_count': '12', 'reporting_count': '8', 'total_tco2e': '340.5'})

    # -- the oracle ---------------------------------------------------------------------------
    def _expected(self):
        rows = [(step, slug, qty, kg(qty, slug)) for step, slug, qty, _how in self.TRACE]
        rows.append(('K3C14-1', 'calculated-scope3-franchises', self.FRANCHISE_KG, self.FRANCHISE_KG))
        return rows

    @staticmethod
    def _scope(slug):
        return PINNED[slug][2] if slug in PINNED else 'scope3'

    def _entries(self):
        return list(EmissionEntry.objects.filter(company=self.company, year=2025).select_related('emission_factor'))

    def _summary(self):
        cache.clear()
        return self.client.get('/api/emissions/summary/?year=2025').data

    def test_the_pinned_factors_are_the_catalog_values(self):
        for slug, (value, unit, scope) in PINNED.items():
            f = EmissionFactor.objects.filter(slug=slug, is_active=True, is_default=True).first()
            self.assertIsNotNone(f, slug)
            self.assertEqual((D(str(f.factor_kg_co2e)), f.unit.lower(), f.scope), (value, unit, scope), slug)

    def test_the_standing_regression_guards_hold(self):
        """CLAUDE.md: natural gas 10,000 m3 = 20,200 kg; electricity 50,000 kWh ~ 20,995 kg (the Turkey grid factor)."""
        gas = EmissionFactor.objects.get(slug='natural-gas-m3', country='global', is_default=True)
        grid = EmissionFactor.objects.get(slug='turkey-grid', country='turkey')   # superseded by the connection-based factors; value kept
        self.assertEqual(D('10000') * D(str(gas.factor_kg_co2e)), D('20200.00'))
        self.assertEqual(D('50000') * D(str(grid.factor_kg_co2e)), D('20995.0000'))

    def test_every_entry_is_the_independently_calculated_quantity_times_factor(self):
        entries = self._entries()
        got = sorted((e.description.split(' ')[2], e.emission_factor.slug, D(str(e.quantity)).quantize(Q),
                      D(str(e.calculated_co2e_kg)).quantize(Q)) for e in entries)
        want = sorted((step, slug, qty.quantize(Q), amount) for step, slug, qty, amount in self._expected())
        self.assertEqual(got, want)
        for e in entries:                       # the stored snapshot is the factor value that was used
            self.assertEqual(D(str(e.factor_value_snapshot)), D(str(e.emission_factor.factor_kg_co2e)))

    def test_totals_by_scope_inventory_and_dashboard_match_the_independent_sums(self):
        exp = self._expected()
        by_scope = {s: sum((amt for _st, slug, _q, amt in exp if self._scope(slug) == s), D(0))
                    for s in ('scope1', 'scope2', 'scope3')}
        self.assertEqual(by_scope, {'scope1': D('22880.0000'), 'scope2': D('32170.0000'), 'scope3': D('341265.3000')})
        total = sum(by_scope.values())
        self.assertEqual(total, D('396315.3000'))
        s = self._summary()
        self.assertAlmostEqual(s['total_kg'], float(total), places=2)
        for key in ('scope1', 'scope2', 'scope3'):
            self.assertAlmostEqual(s[f'{key}_kg'], float(by_scope[key]), places=2, msg=key)
        self.assertAlmostEqual(s['scope1_kg'] + s['scope2_kg'] + s['scope3_kg'], s['total_kg'], places=2)
        self.assertAlmostEqual(questionnaire_totals(self.report)[1], float(total), places=2)

    def test_categories_and_facilities_add_up_to_the_total(self):
        s = self._summary()
        self.assertAlmostEqual(sum(c['total_kg'] for c in s['by_category']), s['total_kg'], places=2)
        self.assertAlmostEqual(sum(f['total_kg'] for f in s['by_facility']) + s['unassigned_kg'], s['total_kg'], places=2)
        self.assertAlmostEqual(sum(c['total_co2e_kg'] for c in s['scope3_by_category']), s['scope3_kg'], places=2)
        by_fac = {f['facility_name']: f['total_kg'] for f in s['by_facility']}
        self.assertAlmostEqual(by_fac['Gebze'], 23450.0, places=2)       # 50,000 x 0.469
        self.assertAlmostEqual(by_fac['Depo'], 8720.0, places=2)         # 20,000 x 0.436

    def test_csv_and_excel_add_up_to_the_same_total(self):
        total = self._summary()['total_kg']
        res = self.client.get('/api/emissions/export-csv/?year=2025&lang=en')
        rows = list(csv.reader(io.StringIO(res.content.decode('utf-8').lstrip('﻿'))))
        h = rows[0]
        csv_kg = sum(float(r[h.index('kg CO2e')]) for r in rows[1:] if r[h.index('Status')].startswith('Approved'))
        res = self.client.get('/api/emissions/export-excel/?year=2025&lang=en')
        xr = [list(r) for r in load_workbook(io.BytesIO(res.content)).active.iter_rows(values_only=True)]
        xh = xr[0]
        xl_kg = sum(float(r[xh.index('kg CO2e')]) for r in xr[1:]
                    if r and r[0] and str(r[xh.index('Status')]).startswith('Approved'))
        self.assertAlmostEqual(csv_kg, total, places=2)
        self.assertAlmostEqual(xl_kg, total, places=2)

    def test_gas_level_values_reproduce_the_entry_co2e(self):
        """Each entry whose factor has a published split: the gas rows (share x the entry's CO2e) add up to the entry,
        and the split equals the IPCC default profile recomputed here (AR6 GWPs)."""
        profiles = {'natural-gas-m3': (56100, 5, 0.1), 'diesel': (74100, 10, 0.6)}   # IPCC 2006 Vol.2 Ch.2 Tab.2.3 (kg/TJ)
        gwp_ch4, gwp_n2o = 29.8, 273
        seen = 0
        for e in self._entries():
            shares = {g: float(v) for g, v in (e.emission_factor.gas_split_shares() or {}).items()}
            if not shares:
                continue
            seen += 1
            kg_e, slug = float(e.calculated_co2e_kg), e.emission_factor.slug
            self.assertAlmostEqual(sum(kg_e * v for v in shares.values()), kg_e, places=3, msg=slug)
            co2, ch4, n2o = profiles[slug]
            total = co2 + ch4 * gwp_ch4 + n2o * gwp_n2o
            self.assertAlmostEqual(shares['CH4'], ch4 * gwp_ch4 / total, places=3, msg=slug)
            self.assertAlmostEqual(shares['N2O'], n2o * gwp_n2o / total, places=3, msg=slug)
            self.assertAlmostEqual(shares['CO2'], co2 / total, places=3, msg=slug)
        self.assertEqual(seen, 2)                                     # natural gas and diesel

    def test_grid_electricity_has_no_invented_gas_split(self):
        for e in self._entries():
            if e.emission_factor.category == 'electricity':
                self.assertIsNone(e.emission_factor.gas_split_shares())

    # -- the generated reports, read back from the actual PDF text ------------------------------------
    def _pdf_text(self, url):
        from pypdf import PdfReader
        cache.clear()
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200, res.content[:200])
        self.assertEqual(res.content[:4], b'%PDF')
        return '\n'.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(res.content)).pages)

    def test_the_emissions_pdf_states_the_same_figures_as_the_api(self):
        s = self._summary()
        text = self._pdf_text('/api/emissions/report/?year=2025&lang=en')
        for needle in (f"Total emissions: {s['total_kg'] / 1000:.2f} tCO₂e", 'Total entries: 11',
                       f"{s['scope1_kg']:,.2f}", f"{s['scope2_kg']:,.2f}", f"{s['scope3_kg']:,.2f}",
                       f"{s['total_kg']:,.2f}", '23,450.00', '8,720.00'):
            self.assertIn(needle, text, needle)
        tr = self._pdf_text('/api/emissions/report/?year=2025&lang=tr')
        self.assertIn(f"{s['total_kg'] / 1000:.2f}".replace('.', ','), tr)

    def test_the_iso_report_states_the_same_totals_and_its_gas_columns_add_up(self):
        s = self._summary()
        text = self._pdf_text(f'/api/questionnaire/{self.report.id}/iso-report/?lang=en')
        t = lambda kg_: f'{kg_ / 1000:.2f}'
        self.assertIn(f"{t(s['total_kg'])} tonnes", text)                                       # the narrative total
        for kg_, label in ((s['scope1_kg'], 'Cat. I'), (s['scope2_kg'], 'Cat. II')):
            self.assertIn(f'{label}', text)
            self.assertIn(t(kg_), text, label)
        # gas columns, recomputed from the entries (share x entry CO2e), CO2 being the remainder
        ch4 = n2o = 0.0
        for e in self._entries():
            for gas, share in (e.emission_factor.gas_split_shares() or {}).items():
                if gas == 'CH4':
                    ch4 += float(e.calculated_co2e_kg) * float(share)
                if gas == 'N2O':
                    n2o += float(e.calculated_co2e_kg) * float(share)
        co2 = s['total_kg'] - ch4 - n2o
        self.assertEqual((round(co2 / 1000, 2), round(ch4 / 1000, 2), round(n2o / 1000, 2)), (396.24, 0.06, 0.02))
        self.assertIn('396.24', text)               # the TOTAL row: CO2 396.24 + CH4 0.06 + N2O 0.02 = 396.32
        self.assertIn('0.06', text)
        self.assertIn('0.02', text)
        # location-based and market-based Scope 2 agree here (no supplier declaration)
        self.assertIn('market-based result is given separately and not added to any total: 32.17 t', text)


class UnitConversionOracleTests(TestCase):
    """Conversions checked against independently known constants (SI / NIST), through the engine's own entry point.
    The engine's constants are not changed here; a difference larger than the tolerance is a finding."""

    def setUp(self):
        _base.StepEntriesTests.setUp(self)
        call_command('seed_factors', verbosity=0)

    def _resolve(self, activity, qty, unit):
        from emissions.factor_lookup import resolve_factor_and_amount
        factor, norm_qty, co2e, error = resolve_factor_and_amount(activity, qty, unit, self.company, None, 2025)
        self.assertIsNone(error, (activity, qty, unit, error))
        return factor, float(norm_qty), float(co2e)

    def assertConverts(self, activity, qty, unit, expected_qty, rel=1e-5):
        factor, got_qty, co2e = self._resolve(activity, qty, unit)
        self.assertAlmostEqual(got_qty / expected_qty, 1.0, delta=rel, msg=f'{qty} {unit} {activity}')
        self.assertAlmostEqual(co2e, got_qty * float(factor.factor_kg_co2e), places=6)       # CO2e = converted qty x factor
        return factor

    def test_mass(self):
        self.assertConverts('coal', 2, 'tonne', 2000.0)               # 1 t = 1,000 kg

    def test_volume(self):
        self.assertConverts('diesel', 1000, 'litre', 1000.0)
        self.assertConverts('diesel', 1, 'gallon', 3.785411784)        # US liquid gallon

    def test_energy(self):
        self.assertConverts('electricity', 1, 'mwh', 1000.0)           # 1 MWh = 1,000 kWh
        # Electricity is only accepted in kWh / MWh: GJ is refused with a stated reason, never guessed.
        from emissions.factor_lookup import resolve_factor_and_amount
        self.assertIn('only available in: kwh', resolve_factor_and_amount('electricity', 1, 'gj', self.company, None, 2025)[3])
        # 1 GJ = 1/0.0036 = 277.7778 kWh; the engine's constant is 277.778 (relative difference below 1e-6)
        from emissions.unit_converter import convert_unit
        converted = convert_unit(3.6, 'gj', 'kwh')
        converted = converted[0] if isinstance(converted, tuple) else converted
        self.assertAlmostEqual(float(converted) / 1000.0, 1.0, delta=2e-6)

    def test_distance(self):
        self.assertConverts('car_rental', 100, 'mile', 160.9344)       # international mile

    def test_gas_by_volume_energy_and_gj_each_use_their_own_catalog_factor(self):
        f_m3 = self.assertConverts('natural_gas', 10000, 'm3', 10000.0)
        f_kwh = self.assertConverts('natural_gas', 10000, 'kwh', 10000.0)
        f_gj = self.assertConverts('natural_gas', 10, 'gj', 10.0)
        self.assertEqual(float(f_m3.factor_kg_co2e) * 10000, 20200.0)                  # the standing regression guard
        self.assertEqual((f_m3.unit.lower(), f_kwh.unit.lower(), f_gj.unit.lower()), ('m3', 'kwh', 'gj'))
