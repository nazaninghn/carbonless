"""Stage 3 audit: edits, deletions, recalculation, facility changes, year switching, rapid double-submits and
isolation between companies, on the representative inventory (test_stage3_oracle.py). Saved values must persist
and no stale or cross-inventory data may appear."""
import threading
import time

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import OperationalError, connection
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from companies.models import Company, CompanyMembership
from emissions.models import EmissionEntry
from . import test_stage3_oracle as _o
from .models import CarbonReport, ReportStep
from .test_stage3_scenarios import _Inventory, TOTAL


class EditAndDeleteTests(_Inventory):

    def _kg(self, step=None):
        rows = [e for e in self._entries() if step is None or e.description.split(' ')[2] == step]
        return round(sum(float(e.calculated_co2e_kg) for e in rows), 2)

    def test_editing_an_answer_recalculates_only_that_answer_and_the_new_value_persists(self):
        self._step('3A-5', {'natural_gas': '5000 m³', 'diesel': '1.000 litre'})
        self.assertEqual(self._kg('3A-5'), 5000 * 2.02 + 1000 * 2.68)                    # 12,780
        self.assertAlmostEqual(self._summary()['total_kg'], TOTAL - 20200 - 2680 + 12780, places=2)
        saved = ReportStep.objects.get(report=self.report, step_id='3A-5').answer
        self.assertEqual(saved['natural_gas'] if 'natural_gas' in saved else saved['answer']['natural_gas'], '5000 m³')
        self.assertEqual(self._kg('4A-1'), 32170.0)                                       # electricity untouched

    def test_removing_an_answer_removes_exactly_its_entries(self):
        self._step('3A-5', {'diesel': '1.000 litre'})                                     # natural gas no longer reported
        self.assertEqual({e.emission_factor.slug for e in self._entries() if e.description.split(' ')[2] == '3A-5'},
                         {'diesel'})
        self.assertAlmostEqual(self._summary()['total_kg'], TOTAL - 20200, places=2)

    def test_answering_the_same_value_again_changes_nothing_and_keeps_the_approvals(self):
        before = sorted((e.pk, str(e.calculated_co2e_kg), e.status, e.approved_at) for e in self._entries())
        self._step('3A-5', {'natural_gas': '10000 m³', 'diesel': '1.000 litre'})
        self.assertEqual(sorted((e.pk, str(e.calculated_co2e_kg), e.status, e.approved_at) for e in self._entries()), before)

    def test_a_facility_rename_moves_no_figure_and_the_breakdown_follows_the_name(self):
        gebze = self.company.facilities.get(name='Gebze')
        r = self.client.patch(f'/api/companies/facilities/{gebze.pk}/', {'name': 'Gebze Plant'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        s = self._summary()
        self.assertAlmostEqual(s['total_kg'], TOTAL, places=2)
        self.assertAlmostEqual({f['facility_name']: f['total_kg'] for f in s['by_facility']}['Gebze Plant'], 23450.0, places=2)

    def test_deleting_a_facility_of_a_draft_moves_no_total_only_the_breakdown(self):
        depo = self.company.facilities.get(name='Depo')
        self.assertEqual(self.client.delete(f'/api/companies/facilities/{depo.pk}/').status_code, 204)
        s = self._summary()
        self.assertAlmostEqual(s['total_kg'], TOTAL, places=2)
        # before: unassigned = everything but the two facilities' electricity; Depo's 8,720 kg joins it
        self.assertAlmostEqual(s['unassigned_kg'], (TOTAL - 32170.0) + 8720.0, places=2)
        self.assertAlmostEqual(sum(f['total_kg'] for f in s['by_facility']) + s['unassigned_kg'], s['total_kg'], places=2)

    def test_a_grid_connection_change_in_settings_reprices_the_draft_and_the_dashboard_follows(self):
        gebze = self.company.facilities.get(name='Gebze')
        self.client.patch(f'/api/companies/facilities/{gebze.pk}/', {'grid_connection': 'transmission'}, format='json')
        self.assertAlmostEqual(self._summary()['total_kg'], TOTAL - 23450 + 50000 * 0.436, places=2)   # 21,800 for Gebze


class YearSeparationTests(_Inventory):

    def _second_year(self, year=2024, kwh='1000 kWh'):
        other = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=year)
        cache.clear()
        for sid, ans in (('2A-2', {'1': {'name': 'Gebze', 'country': 'TR', 'grid_connection': 'distribution'}}),
                         ('4A-1', {'1': kwh})):
            r = self.client.patch(f'/api/questionnaire/{other.id}/step/', {'step': sid, 'data': {'answer': ans}, 'language': 'en'}, format='json')
            self.assertEqual(r.status_code, 200, r.content)
            cache.clear()
        return other

    def test_two_years_are_separate_in_the_api_and_the_exports(self):
        self._second_year(2024, '1000 kWh')
        a2024 = self.client.get('/api/emissions/summary/?year=2024').data
        a2025 = self._summary()
        self.assertAlmostEqual(a2024['total_kg'], 469.0, places=2)
        self.assertAlmostEqual(a2025['total_kg'], TOTAL, places=2)                          # the 2024 save did not touch 2025
        import csv, io
        rows = list(csv.reader(io.StringIO(self.client.get('/api/emissions/export-csv/?year=2024&lang=en').content.decode('utf-8').lstrip('﻿'))))
        self.assertEqual(len(rows) - 1, 1)

    def test_editing_one_year_never_changes_the_other(self):
        other = self._second_year(2024, '1000 kWh')
        before = sorted((e.pk, str(e.calculated_co2e_kg)) for e in EmissionEntry.objects.filter(company=self.company, year=2025))
        r = self.client.patch(f'/api/questionnaire/{other.id}/step/', {'step': '4A-1', 'data': {'answer': {'1': '9999 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(sorted((e.pk, str(e.calculated_co2e_kg)) for e in EmissionEntry.objects.filter(company=self.company, year=2025)), before)

    def _a4(self, report, year):
        cache.clear()
        return self.client.patch(f'/api/questionnaire/{report.id}/step/',
                                 {'step': 'A4', 'data': {'reporting_year': year}, 'language': 'en'}, format='json')

    def test_an_inventory_with_entries_cannot_be_moved_to_another_year(self):
        """S3-2. A4 sets the reporting year, but the inventory's entries are stored by company and year: moving the year
        left them behind in the old year (counted by the Dashboard, the exports and the PDFs, belonging to no
        inventory) while the new year had none until the next save recreated them - the same numbers in two years.
        Nothing is deleted or moved silently: the change is refused, in both languages."""
        before = sorted((e.pk, e.year, str(e.calculated_co2e_kg), e.status) for e in self._entries())
        r = self._a4(self.report, 2026)
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'year_has_entries')
        self.assertEqual(r.data['entries'], 11)
        self.assertIn('2025', r.data['error_en'])
        self.assertIn('2025', r.data['error_tr'])
        self.report.refresh_from_db()
        self.assertEqual(self.report.reporting_year, 2025)
        self.assertEqual(sorted((e.pk, e.year, str(e.calculated_co2e_kg), e.status) for e in self._entries()), before)
        self.assertAlmostEqual(self.client.get('/api/emissions/summary/?year=2026').data['total_kg'], 0.0, places=2)
        self.assertAlmostEqual(self._summary()['total_kg'], TOTAL, places=2)

    def test_a_signed_inventory_cannot_be_moved_either_and_nothing_is_flagged(self):
        from django.utils import timezone
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED, signed_at=timezone.now())
        self.assertEqual(self._a4(self.report, 2026).status_code, 409)
        self.report.refresh_from_db()
        self.assertEqual((self.report.reporting_year, self.report.edited_after_signing_at), (2025, None))

    def test_the_same_year_again_and_a_fresh_inventory_are_not_affected(self):
        self.assertEqual(self._a4(self.report, 2025).status_code, 200)                      # no change of year
        fresh = CarbonReport.objects.create(company=self.company, created_by=self.user)
        self.assertEqual(self._a4(fresh, 2023).status_code, 200)                            # no entries yet: free to choose
        self.assertEqual(self._a4(fresh, 2022).status_code, 200)

    def test_reuse_profile_cannot_move_an_inventory_with_entries_either(self):
        src = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2020, title='src')
        ReportStep.objects.create(report=src, step_id='A1', answer={'legal_name': 'Ent Co'})
        cache.clear()
        r = self.client.post(f'/api/questionnaire/{self.report.id}/reuse-profile/', {'reporting_year': 2023}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'year_has_entries')
        self.report.refresh_from_db()
        self.assertEqual(self.report.reporting_year, 2025)


class OtherCompanyIsolationTests(_Inventory):

    def test_another_company_sees_none_of_it_in_any_surface(self):
        other = Company.objects.create(legal_entity_name='Other Co', tax_number='999', country_of_headquarters='TR',
                                       countries_of_operation='TR', nace_code='', main_activity_description='x',
                                       number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        u = User.objects.create_user('othr3', 'o3@test.com', 'pass12345')
        CompanyMembership.objects.create(user=u, company=other, role='owner')
        c = APIClient(); c.force_authenticate(user=u)
        self.assertEqual(c.get('/api/emissions/summary/?year=2025').data['total_kg'], 0)
        self.assertEqual(c.get('/api/emissions/entries/?year=2025').json().get('count', len(c.get('/api/emissions/entries/?year=2025').json())), 0)
        csv_text = c.get('/api/emissions/export-csv/?year=2025&lang=en').content.decode('utf-8').lstrip('﻿')
        self.assertEqual(len([l for l in csv_text.splitlines() if l]), 1)                    # the header only
        self.assertEqual(c.get(f'/api/questionnaire/{self.report.id}/iso-report/?lang=en').status_code, 404)
        self.assertEqual(c.get(f'/api/questionnaire/{self.report.id}/').status_code, 404)


class RapidDoubleSubmitTests(TransactionTestCase):
    """A user double-taps Save, or a client retries: the same step reaches the server several times at once. The
    inventory must end with exactly one set of entries (SQLite serialises writers: this checks the logic under
    interleaving, not PostgreSQL row locking)."""

    def setUp(self):
        self.user = User.objects.create_user('rapid', 'rapid@test.com', 'pass12345')
        self.company = Company.objects.create(legal_entity_name='Rapid Co', tax_number='11', country_of_headquarters='TR',
                                              countries_of_operation='TR', nace_code='', main_activity_description='x',
                                              number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)

    def test_the_same_step_saved_four_times_at_once_leaves_one_set_of_entries(self):
        from django.core.management import call_command
        call_command('seed_factors', verbosity=0)
        n, barrier, results = 4, threading.Barrier(4), []

        def go():
            try:
                c = APIClient(); c.force_authenticate(user=self.user)
                barrier.wait(timeout=10)
                for _ in range(80):
                    try:
                        cache.clear()
                        r = c.patch(f'/api/questionnaire/{self.report.id}/step/',
                                    {'step': '3A-5', 'data': {'answer': {'natural_gas': '10000 m³'}}, 'language': 'en'}, format='json')
                        results.append(r.status_code)
                        return
                    except OperationalError:
                        time.sleep(0.05)
                results.append('gave up')
            finally:
                connection.close()
        threads = [threading.Thread(target=go) for _ in range(n)]
        [t.start() for t in threads]; [t.join(90) for t in threads]
        self.assertTrue(all(r == 200 for r in results), results)
        rows = list(EmissionEntry.objects.filter(company=self.company, year=2025, description__startswith='Questionnaire step 3A-5'))
        self.assertEqual([(float(e.quantity), float(e.calculated_co2e_kg)) for e in rows], [(10000.0, 20200.0)], results)
