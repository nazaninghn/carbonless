"""Stage 3 audit: calculation integrity and end-to-end consistency.

S3-1  A facility deleted after an inventory was signed must not change how that inventory's electricity
      is calculated at its next (authorised, flagged) edit: no silent switch to the company default grid.
Further classes (independent recalculation, reconciliation of API / Dashboard / exports / reports) follow.

Fixtures: LockedInventoryGridConnectionTests' Turkish company with a 2025 inventory."""
from django.test import TestCase

from emissions.models import EmissionEntry
from . import tests as _base
from .models import CarbonReport
from .test_stage2_integrity import _Locked


class DeletedFacilityTests(_Locked):
    """The inventory's own 2A-2 answer records the facility (name, country, grid connection); that record
    is what a signed inventory is recalculated with once the facility itself is gone."""

    def _delete_gebze(self):
        r = self.client.delete(f'/api/companies/facilities/{self._gebze().pk}/')
        self.assertEqual(r.status_code, 204, r.content)

    def test_a_transmission_facility_deleted_after_signing_keeps_its_recorded_grid_factor(self):
        self._step('2A-2', self.TRANSMISSION)               # Gebze on the transmission grid: 1000 kWh = 436 kg
        self.assertEqual(self._rows(), [('turkey-grid-transmission', 1000.0, 436.0)])
        self._sign()
        self._delete_gebze()
        self.assertEqual(round(self._dashboard_kg(), 2), 436.0)                      # deleting moved no total
        self._step('4A-1', {'1': '2000 kWh'})                                         # an authorised, flagged edit
        # 2,000 kWh x 0.436 (transmission, as signed) - not x 0.469 (the company default distribution grid)
        self.assertEqual(self._rows(), [('turkey-grid-transmission', 2000.0, 872.0)])
        self.report.refresh_from_db()
        self.assertIsNotNone(self.report.edited_after_signing_at)

    def test_a_foreign_facility_deleted_after_signing_keeps_its_own_country_grid(self):
        self._factor('germany-grid', 'kwh', 0.35, scope='scope2')
        self._step('2A-2', {'1': {'name': 'Berlin', 'country': 'DE'}})
        self._step('4A-1', {'1': '1000 kWh'})
        self.assertEqual(self._rows(), [('germany-grid', 1000.0, 350.0)])
        self._sign()
        berlin = self.company.facilities.get(name='Berlin')
        self.assertEqual(self.client.delete(f'/api/companies/facilities/{berlin.pk}/').status_code, 204)
        self._step('4A-1', {'1': '2000 kWh'})
        self.assertEqual(self._rows(), [('germany-grid', 2000.0, 700.0)])             # not Turkey's grid for a German site

    def test_the_recalculated_entry_is_unassigned_not_attached_to_a_phantom_facility(self):
        self._sign()
        self._delete_gebze()
        self._step('4A-1', {'1': '2000 kWh'})
        entries = EmissionEntry.objects.filter(company=self.company, year=2025,
                                               description__startswith='Questionnaire step 4A-1')
        self.assertEqual([e.facility_id for e in entries], [None])
        self.assertEqual(self.company.facilities.filter(name='Gebze').count(), 0)     # nothing was re-created

    def test_reports_and_the_market_based_result_of_the_signed_inventory_still_use_the_recorded_factor(self):
        from .iso_report_pdf import _scope2_market
        self._step('2A-2', self.TRANSMISSION)
        self._sign()
        before = [round(r['factor'], 3) for r in _scope2_market(self.report)['rows']]
        self.assertEqual(before, [0.436])
        self._delete_gebze()
        self.assertEqual([round(r['factor'], 3) for r in _scope2_market(self.report)['rows']], [0.436])   # not 0.469
        self.assertEqual(self.client.get(f'/api/questionnaire/{self.report.id}/iso-report/?lang=en').status_code, 200)
        self.assertEqual(self._rows(), [('turkey-grid-transmission', 1000.0, 436.0)])                  # reading recalculated nothing
        self.assertEqual(self._history('facility_unlinked_from_locked_inventory')[0].metadata['entries'], 1)

    def test_no_default_grid_note_is_shown_for_a_site_the_signed_inventory_recorded(self):
        """The 'connection unknown, distribution assumed' note is for electricity tied to no facility; a recorded
        site is not that, even after its facility was deleted."""
        from .models import ReportStep
        from .step_entries import uncalculated_notes
        self._step('2A-2', self.TRANSMISSION)
        self._sign()
        self._delete_gebze()
        answers = dict(ReportStep.objects.filter(report=self.report).values_list('step_id', 'answer'))
        from .step_entries import recorded_connections
        with recorded_connections(self.report):
            notes = [n for n in uncalculated_notes(answers, 2025, self.company) if n['step_id'] == '4A-1']
        self.assertEqual(notes, [])

    def test_a_draft_inventory_is_not_given_a_facility_that_is_gone(self):
        """Only history is rebuilt from its own record; a draft follows the live data (no facility -> the default,
        which its notes already state)."""
        self._delete_gebze()
        self._step('4A-1', {'1': '2000 kWh'})
        self.assertEqual(self._rows(), [('turkey-grid-distribution', 2000.0, 938.0)])
