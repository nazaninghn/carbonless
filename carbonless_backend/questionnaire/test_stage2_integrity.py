"""Stage 2 audit: migration safety and the facility / grid-connection paths.

Each test states what must hold for a signed or completed inventory (history) or for the
one-inventory-per-year rule, and is a regression test for the finding named in its class.

Fixtures: LockedInventoryGridConnectionTests' Turkish company with a 2025 inventory, one facility
(Gebze, TR, distribution grid) and 1,000 kWh of electricity (469 kg CO2e at the distribution factor)."""
import threading
import time

from django.contrib.auth.models import User
from django.db import OperationalError, connection
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from accounts.models import ActivityLog
from companies.models import Company, CompanyMembership, Facility
from emissions.models import EmissionEntry
from . import tests as _base
from .models import CarbonReport, ReportStep

_L = _base.LockedInventoryGridConnectionTests


class _Locked(TestCase):
    setUp = _L.setUp
    _factor, _step, _entries = _L._factor, _L._step, _L._entries
    SIGN, DISTRIBUTION, TRANSMISSION = _L.SIGN, _L.DISTRIBUTION, _L.TRANSMISSION
    _rows, _sign, _settings, _kept_rows, _recorded = _L._rows, _L._sign, _L._settings, _L._kept_rows, _L._recorded

    def _gebze(self):
        return Facility.objects.get(company=self.company, name='Gebze')

    def _figures(self, year=2025):
        return sorted((e.description, round(float(e.quantity), 4), round(float(e.calculated_co2e_kg), 4), e.status,
                       e.facility_id) for e in EmissionEntry.objects.filter(company=self.company, year=year))

    def _history(self, action):
        return list(ActivityLog.objects.filter(action=action))

    def _dashboard_kg(self):
        return self.client.get('/api/emissions/summary/?year=2025').data['total_kg']


# ── S2-1: reuse-profile is a write path that skipped the one-inventory-per-year guard ──────────
class ReuseProfileTests(_Locked):
    """POST /<id>/reuse-profile/ sets the inventory's reporting year (and status) from the request."""

    def _source(self):
        """An earlier inventory with a Phase 1 answer, so there is a profile to reuse."""
        src = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2020, title='src')
        ReportStep.objects.create(report=src, step_id='A1', answer={'legal_name': 'Ent Co'})
        return src

    def _reuse(self, report, year):
        return self.client.post(f'/api/questionnaire/{report.id}/reuse-profile/', {'reporting_year': year}, format='json')

    def test_it_cannot_put_an_inventory_onto_a_year_that_already_has_one(self):
        self._sign()
        before = self._figures()
        self._source()
        draft = CarbonReport.objects.create(company=self.company, created_by=self.user, title='new')
        r = self._reuse(draft, 2025)                                  # 2025 is the signed inventory's year
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_exists_for_year')
        draft.refresh_from_db()
        self.assertIsNone(draft.reporting_year)                       # not moved
        self.assertEqual(self._figures(), before)
        [row] = self._history('inventory_duplicate_blocked')          # the attempt on a signed year is on record
        self.assertEqual(row.target_id, str(self.report.pk))

    def test_a_member_of_a_legacy_duplicate_group_cannot_be_moved_onto_a_covered_year_either(self):
        legacy = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                             title='old duplicate', legacy_duplicate_year=True)
        CarbonReport.objects.filter(pk=self.report.pk).update(legacy_duplicate_year=True)
        self._source()
        r = self._reuse(legacy, 2025)                                 # even to the year it already has: it cannot write
        self.assertEqual(r.status_code, 409, r.content)

    def test_it_does_not_reopen_or_overwrite_a_signed_inventory(self):
        self._sign()
        self._source()
        before_status, before_steps = self.report.status, dict(self.report.steps.values_list('step_id', 'answer'))
        r = self._reuse(self.report, 2025)
        self.assertGreaterEqual(r.status_code, 400, r.content)        # refused
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, before_status)           # still completed
        self.assertIsNotNone(self.report.signed_at)
        self.assertEqual(dict(self.report.steps.values_list('step_id', 'answer')), before_steps)

    def test_a_new_year_still_works(self):
        self._source()
        draft = CarbonReport.objects.create(company=self.company, created_by=self.user, title='new')
        r = self._reuse(draft, 2023)
        self.assertEqual(r.status_code, 200, r.content)
        draft.refresh_from_db()
        self.assertEqual((draft.reporting_year, draft.status), (2023, CarbonReport.Status.IN_PROGRESS))


# ── S2-2: what a facility's country does to an inventory that is history ───────────────────────
class FacilityCountryTests(_Locked):
    """The grid factor follows the facility's country as well as its connection. Only the connection
    was recorded in a signed inventory, so a later country change moved its next recalculation."""

    def test_a_country_change_does_not_move_a_signed_inventory_when_it_is_next_edited(self):
        self._sign()
        before = self._rows()
        self.assertEqual(before, [('turkey-grid-distribution', 1000.0, 469.0)])
        r = self.client.patch(f'/api/companies/facilities/{self._gebze().pk}/', {'country': 'DE'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self._step('4A-1', {'1': '2000 kWh'})                         # an authorised edit of the signed inventory
        self.assertEqual(self._rows(), [('turkey-grid-distribution', 2000.0, 938.0)])   # still the Turkish factor it was signed with
        self.report.refresh_from_db()
        self.assertIsNotNone(self.report.edited_after_signing_at)     # and the edit is flagged

    def test_a_bulk_country_change_is_recorded_the_same_way(self):
        self._sign()
        Facility.objects.filter(pk=self._gebze().pk).update(country='DE')
        self._step('4A-1', {'1': '2000 kWh'})
        self.assertEqual(self._rows(), [('turkey-grid-distribution', 2000.0, 938.0)])

    def test_a_country_stated_in_the_signed_inventorys_own_q24_does_apply_and_is_flagged(self):
        """The inventory's own 2A-2 is its record of the country: an approver who changes it there means it."""
        self._sign()
        self._step('2A-2', {'1': {'name': 'Gebze', 'country': 'DE', 'grid_connection': 'distribution'}})
        self.assertNotEqual([r[0] for r in self._rows()], ['turkey-grid-distribution'])
        self.report.refresh_from_db()
        self.assertIsNotNone(self.report.edited_after_signing_at)

    def test_a_draft_inventory_follows_a_country_change(self):
        self.client.patch(f'/api/companies/facilities/{self._gebze().pk}/', {'country': 'DE'}, format='json')
        self._step('4A-1', {'1': '2000 kWh'})
        self.assertNotEqual([r[0] for r in self._rows()], ['turkey-grid-distribution'])   # a draft is not history


# ── S2-3: deleting a facility that an approved, signed inventory points at ─────────────────────
class FacilityDeleteTests(_Locked):

    def test_deleting_a_facility_is_named_in_the_history_of_the_signed_inventory_it_unlinks(self):
        self._sign()
        pk = self._gebze().pk
        self.assertTrue(EmissionEntry.objects.filter(company=self.company, facility_id=pk).exists())
        r = self.client.delete(f'/api/companies/facilities/{pk}/')
        self.assertIn(r.status_code, (204, 409), r.content)
        if r.status_code == 204:                                      # allowed: then it must be on record
            rows = self._history('facility_unlinked_from_locked_inventory')
            self.assertEqual(len(rows), 1)
            self.assertEqual((rows[0].target_type, rows[0].target_id), ('CarbonReport', str(self.report.pk)))
            self.assertEqual(rows[0].metadata['facility'], 'Gebze')
        # totals never move
        self.assertEqual(round(self._dashboard_kg(), 2), 469.0)

    def test_deleting_a_facility_of_a_draft_inventory_leaves_no_locked_inventory_row(self):
        pk = self._gebze().pk
        self.assertEqual(self.client.delete(f'/api/companies/facilities/{pk}/').status_code, 204)
        self.assertEqual(self._history('facility_unlinked_from_locked_inventory'), [])


# ── S2-4: renaming a facility rewrites the stored answers of signed inventories ────────────────
class FacilityRenameTests(_Locked):

    def test_a_rename_changes_no_figure_and_is_named_in_the_history_of_a_signed_inventory(self):
        self._sign()
        before = [(d, q, kg, s) for d, q, kg, s, _f in self._figures()]
        r = self.client.patch(f'/api/companies/facilities/{self._gebze().pk}/', {'name': 'Gebze Plant'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual([(q, kg, s) for _d, q, kg, s, _f in self._figures()], [(q, kg, s) for _d, q, kg, s in before])
        self.assertEqual(self._recorded(), 'distribution')            # snapshot / answer follow the facility, not its name
        rows = self._history('inventory_facility_renamed')
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0].target_type, rows[0].target_id), ('CarbonReport', str(self.report.pk)))
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)        # a label, not a figure: logged, not "edited after signing"


# ── S2-5: an unapproved proposal reaches nothing that is history ───────────────────────────────
class ProposalIsolationTests(_Locked):

    def setUp(self):
        super().setUp()
        from rest_framework.test import APIClient
        self.clerk = User.objects.create_user('clerk2', 'clerk2@test.com', 'pass12345')
        CompanyMembership.objects.create(user=self.clerk, company=self.company, role='data_entry')
        self.c_clerk = APIClient()
        self.c_clerk.force_authenticate(user=self.clerk)

    def test_a_data_entry_proposal_in_a_signed_inventory_changes_no_total_and_no_report(self):
        from .iso_report_pdf import _scope2_market
        self._sign()
        figures, dash = self._figures(), self._dashboard_kg()
        market = [round(r['factor'], 3) for r in _scope2_market(self.report)['rows']]
        r = self.c_clerk.patch(f'/api/questionnaire/{self.report.id}/step/',
                               {'step': '2A-2', 'data': {'answer': self.TRANSMISSION}, 'language': 'en'}, format='json')
        self.assertIn(r.status_code, (200, 403, 409), r.content)
        self.assertEqual(self._gebze().grid_connection, 'distribution')              # the facility is untouched
        self.assertEqual(self._figures(), figures)                                    # no entry changed
        self.assertEqual(self._dashboard_kg(), dash)                                  # the Dashboard total did not move
        self.assertEqual([round(x['factor'], 3) for x in _scope2_market(self.report)['rows']], market)
        self.assertEqual(self.client.get(f'/api/questionnaire/{self.report.id}/iso-report/?lang=en').status_code, 200)
        self.assertEqual(self._figures(), figures)                                    # building the report recalculated nothing
        self.assertEqual(self._history('facility_connection_kept'), [])

    def test_a_data_entry_member_cannot_decide_a_proposal(self):
        self.assertIn(self.c_clerk.post(f'/api/companies/facilities/{self._gebze().pk}/connection-decision/',
                                        {'decision': 'approve'}, format='json').status_code, (403, 404))
        self.assertEqual(self._gebze().grid_connection, 'distribution')


# ── S2-6: concurrent changes of one facility's connection (SQLite only — see the report) ───────
class ConcurrentConnectionChangeTests(TransactionTestCase):
    """Several Settings changes of one facility's connection at once, with a signed inventory
    holding entries calculated with the original. The recorded connection must be the original
    (the first value only), never an intermediate one, and the signed figures must not move.
    SQLite serialises writers, so this checks the logic under interleaving, not PostgreSQL row locking."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.user = User.objects.create_user('cc', 'cc@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Race Grid Co', tax_number='6', country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.facility = Facility.objects.create(company=self.company, name='Gebze', country='TR', grid_connection='distribution')
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                                  status=CarbonReport.Status.COMPLETED, signed_at=timezone.now())
        ReportStep.objects.create(report=self.report, step_id='2A-2', answer={'answer': {'1': {
            'name': 'Gebze', 'country': 'TR', 'grid_connection': 'distribution'}}})
        self.APIClient = APIClient

    def test_the_recorded_connection_is_the_original_whatever_the_interleaving(self):
        values = ['transmission', 'distribution', 'transmission', '', 'transmission', 'distribution']
        barrier, errors = threading.Barrier(len(values)), []

        def go(value):
            try:
                c = self.APIClient(); c.force_authenticate(user=self.user)
                barrier.wait(timeout=10)
                for _ in range(80):
                    try:
                        r = c.patch(f'/api/companies/facilities/{self.facility.pk}/', {'grid_connection': value}, format='json')
                        if r.status_code not in (200, 400):
                            errors.append(r.status_code)
                        return
                    except OperationalError:
                        time.sleep(0.05)
                errors.append('gave up')
            except Exception as exc:                      # a raw 500 would surface here
                errors.append(repr(exc))
            finally:
                connection.close()
        threads = [threading.Thread(target=go, args=(v,)) for v in values]
        [t.start() for t in threads]; [t.join(90) for t in threads]
        self.assertEqual(errors, [])
        self.report.refresh_from_db()
        self.assertEqual((self.report.applied_grid_connections or {}).get(str(self.facility.pk)), 'distribution')
        self.assertIsNotNone(self.report.signed_at)


# ── S2-7: the Workspace is a write path too: no member of a duplicate group takes a write ──────
class WorkspaceLegacyDuplicateTests(_Locked):
    """The rule for a legacy duplicate group is that none of its members can be written until the duplicate
    is resolved. The Workspace (report-fields bulk-upsert / suggestion confirm) wrote its fields into them."""
    BODY = {'fields': [{'field_id': 'rf.4a.consumption_kwh', 'value': 5}]}

    def _group(self):
        dup = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                          title='old duplicate', legacy_duplicate_year=True)
        CarbonReport.objects.filter(pk=self.report.pk).update(legacy_duplicate_year=True)
        return dup

    def test_no_member_takes_a_workspace_write_and_the_attempt_on_a_signed_one_is_recorded(self):
        from .models import ReportField
        dup = self._group()
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED, signed_at=timezone.now())
        figures = self._figures()
        for report in (dup, self.report):
            r = self.client.post('/api/questionnaire/report-fields/bulk-upsert/', {'report': report.id, **self.BODY}, format='json')
            self.assertEqual(r.status_code, 409, r.content)
            self.assertEqual(r.data['code'], 'inventory_exists_for_year')
        self.assertFalse(ReportField.objects.filter(report__company=self.company).exists())
        self.assertEqual(self._figures(), figures)
        self.assertTrue(self._history('inventory_duplicate_blocked'))

    def test_a_plain_inventory_still_takes_a_workspace_write(self):
        r = self.client.post('/api/questionnaire/report-fields/bulk-upsert/', {'report': self.report.id, **self.BODY}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
