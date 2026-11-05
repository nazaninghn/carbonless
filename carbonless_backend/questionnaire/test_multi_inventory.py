"""Multiple independent inventories per company and reporting year.

Covers: creation without any same-year restriction; complete isolation of answers, entries, totals, scopes,
reports and exports between inventories of one year; edit / rename / delete independence; two companies;
legacy records (NULL inventory) and their attribution; and that the numbers each inventory produces from the
same inputs are exactly the pre-change baseline (the calculation engine is untouched, only the records it is
given are selected per inventory).
"""
import importlib

from django.apps import apps as django_apps
from django.contrib.auth.models import User
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from companies.models import Company, CompanyMembership
from emissions.inventory_scope import (
    claim_unassigned_rows, entries_of, reads_unassigned_rows, unassigned_rows)
from decimal import Decimal

from emissions.models import EmissionEntry, EmissionFactor
from questionnaire import tests as _base
from questionnaire.models import CarbonReport, ReportStep
from questionnaire.test_calc_baseline import (
    SITES, entry_numbers, iso_numbers, make_factors, post_scenario)

YEAR = 2023


def _company(name, tax):
    return Company.objects.create(
        legal_entity_name=name, tax_number=tax, country_of_headquarters='TR', countries_of_operation='TR',
        nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
        number_of_facilities=1)


def _expected_kg(gas_m3, kwh):
    """The documented factors of the scenario: gas 2.02, diesel 1 000 l x 3.0, grid 0.4199, transport 31."""
    return gas_m3 * 2.02 + 3000.0 + kwh * 0.4199 + 31.0


class MultiInventoryCreationTests(TransactionTestCase):
    """The DB constraint is gone: any number of inventories may share a company and year."""

    def setUp(self):
        self.user = User.objects.create_user('multi', 'multi@test.com', 'pass12345')
        self.company = _company('Multi Co', '42')
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')

    def test_database_allows_many_inventories_for_one_company_and_year(self):
        ids = {CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=YEAR,
                                           title=f'Inventory {i}').pk for i in range(5)}
        self.assertEqual(len(ids), 5)
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year=YEAR).count(), 5)

    def test_start_endpoint_creates_unlimited_same_year_inventories(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        got = []
        for title in ('A', 'B', 'C', 'D'):
            r = client.post('/api/questionnaire/start/',
                            {'reporting_year': YEAR, 'title': title, 'force_new': True}, format='json')
            self.assertEqual(r.status_code, 201, r.content)
            got.append(r.data['report_id'])
        self.assertEqual(len(set(got)), 4)
        listing = client.get('/api/questionnaire/').data['reports']
        self.assertEqual(sorted(x['title'] for x in listing if x['reporting_year'] == YEAR), ['A', 'B', 'C', 'D'])

    def test_new_inventories_are_ownership_linked_without_any_environment_setting(self):
        from django.test import override_settings
        from questionnaire.immutability import is_ownership_scoped
        with override_settings(INVENTORY_OWNERSHIP_CUTOVER=''):
            r = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=YEAR)
            self.assertTrue(r.ownership_linked)
            self.assertTrue(is_ownership_scoped(r))


class ThreeInventoriesSameYearTests(_base.TestCase):
    """Three inventories of 2023, different data in each, driven through the real API."""

    def setUp(self):
        self.user = User.objects.create_user('three', 'three@test.com', 'pass12345')
        self.company = _company('Three Co', '50')
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        make_factors()
        self.inputs = {'A': ('10000 m³', '50000 kWh', 10000, 50000),
                       'B': ('2000 m³', '1000 kWh', 2000, 1000),
                       'C': ('500 m³', '30000 kWh', 500, 30000)}
        self.ids = {}
        for name in 'ABC':
            r = self.client.post('/api/questionnaire/start/',
                                 {'reporting_year': YEAR, 'title': f'Inventory {name}', 'force_new': True},
                                 format='json')
            self.assertEqual(r.status_code, 201, r.content)
            self.ids[name] = r.data['report_id']
        for name in 'ABC':
            gas, kwh, _g, _k = self.inputs[name]
            post_scenario(self.client, CarbonReport.objects.get(pk=self.ids[name]), gas=gas, kwh=kwh)

    def _summary(self, name):
        r = self.client.get(f'/api/emissions/summary/?inventory_id={self.ids[name]}')
        self.assertEqual(r.status_code, 200, r.content)
        return r.data

    def test_each_inventory_has_only_its_own_entries(self):
        seen = set()
        for name in 'ABC':
            rows = EmissionEntry.objects.filter(inventory_id=self.ids[name])
            self.assertEqual(rows.count(), 4, name)
            pks = set(rows.values_list('pk', flat=True))
            self.assertFalse(pks & seen)
            seen |= pks
        self.assertEqual(EmissionEntry.objects.filter(company=self.company).count(), 12)
        self.assertFalse(EmissionEntry.objects.filter(company=self.company, inventory__isnull=True).exists())

    def test_totals_scopes_and_categories_are_independent_and_exact(self):
        for name in 'ABC':
            _gas, _kwh, g, k = self.inputs[name]
            s = self._summary(name)
            self.assertAlmostEqual(s['total_kg'], _expected_kg(g, k), places=3, msg=name)
            self.assertAlmostEqual(s['scope1_kg'], g * 2.02 + 3000.0, places=3)
            self.assertAlmostEqual(s['scope2_kg'], k * 0.4199, places=3)
            self.assertAlmostEqual(s['scope3_kg'], 31.0, places=6)
            self.assertEqual(s['inventory_id'], self.ids[name])
            self.assertEqual(s['year'], YEAR)

    def test_inventory_A_reproduces_the_pre_change_baseline_exactly(self):
        """Gas 10 000 m3 = 20 200 kg, electricity 50 000 kWh = 20 995 kg, total 44 226 kg (captured before the
        change); identical inputs in an inventory that shares its year with two others give identical numbers."""
        s = self._summary('A')
        self.assertEqual(round(s['total_kg'], 6), 44226.0)
        self.assertEqual(round(s['scope2_kg'], 6), 20995.0)
        rows = entry_numbers(EmissionEntry.objects.filter(inventory_id=self.ids['A']))
        self.assertEqual(rows, [('diesel', 1000.0, 3000.0, 'approved'),
                                ('natural-gas-m3', 10000.0, 20200.0, 'approved'),
                                ('tm-01', 500.0, 31.0, 'approved'),
                                ('turkey-grid-distribution', 50000.0, 20995.0, 'approved')])

    def test_summary_without_inventory_id_refuses_to_mix_inventories(self):
        r = self.client.get(f'/api/emissions/summary/?year={YEAR}')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_required')
        self.assertEqual(sorted(c['report_id'] for c in r.data['candidates']), sorted(self.ids.values()))

    def test_iso_report_data_matches_each_summary(self):
        for name in 'ABC':
            iso = iso_numbers(CarbonReport.objects.get(pk=self.ids[name]))
            s = self._summary(name)
            self.assertEqual(iso['total_kg'], round(s['total_kg'], 6), name)
            self.assertEqual(iso['entry_count'], 4)

    def test_pdf_reports_generate_per_inventory(self):
        for name in 'ABC':
            for path in (f'/api/questionnaire/{self.ids[name]}/iso-report/?lang=en',
                         f'/api/questionnaire/{self.ids[name]}/pdf/?lang=en',
                         f'/api/emissions/report/?inventory_id={self.ids[name]}&lang=en'):
                r = self.client.get(path)
                self.assertEqual(r.status_code, 200, (path, getattr(r, 'content', b'')[:200]))
                self.assertTrue(r.content.startswith(b'%PDF'), path)

    def test_csv_and_json_exports_are_per_inventory(self):
        r = self.client.get(f'/api/emissions/export-csv/?inventory_id={self.ids["B"]}')
        self.assertEqual(r.status_code, 200)
        text = r.content.decode('utf-8-sig')
        self.assertIn('2000', text)
        self.assertNotIn('10000', text)
        self.assertNotIn('30000', text)
        r = self.client.get(f'/api/emissions/export-all/?inventory_id={self.ids["C"]}')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data['entries']), 4)
        self.assertEqual([i['id'] for i in r.data['inventories']], [self.ids['C']])
        # without a name the backup is the whole company, unchanged
        self.assertEqual(len(self.client.get('/api/emissions/export-all/').data['entries']), 12)
        # no id and several inventories in the year: a refusal, never a mix
        self.assertEqual(self.client.get(f'/api/emissions/export-csv/?year={YEAR}').status_code, 409)

    def test_answers_are_isolated_and_survive_a_refresh(self):
        for name, code in (('A', 'yes'), ('B', 'no'), ('C', 'yes')):
            r = self.client.patch(f'/api/questionnaire/{self.ids[name]}/step/',
                                  {'step': '3A-0', 'data': {'answer': code}}, format='json')
            self.assertEqual(r.status_code, 200, r.content)
        fresh = APIClient()
        fresh.force_authenticate(user=self.user)
        got = {n: fresh.get(f'/api/questionnaire/{self.ids[n]}/').data for n in 'ABC'}
        
        def unwrap(v):
            return v.get('answer') if isinstance(v, dict) and 'answer' in v else v
        self.assertEqual(unwrap(got['A']['answers']['2A-2']), SITES)
        self.assertEqual({n: unwrap(got[n]['answers']['3A-0']) for n in 'ABC'},
                         {'A': 'yes', 'B': 'no', 'C': 'yes'})
        for n in 'ABC':
            self.assertEqual(got[n]['report_id'], self.ids[n])
            self.assertEqual(ReportStep.objects.filter(report_id=self.ids[n], step_id='3A-5').count(), 1)

    def test_editing_one_inventory_leaves_the_others_untouched(self):
        before = {n: entry_numbers(EmissionEntry.objects.filter(inventory_id=self.ids[n])) for n in 'AC'}
        r = self.client.patch(f'/api/questionnaire/{self.ids["B"]}/step/',
                              {'step': '3A-5', 'data': {'answer': {'natural_gas': '7777 m³', 'diesel': '1.000 litre'}}},
                              format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertAlmostEqual(self._summary('B')['total_kg'], _expected_kg(7777, 1000), places=3)
        for n in 'AC':
            self.assertEqual(entry_numbers(EmissionEntry.objects.filter(inventory_id=self.ids[n])), before[n])
        self.assertEqual(round(self._summary('A')['total_kg'], 6), 44226.0)

    def test_rename_affects_only_the_selected_inventory(self):
        r = self.client.patch(f'/api/questionnaire/{self.ids["B"]}/title/', {'title': 'Renamed B'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        titles = {x['report_id']: x['title'] for x in self.client.get('/api/questionnaire/').data['reports']}
        self.assertEqual(titles[self.ids['B']], 'Renamed B')
        self.assertEqual(titles[self.ids['A']], 'Inventory A')
        self.assertEqual(titles[self.ids['C']], 'Inventory C')

    def test_delete_removes_only_that_inventory_and_its_records(self):
        before = {n: entry_numbers(EmissionEntry.objects.filter(inventory_id=self.ids[n])) for n in 'AC'}
        r = self.client.delete(f'/api/questionnaire/{self.ids["B"]}/')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data['deleted_entries'], 4)
        self.assertFalse(CarbonReport.objects.filter(pk=self.ids['B']).exists())
        for n in 'AC':
            self.assertTrue(CarbonReport.objects.filter(pk=self.ids[n]).exists())
            self.assertEqual(entry_numbers(EmissionEntry.objects.filter(inventory_id=self.ids[n])), before[n])
        self.assertEqual(round(self._summary('A')['total_kg'], 6), 44226.0)
        # two remain in the year, so a year-only request is still ambiguous
        self.assertEqual(self.client.get(f'/api/emissions/summary/?year={YEAR}').status_code, 409)

    def test_list_cards_report_per_inventory_progress(self):
        rows = {x['report_id']: x for x in self.client.get('/api/questionnaire/').data['reports']}
        for n in 'ABC':
            self.assertEqual(rows[self.ids[n]]['reporting_year'], YEAR)
            self.assertIn('percent', rows[self.ids[n]]['progress'])
            self.assertTrue(rows[self.ids[n]]['updated_at'])


class TwoCompaniesIsolationTests(_base.TestCase):
    def setUp(self):
        self.u1 = User.objects.create_user('own1', 'o1@test.com', 'pass12345')
        self.u2 = User.objects.create_user('own2', 'o2@test.com', 'pass12345')
        self.c1, self.c2 = _company('One Co', '60'), _company('Two Co', '61')
        CompanyMembership.objects.create(user=self.u1, company=self.c1, role='owner')
        CompanyMembership.objects.create(user=self.u2, company=self.c2, role='owner')
        make_factors()
        self.k1, self.k2 = APIClient(), APIClient()
        self.k1.force_authenticate(user=self.u1)
        self.k2.force_authenticate(user=self.u2)
        self.r1 = self.k1.post('/api/questionnaire/start/', {'reporting_year': YEAR, 'title': 'One', 'force_new': True},
                               format='json').data['report_id']
        self.r2 = self.k2.post('/api/questionnaire/start/', {'reporting_year': YEAR, 'title': 'Two', 'force_new': True},
                               format='json').data['report_id']
        post_scenario(self.k1, CarbonReport.objects.get(pk=self.r1))

    def test_other_users_cannot_read_write_report_or_delete(self):
        self.assertEqual(self.k2.get(f'/api/questionnaire/{self.r1}/').status_code, 404)
        self.assertEqual(self.k2.patch(f'/api/questionnaire/{self.r1}/title/', {'title': 'x'}, format='json').status_code, 404)
        self.assertEqual(self.k2.patch(f'/api/questionnaire/{self.r1}/step/', {'step': '3A-0', 'data': {'answer': 'yes'}},
                                       format='json').status_code, 404)
        self.assertEqual(self.k2.delete(f'/api/questionnaire/{self.r1}/').status_code, 404)
        for path in (f'/api/questionnaire/{self.r1}/iso-report/', f'/api/questionnaire/{self.r1}/pdf/'):
            self.assertEqual(self.k2.get(path).status_code, 404, path)
        self.assertTrue(CarbonReport.objects.filter(pk=self.r1).exists())

    def test_other_users_cannot_scope_a_summary_or_export_to_it(self):
        for path in (f'/api/emissions/summary/?inventory_id={self.r1}',
                     f'/api/emissions/export-csv/?inventory_id={self.r1}',
                     f'/api/emissions/export-all/?inventory_id={self.r1}',
                     f'/api/emissions/report/?inventory_id={self.r1}'):
            self.assertEqual(self.k2.get(path).status_code, 400, path)
        listed = self.k2.get('/api/questionnaire/').data['reports']
        self.assertEqual([x['report_id'] for x in listed], [self.r2])

    def test_invalid_inventory_id_is_a_400(self):
        self.assertEqual(self.k1.get('/api/emissions/summary/?inventory_id=9999999').status_code, 400)
        self.assertEqual(self.k1.get('/api/emissions/summary/?inventory_id=abc').status_code, 400)


class LegacyRecordsTests(_base.TestCase):
    """Records with no inventory (written before inventories owned them)."""

    def setUp(self):
        self.user = User.objects.create_user('leg', 'leg@test.com', 'pass12345')
        self.company = _company('Legacy Co', '70')
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        make_factors()
        # factor 1.0: a row's kg equals its quantity (the model computes kg = quantity x factor on save)
        self.factor = EmissionFactor.objects.create(
            slug='legacy-unit', name='legacy-unit', scope='scope1', category='x', unit='kg', country='global',
            year=2024, factor_kg_co2e=1, source='test', is_active=True, is_default=True)

    def _row(self, inventory=None, kg=100.0, desc='Questionnaire step 3A-5', year=YEAR):
        return EmissionEntry.objects.create(
            user=self.user, company=self.company, inventory=inventory, emission_factor=self.factor, year=year,
            month=1, quantity=Decimal(str(kg)), calculated_co2e_kg=Decimal(str(kg)), description=desc,
            status='approved')

    def _legacy_report(self, year=YEAR, **kw):
        r = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=year, **kw)
        CarbonReport.objects.filter(pk=r.pk).update(ownership_linked=False)
        return CarbonReport.objects.get(pk=r.pk)

    def _total(self, pk):
        return self.client.get(f'/api/emissions/summary/?inventory_id={pk}').data['total_kg']

    def test_sole_legacy_inventory_reads_its_null_rows_unchanged(self):
        r = self._legacy_report()
        self._row(kg=100.0)
        self._row(kg=40.0, desc='Chat entry')
        self.assertEqual(self._total(r.pk), 140.0)
        self.assertEqual(self.client.get(f'/api/emissions/summary/?year={YEAR}').data['total_kg'], 140.0)

    def test_a_second_inventory_does_not_take_or_hide_the_first_ones_records(self):
        r1 = self._legacy_report(title='old')
        self._row(kg=100.0)
        self._row(kg=40.0, desc='Chat entry')
        r2 = self.client.post('/api/questionnaire/start/', {'reporting_year': YEAR, 'title': 'new', 'force_new': True},
                              format='json').data['report_id']
        # the old inventory kept every record (now tagged with its id); the new one starts empty
        self.assertEqual(EmissionEntry.objects.filter(inventory_id=r1.pk).count(), 2)
        self.assertEqual(EmissionEntry.objects.filter(company=self.company, inventory__isnull=True).count(), 0)
        self.assertEqual(self._total(r1.pk), 140.0)
        self.assertEqual(self._total(r2), 0)

    def test_new_inventory_never_reads_unassigned_rows_of_a_shared_year(self):
        a = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=YEAR)
        b = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=YEAR)
        self._row(kg=55.0, desc='Chat entry')          # belongs to no inventory
        self.assertFalse(reads_unassigned_rows(a))
        self.assertEqual(entries_of(a).count(), 0)
        self.assertEqual(entries_of(b).count(), 0)
        s = self.client.get(f'/api/emissions/summary/?inventory_id={a.pk}').data
        self.assertEqual(s['total_kg'], 0)
        self.assertEqual(s['unassigned_records'], {'entries': 1, 'total_kg': 55.0})   # reported, not hidden
        self.assertEqual(unassigned_rows(b), {'entries': 1, 'total_kg': 55.0})

    def test_legacy_duplicate_group_members_keep_reading_their_shared_rows(self):
        a = self._legacy_report()
        b = self._legacy_report()
        CarbonReport.objects.filter(pk__in=[a.pk, b.pk]).update(legacy_duplicate_year=True)
        self._row(kg=77.0)
        for pk in (a.pk, b.pk):
            self.assertEqual(self._total(pk), 77.0)
        self.assertEqual(claim_unassigned_rows(self.company.pk, YEAR), 0)     # ambiguous: nothing is tagged
        self.assertTrue(EmissionEntry.objects.filter(inventory__isnull=True).exists())

    def test_claim_is_idempotent_and_touches_only_unassigned_rows(self):
        r = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=YEAR)
        other = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=YEAR + 1)
        self._row(kg=1.0)
        owned = self._row(inventory=other, kg=2.0, year=YEAR + 1)
        self.assertEqual(claim_unassigned_rows(self.company.pk, YEAR), 1)
        self.assertEqual(claim_unassigned_rows(self.company.pk, YEAR), 0)
        owned.refresh_from_db()
        self.assertEqual(owned.inventory_id, other.pk)
        self.assertEqual(EmissionEntry.objects.filter(inventory_id=r.pk).count(), 1)

    def test_migration_0015_links_only_unambiguous_inventories(self):
        mig = importlib.import_module('questionnaire.migrations.0015_report_ownership_linked')
        sole = self._legacy_report(title='sole')                  # 2023, alone
        e_q = self._row(kg=10.0)                                  # its questionnaire row
        e_chat = self._row(kg=5.0, desc='Chat entry')             # chat/form row: stays unassigned
        e_ws = self._row(kg=3.0, desc=f'Workspace 3A (report {sole.pk})')
        d1 = self._legacy_report(year=2024, title='d1')
        d2 = self._legacy_report(year=2024, title='d2')
        CarbonReport.objects.filter(pk__in=[d1.pk, d2.pk]).update(legacy_duplicate_year=True)
        e_dup = self._row(kg=9.0, year=2024)
        mig.link_unambiguous(django_apps, None)
        for e in (e_q, e_chat, e_ws, e_dup):
            e.refresh_from_db()
        self.assertEqual((e_q.inventory_id, e_ws.inventory_id), (sole.pk, sole.pk))
        self.assertIsNone(e_chat.inventory_id)
        self.assertIsNone(e_dup.inventory_id)
        self.assertTrue(CarbonReport.objects.get(pk=sole.pk).ownership_linked)
        self.assertFalse(CarbonReport.objects.get(pk=d1.pk).ownership_linked)
        self.assertFalse(CarbonReport.objects.get(pk=d2.pk).ownership_linked)
        self.assertEqual(float(e_q.calculated_co2e_kg), 10.0)     # nothing else about any row changed
        # still read by the sole inventory (the chat row via the unassigned-rows rule): nothing is hidden
        self.assertEqual(self._total(sole.pk), 18.0)
