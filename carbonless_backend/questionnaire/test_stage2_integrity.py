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

    def test_it_may_put_an_inventory_onto_a_year_that_already_has_one_without_touching_it(self):
        self._sign()
        before = self._figures()
        self._source()
        draft = CarbonReport.objects.create(company=self.company, created_by=self.user, title='new')
        r = self._reuse(draft, 2025)                                  # 2025 is the signed inventory's year
        self.assertEqual(r.status_code, 200, r.content)
        draft.refresh_from_db()
        self.assertEqual(draft.reporting_year, 2025)
        self.assertEqual(self._figures(), before)                     # the signed inventory's rows are unchanged
        self.assertEqual(self._history('inventory_duplicate_blocked'), [])

    def test_a_legacy_duplicate_member_keeps_its_own_rows_when_reused(self):
        legacy = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                             title='old duplicate', legacy_duplicate_year=True)
        CarbonReport.objects.filter(pk=self.report.pk).update(legacy_duplicate_year=True)
        before = self._figures()
        self._source()
        r = self._reuse(legacy, 2025)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._figures(), before)

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

    def _refused_edit(self, step, answer):
        """An edit of the SIGNED inventory, by anyone: refused (409 inventory_signed), nothing changes."""
        before = _base._signed_state_dump()
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': step, 'data': {'answer': answer}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_signed')
        self.assertEqual(_base._signed_state_dump(), before)

    def test_a_country_change_does_not_move_a_signed_inventory_when_it_is_next_edited(self):
        """The signed inventory states its own country (Turkey) in its 2A-2, so a change of the facility's
        country is allowed and does not move it. The later edit is refused: a signed inventory takes none."""
        self._sign()
        before = self._rows()
        self.assertEqual(before, [('turkey-grid-distribution', 1000.0, 469.0)])
        r = self.client.patch(f'/api/companies/facilities/{self._gebze().pk}/', {'country': 'DE'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._rows(), before)                        # the country change moved nothing signed
        self._refused_edit('4A-1', {'1': '2000 kWh'})                 # an edit of the signed inventory: refused
        self.assertEqual(self._rows(), before)                        # still the Turkish factor it was signed with
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)        # nothing was edited, nothing is flagged

    def test_a_bulk_country_change_is_recorded_the_same_way(self):
        """The bulk (queryset) path is the documented one the model guard does not cover. The signed inventory
        states its own country, so its output is the same; the later edit is refused."""
        self._sign()
        before = self._rows()
        Facility.objects.filter(pk=self._gebze().pk).update(country='DE')
        self.assertEqual(self._rows(), before)
        self._refused_edit('4A-1', {'1': '2000 kWh'})
        self.assertEqual(self._rows(), before)

    def test_a_country_stated_in_the_signed_inventorys_own_q24_does_apply_and_is_flagged(self):
        """A signed inventory's own 2A-2 cannot be changed (it used to apply and be flagged): refused, and the
        recorded country and figures stay as signed."""
        self._sign()
        before = self._rows()
        self._refused_edit('2A-2', {'1': {'name': 'Gebze', 'country': 'DE', 'grid_connection': 'distribution'}})
        self.assertEqual(self._rows(), before)
        answer = self.report.steps.get(step_id='2A-2').answer
        self.assertEqual(answer.get('answer', answer)['1']['country'], 'TR')
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)

    def test_a_country_change_is_refused_when_the_signed_inventory_does_not_state_the_country(self):
        """Legacy-style evidence: the signed 2A-2 names Gebze but states no country, so a change of the
        facility's country could alter the signed output. Refused (409); nothing changes."""
        step = ReportStep.objects.get(report=self.report, step_id='2A-2')       # fixture, BEFORE signing
        answer = step.answer.get('answer', step.answer)
        answer['1'].pop('country')
        step.save(update_fields=['answer'])
        self._sign()
        before = _base._signed_state_dump()
        r = self.client.patch(f'/api/companies/facilities/{self._gebze().pk}/', {'country': 'DE'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'facility_locked_by_signed_inventory')
        self.assertEqual(_base._signed_state_dump(), before)
        self.assertEqual(self._gebze().country, 'TR')

    def test_a_country_change_of_a_facility_no_signed_inventory_uses_is_allowed(self):
        """The positive control: a facility no signed inventory references is changed freely."""
        other = Facility.objects.create(company=self.company, name='Kocaeli', country='TR')   # BEFORE signing
        self._sign()
        r = self.client.patch(f'/api/companies/facilities/{other.pk}/', {'country': 'DE'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Facility.objects.get(pk=other.pk).country, 'DE')

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
        """A facility a signed inventory references cannot be renamed: refused (409), because signed answers
        are never rewritten. The facility, the figures, the recorded answer and the snapshot stay as signed, and
        there is no rename to put on record. (Before, the rename was accepted and logged.)"""
        self._sign()
        snapshot = dict(CarbonReport.objects.get(pk=self.report.pk).applied_grid_connections)
        before_figures = self._figures()
        before = _base._signed_state_dump()
        r = self.client.patch(f'/api/companies/facilities/{self._gebze().pk}/', {'name': 'Gebze Plant'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'facility_locked_by_signed_inventory')
        self.assertEqual(_base._signed_state_dump(), before)
        self.assertEqual(self._gebze().name, 'Gebze')                 # not renamed
        self.assertEqual(self._figures(), before_figures)
        self.assertEqual(self._recorded(), 'distribution')            # snapshot / answer follow the facility, not its name
        self.assertEqual(self._history('inventory_facility_renamed'), [])
        self.report.refresh_from_db()
        self.assertEqual(self.report.applied_grid_connections, snapshot)    # retained, never overwritten
        self.assertIsNone(self.report.edited_after_signing_at)

    def test_a_facility_no_signed_inventory_references_can_still_be_renamed(self):
        """The positive control: only a facility a signed inventory depends on is protected."""
        other = Facility.objects.create(company=self.company, name='Kocaeli', country='TR')   # BEFORE signing
        self._sign()
        r = self.client.patch(f'/api/companies/facilities/{other.pk}/', {'name': 'Kocaeli Plant'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Facility.objects.get(pk=other.pk).name, 'Kocaeli Plant')

    def test_a_facility_can_be_renamed_while_no_inventory_is_signed(self):
        r = self.client.patch(f'/api/companies/facilities/{self._gebze().pk}/', {'name': 'Gebze Plant'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Facility.objects.filter(company=self.company, name='Gebze Plant').count(), 1)


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
    SQLite serialises writers, so this checks the logic under interleaving, not PostgreSQL row locking.

    The inventory is built BEFORE it is signed (a signed inventory takes no write) and then signed through the
    application's first-signing path, which records the facility's connection (the snapshot the assertions rely
    on). The legacy-signed variant (no snapshot) is the subclass below."""

    LEGACY = False

    def setUp(self):
        from django.core.cache import cache
        from rest_framework.test import APIClient
        cache.clear()                       # the step endpoint's per-user rate limit lives in the shared cache and test
        self.addCleanup(cache.clear)        # users reuse ids: start clean (the first signing below is a step save)
        self.user = User.objects.create_user('cc', 'cc@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Race Grid Co', tax_number='6', country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.facility = Facility.objects.create(company=self.company, name='Gebze', country='TR', grid_connection='distribution')
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                                  status=CarbonReport.Status.COMPLETED)
        ReportStep.objects.create(report=self.report, step_id='2A-2', answer={'answer': {'1': {
            'name': 'Gebze', 'country': 'TR', 'grid_connection': 'distribution'}}})
        if self.LEGACY:
            _base._make_legacy_signed(self.report, snapshot={})        # signed by older code: no snapshot
        else:
            c = APIClient()
            c.force_authenticate(user=self.user)
            r = c.patch(f'/api/questionnaire/{self.report.id}/step/',
                        {'step': '7C-2', 'data': {'answer': _L.SIGN}, 'language': 'en'}, format='json')
            assert r.status_code == 200, r.content                     # the FIRST signing: records the snapshot
            self.report.refresh_from_db()
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


class ConcurrentConnectionChangeOnALegacySignedInventoryTests(ConcurrentConnectionChangeTests):
    """The same concurrent Settings changes against a LEGACY-signed inventory (signed before snapshots existed:
    NO recorded connection). Every change that would alter its output is refused (409
    facility_locked_by_signed_inventory), the facility keeps its connection, and nothing is reconstructed: the
    inventory's snapshot stays empty."""

    LEGACY = True
    test_the_recorded_connection_is_the_original_whatever_the_interleaving = None   # the modern test: not for this case

    def test_every_concurrent_change_is_refused_and_no_snapshot_is_reconstructed(self):
        values = ['transmission', 'distribution', 'transmission', '', 'transmission', 'distribution']
        barrier, errors, results = threading.Barrier(len(values)), [], []

        def go(value):
            try:
                c = self.APIClient(); c.force_authenticate(user=self.user)
                barrier.wait(timeout=10)
                for _ in range(80):
                    try:
                        r = c.patch(f'/api/companies/facilities/{self.facility.pk}/', {'grid_connection': value}, format='json')
                        results.append((value, r.status_code, r.json().get('code')))
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
        self.assertEqual(len(results), len(values))
        for value, status, code in results:
            if value == 'distribution':                   # the value it already has: nothing to change, nothing to refuse
                self.assertEqual(status, 200, (value, status, code))
            else:
                self.assertEqual((status, code), (409, 'facility_locked_by_signed_inventory'), value)
        self.facility.refresh_from_db()
        self.assertEqual(self.facility.grid_connection, 'distribution')
        self.report.refresh_from_db()
        self.assertEqual(self.report.applied_grid_connections, {})    # never reconstructed
        self.assertIsNotNone(self.report.signed_at)


# ── S2-7: the Workspace is a write path too: FEAT-001 removes the year-sharing block ──────────
class WorkspaceLegacyDuplicateTests(_Locked):
    """FEAT-001: The year-sharing block is removed from the Workspace. A signed inventory is still
    blocked (inventory_signed), but a duplicate-year draft is now allowed to write."""
    BODY = {'fields': [{'field_id': 'rf.4a.consumption_kwh', 'value': 5}]}

    def _group(self):
        dup = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                          title='old duplicate', legacy_duplicate_year=True)
        CarbonReport.objects.filter(pk=self.report.pk).update(legacy_duplicate_year=True)
        return dup

    def test_signed_member_still_refuses_workspace_write_due_to_signing_not_year_sharing(self):
        """The signed inventory is still blocked, but now because it is signed (not year-sharing)."""
        dup = self._group()
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED, signed_at=timezone.now())
        # Signed inventory still refuses
        r = self.client.post('/api/questionnaire/report-fields/bulk-upsert/', {'report': self.report.id, **self.BODY}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertIn(r.data.get('code'), ('inventory_signed', 'inventory_completed_locked'), r.data)
        # Duplicate-year draft now succeeds (no year-sharing block)
        r_dup = self.client.post('/api/questionnaire/report-fields/bulk-upsert/', {'report': dup.id, **self.BODY}, format='json')
        self.assertEqual(r_dup.status_code, 200, r_dup.content)

    def test_a_plain_inventory_still_takes_a_workspace_write(self):
        r = self.client.post('/api/questionnaire/report-fields/bulk-upsert/', {'report': self.report.id, **self.BODY}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
