"""
Fix 2 (local parser recognises MWh / bare tonnes / 'recycled') and
Fix 4 (bilingual, actionable graceful degradation when Groq is down).

Groq is never called here: the local parser, the resolver's dimensional
conversions, and the bilingual helper strings are exercised directly.
"""
from decimal import Decimal

from django.test import SimpleTestCase, TestCase

from chat.local_parser import try_local_emission_parse
from chat.local_answers import ai_unavailable_text
from chat.views import _emission_input_guidance


class Fix2LocalParserUnitTest(SimpleTestCase):
    """MWh, bare tonnes/ton and 'recycled' parse locally; freight tonne-km is
    not misread as plain mass."""

    def test_mwh_electricity(self):
        entry = try_local_emission_parse('we used 10 MWh of electricity')
        self.assertIsNotNone(entry)
        self.assertEqual(entry['fuel_type'], 'electricity')
        self.assertEqual(entry['unit'], 'mwh')
        self.assertEqual(entry['quantity'], 10)

    def test_tonnes_paper_waste_landfill(self):
        entry = try_local_emission_parse('2 tonnes of paper waste to landfill')
        self.assertIsNotNone(entry)
        self.assertEqual(entry['fuel_type'], 'waste_landfill')
        self.assertEqual(entry['unit'], 'tonne')
        self.assertEqual(entry['quantity'], 2)

    def test_recycled_waste(self):
        entry = try_local_emission_parse('we recycled 500 kg of waste')
        self.assertIsNotNone(entry)
        self.assertEqual(entry['fuel_type'], 'waste_recyclable')
        self.assertEqual(entry['unit'], 'kg')
        self.assertEqual(entry['quantity'], 500)

    def test_tonne_km_freight_still_freight(self):
        entry = try_local_emission_parse('5 tonne-km road freight')
        self.assertIsNotNone(entry)
        self.assertEqual(entry['unit'], 'tonne-km')
        self.assertEqual(entry['quantity'], 5)

    def test_bare_ton_short_form_not_a_unit(self):
        # The bare short form "ton" is intentionally NOT a parseable unit (it is
        # usually a rough count/typo); the full word "tonne(s)" is. This keeps the
        # long-standing "3 ton çelik -> ask the user" behaviour the chat tests pin.
        self.assertIsNone(try_local_emission_parse('2 ton of steel'))

    def test_tonne_singular_mass(self):
        entry = try_local_emission_parse('1 tonne of paper waste to landfill')
        self.assertIsNotNone(entry)
        self.assertEqual(entry['unit'], 'tonne')


class Fix2ConversionEquivalenceTest(TestCase):
    """MWh->kWh and tonne->kg yield the same co2e as the base unit."""

    def setUp(self):
        from emissions.models import EmissionFactor
        EmissionFactor.objects.create(
            slug='turkey-grid', name='Turkey Grid', name_tr='Türkiye Şebeke',
            scope='scope2', category='electricity', country='turkey',
            unit='kwh', factor_kg_co2e=Decimal('0.4199'), year=2023, source='atom_kablo',
            is_active=True, is_default=True,
        )
        EmissionFactor.objects.create(
            slug='general-landfill', name='General Landfill', name_tr='Düzenli Depolama',
            scope='scope3', category='waste', country='turkey',
            unit='kg', factor_kg_co2e=Decimal('0.45'), year=2023, source='generic',
            is_active=True, is_default=True,
        )

    def test_mwh_equals_kwh(self):
        from emissions.factor_lookup import resolve_factor_and_amount
        _f1, _q1, co2e_mwh, e1 = resolve_factor_and_amount('electricity', 10, 'mwh', None)
        _f2, _q2, co2e_kwh, e2 = resolve_factor_and_amount('electricity', 10000, 'kwh', None)
        self.assertIsNone(e1)
        self.assertIsNone(e2)
        self.assertEqual(co2e_mwh, co2e_kwh)

    def test_tonne_equals_kg(self):
        from emissions.factor_lookup import resolve_factor_and_amount
        _f1, _q1, co2e_tonne, e1 = resolve_factor_and_amount('waste_landfill', 2, 'tonne', None)
        _f2, _q2, co2e_kg, e2 = resolve_factor_and_amount('waste_landfill', 2000, 'kg', None)
        self.assertIsNone(e1)
        self.assertIsNone(e2)
        self.assertEqual(co2e_tonne, co2e_kg)


class Fix4GracefulDegradationTest(SimpleTestCase):
    """The guidance / outage helpers are bilingual and actionable, and the
    parser refuses no-amount / ambiguous messages (so no junk entry forms)."""

    def test_guidance_lists_formats_en(self):
        text = _emission_input_guidance('en')
        self.assertIn('14000 kWh of electricity', text)
        self.assertIn('10 MWh of electricity', text)
        self.assertIn('2 tonnes of paper waste to landfill', text)

    def test_guidance_lists_formats_tr(self):
        text = _emission_input_guidance('tr')
        self.assertIn('14000 kWh of electricity', text)
        self.assertIn('10 MWh of electricity', text)

    def test_ai_unavailable_actionable_en(self):
        for text in (ai_unavailable_text('en'), ai_unavailable_text('en', rate_limited=True)):
            self.assertIn('log emissions', text)
            self.assertIn('14000 kWh of electricity', text)

    def test_ai_unavailable_actionable_tr(self):
        for text in (ai_unavailable_text('tr'), ai_unavailable_text('tr', rate_limited=True)):
            self.assertIn('emisyon', text.lower())
            self.assertIn('14000 kWh of electricity', text)

    def test_no_amount_messages_do_not_parse(self):
        self.assertIsNone(try_local_emission_parse('we used electricity'))
        self.assertIsNone(try_local_emission_parse('we did some stuff'))
