"""A profile answer never changes what the company declared at sign-up
without the user's confirmation (QA walkthrough of 2026-10-19: NACE C10
silently became A; "Yes" to subsidiaries turned 3 into 1)."""
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from companies.models import Company, CompanyMembership
from .models import CarbonReport, ReportStep
from .tests import TestCase


class CompanyConflictTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('cc', 'cc@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Food Co', tax_number='9',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='C10.1', main_activity_description='Food manufacturing',
            number_of_employees='51-250', annual_turnover_range='1-10M',
            number_of_facilities=2, number_of_subsidiaries=3, has_overseas_operations=False,
        )
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(
            company=self.company, created_by=self.user, reporting_year=2025,
            status=CarbonReport.Status.IN_PROGRESS, current_step='B1')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _patch(self, step, data, confirm=False, lang='en'):
        body = {'step': step, 'data': data, 'language': lang}
        if confirm:
            body['confirm_company_update'] = True
        return self.client.patch(f'/api/questionnaire/{self.report.id}/step/', body, format='json')

    def _company(self):
        self.company.refresh_from_db()
        return self.company

    def test_another_sector_asks_first_and_changes_nothing(self):
        r = self._patch('B1', {'nace_code': 'A', 'nace_label': 'Agriculture'})
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'company_conflict')
        self.assertIn('NACE C10.1', r.data['error'])
        self.assertEqual(self._company().nace_code, 'C10.1')
        self.assertFalse(ReportStep.objects.filter(report=self.report, step_id='B1').exists())
        # Confirmed: applied.
        self.assertEqual(self._patch('B1', {'nace_code': 'A'}, confirm=True).status_code, 200)
        self.assertEqual(self._company().nace_code, 'A')

    def test_same_sector_keeps_the_detailed_code_without_asking(self):
        self.assertEqual(self._patch('B1', {'nace_code': 'C', 'nace_label': 'Manufacturing'}).status_code, 200)
        self.assertEqual(self._company().nace_code, 'C10.1')

    def test_subsidiaries_yes_keeps_the_declared_count(self):
        self.assertEqual(self._patch('C1', {'has_subsidiaries': True}).status_code, 200)
        self.assertEqual(self._company().number_of_subsidiaries, 3)
        r = self._patch('C1', {'has_subsidiaries': False})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self._company().number_of_subsidiaries, 3)
        self.assertEqual(self._patch('C1', {'has_subsidiaries': False}, confirm=True).status_code, 200)
        self.assertEqual(self._company().number_of_subsidiaries, 0)

    def test_overseas_employees_turnover_and_facilities_ask_when_different(self):
        cases = [('C2', {'has_international': True}), ('B3', {'employee_band': '1-50'}),
                 ('B6', {'revenue_band': '<1M'}), ('B4', {'number_of_facilities': 100})]
        for step, data in cases:
            self.assertEqual(self._patch(step, data).status_code, 409, step)
        company = self._company()
        self.assertEqual((company.has_overseas_operations, company.number_of_employees,
                          company.annual_turnover_range, company.number_of_facilities),
                         (False, '51-250', '1-10M', 2))

    def test_matching_answers_and_skips_never_ask(self):
        for step, data in [('C2', {'has_international': False}), ('B3', {'employee_band': '51-250'}),
                           ('B6', {'revenue_band': 'skip'}), ('B4', {'number_of_facilities': 2})]:
            self.assertEqual(self._patch(step, data).status_code, 200, step)
        self.assertEqual(self._company().annual_turnover_range, '1-10M')

    def test_turkish_message(self):
        r = self._patch('C2', {'has_international': True}, lang='tr')
        self.assertEqual(r.status_code, 409)
        self.assertIn('Şirket bilgisi güncellensin mi?', r.data['error'])

    def test_inventory_facility_count_updates_the_profile_once_confirmed(self):
        # B4 and 2A-1 used to drift apart: "100 facilities were declared but
        # 2 were entered" after the user had corrected the count at 2A-1.
        self._patch('B4', {'number_of_facilities': 100}, confirm=True)
        self.assertEqual(self._company().number_of_facilities, 100)
        r = self._patch('2A-1', {'answer': '2'})
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(self._patch('2A-1', {'answer': '2'}, confirm=True).status_code, 200)
        self.assertEqual(self._company().number_of_facilities, 2)
        b4 = ReportStep.objects.get(report=self.report, step_id='B4').answer
        self.assertEqual(b4.get('number_of_facilities'), 2)


class BenchmarkProfileTests(TestCase):
    """The benchmark uses the company's sign-up sector and size until an
    inventory is finished — it used to assume 1–50 employees."""

    def test_signup_bands_map_to_benchmark_bands(self):
        from emissions.views import benchmark_employee_band as band
        self.assertEqual([band(v) for v in ('1-10', '11-50', '51-250', '251-1000', '1000+', '5000_plus', '', None)],
                         ['1-50', '1-50', '51-250', '251-1000', '1001-5000', '5000+', '', ''])

    def test_summary_carries_the_company_profile(self):
        user = User.objects.create_user('bm', 'bm@test.com', 'pass12345')
        company = Company.objects.create(
            legal_entity_name='Bench Co', tax_number='77', country_of_headquarters='TR',
            countries_of_operation='TR', nace_code='C10.1', main_activity_description='x',
            number_of_employees='51-250', annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=user, company=company, role='owner')
        client = APIClient()
        client.force_authenticate(user=user)
        r = client.get('/api/emissions/summary/?year=2025')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIsNone(r.data['questionnaire_profile'])
        self.assertEqual(r.data['company_profile'], {'nace_code': 'C10.1', 'employee_band': '51-250'})
