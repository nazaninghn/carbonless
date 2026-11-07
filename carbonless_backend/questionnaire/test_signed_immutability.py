"""Stage 1: signed and completed-but-unsigned inventories, through the questionnaire, Workspace, facility and
advisor endpoints and the service functions behind them.

SIGNED (`signed_at` set): every write is refused (409 `inventory_signed`) BEFORE anything is written - answers,
the sign-off itself (no re-signing), title, draft-save, restart, delete, Workspace, advisor review, sync, resync,
facility rename/delete and the facility changes a signed inventory depends on - for every role including a
superuser, and a full dump of the affected tables equals the dump taken before the attempt.

COMPLETED BUT UNSIGNED: only the sign-off steps (`7C-*`) are accepted, and the first signing works: it signs and
records every company facility's grid connection in one transaction, never overwriting an existing key and never
reconstructing a missing one of an older inventory. Everything entry-producing is refused (409
`inventory_completed_locked`).

NOT covered, because the guards cannot cover it (see the Stage 1 report): `QuerySet.update/delete`, `bulk_*`,
raw SQL, the shell, unguarded management commands and database cascades.
"""
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone

from companies.models import CompanyMembership, Facility
from emissions.models import EmissionEntry
from . import tests as _base
from .immutability import InventoryGuardError
from .models import AdvisorApproval, CarbonReport, ReportField, ReportStep

CUTOVER = '2000-01-01T00:00:00+00:00'
SIGN = {'signatory_name': 'Ayşe Demir', 'signatory_title': 'Müdür', 'declaration_accepted': 'accepted'}


def dump():
    from emissions.models import CustomEmissionRequest, ReductionTarget
    return {m.__name__: list(m.objects.order_by('pk').values())
            for m in (EmissionEntry, CarbonReport, ReportStep, ReportField, AdvisorApproval, Facility,
                      CustomEmissionRequest, ReductionTarget)}


@_base.signing_without_the_completion_gate
@override_settings(INVENTORY_OWNERSHIP_CUTOVER=CUTOVER)
class _Base(TestCase):
    _factor = _base.StepEntriesTests._factor
    _step = _base.StepEntriesTests._step

    def setUp(self):
        from rest_framework.test import APIClient
        from django.core.cache import cache
        cache.clear()                       # rate-limit counters live in the shared cache and test users reuse the
        self.addCleanup(cache.clear)        # same ids: start clean, and leave nothing behind for the next test
        _base.StepEntriesTests.setUp(self)          # company, self.user = owner, self.report (2025), self.client
        self.roles = {'owner': self.user}
        for name, role, superuser in (('admin', 'admin', False), ('manager', 'manager', False),
                                      ('entry', 'data_entry', False), ('root', 'owner', True)):
            u = (User.objects.create_superuser if superuser else User.objects.create_user)(
                name, f'{name}@test.com', 'pass12345')
            CompanyMembership.objects.create(user=u, company=self.company, role=role)
            self.roles[name] = u
        self.api = APIClient()
        self._build()

    # -- a realistic inventory: gas, a facility with a grid connection, the facility's electricity ----
    def _build(self):
        self._factor('natural-gas-m3', 'm3', Decimal('2.02'), scope='scope1')
        self._factor('turkey-grid', 'kwh', Decimal('0.4'), scope='scope2')
        self._step('3A-5', {'natural_gas': '10000 m³'})
        self._step('2A-2', {'1': {'name': 'Gebze', 'country': 'TR', 'grid_connection': 'distribution'}})
        self._step('4A-1', {'1': '1000 kWh'})
        self.facility = Facility.objects.get(company=self.company, name='Gebze')
        self.approval = AdvisorApproval.objects.create(
            report=self.report, question_id='3A-EF-a', field_id='x', reason_code='supplier_declaration',
            trigger_category='Veri Girişi', risk_level='medium')

    def _sign(self):
        self._step('7C-2', SIGN)
        self.report.refresh_from_db()
        self.assertIsNotNone(self.report.signed_at)

    def _as(self, name):
        self.api.force_authenticate(user=self.roles[name])

    def _refused(self, res, code='inventory_signed'):
        self.assertEqual(res.status_code, 409, res.content)
        self.assertEqual(res.json().get('code'), code, res.content)
        self.assertTrue(res.json().get('message_en') and res.json().get('message_tr'))

    def _attempts(self):
        """Every questionnaire-side way of writing to the inventory, as (name, call)."""
        rid = self.report.id
        return [
            ('answer', lambda: self.api.patch(f'/api/questionnaire/{rid}/step/', {
                'step': '3A-5', 'data': {'answer': {'natural_gas': '99999 m³'}}}, format='json')),
            ('profile step', lambda: self.api.patch(f'/api/questionnaire/{rid}/step/', {
                'step': 'A1', 'data': {'legal_name': 'x'}}, format='json')),
            ('re-sign', lambda: self.api.patch(f'/api/questionnaire/{rid}/step/', {
                'step': '7C-2', 'data': {'answer': SIGN}}, format='json')),
            ('sign-off flow step', lambda: self.api.patch(f'/api/questionnaire/{rid}/step/', {
                'step': '7C-1', 'data': {'answer': 'all_complete'}}, format='json')),
            ('title', lambda: self.api.patch(f'/api/questionnaire/{rid}/title/', {'title': 'renamed'}, format='json')),
            ('draft', lambda: self.api.patch(f'/api/questionnaire/{rid}/draft/', {'title': 'x'}, format='json')),
            ('restart', lambda: self.api.post(f'/api/questionnaire/{rid}/restart/', {}, format='json')),
            ('delete', lambda: self.api.delete(f'/api/questionnaire/{rid}/')),
            ('workspace', lambda: self.api.post('/api/questionnaire/report-fields/bulk-upsert/', {
                'report': rid, 'fields': [{'field_id': 'rf.4a.consumption_kwh', 'value': 5}]}, format='json')),
            ('advisor', lambda: self.api.post(f'/api/questionnaire/advisor-approvals/{self.approval.pk}/approve/',
                                              {'action': 'approve'}, format='json')),
        ]


class FirstSigningTests(_Base):
    def test_the_first_signing_signs_and_records_every_facility_connection(self):
        self.assertEqual(self.report.applied_grid_connections or {}, {})
        self._sign()
        self.assertEqual(self.report.applied_grid_connections, {str(self.facility.pk): 'distribution'})

    def test_an_existing_snapshot_key_is_never_overwritten(self):
        CarbonReport.objects.filter(pk=self.report.pk).update(
            applied_grid_connections={str(self.facility.pk): 'transmission'})
        self._sign()
        self.assertEqual(self.report.applied_grid_connections, {str(self.facility.pk): 'transmission'})

    def test_a_completed_but_unsigned_inventory_can_still_be_signed_without_a_sync(self):
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED)
        entries = list(EmissionEntry.objects.order_by('pk').values())
        self._sign()
        self.assertEqual(list(EmissionEntry.objects.order_by('pk').values()), entries)    # no sync: rows untouched

    def test_a_missing_snapshot_of_an_older_inventory_is_never_reconstructed(self):
        self._sign()
        CarbonReport.objects.filter(pk=self.report.pk).update(applied_grid_connections={})     # a legacy signed one
        self._as('owner')
        for _name, call in self._attempts():
            call()                                                                   # all refused
        # a connection change the inventory depends on is refused, and nothing is recorded as a side effect
        res = self.api.patch(f'/api/companies/facilities/{self.facility.pk}/', {'grid_connection': 'transmission'},
                             format='json')
        self._refused(res, 'facility_locked_by_signed_inventory')
        self.report.refresh_from_db()
        self.assertEqual(self.report.applied_grid_connections, {})


class CompletedUnsignedTests(_Base):
    def setUp(self):
        super().setUp()
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED)
        self.report.refresh_from_db()
        self._as('owner')

    def test_everything_but_the_sign_off_steps_is_refused_and_nothing_changes(self):
        before = dump()
        for step, data in (('3A-5', {'answer': {'natural_gas': '99999 m³'}}), ('A1', {'legal_name': 'x'}),
                           ('4A-1', {'answer': {'1': '5 kWh'}})):
            res = self.api.patch(f'/api/questionnaire/{self.report.id}/step/', {'step': step, 'data': data},
                                 format='json')
            self._refused(res, 'inventory_completed_locked')
        res = self.api.post('/api/questionnaire/report-fields/bulk-upsert/', {
            'report': self.report.id, 'fields': [{'field_id': 'rf.4a.consumption_kwh', 'value': 5}]}, format='json')
        self._refused(res, 'inventory_completed_locked')
        self.assertEqual(self.api.post(f'/api/questionnaire/{self.report.id}/restart/', {}, format='json').status_code,
                         400)                                                        # existing rule, unchanged
        self.assertEqual(dump(), before)

    def test_no_synchronisation_runs(self):
        from .step_entries import resync_inventory, sync_step_entries
        before = dump()
        with self.assertRaises(InventoryGuardError) as cm:
            sync_step_entries(self.user, self.company, self.report, '4A-1')
        self.assertEqual(cm.exception.code, 'inventory_completed_locked')
        self.assertEqual(resync_inventory(self.company, 2025, self.user), [])
        self.assertEqual(dump(), before)

    def test_the_sign_off_flow_and_a_rename_are_still_allowed(self):
        res = self.api.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': '7C-1', 'data': {'answer': 'all_complete'}}, format='json')
        self.assertNotEqual(res.status_code, 409, res.content)
        res = self.api.patch(f'/api/questionnaire/{self.report.id}/title/', {'title': 'renamed'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)


class SignedInventoryTests(_Base):
    def setUp(self):
        super().setUp()
        self._sign()

    # Who can even reach the guard differs by endpoint (a role check or "not your report" answers first);
    # where a role reaches it, the answer must be the 409. Whatever the answer, nothing changes.
    MUST_REACH_THE_GUARD = {
        'workspace': ('owner',),                       # a Workspace report is looked up by its creator
        'delete': ('owner', 'admin', 'root'),          # deleting needs owner/admin (or the creator, a draft)
        'advisor': ('owner', 'admin', 'manager', 'root'),
    }

    def test_every_role_is_refused_every_write_and_nothing_changes(self):
        everyone_but_data_entry = ('owner', 'admin', 'manager', 'root')
        for who in self.roles:
            self._as(who)
            for name, call in self._attempts():
                before = dump()
                res = call()
                self.assertIn(res.status_code, (403, 404, 409), (who, name, res.content))
                if res.status_code == 409:
                    self.assertEqual(res.json().get('code'), 'inventory_signed', (who, name, res.content))
                if who in self.MUST_REACH_THE_GUARD.get(name, everyone_but_data_entry):
                    self.assertEqual(res.status_code, 409, (who, name, res.content))
                self.assertEqual(dump(), before, (who, name))

    def test_a_signed_and_completed_inventory_is_just_as_closed(self):
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED)
        self._as('owner')
        for name, call in self._attempts():
            if name == 'restart':
                continue                                           # an existing 400 for any completed inventory
            before = dump()
            res = call()
            self.assertIn(res.status_code, (403, 404, 409), (name, res.content))
            self.assertEqual(dump(), before, name)

    def test_the_service_functions_refuse_and_write_nothing(self):
        from .facility_sync import rename_in_answers
        from .step_entries import resync_inventory, sync_step_entries
        from .workspace_views import _write_workspace_entries
        before = dump()
        with self.assertRaises(InventoryGuardError) as cm:
            sync_step_entries(self.user, self.company, self.report, '4A-1')
        self.assertEqual(cm.exception.code, 'inventory_signed')
        with self.assertRaises(InventoryGuardError):
            _write_workspace_entries(self.report, self.user)
        self.assertEqual(resync_inventory(self.company, 2025, self.user), [])
        rename_in_answers(self.company, 'Gebze', 'Somewhere else', user=self.user)      # skips signed inventories
        self.assertEqual(dump(), before)

    def test_signed_figures_and_snapshots_are_unchanged_by_everything_above(self):
        entries = {e.pk: (e.quantity, e.calculated_co2e_kg, e.factor_value_snapshot, e.factor_source_snapshot)
                   for e in EmissionEntry.objects.all()}
        gas = [v for v in entries.values() if v[1] == Decimal('20200.0000')]
        self.assertEqual(len(gas), 1)                                      # 10,000 m3 x 2.02, the regression guard
        self._as('owner')
        for _name, call in self._attempts():
            call()
        self.assertEqual({e.pk: (e.quantity, e.calculated_co2e_kg, e.factor_value_snapshot, e.factor_source_snapshot)
                          for e in EmissionEntry.objects.all()}, entries)


class SignedFacilityTests(_Base):
    def setUp(self):
        super().setUp()
        self._sign()
        self._as('owner')
        self.url = f'/api/companies/facilities/{self.facility.pk}/'

    def test_a_rename_a_signed_inventory_depends_on_is_refused(self):
        before = dump()
        self._refused(self.api.patch(self.url, {'name': 'Gebze Plant'}, format='json'),
                      'facility_locked_by_signed_inventory')
        self.assertEqual(dump(), before)
        self.assertEqual(Facility.objects.get(pk=self.facility.pk).name, 'Gebze')

    def test_a_facility_an_entry_of_a_signed_inventory_points_at_cannot_be_deleted(self):
        self.assertTrue(EmissionEntry.objects.filter(facility=self.facility).exists())
        before = dump()
        self._refused(self.api.delete(self.url), 'facility_locked_by_signed_inventory')
        self.assertEqual(dump(), before)

    def test_a_connection_change_is_allowed_when_the_inventory_recorded_its_connection_and_it_stays(self):
        report_before = list(CarbonReport.objects.order_by('pk').values())
        entries_before = list(EmissionEntry.objects.order_by('pk').values())
        steps_before = list(ReportStep.objects.order_by('pk').values())
        res = self.api.patch(self.url, {'grid_connection': 'transmission'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(Facility.objects.get(pk=self.facility.pk).grid_connection, 'transmission')
        self.assertEqual(list(CarbonReport.objects.order_by('pk').values()), report_before)      # snapshot untouched
        self.assertEqual(list(EmissionEntry.objects.order_by('pk').values()), entries_before)
        self.assertEqual(list(ReportStep.objects.order_by('pk').values()), steps_before)

    def test_a_connection_change_is_refused_when_a_legacy_signed_inventory_recorded_nothing(self):
        CarbonReport.objects.filter(pk=self.report.pk).update(applied_grid_connections={})
        before = dump()
        self._refused(self.api.patch(self.url, {'grid_connection': 'transmission'}, format='json'),
                      'facility_locked_by_signed_inventory')
        self.assertEqual(dump(), before)
        self.assertEqual(Facility.objects.get(pk=self.facility.pk).grid_connection, 'distribution')

    def test_a_country_change_needs_the_signed_inventory_to_state_the_country(self):
        res = self.api.patch(self.url, {'country': 'DE'}, format='json')           # the signed 2A-2 states 'TR'
        self.assertEqual(res.status_code, 200, res.content)
        Facility.objects.filter(pk=self.facility.pk).update(country='TR')
        step = ReportStep.objects.get(report=self.report, step_id='2A-2')
        answer = step.answer.get('answer', step.answer)
        answer['1'].pop('country')                                                   # a legacy answer without a country
        ReportStep.objects.filter(pk=step.pk).update(answer=step.answer)
        before = dump()
        self._refused(self.api.patch(self.url, {'country': 'DE'}, format='json'), 'facility_locked_by_signed_inventory')
        self.assertEqual(dump(), before)


class AtomicityTests(_Base):
    def test_a_failure_part_way_through_a_step_save_writes_nothing(self):
        before = dump()
        self.client.raise_request_exception = False
        with mock.patch('questionnaire.views.sync_step_entries', side_effect=RuntimeError('boom')):
            res = self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
                'step': '3A-5', 'data': {'answer': {'natural_gas': '77777 m³'}}}, format='json')
        self.assertEqual(res.status_code, 500)
        self.assertEqual(dump(), before)                  # the answer was rolled back together with everything else


class DisabledCommandTests(_Base):
    def test_backfill_calc_detail_is_disabled_and_changes_nothing(self):
        before = dump()
        with self.assertRaises(CommandError):
            call_command('backfill_calc_detail')
        self.assertEqual(dump(), before)


class GateTests(_Base):
    """Phase 2: the gate (immutability.lock_and_check) is the first statement of a write transaction, changes
    no value, and decides on the locked row, not on the object the caller loaded earlier."""

    def test_the_gate_is_a_conditional_no_op_update_and_changes_no_value(self):
        from django.db import connection, transaction
        from django.test.utils import CaptureQueriesContext
        from .immutability import lock_and_check
        before = list(CarbonReport.objects.filter(pk=self.report.pk).values())
        with transaction.atomic(), CaptureQueriesContext(connection) as ctx:
            lock_and_check(self.report, step='3A-5', entry_producing=True)
        first = ctx.captured_queries[0]['sql']
        self.assertTrue(first.startswith('UPDATE "questionnaire_carbonreport"'), first)       # the FIRST statement
        self.assertIn('"signed_at" IS NULL', first)
        self.assertNotIn('"updated_at"', first)
        self.assertEqual(list(CarbonReport.objects.filter(pk=self.report.pk).values()), before)   # nothing changed

    def test_a_stale_object_cannot_pass_the_gate_after_a_concurrent_signing(self):
        from django.db import transaction
        from .immutability import lock_and_check
        stale = CarbonReport.objects.get(pk=self.report.pk)                  # loaded before the signing
        CarbonReport.objects.filter(pk=self.report.pk).update(signed_at=timezone.now())
        with transaction.atomic():
            with self.assertRaises(InventoryGuardError) as cm:
                lock_and_check(stale, step='3A-5', entry_producing=True)
        self.assertEqual(cm.exception.code, 'inventory_signed')

    def test_completed_state_is_read_from_the_database_not_from_the_object_in_hand(self):
        from django.db import transaction
        from .immutability import lock_and_check
        stale = CarbonReport.objects.get(pk=self.report.pk)
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED)
        with transaction.atomic():
            with self.assertRaises(InventoryGuardError) as cm:
                lock_and_check(stale, step='3A-5', entry_producing=True)
            self.assertEqual(cm.exception.code, 'inventory_completed_locked')
            lock_and_check(stale, step='7C-1', entry_producing=False)         # a sign-off step still passes

    def test_the_gate_alone_refuses_a_save_when_the_fail_fast_read_is_bypassed(self):
        # Simulates the race: the unlocked pre-check saw an open inventory, then it was signed / completed.
        CarbonReport.objects.filter(pk=self.report.pk).update(signed_at=timezone.now())
        before = dump()
        with mock.patch('questionnaire.immutability.check_report'):          # the fail-fast read is a no-op
            self._as('owner')
            for step, data in (('3A-5', {'answer': {'natural_gas': '99999 m³'}}), ('A1', {'legal_name': 'x'}),
                               ('7C-2', {'answer': SIGN})):
                res = self.api.patch(f'/api/questionnaire/{self.report.id}/step/', {'step': step, 'data': data},
                                     format='json')
                self._refused(res)                                            # 409 inventory_signed, from the gate
        self.assertEqual(dump(), before)
        CarbonReport.objects.filter(pk=self.report.pk).update(signed_at=None,
                                                              status=CarbonReport.Status.COMPLETED)
        before = dump()
        with mock.patch('questionnaire.immutability.check_report'):
            res = self.api.patch(f'/api/questionnaire/{self.report.id}/step/', {
                'step': '3A-5', 'data': {'answer': {'natural_gas': '99999 m³'}}}, format='json')
            self._refused(res, 'inventory_completed_locked')
        self.assertEqual(dump(), before)
