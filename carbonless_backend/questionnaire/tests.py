import json

from django.contrib.auth.models import User
from django.test import TestCase as _DjangoTestCase


class TestCase(_DjangoTestCase):
    """Every test starts with an empty cache. The step endpoint's per-user
    rate limit (60/min) lives in the cache and is keyed on user ids, which
    the test database hands out again in each test — a fast run counted all
    tests' saves as one user's and answered 429."""

    def _pre_setup(self):
        super()._pre_setup()
        from django.core.cache import cache
        cache.clear()
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
        self._step('4A-3a', {'facility': 'Fabrika', 'production_kwh': '5', 'grid_sales': True, 'grid_sales_kwh': '5'})
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


class InventoryCalculationTests(StepEntriesTests):
    """Every answer with an approved factor reaches the dashboard; anything
    without one is left out, never guessed."""

    def _by_step(self):
        out = {}
        for e in self._entries():
            step = e.description[len('Questionnaire step '):].split(' ')[0]
            out.setdefault(step, []).append(
                (e.emission_factor.slug, round(float(e.quantity), 3), round(float(e.calculated_co2e_kg), 3)))
        return out

    def test_vehicles_by_fuel_and_class(self):
        self._factor('motorin-mobile', 'liters', 2.696, scope='scope1', country='turkey')
        self._factor('car-diesel', 'km', 0.156, scope='scope1', country='turkey')
        self._factor('off-road-diesel-desnz', 'liters', 3.17939, scope='scope1')
        self._factor('lpg', 'liters', 1.5, scope='scope1', country='turkey')
        self._step('3B-5', {'EQ-3B-05': 'diesel', 'EQ-3B-01': 'diesel', 'EQ-3B-01#2': 'electric',
                            'EQ-3B-10': 'diesel', 'EQ-3B-11': 'diesel', 'EQ-3B-02': 'lpg_cng'})
        self._step('3B-6', {'EQ-3B-05': 'fuel_litres', 'EQ-3B-01': 'annual_km', 'EQ-3B-01#2': 'annual_km',
                            'EQ-3B-10': 'annual_km', 'EQ-3B-11': 'fuel_litres', 'EQ-3B-02': 'fuel_litres'})
        self._step('3B-7', {'EQ-3B-05': '1.000 litre', 'EQ-3B-01': '10.000 km', 'EQ-3B-01#2': '5000 km',
                            'EQ-3B-10': '80000 km', 'EQ-3B-11': '200 litre', 'EQ-3B-02': '100 litre'})
        got = self._by_step()['3B-7']
        # Trucks by km and electric cars by km are not calculated.
        self.assertEqual(sorted(got), sorted([
            ('motorin-mobile', 1000.0, 2696.0), ('car-diesel', 10000.0, 1560.0),
            ('off-road-diesel-desnz', 200.0, 635.878), ('calculated-scope1-mobile_combustion', 150.0, 150.0)]))
        lpg = next(e for e in self._entries() if e.emission_factor.slug.startswith('calculated-'))
        self.assertIn('EQ-3B-02 · 100 litre × 1,5 (lpg)', lpg.description)
        self.assertEqual(lpg.calc_detail['en'], 'EQ-3B-02 · 100 litres × 1.5 (lpg)')
        self._step('3B-0', 'no')
        self.assertNotIn('3B-7', self._by_step())

    def test_ev_charging_counted_once(self):
        self._factor('turkey-grid', 'kwh', 0.4, scope='scope2', country='turkey')
        self._step('3B-5', {'EQ-3B-01': 'electric'})
        self._step('4A-EV', {'ev_kwh': '2000', 'in_site_bill': 'yes'})
        self.assertEqual(self._entries(), [])
        self._step('4A-EV', {'ev_kwh': '2000', 'in_site_bill': 'no'})
        self.assertEqual(self._by_step(), {'4A-EV': [('turkey-grid', 2000.0, 800.0)]})

    def test_supplier_factor_of_the_reporting_year_replaces_the_generic_one(self):
        self._factor('turkey-grid', 'kwh', 0.4, scope='scope2', country='turkey')
        self._step('4A-1', {'1': '1000 kWh'})
        self._step('4A-EF', 'yes')
        self._step('4A-EF-a', {'ef_value': '0.3', 'ef_unit': 'kgCO2e_kWh', 'ef_source': 'XYZ', 'ef_year': '2024'})
        self.assertEqual(self._by_step()['4A-1'], [('turkey-grid', 1000.0, 400.0)])  # other year
        self._step('4A-EF-a', {'ef_value': '300', 'ef_unit': 'kgCO2e_MWh', 'ef_source': 'XYZ', 'ef_year': '2025'})
        self.assertEqual(self._by_step()['4A-1'], [('calculated-scope2-x', 300.0, 300.0)])  # same scope & category

    def test_electricity_of_each_facility_is_its_own_entry(self):
        from companies.models import Facility
        gebze = Facility.objects.create(company=self.company, name='Gebze Fabrika')
        self._factor('turkey-grid', 'kwh', 0.4, scope='scope2', country='turkey')
        self._step('2A-2', {'1': {'name': 'Gebze Fabrika', 'country': 'TR'},
                            '2': {'name': 'Depo', 'country': 'TR'}})
        self._step('4A-1', {'1': '1000 kWh', '2': '500 kWh', '3': '0 kWh'})
        rows = sorted((e.facility.name, e.description, float(e.quantity)) for e in self._entries())
        # same total as one 1.500 kWh entry, each on its facility
        self.assertEqual(rows, [('Depo', 'Questionnaire step 4A-1 · Depo', 500.0),
                                ('Gebze Fabrika', 'Questionnaire step 4A-1 · Gebze Fabrika', 1000.0)])
        self.assertEqual(Facility.objects.get(name='Gebze Fabrika').pk, gebze.pk)
        # a supplier factor applies to the electricity of every facility
        self._step('4A-EF', 'yes')
        self._step('4A-EF-a', {'ef_value': '0.3', 'ef_unit': 'kgCO2e_kWh', 'ef_source': 'XYZ', 'ef_year': '2025'})
        self.assertEqual(sorted(self._by_step()['4A-1']),
                         [('calculated-scope2-x', 150.0, 150.0), ('calculated-scope2-x', 300.0, 300.0)])

    def test_backfill_splits_an_old_combined_entry_keeping_its_approval(self):
        from django.core.management import call_command
        from companies.models import Facility
        from emissions.models import EmissionEntry
        gebze = Facility.objects.create(company=self.company, name='Gebze Fabrika')
        factor = self._factor('turkey-grid', 'kwh', 0.4, scope='scope2', country='turkey')
        self._step('2A-2', {'1': {'name': 'Gebze Fabrika', 'country': 'TR'}, '2': {'name': 'Depo', 'country': 'TR'}})
        self._step('4A-1', {'1': '1000 kWh', '2': '500 kWh'})
        # as an earlier version saved it: one entry for both facilities
        EmissionEntry.objects.filter(company=self.company).delete()
        old = EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=factor, year=2025,
                                           month=1, quantity=1500, description='Questionnaire step 4A-1',
                                           status='approved', approved_by=self.user)
        call_command('backfill_calc_detail', stdout=__import__('io').StringIO())
        rows = sorted((e.facility.name, float(e.quantity), e.status, e.approved_by_id) for e in self._entries())
        self.assertEqual(rows, [('Depo', 500.0, 'approved', self.user.id),
                                ('Gebze Fabrika', 1000.0, 'approved', self.user.id)])
        self.assertEqual(Facility.objects.get(name='Gebze Fabrika').pk, gebze.pk)
        self.assertFalse(EmissionEntry.objects.filter(pk=old.pk).exists())
        # a second run changes nothing
        ids = [e.id for e in self._entries()]
        call_command('backfill_calc_detail', stdout=__import__('io').StringIO())
        self.assertEqual([e.id for e in self._entries()], ids)

    def test_renaming_a_facility_in_settings_keeps_its_entries_linked(self):
        from companies.models import Facility
        from emissions.models import EmissionEntry
        from questionnaire.models import ReportStep
        self._factor('turkey-grid', 'kwh', 0.4, scope='scope2', country='turkey')
        self._factor('natural-gas-m3', 'm3', 2.0, scope='scope1', country='turkey')
        self._step('2A-2', {'1': {'name': 'Gebze Fabrika', 'country': 'TR'}, '2': {'name': 'Depo', 'country': 'TR'}})
        self._step('4A-1', {'1': '1000 kWh', '2': '500 kWh'})
        gebze = Facility.objects.get(company=self.company, name='Gebze Fabrika')
        r = self.client.patch(f'/api/companies/facilities/{gebze.id}/', {'name': 'Gebze Tesisi'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        answer = ReportStep.objects.get(report=self.report, step_id='2A-2').answer
        self.assertEqual(answer['answer']['1']['name'], 'Gebze Tesisi')
        entry = EmissionEntry.objects.get(company=self.company, facility=gebze)
        self.assertEqual(entry.description, 'Questionnaire step 4A-1 · Gebze Tesisi')
        # another answer saved afterwards: the electricity stays as it was
        ids = sorted(e.id for e in EmissionEntry.objects.filter(company=self.company, description__contains='4A-1'))
        self._step('3A-5', {'natural_gas': '100 m³'})
        self.assertEqual(sorted(e.id for e in EmissionEntry.objects.filter(
            company=self.company, description__contains='4A-1')), ids)
        self.assertEqual(EmissionEntry.objects.get(pk=entry.pk).facility_id, gebze.id)

    def test_chat_answers_for_the_facility_asked_about(self):
        from companies.models import Facility
        from chat.local_answers import local_data_answer
        Facility.objects.create(company=self.company, name='Gebze Fabrika')
        self._factor('turkey-grid', 'kwh', 0.4, scope='scope2', country='turkey')
        self._factor('natural-gas-m3', 'm3', 2.0, scope='scope1', country='turkey')
        self._step('2A-2', {'1': {'name': 'Gebze Fabrika', 'country': 'TR'}, '2': {'name': 'Depo', 'country': 'TR'}})
        self._step('4A-1', {'1': '1000 kWh', '2': '500 kWh'})
        self._step('3A-5', {'natural_gas': '100 m³'})   # asked for the company, not per facility
        text = local_data_answer(self.user, '2025 yılında Gebze Fabrika tesisinin emisyonu ne kadar?', 'tr')
        self.assertIn('Gebze Fabrika tesisinin 2025 emisyonu **0,40 tCO₂e**', text)
        self.assertIn('tesis bazında değil şirket geneli için girildiğinden', text)

    def test_purchased_goods_usd_material_and_declarations(self):
        self._factor('legal-accounting', 'usd', 0.13)
        self._factor('plastic', 'kg', 3.1, country='turkey')
        self._step('K3C1-2', {'SC-07': '1000 USD', 'SC-09': '5000 TL', 'SC-01': '9 USD'})
        self._step('K3C1-3a', {'SC-01': '2 ton', 'SC-02': '50 kg'})
        self.assertEqual(self._by_step(), {'K3C1-2': [('legal-accounting', 1000.0, 130.0)]})
        self._step('K3C1-3m', {'SC-01': 'plastic', 'SC-02': 'other'})
        self.assertEqual(self._by_step()['K3C1-3a'], [('plastic', 2000.0, 6200.0)])
        self._step('K3C1-4a', {'items': [{'category': 'SC-01', 'supplier': 'Kimya', 'value': '4',
                                          'unit': 'tCO2e_total', 'year': '2025'}]})
        got = self._by_step()
        self.assertEqual(got['K3C1-4a'], [('calculated-scope3-purchased_goods', 4000.0, 4000.0)])
        self.assertNotIn('K3C1-3a', got)  # the declaration replaces SC-01's quantity

    def test_travel_hotel_turkey_and_no_rfi_multiplier(self):
        self._factor('hotel-turkey', 'nights', 32.1, country='turkey')
        self._factor('flight-long-business', 'person-km', 0.429)
        self._factor('flight-short-economy', 'person-km', 0.255)
        self._step('K3C6-2', {'items': [
            {'travel_mode': 'BT-10', 'quantity': '3', 'hotel_class': 'luxury'},
            {'travel_mode': 'BT-03', 'quantity': '1000', 'cabin_class': 'business', 'rfi_applied': True},
            {'travel_mode': 'BT-11', 'quantity': '1000', 'cabin_class': 'economy'},
            {'travel_mode': 'BT-11', 'quantity': '500', 'cabin_class': 'business'},
            {'travel_mode': 'BT-02', 'quantity': '1000', 'cabin_class': 'first'}]})
        # 3–6 h: short-haul on the distance, economy only (no short-haul business factor)
        self.assertEqual(sorted(self._by_step()['K3C6-2']),
                         [('flight-long-business', 1000.0, 429.0), ('flight-short-economy', 1000.0, 255.0),
                          ('hotel-turkey', 3.0, 96.3)])

    def test_level_question_decides_which_answers_count(self):
        self._factor('wt-01-landfill', 'kg', 1.29)
        self._factor('landfill', 'kg', 0.54, country='turkey')
        self._step('K3C5-2', {'items': [{'waste_type': 'WT-01', 'quantity_kg': '100', 'disposal_method': 'landfill'}]})
        self._step('K3C5-2b', '1000')
        self._step('K3C5-1', 'S2_total')
        self.assertEqual(self._by_step(), {'K3C5-2b': [('landfill', 1000.0, 540.0)]})

    def test_franchises_reported_total_and_pcaf(self):
        self._step('K3C14-0', 'yes')
        self._step('K3C14-1', {'franchise_count': '12', 'reporting_count': '8', 'total_tco2e': '340.5'})
        self._step('K3C15-1', {'items': [
            {'asset_class': 'VA-01', 'investment_amount': '5000000', 'company_value': '40000000',
             'company_debt': '10000000', 'ghg_report_available': True, 'company_emissions_tco2e': '1200'},
            {'asset_class': 'VA-05', 'investment_amount': '1', 'company_value': '2',
             'ghg_report_available': True, 'company_emissions_tco2e': '1'}]})
        got = self._by_step()
        self.assertEqual(got['K3C14-1'], [('calculated-scope3-franchises', 340500.0, 340500.0)])
        self.assertEqual(got['K3C15-1'], [('calculated-scope3-investments', 120000.0, 120000.0)])
        desc = [e.description for e in self._entries()]
        self.assertIn('Questionnaire step K3C14-1 · 340,5 tCO2e · 8/12 işletme raporlu', desc)

    def test_save_says_what_it_added_and_what_is_not_calculated(self):
        self._factor('motorin-mobile', 'liters', 2.5, scope='scope1', country='turkey')
        self._step('3B-5', {'EQ-3B-01': 'diesel', 'EQ-3B-05': 'diesel'})
        self._step('3B-6', {'EQ-3B-01': 'fuel_litres', 'EQ-3B-05': 'annual_km'})
        r = self._step('3B-7', {'EQ-3B-01': '1000 litre', 'EQ-3B-05': '8000 km'})
        fb = r.data['calc_feedback']
        self.assertEqual((fb['delta_kg'], fb['total_kg']), (2500.0, 2500.0))
        self.assertEqual(len(fb['notes']), 1)
        self.assertIn('EQ-3B-05: km is only calculated for passenger cars', fb['notes'][0])
        # and the inventory's assumptions list it as a data gap
        from .assumptions import report_assumptions
        gaps = [a for a in report_assumptions(self.report, 'tr') if a['text'].startswith('Hesaplanmayan cevap')]
        self.assertEqual([(a['step_id'], a['type']) for a in gaps], [('3B-7', 'A')])

    def test_supplier_document_of_another_year_is_reported(self):
        self._step('4A-EF', 'yes')
        r = self._step('4A-EF-a', {'ef_value': '0.3', 'ef_unit': 'kgCO2e_kWh', 'ef_source': 'XYZ', 'ef_year': '2023'})
        self.assertIn('is not the reporting year (2025)', r.data['calc_feedback']['notes'][0])

    def test_biomass_by_type_and_biogenic_co2_apart(self):
        from .step_entries import biogenic_co2_kg
        from .models import ReportStep
        self._factor('wood-pellets', 'kg', 0.01553, scope='scope1')
        self._step('3A-5', {'biomass': '2 ton', 'other_fossil': '100 litre'})
        self.assertEqual(self._entries(), [])  # type not chosen yet
        r = self._step('3A-5bio', 'wood_pellets')
        self.assertEqual(self._by_step()['3A-5'], [('wood-pellets', 2000.0, 31.06)])  # CH4 + N2O only
        answers = dict(ReportStep.objects.filter(report=self.report).values_list('step_id', 'answer'))
        self.assertAlmostEqual(biogenic_co2_kg(answers), 3354.36)  # 2 000 kg × 1,67718, not in the totals
        self.assertEqual(r.data['calc_feedback']['biogenic_kg'], 3354.36)
        notes = self._step('3A-5', {'biomass': '2 ton', 'other_fossil': '100 litre'}).data['calc_feedback']['notes']
        self.assertTrue(any(n.startswith('Other fossil fuel') for n in notes))
        # biogas is entered in kWh
        self._step('3A-5bio', 'biogas')
        self.assertNotIn('3A-5', self._by_step())

    def test_unchanged_entries_keep_their_approval(self):
        from emissions.models import EmissionEntry
        self._factor('turkey-grid', 'kwh', 0.4, scope='scope2', country='turkey')
        self._step('4A-1', {'1': '1000 kWh'})
        EmissionEntry.objects.update(status='draft')  # e.g. waiting on someone
        entry = self._entries()[0]
        self._step('K3C8-0', 'no')
        self.assertEqual([(e.id, e.status) for e in self._entries()], [(entry.id, 'draft')])



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


class PendingChangeTests(TestCase):
    """A data-entry member's change waits next to the approved value it
    would replace; approving it replaces that value."""

    def setUp(self):
        from rest_framework.test import APIClient
        from emissions.models import EmissionFactor
        self.owner = User.objects.create_user('ow9', 'ow9@test.com', 'pass12345')
        self.clerk = User.objects.create_user('de9', 'de9@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Pend Co', tax_number='9',
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
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.owner, reporting_year=2025)
        self.c_owner, self.c_clerk = APIClient(), APIClient()
        self.c_owner.force_authenticate(user=self.owner)
        self.c_clerk.force_authenticate(user=self.clerk)

    def _save(self, client, answer):
        r = client.patch(f'/api/questionnaire/{self.report.id}/step/',
                         {'step': '4A-1', 'data': {'answer': answer}, 'language': 'tr'}, format='json')
        self.assertEqual(r.status_code, 200)
        return r.data['calc_feedback']

    def _rows(self):
        from emissions.models import EmissionEntry
        return sorted((e.status, float(e.quantity)) for e in EmissionEntry.objects.filter(company=self.company))

    def test_change_waits_next_to_the_approved_value(self):
        from accounts.models import Notification
        from emissions.models import EmissionEntry
        self._save(self.c_owner, {'1': '1000 kWh', '2': '500 kWh'})
        # each facility of the loop is saved on its own
        self._save(self.c_clerk, {'1': '1200 kWh'})
        fb = self._save(self.c_clerk, {'1': '1200 kWh', '2': '500 kWh'})
        # one entry per facility of the loop; the answer's rows wait together
        self.assertEqual(self._rows(), [('approved', 500.0), ('approved', 1000.0),
                                        ('submitted', 500.0), ('submitted', 1200.0)])
        self.assertTrue(fb['pending'])
        self.assertEqual(fb['total_kg'], 600.0)  # still the approved value
        notes = Notification.objects.filter(user=self.owner, notification_type='entry_submitted')
        self.assertEqual(notes.count(), 1)  # one notice, kept up to date
        self.assertIn('→', notes[0].message)
        # the dashboard still counts the approved value
        s = self.c_owner.get('/api/emissions/summary/?year=2025').data
        self.assertAlmostEqual(float(s.get('total_kg', s.get('total_tonne', 0) * 1000)), 600.0, places=1)
        # the review list shows what the change replaces
        pending = self.c_owner.get('/api/emissions/pending/').data
        self.assertEqual(pending[0]['replaces']['co2e_kg'], 600.0)   # the answer's 1.500 kWh
        # approving replaces the old value
        new = EmissionEntry.objects.filter(status='submitted').first()
        self.c_owner.post(f'/api/emissions/entries/{new.id}/approve/', {'action': 'approve'}, format='json')
        self.assertEqual(self._rows(), [('approved', 500.0), ('approved', 1200.0)])

    def test_rejected_change_keeps_the_approved_value(self):
        from emissions.models import EmissionEntry
        self._save(self.c_owner, {'1': '1000 kWh'})
        self._save(self.c_clerk, {'1': '9000 kWh'})
        new = EmissionEntry.objects.get(status='submitted')
        self.c_owner.post(f'/api/emissions/entries/{new.id}/approve/', {'action': 'reject', 'reason': 'x'}, format='json')
        self.assertEqual(self._rows(), [('approved', 1000.0), ('draft', 9000.0)])
        # setting the answer back clears the rejected change
        self._save(self.c_clerk, {'1': '1000 kWh'})
        self.assertEqual(self._rows(), [('approved', 1000.0)])

    def test_renamed_label_is_not_a_change(self):
        from emissions.models import EmissionEntry
        self._save(self.c_owner, {'1': '1000 kWh'})
        EmissionEntry.objects.update(description='Questionnaire step 4A-1 · old label')
        self.c_clerk.patch(f'/api/questionnaire/{self.report.id}/step/',
                           {'step': 'K3C8-0', 'data': {'answer': 'no'}}, format='json')
        self.assertEqual(self._rows(), [('approved', 1000.0)])
        self.assertEqual(EmissionEntry.objects.get().description, 'Questionnaire step 4A-1')

    def test_others_saves_do_not_approve_a_waiting_change(self):
        self._save(self.c_owner, {'1': '1000 kWh'})
        self._save(self.c_clerk, {'1': '1200 kWh'})
        self.c_owner.patch(f'/api/questionnaire/{self.report.id}/step/',
                           {'step': 'K3C8-0', 'data': {'answer': 'no'}}, format='json')
        self.assertEqual(self._rows(), [('approved', 1000.0), ('submitted', 1200.0)])


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

    def test_entry_cannot_be_deleted_here_either(self):
        r = self.c_owner.delete(f'/api/emissions/entries/{self.entry.id}/')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data['code'], 'edit_in_questionnaire')
        from emissions.models import EmissionEntry
        self.assertTrue(EmissionEntry.objects.filter(id=self.entry.id).exists())

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

    def test_same_name_for_two_facilities_is_rejected(self):
        answer = {'answer': {
            '1': {'name': 'Fabrika', 'country': 'TR'},
            '2': {'name': 'fabrika ', 'country': 'TR'},
        }}
        res = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                                {'step': '2A-2', 'data': answer, 'language': 'tr'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'duplicate_facility_name')
        self.assertIn('farklı bir ad', res.json()['error'])
        self.assertEqual(self._names(), [('Tesis 1', 'TR'), ('Depo Ankara', 'TR')])

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


class SupplierEFDocumentTests(TestCase):
    """The supplier EF document's year and source are checked server-side
    too, and the vehicle amount question (3B-7) is a known step."""

    def test_declaration_year_and_source(self):
        from .carboniq_validation import validate_generic_step
        ok = {'answer': {'ef_value': '0.2', 'ef_unit': 'kgCO2e_kWh', 'ef_source': 'XYZ Doğalgaz', 'ef_year': '2023'}}
        self.assertEqual(validate_generic_step('3A-EF-a', ok, lang='tr'), (True, None))
        bad_year = {'answer': {**ok['answer'], 'ef_year': '5'}}
        valid, msg = validate_generic_step('3A-EF-a', bad_year, lang='tr')
        self.assertFalse(valid)
        self.assertIn('4 haneli', msg)
        future = {'answer': {**ok['answer'], 'ef_year': '2999'}}
        self.assertFalse(validate_generic_step('3A-EF-a', future, lang='tr')[0])
        no_name = {'answer': {**ok['answer'], 'ef_source': '5'}}
        self.assertFalse(validate_generic_step('3B-EF-a', no_name, lang='tr')[0])

    def test_vehicle_amount_step(self):
        from .carboniq_validation import validate_generic_step
        self.assertEqual(validate_generic_step('3B-7', {'answer': {'EQ-3B-01': '12000 litre'}}, lang='tr'), (True, None))

    def test_gwp_reference_offers_ar5(self):
        from .carboniq_validation import validate_generic_step
        for ref in ('AR6', 'AR5', 'AR4'):
            self.assertEqual(validate_generic_step('3D-EF', {'answer': {'EQ-3D-01': ref}}, lang='tr'), (True, None))

    def test_scope2_and_cat1_declaration_forms(self):
        from .carboniq_validation import validate_generic_step
        elec = {'answer': {'ef_value': '0.41', 'ef_unit': 'kgCO2e_kWh', 'ef_source': 'XYZ Elektrik', 'ef_year': '2024'}}
        self.assertEqual(validate_generic_step('4A-EF-a', elec, lang='tr'), (True, None))
        self.assertFalse(validate_generic_step('4B-EF-a', {'answer': {**elec['answer'], 'ef_year': '24'}}, lang='tr')[0])
        pcf = {'answer': {'items': [{'category': 'SC-02', 'supplier': 'XYZ Ambalaj', 'value': '1.25', 'unit': 'kgCO2e_kg', 'year': '2024'}]}}
        self.assertEqual(validate_generic_step('K3C1-4a', pcf, lang='tr'), (True, None))
        self.assertEqual(validate_generic_step('K3C1-3a', {'answer': {'SC-01': '12000 kg'}}, lang='tr'), (True, None))

    def test_capital_year_load_factor_and_glec_report(self):
        from .carboniq_validation import validate_generic_step
        row = {'category': 'CG-01', 'purchase_year': '2025', 'spend_amount': '5000', 'currency': 'TL'}
        self.assertEqual(validate_generic_step('K3C2-1', {'answer': {'items': [row]}}, lang='tr'), (True, None))
        self.assertFalse(validate_generic_step('K3C2-1', {'answer': {'items': [{**row, 'purchase_year': '1000'}]}}, lang='tr')[0])
        ship = {'transport_mode': 'TM-01', 'load_tonne': '20', 'distance_km': '300', 'load_factor_pct': '60'}
        self.assertEqual(validate_generic_step('K3C4-2', {'answer': {'items': [ship]}}, lang='tr'), (True, None))
        valid, msg = validate_generic_step('K3C4-2', {'answer': {'items': [{**ship, 'load_factor_pct': '250'}]}}, lang='tr')
        self.assertFalse(valid)
        self.assertIn('0 ile 100', msg)
        glec = {'answer': {'provider': 'XYZ Lojistik', 'total_tco2e': '12.5', 'year': '2024'}}
        self.assertEqual(validate_generic_step('K3C4-2c', glec, lang='tr'), (True, None))

    def test_report_forms_and_modal_split_total(self):
        from .carboniq_validation import validate_generic_step
        rep = {'answer': {'provider': 'XYZ Geri Dönüşüm', 'total_tco2e': '3.2', 'year': '2024'}}
        self.assertEqual(validate_generic_step('K3C5-2c', rep, lang='tr'), (True, None))
        self.assertEqual(validate_generic_step('K3C6-2c', rep, lang='tr'), (True, None))
        split = {'car_pct': '40', 'transit_pct': '35', 'shuttle_pct': '15', 'walk_pct': '10'}
        self.assertEqual(validate_generic_step('K3C7-3', {'answer': split}, lang='tr'), (True, None))
        valid, msg = validate_generic_step('K3C7-3', {'answer': {k: '3' for k in split}}, lang='tr')
        self.assertFalse(valid)
        self.assertIn('%12', msg)

    def test_conditional_fields_and_cat10_form(self):
        from .carboniq_validation import validate_generic_step
        office = {'asset_type': 'KV-01', 'area_m2': '250', 'owner_declaration': True, 'declaration_kwh': '12000',
                  'declaration_energy': 'electricity'}
        self.assertEqual(validate_generic_step('K3C8-1', {'answer': {'items': [office]}}, lang='tr'), (True, None))
        # "Evet" on the owner declaration now needs the kWh
        self.assertFalse(validate_generic_step('K3C8-1', {'answer': {'items': [{**office, 'declaration_kwh': ''}]}}, lang='tr')[0])
        # …and which energy the kWh are (the factor depends on it)
        self.assertFalse(validate_generic_step('K3C8-1', {'answer': {'items': [{**office, 'declaration_energy': ''}]}}, lang='tr')[0])
        # no declaration: the hidden kWh field is not required
        self.assertEqual(validate_generic_step('K3C8-1', {'answer': {'items': [{'asset_type': 'KV-01', 'area_m2': '250', 'owner_declaration': False}]}}, lang='tr'), (True, None))
        # leased equipment has no floor area
        self.assertEqual(validate_generic_step('K3C8-1', {'answer': {'items': [{'asset_type': 'KV-04', 'owner_declaration': False}]}}, lang='tr'), (True, None))
        prod = {'product': 'Sülfürik asit', 'quantity': '120', 'unit': 'tonnes', 'processing_type': 'chemical'}
        self.assertFalse(validate_generic_step('K3C10-1', {'answer': {'items': [{**prod, 'processing_type': ''}]}}, lang='tr')[0])
        self.assertEqual(validate_generic_step('K3C10-1', {'answer': {'items': [prod, {**prod, 'product': 'Kostik'}]}}, lang='tr'), (True, None))
        # several leased assets / sold products, one row each
        self.assertEqual(validate_generic_step('K3C8-1', {'answer': {'items': [office, {'asset_type': 'KV-03', 'area_m2': '900', 'owner_declaration': False}]}}, lang='tr'), (True, None))
        sold = {'product_type': 'P-01', 'sales_volume': '500', 'sales_unit': 'units', 'use_lifetime_years': '10'}
        self.assertEqual(validate_generic_step('K3C11-1', {'answer': {'items': [sold]}}, lang='tr'), (True, None))
        # a lifetime of "2026" is a calendar year typed by mistake
        ok, msg = validate_generic_step('K3C11-1', {'answer': {'items': [{**sold, 'use_lifetime_years': '2026'}]}}, lang='tr')
        self.assertFalse(ok)
        self.assertIn('yıl sayısı', msg)

    def test_cat13_14_15_follow_up_fields(self):
        from .carboniq_validation import validate_generic_step
        asset = {'asset_description': 'Depo Ankara - 2. kat', 'tenant_data_available': True, 'tenant_kwh': '8000',
                 'tenant_energy': 'electricity'}
        self.assertEqual(validate_generic_step('K3C13-1', {'answer': {'items': [asset]}}, lang='tr'), (True, None))
        # tenant data "Evet" needs the kWh, "Hayır" needs the area
        self.assertFalse(validate_generic_step('K3C13-1', {'answer': {'items': [{**asset, 'tenant_kwh': ''}]}}, lang='tr')[0])
        no_data = {'asset_description': 'Ofis', 'tenant_data_available': False}
        self.assertFalse(validate_generic_step('K3C13-1', {'answer': {'items': [no_data]}}, lang='tr')[0])
        self.assertEqual(validate_generic_step('K3C13-1', {'answer': {'items': [{**no_data, 'area_m2': '300'}]}}, lang='tr'), (True, None))
        self.assertEqual(validate_generic_step('K3C14-1', {'answer': {'franchise_count': '12', 'reporting_count': '8', 'total_tco2e': '340'}}, lang='tr'), (True, None))
        # how many outlets reported is needed to show the coverage
        self.assertFalse(validate_generic_step('K3C14-1', {'answer': {'franchise_count': '12', 'total_tco2e': '340'}}, lang='tr')[0])
        self.assertFalse(validate_generic_step('K3C14-2', {'answer': {'franchise_count': '12'}}, lang='tr')[0])
        inv = {'asset_class': 'VA-01', 'investment_amount': '5000000', 'company_value': '50000000', 'ghg_report_available': True}
        # GHG report "Evet" now needs the company's emissions
        self.assertFalse(validate_generic_step('K3C15-1', {'answer': {'items': [inv]}}, lang='tr')[0])
        self.assertEqual(validate_generic_step('K3C15-1', {'answer': {'items': [{**inv, 'company_emissions_tco2e': '1200'}]}}, lang='tr'), (True, None))
        self.assertEqual(validate_generic_step('K3-TY-edit', {'answer': 'K3C13-0'}, lang='tr'), (True, None))

    def test_count_questions_accept_groups(self):
        from .carboniq_validation import validate_generic_step
        row = {'unit_count': '3', 'site': 'İstanbul', 'size_band': 'Orta', 'group_count': '2'}
        self.assertEqual(validate_generic_step('3B-3', {'answer': {'EQ-3B-01': row}}, lang='tr'), (True, None))
        # later per-type questions are answered per group ("EQ-3B-01#2")
        self.assertEqual(validate_generic_step('3B-5', {'answer': {'EQ-3B-01': 'diesel', 'EQ-3B-01#2': 'electric'}}, lang='tr'), (True, None))
        self.assertEqual(validate_generic_step('3D-4', {'answer': {
            'EQ-3D-01': {'refill_kg': '2'}, 'EQ-3D-01#2': {'refill_kg': '1', 'gas_type': 'R32'}}}, lang='tr'), (True, None))
        self.assertFalse(validate_generic_step('3D-4', {'answer': {'EQ-3D-01#2': {'refill_kg': '1', 'gas_type': 'XX'}}}, lang='tr')[0])

    def test_exclusion_source_question(self):
        from .carboniq_validation import validate_generic_step
        row = {'source': 'Kocaeli Ofis — kiralık', 'reason': 'not_controlled', 'share': 'lt1'}
        self.assertEqual(validate_generic_step('6A-1a', {'answer': {'items': [row]}}, lang='tr'), (True, None))
        self.assertEqual(validate_generic_step('6A-1a', {'answer': {'items': [row, {**row, 'source': 'Depo', 'share': '5_10'}]}}, lang='tr'), (True, None))
        # every row names its reason and estimated share
        self.assertFalse(validate_generic_step('6A-1a', {'answer': {'items': [{'source': 'Depo', 'reason': 'no_data'}]}}, lang='tr')[0])
        self.assertFalse(validate_generic_step('6A-1a', {'answer': {'items': [{**row, 'share': 'big'}]}}, lang='tr')[0])

    def test_stage6_7_exceptions_and_sign_off(self):
        from .carboniq_validation import validate_generic_step
        exc = {'exception_description': 'Ulusal faktör kullanıldı', 'materiality_pct': '2.5', 'justification': 'Beyan gelmedi'}
        # 6C-2 is repeatable now ("birden fazla istisna")
        self.assertEqual(validate_generic_step('6C-2', {'answer': {'items': [exc, {**exc, 'materiality_pct': '1'}]}}, lang='tr'), (True, None))
        self.assertFalse(validate_generic_step('6C-2', {'answer': {'items': [{**exc, 'materiality_pct': '150'}]}}, lang='tr')[0])
        sign = {'signatory_name': 'Ayşe Demir', 'signatory_title': 'Müdür', 'declaration_accepted': 'accepted'}
        self.assertEqual(validate_generic_step('7C-2', {'answer': sign}, lang='tr'), (True, None))
        self.assertFalse(validate_generic_step('7C-2', {'answer': {**sign, 'signatory_name': '123'}}, lang='tr')[0])
        self.assertEqual(validate_generic_step('7C-edit', {'answer': '3A-0'}, lang='tr'), (True, None))


class ISOReportDeclarationsTests(TestCase):
    """Stage 6/7 answers the questionnaire promises to put in the report."""

    def test_sign_off_assumptions_base_year_and_exceptions_in_pdf(self):
        import io
        from pypdf import PdfReader
        from .iso_report_pdf import generate_iso_report
        owner = User.objects.create_user('isodecl', 'isodecl@test.com', 'pass12345')
        company = Company.objects.create(
            legal_entity_name='Decl Co', tax_number='9',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=owner, company=company, role='owner')
        report = CarbonReport.objects.create(
            company=company, created_by=owner, reporting_year=2025,
            title='Decl', status=CarbonReport.Status.COMPLETED)
        steps = {
            '7C-2': {'signatory_name': 'Ayşe Demir', 'signatory_title': 'Sürdürülebilirlik Müdürü',
                     'declaration_accepted': 'accepted'},
            '6B-OV': {'answer': 'review_detail'},
            '6B-2': {'answer': 'uncertain'},
            '6B-3': {'answer': 'Ocak ayı tüketimi tahmin edildi.'},
            '6F-1': {'answer': ['facility_open']},
            '6F-2': {'answer': 'yes'},
            '6F-3': {'answer': 'recalculate_partial'},
            '6C-1': {'answer': 'multiple'},
            '6C-2': {'items': [
                {'exception_description': 'Birinci istisna', 'materiality_pct': '2.5', 'justification': 'a'},
                {'exception_description': 'İkinci istisna', 'materiality_pct': '1', 'justification': 'b'},
            ]},
        }
        for sid, ans in steps.items():
            ReportStep.objects.create(report=report, step_id=sid, answer=ans)
        pdf = generate_iso_report(report, lang='tr')
        text = ' '.join(' '.join(p.extract_text() for p in PdfReader(io.BytesIO(pdf)).pages).split())
        self.assertIn('Ayşe Demir — Sürdürülebilirlik Müdürü', text)
        self.assertIn('İmza tarihi', text)
        self.assertIn('Ocak ayı tüketimi tahmin edildi.', text)
        self.assertIn('etkinin yönü belirlenemiyor', text)
        self.assertIn('yeni tesis açılması', text)
        self.assertIn('kısmi yeniden hesaplama', text)
        self.assertIn('Birinci istisna', text)
        self.assertIn('İkinci istisna', text)
        self.assertIn('%2,5', text)


class AdvisorFlagsFollowAnswersTests(TestCase):
    """Pending advisor flags follow the current answers; reset touches one inventory."""

    def setUp(self):
        self.owner = User.objects.create_user('flagown', 'flagown@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Flag Co', tax_number='11',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.owner, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(
            company=self.company, created_by=self.owner, reporting_year=2025,
            title='Flags', status=CarbonReport.Status.IN_PROGRESS)

    def _save(self, step_id, answer):
        from .advisor_triggers import evaluate_advisor_triggers
        ReportStep.objects.update_or_create(report=self.report, step_id=step_id, defaults={'answer': answer})
        evaluate_advisor_triggers(self.report, step_id, answer)

    def _pending(self):
        from .models import AdvisorApproval
        return set(AdvisorApproval.objects.filter(report=self.report, status='pending')
                   .values_list('question_id', 'reason_code'))

    def test_flags_removed_or_updated_when_answers_change(self):
        from .models import AdvisorApproval
        self._save('6A-1', {'answer': 'yes'})
        self._save('6A-2', {'answer': 'no_data'})
        self._save('6A-4', {'answer': '10_20'})
        self.assertIn(('6A-4', '6c_medium_materiality'), self._pending())
        # a lower band no longer triggers its own flag
        self._save('6A-4', {'answer': 'lt1'})
        self.assertNotIn(('6A-4', '6c_medium_materiality'), self._pending())
        # "no exclusions" closes the branch: its old flags go
        self._save('6A-1', {'answer': 'none_flagged'})
        self.assertFalse({q for q, _ in self._pending()} & {'6A-2', '6A-4'})
        # facility count: the text follows the current number
        self._save('B4', {'number_of_facilities': 2})
        self._save('2A-2', {'answer': {'1': {'name': 'A', 'country': 'TR'}}})
        flag = AdvisorApproval.objects.get(report=self.report, reason_code='site_count_mismatch')
        self.assertIn('but 1 were entered', flag.description)
        self._save('2A-2', {'answer': {str(i): {'name': f'S{i}', 'country': 'TR'} for i in (1, 2, 3)}})
        flag.refresh_from_db()
        self.assertIn('but 3 were entered', flag.description)
        self._save('2A-2', {'answer': {str(i): {'name': f'S{i}', 'country': 'TR'} for i in (1, 2)}})
        self.assertNotIn(('2A-2', 'site_count_mismatch'), self._pending())

    def test_exclusion_rows_flag_entity_and_largest_band(self):
        from .models import AdvisorApproval
        self._save('6A-1', {'answer': 'yes'})
        rows = [{'source': 'Kocaeli Ofis', 'reason': 'not_controlled', 'share': 'lt1'},
                {'source': 'İzmir Depo', 'reason': 'no_data', 'share': '10_20'}]
        self._save('6A-1a', {'answer': {'items': rows}})
        self.assertIn(('6A-1a', '6a_entity_exclusion'), self._pending())
        self.assertIn(('6A-1a', '6c_medium_materiality'), self._pending())
        flag = AdvisorApproval.objects.get(report=self.report, question_id='6A-1a', reason_code='6c_medium_materiality')
        self.assertIn('İzmir Depo', flag.description)
        self._save('6A-1a', {'answer': {'items': [rows[0], {**rows[1], 'share': 'gt20'}]}})
        self.assertIn(('6A-1a', '6c_high_materiality'), self._pending())
        self.assertNotIn(('6A-1a', '6c_medium_materiality'), self._pending())
        self._save('6A-1a', {'answer': {'items': [rows[0]]}})
        self.assertEqual({r for q, r in self._pending() if q == '6A-1a'}, {'6a_entity_exclusion'})
        self._save('6A-1', {'answer': 'none_flagged'})
        self.assertFalse({q for q, _ in self._pending()} & {'6A-1a'})

    def test_assumptions_derived_from_answers(self):
        from rest_framework.test import APIClient
        from .assumptions import derive_assumptions
        self.assertEqual(derive_assumptions({'3A-6': {'answer': {'natural_gas': 'invoice_meter'}}}), [])
        self._save('3A-6', {'answer': {'natural_gas': 'engineering_estimate', 'lpg': 'invoice_meter'}})
        self._save('3B-6', {'answer': {'EQ-3B-01': 'annual_km', 'EQ-3B-05': 'fuel_litres'}})
        self._save('4A-2a', {'answer': 'no'})
        self._save('K3C4-2', {'answer': {'items': [
            {'transport_mode': 'TM-01', 'load_tonne': '20', 'distance_km': '300', 'load_factor_pct': '60'},
            {'transport_mode': 'TM-03', 'load_tonne': '2', 'distance_km': '80'}], 'draft': {}}})
        self._save('K3C7-0', {'answer': 'estimate'})
        c = APIClient(); c.force_authenticate(user=self.owner)
        res = c.get(f'/api/questionnaire/{self.report.id}/assumptions/')
        self.assertEqual(res.status_code, 200)
        by_step = {a['step_id']: a for a in res.data['assumptions']}
        self.assertEqual(set(by_step), {'3A-6', '3B-6', '4A-2a', 'K3C4-2', 'K3C7-0'})
        self.assertIn('Doğalgaz', by_step['3A-6']['text'])
        self.assertNotIn('LPG', by_step['3A-6']['text'])
        self.assertIn('1 araç', by_step['3B-6']['text'])
        self.assertIn('1 satır', by_step['K3C4-2']['text'])
        res = c.get(f'/api/questionnaire/{self.report.id}/assumptions/?lang=en')
        self.assertIn('Natural gas', res.data['assumptions'][0]['text'])

    def test_decided_flags_are_kept(self):
        from .models import AdvisorApproval
        self._save('6A-4', {'answer': 'gt20'})
        AdvisorApproval.objects.filter(report=self.report).update(status='approved')
        self._save('6A-4', {'answer': 'lt1'})
        self.assertTrue(AdvisorApproval.objects.filter(report=self.report, status='approved').exists())

    def test_restart_clears_only_this_inventory(self):
        from rest_framework.test import APIClient
        other = CarbonReport.objects.create(
            company=self.company, created_by=self.owner, reporting_year=2024,
            title='Other', status=CarbonReport.Status.IN_PROGRESS)
        ReportStep.objects.create(report=other, step_id='A1', answer={'answer': 'x'})
        self._save('6A-4', {'answer': 'gt20'})
        c = APIClient(); c.force_authenticate(user=self.owner)
        res = c.post(f'/api/questionnaire/{self.report.id}/restart/')
        self.assertEqual(res.status_code, 200)
        self.report.refresh_from_db(); other.refresh_from_db()
        self.assertEqual(self.report.current_step, 'A1')
        self.assertEqual(self.report.status, CarbonReport.Status.IN_PROGRESS)
        self.assertFalse(ReportStep.objects.filter(report=self.report).exists())
        self.assertFalse(self._pending())
        self.assertEqual(other.status, CarbonReport.Status.IN_PROGRESS)
        self.assertTrue(ReportStep.objects.filter(report=other).exists())

    def test_profile_counts_by_stage(self):
        from .report_pdf import _answered_by_stage
        counts = _answered_by_stage({'A1', '2A-1', 'TY-1', 'K3C1-0', 'K3-TY', '6A-1', '7C-2', '6-GİRİŞ'})
        self.assertEqual(counts, [1, 1, 1, 0, 2, 1, 1])


class NewInventoryYearTests(TestCase):
    """The reporting year is chosen when an inventory is created and carried along."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.owner = User.objects.create_user('yrown', 'yrown@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Year Co', tax_number='12',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.owner, company=self.company, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_year_on_create_previous_facilities_and_progress(self):
        prev = CarbonReport.objects.create(
            company=self.company, created_by=self.owner, reporting_year=2025,
            title='Prev', status=CarbonReport.Status.COMPLETED)
        ReportStep.objects.create(report=prev, step_id='A1', answer={'legal_name': 'Year Co'})
        ReportStep.objects.create(report=prev, step_id='2A-2', answer={'answer': {
            '2': {'name': 'Depo', 'country': 'TR'}, '1': {'name': 'Fabrika', 'country': 'TR'},
            '10': {'name': 'Ofis', 'country': 'DE'}}})
        res = self.client.post('/api/questionnaire/start/', {'title': 'Year Co 2024', 'force_new': True, 'reporting_year': 2024}, format='json')
        self.assertEqual(res.status_code, 201)
        rid = res.json()['report_id']
        self.assertEqual(CarbonReport.objects.get(id=rid).reporting_year, 2024)
        bad = self.client.post('/api/questionnaire/start/', {'force_new': True, 'reporting_year': 1800}, format='json')
        self.assertEqual(bad.status_code, 400)

        data = self.client.get(f'/api/questionnaire/{rid}/previous-profile/').json()
        self.assertEqual(data['current_reporting_year'], 2024)
        self.assertEqual([f['name'] for f in data['previous_facilities']], ['Fabrika', 'Depo', 'Ofis'])

        res = self.client.post(f'/api/questionnaire/{rid}/reuse-profile/',
                               {'reporting_year': 2024, 'progress': {'answered': 21, 'total': 131}}, format='json')
        self.assertEqual(res.status_code, 200)
        lst = {r['report_id']: r for r in self.client.get('/api/questionnaire/').json()['reports']}
        self.assertEqual((lst[rid]['progress']['completed'], lst[rid]['progress']['total']), (21, 131))

        # restarting forgets the old progress
        self.client.post(f'/api/questionnaire/{rid}/restart/')
        self.assertIsNone(CarbonReport.objects.get(id=rid).client_progress)

    def test_previous_stage2_answers_and_new_steps(self):
        from .carboniq_validation import validate_generic_step
        prev = CarbonReport.objects.create(
            company=self.company, created_by=self.owner, reporting_year=2025,
            title='Prev', status=CarbonReport.Status.COMPLETED)
        ReportStep.objects.create(report=prev, step_id='A1', answer={'legal_name': 'Year Co'})
        ReportStep.objects.create(report=prev, step_id='2A-2', answer={'answer': {
            '1': {'name': 'Fabrika', 'country': 'TR'}, '2': {'name': 'Depo', 'country': 'TR'}}})
        ReportStep.objects.create(report=prev, step_id='2A-3', answer={'answer': {'1': 'Üretim', '2': 'Depolama'}})
        ReportStep.objects.create(report=prev, step_id='2A-4', answer={'answer': {'name': 'Lojistik', 'country': 'TR'}})
        rid = self.client.post('/api/questionnaire/start/', {'force_new': True, 'reporting_year': 2024}, format='json').json()['report_id']
        data = self.client.get(f'/api/questionnaire/{rid}/previous-profile/').json()
        self.assertEqual(data['previous_facility_activities'], {'Fabrika': 'Üretim', 'Depo': 'Depolama'})
        self.assertEqual(data['previous_subsidiaries'], [{'name': 'Lojistik', 'country': 'TR'}])
        ok = lambda sid, ans: validate_generic_step(sid, {'answer': ans}, lang='tr')
        self.assertEqual(ok('2B-OC1a', {'items': [{'facility': 'Depo'}]}), (True, None))
        self.assertEqual(ok('2A-4', {'items': [{'name': 'Lojistik', 'country': 'TR'}, {'name': 'Kimya GmbH', 'country': 'DE'}]}), (True, None))

    def test_previous_equipment_selections_are_listed(self):
        prev = CarbonReport.objects.create(
            company=self.company, created_by=self.owner, reporting_year=2025,
            title='Prev', status=CarbonReport.Status.COMPLETED)
        ReportStep.objects.create(report=prev, step_id='A1', answer={'legal_name': 'Year Co'})
        ReportStep.objects.create(report=prev, step_id='3A-1', answer={'answer': ['EQ-3A-01']})
        ReportStep.objects.create(report=prev, step_id='3B-1', answer={'answer': ['EQ-3B-01', 'EQ-3B-05']})
        ReportStep.objects.create(report=prev, step_id='3A-5', answer={'answer': {'natural_gas': '5 m³'}})
        rid = self.client.post('/api/questionnaire/start/', {'force_new': True, 'reporting_year': 2024}, format='json').json()['report_id']
        data = self.client.get(f'/api/questionnaire/{rid}/previous-profile/').json()
        # Only the source lists, never the year's amounts.
        self.assertEqual(data['previous_selections'], {'3A-1': ['EQ-3A-01'], '3B-1': ['EQ-3B-01', 'EQ-3B-05']})
        self.assertEqual(data['previous_year'], 2025)

    def test_scope2_amounts_cannot_exceed_their_total(self):
        from .carboniq_validation import validate_generic_step
        ok = lambda sid, ans: validate_generic_step(sid, {'answer': ans}, lang='tr')
        self.assertEqual(ok('4A-2c', {'company_m2': '350', 'building_m2': '2400'}), (True, None))
        valid, msg = ok('4A-2c', {'company_m2': '3000', 'building_m2': '2400'})
        self.assertFalse(valid)
        self.assertIn('bina toplam alanından büyük olamaz', msg)
        gen = {'facility': 'Gebze Fabrika', 'production_kwh': '20000', 'grid_sales': True}
        self.assertEqual(ok('4A-3a', {**gen, 'grid_sales_kwh': '5000'}), (True, None))
        self.assertFalse(ok('4A-3a', {**gen, 'grid_sales_kwh': '25000'})[0])
        # No sales amount given: nothing to compare.
        self.assertEqual(ok('4A-3a', gen), (True, None))
        self.assertEqual(ok('4A-2s', {'items': [{'facility': 'Depo Ankara'}]}), (True, None))


    def test_scope3_cat1_optional_quantity_and_declarations(self):
        from .carboniq_validation import validate_generic_step
        ok = lambda sid, ans: validate_generic_step(sid, {'answer': ans}, lang='tr')
        # A category whose quantity is unknown is left blank.
        self.assertEqual(ok('K3C1-3a', {'SC-01': '500 ton', 'SC-08': ''}), (True, None))
        row = {'category': 'SC-01', 'supplier': 'X A.Ş.', 'value': '120', 'unit': 'tCO2e_total', 'year': '2024'}
        self.assertEqual(ok('K3C1-4a', {'items': [row, {**row, 'category': 'SC-10'}]}), (True, None))
        self.assertEqual(ok('K3C3-custom', {'factor_type': 'td_loss', 'value': '2.1', 'unit': '%', 'source': 'TEİAŞ 2024'}), (True, None))
        self.assertFalse(ok('K3C3-custom', {'factor_type': 'td_loss', 'value': '2.1', 'unit': '%'})[0])

    def test_other_waste_and_travel_need_a_description(self):
        from .carboniq_validation import validate_generic_step
        ok = lambda sid, ans: validate_generic_step(sid, {'answer': ans}, lang='tr')
        waste = {'waste_type': 'WT-99', 'quantity_kg': '5000', 'disposal_method': 'incineration'}
        self.assertFalse(ok('K3C5-2', {'items': [waste]})[0])
        self.assertEqual(ok('K3C5-2', {'items': [{**waste, 'other_desc': 'Kimyasal çamur'}]}), (True, None))
        self.assertEqual(ok('K3C5-2', {'items': [{**waste, 'waste_type': 'WT-01'}]}), (True, None))
        trip = {'travel_mode': 'BT-99', 'quantity': '300'}
        self.assertFalse(ok('K3C6-2', {'items': [trip]})[0])
        self.assertEqual(ok('K3C6-2', {'items': [{**trip, 'other_desc': 'Charter uçuş'}]}), (True, None))


class SignOffAndEditNoticeTests(TestCase):
    """The 7C-2 signature is for owner/admin/manager; edits by others to a
    completed inventory are reported to the owners and admins."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.owner = User.objects.create_user('signown', 'signown@test.com', 'pass12345')
        self.clerk = User.objects.create_user('signclerk', 'signclerk@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Sign Co', tax_number='77',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.owner, company=self.company, role='owner')
        CompanyMembership.objects.create(user=self.clerk, company=self.company, role='data_entry')
        self.report = CarbonReport.objects.create(
            company=self.company, created_by=self.owner, reporting_year=2024,
            title='Sign', status=CarbonReport.Status.COMPLETED)
        self.client_for = lambda u: (lambda c: (c.force_authenticate(user=u), c)[1])(APIClient())
        self.sign = {'signatory_name': 'Ayşe Demir', 'signatory_title': 'Müdür', 'declaration_accepted': 'accepted'}

    def _patch(self, user, step, answer):
        return self.client_for(user).patch(f'/api/questionnaire/{self.report.id}/step/',
                                           {'step': step, 'data': {'answer': answer}, 'language': 'tr'},
                                           format='json')

    def test_only_signers_can_sign(self):
        res = self._patch(self.clerk, '7C-2', self.sign)
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['code'], 'signature_role')
        self.assertFalse(ReportStep.objects.filter(report=self.report, step_id='7C-2').exists())
        res = self._patch(self.owner, '7C-2', self.sign)
        self.assertEqual(res.status_code, 200)
        saved = ReportStep.objects.get(report=self.report, step_id='7C-2').answer['answer']
        self.assertEqual(saved['confirmed_by'], 'signown@test.com')

    def test_edit_by_other_member_notifies_owner_once(self):
        from accounts.models import Notification
        self.assertEqual(self._patch(self.clerk, '3A-0', 'yes').status_code, 200)
        self.assertEqual(self._patch(self.clerk, '3B-0', 'no').status_code, 200)
        notes = Notification.objects.filter(user=self.owner)
        self.assertEqual(notes.count(), 1)
        self.assertIn('Kapsam 1', notes.first().message)
        self.assertIn('signclerk@test.com', notes.first().message)
        # saving the same answer again is not a change
        Notification.objects.filter(user=self.owner).delete()
        self.assertEqual(self._patch(self.clerk, '3A-0', 'yes').status_code, 200)
        self.assertFalse(Notification.objects.filter(user=self.owner).exists())
        self._patch(self.clerk, '3B-0', 'yes')
        self.assertEqual(Notification.objects.filter(user=self.owner).count(), 1)
        # the owner's own edits are not reported to themselves
        self._patch(self.owner, '3A-0', 'yes')
        self.assertFalse(Notification.objects.filter(user=self.clerk).exists())
        self.assertEqual(Notification.objects.filter(user=self.owner).count(), 1)


class PreviousProfileSourceTests(TestCase):
    def test_nearest_earlier_year_not_last_edited(self):
        from .views import _find_previous_profile_source
        owner = User.objects.create_user('srcown', 'srcown@test.com', 'pass12345')
        company = Company.objects.create(
            legal_entity_name='Src Co', tax_number='88',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        mk = lambda year, status: CarbonReport.objects.create(
            company=company, created_by=owner, reporting_year=year, title=str(year), status=status)
        r2025 = mk(2025, CarbonReport.Status.COMPLETED)
        r2024 = mk(2024, CarbonReport.Status.COMPLETED)
        draft2025 = mk(2025, CarbonReport.Status.IN_PROGRESS)
        for r in (r2025, r2024, draft2025):
            ReportStep.objects.create(report=r, step_id='A1', answer={'legal_name': 'Src Co'})
        r2024.title = 'edited'; r2024.save()  # touched last
        new = mk(2026, CarbonReport.Status.IN_PROGRESS)
        self.assertEqual(_find_previous_profile_source(new), r2025)
        # an inventory for an earlier year looks back, not forward
        old = mk(2023, CarbonReport.Status.IN_PROGRESS)
        self.assertIn(_find_previous_profile_source(old), (r2025, r2024, draft2025))


class InventoryHistoryTests(TestCase):
    """Inventory answers, their approval and targets appear in the company's
    change history (Settings → Geçmiş), in the reader's language."""

    setUp = PendingChangeTests.setUp
    _save = PendingChangeTests._save

    def _history(self, lang='tr'):
        return self.c_owner.get(f'/api/accounts/history/?lang={lang}').data

    def test_answer_change_and_approval_are_listed(self):
        from emissions.models import EmissionEntry
        self._save(self.c_owner, {'1': '1000 kWh'})
        self._save(self.c_clerk, {'1': '1200 kWh'})
        new = EmissionEntry.objects.get(status='submitted')
        self.c_owner.post(f'/api/emissions/entries/{new.id}/approve/', {'action': 'approve'}, format='json')
        rows = self._history()
        self.assertEqual([r['action'] for r in rows],
                         ['entry_approved', 'questionnaire_changed', 'questionnaire_changed'])
        approved, change, first = rows
        self.assertIn('2025 envanteri · Soru', change['detail'])
        self.assertIn('1.000 kWh → ', change['detail'])
        self.assertIn('1.200 kWh', change['detail'])
        self.assertEqual(change['status_after'], 'submitted')
        self.assertEqual(first['status_after'], 'approved')
        self.assertEqual(approved['status_before'], 'submitted')
        self.assertIn('1.200 kWh', approved['detail'])
        self.assertIn('2025 inventory · Question', self._history('en')[1]['detail'])

    def test_saving_the_same_answer_adds_nothing(self):
        self._save(self.c_owner, {'1': '1000 kWh'})
        self._save(self.c_owner, {'1': '1000 kWh'})
        # a data-entry member saving the approved value again: nothing changed either
        self._save(self.c_clerk, {'1': '1000 kWh'})
        self.assertEqual(len(self._history()), 1)

    def test_taking_back_a_waiting_change_is_listed_once(self):
        self._save(self.c_owner, {'1': '1000 kWh'})
        self._save(self.c_clerk, {'1': '1200 kWh'})
        self._save(self.c_clerk, {'1': '1000 kWh'})   # back to the approved value
        self._save(self.c_clerk, {'1': '1000 kWh'})
        rows = self._history()
        self.assertEqual(len(rows), 3)
        self.assertIn('1.200 kWh → ', rows[0]['detail'])
        self.assertEqual(rows[0]['status_after'], 'approved')

    def test_target_changes_are_listed(self):
        res = self.c_owner.post('/api/emissions/targets/', {
            'title': '2030 hedefi', 'base_year': 2024, 'target_year': 2030,
            'base_emissions_kg': 303333.3, 'target_reduction_percent': 30}, format='json')
        self.assertEqual(res.status_code, 201)
        self.c_owner.delete(f"/api/emissions/targets/{res.data['id']}/")
        rows = self._history()
        self.assertEqual([r['action'] for r in rows], ['target_deleted', 'target_created'])
        self.assertEqual(rows[1]['detail'], '2030 hedefi · baz 2024: 303,3 tCO₂e · 2030 yılına kadar %30,0 azaltım')

    def test_advisor_approval_is_listed(self):
        from .models import AdvisorApproval
        approval = AdvisorApproval.objects.create(
            report=self.report, question_id='K3C9-0', field_id='x', reason_code='scope3_not_applicable',
            trigger_category='Kapsam', risk_level='medium_high')
        res = self.c_owner.post(f'/api/questionnaire/advisor-approvals/{approval.id}/approve/',
                                {'action': 'approve'}, format='json')
        self.assertEqual(res.status_code, 200)
        row = self._history()[0]
        self.assertEqual(row['action'], 'advisor_approved')
        self.assertTrue(row['detail'].startswith('2025 envanteri · Soru '))

    def test_renaming_an_inventory(self):
        r = self.c_owner.patch(f'/api/questionnaire/{self.report.id}/title/', {'title': 'Pend Co 2025'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.report.refresh_from_db()
        self.assertEqual((self.report.title, self.report.reporting_year), ('Pend Co 2025', 2025))
        self.assertEqual(self._history()[0]['action'], 'inventory_renamed')
        # a data-entry member may not rename
        r = self.c_clerk.patch(f'/api/questionnaire/{self.report.id}/title/', {'title': 'X'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.c_owner.patch(f'/api/questionnaire/{self.report.id}/title/', {'title': ' '},
                                            format='json').status_code, 400)

