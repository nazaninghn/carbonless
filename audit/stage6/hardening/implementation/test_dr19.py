"""DR-19 (isolated copy): a signed / completed inventory keeps the factor rows it was calculated with."""
import csv
import io
import os
import tempfile
import threading
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import OperationalError, connection, transaction
from django.db.models import ProtectedError
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import ActivityLog
from companies.models import Company, CompanyMembership
from emissions.models import EmissionEntry, EmissionFactor
from . import applied_factors as AF
from .models import CarbonReport, ReportField, ReportStep
from .step_entries import resync_inventory

NEW = Decimal('2.14288')
ANS = {'natural_gas': '10000 m³', 'diesel': '1.000 litre'}
OFFICE = {'asset_type': 'KV-01', 'area_m2': '2500', 'owner_declaration': True, 'declaration_kwh': '120000',
          'declaration_energy': 'electricity', 'in_scope12': 'not_included'}


class Base(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('ent', 'ent@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Ent Co', tax_number='2', country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        call_command('seed_factors', verbosity=0)
        self.old = EmissionFactor.objects.get(slug='natural-gas-m3', country='turkey')

    def put(self, step, ans, expect=200):
        cache.clear()
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {'step': step, 'data': {'answer': ans}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, expect, r.content)
        self.report.refresh_from_db()

    def step(self, ans):
        self.put('3A-5', ans)

    def gas(self):
        e = EmissionEntry.objects.get(company=self.company, year=2025, emission_factor__slug='natural-gas-m3')
        return e.emission_factor_id, float(e.quantity), round(float(e.calculated_co2e_kg), 2)

    def total(self):
        return round(sum(float(e.calculated_co2e_kg) for e in EmissionEntry.objects.filter(company=self.company, year=2025)), 2)

    def stored(self):
        return AF.stored(self.report)

    def lock_quiet(self, signed=True):
        """Lock WITHOUT any signal (queryset.update): what a legacy inventory looks like."""
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED,
                                                              signed_at=timezone.now() if signed else None)
        self.report.refresh_from_db()

    def lock(self, signed=True):
        """Lock through save(): what the final-question path and the admin do."""
        self.report.refresh_from_db()
        self.report.status = CarbonReport.Status.COMPLETED
        if signed:
            self.report.signed_at = timezone.now()
        self.report.save()
        self.report.refresh_from_db()

    def add_row(self, slug='natural-gas-m3', country='turkey', year=2025, value=NEW):
        base = EmissionFactor.objects.filter(slug=slug, country=country).first()
        return EmissionFactor.objects.create(
            slug=slug, country=country, year=year, name=base.name, scope=base.scope, category=base.category, unit=base.unit,
            factor_kg_co2e=value, source='defra_2024', is_active=True, is_default=True)


# ── A. the scenarios ───────────────────────────────────────────────────────────────────────────────────────────────
class Scenarios(Base):
    def test_draft_follows_the_newest_factor_on_the_next_save(self):
        self.step(ANS)
        new = self.add_row()
        self.step({**ANS, 'diesel': '2.000 litre'})
        self.assertEqual(self.gas(), (new.id, 10000.0, 21428.8))
        self.assertFalse(self.stored()['pins'])

    def test_signed_new_same_year_row_then_unrelated_edit_keeps_the_recorded_factor(self):
        self.step(ANS); self.lock()
        self.assertEqual(self.stored()['pins']['natural-gas-m3'], self.old.id)
        self.add_row()
        self.step({**ANS, 'diesel': '2.000 litre'})
        self.assertEqual(self.gas(), (self.old.id, 10000.0, 20200.0))
        self.assertEqual(self.total(), 20200.0 + 5360.0)
        self.assertIsNotNone(self.report.edited_after_signing_at)

    def test_completed_but_unsigned_is_locked_too(self):
        self.step(ANS); self.lock(signed=False); self.add_row()
        self.step({**ANS, 'diesel': '2.000 litre'})
        self.assertEqual(self.gas(), (self.old.id, 10000.0, 20200.0))

    def test_signed_quantity_change_is_priced_with_the_recorded_factor(self):
        self.step(ANS); self.lock(); self.add_row()
        self.step({**ANS, 'natural_gas': '11000 m³'})
        self.assertEqual(self.gas(), (self.old.id, 11000.0, 22220.0))

    def test_signed_later_year_row_changes_nothing(self):
        self.step(ANS); self.lock(); self.add_row(year=2026)
        self.step({**ANS, 'diesel': '2.000 litre'})
        self.assertEqual(self.gas(), (self.old.id, 10000.0, 20200.0))

    def test_signed_new_activity_uses_the_current_row_and_old_rows_stay(self):
        self.step(ANS); self.lock(); self.add_row()
        self.step({**ANS, 'lpg': '100 litre'})
        self.assertEqual(self.gas(), (self.old.id, 10000.0, 20200.0))
        self.assertTrue(EmissionEntry.objects.filter(company=self.company, year=2025, emission_factor__slug='lpg').exists())
        self.assertEqual(self.stored()['provenance']['lpg'], AF.FIRST_USE)       # recorded, and labelled as not proven

    def test_a_withdrawn_row_still_prices_the_inventory_signed_with_it(self):
        self.step(ANS); self.lock()
        EmissionFactor.objects.filter(pk=self.old.pk).update(is_active=False, is_default=False)    # queryset.update: freezes first
        self.add_row()
        self.step({**ANS, 'natural_gas': '12000 m³'})
        self.assertEqual(self.gas(), (self.old.id, 12000.0, 24240.0))

    def test_resync_after_an_approved_factor_does_not_reprice_unrelated_rows(self):
        self.step(ANS); self.lock(); self.add_row()
        t0 = self.total()
        resync_inventory(self.company, 2025, self.user)
        self.assertEqual(self.total(), t0)

    def test_edit_then_resign_keeps_the_basis_until_an_explicit_reprice(self):
        self.step(ANS); self.lock(); self.add_row()
        self.step({**ANS, 'diesel': '2.000 litre'})
        self.assertIsNotNone(self.report.edited_after_signing_at)
        CarbonReport.objects.filter(pk=self.report.pk).update(signed_at=timezone.now(), edited_after_signing_at=None)
        self.report.refresh_from_db(); AF.freeze_applied_factors(self.report)
        self.assertEqual(self.gas()[0], self.old.id)

    def test_workspace_sync_of_a_locked_inventory_keeps_the_recorded_factor(self):
        from .workspace_views import _sync_workspace_to_emission_entries
        for fid, val in (('rf.3a.fuel_type', 'natural_gas'), ('rf.3a.consumption', 10000), ('rf.3a.unit', 'm3')):
            ReportField.objects.create(report=self.report, field_id=fid, value=val, source='dashboard')
        _sync_workspace_to_emission_entries(self.report, self.user)
        ws = EmissionEntry.objects.get(company=self.company, description__startswith='Workspace 3A')
        first = (ws.emission_factor_id, float(ws.calculated_co2e_kg))
        self.assertEqual(first[1], 20200.0)
        self.lock(); new = self.add_row()
        ReportField.objects.filter(report=self.report, field_id='rf.3a.consumption').update(value=10001)
        _sync_workspace_to_emission_entries(self.report, self.user)
        ws.refresh_from_db()
        self.assertEqual(ws.emission_factor_id, self.old.id)               # not the new row
        self.assertEqual(round(float(ws.calculated_co2e_kg), 2), round(10001 * 2.02, 2))
        self.assertNotEqual(ws.emission_factor_id, new.id)


# ── B. every path that locks an inventory ──────────────────────────────────────────────────────────────────────────
class LockPaths(Base):
    def test_the_final_question_path_freezes(self):
        self.step(ANS)
        self.report.status = CarbonReport.Status.COMPLETED
        self.report.current_step = 'DONE'
        self.report.save(update_fields=['status', 'current_step', 'updated_at'])          # views.py: the final question
        s = AF.stored(self.report)
        self.assertTrue(s['frozen_at'])
        self.assertEqual(s['pins']['natural-gas-m3'], self.old.id)

    def test_the_sign_off_path_freezes(self):
        from .views import _track_signature
        self.step(ANS); self.lock_quiet(signed=False)
        _track_signature(self.report, '7C-2', None, {'signatory_name': 'A'})
        self.assertTrue(AF.stored(self.report)['frozen_at'])

    def test_reset_session_path_freezes(self):
        self.step(ANS)
        self.assertEqual(self.client.post('/api/questionnaire/reset/').status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, CarbonReport.Status.COMPLETED)
        self.assertTrue(AF.stored(self.report)['frozen_at'])

    def test_a_status_change_by_queryset_update_is_covered_by_the_freeze_before_a_factor_change(self):
        self.step(ANS); self.lock_quiet()
        self.assertFalse(self.stored()['frozen_at'])                                       # nothing saw this lock
        self.add_row()                                                                     # pre_save: freeze_slug first
        self.assertEqual(self.stored()['pins']['natural-gas-m3'], self.old.id)
        self.assertEqual(self.stored()['provenance']['natural-gas-m3'], AF.FACTOR_CHANGE)
        self.step({**ANS, 'diesel': '2.000 litre'})
        self.assertEqual(self.gas()[0], self.old.id)

    def test_the_deploy_command_freezes_legacy_inventories_and_is_a_dry_run_by_default(self):
        self.step(ANS); self.lock_quiet()
        out = io.StringIO()
        call_command('freeze_applied_factors', stdout=out)
        self.assertIn('nothing written', out.getvalue())
        self.assertFalse(self.stored()['frozen_at'])
        call_command('freeze_applied_factors', '--apply', stdout=io.StringIO())
        self.assertTrue(self.stored()['frozen_at'])


# ── C. no in-place edit through any application write path ─────────────────────────────────────────────────────────
class FactorWriteGuards(Base):
    def setUp(self):
        super().setUp()
        self.step(ANS)                       # natural gas and diesel rows are now referenced by entries
        self.free = EmissionFactor.objects.get(slug='cng', country='global')

    def test_save_is_refused_for_a_referenced_row_only(self):
        f = EmissionFactor.objects.get(pk=self.old.pk); f.factor_kg_co2e = NEW
        with self.assertRaises(ValidationError):
            f.save()
        f.refresh_from_db(); self.assertEqual(f.factor_kg_co2e, Decimal('2.02'))
        self.free.factor_kg_co2e = Decimal('1.94'); self.free.save()
        f = EmissionFactor.objects.get(pk=self.old.pk); f.reference = f.reference + ' '; f.save()      # a label edit is fine

    def test_queryset_update_is_refused_for_a_referenced_row_only(self):
        with self.assertRaises(ValidationError):
            EmissionFactor.objects.filter(pk=self.old.pk).update(factor_kg_co2e=NEW)
        EmissionFactor.objects.filter(pk=self.old.pk).update(factor_kg_co2e=Decimal('2.02'))           # same value: no change
        EmissionFactor.objects.filter(pk=self.free.pk).update(factor_kg_co2e=Decimal('1.94'))
        EmissionFactor.objects.filter(pk=self.old.pk).update(reference='x')

    def test_bulk_update_is_refused_for_a_referenced_row_only(self):
        f = EmissionFactor.objects.get(pk=self.old.pk); f.factor_kg_co2e = NEW
        with self.assertRaises(ValidationError):
            EmissionFactor.objects.bulk_update([f], ['factor_kg_co2e'])
        self.free.factor_kg_co2e = Decimal('1.94')
        EmissionFactor.objects.bulk_update([self.free], ['factor_kg_co2e'])
        self.old.refresh_from_db(); self.assertEqual(self.old.factor_kg_co2e, Decimal('2.02'))

    def test_a_referenced_row_cannot_be_deleted(self):
        with self.assertRaises(ProtectedError):
            EmissionFactor.objects.get(pk=self.old.pk).delete()

    def test_raw_sql_is_the_unavoidable_bypass_and_it_is_detected(self):
        self.lock()
        with connection.cursor() as c:
            c.execute('UPDATE emissions_emissionfactor SET factor_kg_co2e = %s WHERE id = %s', ['2.500000', self.old.id])
        report = {r[0]['report_id']: r[0] for r in AF.provenance_report()}[self.report.id]
        self.assertGreaterEqual(report['entries_value_drift'], 1)
        self.assertEqual(report['verdict'], 'RECORD_INCONSISTENT_REVIEW')


# ── D. legacy inventories whose underlying factor is not recorded ──────────────────────────────────────────────────
class LegacyProvenance(Base):
    def setUp(self):
        super().setUp()
        self.put('K3C8-0', 'yes')
        ReportStep.objects.update_or_create(report=self.report, step_id='D3', defaults={'answer': {'boundary_approach': 'operational_control'}})
        self.put('K3C8-1', {'items': [OFFICE], 'draft': {}})
        self.grid = EmissionFactor.objects.get(slug='turkey-grid-distribution')

    def leased(self):
        e = EmissionEntry.objects.get(company=self.company, year=2025, emission_factor__slug__startswith='calculated-scope3-upstream_leased')
        return round(float(e.calculated_co2e_kg), 2)

    def verdict(self):
        return {r[0]['report_id']: r[0] for r in AF.provenance_report()}[self.report.id]

    def test_a_calculated_entry_is_priced_with_a_factor_that_no_entry_records(self):
        self.assertEqual(self.leased(), 56280.0)                     # 120,000 kWh x 0.469
        self.assertEqual(EmissionEntry.objects.filter(company=self.company, emission_factor__slug='turkey-grid-distribution').count(), 0)

    def test_locked_through_save_the_underlying_factor_is_frozen_at_lock(self):
        self.lock()
        self.assertEqual(self.stored()['pins']['turkey-grid-distribution'], self.grid.id)
        self.assertEqual(self.stored()['provenance']['turkey-grid-distribution'], AF.LOCK)
        self.add_row('turkey-grid-distribution', 'turkey', 2025, Decimal('0.5'))
        self.step({**ANS})
        self.assertEqual(self.leased(), 56280.0)

    def test_legacy_inventory_is_reproducible_before_any_factor_change_and_the_deploy_freeze_keeps_it(self):
        self.lock_quiet()
        self.assertEqual(self.verdict()['verdict'], 'provable')      # today's rows still reproduce the stored figure
        call_command('freeze_applied_factors', '--apply', stdout=io.StringIO())
        self.assertEqual(self.stored()['provenance']['turkey-grid-distribution'], AF.DEPLOY)    # stored as NOT proven
        self.add_row('turkey-grid-distribution', 'turkey', 2025, Decimal('0.5'))
        self.step({**ANS})
        self.assertEqual(self.leased(), 56280.0)

    def test_legacy_inventory_whose_factor_changed_before_the_freeze_is_reported_unprovable(self):
        self.lock_quiet()
        self.add_row('turkey-grid-distribution', 'turkey', 2025, Decimal('0.5'))   # nothing froze the underlying factor
        v = self.verdict()
        self.assertEqual(v['verdict'], 'UNPROVABLE_REVIEW')
        self.assertEqual((v['unprotected_stored_kg'], v['unprotected_now_kg']), (56280.0, 60000.0))
        # and a rebuild would re-price it silently: this is exactly what the report warns about
        self.step({**ANS})
        self.assertEqual(self.leased(), 60000.0)

    def test_a_signed_inventory_with_answers_but_no_entries_is_reported(self):
        self.lock_quiet()
        EmissionEntry.objects.filter(company=self.company, year=2025).delete()
        v = self.verdict()
        self.assertEqual(v['verdict'], 'ENTRIES_MISSING_REVIEW')
        self.assertGreaterEqual(v['steps_exposed_without_pins'], 1)

    def test_the_report_command_is_read_only_and_writes_both_files(self):
        self.lock_quiet()
        self.add_row('turkey-grid-distribution', 'turkey', 2025, Decimal('0.5'))
        before = CarbonReport.objects.filter(pk=self.report.pk).values_list('applied_factors', 'updated_at').first()
        with tempfile.TemporaryDirectory() as d:
            a, b = os.path.join(d, 'summary.csv'), os.path.join(d, 'steps.csv')
            out = io.StringIO()
            call_command('report_factor_provenance', '--csv', a, '--steps-csv', b, stdout=out)
            rows = list(csv.DictReader(open(a, encoding='utf-8-sig')))
            steps = list(csv.DictReader(open(b, encoding='utf-8-sig')))
        self.assertEqual(rows[0]['verdict'], 'UNPROVABLE_REVIEW')
        self.assertIn('K3C8-1', [s['step'] for s in steps])
        self.assertIn('UNPROVABLE_REVIEW', out.getvalue())
        self.assertEqual(CarbonReport.objects.filter(pk=self.report.pk).values_list('applied_factors', 'updated_at').first(), before)


# ── E. explicit re-pricing ─────────────────────────────────────────────────────────────────────────────────────────
class Reprice(Base):
    def test_needs_a_reason_and_a_locked_inventory(self):
        self.step(ANS)
        with self.assertRaises(ValueError):
            AF.reprice_inventory(self.report, self.user, 'because')
        self.lock(); self.add_row()
        with self.assertRaises(ValueError):
            AF.reprice_inventory(self.report, self.user, '   ')
        self.assertEqual(self.gas()[0], self.old.id)

    def test_it_is_audited_and_keeps_the_previous_approved_result(self):
        self.step(ANS); self.lock(); new = self.add_row()
        before = self.total()
        out = AF.reprice_inventory(self.report, self.user, 'Owner approved the DEFRA-method natural gas factor for 2025')
        self.assertEqual(self.gas(), (new.id, 10000.0, 21428.8))
        self.assertEqual(out['moved'], {'natural-gas-m3': [self.old.id, new.id]})
        self.report.refresh_from_db()
        self.assertIsNotNone(self.report.edited_after_signing_at)
        meta = ActivityLog.objects.get(action='inventory_repriced').metadata
        self.assertEqual((meta['actor'], meta['actor_id']), ('ent', self.user.pk))
        self.assertTrue(meta['at'])
        self.assertIn('Owner approved', meta['reason'])
        self.assertEqual(meta['previous_factor_map']['pins']['natural-gas-m3'], self.old.id)
        self.assertEqual(meta['new_factor_map']['pins']['natural-gas-m3'], new.id)
        self.assertEqual(meta['new_factor_map']['provenance']['natural-gas-m3'], AF.REPRICED)
        self.assertEqual((meta['before_total_kg'], meta['after_total_kg']), (before, self.total()))
        prev = {e['slug']: e for e in meta['before_entries']}['natural-gas-m3']
        self.assertEqual((prev['factor_id'], Decimal(prev['kg']), Decimal(prev['factor_kg_co2e'])), (self.old.id, Decimal('20200'), Decimal('2.02')))
        after = {e['slug']: e for e in meta['after_entries']}['natural-gas-m3']
        self.assertEqual((after['factor_id'], Decimal(after['kg'])), (new.id, Decimal('21428.8')))

    def test_a_failure_part_way_rolls_everything_back(self):
        self.step(ANS); self.lock(); self.add_row()
        before_map, before_total = self.stored(), self.total()
        with mock.patch('questionnaire.step_entries.sync_step_entries', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError):
                AF.reprice_inventory(self.report, self.user, 'Owner approved')
        self.assertEqual(self.stored(), before_map)
        self.assertEqual(self.total(), before_total)
        self.assertEqual(self.gas()[0], self.old.id)
        self.assertFalse(ActivityLog.objects.filter(action='inventory_repriced').exists())
        self.report.refresh_from_db(); self.assertIsNone(self.report.edited_after_signing_at)

    def test_a_reprice_that_moves_nothing_is_still_logged_and_flags_nothing(self):
        self.step(ANS); self.lock()
        out = AF.reprice_inventory(self.report, self.user, 'checked: nothing newer')
        self.assertEqual(out['moved'], {})
        self.report.refresh_from_db(); self.assertIsNone(self.report.edited_after_signing_at)
        self.assertEqual(ActivityLog.objects.filter(action='inventory_repriced').count(), 1)


# ── F. concurrency (SQLite: deterministic interleavings; real row locks are PostgreSQL-only and UNTESTED) ─────────
class Concurrency(Base):
    def test_two_stale_writers_cannot_undo_each_others_pins(self):
        self.step(ANS); self.lock_quiet()
        a, b = AF.load_pins(self.report), AF.load_pins(self.report)         # both read the same stored state
        a.map['lpg'], a.added['lpg'] = 111, AF.FIRST_USE
        b.map['coal'], b.added['coal'] = 222, AF.FIRST_USE
        b.map['natural-gas-m3'], b.added['natural-gas-m3'] = 999, AF.FIRST_USE   # tries to overwrite an existing pin
        AF.persist_pins(self.report, a)
        AF.persist_pins(self.report, b)
        s = self.stored()
        self.assertEqual((s['pins']['lpg'], s['pins']['coal']), (111, 222))     # last writer did not erase the first
        self.assertEqual(s['pins']['natural-gas-m3'], self.old.id)              # an existing pin is never overwritten

    def test_edit_and_factor_change_in_either_order_leave_the_same_pin(self):
        self.step(ANS); self.lock()
        self.add_row()
        self.step({**ANS, 'diesel': '2.000 litre'})
        self.add_row(year=2026, value=Decimal('3'))
        self.step({**ANS, 'diesel': '3.000 litre'})
        self.assertEqual(self.stored()['pins']['natural-gas-m3'], self.old.id)
        self.assertEqual(self.gas()[0], self.old.id)


class ConcurrencyThreads(TransactionTestCase):
    """Real threads on SQLite's shared in-memory test database (writers serialise; this is NOT a PostgreSQL test)."""
    def test_parallel_merges_lose_nothing(self):
        user = User.objects.create_user('thr', 't@test.com', 'x')
        co = Company.objects.create(legal_entity_name='T', tax_number='9', country_of_headquarters='TR', countries_of_operation='TR',
                                    nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        rep = CarbonReport.objects.create(company=co, created_by=user, reporting_year=2025)
        errors = []

        def worker(n):
            from django.db import connections
            try:
                for i in range(6):
                    for attempt in range(40):
                        try:
                            AF._merge(rep.pk, {f's{n}-{i}': (n * 100 + i, AF.FIRST_USE)})
                            break
                        except OperationalError:
                            import time; time.sleep(0.05)
                    else:
                        errors.append((n, i))
            finally:
                connections.close_all()

        ts = [threading.Thread(target=worker, args=(n,)) for n in range(4)]
        [t.start() for t in ts]; [t.join() for t in ts]
        s = AF.stored(rep)
        self.assertEqual(errors, [])
        self.assertEqual(len(s['pins']), 24)


# ── G. migration forward / backward ────────────────────────────────────────────────────────────────────────────────
class Migration(TransactionTestCase):
    def test_backward_then_forward_keeps_everything_else(self):
        user = User.objects.create_user('mig', 'm@test.com', 'x')
        co = Company.objects.create(legal_entity_name='M', tax_number='8', country_of_headquarters='TR', countries_of_operation='TR',
                                    nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        rep = CarbonReport.objects.create(company=co, created_by=user, reporting_year=2025, applied_grid_connections={'7': 'distribution'},
                                          applied_factors={'pins': {'x': 1}, 'provenance': {'x': 'entry'}, 'frozen_at': 'now'})
        call_command('migrate', 'questionnaire', '0012', verbosity=0)
        with connection.cursor() as c:
            cols = [d.name for d in connection.introspection.get_table_description(c, 'questionnaire_carbonreport')]
        self.assertNotIn('applied_factors', cols)
        row = CarbonReport.objects.defer('applied_factors').get(pk=rep.pk) if False else None
        call_command('migrate', 'questionnaire', verbosity=0)
        rep.refresh_from_db()
        self.assertEqual(rep.applied_grid_connections, {'7': 'distribution'})       # the neighbouring column survived
        self.assertEqual(rep.reporting_year, 2025)
        self.assertIn(rep.applied_factors, (None, {}))                                # the dropped map is empty again (re-created by the freeze command)
