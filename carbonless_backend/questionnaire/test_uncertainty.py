"""Data quality: the source of each amount and the uncertainty of the inventory (questionnaire/uncertainty.py).

The formulas are the owner's specification; its worked example is checked here: electricity 250 t, invoice
(7 %), Turkish official grid factor (15 %) -> row 16.6 %, absolute 41.5 t."""
from decimal import Decimal
from math import sqrt

from django.contrib.auth.models import User
from django.core.management import call_command

from emissions.models import EmissionEntry, EmissionFactor
from .models import ReportStep
from .test_calc_baseline import SITES
from .test_factor_standards import _InventoryCase
from .test_signoff_lifecycle import _Base as _SignBase, _dump
from .models import CarbonReport
from .uncertainty import factor_percent, inventory_uncertainty, source_warning, step_source


class UncertaintyTests(_InventoryCase):
    def setUp(self):
        super().setUp()
        call_command('seed_factors', verbosity=0)

    def _step(self, step_id, answer, **extra):
        return self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                                 {'step': step_id, 'data': {'answer': answer, **extra}}, format='json')

    def _electricity(self, kwh='1000 kWh', **extra):
        self.assertEqual(self._step('2A-2', SITES).status_code, 200)
        return self._step('4A-1', {'1': kwh}, **extra)

    def _answers(self):
        return dict(ReportStep.objects.filter(report=self.report).values_list('step_id', 'answer'))

    def test_the_worked_example_of_the_specification(self):
        r = self._electricity('533049.04 kWh', data_source='invoice')          # x 0.469 = 250,000 kg
        self.assertEqual(r.status_code, 200, r.content)
        u = inventory_uncertainty(self.report)
        row = u['rows'][0]
        self.assertAlmostEqual(row['co2e_kg'], 250000, delta=1)
        self.assertEqual((row['source'], row['activity_percent'], row['factor_base_percent'], row['factor_addon_percent']),
                         ('invoice', 7.0, 15.0, 0.0))
        self.assertEqual(row['row_percent'], 16.55)                           # sqrt(7² + 15²)
        self.assertAlmostEqual(row['absolute_kg'], 41382, delta=5)            # the specification rounds to 41.5 t
        self.assertEqual(u['percent'], 16.55)
        self.assertAlmostEqual(u['high_kg'] - u['total_kg'], u['absolute_kg'], places=1)

    def test_the_source_travels_with_the_answer_and_is_kept(self):
        self.assertEqual(self._electricity(data_source='measurement').status_code, 200)
        self.assertEqual(ReportStep.objects.get(report=self.report, step_id='4A-1').answer['data_source'], 'measurement')
        self.assertEqual(self._step('4A-1', {'1': '2000 kWh'}).status_code, 200)   # a later save does not repeat it
        self.assertEqual(step_source(self._answers(), '4A-1'), 'measurement')

    def test_an_unknown_source_is_refused_in_both_languages(self):
        self.assertEqual(self._step('2A-2', SITES).status_code, 200)
        r = self._step('4A-1', {'1': '1000 kWh'}, data_source='guess')
        self.assertEqual((r.status_code, r.data['code']), (400, 'data_source'))
        self.assertIn('Invalid data source', r.data['error'])
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': '4A-1', 'language': 'tr', 'data': {'answer': {'1': '1000 kWh'}, 'data_source': 'guess'}}, format='json')
        self.assertIn('Geçersiz veri kaynağı', r.data['error'])
        self.assertFalse(ReportStep.objects.filter(report=self.report, step_id='4A-1').exists())

    def test_no_source_is_counted_as_an_estimate_and_said(self):
        self.assertEqual(self._electricity().status_code, 200)
        u = inventory_uncertainty(self.report)
        self.assertEqual(u['unspecified_steps'], ['4A-1'])
        self.assertEqual((u['rows'][0]['source'], u['rows'][0]['activity_percent']), ('', 20.0))
        self.assertEqual(u['rows'][0]['row_percent'], 25.0)                   # sqrt(20² + 15²)
        for lang, words in (('en', ('counted as an estimate', 'responsibility')), ('tr', ('tahmin', 'sorumluluğundadır'))):
            for w in words:
                self.assertIn(w, source_warning('', lang))
        self.assertIn('lowers the accuracy', source_warning('estimate', 'en'))
        self.assertIn('doğruluğunu düşürür', source_warning('estimate', 'tr'))

    def test_the_source_never_changes_the_emission(self):
        self.assertEqual(self._electricity(data_source='estimate').status_code, 200)
        before = list(EmissionEntry.objects.filter(inventory=self.report).values_list('calculated_co2e_kg', flat=True))
        r = self.client.post(f'/api/questionnaire/{self.report.id}/step-data-source/',
                             {'step': '4A-1', 'data_source': 'measurement'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(list(EmissionEntry.objects.filter(inventory=self.report).values_list('calculated_co2e_kg', flat=True)), before)
        self.assertEqual(before, [Decimal('469.0000')])
        # A measurement without its record is not accepted as one: it stays an estimate until the record is uploaded.
        self.assertEqual((r.data['source_state'], r.data['uncertainty']['percent']), ('measurement_no_document', 25.0))
        self.assertIn('no measurement record is uploaded', r.data['warning'])

    def test_the_source_endpoint_refuses_what_does_not_apply(self):
        post = lambda body: self.client.post(f'/api/questionnaire/{self.report.id}/step-data-source/', body, format='json')
        self.assertEqual(post({'step': 'A1', 'data_source': 'invoice'}).data['code'], 'not_a_calculating_step')
        self.assertEqual(post({'step': '4A-1', 'data_source': 'guess'}).data['code'], 'data_source')
        r = post({'step': '4A-1', 'data_source': 'invoice'})
        self.assertEqual((r.status_code, r.data['code']), (409, 'not_answered'))

    def test_factor_uncertainty_follows_source_and_unit(self):
        def f(**kw):
            return EmissionFactor(slug=kw.pop('slug', 'x'), source=kw.pop('source', 'defra_2024'), unit=kw.pop('unit', 'kg'))
        self.assertEqual(factor_percent(f(source='turkey_grid', unit='kwh')), (15.0, 15.0, 0.0))
        self.assertEqual(factor_percent(f(unit='liters')), (30.0, 30.0, 0.0))
        u, base, addon = factor_percent(f(unit='tonne-km'))
        self.assertEqual((round(u, 2), base, addon), (33.54, 30.0, 15.0))     # sqrt(30² + 15²)
        u, base, addon = factor_percent(f(unit='usd'))
        self.assertEqual((round(u, 2), base, addon), (39.05, 30.0, 25.0))     # sqrt(30² + 25²)
        self.assertEqual(factor_percent(f(slug='calculated-scope1-x', source='custom', unit='kgco2e'))[1], 30.0)

    def test_rows_combine_as_independent_and_a_row_above_60_is_flagged(self):
        self.choose('std_defra')
        self.assertEqual(self._electricity(data_source='invoice').status_code, 200)
        self.assertEqual(self._step('3A-0', 'yes').status_code, 200)
        self.assertEqual(self._step('3A-5', {'natural_gas': '10000 m³'}, data_source='estimate').status_code, 200)
        u = inventory_uncertainty(self.report)
        self.assertEqual(len(u['rows']), 2)
        self.assertAlmostEqual(u['absolute_kg'], sqrt(sum(r['absolute_kg'] ** 2 for r in u['rows'])), places=1)
        self.assertAlmostEqual(u['percent'], u['absolute_kg'] / u['total_kg'] * 100, places=1)
        gas = next(r for r in u['rows'] if r['step_id'] == '3A-5')
        self.assertEqual(gas['row_percent'], 36.06)                           # sqrt(20² + 30²)
        self.assertEqual(u['flagged'], [])
        self.assertEqual(u['row_flag_percent'], 60.0)

    def test_the_fuel_question_falls_back_to_the_existing_per_fuel_answer(self):
        answers = {'3A-5': {'answer': {'diesel': '1 litre'}}, '3A-6': {'answer': {'diesel': 'invoice_meter'}}}
        self.assertEqual(step_source(answers, '3A-5'), 'invoice')
        answers['3A-6'] = {'answer': {'diesel': 'invoice_meter', 'lpg': 'sector_average'}}
        self.assertEqual(step_source(answers, '3A-5'), 'estimate')
        answers['3A-5']['data_source'] = 'measurement'
        self.assertEqual(step_source(answers, '3A-5'), 'measurement')

    def test_the_summary_endpoint(self):
        self.assertEqual(self._electricity(data_source='invoice').status_code, 200)
        r = self.client.get(f'/api/questionnaire/{self.report.id}/uncertainty/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['percent'], 16.55)
        self.assertEqual([s['value'] for s in r.data['sources']], ['measurement', 'invoice', 'estimate'])
        self.assertEqual(r.data['sources'][2]['label_tr'], 'Tahmin')

    def test_the_iso_report_states_the_result_its_interval_and_the_unstated_sources(self):
        import io
        from pypdf import PdfReader
        from .iso_report_pdf import generate_iso_report
        from .models import CarbonReport

        def text(lang):
            pdf = generate_iso_report(CarbonReport.objects.get(pk=self.report.pk), lang=lang)
            return ' '.join(' '.join((p.extract_text() or '').split()) for p in PdfReader(io.BytesIO(pdf)).pages)
        self.assertEqual(self._electricity('100000 kWh').status_code, 200)        # 46.9 t, no source stated
        en, tr = text('en'), text('tr')
        self.assertIn('combined uncertainty of ±25.0 %', en)                       # sqrt(20² + 15²)
        self.assertRegex(en, r'the result lies between 35\.1\d and 58\.6\d t CO₂e')    # 46.9 t ± 25 %
        self.assertIn('did not state where the figure comes from', en)
        self.assertIn('birleşik belirsizliği ±%25,0', tr)
        self.assertIn('kaynağını belirtmemiştir', tr)
        r = self.client.post(f'/api/questionnaire/{self.report.id}/step-data-source/',
                             {'step': '4A-1', 'data_source': 'invoice'}, format='json')
        self.assertEqual(r.status_code, 200)
        en = text('en')
        self.assertIn('combined uncertainty of ±16.6 %', en)
        self.assertNotIn('did not state where the figure comes from', en)
        self.assertIn('100 % comes from invoices', en)


class AdvisorQueueTests(UncertaintyTests):
    """What needs a person goes to the advisor: a measurement record (UT-02), a source "other" (UT-04), a supplier
    declaration (UT-05), a row above 60 % (UT-03). While one waits the inventory cannot be signed."""

    def _source(self, **body):
        return self.client.post(f'/api/questionnaire/{self.report.id}/step-data-source/', {'step': '4A-1', **body}, format='json')

    def _upload(self, kind='measurement', name='meter.pdf', size=100, step='4A-1'):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return self.client.post(f'/api/questionnaire/{self.report.id}/step-document/', {
            'step': step, 'kind': kind, 'file': SimpleUploadedFile(name, b'x' * size, content_type='application/pdf')},
            format='multipart')

    def _items(self):
        from .models import AdvisorApproval
        return {(a.question_id, a.reason_code): a for a in AdvisorApproval.objects.filter(report=self.report)}

    def _decide(self, code, action, step='4A-1'):
        from .models import AdvisorApproval
        a = self._items()[(step, code)]
        a.status = AdvisorApproval.Status.APPROVED if action == 'approve' else AdvisorApproval.Status.REJECTED
        a.save()

    def test_a_measurement_counts_only_with_its_record_and_the_advisor_reviews_it(self):
        self.assertEqual(self._electricity(data_source='measurement').status_code, 200)
        self.assertEqual(self._items(), {})                                   # nothing to review without a document
        self.assertEqual(inventory_uncertainty(self.report)['rows'][0]['activity_percent'], 20.0)
        r = self._upload()
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data['source_state'], r.data['activity_percent']), ('pending', 1.0))
        self.assertEqual(r.data['pending'], ['ut02_measurement_document'])
        self.assertEqual([d['name'] for d in r.data['documents']], ['meter.pdf'])
        self.assertIn('UT-02', self._items()[('4A-1', 'ut02_measurement_document')].description)
        self._decide('ut02_measurement_document', 'reject')
        u = inventory_uncertainty(self.report)
        self.assertEqual((u['rows'][0]['source_state'], u['rows'][0]['activity_percent']), ('rejected', 20.0))
        self._decide('ut02_measurement_document', 'approve')
        self.assertEqual(inventory_uncertainty(self.report)['rows'][0]['row_percent'], 15.03)     # sqrt(1² + 15²)

    def test_documents_are_bounded_and_can_be_removed(self):
        self.assertEqual(self._electricity(data_source='measurement').status_code, 200)
        self.assertEqual(self._upload(name='virus.exe').data['code'], 'document_type')
        self.assertEqual(self._upload(size=10 * 1024 * 1024 + 1).data['code'], 'document_too_large')
        self.assertEqual(self._upload(kind='selfie').data['code'], 'document_kind')
        self.assertEqual(self._upload(step='A1').data['code'], 'not_a_calculating_step')
        doc = self._upload().data['documents'][0]
        r = self.client.get(f'/api/questionnaire/{self.report.id}/step-document/{doc["id"]}/')
        self.assertEqual(r.status_code, 200)
        r = self.client.delete(f'/api/questionnaire/{self.report.id}/step-document/?id={doc["id"]}')
        self.assertEqual((r.status_code, r.data['documents'], r.data['source_state']), (200, [], 'measurement_no_document'))
        self.assertEqual(self._items(), {})                                   # the pending review went with the record

    def test_other_needs_a_percentage_and_a_reason_and_goes_to_the_advisor(self):
        self.assertEqual(self._electricity().status_code, 200)
        for body, words in (({'data_source': 'other'}, 'Enter the uncertainty in per cent'),
                            ({'data_source': 'other', 'data_source_percent': 12}, 'Write the reason'),
                            ({'data_source': 'other', 'data_source_percent': 12, 'data_source_reason': 'short'}, 'at least 20 characters'),
                            ({'data_source': 'other', 'data_source_percent': 150, 'data_source_reason': 'x' * 30}, 'at most 100 %')):
            r = self._source(**body)
            self.assertEqual((r.status_code, r.data['code']), (400, 'data_source'), body)
            self.assertIn(words, r.data['error'])
        why = 'Sub-metered by the landlord; allocated by floor area share.'
        r = self._source(data_source='other', data_source_percent=12, data_source_reason=why)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual((r.data['source_state'], r.data['activity_percent'], r.data['pending']), ('pending', 12.0, ['ut04_other_source']))
        item = self._items()[('4A-1', 'ut04_other_source')]
        self.assertIn(why, item.description)
        self.assertEqual(inventory_uncertainty(self.report)['rows'][0]['row_percent'], 19.21)     # sqrt(12² + 15²)
        self._decide('ut04_other_source', 'approve')
        # A changed claim is a new claim: the earlier approval does not cover it.
        self.assertEqual(self._source(data_source='other', data_source_percent=3, data_source_reason=why).status_code, 200)
        self.assertEqual(self._items()[('4A-1', 'ut04_other_source')].status, 'pending')
        self._decide('ut04_other_source', 'reject')
        self.assertEqual(inventory_uncertainty(self.report)['rows'][0]['activity_percent'], 20.0)
        self.assertEqual(self._source(data_source='invoice').status_code, 200)
        self.assertEqual(ReportStep.objects.get(report=self.report, step_id='4A-1').answer,
                         {'answer': {'1': '1000 kWh'}, 'data_source': 'invoice'})         # the old percentage and reason are gone

    def test_a_supplier_declaration_makes_the_factor_a_declaration_once_approved(self):
        from emissions.models import EmissionFactor
        own = EmissionFactor(slug='calculated-scope2-electricity', source='custom', unit='kgco2e')
        self.assertEqual(factor_percent(own)[1], 30.0)
        self.assertEqual(factor_percent(own, supplier_declared=True)[1], 5.0)
        self.assertEqual(self._electricity().status_code, 200)
        self.assertEqual(self._upload(kind='supplier_declaration', name='declaration.pdf').status_code, 201)
        self.assertIn('UT-05', self._items()[('4A-1', 'ut05_supplier_declaration')].description)

    def test_a_value_stated_on_the_factor_is_used_as_it_is(self):
        from emissions.models import EmissionFactor
        f = EmissionFactor(slug='x', source='defra_2024', unit='tonne-km', uncertainty_percent=Decimal('7.00'))
        self.assertEqual(factor_percent(f), (7.0, 7.0, 0.0))

    def test_a_row_above_60_goes_to_the_advisor_and_leaves_when_it_is_no_longer_so(self):
        from emissions.models import EmissionFactor
        self.assertEqual(self._electricity(data_source='invoice').status_code, 200)
        factor = EmissionEntry.objects.filter(inventory=self.report).first().emission_factor
        EmissionFactor.objects.filter(pk=factor.pk).update(uncertainty_percent=Decimal('65'))
        self.assertEqual(self._source(data_source='estimate').status_code, 200)        # sqrt(20² + 65²) = 68 %
        item = self._items()[('4A-1', 'ut03_row_above_60')]
        self.assertEqual((item.status, item.risk_level), ('pending', 'high'))
        self.assertIn('UT-03', item.description)
        EmissionFactor.objects.filter(pk=factor.pk).update(uncertainty_percent=None)
        self.assertEqual(self._source(data_source='invoice').status_code, 200)
        self.assertNotIn(('4A-1', 'ut03_row_above_60'), self._items())

    def test_a_small_source_may_be_accepted_as_an_estimate_within_the_limit(self):
        self.choose('std_defra')
        self.assertEqual(self._electricity('1000 kWh').status_code, 200)             # 469 kg
        self.assertEqual(self._step('3A-0', 'yes').status_code, 200)
        self.assertEqual(self._step('3A-5', {'natural_gas': '100000 m³'}, data_source='invoice').status_code, 200)
        u = inventory_uncertainty(self.report)
        self.assertEqual(u['small_rows'], ['4A-1'])                                   # 0.2 % of the inventory, no source
        r = self._source(data_source='estimate', data_source_small=True)
        self.assertEqual(r.status_code, 200, r.content)
        u = inventory_uncertainty(self.report)
        self.assertEqual((u['small_rows'], u['unspecified_steps']), ([], []))
        self.assertGreater(u['accepted_small_share'], 0)
        r = self.client.post(f'/api/questionnaire/{self.report.id}/step-data-source/',
                             {'step': '3A-5', 'data_source': 'estimate', 'data_source_small': True}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (409, 'not_a_small_row'))
        self.assertIn('only sources under 1 %', r.data['error'])


class SignatureWaitsForTheAdvisorTests(_SignBase):
    def test_a_pending_item_holds_the_signature_and_the_signed_record_keeps_the_figures(self):
        from .models import AdvisorApproval
        from .uncertainty import signed_uncertainty
        report = self._ready()
        why = 'Allocated from the landlord\'s meter by floor area.'
        ReportStep.objects.update_or_create(report=report, step_id='3A-0', defaults={'answer': {'answer': 'yes'}})
        ReportStep.objects.update_or_create(report=report, step_id='3A-5', defaults={'answer': {
            'answer': {'natural_gas': '1000 m³'}, 'data_source': 'other', 'data_source_percent': 12.0, 'data_source_reason': why}})
        before = _dump(report)
        r = self._sign(report)
        self.assertEqual((r.status_code, r.data['code']), (400, 'data_quality_pending'), r.content)
        self.assertIn('waiting for the advisor', r.data['error_en'])
        self.assertIn('danışman onayı bekliyor', r.data['error_tr'])
        self.assertEqual(r.data['first_question'], '3A-5')
        self.assertIsNone(CarbonReport.objects.get(pk=report.pk).signed_at)
        AdvisorApproval.objects.filter(report=report, reason_code='ut04_other_source').update(status='approved')
        r = self._sign(report)
        self.assertEqual(r.status_code, 200, r.content)
        answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
        snap = signed_uncertainty(answers)
        self.assertIsNotNone(snap)
        self.assertEqual(set(snap) >= {'total_kg', 'percent', 'rows', 'low_kg', 'high_kg'}, True)


class AdvisorDecidesInTheAdminPanelTests(AdvisorQueueTests):
    """Data-quality items are the platform advisor's to decide, in the admin panel — not the company's."""

    def _other(self):
        self.assertEqual(self._electricity().status_code, 200)
        r = self._source(data_source='other', data_source_percent=12, data_source_reason='Allocated from the landlord meter by area.')
        self.assertEqual(r.status_code, 200, r.content)
        return self._items()[('4A-1', 'ut04_other_source')]

    def test_the_company_inbox_does_not_offer_them_and_a_company_user_cannot_decide_them(self):
        item = self._other()
        r = self.client.get('/api/questionnaire/advisor-approvals/pending/')
        self.assertEqual(r.status_code, 200)
        self.assertNotIn('ut04_other_source', [x['reason_code'] for x in r.data])
        r = self.client.post(f'/api/questionnaire/advisor-approvals/{item.pk}/approve/', {'action': 'approve'}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (403, 'advisor_only'))
        item.refresh_from_db()
        self.assertEqual(item.status, 'pending')

    def test_the_admin_action_decides_them_and_leaves_signed_inventories_alone(self):
        from django.contrib.admin.sites import site
        from django.contrib.messages.storage.fallback import FallbackStorage
        from django.test import RequestFactory
        from django.utils import timezone
        from .models import AdvisorApproval
        item = self._other()
        admin_user = User.objects.create_superuser('advisor', 'advisor@test.com', 'pass12345')
        request = RequestFactory().post('/admin/')
        request.user = admin_user
        request.session = {}
        request._messages = FallbackStorage(request)
        model_admin = site._registry[AdvisorApproval]
        model_admin.approve_selected(request, AdvisorApproval.objects.filter(pk=item.pk))
        item.refresh_from_db()
        self.assertEqual((item.status, item.reviewed_by), ('approved', admin_user))
        self.assertEqual(inventory_uncertainty(self.report)['rows'][0]['source_state'], 'ok')
        model_admin.reject_selected(request, AdvisorApproval.objects.filter(pk=item.pk))
        item.refresh_from_db()
        self.assertEqual(item.status, 'rejected')
        self.assertEqual(inventory_uncertainty(self.report)['rows'][0]['activity_percent'], 20.0)
        CarbonReport.objects.filter(pk=self.report.pk).update(signed_at=timezone.now())
        model_admin.approve_selected(request, AdvisorApproval.objects.filter(pk=item.pk))
        item.refresh_from_db()
        self.assertEqual(item.status, 'rejected')                             # a signed inventory's items stay as signed

    def test_the_other_advisor_rules_do_not_remove_a_data_quality_item(self):
        from .advisor_triggers import reconcile_advisor_approvals
        self._other()
        reconcile_advisor_approvals(self.report)
        self.assertIn(('4A-1', 'ut04_other_source'), self._items())
