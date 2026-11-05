"""The inventory status response (GET /api/questionnaire/<id>/) lists the required questions still unanswered, from the
SAME function the completion check uses (deferral.required_unanswered), for that inventory only. The dashboard's
inventory status card shows it; read only, nothing is saved."""
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from companies.models import Company, CompanyMembership
from . import deferral
from . import tests as _base
from .models import CarbonReport, ReportStep


class RequiredUnansweredInStatusTests(_base.TestCase):
    def setUp(self):
        self.user = User.objects.create_user('ru_owner', 'ru_owner@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Status Co', tax_number='9990002223', country_of_headquarters='TR',
            countries_of_operation='TR', nace_code='', main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.a = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025, title='A')
        self.b = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025, title='B')

    def _status(self, report):
        r = self.client.get(f'/api/questionnaire/{report.id}/')
        self.assertEqual(r.status_code, 200, r.content)
        return r.data

    def test_it_is_the_completion_checks_own_list(self):
        data = self._status(self.a)
        self.assertIsInstance(data['required_unanswered'], list)
        self.assertTrue(data['required_unanswered'])                       # a new inventory has required questions
        self.assertEqual(data['required_unanswered'], deferral.required_unanswered(deferral.saved_answers(self.a)))

    def test_it_is_per_inventory_and_a_saved_answer_of_one_does_not_change_the_other(self):
        before_b = self._status(self.b)['required_unanswered']
        first = self._status(self.a)['required_unanswered'][0]
        ReportStep.objects.create(report=self.a, step_id=first, answer={'answer': 'x'}, is_skipped=False)
        after_a = self._status(self.a)['required_unanswered']
        self.assertNotIn(first, after_a)
        self.assertEqual(self._status(self.b)['required_unanswered'], before_b)        # B untouched
        self.assertEqual(after_a, deferral.required_unanswered(deferral.saved_answers(self.a)))

    def test_reading_the_status_changes_nothing(self):
        before = (list(ReportStep.objects.order_by('id').values_list()), CarbonReport.objects.filter(pk=self.a.pk).values_list(
            'status', 'current_step', 'pending_questions', 'client_progress').first())
        self._status(self.a)
        self.assertEqual((list(ReportStep.objects.order_by('id').values_list()), CarbonReport.objects.filter(pk=self.a.pk).values_list(
            'status', 'current_step', 'pending_questions', 'client_progress').first()), before)
