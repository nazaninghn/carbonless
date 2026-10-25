"""DR-19 hardening (isolated copy): every route that can create, edit, recalculate or complete an inventory; the hold; concurrency."""
import io
import threading
import time
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import DatabaseError, OperationalError, connections
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from accounts.models import ActivityLog
from companies.models import Company, CompanyMembership
from emissions.models import EmissionEntry, EmissionFactor
from . import applied_factors as AF
from .models import CarbonReport, ReportField, ReportStep
from .step_entries import resync_inventory
from .test_dr19 import ANS, NEW, OFFICE, Base


def pinned_log(company):
    return ActivityLog.objects.filter(action='entry_factor_pinned', metadata__company_id=company.pk)


# ── 1. every write route of a signed / completed inventory ─────────────────────────────────────────────────────────
class Routes(Base):
    def setUp(self):
        super().setUp()
        self.step(ANS); self.lock()
        self.new = self.add_row()                  # a newer natural-gas row for 2025 appears after signing

    def entry(self, **kw):
        return EmissionEntry.objects.filter(company=self.company, year=2025, **kw)

    def test_dashboard_create_uses_the_recorded_row_and_says_so(self):
        r = self.client.post('/api/emissions/entries/', {'emission_factor': self.new.id, 'year': 2025, 'month': 3, 'quantity': '100',
                                                         'confirm_duplicate': '1'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data['emission_factor'], self.old.id)                       # visible in the response
        e = EmissionEntry.objects.get(pk=r.data['id'])
        self.assertEqual((e.emission_factor_id, round(float(e.calculated_co2e_kg), 2), e.factor_value_snapshot), (self.old.id, 202.0, Decimal('2.020000')))
        self.assertEqual(pinned_log(self.company).count(), 1)                          # and in the company history

    def test_dashboard_edit_cannot_move_an_entry_to_the_newer_row(self):
        r = self.client.post('/api/emissions/entries/', {'emission_factor': self.old.id, 'year': 2025, 'month': 3, 'quantity': '100',
                                                         'confirm_duplicate': '1'}, format='json')
        eid = r.data['id']
        r = self.client.patch(f'/api/emissions/entries/{eid}/', {'emission_factor': self.new.id}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        e = EmissionEntry.objects.get(pk=eid)
        self.assertEqual((e.emission_factor_id, round(float(e.calculated_co2e_kg), 2)), (self.old.id, 202.0))

    def test_dashboard_pending_change_replacement_uses_the_same_guard(self):
        base = self.entry(emission_factor__slug='natural-gas-m3').get()
        repl = EmissionEntry(user=self.user, company=self.company, status='submitted', replaces_entry=base, emission_factor=self.new,
                             year=2025, month=1, quantity=base.quantity, description=base.description)       # the constructor views.py uses
        repl.save()
        self.assertEqual(repl.emission_factor_id, self.old.id)

    def test_dashboard_bulk_import(self):
        r = self.client.post('/api/emissions/bulk-import/', [{'factor_id': self.new.id, 'year': 2025, 'month': 2, 'quantity': 50}], format='json')
        self.assertEqual((r.status_code, r.data['created'], r.data['errors']), (200, 1, []))
        e = self.entry(month=2).get()
        self.assertEqual((e.emission_factor_id, round(float(e.calculated_co2e_kg), 2)), (self.old.id, 101.0))

    def test_chat_entry_creation(self):
        from emissions.factor_lookup import create_entry_from_activity
        e, err = create_entry_from_activity(self.user, self.company, 'natural_gas', 100, 'm3', 2025, 4)
        self.assertIsNone(err)
        self.assertEqual((e.emission_factor_id, round(float(e.calculated_co2e_kg), 2)), (self.old.id, 202.0))

    def test_the_shared_lookup_behind_chat_previews_and_duplicate_checks(self):
        from emissions.factor_lookup import resolve_factor_and_amount
        f25 = resolve_factor_and_amount('natural_gas', 100, 'm3', self.company, None, 2025)[0]
        f26 = resolve_factor_and_amount('natural_gas', 100, 'm3', self.company, None, 2026)[0]
        self.assertEqual(f25.id, self.old.id)                         # the signed year keeps its row
        self.assertEqual(f26.id, self.new.id)                         # a year with no signed inventory follows the newest row

    def test_an_entry_in_a_year_without_a_signed_inventory_is_not_touched(self):
        e = EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.new, year=2026, month=1, quantity=10)
        self.assertEqual(e.emission_factor_id, self.new.id)

    def test_admin_or_script_save_that_swaps_the_factor(self):
        e = self.entry(emission_factor__slug='natural-gas-m3').get()
        e.emission_factor = self.new
        e.save()
        e.refresh_from_db()
        self.assertEqual((e.emission_factor_id, round(float(e.calculated_co2e_kg), 2)), (self.old.id, 20200.0))

    def test_bulk_create_follows_the_same_rule(self):
        o = EmissionEntry(user=self.user, company=self.company, emission_factor=self.new, year=2025, month=5, quantity=Decimal('10'),
                          calculated_co2e_kg=Decimal('21.4288'))          # bulk_create() never calls save(), so the caller supplies kg
        EmissionEntry.objects.bulk_create([o])
        e = EmissionEntry.objects.get(company=self.company, year=2025, month=5)
        self.assertEqual((e.emission_factor_id, round(float(e.calculated_co2e_kg), 4)), (self.old.id, 20.2))      # row AND kg follow the record

    def test_queryset_update_of_the_factor_is_refused_for_a_signed_year_only(self):
        e = self.entry(emission_factor__slug='natural-gas-m3').get()
        with self.assertRaises(ValidationError):
            EmissionEntry.objects.filter(pk=e.pk).update(emission_factor=self.new)
        other = EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.old, year=2026, month=1, quantity=10)
        EmissionEntry.objects.filter(pk=other.pk).update(emission_factor=self.new)           # no signed inventory in 2026
        other.refresh_from_db(); self.assertEqual(other.emission_factor_id, self.new.id)

    def test_resync_workspace_and_questionnaire_saves_are_covered(self):
        before = self.total()
        resync_inventory(self.company, 2025, self.user)
        self.step({**ANS, 'diesel': '2.000 litre'})
        self.assertEqual(self.gas()[0], self.old.id)
        self.assertEqual(self.total(), before - 2680.0 + 5360.0)

    def test_the_deploy_time_backfill_neither_writes_pins_nor_changes_amounts(self):
        self.put('K3C8-0', 'yes')
        ReportStep.objects.update_or_create(report=self.report, step_id='D3', defaults={'answer': {'boundary_approach': 'operational_control'}})
        CarbonReport.objects.filter(pk=self.report.pk).update(applied_factors={})            # a legacy inventory: no map at all
        self.put('K3C8-1', {'items': [OFFICE], 'draft': {}})                                   # (the save above re-freezes; reset again)
        CarbonReport.objects.filter(pk=self.report.pk).update(applied_factors={})
        before_map, before_total = AF.stored(self.report), self.total()
        call_command('backfill_calc_detail', stdout=io.StringIO())                            # what build.sh runs on every deploy
        self.assertEqual(AF.stored(self.report), before_map)                                  # no first_use pin was written
        self.assertEqual(self.total(), before_total)

    def test_preview_endpoints_are_not_stored_results(self):
        """/api/emissions/calculate/ is a preview (no entry is written). It still shows the newest row for the year: ACCEPTED, listed as a risk."""
        before = EmissionEntry.objects.count()
        r = self.client.post('/api/emissions/calculate/', {'slug': 'natural-gas-m3', 'country': 'turkey', 'category': 'stationary_combustion',
                                                           'activity_data': 100, 'year': 2025}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(EmissionEntry.objects.count(), before)


# ── 2. holds ───────────────────────────────────────────────────────────────────────────────────────────────────────
class Hold(Base):
    def setUp(self):
        super().setUp()
        self.step(ANS)

    def report15_like(self):
        """A signed inventory with saved answers and no entries."""
        self.lock_quiet()
        EmissionEntry.objects.filter(company=self.company, year=2025).delete()

    def verdict(self):
        return {r[0]['report_id']: r[0] for r in AF.provenance_report()}[self.report.id]['verdict']

    def apply_freeze(self):
        out = io.StringIO()
        call_command('freeze_applied_factors', '--apply', stdout=out)
        return out.getvalue()

    def test_a_signed_inventory_with_answers_but_no_entries_is_held_and_never_rebuilt(self):
        self.report15_like()
        self.assertEqual(self.verdict(), 'ENTRIES_MISSING_REVIEW')
        text = io.StringIO(); call_command('freeze_applied_factors', stdout=text)           # dry run first
        self.assertIn('ENTRIES_MISSING_REVIEW', text.getvalue())
        self.assertFalse(AF.stored(self.report).get('hold'))
        self.apply_freeze()
        s = AF.stored(self.report)
        self.assertEqual(s['hold']['reason'], 'ENTRIES_MISSING_REVIEW')
        self.assertFalse(s['frozen_at'])                                                  # not frozen: nothing was assigned
        self.assertEqual(s['pins'], {})
        self.step({**ANS, 'diesel': '2.000 litre'})                                        # the answer is saved...
        self.assertEqual(EmissionEntry.objects.filter(company=self.company, year=2025).count(), 0)       # ...entries are not created
        self.assertTrue(ActivityLog.objects.filter(action='rebuild_held').exists())
        self.assertIn('2.000 litre', str(ReportStep.objects.get(report=self.report, step_id='3A-5').answer))        # the answer itself was saved

    def test_workspace_resync_and_reprice_are_refused_on_a_held_inventory(self):
        from .workspace_views import _sync_workspace_to_emission_entries
        self.report15_like(); self.apply_freeze()
        for fid, val in (('rf.3a.fuel_type', 'natural_gas'), ('rf.3a.consumption', 10000), ('rf.3a.unit', 'm3')):
            ReportField.objects.create(report=self.report, field_id=fid, value=val, source='dashboard')
        self.assertEqual(_sync_workspace_to_emission_entries(self.report, self.user), 'inventory_on_hold')
        self.assertEqual(resync_inventory(self.company, 2025, self.user), [])
        with self.assertRaises(ValueError):
            AF.reprice_inventory(self.report, self.user, 'try')
        self.assertEqual(EmissionEntry.objects.filter(company=self.company, year=2025).count(), 0)

    def test_release_needs_a_reason_is_audited_and_only_then_rebuilds(self):
        self.report15_like(); self.apply_freeze()
        with self.assertRaises(ValueError):
            AF.release_hold(self.report, self.user, '  ')
        AF.release_hold(self.report, self.user, 'Owner reviewed the answers against the signed report')
        meta = ActivityLog.objects.get(action='inventory_hold_released').metadata
        self.assertEqual((meta['previous_hold']['reason'], meta['actor']), ('ENTRIES_MISSING_REVIEW', 'ent'))
        self.step({**ANS, 'diesel': '2.000 litre'})
        self.assertGreater(EmissionEntry.objects.filter(company=self.company, year=2025).count(), 0)
        with self.assertRaises(ValueError):
            AF.release_hold(self.report, self.user, 'again')                              # nothing left to release

    def test_a_provable_inventory_is_frozen_not_held(self):
        self.lock_quiet()
        self.assertEqual(self.verdict(), 'provable')
        self.apply_freeze()
        s = AF.stored(self.report)
        self.assertTrue(s['frozen_at'])
        self.assertFalse(s.get('hold'))

    def test_an_unprovable_inventory_is_held_and_its_calculated_entry_is_not_repriced(self):
        self.put('K3C8-0', 'yes')
        ReportStep.objects.update_or_create(report=self.report, step_id='D3', defaults={'answer': {'boundary_approach': 'operational_control'}})
        self.put('K3C8-1', {'items': [OFFICE], 'draft': {}})
        self.lock_quiet()
        self.add_row('turkey-grid-distribution', 'turkey', 2025, Decimal('0.5'))          # the factor moved before anything froze it
        self.assertEqual(self.verdict(), 'UNPROVABLE_REVIEW')
        self.apply_freeze()
        self.assertEqual(AF.stored(self.report)['hold']['reason'], 'UNPROVABLE_REVIEW')
        self.step({**ANS, 'diesel': '2.000 litre'})
        e = EmissionEntry.objects.get(company=self.company, year=2025, emission_factor__slug__startswith='calculated-scope3-upstream_leased')
        self.assertEqual(round(float(e.calculated_co2e_kg), 2), 56280.0)                  # NOT silently re-priced to 60,000

    def test_the_entry_report_names_missing_provenance_and_handling(self):
        self.put('K3C8-0', 'yes')
        ReportStep.objects.update_or_create(report=self.report, step_id='D3', defaults={'answer': {'boundary_approach': 'operational_control'}})
        self.put('K3C8-1', {'items': [OFFICE], 'draft': {}})
        self.lock_quiet()
        ents = {x['factor_slug']: x for x in [e for r in AF.provenance_report() if r[0]['report_id'] == self.report.id for e in r[2]]}
        self.assertEqual(ents['natural-gas-m3']['class'], 'proven')
        leased = ents['calculated-scope3-upstream_leased']
        self.assertEqual((leased['class'], leased['underlying_factor']), ('unproven_reproducible_today', 'turkey-grid-distribution'))
        self.assertIn('recorded nowhere', leased['missing_provenance'])
        self.assertIn('deploy_time', leased['recommended_handling'])

    def test_freezing_failure_never_blocks_saving_the_inventory(self):
        self.report.refresh_from_db()
        with mock.patch('questionnaire.applied_factors.freeze_applied_factors', side_effect=RuntimeError('boom')):
            self.report.status = CarbonReport.Status.COMPLETED
            self.report.save()
        self.assertEqual(CarbonReport.objects.get(pk=self.report.pk).status, CarbonReport.Status.COMPLETED)
        self.assertEqual(self.stored()['frozen_at'], None)                               # the lazy freeze from entries still protects it
        self.add_row()
        self.step({**ANS, 'diesel': '2.000 litre'})
        self.assertEqual(self.gas()[0], self.old.id)


# ── 3. concurrency (SQLite serialises writers; PostgreSQL row locks are NOT exercised) ─────────────────────────────
class Threads(TransactionTestCase):
    def setUp(self):
        cache.clear()
        call_command('seed_factors', verbosity=0)
        self.user = User.objects.create_user('thr', 't@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Thr Co', tax_number='7', country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
        self.old = EmissionFactor.objects.get(slug='natural-gas-m3', country='turkey')
        self.api(ANS)

    def api(self, ans):
        from rest_framework.test import APIClient
        c = APIClient(); c.force_authenticate(user=self.user)
        cache.clear()
        r = c.patch(f'/api/questionnaire/{self.report.id}/step/', {'step': '3A-5', 'data': {'answer': ans}, 'language': 'en'}, format='json')
        assert r.status_code == 200, r.content

    def add_row(self):
        return EmissionFactor.objects.create(
            slug='natural-gas-m3', country='turkey', year=2025, name=self.old.name, scope=self.old.scope, category=self.old.category,
            unit=self.old.unit, factor_kg_co2e=NEW, source='defra_2024', is_active=True, is_default=True)

    def lock(self):
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED, signed_at=timezone.now())
        self.report.refresh_from_db()
        AF.freeze_applied_factors(self.report)

    def run_parallel(self, *jobs):
        errors, start = [], threading.Barrier(len(jobs))

        def wrap(job):
            try:
                start.wait(timeout=10)
                for attempt in range(60):
                    try:
                        job(); return
                    except (OperationalError, DatabaseError) as exc:         # SQLite "table is locked": retry the whole operation
                        if 'locked' not in str(exc).lower() and 'busy' not in str(exc).lower():
                            raise
                        time.sleep(0.05)
                errors.append('gave up after retries')
            except Exception as exc:                                         # noqa: BLE001
                errors.append(repr(exc))
            finally:
                connections.close_all()
        ts = [threading.Thread(target=wrap, args=(j,)) for j in jobs]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(errors, [])

    def state(self):
        gas = list(EmissionEntry.objects.filter(company=self.company, year=2025, emission_factor__slug='natural-gas-m3'))
        self.assertEqual(len(gas), 1, 'exactly one natural-gas entry (no duplicate, none lost)')
        e = gas[0]
        self.assertEqual(round(float(e.calculated_co2e_kg), 4), round(float(e.quantity) * float(e.emission_factor.factor_kg_co2e), 4))
        return e, AF.stored(self.report)

    def test_completion_while_a_factor_row_is_added(self):
        new_holder = []
        def complete():
            r = CarbonReport.objects.get(pk=self.report.pk); r.status = CarbonReport.Status.COMPLETED; r.signed_at = timezone.now(); r.save()
        self.run_parallel(complete, lambda: new_holder.append(self.add_row()))
        e, s = self.state()
        self.assertEqual((e.emission_factor_id, s['pins']['natural-gas-m3']), (self.old.id, self.old.id))      # either order: the entry proves the row
        self.api({**ANS, 'diesel': '2.000 litre'})
        self.assertEqual(self.state()[0].emission_factor_id, self.old.id)

    def test_reprice_while_an_unrelated_edit_is_saved(self):
        self.lock(); new = self.add_row()
        before_total = round(sum(float(x.calculated_co2e_kg) for x in EmissionEntry.objects.filter(company=self.company, year=2025)), 2)
        self.run_parallel(lambda: AF.reprice_inventory(self.report, self.user, 'Owner approved'), lambda: self.api({**ANS, 'diesel': '2.000 litre'}))
        e, s = self.state()
        self.assertEqual(e.emission_factor_id, s['pins']['natural-gas-m3'])                 # entries and map agree, whichever won
        self.assertIn(e.emission_factor_id, (self.old.id, new.id))
        meta = ActivityLog.objects.get(action='inventory_repriced').metadata
        self.assertEqual(meta['before_total_kg'] in (before_total, before_total - 2680.0 + 5360.0), True)   # the previous approved total is on record
        self.assertEqual(meta['previous_factor_map']['pins']['natural-gas-m3'], self.old.id)

    def test_two_explicit_reprices_at_once(self):
        self.lock(); new = self.add_row()
        self.run_parallel(lambda: AF.reprice_inventory(self.report, self.user, 'first'), lambda: AF.reprice_inventory(self.report, self.user, 'second'))
        e, s = self.state()
        self.assertEqual((e.emission_factor_id, s['pins']['natural-gas-m3']), (new.id, new.id))
        logs = list(ActivityLog.objects.filter(action='inventory_repriced'))
        self.assertEqual(len(logs), 2)                                                       # both are on record
        moved = sorted(len(l.metadata['moved']) for l in logs)
        self.assertEqual(moved, [0, 1])                                                      # one moved the row, the other found nothing newer
        totals = {l.metadata['before_total_kg'] for l in logs}
        self.assertIn(round(20200.0 + 2680.0, 2), totals)                                    # the original approved total is preserved in one of them

    def test_sign_off_freeze_while_resync_runs(self):
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED, signed_at=timezone.now())
        new_holder = []
        self.run_parallel(lambda: AF.freeze_applied_factors(CarbonReport.objects.get(pk=self.report.pk)),
                          lambda: resync_inventory(self.company, 2025, self.user), lambda: new_holder.append(self.add_row()))
        e, s = self.state()
        self.assertEqual(e.emission_factor_id, self.old.id)
        self.assertEqual(s['pins']['natural-gas-m3'], self.old.id)

    def test_factor_row_change_while_rebuilding_a_locked_inventory(self):
        self.lock()
        self.run_parallel(lambda: self.api({**ANS, 'diesel': '2.000 litre'}), lambda: self.add_row())
        self.assertEqual(self.state()[0].emission_factor_id, self.old.id)


# ── 4. read-only guarantees (regression for the bug found in this stage) and the deploy-time backfill ───────────────
import hashlib  # noqa: E402
import json  # noqa: E402


def db_state():
    """Everything an audit must not touch: entries, every report's map / timestamps / flags, history, answers, factors."""
    entries = hashlib.sha256(json.dumps(list(EmissionEntry.objects.order_by('pk').values_list(
        'pk', 'emission_factor_id', 'quantity', 'calculated_co2e_kg', 'factor_value_snapshot', 'status', 'description')), default=str).encode()).hexdigest()
    reports = [(r.pk, json.dumps(r.applied_factors, sort_keys=True, default=str), str(r.updated_at), str(r.edited_after_signing_at), r.status, str(r.signed_at))
               for r in CarbonReport.objects.order_by('pk')]
    return (entries, reports, ActivityLog.objects.count(), ReportStep.objects.count(), EmissionFactor.objects.count(),
            EmissionEntry.objects.count())


class ReadOnlyGuarantees(Base):
    """BUG FOUND IN THIS STAGE: the shared lookup opened its own persisting pin context inside the 'read-only' preview, so the audit wrote
    first-use pins and its 'without pins' exposure figure was silently pinned. Fixed with the 'pins are managed here' flag."""
    def setUp(self):
        super().setUp()
        self.put('K3C8-0', 'yes')
        ReportStep.objects.update_or_create(report=self.report, step_id='D3', defaults={'answer': {'boundary_approach': 'operational_control'}})
        self.put('K3C8-1', {'items': [OFFICE], 'draft': {}})
        self.step(ANS)
        self.lock_quiet()                                                          # a legacy locked inventory: no map, no frozen_at
        CarbonReport.objects.filter(pk=self.report.pk).update(applied_factors={})
        self.add_row()                                                             # a newer natural-gas row exists
        self.add_row('turkey-grid-distribution', 'turkey', 2025, Decimal('0.5'))  # and a newer grid row

    def test_the_provenance_report_persists_nothing(self):
        before = db_state()
        AF.provenance_report()
        self.assertEqual(db_state(), before)

    def test_the_exposure_preview_persists_nothing_with_or_without_pins(self):
        self.report.refresh_from_db()
        before = db_state()
        for protect in (True, False):
            AF.rebuild_preview(self.report, protect=protect)
            self.assertEqual(db_state(), before, f'protect={protect}')

    def test_the_two_preview_modes_really_differ(self):
        """The 'without pins' mode shows the exposure; it must not be silently pinned by the shared lookup (the second symptom of the bug)."""
        self.report.refresh_from_db()
        without = {x['step']: x for x in AF.rebuild_preview(self.report, protect=False)}
        with_pins = {x['step']: x for x in AF.rebuild_preview(self.report, protect=True)}
        self.assertFalse(without['3A-5']['same'])          # a rebuild WITHOUT protection would move natural gas to the new row
        self.assertTrue(with_pins['3A-5']['same'])         # the entry's own row holds it
        self.assertFalse(with_pins['K3C8-1']['same'])      # but the calculated entry's underlying factor is NOT recorded: unproven

    def test_the_shared_lookup_inside_a_managed_context_opens_no_second_context(self):
        from emissions.factor_lookup import resolve_factor_and_amount
        from .step_entries import recorded_connections
        self.report.refresh_from_db()
        before = db_state()
        with recorded_connections(self.report, persist=False, protect=False):
            f = resolve_factor_and_amount('natural_gas', 100, 'm3', self.company, None, 2025)[0]
            self.assertNotEqual(f.id, self.old.id)                                 # the newest row: not pinned by a hidden nested context
        with recorded_connections(self.report, persist=False):
            f = resolve_factor_and_amount('natural_gas', 100, 'm3', self.company, None, 2025)[0]
            self.assertEqual(f.id, self.old.id)                                    # pinned from the entries, still nothing written
        self.assertEqual(db_state(), before)

    def test_the_report_and_dry_run_commands_persist_nothing(self):
        before = db_state()
        call_command('report_factor_provenance', stdout=io.StringIO())
        call_command('freeze_applied_factors', stdout=io.StringIO())              # dry run
        self.assertEqual(db_state(), before)


class BackfillProvenance(Base):
    def setUp(self):
        super().setUp()
        self.put('K3C8-0', 'yes')
        ReportStep.objects.update_or_create(report=self.report, step_id='D3', defaults={'answer': {'boundary_approach': 'operational_control'}})
        self.put('K3C8-1', {'items': [OFFICE], 'draft': {}})
        self.step(ANS)

    def run_backfill(self):
        call_command('backfill_calc_detail', stdout=io.StringIO())

    def test_it_cannot_falsely_establish_provenance_for_a_legacy_inventory(self):
        self.lock_quiet(); CarbonReport.objects.filter(pk=self.report.pk).update(applied_factors={})
        self.add_row('turkey-grid-distribution', 'turkey', 2025, Decimal('0.5'))
        before = db_state()
        self.run_backfill()
        after = db_state()
        self.assertEqual(after[1], before[1])                                      # no map, no frozen_at, no timestamps touched
        self.assertEqual(after[0], before[0])                                      # entries identical (amounts, factors, snapshots)
        self.assertFalse(AF.stored(self.report)['frozen_at'])

    def test_it_cannot_overwrite_a_frozen_map_or_its_provenance(self):
        self.lock()                                                                 # frozen through save(): provenance 'lock'
        self.add_row('turkey-grid-distribution', 'turkey', 2025, Decimal('0.5'))
        before = AF.stored(self.report)
        before_state = db_state()
        self.run_backfill()
        self.assertEqual(AF.stored(self.report), before)
        self.assertEqual(db_state()[0], before_state[0])
        self.assertEqual(before['provenance']['turkey-grid-distribution'], AF.LOCK)

    def test_it_leaves_a_held_inventory_alone(self):
        self.lock_quiet(); EmissionEntry.objects.filter(company=self.company, year=2025).delete()
        call_command('freeze_applied_factors', '--apply', stdout=io.StringIO())
        before = db_state()
        self.run_backfill()
        self.assertEqual(db_state(), before)
        self.assertTrue(AF.stored(self.report)['hold'])


class AdminRoutes(Base):
    def setUp(self):
        super().setUp()
        self.step(ANS); self.lock()
        self.admin_user = User.objects.create_superuser('root', 'root@test.com', 'rootpass12345')
        self.client.force_authenticate(user=None)
        self.client.force_login(self.admin_user)

    @override_settings(STORAGES={'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
                                 'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}})     # no collectstatic manifest in tests
    def test_admin_action_withdrawing_a_row_cannot_move_a_signed_inventory(self):
        self.add_row()
        r = self.client.post('/admin/emissions/emissionfactor/', {'action': 'make_inactive', '_selected_action': [self.old.pk]}, follow=True)
        self.assertEqual(r.status_code, 200)
        self.old.refresh_from_db()
        self.assertFalse(self.old.is_active)                                       # the action ran...
        from rest_framework.test import APIClient
        c = APIClient(); c.force_authenticate(user=self.user)
        cache.clear()
        c.patch(f'/api/questionnaire/{self.report.id}/step/', {'step': '3A-5', 'data': {'answer': {**ANS, 'diesel': '2.000 litre'}}, 'language': 'en'}, format='json')
        self.assertEqual(self.gas()[0], self.old.id)                               # ...and the signed inventory still holds its row

    def test_admin_save_model_cannot_edit_a_referenced_factor_value(self):
        from django.contrib import admin as dj_admin
        from django.test import RequestFactory
        ma = dj_admin.site._registry[EmissionFactor]
        f = EmissionFactor.objects.get(pk=self.old.pk); f.factor_kg_co2e = NEW
        req = RequestFactory().post('/admin/'); req.user = self.admin_user
        with self.assertRaises(ValidationError):
            ma.save_model(req, f, None, True)
        self.old.refresh_from_db(); self.assertEqual(self.old.factor_kg_co2e, Decimal('2.02'))

    def test_admin_style_entry_save_cannot_swap_the_row(self):
        new = self.add_row()
        from django.contrib import admin as dj_admin
        from django.test import RequestFactory
        e = EmissionEntry.objects.filter(company=self.company, year=2025, emission_factor__slug='natural-gas-m3').get()
        e.emission_factor = new
        req = RequestFactory().post('/admin/'); req.user = self.admin_user
        dj_admin.site._registry[EmissionEntry].save_model(req, e, None, True)
        e.refresh_from_db()
        self.assertEqual((e.emission_factor_id, round(float(e.calculated_co2e_kg), 2)), (self.old.id, 20200.0))

