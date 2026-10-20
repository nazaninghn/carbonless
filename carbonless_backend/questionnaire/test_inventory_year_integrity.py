"""F-4 (Stage 1 audit): one inventory per company and reporting year.

Emission entries are kept per company and year, not per inventory, so two
inventories of the same year share one set of numbers: saving a question in
the second one silently replaced the first one's calculated entries — a signed,
completed inventory included — and nothing was flagged. The product rule is
one inventory per company per year; it is enforced by the database (a partial
unique constraint) and by the write paths, and these tests pin both.

Fixtures: StepEntriesTests' Turkish company and owner (a 2025 inventory)."""
import threading
from unittest import mock

from django.contrib.auth.models import User
from django.db import IntegrityError, connection
from django.test import TransactionTestCase
from django.utils import timezone

from companies.models import Company, CompanyMembership
from emissions.models import EmissionEntry
from . import tests as _base
from .models import CarbonReport, ReportStep

# Rows that belong to a duplicate group which existed before the rule did: the
# migration flags them (nothing else about them is touched). Written so this
# module also runs against code from before the flag existed.
LEGACY = {'legacy_duplicate_year': True} if hasattr(CarbonReport, 'legacy_duplicate_year') else {}
SITES = {'1': {'name': 'Gebze', 'country': 'TR', 'grid_connection': 'distribution'}}


class _Year(_base.TestCase):
    setUp = _base.StepEntriesTests.setUp          # company, owner, self.report (2025), self.client
    _factor = _base.StepEntriesTests._factor
    _step = _base.StepEntriesTests._step

    def _populate(self, report=None, kwh='1000 kWh'):
        report = report or self.report
        for sid, ans in (('2A-2', SITES), ('4A-1', {'1': kwh})):
            r = self.client.patch(f'/api/questionnaire/{report.id}/step/',
                                  {'step': sid, 'data': {'answer': ans}, 'language': 'en'}, format='json')
            self.assertEqual(r.status_code, 200, r.content)
        if report.reporting_year:
            self.assertTrue(EmissionEntry.objects.filter(company=self.company, year=report.reporting_year,
                                                         status='approved').exists(), 'the inventory should hold entries')

    def _figures(self, year=2025):
        return sorted((e.description, round(float(e.quantity), 4), round(float(e.calculated_co2e_kg), 4), e.status)
                      for e in EmissionEntry.objects.filter(company=self.company, year=year))

    def _lock(self, report=None):
        report = report or self.report
        CarbonReport.objects.filter(pk=report.pk).update(status=CarbonReport.Status.COMPLETED, signed_at=timezone.now())

    def _start(self, year=2025, **extra):
        # The Wizard UI always sends force_new; without it `start` resumes the company's in-progress inventory.
        body = {'reporting_year': year, 'title': f'Inventory {year}', 'force_new': True, **extra}
        return self.client.post('/api/questionnaire/start/', body, format='json')

    def _history(self, action):
        from accounts.models import ActivityLog
        return list(ActivityLog.objects.filter(action=action))


class OneInventoryPerYearTests(_Year):
    """The original failure and the rule that prevents it."""

    def test_a_second_draft_for_the_same_year_is_refused(self):
        self._populate()
        before = self._figures()
        r = self._start(2025, force_new=True)
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_exists_for_year')
        self.assertEqual(r.data['existing']['report_id'], self.report.id)
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year=2025).count(), 1)
        self.assertEqual(self._figures(), before)

    def test_force_new_is_not_a_way_around_it(self):
        self._populate()
        for flag in (True, 'true', 1, 'yes'):
            self.assertEqual(self._start(2025, force_new=flag).status_code, 409, flag)
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year=2025).count(), 1)

    def test_without_force_new_the_existing_in_progress_inventory_is_resumed_and_nothing_is_created(self):
        self._populate()
        r = self.client.post('/api/questionnaire/start/', {'reporting_year': 2025}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.data['resumed'])
        self.assertEqual(r.data['report_id'], self.report.id)
        self.assertEqual(CarbonReport.objects.filter(company=self.company).count(), 1)

    def test_a_different_year_is_fine(self):
        self._populate()
        r = self._start(2024, force_new=True)
        self.assertEqual(r.status_code, 201, r.content)

    def test_another_company_may_have_the_same_year(self):
        from rest_framework.test import APIClient
        other = Company.objects.create(legal_entity_name='Other Co', tax_number='88', country_of_headquarters='TR',
                                       countries_of_operation='TR', nace_code='', main_activity_description='x',
                                       number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        u = User.objects.create_user('othr', 'o@test.com', 'pass12345')
        CompanyMembership.objects.create(user=u, company=other, role='owner')
        c = APIClient(); c.force_authenticate(user=u)
        r = c.post('/api/questionnaire/start/', {'reporting_year': 2025, 'force_new': True}, format='json')
        self.assertEqual(r.status_code, 201, r.content)

    def test_a_draft_alongside_a_signed_inventory_is_refused_and_the_signed_one_is_untouched(self):
        self._populate()
        self._lock()
        before = self._figures()
        r = self._start(2025, force_new=True)
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['existing']['status'], 'completed')
        self.assertTrue(r.data['existing']['signed'])
        self.assertEqual(self._figures(), before)                                  # values untouched
        self.report.refresh_from_db()
        self.assertIsNotNone(self.report.signed_at)
        self.assertIsNone(self.report.edited_after_signing_at)                    # nothing was edited: no flag
        [row] = self._history('inventory_duplicate_blocked')                      # but the attempt is on record
        self.assertEqual((row.target_type, row.target_id), ('CarbonReport', str(self.report.pk)))
        self.assertEqual(row.metadata['reporting_year'], 2025)
        self.assertIn('already', row.metadata['detail_en'])

    def test_a_refused_attempt_against_a_draft_leaves_no_signed_year_record(self):
        self._populate()
        self._start(2025, force_new=True)
        self.assertEqual(self._history('inventory_duplicate_blocked'), [])        # only a locked inventory is worth an audit row

    def test_changing_the_year_of_another_inventory_onto_a_covered_year_is_refused(self):
        """Step A4 sets the reporting year: it must not move an inventory onto a year already covered."""
        self._populate()
        self._lock()
        before = self._figures()
        r24 = self._start(2024)
        self.assertEqual(r24.status_code, 201)
        rid = r24.data['report_id']
        r = self.client.patch(f'/api/questionnaire/{rid}/step/',
                              {'step': 'A4', 'data': {'reporting_year': 2025}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_exists_for_year')
        self.assertEqual(CarbonReport.objects.get(pk=rid).reporting_year, 2024)   # unchanged
        self.assertEqual(self._figures(), before)

    def test_an_inventory_may_set_its_own_year_to_the_year_it_already_has(self):
        self._populate()
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': 'A4', 'data': {'reporting_year': 2025}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)

    def test_an_inventory_without_a_year_cannot_write_entries_into_another_year(self):
        """Without a year the engine used 2024 — a real 2024 inventory's numbers."""
        self._factor('turkey-grid', 'kwh', 0.4, scope='scope2', country='turkey')
        r24 = self._start(2024)
        rid24 = r24.data['report_id']
        self.client.patch(f'/api/questionnaire/{rid24}/step/', {'step': '2A-2', 'data': {'answer': SITES}, 'language': 'en'}, format='json')
        self.client.patch(f'/api/questionnaire/{rid24}/step/', {'step': '4A-1', 'data': {'answer': {'1': '500 kWh'}}, 'language': 'en'}, format='json')
        self._lock(CarbonReport.objects.get(pk=rid24))
        before = self._figures(2024)
        self.assertTrue(before, 'the 2024 inventory should hold entries')
        yearless = self.client.post('/api/questionnaire/start/', {'force_new': True}, format='json')
        self.assertEqual(yearless.status_code, 201)
        rid = yearless.data['report_id']
        r = self.client.patch(f'/api/questionnaire/{rid}/step/', {'step': '4A-1', 'data': {'answer': {'1': '9 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'reporting_year_required')
        self.assertEqual(self._figures(2024), before)

    def test_the_profile_steps_work_without_a_year_so_the_year_can_be_set(self):
        rid = self.client.post('/api/questionnaire/start/', {'force_new': True}, format='json').data['report_id']
        r = self.client.patch(f'/api/questionnaire/{rid}/step/', {'step': 'A4', 'data': {'reporting_year': 2023}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(CarbonReport.objects.get(pk=rid).reporting_year, 2023)


class DatabaseLevelRuleTests(_Year):
    """The rule holds below the API too: the database refuses a duplicate."""

    def test_the_database_refuses_a_second_inventory_for_a_company_and_year(self):
        from django.db import transaction
        with self.assertRaises(IntegrityError), transaction.atomic():
            CarbonReport.objects.create(company=self.company, reporting_year=2025)

    def test_inventories_without_a_year_are_not_constrained(self):
        CarbonReport.objects.create(company=self.company)
        CarbonReport.objects.create(company=self.company)
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year__isnull=True).count(), 2)

    def test_a_race_that_passes_the_application_check_is_stopped_by_the_database(self):
        """Two requests both see 'no inventory for 2025' and both try to create one."""
        from . import year_guard
        CarbonReport.objects.filter(company=self.company, reporting_year=2025).delete()
        first = self._start(2025)
        self.assertEqual(first.status_code, 201)
        real, calls = year_guard.other_inventories_for_year, []

        def blind_once(*a, **k):           # the request's own check ran before the first one committed
            calls.append(1)
            return [] if len(calls) == 1 else real(*a, **k)
        with mock.patch('questionnaire.year_guard.other_inventories_for_year', side_effect=blind_once):
            second = self._start(2025, force_new=True)
        self.assertGreaterEqual(len(calls), 2)                              # it checked again after the database refused
        self.assertEqual(second.status_code, 409, second.content)
        self.assertEqual(second.data['code'], 'inventory_exists_for_year')
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year=2025).count(), 1)


class ConcurrentStartTests(TransactionTestCase):
    """Several requests starting the same year at once: exactly one wins."""

    def setUp(self):
        self.user = User.objects.create_user('race', 'race@test.com', 'pass12345')
        self.company = Company.objects.create(legal_entity_name='Race Co', tax_number='5', country_of_headquarters='TR',
                                              countries_of_operation='TR', nace_code='', main_activity_description='x',
                                              number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')

    def test_exactly_one_of_several_simultaneous_starts_succeeds(self):
        """SQLite's in-memory test database locks whole tables, so a client retries when it is told
        'locked' (as a real client would); the invariant is not relaxed: one inventory, no duplicate, no 500."""
        import time
        from django.db import OperationalError
        from rest_framework.test import APIClient
        n = 4
        barrier, results = threading.Barrier(n), []

        def go():
            try:
                c = APIClient(); c.force_authenticate(user=self.user)
                barrier.wait(timeout=10)
                for _ in range(80):
                    try:
                        results.append(c.post('/api/questionnaire/start/', {'reporting_year': 2025, 'force_new': True},
                                              format='json').status_code)
                        return
                    except OperationalError:
                        time.sleep(0.05)
                results.append('gave up')
            finally:
                connection.close()
        threads = [threading.Thread(target=go) for _ in range(n)]
        [t.start() for t in threads]; [t.join(60) for t in threads]
        # The invariant: one inventory only, and no answer other than created / refused. (On SQLite's
        # table locks a creator's own response can be lost to a lock error — the retry then sees the conflict —
        # so "exactly one 201" cannot be required here; "never more than one row" can, and is the point.)
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year=2025).count(), 1, results)
        self.assertTrue(all(r in (201, 409) for r in results), results)
        self.assertEqual(len(results), n, results)
        self.assertLessEqual(results.count(201), 1, results)


class LegacyDuplicateGroupTests(_Year):
    """Groups that existed before the rule: they are left exactly as they are,
    but none of their members can overwrite the others any more."""

    def _legacy_group(self):
        """self.report (2025, with entries) plus a second 2025 inventory, as old data had."""
        self._populate()
        dup = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                          title='old duplicate', **LEGACY) if LEGACY else \
            CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025, title='old duplicate')
        if LEGACY:
            CarbonReport.objects.filter(pk=self.report.pk).update(**LEGACY)
        return dup

    def test_a_member_of_a_duplicate_group_cannot_overwrite_a_signed_member(self):
        dup = self._legacy_group()
        self._lock()
        before = self._figures()
        r = self.client.patch(f'/api/questionnaire/{dup.id}/step/',
                              {'step': '4A-1', 'data': {'answer': {'1': '7 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_exists_for_year')
        self.assertEqual(self._figures(), before)
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)
        self.assertFalse(ReportStep.objects.filter(report=dup, step_id='4A-1').exists())   # nothing was saved either

    def test_nor_can_the_signed_member_overwrite_the_others(self):
        dup = self._legacy_group()
        self._lock()
        before = self._figures()
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': '4A-1', 'data': {'answer': {'1': '8 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(self._figures(), before)

    def test_restarting_a_draft_does_not_delete_the_entries_a_signed_inventory_shares(self):
        dup = self._legacy_group()
        self._lock()
        before = self._figures()
        r = self.client.post(f'/api/questionnaire/{dup.id}/restart/', format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(self._figures(), before)

    def test_resolving_the_duplicate_unblocks_the_inventory(self):
        dup = self._legacy_group()
        self._lock()
        self.client.delete(f'/api/questionnaire/{dup.id}/')                     # the owner removes the extra draft
        if not CarbonReport.objects.filter(pk=dup.pk).exists():
            r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                                  {'step': '4A-1', 'data': {'answer': {'1': '1000 kWh'}}, 'language': 'en'}, format='json')
            self.assertEqual(r.status_code, 200, r.content)


class AuditAndEditedAfterSigningTests(_Year):
    """What is recorded when a signed inventory is edited, and what is not."""

    def test_an_authorised_edit_of_the_signed_inventory_is_flagged_and_logged(self):
        self._populate()
        self._lock()
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': '4A-1', 'data': {'answer': {'1': '2000 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.report.refresh_from_db()
        self.assertIsNotNone(self.report.edited_after_signing_at)
        self.assertTrue(self._history('questionnaire_changed'))
        self.assertEqual([q for _d, q, _k, _s in self._figures()], [2000.0])

    def test_a_refused_write_changes_no_flag_and_adds_no_change_row(self):
        self._populate()
        self._lock()
        rows_before = len(self._history('questionnaire_changed'))
        self._start(2025, force_new=True)
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)
        self.assertEqual(len(self._history('questionnaire_changed')), rows_before)


class EntriesOfAnotherInventoryTests(_Year):
    """The remaining ways to reach entries that belong to an inventory."""

    def test_entries_created_by_the_questionnaire_cannot_be_edited_or_deleted_through_the_emissions_api(self):
        self._populate()
        self._lock()
        before = self._figures()
        e = EmissionEntry.objects.filter(company=self.company, year=2025).first()
        r = self.client.patch(f'/api/emissions/entries/{e.id}/', {'quantity': 5}, format='json')
        self.assertEqual((r.status_code, r.data.get('code')), (400, 'edit_in_questionnaire'))
        r = self.client.delete(f'/api/emissions/entries/{e.id}/')
        self.assertEqual((r.status_code, r.data.get('code')), (400, 'edit_in_questionnaire'))
        self.assertEqual(self._figures(), before)

    def test_a_user_of_another_company_cannot_write_to_this_inventory(self):
        from rest_framework.test import APIClient
        self._populate()
        self._lock()
        before = self._figures()
        other = Company.objects.create(legal_entity_name='Intruder Co', tax_number='99', country_of_headquarters='TR',
                                       countries_of_operation='TR', nace_code='', main_activity_description='x',
                                       number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        u = User.objects.create_user('intr', 'i@test.com', 'pass12345')
        CompanyMembership.objects.create(user=u, company=other, role='owner')
        c = APIClient(); c.force_authenticate(user=u)
        r = c.patch(f'/api/questionnaire/{self.report.id}/step/', {'step': '4A-1', 'data': {'answer': {'1': '1 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 404)
        self.assertEqual(c.post(f'/api/questionnaire/{self.report.id}/restart/').status_code, 404)
        self.assertEqual(self._figures(), before)


class MigrationFlagsLegacyDuplicatesTests(TransactionTestCase):
    """Migration 0012 marks the members of existing duplicate groups and adds
    the constraint — it changes no value, deletes nothing and refuses nothing."""
    available_apps = None

    def test_existing_duplicates_are_flagged_not_changed(self):
        from django.db.migrations.executor import MigrationExecutor
        ex = MigrationExecutor(connection)
        if ('questionnaire', '0012_one_inventory_per_year') not in ex.loader.graph.nodes:
            self.skipTest('migration 0012 not present')
        ex.migrate([('questionnaire', '0011_report_applied_grid_connections')])
        old = ex.loader.project_state([('questionnaire', '0011_report_applied_grid_connections')]).apps
        Report_ = old.get_model('questionnaire', 'CarbonReport')
        # only `questionnaire` is rolled back: the company comes from the current model, its reports from the old one
        co = Company.objects.create(legal_entity_name='Mig Co', tax_number='3', country_of_headquarters='TR',
                                    countries_of_operation='TR', nace_code='', main_activity_description='x',
                                    number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        a = Report_.objects.create(company_id=co.pk, reporting_year=2024, title='a', status='completed', signed_at=timezone.now())
        b = Report_.objects.create(company_id=co.pk, reporting_year=2024, title='b', status='in_progress')
        c = Report_.objects.create(company_id=co.pk, reporting_year=2025, title='c', status='in_progress')
        d = Report_.objects.create(company_id=co.pk, reporting_year=None, title='d')
        e = Report_.objects.create(company_id=co.pk, reporting_year=None, title='e')
        snapshot = {r.pk: (r.title, r.status, r.reporting_year, r.signed_at) for r in Report_.objects.all()}
        ex = MigrationExecutor(connection)
        ex.migrate([('questionnaire', '0012_one_inventory_per_year')])
        new = ex.loader.project_state([('questionnaire', '0012_one_inventory_per_year')]).apps
        R = new.get_model('questionnaire', 'CarbonReport')
        self.assertEqual(R.objects.count(), 5)                                                  # nothing deleted
        self.assertEqual({r.pk: (r.title, r.status, r.reporting_year, r.signed_at) for r in R.objects.all()}, snapshot)
        flags = {r.pk: r.legacy_duplicate_year for r in R.objects.all()}
        self.assertEqual(flags, {a.pk: True, b.pk: True, c.pk: False, d.pk: False, e.pk: False})
        # leave the schema at the latest migration for the tests that follow
        MigrationExecutor(connection).migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())


class ReviewCommandAndMessageTests(_Year):
    """The way out for a legacy duplicate group, and the message the user sees."""

    def _legacy_pair(self):
        self._populate()
        if not LEGACY:
            self.skipTest('legacy flag not present')
        dup = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                          title='old duplicate', **LEGACY)
        CarbonReport.objects.filter(pk=self.report.pk).update(**LEGACY)
        return dup

    def _run(self, *args):
        import io
        from django.core.management import call_command
        out = io.StringIO()
        call_command('review_duplicate_inventories', *args, stdout=out)
        return out.getvalue()

    def test_the_command_lists_the_group_and_changes_nothing(self):
        dup = self._legacy_pair()
        before = (self._figures(), list(CarbonReport.objects.order_by('pk').values_list('pk', 'status', 'legacy_duplicate_year', 'updated_at')))
        out = self._run()
        self.assertIn('2025 · 2 inventories', out)
        self.assertIn(f'#{dup.pk}', out)
        self.assertIn('1 duplicate group(s)', out)
        self.assertEqual((self._figures(), list(CarbonReport.objects.order_by('pk').values_list('pk', 'status', 'legacy_duplicate_year', 'updated_at'))), before)

    def test_clear_resolved_clears_only_the_flags_of_inventories_that_are_alone_now(self):
        dup = self._legacy_pair()
        self.assertIn('2 inventories', self._run('--clear-resolved'))                      # still a group: nothing cleared
        self.assertTrue(CarbonReport.objects.get(pk=self.report.pk).legacy_duplicate_year)
        CarbonReport.objects.filter(pk=dup.pk).delete()                                    # the owner resolved it
        out = self._run('--clear-resolved')
        self.assertIn('cleared the flag on 1', out)
        self.assertFalse(CarbonReport.objects.get(pk=self.report.pk).legacy_duplicate_year)
        # and the inventory is protected by the database again
        from django.db import transaction
        with self.assertRaises(IntegrityError), transaction.atomic():
            CarbonReport.objects.create(company=self.company, reporting_year=2025)

    def test_the_conflict_message_comes_in_both_languages_and_names_the_inventory_in_the_way(self):
        self._populate()
        self._lock()
        r = self.client.post('/api/questionnaire/start/', {'reporting_year': 2025, 'force_new': True, 'language': 'tr'}, format='json')
        self.assertEqual(r.status_code, 409)
        self.assertIn('zaten bir envanter var', r.data['error'])                           # the requested language
        self.assertIn('already has an inventory', r.data['error_en'])
        self.assertIn('zaten bir envanter var', r.data['error_tr'])
        self.assertIn('imzalı', r.data['error_tr'])                                        # a signed one is called signed
        self.assertIn('signed', r.data['error_en'])
        self.assertIn(self.report.title or '2025', r.data['error_en'])


class EngineLevelGuardTests(_Year):
    """Callers that do not go through the step endpoint (scripts, the admin's factor approval, Settings)
    meet the same rule at the calculation engine itself."""

    def test_the_engine_refuses_to_recalculate_a_year_two_inventories_share(self):
        from .step_entries import sync_step_entries
        from .year_guard import InventoryYearConflict
        self._populate()
        if not LEGACY:
            self.skipTest('legacy flag not present')
        CarbonReport.objects.create(company=self.company, reporting_year=2025, title='old', **LEGACY)
        CarbonReport.objects.filter(pk=self.report.pk).update(**LEGACY)
        before = self._figures()
        with self.assertRaises(InventoryYearConflict) as ctx:
            sync_step_entries(self.user, self.company, self.report, '4A-1')
        self.assertEqual(ctx.exception.year, 2025)
        self.assertEqual(self._figures(), before)

    def test_the_engine_writes_no_entries_for_an_inventory_without_a_year(self):
        from .step_entries import sync_step_entries
        before = self._figures(2024)
        report = CarbonReport.objects.create(company=self.company, created_by=self.user, title='no year')
        ReportStep.objects.create(report=report, step_id='2A-2', answer={'answer': SITES})
        ReportStep.objects.create(report=report, step_id='4A-1', answer={'answer': {'1': '5 kWh'}})
        self.assertEqual(sync_step_entries(self.user, self.company, report, '4A-1'), [])
        self.assertEqual(self._figures(2024), before)
        self.assertFalse(EmissionEntry.objects.filter(company=self.company, description__startswith='Questionnaire step').exists())

    def test_the_admin_factor_resync_skips_a_year_two_inventories_share(self):
        from .step_entries import resync_inventory
        self._populate()
        if not LEGACY:
            self.skipTest('legacy flag not present')
        CarbonReport.objects.create(company=self.company, reporting_year=2025, title='old', **LEGACY)
        CarbonReport.objects.filter(pk=self.report.pk).update(**LEGACY)
        before = self._figures()
        self.assertEqual(resync_inventory(self.company, 2025, self.user), [])
        self.assertEqual(self._figures(), before)

    def test_a_settings_grid_connection_change_does_not_fail_because_of_a_legacy_duplicate(self):
        """set_connection_in_answers walks every inventory of the company: a duplicate must be skipped, not crash it."""
        from companies.models import Facility
        self._populate()
        if not LEGACY:
            self.skipTest('legacy flag not present')
        CarbonReport.objects.create(company=self.company, reporting_year=2025, title='old', **LEGACY)
        CarbonReport.objects.filter(pk=self.report.pk).update(**LEGACY)
        gebze = Facility.objects.get(company=self.company, name='Gebze')
        r = self.client.patch(f'/api/companies/facilities/{gebze.pk}/', {'grid_connection': 'transmission'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
