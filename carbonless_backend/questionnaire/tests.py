import json

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework_simplejwt.tokens import RefreshToken

from companies.models import Company, CompanyMembership
from .models import CarbonReport, ReportStep

# The two question ids the questionnaire can reach that are longer than the
# old max_length=10 on CarbonReport.current_step. SQLite ignores varchar
# limits, so these only ever failed on Postgres (production) — a DataError
# that surfaced as a 500 and hard-blocked the questionnaire at Q36.
LONG_STEP_IDS = ['SCOPE-GROUPING', '3D-4-zero-decision']

# A valid option for each, so the submit test exercises the save path rather
# than bouncing off schema validation.
VALID_ANSWERS = {
    'SCOPE-GROUPING': 'combined',
    '3D-4-zero-decision': 'ipcc_default',
}


class CurrentStepLengthTests(TestCase):
    """CarbonReport.current_step must fit every question id we assign to it."""

    def setUp(self):
        self.user = User.objects.create_user('stepuser', 'step@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Step Co', tax_number='1',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(
            company=self.company, created_by=self.user, reporting_year=2026,
        )

    def test_field_is_wide_enough_for_every_long_id(self):
        """Backend-independent guard: assert the column, not the write.

        A plain save() would pass on SQLite even with the old max_length=10,
        so this checks the declared field width directly — it fails on any
        backend if the field is ever narrowed again.
        """
        width = CarbonReport._meta.get_field('current_step').max_length
        for step_id in LONG_STEP_IDS:
            self.assertLessEqual(
                len(step_id), width,
                f"current_step (max_length={width}) cannot hold '{step_id}' "
                f"({len(step_id)} chars) — this raises DataError on Postgres",
            )

    def test_submitting_a_long_step_id_succeeds(self):
        token = str(RefreshToken.for_user(self.user).access_token)
        for step_id in LONG_STEP_IDS:
            with self.subTest(step=step_id):
                res = self.client.patch(
                    f'/api/questionnaire/{self.report.id}/step/',
                    data=json.dumps({
                        'step': step_id,
                        'data': {'answer': VALID_ANSWERS[step_id]},
                        'language': 'en',
                    }),
                    content_type='application/json',
                    HTTP_AUTHORIZATION=f'Bearer {token}',
                )
                self.assertEqual(res.status_code, 200, res.content)
                self.report.refresh_from_db()
                self.assertEqual(self.report.current_step, step_id)
                self.assertTrue(
                    ReportStep.objects.filter(report=self.report, step_id=step_id).exists()
                )


class CombinedReportTests(TestCase):
    """The three-report pack: one PDF, bound in order, numbered straight through."""

    def setUp(self):
        self.user = User.objects.create_user('packuser', 'pack@test.com', 'pass12345')
        self.other = User.objects.create_user('packother', 'other@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Pack Co', tax_number='2',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(
            company=self.company, created_by=self.user, reporting_year=2026,
        )
        self.url = f'/api/questionnaire/{self.report.id}/combined-report/'

    def _auth(self, user=None):
        return {'HTTP_AUTHORIZATION':
                f'Bearer {RefreshToken.for_user(user or self.user).access_token}'}

    def test_returns_one_pdf_with_all_three_parts(self):
        res = self.client.get(self.url, **self._auth())
        self.assertEqual(res.status_code, 200, getattr(res, 'data', res.content[:200]))
        self.assertEqual(res['Content-Type'], 'application/pdf')
        self.assertIn('ghg_reporting_pack_2026_en.pdf', res['Content-Disposition'])

        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(res.content))
        titles = [o.title for o in reader.outline]
        self.assertEqual(len(titles), 3, f'expected three bookmarked parts, got {titles}')
        self.assertTrue(titles[0].startswith('Part I'), titles)
        self.assertTrue(titles[1].startswith('Part II'), titles)
        self.assertTrue(titles[2].startswith('Part III'), titles)

        # Each part must start after the one before it, or they were bound
        # out of order or on top of each other.
        starts = [reader.get_destination_page_number(o) for o in reader.outline]
        self.assertEqual(starts, sorted(starts))
        self.assertLess(starts[-1], len(reader.pages))

    def test_pages_are_numbered_continuously_across_parts(self):
        """The pack's whole point over three separate files: one page sequence."""
        import io
        import re
        from pypdf import PdfReader

        res = self.client.get(self.url, **self._auth())
        reader = PdfReader(io.BytesIO(res.content))
        printed = []
        for sheet, page in enumerate(reader.pages, start=1):
            found = re.findall(r'Page\s+(\d+)', page.extract_text() or '')
            if found:
                printed.append((sheet, int(found[0])))

        self.assertGreater(len(printed), 10, 'no page numbers found to check')
        # Every numbered sheet carries the same sheet-to-number offset; a part
        # that restarted its own numbering would break the run.
        offsets = {sheet - number for sheet, number in printed}
        self.assertEqual(
            len(offsets), 1,
            f'page numbering restarts inside the pack (offsets seen: {sorted(offsets)})')

    def test_turkish_pack_is_built_in_turkish(self):
        res = self.client.get(self.url + '?lang=tr', **self._auth())
        self.assertEqual(res.status_code, 200)
        self.assertIn('ghg_reporting_pack_2026_tr.pdf', res['Content-Disposition'])

        import io
        from pypdf import PdfReader
        titles = [o.title for o in PdfReader(io.BytesIO(res.content)).outline]
        self.assertTrue(all(t.startswith('Bölüm') for t in titles), titles)

    def test_another_users_report_is_not_downloadable(self):
        res = self.client.get(self.url, **self._auth(self.other))
        self.assertEqual(res.status_code, 404)

    def test_bad_year_is_rejected(self):
        res = self.client.get(self.url + '?year=soon', **self._auth())
        self.assertEqual(res.status_code, 400)


class RegistrationPrefillTests(TestCase):
    """A first report pre-fills A1/A2 from the company entered at sign-up."""

    def _make(self, tax_number):
        user = User.objects.create_user(f'pre{tax_number or "x"}', f'pre{tax_number}@test.com', 'pass12345')
        company = Company.objects.create(
            legal_entity_name='Kaya Tekstil A.Ş.', tax_number=tax_number,
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=user, company=company, role='owner')
        report = CarbonReport.objects.create(company=company, created_by=user, reporting_year=2026)
        token = str(RefreshToken.for_user(user).access_token)
        return self.client.get(
            f'/api/questionnaire/{report.id}/previous-profile/',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        ).json()

    def test_first_report_gets_company_name_and_valid_tax_id(self):
        data = self._make('1234567890')
        self.assertFalse(data['available'])
        self.assertEqual(data['answers']['A1'], {'legal_name': 'Kaya Tekstil A.Ş.'})
        self.assertEqual(data['answers']['A2'], {'tax_id': '1234567890'})

    def test_tax_id_skipped_when_it_would_fail_a2_validation(self):
        data = self._make('')
        self.assertEqual(data['answers']['A1'], {'legal_name': 'Kaya Tekstil A.Ş.'})
        self.assertNotIn('A2', data['answers'])


class ReportListProgressTests(TestCase):
    """Library progress uses the survey's own baseline and never fakes 100%."""

    def test_draft_uses_baseline_and_caps_below_100(self):
        from .views import _progress, BASELINE_QUESTIONS
        self.assertEqual(_progress(0, CarbonReport.Status.IN_PROGRESS)['total'], BASELINE_QUESTIONS)
        # Branches can push a draft past the baseline — still not "done".
        long_draft = _progress(BASELINE_QUESTIONS + 5, CarbonReport.Status.IN_PROGRESS)
        self.assertEqual(long_draft['percent'], 99)

    def test_completed_report_is_100(self):
        from .views import _progress
        self.assertEqual(_progress(97, CarbonReport.Status.COMPLETED)['percent'], 100)


class ClientProgressTests(TestCase):
    """The library shows the survey's own progress, sent with each step."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.user = User.objects.create_user('prog', 'prog@test.com', 'pass12345')
        company = Company.objects.create(
            legal_entity_name='Prog Co', tax_number='1',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.user, company=company, role='owner')
        self.report = CarbonReport.objects.create(company=company, created_by=self.user, reporting_year=2026)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _step(self, progress):
        return self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': 'SCOPE-GROUPING', 'data': {'answer': 'combined'}, 'progress': progress,
        }, format='json')

    def _listed(self):
        rows = self.client.get('/api/questionnaire/').data['reports']
        return next(r for r in rows if r['report_id'] == self.report.id)['progress']

    def test_list_uses_the_survey_numbers(self):
        self.assertEqual(self._step({'answered': 47, 'total': 128}).status_code, 200)
        self.assertEqual(self._listed(), {'completed': 47, 'total': 128, 'percent': 37})

    def test_nonsense_progress_is_ignored(self):
        self._step({'answered': 500, 'total': 128})
        self.report.refresh_from_db()
        self.assertIsNone(self.report.client_progress)


class StepEntriesTests(TestCase):
    """Only questions that ask for an activity amount become emission entries."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.user = User.objects.create_user('ent', 'ent@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Ent Co', tax_number='2',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _factor(self, slug, unit, value, scope='scope3', country='global'):
        from emissions.models import EmissionFactor
        return EmissionFactor.objects.update_or_create(
            slug=slug, country=country, year=2024,
            defaults=dict(name=slug, scope=scope, category='x', unit=unit,
                          factor_kg_co2e=value, source='test', is_active=True, is_default=True))[0]

    def _step(self, step, answer):
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': step, 'data': {'answer': answer}}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        return r

    def _entries(self):
        from emissions.models import EmissionEntry
        return list(EmissionEntry.objects.filter(company=self.company).order_by('id'))

    def test_supplier_ef_document_creates_no_entry(self):
        self._step('3A-EF-a', {'ef_year': '2026', 'ef_unit': 'kgCO2e_kWh', 'ef_value': '5', 'ef_source': 'X'})
        self._step('4A-1a', '5')
        self._step('4A-3a', {'production_kwh': '5', 'grid_sales': True, 'grid_sales_kwh': '5'})
        self.assertEqual(self._entries(), [])

    def test_each_fuel_gets_its_own_factor(self):
        self._factor('natural-gas-m3', 'm3', 2, scope='scope1')
        self._factor('diesel', 'liters', 3, scope='scope1')
        self._step('3A-5', {'natural_gas': '10 m³', 'diesel': '1.000 litre'})
        got = {(e.emission_factor.slug, float(e.quantity)) for e in self._entries()}
        self.assertEqual(got, {('natural-gas-m3', 10.0), ('diesel', 1000.0)})
        # Answering again replaces, never duplicates.
        self._step('3A-5', {'natural_gas': '20 m³'})
        self.assertEqual([(e.emission_factor.slug, float(e.quantity)) for e in self._entries()],
                         [('natural-gas-m3', 20.0)])

    def test_transport_and_waste_use_catalog_codes(self):
        self._factor('tm-01', 'tonne-km', 0.062)
        self._factor('tm-02-ds', 'tonne-km', 0.123)
        self._factor('wt-01-recycling', 'kg', -0.125)
        self._step('K3C4-2', {'items': [{'transport_mode': 'TM-01', 'load_tonne': '5', 'distance_km': '100'},
                                        {'transport_mode': 'TM-99', 'load_tonne': '5', 'distance_km': '100'}],
                              'draft': {}})
        self._step('K3C9-1', {'items': [{'transport_mode': 'TM-02', 'load_tonne': '2', 'distance_km': '50'}]})
        self._step('K3C5-2', {'items': [{'waste_type': 'WT-01', 'quantity_kg': '400', 'disposal_method': 'recycling'},
                                        {'waste_type': 'WT-05', 'quantity_kg': '10', 'disposal_method': 'landfill'}]})
        got = {(e.emission_factor.slug, float(e.quantity), round(float(e.calculated_co2e_kg), 3))
               for e in self._entries()}
        self.assertEqual(got, {('tm-01', 500.0, 31.0), ('tm-02-ds', 100.0, 12.3),
                               ('wt-01-recycling', 400.0, -50.0)})

    def test_4a_1_does_not_touch_4a_1a_entries(self):
        self._factor('turkey-grid', 'kwh', 0.4, scope='scope2', country='turkey')
        self._step('4A-1', {'site': '1 MWh'})
        self._step('4A-1a', '5')
        entries = self._entries()
        self.assertEqual([(e.description, float(e.quantity)) for e in entries],
                         [('Questionnaire step 4A-1', 1000.0)])



class ReuseProfileYearTests(TestCase):
    """Reusing the company profile never copies the reporting year."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.user = User.objects.create_user('reuse', 'reuse@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Reuse Co', tax_number='3',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.old = CarbonReport.objects.create(
            company=self.company, created_by=self.user, reporting_year=2020,
            title='Old', status=CarbonReport.Status.COMPLETED, boundary_approach='operational_control')
        ReportStep.objects.create(report=self.old, step_id='A4', answer={'reporting_year': 2020})
        ReportStep.objects.create(report=self.old, step_id='A5', answer={'prepared_by': 'Ayşe'})
        self.new = CarbonReport.objects.create(company=self.company, created_by=self.user, title='New')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _reuse(self, **body):
        return self.client.post(f'/api/questionnaire/{self.new.id}/reuse-profile/', body, format='json')

    def test_previous_profile_lists_other_inventories(self):
        data = self.client.get(f'/api/questionnaire/{self.new.id}/previous-profile/').data
        self.assertEqual([(r['title'], r['reporting_year']) for r in data['other_inventories']], [('Old', 2020)])

    def test_year_is_the_chosen_one(self):
        r = self._reuse(reporting_year=2021)
        self.assertEqual(r.status_code, 200)
        self.new.refresh_from_db()
        self.assertEqual(self.new.reporting_year, 2021)
        self.assertEqual(self.new.boundary_approach, 'operational_control')
        self.assertEqual(r.data['answers']['A4'], {'reporting_year': 2021})
        self.assertEqual(r.data['answers']['A5'], {'prepared_by': 'Ayşe'})
        self.assertEqual(ReportStep.objects.get(report=self.new, step_id='A4').answer, {'reporting_year': 2021})

    def test_year_is_required(self):
        self.assertEqual(self._reuse().status_code, 400)
        self.assertEqual(self._reuse(reporting_year=3000).status_code, 400)
        self.new.refresh_from_db()
        self.assertIsNone(self.new.reporting_year)


class ISOReportTurkishLabelsTests(TestCase):
    def test_boundary_and_factor_names_in_turkish(self):
        from types import SimpleNamespace
        from .iso_report_pdf import _boundary_label, _factor_name, _unit_label, _source_label
        report = SimpleNamespace(boundary_approach='operational_control')
        self.assertEqual(_boundary_label(report, 'tr'), 'Operasyonel Kontrol')
        self.assertEqual(_boundary_label(report, 'en'), 'Operational Control')
        f = SimpleNamespace(name='Road — HGV 40t full load', name_tr='Karayolu — HTC 40t tam dolu',
                            unit='liters', source='generic',
                            get_unit_display=lambda: 'Litres', get_source_display=lambda: 'Generic/Estimated')
        self.assertEqual(_factor_name(f, 'tr'), 'Karayolu — HTC 40t tam dolu')
        self.assertEqual(_factor_name(f, 'en'), 'Road — HGV 40t full load')
        self.assertEqual(_unit_label(f, 'tr'), 'Litre')
        self.assertEqual(_source_label(f, 'tr'), 'Genel / tahmini')
