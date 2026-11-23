"""The admin panel's home page is the platform advisor's desk: what waits for a decision and where to decide it."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone

from carbonless_api.admin_dashboard import advisor_approvals_badge, custom_requests_badge, dashboard_callback
from companies.models import Company
from emissions.models import CustomEmissionRequest
from questionnaire.models import AdvisorApproval, CarbonReport, ReportStep


# The pages are rendered without a static manifest (collectstatic is not run for the test suite).
PLAIN_STATIC = {'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
                'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}}


@override_settings(STORAGES=PLAIN_STATIC)
class AdvisorDeskTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('desk', 'desk@test.com', 'pass12345', first_name='Deniz')
        self.company = Company.objects.create(
            legal_entity_name='Desk Co', tax_number='7', country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1)
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.admin, reporting_year=2025)
        ReportStep.objects.create(report=self.report, step_id='D1', answer={'ef_database': 'std_defra'})
        self.client.force_login(self.admin)

    def approval(self, code, days=0):
        item = AdvisorApproval.objects.create(report=self.report, question_id='3A-5', field_id='x', reason_code=code,
                                              trigger_category='Belge', risk_level='medium')
        AdvisorApproval.objects.filter(pk=item.pk).update(created_at=timezone.now() - timedelta(days=days, hours=1))
        return item

    def request(self, factor=None, **extra):
        return CustomEmissionRequest.objects.create(
            user=self.admin, company=self.company, scope='scope1', category_name='c', source_name='Curing oven',
            description='d', unit='kg', quantity=Decimal('10'), year=2025, month=3, proposed_factor_kg_co2e=factor, **extra)

    def data(self):
        return dashboard_callback(None, {})

    def test_an_empty_desk_says_so(self):
        data = self.data()
        self.assertEqual((data['queue_total'], data['waiting'], data['oldest']), (0, [], None))
        self.assertEqual((advisor_approvals_badge(None), custom_requests_badge(None)), (None, None))
        page = self.client.get('/admin/')
        self.assertEqual(page.status_code, 200)
        self.assertContains(page, 'Nothing waits for your decision')

    def test_the_queue_counts_every_kind_and_puts_the_oldest_first(self):
        self.approval('ut02_measurement_document', days=9)
        self.approval('ut04_other_source', days=2)
        self.approval('custom_ef_override')
        self.request(Decimal('1.5'), factor_source_type='supplier')            # an own factor, waiting
        self.request()                                                         # a factor request, waiting
        self.request(Decimal('0.4'), status='approved', auto_accepted=True)    # accepted at once: not waiting
        data = self.data()
        self.assertEqual((data['queue_total'], data['approvals_total'], data['own_factors'], data['other_requests']),
                         (5, 3, 1, 1))
        self.assertEqual(data['auto_accepted_30d'], 1)
        rows = {r['label']: r['count'] for r in data['queue_rows']}
        self.assertEqual((rows['Measurement records'], rows['Own uncertainty claims'], rows['Other advisor rules'],
                          rows['Own emission factors'], rows['Factor requests']), (1, 1, 1, 1, 1))
        self.assertEqual((data['oldest']['age'], data['oldest']['what']), ('9 d', 'Measurement records'))
        self.assertEqual([w['days'] for w in data['waiting']], sorted((w['days'] for w in data['waiting']), reverse=True))
        self.assertEqual((advisor_approvals_badge(None), custom_requests_badge(None)), ('3', '2'))

    def test_the_page_names_the_number_and_links_to_the_item(self):
        item = self.approval('ut05_supplier_declaration', days=8)
        page = self.client.get('/admin/')
        self.assertContains(page, 'data-testid="advisor-desk"')
        self.assertContains(page, 'item waits for your decision')
        self.assertContains(page, f'/admin/questionnaire/advisorapproval/{item.pk}/change/')
        self.assertContains(page, 'css/admin-theme.css')

    def test_inventories_are_counted_by_standard_and_signature(self):
        other = CarbonReport.objects.create(company=self.company, created_by=self.admin, reporting_year=2024)
        CarbonReport.objects.filter(pk=other.pk).update(signed_at=timezone.now())
        data = self.data()
        counts = {s['key']: s['count'] for s in data['standards']}
        self.assertEqual((counts['defra'], counts['catalogue'], counts['ipcc']), (1, 1, 0))
        self.assertEqual((data['inventories'], data['inventories_signed'], data['inventories_open'], data['signed_share']),
                         (2, 1, 1, 50))

    def test_the_chart_holds_thirty_days_ending_today(self):
        bars = self.data()['bars']
        self.assertEqual(len(bars), 30)
        self.assertTrue(bars[-1]['today'])
        self.assertEqual(sum(1 for b in bars if b['today']), 1)

    def test_the_two_inboxes_open(self):
        self.approval('ut03_row_above_60', days=8)
        self.request(Decimal('1.5'), factor_source_type='supplier')
        approvals = self.client.get('/admin/questionnaire/advisorapproval/?status__exact=pending')
        self.assertContains(approvals, 'Rows above 60 % uncertainty')
        self.assertContains(approvals, 'cl-tag is-late')                      # waited a week: marked
        requests = self.client.get('/admin/emissions/customemissionrequest/?status__exact=pending')
        self.assertContains(requests, 'Own factor')
        self.assertContains(requests, '1.5 kg CO2e / kg')

    def test_a_menu_count_with_nothing_to_count_is_not_shown(self):
        page = self.client.get('/admin/')                          # nothing waiting: no count, and never the word "None"
        self.assertNotContains(page, 'cl-nav-count')
        self.approval('ut02_measurement_document')
        self.assertContains(self.client.get('/admin/'), '<span class="cl-nav-count">1</span>')
