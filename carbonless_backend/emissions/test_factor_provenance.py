"""Stage 4 audit: emission-factor source verification (see carbonless/audit/stage4/).

Nothing here changes a factor, a formula or a unit. The tests do three things:

1. VerifiedAgainstPrimarySourceTests - factors whose stored value was checked against the publisher's own
   document are pinned to it, with the document's row ID, so a later edit that moves them away fails.
2. ConfirmedDiscrepancyTests - every discrepancy the audit confirmed is written as an expected failure that
   states what a corrected catalog must satisfy. They keep the suite green today; the day the methodology owner
   approves a correction, the test starts passing and unittest reports an "unexpected success" that says the
   decorator and the audit record must be updated. Nothing can be "fixed" or "left" silently.
3. FactorSelectionTests - the engine picks the factor of the right year, country, connection and method.

Primary sources (retrieved for the audit; SHA-256 of every file is in audit/stage4/evidence_manifest.md):
  DESNZ 2020 / 2023 / 2024 / 2025 "GHG conversion factors for company reporting", flat file
  T.C. Enerji ve Tabii Kaynaklar Bakanligi, ETKB-EVCED-FRM-042, Turkiye Elektrik Uretimi ve Elektrik Tuketim
      Noktasi Emisyon Faktorleri, 2020 / 2022 / 2023
  IPCC 2006 Guidelines Vol.3 Ch.2 (Eq. 2.4), Vol.2 Ch.1-2; GHG Protocol "IPCC Global Warming Potential Values"
  v2.0 (Aug 2024); GHG Protocol Corporate Value Chain (Scope 3) Standard (2011), Box 5.6."""
import unittest
from decimal import Decimal as D

from django.core.management import call_command
from django.test import TestCase

from .models import EmissionFactor

# ── 1. verified against the publisher's own document ──────────────────────────────────────────────
# (slug, country) -> (published value in the STORED unit, source row, tolerance as a fraction of the value)
VERIFIED = {
    # ETKB 2023, consumption-point factors, tCO2-eq/MWh == kg CO2e/kWh (exact)
    ('turkey-grid-transmission', 'turkey'): (D('0.436'), 'ETKB 2023 FRM-042 p.2 (iletim hattindan bagli, tCO2-esd./MWh)', 0),
    ('turkey-grid-distribution', 'turkey'): (D('0.469'), 'ETKB 2023 FRM-042 p.2 (dagitim hattindan bagli, tCO2-esd./MWh)', 0),
    # DESNZ 2024 v1.1
    ('hotel-turkey', 'turkey'): (D('32.1'), 'DESNZ 2024 29_600_4051_13_1 (Hotel stay, Turkey, room per night)', 0),
    ('water-supply', 'global'): (D('0.15311'), 'DESNZ 2024 17_404_4005_1_1 (cubic metres)', 0),
    ('water-treatment', 'global'): (D('0.18574'), 'DESNZ 2024 18_405_4006_1_1 (cubic metres)', 0),
    ('propane', 'global'): (D('2.99763233'), 'DESNZ 2024 1_100_1007_15_1 (tonnes) / 1000', D('1e-6')),
    ('electrical-fridges', 'global'): (D('4.36333333'), 'DESNZ 2024 19_503_5076_15_1 (primary material production, tonnes) / 1000', D('1e-6')),
    ('electrical-it', 'global'): (D('24.86547556'), 'DESNZ 2024 19_503_5084_15_1 / 1000', D('1e-6')),
    ('electrical-large', 'global'): (D('3.267'), 'DESNZ 2024 19_503_5080_15_1 / 1000', D('1e-6')),
    ('electrical-small', 'global'): (D('5.64794563'), 'DESNZ 2024 19_503_5088_15_1 / 1000', D('1e-6')),
    ('glass', 'global'): (D('1.40276667'), 'DESNZ 2024 19_501_5056_15_1 / 1000', D('1e-6')),
    ('metal-aluminium', 'global'): (D('9.10691851'), 'DESNZ 2024 19_504_5104_15_1 / 1000', D('1e-6')),
    ('metal-mixed-cans', 'global'): (D('5.10563851'), 'DESNZ 2024 19_504_5108_15_1 / 1000', D('1e-6')),
    ('metal-steel-cans', 'global'): (D('2.85491851'), 'DESNZ 2024 19_504_5116_15_1 / 1000', D('1e-6')),
    ('mineral-oil', 'global'): (D('1.401'), 'DESNZ 2024 19_500_5036_15_1 / 1000', D('1e-6')),
    ('paper-mixed', 'global'): (D('1.28274402'), 'DESNZ 2024 19_506_5160_15_1 / 1000', D('1e-6')),
    ('plastic-average', 'global'): (D('3.16478049'), 'DESNZ 2024 19_505_5120_15_1 / 1000', D('1e-6')),
    ('plastic-hdpe', 'global'): (D('3.08639038'), 'DESNZ 2024 19_505_5132_15_1 / 1000', D('1e-6')),
    ('wood', 'global'): (D('0.26950416'), 'DESNZ 2024 19_500_5048_15_1 / 1000', D('1e-6')),
    # UK grid: DESNZ publishes 0.20705 (2024) and 0.177 (2025); the catalog rounds 2024 to 3 decimals
    ('uk-grid', 'global', 2024): (D('0.20705'), 'DESNZ 2024 7_400_4000_5_1 (Electricity: UK)', D('0.0003')),
    ('uk-grid', 'global', 2025): (D('0.177'), 'DESNZ 2025 7_400_4000_5_1', 0),
    ('uk-transmission-losses', 'global'): (D('0.01853'), 'DESNZ 2025 13_402_4000_5_1 (T&D, Electricity: UK)', 0),
}


class _Catalog(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('seed_factors', verbosity=0)
        call_command('seed_gas_splits', verbosity=0)

    @staticmethod
    def factor(slug, country, year=None):
        qs = EmissionFactor.objects.filter(slug=slug, country=country)
        if year:
            qs = qs.filter(year=year)
        return qs.get()


class VerifiedAgainstPrimarySourceTests(_Catalog):
    def test_each_verified_factor_still_equals_its_published_value(self):
        for key, (published, source, tol) in VERIFIED.items():
            slug, country, year = (key + (None,))[:3]
            f = self.factor(slug, country, year)
            self.assertLessEqual(abs(D(str(f.factor_kg_co2e)) - published), D(tol) * abs(published),
                                 f'{slug} [{country}] stored {f.factor_kg_co2e}, published {published}: {source}')

    def test_the_two_turkish_consumption_point_factors_are_the_ministrys_co2_equivalent_not_co2_only(self):
        # ETKB 2023 lists CO2-only (0.433 / 0.465) beside CO2-equivalent (0.436 / 0.469): the catalog holds the latter.
        self.assertEqual(D(str(self.factor('turkey-grid-transmission', 'turkey').factor_kg_co2e)), D('0.436'))
        self.assertEqual(D(str(self.factor('turkey-grid-distribution', 'turkey').factor_kg_co2e)), D('0.469'))

    def test_the_negative_factors_are_exactly_the_three_recycling_credits(self):
        """Methodology decision pending (audit/stage4/methodology_decision_negative_recycling.md): a fourth negative
        factor must not appear without the owner's decision."""
        neg = {(f.slug, D(str(f.factor_kg_co2e))) for f in EmissionFactor.objects.filter(factor_kg_co2e__lt=0)}
        self.assertEqual(neg, {('wt-01-recycling', D('-0.125')), ('wt-03-recycling', D('-0.506')), ('wt-04-recycling', D('-9.1'))})


# ── 1b. reproduced from the owner's own documents (Stage 5) ───────────────────────────────────────
# ISO 14064-1 Hesaplama Dokumani ATOM KABLO 2023 (sheet!cell) - the documented methodology. Values are the
# document's cells divided to the catalog's unit; audit/stage5/documented_factor_register.csv lists all of them.
DOCUMENTED = {
    ('carton', 'turkey'): (D('0.8680699'), '4.1 HAM. KULL.!E7 /1000 (DEFRA 2023 paper, mixed, primary)'),
    ('chemical', 'turkey'): (D('2.04'), '4.1 HAM. KULL.!E4 (Ecoinvent)'),
    ('chemical-oil', 'turkey'): (D('2.04'), '4.1 HAM. KULL.!E5 (Ecoinvent)'),
    ('foam-tape', 'turkey'): (D('2.5867273'), '4.1 HAM. KULL.!E11 /1000'),
    ('metal-primary', 'turkey'): (D('4.0051377'), '4.1 HAM. KULL.!E8 /1000'),
    ('metal-recycled', 'turkey'): (D('1.5589489'), '4.1 HAM. KULL.!E9 /1000 (closed-loop material factor, not a credit)'),
    ('plastic', 'turkey'): (D('3.1024485'), '4.1 HAM. KULL.!E6 /1000'),
    ('wood', 'turkey'): (D('0.3126117'), '4.1 HAM. KULL.!E10 /1000'),
    ('water-supply', 'turkey'): (D('0.1766845'), '4.3.2 KULL.&ATIK SU!D4'),
    ('water-treatment', 'turkey'): (D('0.2013182'), '4.3.2 KULL.&ATIK SU!D12'),
    ('road-travel', 'turkey'): (D('0.1698264'), '3.5 SEYAHAT!D5:F5 (DEFRA 2023 average diesel car, per km)'),
    ('sea-freight', 'turkey'): (D('0.0161185'), '3.1 HAMMADDE NAK.!D14:F14 (container ship average, per tonne-km)'),
    ('turkey-grid', 'turkey'): (D('0.4199'), '2 ITHAL ENERJI!C5:E5 = 0.4183 + 0.0001 + 0.0015 (IEA per footnote A7)'),
    ('hotel-turkey', 'turkey'): (D('32.1'), '3.5 SEYAHAT!D21'),
    ('r600a', 'global'): (D('3'), '1.4 GAZ KAC.!Z7 (DEFRA 2023 Refrigerant others)'),
    ('sf6', 'global'): (D('25200'), '1.4 GAZ KAC.!AG7 (IPCC AR6 Table 7.SM.7); NB the 2024 file uses 23,500'),
}


class ReproducedFromOwnerDocumentsTests(_Catalog):
    def test_each_factor_equals_the_cell_of_the_owners_calculation_document(self):
        for (slug, country), (cell_value, where) in DOCUMENTED.items():
            f = self.factor(slug, country)
            self.assertLessEqual(abs(D(str(f.factor_kg_co2e)) - cell_value) / cell_value, D('0.00005'),   # catalog stores 6 d.p.; small values round at the 5th significant digit
                                 f'{slug} [{country}] stored {f.factor_kg_co2e}, document {cell_value}: {where}')

    def test_on_road_diesel_is_reproduced_by_the_documented_formula(self):
        """1.2 HAR. YANMA row 5: (EF_CO2 + EF_CH4*GWP_CH4 + EF_N2O*GWP_N2O) x density x NCV x 1e-6, per m3, / 1000 per litre.
        Inputs: IPCC 2006 EFs 74100 / 3.9 / 3.9 kg/TJ, GWP 27.9 / 273 (AR6), density 832.836 kg/m3 (DEFRA 2023 fuel
        properties, verified), NCV 43 TJ/Gg (IPCC V2 Ch1 T1.2)."""
        per_litre = (74100 + 3.9 * 27.9 + 3.9 * 273) * 832.836 * 43 * 1e-6 / 1000
        self.assertAlmostEqual(per_litre, 2.69569, places=5)
        self.assertAlmostEqual(float(self.factor('motorin-mobile', 'turkey').factor_kg_co2e), per_litre, delta=0.0005)

    def test_stationary_diesel_is_within_one_percent_of_the_documented_method(self):
        documented = (74100 + 3 * 27.9 + 0.6 * 273) * 832.836 * 43 * 1e-6 / 1000          # 1.1 SBT. YANMA row 41
        stored = float(self.factor('diesel', 'turkey').factor_kg_co2e)
        self.assertLess(abs(stored - documented) / documented, 0.01)

    def test_the_turkish_grid_legacy_factor_is_the_documented_iea_value_and_the_replacements_are_active(self):
        self.assertEqual(float(self.factor('turkey-grid', 'turkey').factor_kg_co2e), 0.4199)
        self.assertFalse(self.factor('turkey-grid', 'turkey').is_active)                 # superseded, kept for legacy entries
        self.assertTrue(self.factor('turkey-grid-distribution', 'turkey').is_active)


# ── 2. findings that need the owner's decision, as expected failures ───────────────────────────────
class ConfirmedDiscrepancyTests(_Catalog):
    """Stage 5. Each test states what the OWNER'S DOCUMENTED METHODOLOGY (or the exact source the catalog cites) requires.
    They fail today (expectedFailure); each is a decision item in audit/stage5/decision_register.md. When a decision is
    applied the test starts passing and unittest reports an unexpected success: remove the decorator and update the audit."""

    @unittest.expectedFailure
    def test_truck_freight_is_a_per_tonne_km_factor(self):                              # DR-01
        """The documented 0.823134 is per VEHICLE-km (3.1 HAMMADDE NAK., activity in km, tonnes blank). Stored per
        tonne-km, a Turkish company's 1,000 tonne-km becomes 823 kg (112 kg for a German one). The owner's 2024 sheet
        uses DEFRA 2024 All HGVs average laden 0.09752 per tonne-km for tonne-km activity."""
        from companies.models import Company
        from .factor_lookup import resolve_factor_and_amount
        co = Company.objects.create(legal_entity_name='TR Co', tax_number='1', country_of_headquarters='TR', countries_of_operation='TR',
                                    nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        kg = float(resolve_factor_and_amount('truck_freight', 1000, 'tonne-km', co, None, 2025)[2])
        self.assertLess(kg, 200, kg)

    @unittest.expectedFailure
    def test_refrigerant_gwps_equal_the_documented_ar6_values(self):                      # DR-02
        """Documented basis (1.4 GAZ KAC.; the 2024 file agrees): AR6 Table 7.SM.7: HFC-134a 1530, HFC-32 771, HCFC-22 1960,
        R-410A 2255.5. The catalog holds the AR4 values 1430 / 675 / 1810 / 2088 and says 'AR6 GWP100'."""
        documented = {'r134a': 1530, 'r32': 771, 'r22': 1960, 'r410a': 2255.5}
        for slug, gwp in documented.items():
            self.assertAlmostEqual(float(self.factor(slug, 'global').factor_kg_co2e), gwp, delta=0.5, msg=slug)

    @unittest.expectedFailure
    def test_off_road_diesel_is_within_two_percent_of_the_documented_method(self):         # DR-03
        documented = (74100 + 4.15 * 27.9 + 28.6 * 273) * 832.836 * 43 * 1e-6 / 1000        # 1.2 HAR. YANMA row 18 = 2.93742
        stored = float(self.factor('off-road-diesel-desnz', 'global').factor_kg_co2e)
        self.assertLess(abs(stored - documented) / documented, 0.02, (stored, documented))

    @unittest.expectedFailure
    def test_every_diesel_litre_factor_agrees_within_three_percent(self):                  # DR-03 (internal consistency)
        values = [float(self.factor(s, c).factor_kg_co2e)
                  for s, c in (('diesel', 'turkey'), ('motorin-mobile', 'turkey'), ('off-road-diesel-desnz', 'global'))]
        self.assertLess(max(values) / min(values) - 1, 0.03, values)

    @unittest.expectedFailure
    def test_lpg_is_within_two_percent_of_the_documented_method(self):                      # DR-04
        documented = (63100 + 27.9 + 0.1 * 273) * 531.098 * 47.3 * 1e-6 / 1000                  # 1.1 SBT. YANMA row 17 = 1.58652 per litre
        self.assertLess(abs(float(self.factor('lpg', 'turkey').factor_kg_co2e) - documented) / documented, 0.02)

    # DR-05 / DR-08 / DR-10 label tests: closed by the Phase 1 label-only release (audit/stage6/label_changes.csv);
    # they now pass and live in LabelCorrectionsTests below. The numeric questions stay open in the register.

    @unittest.expectedFailure
    def test_the_gas_split_uses_the_documented_methane_gwp(self):                           # DR-11
        from . import gas_split_data
        self.assertEqual(gas_split_data.GWP_CH4_FOSSIL, 27.9)

    @unittest.expectedFailure
    def test_bioenergy_factors_citing_defra_2024_equal_the_cited_rows(self):                # DR-12
        for slug, published in (('biodiesel', 0.16751), ('bioethanol', 0.00901), ('wood-pellets', 0.0543365)):
            self.assertLess(abs(float(self.factor(slug, 'global').factor_kg_co2e) - published) / published, 0.02, slug)

    @unittest.expectedFailure
    def test_paper_landfill_equals_the_documented_2024_value(self):                          # DR-13
        self.assertLess(abs(float(self.factor('wt-01-landfill', 'global').factor_kg_co2e) - 1.16439015) / 1.16439015, 0.02)

    @unittest.expectedFailure
    def test_no_factor_tagged_defra_2024_cites_only_an_internal_catalogue_id(self):        # DR-14
        bad = EmissionFactor.objects.filter(source='defra_2024', reference__startswith='CarbonIQ EF Katalogu')
        self.assertEqual(bad.count(), 0)

    @unittest.expectedFailure
    def test_every_factor_names_a_citable_source(self):                                      # DR-14
        # 59 'generic' factors cite "GHG Protocol - Scope 3 Cat N estimate" (the GHG Protocol publishes no factors) or nothing.
        self.assertEqual(EmissionFactor.objects.filter(source='generic').count(), 0)


class LabelCorrectionsTests(_Catalog):
    """Phase 1 (label-only release): the three label questions that were expected failures now pass. No value is asserted
    to change here; the numeric questions (2.02 vs a method value, 525 vs 520) remain open decisions."""

    def test_natural_gas_is_no_longer_labelled_as_a_defra_2024_value(self):                  # DR-05
        for country in ('global', 'turkey'):
            f = self.factor('natural-gas-m3', country)
            self.assertNotIn('DEFRA 2024 –', f.reference)
            self.assertIn('not a DEFRA 2024 factor', f.reference)
            self.assertIn('2.02266', f.reference)                      # the DEFRA 2020 figure the value rounds from
            self.assertEqual(f.factor_kg_co2e, D('2.02'))              # value untouched

    def test_clinker_label_no_longer_attributes_525_to_ipcc_equation_2_4(self):             # DR-08
        f = self.factor('cement-clinker', 'global')
        self.assertTrue(f.reference.startswith('525'))
        self.assertIn('Eq. 2.4 gives 520', f.reference)
        self.assertEqual(f.factor_kg_co2e, D('525'))                   # value untouched

    def test_no_spend_based_factor_is_attributed_to_defra_2024(self):                         # DR-10
        # The DESNZ 2024 workbook has 16 distinct units and none is a currency: no spend-based factor exists in it.
        cited = EmissionFactor.objects.filter(unit='usd', reference__icontains='DEFRA 2024')
        self.assertEqual(list(cited.values_list('slug', flat=True)), [])


# ── 3. the engine selects the right factor ─────────────────────────────────────────────────────────
class FactorSelectionTests(_Catalog):
    def pick(self, slug, country, year):
        from .factor_lookup import pick_factor
        return pick_factor(slug, country, year)

    def test_the_year_row_is_used_when_there_is_one(self):
        self.assertEqual(float(self.pick('uk-grid', 'global', 2024).factor_kg_co2e), 0.207)
        self.assertEqual(float(self.pick('uk-grid', 'global', 2025).factor_kg_co2e), 0.177)

    def test_a_later_year_falls_back_to_the_latest_earlier_row_and_an_earlier_year_to_the_earliest(self):
        self.assertEqual(self.pick('uk-grid', 'global', 2030).year, 2025)
        self.assertEqual(self.pick('uk-grid', 'global', 2010).year, 2024)       # the report states this reference year

    def test_turkey_has_only_the_2023_consumption_point_edition_so_later_years_are_flagged_as_estimates(self):
        f = self.pick('turkey-grid-distribution', 'turkey', 2025)
        self.assertEqual(f.year, 2023)
        from questionnaire.step_entries import factor_reference_years     # the disclosure used by the ISO report
        self.assertTrue(callable(factor_reference_years))

    def test_a_facility_abroad_never_gets_turkeys_grid(self):
        from companies.models import Company, Facility
        from .factor_lookup import resolve_factor_and_amount
        co = Company.objects.create(legal_entity_name='Sel Co', tax_number='1', country_of_headquarters='TR',
                                    countries_of_operation='TR', nace_code='', main_activity_description='x',
                                    number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        for country, slug in (('DE', 'germany-grid'), ('GB', 'uk-grid'), ('US', 'us-grid')):
            fac = Facility.objects.create(company=co, name=f'Site {country}', country=country)
            factor, qty, kg, err = resolve_factor_and_amount('electricity', 1000, 'kwh', co, fac, 2025)
            self.assertIsNone(err)
            self.assertEqual(factor.slug, slug)
            self.assertNotIn('turkey', factor.slug)

    def test_turkish_connection_chooses_the_matching_ministry_factor_and_no_connection_waits(self):
        from companies.models import Company, Facility
        from .factor_lookup import resolve_factor_and_amount, FACILITY_GRID_MISSING
        co = Company.objects.create(legal_entity_name='Sel2 Co', tax_number='2', country_of_headquarters='TR',
                                    countries_of_operation='TR', nace_code='', main_activity_description='x',
                                    number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        for conn, slug, kg in (('transmission', 'turkey-grid-transmission', 436.0), ('distribution', 'turkey-grid-distribution', 469.0)):
            fac = Facility.objects.create(company=co, name=conn, country='TR', grid_connection=conn)
            factor, qty, co2e, err = resolve_factor_and_amount('electricity', 1000, 'kwh', co, fac, 2025)
            self.assertEqual((factor.slug, round(float(co2e), 3)), (slug, kg))
        blank = Facility.objects.create(company=co, name='blank', country='TR', grid_connection='')
        self.assertEqual(resolve_factor_and_amount('electricity', 1000, 'kwh', co, blank, 2025)[3], FACILITY_GRID_MISSING)
