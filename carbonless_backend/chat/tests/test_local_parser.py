"""
Tests for chat.local_parser — covers all activity types, unit normalisation,
question detection, and edge cases.
"""
from django.test import SimpleTestCase

from chat.local_parser import (
    ACTIVITY_PATTERNS,
    normalise_unit,
    looks_like_question,
    detect_activity_type,
    try_local_emission_parse,
)


class NormaliseUnitTest(SimpleTestCase):
    def test_m3_variants(self):
        self.assertEqual(normalise_unit('m³'), 'm3')
        self.assertEqual(normalise_unit('m^3'), 'm3')
        self.assertEqual(normalise_unit('m3'), 'm3')

    def test_litre_variants(self):
        self.assertEqual(normalise_unit('liter'), 'liters')
        self.assertEqual(normalise_unit('litre'), 'liters')
        self.assertEqual(normalise_unit('litres'), 'liters')
        self.assertEqual(normalise_unit('l'), 'liters')
        self.assertEqual(normalise_unit('lt'), 'liters')

    def test_kwh_variants(self):
        self.assertEqual(normalise_unit('kw/h'), 'kwh')
        self.assertEqual(normalise_unit('kwh'), 'kwh')

    def test_tonne_variants(self):
        self.assertEqual(normalise_unit('ton'), 'tonne')
        self.assertEqual(normalise_unit('tons'), 'tonne')
        self.assertEqual(normalise_unit('tonnes'), 'tonne')

    def test_tkm(self):
        self.assertEqual(normalise_unit('tkm'), 'tonne-km')

    def test_passthrough(self):
        self.assertEqual(normalise_unit('kg'), 'kg')
        self.assertEqual(normalise_unit('km'), 'km')
        self.assertEqual(normalise_unit('gj'), 'gj')


class LooksLikeQuestionTest(SimpleTestCase):
    def test_question_mark(self):
        self.assertTrue(looks_like_question('How much CO2 from electricity?'))

    def test_question_words(self):
        self.assertTrue(looks_like_question('explain my carbon footprint'))
        self.assertTrue(looks_like_question('what is my total'))
        self.assertTrue(looks_like_question('nasıl azaltabilirim'))
        self.assertTrue(looks_like_question('چطور کاهش بدم'))

    def test_not_question(self):
        self.assertFalse(looks_like_question('18000 kwh electricity'))
        self.assertFalse(looks_like_question('500 liters diesel'))


class DetectActivityTypeTest(SimpleTestCase):
    """Test that each activity type can be detected from natural text."""

    # ── Energy / Fuels ────────────────────────────────────────────────────────
    def test_electricity(self):
        self.assertEqual(detect_activity_type('18000 kwh electricity'), 'electricity')
        self.assertEqual(detect_activity_type('5000 kwh elektrik'), 'electricity')

    def test_natural_gas(self):
        self.assertEqual(detect_activity_type('200 m3 natural gas'), 'natural_gas')
        self.assertEqual(detect_activity_type('150 m3 doğalgaz'), 'natural_gas')

    def test_diesel(self):
        self.assertEqual(detect_activity_type('300 liters diesel'), 'diesel')
        self.assertEqual(detect_activity_type('100 lt mazot'), 'diesel')

    def test_petrol(self):
        self.assertEqual(detect_activity_type('50 liters petrol'), 'petrol')
        self.assertEqual(detect_activity_type('40 lt benzin'), 'petrol')

    def test_lpg(self):
        self.assertEqual(detect_activity_type('80 liters lpg'), 'lpg')

    def test_coal(self):
        self.assertEqual(detect_activity_type('1000 kg coal'), 'coal')
        self.assertEqual(detect_activity_type('500 kg kömür'), 'coal')

    # ── Flights ───────────────────────────────────────────────────────────────
    def test_flight_domestic(self):
        self.assertEqual(detect_activity_type('800 km domestic flight'), 'flight_domestic')

    def test_flight_short_haul(self):
        self.assertEqual(detect_activity_type('1500 km short haul flight'), 'flight_short_haul')

    def test_flight_medium_haul(self):
        self.assertEqual(detect_activity_type('3500 km medium haul flight'), 'flight_medium_haul')

    def test_flight_long_haul(self):
        self.assertEqual(detect_activity_type('9000 km long haul flight'), 'flight_long_haul')

    # ── Freight ───────────────────────────────────────────────────────────────
    def test_truck_freight(self):
        self.assertEqual(detect_activity_type('5000 tonne-km truck freight'), 'truck_freight')

    def test_rail_freight(self):
        self.assertEqual(detect_activity_type('10000 tonne-km rail freight'), 'rail_freight')

    def test_sea_freight(self):
        self.assertEqual(detect_activity_type('20000 tonne-km sea freight'), 'sea_freight')

    def test_air_freight(self):
        self.assertEqual(detect_activity_type('3000 tonne-km air freight'), 'air_freight')

    # ── Waste ─────────────────────────────────────────────────────────────────
    def test_waste_landfill(self):
        self.assertEqual(detect_activity_type('200 kg landfill'), 'waste_landfill')

    def test_waste_recyclable(self):
        self.assertEqual(detect_activity_type('150 kg recyclable'), 'waste_recyclable')

    def test_waste_organic_compost(self):
        self.assertEqual(detect_activity_type('80 kg compost'), 'waste_organic_compost')

    def test_waste_incineration(self):
        self.assertEqual(detect_activity_type('120 kg incineration'), 'waste_incineration')

    # ── Employee Commuting ────────────────────────────────────────────────────
    def test_car_commute(self):
        self.assertEqual(detect_activity_type('30 km car commute'), 'employee_commuting_car_commute')

    def test_bus_commute(self):
        self.assertEqual(detect_activity_type('25 km bus commute'), 'employee_commuting_bus_commute')

    def test_train_commute(self):
        self.assertEqual(detect_activity_type('40 km train commute'), 'employee_commuting_train_commute')

    # ── Purchased Goods ───────────────────────────────────────────────────────
    def test_plastic(self):
        self.assertEqual(detect_activity_type('500 kg plastic'), 'purchased_goods_plastic_average')

    def test_paper(self):
        self.assertEqual(detect_activity_type('200 kg paper'), 'purchased_goods_paper_mixed')

    def test_glass(self):
        self.assertEqual(detect_activity_type('300 kg glass'), 'purchased_goods_glass')

    def test_steel(self):
        self.assertEqual(detect_activity_type('1000 kg steel'), 'purchased_goods_metal_steel')

    def test_aluminium(self):
        self.assertEqual(detect_activity_type('400 kg aluminium'), 'purchased_goods_metal_aluminium')
        self.assertEqual(detect_activity_type('400 kg aluminum'), 'purchased_goods_metal_aluminium')

    # ── Water ─────────────────────────────────────────────────────────────────
    def test_water_supply(self):
        self.assertEqual(detect_activity_type('100 m3 water supply'), 'water_water_supply')

    def test_water_treatment(self):
        self.assertEqual(detect_activity_type('80 m3 water treatment'), 'water_water_treatment')

    # ── Road Travel ───────────────────────────────────────────────────────────
    def test_road_travel(self):
        self.assertEqual(detect_activity_type('150 km road travel'), 'road_travel')

    # ── Fallback heuristics ───────────────────────────────────────────────────
    def test_kwh_fallback_to_electricity(self):
        self.assertEqual(detect_activity_type('5000 kwh'), 'electricity')

    def test_m3_gas_fallback(self):
        self.assertEqual(detect_activity_type('100 m3 gas'), 'natural_gas')

    def test_no_match(self):
        self.assertIsNone(detect_activity_type('hello world'))


class TryLocalEmissionParseTest(SimpleTestCase):
    """Integration tests for the full parse pipeline."""

    def test_electricity_kwh(self):
        result = try_local_emission_parse('18000 kwh electricity')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'electricity')
        self.assertEqual(result['quantity'], 18000.0)
        self.assertEqual(result['unit'], 'kwh')

    def test_natural_gas_m3(self):
        result = try_local_emission_parse('200 m3 natural gas')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'natural_gas')
        self.assertEqual(result['quantity'], 200.0)
        self.assertEqual(result['unit'], 'm3')

    def test_diesel_liters(self):
        result = try_local_emission_parse('300 liters diesel')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'diesel')
        self.assertEqual(result['quantity'], 300.0)
        self.assertEqual(result['unit'], 'liters')

    def test_petrol_liters(self):
        result = try_local_emission_parse('50 liters petrol')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'petrol')
        self.assertEqual(result['quantity'], 50.0)
        self.assertEqual(result['unit'], 'liters')

    def test_lpg_liters(self):
        result = try_local_emission_parse('80 liters lpg')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'lpg')
        self.assertEqual(result['quantity'], 80.0)
        self.assertEqual(result['unit'], 'liters')

    def test_coal_kg(self):
        result = try_local_emission_parse('1000 kg coal')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'coal')
        self.assertEqual(result['quantity'], 1000.0)
        self.assertEqual(result['unit'], 'kg')

    def test_flight_domestic_km(self):
        result = try_local_emission_parse('800 km domestic flight')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'flight_domestic')
        self.assertEqual(result['quantity'], 800.0)
        self.assertEqual(result['unit'], 'km')

    def test_flight_long_haul_km(self):
        result = try_local_emission_parse('9000 km long haul flight')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'flight_long_haul')
        self.assertEqual(result['quantity'], 9000.0)
        self.assertEqual(result['unit'], 'km')

    def test_truck_freight_tonne_km(self):
        result = try_local_emission_parse('5000 tonne-km truck freight')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'truck_freight')
        self.assertEqual(result['quantity'], 5000.0)
        self.assertEqual(result['unit'], 'tonne-km')

    def test_waste_landfill_kg(self):
        result = try_local_emission_parse('200 kg landfill')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'waste_landfill')
        self.assertEqual(result['quantity'], 200.0)
        self.assertEqual(result['unit'], 'kg')

    def test_car_commute_km(self):
        result = try_local_emission_parse('30 km car commute')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'employee_commuting_car_commute')
        self.assertEqual(result['quantity'], 30.0)
        self.assertEqual(result['unit'], 'km')

    def test_plastic_kg(self):
        result = try_local_emission_parse('500 kg plastic')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'purchased_goods_plastic_average')
        self.assertEqual(result['quantity'], 500.0)
        self.assertEqual(result['unit'], 'kg')

    def test_water_supply_m3(self):
        result = try_local_emission_parse('100 m3 water supply')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'water_water_supply')
        self.assertEqual(result['quantity'], 100.0)
        self.assertEqual(result['unit'], 'm3')

    def test_road_travel_km(self):
        result = try_local_emission_parse('150 km road travel')
        self.assertIsNotNone(result)
        self.assertEqual(result['fuel_type'], 'road_travel')
        self.assertEqual(result['quantity'], 150.0)
        self.assertEqual(result['unit'], 'km')

    # ── Edge cases ────────────────────────────────────────────────────────────
    def test_comma_decimal(self):
        result = try_local_emission_parse('18,5 kwh electricity')
        self.assertIsNotNone(result)
        self.assertEqual(result['quantity'], 18.5)

    def test_unit_synonym_lt(self):
        result = try_local_emission_parse('100 lt diesel')
        self.assertIsNotNone(result)
        self.assertEqual(result['unit'], 'liters')

    def test_question_returns_none(self):
        self.assertIsNone(try_local_emission_parse('how much CO2 from electricity?'))

    def test_no_quantity_returns_none(self):
        self.assertIsNone(try_local_emission_parse('electricity usage'))

    def test_no_activity_returns_none(self):
        self.assertIsNone(try_local_emission_parse('500 kg something'))

    def test_empty_string_returns_none(self):
        self.assertIsNone(try_local_emission_parse(''))

    def test_none_input_returns_none(self):
        self.assertIsNone(try_local_emission_parse(None))

    def test_result_has_required_keys(self):
        result = try_local_emission_parse('1000 kwh electricity')
        self.assertIsNotNone(result)
        for key in ('fuel_type', 'quantity', 'unit', 'month', 'year', 'description'):
            self.assertIn(key, result)
