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

    def _refused_delete(self, facility):
        """Deleting a facility an entry of a SIGNED inventory points at: refused (409
        facility_locked_by_signed_inventory), because the delete would null that reference. Nothing changes: the
        facility, its entries, the snapshot and the history stay as they are. (Refused through the application;
        no ORM deletion is used to simulate a permitted one.)"""
        before = _base._signed_state_dump()
        history = len(self._history('facility_unlinked_from_locked_inventory'))
        r = self.client.delete(f'/api/companies/facilities/{facility.pk}/')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'facility_locked_by_signed_inventory')
        self.assertEqual(_base._signed_state_dump(), before)
        self.assertEqual(len(self._history('facility_unlinked_from_locked_inventory')), history)   # nothing unlinked

    def _refused_edit(self, step, answer):
        """An edit of the SIGNED inventory, by anyone: refused (409 inventory_signed), nothing changes."""
        before = _base._signed_state_dump()
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': step, 'data': {'answer': answer}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_signed')
        self.assertEqual(_base._signed_state_dump(), before)

    def test_a_transmission_facility_deleted_after_signing_keeps_its_recorded_grid_factor(self):
        """A facility a signed inventory's entries point at cannot be deleted (409), so the inventory keeps
        its facility, its recorded grid factor and its snapshot; the later edit is refused too."""
        self._step('2A-2', self.TRANSMISSION)               # Gebze on the transmission grid: 1000 kWh = 436 kg
        self.assertEqual(self._rows(), [('turkey-grid-transmission', 1000.0, 436.0)])
        self._sign()
        snapshot = dict(CarbonReport.objects.get(pk=self.report.pk).applied_grid_connections)
        self.assertEqual(snapshot, {str(self._gebze().pk): 'transmission'})          # recorded at its first signing
        self._refused_delete(self._gebze())
        self.assertEqual(round(self._dashboard_kg(), 2), 436.0)                      # nothing moved
        self._refused_edit('4A-1', {'1': '2000 kWh'})                                 # nor can it be edited
        # still 1,000 kWh x 0.436 (transmission, as signed) - not 2,000, not x 0.469 (the default distribution grid)
        self.assertEqual(self._rows(), [('turkey-grid-transmission', 1000.0, 436.0)])
        self.report.refresh_from_db()
        self.assertEqual(self.report.applied_grid_connections, snapshot)             # retained, never overwritten
        self.assertIsNone(self.report.edited_after_signing_at)

    def test_a_foreign_facility_deleted_after_signing_keeps_its_own_country_grid(self):
        self._factor('germany-grid', 'kwh', 0.35, scope='scope2')
        self._step('2A-2', {'1': {'name': 'Berlin', 'country': 'DE'}})
        self._step('4A-1', {'1': '1000 kWh'})
        self.assertEqual(self._rows(), [('germany-grid', 1000.0, 350.0)])
        self._sign()
        berlin = self.company.facilities.get(name='Berlin')
        self._refused_delete(berlin)
        self._refused_edit('4A-1', {'1': '2000 kWh'})
        self.assertEqual(self._rows(), [('germany-grid', 1000.0, 350.0)])             # still its own country's grid
        self.assertEqual(self.company.facilities.filter(name='Berlin').count(), 1)

    def test_the_recalculated_entry_is_unassigned_not_attached_to_a_phantom_facility(self):
        """Nothing is unlinked: the entry keeps its real facility and no facility is lost or re-created (the
        delete is refused and the signed inventory cannot be recalculated)."""
        self._sign()
        gebze = self._gebze()
        self._refused_delete(gebze)
        self._refused_edit('4A-1', {'1': '2000 kWh'})
        entries = EmissionEntry.objects.filter(company=self.company, year=2025,
                                               description__startswith='Questionnaire step 4A-1')
        self.assertEqual([e.facility_id for e in entries], [gebze.pk])                # still attached to the real one
        self.assertEqual(self.company.facilities.filter(name='Gebze').count(), 1)

    def test_reports_and_the_market_based_result_of_the_signed_inventory_still_use_the_recorded_factor(self):
        from .iso_report_pdf import _scope2_market
        self._step('2A-2', self.TRANSMISSION)
        self._sign()
        before = [round(r['factor'], 3) for r in _scope2_market(self.report)['rows']]
        self.assertEqual(before, [0.436])
        self._refused_delete(self._gebze())
        self.assertEqual([round(r['factor'], 3) for r in _scope2_market(self.report)['rows']], [0.436])   # not 0.469
        self.assertEqual(self.client.get(f'/api/questionnaire/{self.report.id}/iso-report/?lang=en').status_code, 200)
        self.assertEqual(self._rows(), [('turkey-grid-transmission', 1000.0, 436.0)])                  # reading recalculated nothing
        self.assertEqual(self._history('facility_unlinked_from_locked_inventory'), [])                 # nothing was unlinked

    def test_no_default_grid_note_is_shown_for_a_site_the_signed_inventory_recorded(self):
        """The 'connection unknown, distribution assumed' note is for electricity tied to no facility; a recorded
        site is not that (its facility cannot be deleted while the signed inventory depends on it)."""
        from .models import ReportStep
        from .step_entries import uncalculated_notes
        self._step('2A-2', self.TRANSMISSION)
        self._sign()
        self._refused_delete(self._gebze())
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
