"""Data quality: the source of each amount and the uncertainty of the inventory (questionnaire/uncertainty.py).

The formulas are the owner's specification; its worked example is checked here: electricity 250 t, invoice
(7 %), Turkish official grid factor (15 %) -> row 16.6 %, absolute 41.5 t."""
from decimal import Decimal
from math import sqrt

from django.core.management import call_command

from emissions.models import EmissionEntry, EmissionFactor
from .models import ReportStep
from .test_calc_baseline import SITES
from .test_factor_standards import _InventoryCase
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
        self.assertEqual(r.data['uncertainty']['percent'], 15.03)             # sqrt(1² + 15²)
        self.assertIn('±1 %', r.data['warning'])

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
