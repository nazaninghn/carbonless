"""Multi-inventory, stage 1 (questionnaire side): an inventory reads, writes and deletes ONLY the rows it owns
(`inventory_id == report.pk`), and an inventory created before ownership existed is never written entry-wise.

* a questionnaire save tags the rows it creates with its CarbonReport; the calculation is untouched
  (regression guard: 10,000 m3 natural gas = 20,200 kg CO2e);
* an unchanged save leaves every row byte-identical; a changed answer replaces the OWNED rows only;
* unassigned (NULL-inventory) rows - whatever their description - are never read, updated, replaced, tagged or
  deleted by a scoped inventory's save, restart, delete, resync or Workspace save, and they never block it;
* an inventory created before the ownership cutover (or when the cutover is missing / invalid / has no timezone)
  is refused (409) before anything is written: save, restart, delete, resync, Workspace;
* the cutover is inclusive, compared in UTC, and the one-inventory-per-company-year constraint is untouched.

Run with `--settings=carbonless_api.settings_test` (the classes also pin the cutover themselves).
"""
from datetime import datetime, timedelta, timezone as dt_timezone
from decimal import Decimal
from unittest import mock

from django.conf import settings
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings

from emissions.models import EmissionEntry
from . import tests as _base
from .immutability import InventoryGuardError, is_ownership_scoped, ownership_cutover
from .models import CarbonReport, ReportField, ReportStep

CUTOVER = '2000-01-01T00:00:00+00:00'
FUTURE = '2999-01-01T00:00:00+00:00'


def entry_dump():
    return list(EmissionEntry.objects.order_by('pk').values())


def state_dump():
    return {'entries': entry_dump(), 'steps': list(ReportStep.objects.order_by('pk').values()),
            'fields': list(ReportField.objects.order_by('pk').values()),
            'reports': list(CarbonReport.objects.order_by('pk').values())}


@override_settings(INVENTORY_OWNERSHIP_CUTOVER=CUTOVER)
class _Base(TestCase):
    _factor = _base.StepEntriesTests._factor
    _step = _base.StepEntriesTests._step

    def setUp(self):
        from django.core.cache import cache
        cache.clear()                       # rate-limit counters live in the shared cache and test users reuse the
        self.addCleanup(cache.clear)        # same ids: start clean, and leave nothing behind for the next test
        _base.StepEntriesTests.setUp(self)        # company, owner (2025 inventory = self.report), client

    def _gas(self):
        return self._factor('natural-gas-m3', 'm3', Decimal('2.02'), scope='scope1')

    def _rows(self):
        return list(EmissionEntry.objects.filter(company=self.company, year=2025,
                                                 description__startswith='Questionnaire step ').order_by('id'))

    def _null_row(self, description, month=1):
        """An unassigned row (inventory IS NULL) with the given description."""
        return EmissionEntry.objects.create(
            user=self.user, company=self.company, emission_factor=self._gas(), year=2025, month=month,
            quantity=Decimal('5'), description=description, status='approved')

    def _patch_step(self, step='3A-5', answer=None):
        return self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': step, 'data': {'answer': answer if answer is not None else {'natural_gas': '10000 m³'}}},
            format='json')

    def _assert_refused(self, res, code):
        self.assertEqual(res.status_code, 409, res.content)
        body = res.json()
        self.assertEqual(body.get('code'), code, body)
        self.assertTrue(body.get('message_en') and body.get('message_tr'), body)


class QuestionnaireTaggingTests(_Base):
    def test_a_questionnaire_save_tags_the_new_rows_with_its_inventory(self):
        self._gas()
        self._step('3A-5', {'natural_gas': '10000 m³'})
        rows = self._rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].inventory_id, self.report.id)
        self.assertEqual(rows[0].calculated_co2e_kg, Decimal('20200.0000'))      # the regression guard, unchanged

    def test_the_calculation_is_the_same_with_and_without_the_tag(self):
        self._gas()
        self._step('3A-5', {'natural_gas': '10000 m³'})
        tagged = self._rows()[0]
        EmissionEntry.objects.filter(pk=tagged.pk).update(inventory=None)
        untagged = EmissionEntry.objects.get(pk=tagged.pk)
        self.assertEqual((tagged.quantity, tagged.calculated_co2e_kg, tagged.factor_value_snapshot),
                         (untagged.quantity, untagged.calculated_co2e_kg, untagged.factor_value_snapshot))

    def test_an_unchanged_save_leaves_every_row_byte_identical(self):
        self._gas()
        self._step('3A-5', {'natural_gas': '10000 m³'})
        before = entry_dump()
        self._step('3A-5', {'natural_gas': '10000 m³'})
        self.assertEqual(entry_dump(), before)

    def test_a_changed_answer_replaces_only_the_owned_rows_and_tags_the_new_ones(self):
        self._gas()
        self._step('3A-5', {'natural_gas': '10000 m³'})
        old_pk = self._rows()[0].pk
        self._step('3A-5', {'natural_gas': '20000 m³'})
        rows = self._rows()
        self.assertEqual(len(rows), 1)
        self.assertNotEqual(rows[0].pk, old_pk)
        self.assertEqual(rows[0].inventory_id, self.report.id)
        self.assertEqual(rows[0].calculated_co2e_kg, Decimal('40400.0000'))

    def test_unrelated_unassigned_rows_are_never_touched_by_save_change_or_restart(self):
        # Two NULL rows: one whose description looks like a questionnaire row, one that does not. Neither is
        # read, updated, replaced, tagged or deleted - and neither blocks the owned inventory.
        looks_alike = self._null_row('Questionnaire step 3A-5')
        chat = self._null_row('AI Chat: 5 m3 natural_gas', month=2)
        nulls = [looks_alike.pk, chat.pk]
        before = list(EmissionEntry.objects.filter(pk__in=nulls).order_by('pk').values())

        self._step('3A-5', {'natural_gas': '10000 m³'})
        self.assertEqual(len(self._rows()), 2)             # the owned row + the look-alike NULL row, nothing merged
        self.assertEqual(EmissionEntry.objects.filter(inventory_id=self.report.id).count(), 1)
        self._step('3A-5', {'natural_gas': '20000 m³'})
        self.assertEqual(EmissionEntry.objects.filter(inventory_id=self.report.id).count(), 1)
        self.assertEqual(list(EmissionEntry.objects.filter(pk__in=nulls).order_by('pk').values()), before)

        res = self.client.post(f'/api/questionnaire/{self.report.id}/restart/', {}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(EmissionEntry.objects.filter(inventory_id=self.report.id).count(), 0)    # owned rows go
        self.assertEqual(list(EmissionEntry.objects.filter(pk__in=nulls).order_by('pk').values()), before)

    def test_deleting_a_scoped_inventory_deletes_only_its_own_rows_and_orphans_nothing(self):
        self._gas()
        nulls = [self._null_row('Questionnaire step 3A-5').pk, self._null_row('manual', month=2).pk]
        before = list(EmissionEntry.objects.filter(pk__in=nulls).order_by('pk').values())
        self._step('3A-5', {'natural_gas': '10000 m³'})
        owned = EmissionEntry.objects.filter(inventory_id=self.report.id).count()
        res = self.client.delete(f'/api/questionnaire/{self.report.id}/')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['deleted_entries'], owned)
        self.assertFalse(CarbonReport.objects.filter(pk=self.report.id).exists())
        self.assertFalse(EmissionEntry.objects.filter(inventory__isnull=False).exists())    # none left tagged / orphaned
        self.assertEqual(list(EmissionEntry.objects.filter(pk__in=nulls).order_by('pk').values()), before)

    def test_resync_inventory_recreates_owned_rows_tagged(self):
        from .step_entries import resync_inventory
        self._gas()
        self._step('3A-5', {'natural_gas': '10000 m³'})
        EmissionEntry.objects.filter(company=self.company).delete()              # the rows are gone: resync recreates
        created = resync_inventory(self.company, 2025, self.user)
        self.assertEqual(len(created), 1)
        self.assertEqual([r.inventory_id for r in self._rows()], [self.report.id])

    def test_another_companys_report_is_never_used_as_the_tag(self):
        from companies.models import Company
        from .step_entries import sync_step_entries
        other = Company.objects.create(
            legal_entity_name='Other Co', tax_number='9', country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1)
        foreign = CarbonReport.objects.create(company=other, created_by=self.user, reporting_year=2025)
        ReportStep.objects.create(report=foreign, step_id='3A-5', answer={'answer': {'natural_gas': '10000 m³'}})
        self._gas()
        self.assertEqual(sync_step_entries(self.user, self.company, foreign, '3A-5'), [])    # nothing written at all
        self.assertFalse(EmissionEntry.objects.exists())

    def test_creation_time_is_never_changed_by_writes(self):
        self._gas()
        created = CarbonReport.objects.get(pk=self.report.pk).created_at
        self._step('3A-5', {'natural_gas': '10000 m³'})
        self.assertEqual(CarbonReport.objects.get(pk=self.report.pk).created_at, created)


class CutoverSemanticsTests(_Base):
    def test_parsing_and_fail_closed(self):
        for raw in ('', '   ', 'garbage', '2025-01-01T00:00:00', '2025-01-01', None):
            with self.settings(INVENTORY_OWNERSHIP_CUTOVER=raw):
                self.assertIsNone(ownership_cutover(), raw)
                self.assertFalse(is_ownership_scoped(self.report), raw)       # nothing is scoped when it is unusable
        with self.settings():
            del settings.INVENTORY_OWNERSHIP_CUTOVER                         # not configured at all
            self.assertIsNone(ownership_cutover())
            self.assertFalse(is_ownership_scoped(self.report))
        with self.settings(INVENTORY_OWNERSHIP_CUTOVER='2025-01-01T00:00:00Z'):
            self.assertEqual(ownership_cutover(), datetime(2025, 1, 1, tzinfo=dt_timezone.utc))
        with self.settings(INVENTORY_OWNERSHIP_CUTOVER='2025-01-01T03:00:00+03:00'):
            self.assertEqual(ownership_cutover(), datetime(2025, 1, 1, tzinfo=dt_timezone.utc))   # compared in UTC

    def test_the_boundary_is_inclusive_and_exact(self):
        moment = datetime(2030, 6, 1, 12, 0, 0, tzinfo=dt_timezone.utc)
        with self.settings(INVENTORY_OWNERSHIP_CUTOVER=moment.isoformat()):
            for created, expected in ((moment, True), (moment + timedelta(microseconds=1), True),
                                      (moment - timedelta(microseconds=1), False)):
                CarbonReport.objects.filter(pk=self.report.pk).update(created_at=created)
                self.assertIs(is_ownership_scoped(CarbonReport.objects.get(pk=self.report.pk)), expected, created)

    def test_the_production_setting_has_no_default(self):
        import os
        from carbonless_api import settings as production
        self.assertEqual(production.INVENTORY_OWNERSHIP_CUTOVER, os.environ.get('INVENTORY_OWNERSHIP_CUTOVER', ''))


class PreOwnershipInventoryTests(_Base):
    """An inventory created before the cutover (or with no usable cutover) fails closed BEFORE any write."""

    def _each_unusable_cutover(self):
        for raw in (FUTURE, '', 'garbage', '2025-01-01T00:00:00'):
            yield raw

    def test_save_restart_delete_and_resync_are_refused_and_change_nothing(self):
        from .step_entries import resync_inventory
        self._gas()
        self._step('3A-5', {'natural_gas': '10000 m³'})            # while it is still scoped
        nulls = self._null_row('legacy', month=3).pk
        for raw in self._each_unusable_cutover():
            with self.settings(INVENTORY_OWNERSHIP_CUTOVER=raw):
                before = state_dump()
                self._assert_refused(self._patch_step(answer={'natural_gas': '99999 m³'}),
                                     'inventory_not_ownership_scoped')
                self._assert_refused(self._patch_step('A1', {'legal_name': 'x'}),
                                     'inventory_not_ownership_scoped')        # even a profile step: the sync follows
                self._assert_refused(self.client.post(f'/api/questionnaire/{self.report.id}/restart/', {},
                                                      format='json'), 'inventory_not_ownership_scoped')
                self._assert_refused(self.client.delete(f'/api/questionnaire/{self.report.id}/'),
                                     'inventory_not_ownership_scoped')         # even an empty draft would be refused
                self.assertEqual(resync_inventory(self.company, 2025, self.user), [])
                self.assertEqual(state_dump(), before, raw)
        self.assertTrue(EmissionEntry.objects.filter(pk=nulls).exists())

    def test_an_empty_pre_ownership_draft_cannot_be_deleted_either(self):
        with self.settings(INVENTORY_OWNERSHIP_CUTOVER=FUTURE):
            before = state_dump()
            self._assert_refused(self.client.delete(f'/api/questionnaire/{self.report.id}/'),
                                 'inventory_not_ownership_scoped')
            self.assertEqual(state_dump(), before)

    def test_a_sign_off_step_is_not_entry_producing(self):
        # The sign-off steps never need the ownership boundary: they create no entries and skip the sync.
        with self.settings(INVENTORY_OWNERSHIP_CUTOVER=FUTURE):
            res = self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
                'step': '7C-1', 'data': {'answer': 'all_complete'}}, format='json')
            self.assertNotEqual(res.status_code, 409, res.content)


class WorkspaceTaggingTests(_Base):
    URL = '/api/questionnaire/report-fields/bulk-upsert/'

    def _grid(self):
        self._factor('turkey-grid', 'kwh', Decimal('0.4'), scope='scope2')

    def _upsert(self, kwh=1000):
        return self.client.post(self.URL, {'report': self.report.id, 'fields': [
            {'field_id': 'rf.4a.consumption_kwh', 'value': kwh}]}, format='json')

    def _workspace_rows(self):
        return EmissionEntry.objects.filter(description=f'Workspace 4A (report {self.report.id})').order_by('pk')

    def test_a_new_workspace_row_is_tagged_and_an_existing_one_is_updated_in_place(self):
        self._grid()
        self.assertEqual(self._upsert(1000).status_code, 200)
        [row] = list(self._workspace_rows())
        self.assertEqual(row.inventory_id, self.report.id)
        self.assertEqual(row.calculated_co2e_kg, Decimal('400.0000'))
        self.assertEqual(self._upsert(2000).status_code, 200)
        [again] = list(self._workspace_rows())
        self.assertEqual((again.pk, again.inventory_id, again.quantity), (row.pk, self.report.id, Decimal('2000.0000')))

    def test_an_unassigned_row_with_the_same_description_is_never_adopted_or_touched(self):
        self._grid()
        stray = EmissionEntry.objects.create(
            user=self.user, company=self.company, emission_factor=self._gas(), year=2025, month=1,
            quantity=Decimal('7'), description=f'Workspace 4A (report {self.report.id})', status='approved')
        before = list(EmissionEntry.objects.filter(pk=stray.pk).values())
        self.assertEqual(self._upsert(1000).status_code, 200)
        self.assertEqual(list(EmissionEntry.objects.filter(pk=stray.pk).values()), before)      # untouched, not adopted
        owned = EmissionEntry.objects.filter(inventory_id=self.report.id)
        self.assertEqual(owned.count(), 1)                                                      # a new, tagged row

    def test_a_pre_ownership_inventory_is_refused_before_any_field_is_written(self):
        self._grid()
        with self.settings(INVENTORY_OWNERSHIP_CUTOVER=FUTURE):
            before = state_dump()
            self._assert_refused(self._upsert(), 'inventory_not_ownership_scoped')
            self.assertEqual(state_dump(), before)
            self.assertFalse(ReportField.objects.exists())

    def test_a_refusal_part_way_rolls_the_field_writes_back(self):
        self._grid()
        with mock.patch('questionnaire.workspace_views._write_workspace_entries',
                        side_effect=InventoryGuardError('inventory_signed')):
            before = state_dump()
            self._assert_refused(self._upsert(), 'inventory_signed')
        self.assertEqual(state_dump(), before)
        self.assertFalse(ReportField.objects.exists())


class ConstraintStillInForceTests(_Base):
    def test_a_second_inventory_for_the_same_company_and_year_is_still_refused(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
        r = self.client.post('/api/questionnaire/start/', {'reporting_year': 2025, 'title': 'again', 'force_new': True},
                             format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_exists_for_year')
