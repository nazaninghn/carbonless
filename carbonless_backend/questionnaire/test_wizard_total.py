"""F-1 (Stage 1 audit): what the Wizard's total is, and that it reconciles with the Dashboard.

`calc_feedback.total_kg` is the total of the entries THE QUESTIONNAIRE created — a partial total:
monthly form / chat entries and approved custom requests are not in it. The Dashboard shows
everything approved for the year. So the save response also carries `year_total_kg`, computed
the Dashboard's way, and the Wizard names the first as the questionnaire total and shows the
second next to it. These tests pin both numbers against the Dashboard summary, for a normal
save (an owner) and for a pending change (a data-entry member).

Fixtures: PendingChangeTests' company, owner and data-entry member (a 2025 inventory,
Turkey's grid at 0.4 kg/kWh)."""
from decimal import Decimal

from django.test import TestCase

from emissions.models import CustomEmissionRequest, EmissionEntry, EmissionFactor
from . import tests as _base


class WizardTotalTests(TestCase):
    setUp = _base.PendingChangeTests.setUp      # company, owner (c_owner), data-entry member (c_clerk), self.report
    _save = _base.PendingChangeTests._save      # one 4A-1 save -> its calc_feedback

    def _request(self, kg, **kw):
        return CustomEmissionRequest.objects.create(
            user=self.owner, company=self.company, scope=kw.pop('scope', 'scope3'), category_name='x', source_name='c',
            description='', unit='kg', quantity=Decimal(kg), year=2025, month=1,
            approved_factor_kg_co2e=Decimal(1), calculated_co2e_kg=Decimal(kg), **kw)

    def _extras(self):
        """Approved emissions the questionnaire did not create: a monthly form entry and custom requests.
        Returns the kg the Dashboard adds for them."""
        gas = EmissionFactor.objects.create(
            slug='wiz-gas', name='Gas', scope='scope1', category='stationary_combustion', country='global',
            unit='gj', factor_kg_co2e=50, year=2024, source='generic', is_active=True, is_default=True)
        EmissionEntry.objects.create(user=self.owner, company=self.company, emission_factor=gas, year=2025,
                                     month=3, quantity=10, status='approved', description='form entry')   # 500 kg
        self._request(150, status='approved')                                          # counted in the Dashboard total
        self._request(70, status='approved', electricity_method='location_based')     # a facility factor: never added
        self._request(33, status='pending')                                            # not approved: not counted
        return 500.0 + 150.0

    def _dashboard_kg(self):
        return self.c_owner.get('/api/emissions/summary/?year=2025').data['total_kg']

    def test_the_questionnaire_total_is_partial_and_the_year_total_is_the_dashboards(self):
        self._save(self.c_owner, {'1': '1000 kWh'})
        other = self._extras()
        fb = self._save(self.c_owner, {'1': '2000 kWh'})
        self.assertFalse(fb['pending'])
        self.assertEqual(fb['total_kg'], 800.0)                              # the questionnaire's own entries only
        self.assertEqual(fb['year_total_kg'], 800.0 + other)                 # + the monthly entry + the counted request
        self.assertAlmostEqual(fb['year_total_kg'], self._dashboard_kg(), places=2)
        self.assertGreater(fb['year_total_kg'], fb['total_kg'])              # so the two are not the same number

    def test_with_nothing_but_the_questionnaire_the_two_totals_are_equal(self):
        fb = self._save(self.c_owner, {'1': '1000 kWh'})
        self.assertEqual(fb['total_kg'], fb['year_total_kg'])
        self.assertAlmostEqual(fb['year_total_kg'], self._dashboard_kg(), places=2)

    def test_a_pending_change_is_in_neither_total(self):
        self._save(self.c_owner, {'1': '1000 kWh'})
        other = self._extras()
        fb = self._save(self.c_clerk, {'1': '3000 kWh'})                      # waits for approval
        self.assertTrue(fb['pending'])
        self.assertEqual(fb['total_kg'], 400.0)                              # still the approved questionnaire value
        self.assertEqual(fb['year_total_kg'], 400.0 + other)                 # still what the Dashboard shows
        self.assertAlmostEqual(fb['year_total_kg'], self._dashboard_kg(), places=2)

    def test_an_approved_custom_request_reaches_the_year_total(self):
        self._save(self.c_owner, {'1': '1000 kWh'})
        self._request(50, status='approved', scope='scope1')
        fb = self._save(self.c_owner, {'1': '1500 kWh'})
        self.assertEqual((fb['total_kg'], fb['year_total_kg']), (600.0, 650.0))
        self.assertAlmostEqual(fb['year_total_kg'], self._dashboard_kg(), places=2)

    def test_the_year_total_is_for_the_inventory_year_only(self):
        """A request or entry of another year is in neither the Dashboard's total for 2025 nor the Wizard's."""
        self._save(self.c_owner, {'1': '1000 kWh'})
        CustomEmissionRequest.objects.create(
            user=self.owner, company=self.company, scope='scope3', category_name='x', source_name='old', description='',
            unit='kg', quantity=Decimal(9), year=2024, month=1, status='approved',
            approved_factor_kg_co2e=Decimal(1), calculated_co2e_kg=Decimal(9999))
        fb = self._save(self.c_owner, {'1': '1500 kWh'})
        self.assertEqual(fb['year_total_kg'], 600.0)
        self.assertAlmostEqual(fb['year_total_kg'], self._dashboard_kg(), places=2)
