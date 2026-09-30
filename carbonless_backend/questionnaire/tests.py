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

    def test_declining_reuse_keeps_only_sign_up_answers(self):
        # "No, let me re-enter" falls back to registration_answers: the
        # earlier report's answers (A5 here) are not offered again.
        data = self.client.get(f'/api/questionnaire/{self.new.id}/previous-profile/').data
        self.assertEqual(data['answers']['A5'], {'prepared_by': 'Ayşe'})
        self.assertNotIn('A5', data['registration_answers'])
        self.assertEqual(data['registration_answers'].get('A1'), {'legal_name': 'Reuse Co'})

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


class CompanyInventoryAccessTests(TestCase):
    """Inventories belong to the company: teammates see and open them."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.owner = User.objects.create_user('own', 'own@test.com', 'pass12345')
        self.admin = User.objects.create_user('adm', 'adm@test.com', 'pass12345')
        self.entry = User.objects.create_user('ent2', 'ent2@test.com', 'pass12345')
        self.outsider = User.objects.create_user('out', 'out@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Team Co', tax_number='4',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        other = Company.objects.create(
            legal_entity_name='Other Co', tax_number='5',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.owner, company=self.company, role='owner')
        CompanyMembership.objects.create(user=self.admin, company=self.company, role='admin')
        CompanyMembership.objects.create(user=self.entry, company=self.company, role='data_entry')
        CompanyMembership.objects.create(user=self.outsider, company=other, role='owner')
        self.report = CarbonReport.objects.create(
            company=self.company, created_by=self.owner, reporting_year=2024,
            title='Owner inventory', status=CarbonReport.Status.COMPLETED)

    def _client(self, user):
        from rest_framework.test import APIClient
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def _entry(self, description, year=2024):
        from emissions.models import EmissionEntry, EmissionFactor
        f, _ = EmissionFactor.objects.get_or_create(
            slug='t-grid', country='turkey', year=2024,
            defaults=dict(name='grid', scope='scope2', category='electricity', unit='kwh',
                          factor_kg_co2e=0.4, source='test'))
        return EmissionEntry.objects.create(
            company=self.company, user=self.owner, emission_factor=f, year=year, month=1,
            quantity=10, calculated_co2e_kg=4, description=description, status='approved')

    def test_teammate_lists_and_opens_the_inventory(self):
        c = self._client(self.admin)
        rows = c.get('/api/questionnaire/').data['reports']
        self.assertEqual([(r['title'], r['created_by']) for r in rows], [('Owner inventory', 'own@test.com')])
        self.assertEqual(c.get(f'/api/questionnaire/{self.report.id}/').status_code, 200)
        # The creator's own list doesn't label it.
        own = self._client(self.owner).get('/api/questionnaire/').data['reports']
        self.assertIsNone(own[0]['created_by'])

    def test_outsider_cannot_open_it(self):
        c = self._client(self.outsider)
        self.assertEqual(c.get(f'/api/questionnaire/{self.report.id}/').status_code, 404)
        self.assertEqual(c.delete(f'/api/questionnaire/{self.report.id}/').status_code, 404)

    def test_only_creator_owner_or_admin_can_delete(self):
        r = self._client(self.entry).delete(f'/api/questionnaire/{self.report.id}/')
        self.assertEqual(r.status_code, 403)
        self.assertTrue(CarbonReport.objects.filter(id=self.report.id).exists())
        self.assertEqual(self._client(self.admin).delete(f'/api/questionnaire/{self.report.id}/').status_code, 200)

    def test_delete_removes_its_questionnaire_entries_only(self):
        from emissions.models import EmissionEntry
        self._entry('Questionnaire step 4A-1')
        chat = self._entry('Chat: electricity')
        other_year = self._entry('Questionnaire step 4A-1', year=2023)
        r = self._client(self.owner).delete(f'/api/questionnaire/{self.report.id}/')
        self.assertEqual(r.data, {'deleted_entries': 1})
        self.assertEqual(set(EmissionEntry.objects.values_list('id', flat=True)), {chat.id, other_year.id})

    def test_delete_keeps_entries_shared_with_another_inventory(self):
        from emissions.models import EmissionEntry
        self._entry('Questionnaire step 4A-1')
        CarbonReport.objects.create(company=self.company, created_by=self.owner, reporting_year=2024, title='Second')
        r = self._client(self.owner).delete(f'/api/questionnaire/{self.report.id}/')
        self.assertEqual(r.data, {'deleted_entries': 0})
        self.assertEqual(EmissionEntry.objects.count(), 1)


class StepEntryApprovalTests(TestCase):
    """Questionnaire entries follow the same approval rule as the form."""

    def test_data_entry_answers_wait_for_approval(self):
        from rest_framework.test import APIClient
        from emissions.models import EmissionEntry, EmissionFactor
        from accounts.models import Notification
        owner = User.objects.create_user('ow3', 'ow3@test.com', 'pass12345')
        clerk = User.objects.create_user('de3', 'de3@test.com', 'pass12345')
        company = Company.objects.create(
            legal_entity_name='Appr Co', tax_number='6',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=owner, company=company, role='owner')
        CompanyMembership.objects.create(user=clerk, company=company, role='data_entry')
        EmissionFactor.objects.update_or_create(
            slug='turkey-grid', country='turkey', year=2024,
            defaults=dict(name='grid', scope='scope2', category='electricity', unit='kwh',
                          factor_kg_co2e=0.4, source='test', is_active=True, is_default=True))
        report = CarbonReport.objects.create(company=company, created_by=owner, reporting_year=2025)

        def save(user):
            c = APIClient()
            c.force_authenticate(user=user)
            r = c.patch(f'/api/questionnaire/{report.id}/step/',
                        {'step': '4A-1', 'data': {'answer': {'Merkez': '1000 kWh'}}}, format='json')
            self.assertEqual(r.status_code, 200)
            return EmissionEntry.objects.get(company=company)

        entry = save(clerk)
        self.assertEqual(entry.status, 'submitted')
        self.assertTrue(Notification.objects.filter(user=owner, notification_type='entry_submitted').exists())
        note = Notification.objects.get(user=owner, notification_type='entry_submitted')
        self.assertIn('1.000 kWh', note.message)
        c = APIClient()
        c.force_authenticate(user=owner)
        pending = c.get('/api/emissions/pending/').data
        self.assertEqual([(p['entered_by'], p['year']) for p in pending], [('de3@test.com', 2025)])
        self.assertEqual(save(owner).status, 'approved')


class RejectedQuestionnaireEntryTests(TestCase):
    """A rejected questionnaire entry is fixed in the questionnaire, and a
    rejected entry does not count in the totals."""

    def setUp(self):
        from rest_framework.test import APIClient
        from emissions.models import EmissionFactor
        self.owner = User.objects.create_user('ow4', 'ow4@test.com', 'pass12345')
        self.clerk = User.objects.create_user('de4', 'de4@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Rej Co', tax_number='7',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.owner, company=self.company, role='owner')
        CompanyMembership.objects.create(user=self.clerk, company=self.company, role='data_entry')
        EmissionFactor.objects.update_or_create(
            slug='turkey-grid', country='turkey', year=2024,
            defaults=dict(name='grid', scope='scope2', category='electricity', unit='kwh',
                          factor_kg_co2e=0.4, source='test', is_active=True, is_default=True))
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.owner, reporting_year=2021)
        self.c_clerk, self.c_owner = APIClient(), APIClient()
        self.c_clerk.force_authenticate(user=self.clerk)
        self.c_owner.force_authenticate(user=self.owner)
        self.c_clerk.patch(f'/api/questionnaire/{self.report.id}/step/',
                           {'step': '4A-1', 'data': {'answer': {'Merkez': '1000 kWh'}}}, format='json')
        from emissions.models import EmissionEntry
        self.entry = EmissionEntry.objects.get(company=self.company)
        r = self.c_owner.post(f'/api/emissions/entries/{self.entry.id}/approve/',
                              {'action': 'reject', 'reason': 'fatura 800'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_entry_points_to_its_question_and_cannot_be_edited_here(self):
        rows = self.c_clerk.get('/api/emissions/entries/?year=2021').data
        rows = rows.get('results', rows) if isinstance(rows, dict) else rows
        self.assertEqual(rows[0]['questionnaire_source'], {'report_id': self.report.id, 'step_id': '4A-1'})
        r = self.c_clerk.patch(f'/api/emissions/entries/{self.entry.id}/', {'quantity': '800'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data['code'], 'edit_in_questionnaire')

    def test_rejection_notification_opens_the_entry_year(self):
        from accounts.models import Notification
        n = Notification.objects.get(user=self.clerk, notification_type='entry_rejected')
        self.assertEqual(n.link, '/dashboard?tab=emissions&year=2021')
        self.assertIn('Ankette düzelt', n.message)

    def test_rejected_entry_not_in_summary(self):
        s = self.c_owner.get('/api/emissions/summary/?year=2021').data
        self.assertEqual(float(s['total_kg'] if 'total_kg' in s else s['total_tonne']), 0.0)


class StartedByTests(TestCase):
    """The inventory status names who started it when a team mate opens it."""

    def setUp(self):
        from accounts.models import UserProfile
        self.company = Company.objects.create(
            legal_entity_name='Team Co', tax_number='2',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        self.owner = User.objects.create_user('baris', 'baris@test.com', 'pass12345', first_name='Barış', last_name='Demir')
        self.clerk = User.objects.create_user('mert', 'mert@test.com', 'pass12345')
        for u, role in [(self.owner, 'owner'), (self.clerk, 'data_entry')]:
            UserProfile.objects.create(user=u, active_company=self.company)
            CompanyMembership.objects.create(user=u, company=self.company, role=role)
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.owner, reporting_year=2026)

    def _status(self, user):
        token = str(RefreshToken.for_user(user).access_token)
        res = self.client.get(f'/api/questionnaire/{self.report.id}/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(res.status_code, 200, res.content)
        return res.json()

    def test_team_mate_sees_who_started_it(self):
        self.assertEqual(self._status(self.clerk)['started_by'], 'Barış Demir')

    def test_creator_sees_none(self):
        self.assertIsNone(self._status(self.owner)['started_by'])


class PendingAdvisorAnswerTests(TestCase):
    """The Onay Bekleyenler inbox carries the flagged answer and the
    inventory's year, so an approver sees what they are approving."""

    def setUp(self):
        from .models import AdvisorApproval, ReportStep
        self.user = User.objects.create_user('advuser', 'adv@test.com', 'pass12345')
        company = Company.objects.create(
            legal_entity_name='Adv Co', tax_number='3',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.user, company=company, role='owner')
        report = CarbonReport.objects.create(company=company, created_by=self.user, reporting_year=2025)
        ReportStep.objects.create(report=report, step_id='6A-2', answer={'answer': 'not_controlled'})
        ReportStep.objects.create(report=report, step_id='3A-EF-a', answer={'answer': {'ef_value': '5', 'ef_unit': 'kgCO2e_kWh'}})
        for qid in ('6A-2', '3A-EF-a', '3D-EF'):
            AdvisorApproval.objects.create(report=report, question_id=qid, reason_code=f'r-{qid}',
                                           trigger_category='x', risk_level='medium')
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_items_carry_answer_and_year(self):
        res = self.client.get('/api/questionnaire/advisor-approvals/pending/')
        self.assertEqual(res.status_code, 200)
        by_q = {i['question_id']: i for i in res.json()}
        self.assertEqual(by_q['6A-2']['answer'], 'not_controlled')
        self.assertEqual(by_q['3A-EF-a']['answer'], {'ef_value': '5', 'ef_unit': 'kgCO2e_kWh'})
        self.assertIsNone(by_q['3D-EF']['answer'])  # no saved step
        self.assertEqual(by_q['6A-2']['reporting_year'], 2025)


class TaxIdStepTests(TestCase):
    """Question 2 (tax ID): VKN/TCKN for a Turkish company, the local tax /
    VAT number for one based elsewhere; a number another company already
    uses is refused without naming that company."""

    def _company(self, name, country, tax=''):
        return Company.objects.create(
            legal_entity_name=name, tax_number=tax,
            country_of_headquarters=country, countries_of_operation=country,
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )

    def _setup(self, country):
        from rest_framework.test import APIClient
        user = User.objects.create_user(f'tax{country}', f'tax{country}@test.com', 'pass12345')
        company = self._company(f'{country} Co', country)
        CompanyMembership.objects.create(user=user, company=company, role='owner')
        report = CarbonReport.objects.create(company=company, created_by=user, reporting_year=2026)
        client = APIClient()
        client.force_authenticate(user=user)
        return client, report, company

    def _send(self, client, report, tax_id, lang='en'):
        return client.patch(f'/api/questionnaire/{report.id}/step/',
                            {'step': 'A2', 'data': {'tax_id': tax_id}, 'language': lang}, format='json')

    def test_foreign_company_uses_its_own_tax_number(self):
        client, report, company = self._setup('GB')
        res = self._send(client, report, 'gb 123 456 789')
        self.assertEqual(res.status_code, 200, res.content)
        company.refresh_from_db()
        self.assertEqual(company.tax_number, 'GB 123 456 789')
        self.assertTrue(ReportStep.objects.filter(report=report, step_id='A2').exists())
        self.assertEqual(self._send(client, report, 'ABC').status_code, 400)  # too short, no digit

    def test_turkish_company_still_needs_vkn_or_tckn(self):
        client, report, _ = self._setup('TR')
        self.assertEqual(self._send(client, report, 'GB123456789').status_code, 400)
        self.assertEqual(self._send(client, report, '123456789').status_code, 400)
        self.assertEqual(self._send(client, report, '1234567891').status_code, 200)

    def test_duplicate_is_a_conflict_and_does_not_name_the_other_company(self):
        self._company('Gizli Tekstil A.Ş.', 'TR', tax='5555555555')
        client, report, _ = self._setup('TR')
        res = self._send(client, report, '5555555555', lang='tr')
        self.assertEqual(res.status_code, 409)
        body = res.content.decode()
        self.assertNotIn('Gizli', body)
        self.assertEqual(res.json()['code'], 'duplicate_tax_id')
        self.assertIn('başka bir şirket', res.json()['error'])
        self.assertFalse(ReportStep.objects.filter(report=report, step_id='A2').exists())

    def test_foreign_registration_tax_number_is_prefilled(self):
        client, report, company = self._setup('DE')
        company.tax_number = 'DE123456789'
        company.save()
        data = client.get(f'/api/questionnaire/{report.id}/previous-profile/').json()
        self.assertEqual(data['answers']['A2'], {'tax_id': 'DE123456789'})

    def test_registered_facility_count_is_a_hint_not_an_answer(self):
        # The count at sign-up is today's; an inventory for an earlier year
        # may have had a different one, so B4 is never pre-answered with it.
        from companies.models import Facility
        client, report, company = self._setup('TR')
        url = f'/api/questionnaire/{report.id}/previous-profile/'
        self.assertEqual(client.get(url).json()['facility_count'], 0)
        Facility.objects.create(company=company, name='Tesis 1', country='TR')
        Facility.objects.create(company=company, name='Tesis 2', country='TR')
        data = client.get(url).json()
        self.assertEqual(data['facility_count'], 2)
        self.assertNotIn('B4', data['answers'])


class FacilitySyncTests(TestCase):
    """Question 2A-2 names the company's real facilities."""

    def setUp(self):
        from rest_framework.test import APIClient
        from companies.models import Facility
        self.user = User.objects.create_user('facu', 'fac@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Fac Co', tax_number='9', country_of_headquarters='TR',
            countries_of_operation='TR', nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=3)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2026)
        Facility.objects.create(company=self.company, name='Tesis 1', country='TR')
        Facility.objects.create(company=self.company, name='Depo Ankara', country='TR')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _names(self):
        from companies.models import Facility
        return list(Facility.objects.filter(company=self.company).order_by('id').values_list('name', 'country'))

    def test_answer_renames_placeholders_matches_names_and_adds_the_rest(self):
        answer = {'answer': {
            '1': {'name': 'İzmir Fabrika', 'country': 'TR'},
            '2': {'name': 'Depo Ankara', 'country': 'TR'},
            '3': {'name': 'Berlin Ofis', 'country': 'DE'},
        }}
        res = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                                {'step': '2A-2', 'data': answer, 'language': 'tr'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(self._names(), [('İzmir Fabrika', 'TR'), ('Depo Ankara', 'TR'), ('Berlin Ofis', 'DE')])
        # Saving the same answer again changes nothing and deletes nothing.
        self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                          {'step': '2A-2', 'data': answer, 'language': 'tr'}, format='json')
        self.assertEqual(len(self._names()), 3)

    def test_never_deletes_facilities(self):
        from .facility_sync import sync_facilities
        sync_facilities(self.company, {'answer': {'1': {'name': 'Tek Tesis', 'country': 'TR'}}})
        self.assertEqual(self._names(), [('Tek Tesis', 'TR'), ('Depo Ankara', 'TR')])


class ReportTextTests(CombinedReportTests):
    """Turkish wording in the inventory profile; the ISO report's facility
    count matches the facilities it lists."""

    def _text(self, url):
        import io
        import re
        from pypdf import PdfReader
        res = self.client.get(url, **self._auth())
        self.assertEqual(res.status_code, 200)
        text = '\n'.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(res.content)).pages)
        return re.sub(r'\s+', ' ', text)

    def test_profile_scope_table_is_turkish(self):
        from emissions.models import EmissionEntry, EmissionFactor
        f = EmissionFactor.objects.create(slug='pt-gas', name='Gas', name_tr='Gaz', scope='scope1',
                                          category='stationary_combustion', country='turkey', unit='m3',
                                          factor_kg_co2e=2, source='generic')
        EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=f, year=2026,
                                     month=1, quantity=10, calculated_co2e_kg=20, status='approved')
        text = self._text(f'/api/questionnaire/{self.report.id}/pdf/?lang=tr')
        self.assertIn('Kapsam 1 20,00', text)
        self.assertIn('%100,0', text)
        self.assertNotIn('Scope 1', text)

    def test_iso_report_counts_registered_facilities(self):
        from companies.models import Facility
        self.company.number_of_facilities = 5
        self.company.save()
        for name in ('Gebze', 'Bursa'):
            Facility.objects.create(company=self.company, name=name)
        text = self._text(f'/api/questionnaire/{self.report.id}/iso-report/?lang=tr')
        self.assertIn('Tesis sayısı 2', text)
