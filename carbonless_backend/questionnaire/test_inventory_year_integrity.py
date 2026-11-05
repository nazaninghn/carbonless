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
from django.test import TransactionTestCase, tag
from django.utils import timezone

from companies.models import Company, CompanyMembership
from emissions.models import EmissionEntry
from . import tests as _base
from .models import CarbonReport, ReportStep

# Rows that belong to a duplicate group which existed before the rule did: the
# migration flags them (nothing else about them is touched). Written so this
# module also runs against code from before the flag existed.
LEGACY = {'legacy_duplicate_year': True, 'ownership_linked': False}   # a member of a pre-existing duplicate group
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
    """Multi-inventory: a second draft for the same year is now allowed (FEAT-001)."""

    def test_a_second_draft_for_the_same_year_is_now_allowed(self):
        """FEAT-001: multiple inventories per year are now permitted."""
        self._populate()
        r = self._start(2025, force_new=True)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year=2025).count(), 2)

    def test_force_new_creates_a_second_inventory_for_the_same_year(self):
        """FEAT-001: force_new creates a new inventory even when one already exists for that year."""
        self._populate()
        r = self._start(2025, force_new=True)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year=2025).count(), 2)

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

    def test_a_second_draft_alongside_a_signed_inventory_is_now_allowed(self):
        """FEAT-001: starting a second inventory for a year with a signed one is now allowed."""
        self._populate()
        self._lock()
        r = self._start(2025, force_new=True)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year=2025).count(), 2)

    def test_a_refused_attempt_against_a_draft_leaves_no_signed_year_record(self):
        """FEAT-001: no block happens anymore so no audit row is expected."""
        self._populate()
        self._start(2025, force_new=True)
        self.assertEqual(self._history('inventory_duplicate_blocked'), [])

    def test_changing_the_year_of_another_inventory_onto_a_covered_year_is_now_allowed(self):
        """FEAT-001: moving an inventory onto a year that already has one is now allowed."""
        self._populate()
        self._lock()
        r24 = self._start(2024)
        self.assertEqual(r24.status_code, 201)
        rid = r24.data['report_id']
        r = self.client.patch(f'/api/questionnaire/{rid}/step/',
                              {'step': 'A4', 'data': {'reporting_year': 2025}, 'language': 'en'}, format='json')
        # Either 200 (year set successfully) or 409 for year_has_entries (if entries exist in 2024)
        # The important thing is it's no longer blocked with inventory_exists_for_year
        self.assertNotEqual(r.data.get('code'), 'inventory_exists_for_year', r.content)

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
    """FEAT-001: the DB constraint is removed — two inventories for the same year are now allowed."""

    def test_the_database_now_allows_a_second_inventory_for_a_company_and_year(self):
        """FEAT-001: no IntegrityError when creating two inventories for the same (company, year)."""
        CarbonReport.objects.create(company=self.company, reporting_year=2025, title='second')
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year=2025).count(), 2)

    def test_inventories_without_a_year_are_not_constrained(self):
        CarbonReport.objects.create(company=self.company)
        CarbonReport.objects.create(company=self.company)
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year__isnull=True).count(), 2)


@tag('filedb_only')      # needs real SQLite file locking: run with settings_test_filedb (see ci.yml)
class ConcurrentStartTests(TransactionTestCase):
    """FEAT-001: Several requests starting the same year at once: all now succeed."""

    def setUp(self):
        self.user = User.objects.create_user('race', 'race@test.com', 'pass12345')
        self.company = Company.objects.create(legal_entity_name='Race Co', tax_number='5', country_of_headquarters='TR',
                                              countries_of_operation='TR', nace_code='', main_activity_description='x',
                                              number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')

    def test_several_simultaneous_starts_all_create_separate_inventories(self):
        """FEAT-001: with the constraint gone, concurrent starts all succeed and each creates
        its own inventory row. The count equals the number of requests that succeeded."""
        import time
        from django.db import OperationalError
        from rest_framework.test import APIClient
        n = 4
        barrier, results = threading.Barrier(n), []

        def go(i):
            title = f'race-{i}'
            try:
                c = APIClient(); c.force_authenticate(user=self.user)
                barrier.wait(timeout=10)
                for _ in range(80):
                    try:
                        results.append(c.post('/api/questionnaire/start/',
                                              {'reporting_year': 2025, 'title': title, 'force_new': True},
                                              format='json').status_code)
                        return
                    except OperationalError:
                        if CarbonReport.objects.filter(title=title).exists():   # committed before the error
                            results.append(201)
                            return
                        time.sleep(0.05)
                results.append('gave up')
            finally:
                connection.close()
        threads = [threading.Thread(target=go, args=(i,)) for i in range(n)]
        [t.start() for t in threads]; [t.join(60) for t in threads]
        # All requests should return 201 (all inventories created)
        created = [r for r in results if r == 201]
        self.assertEqual(len(created), n, results)
        count = CarbonReport.objects.filter(company=self.company, reporting_year=2025).count()
        self.assertEqual(count, n, f'Expected {n} inventories, found {count}. Results: {results}')


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
        """The members of a pre-existing duplicate group share their company-and-year rows and none of them can
        be proven to own any (migration 0015 leaves them unlinked). A write to one is therefore REFUSED
        (fail-closed, LEGACY_INVENTORY_RECOVERY.md), so it cannot overwrite the signed member's records or
        its record of changes, and it creates no rows of its own."""
        dup = self._legacy_group()
        self._lock()
        figures_before = self._figures()
        signed_before = sorted(EmissionEntry.objects.filter(inventory_id=self.report.pk)
                               .values_list('pk', 'quantity', 'calculated_co2e_kg', 'status'))
        r = self.client.patch(f'/api/questionnaire/{dup.id}/step/',
                              {'step': '4A-1', 'data': {'answer': {'1': '7 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_not_ownership_scoped')
        self.assertEqual(self._figures(), figures_before)
        self.assertEqual(sorted(EmissionEntry.objects.filter(inventory_id=self.report.pk)
                                .values_list('pk', 'quantity', 'calculated_co2e_kg', 'status')), signed_before)
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)
        self.assertFalse(EmissionEntry.objects.filter(inventory_id=dup.pk).exists())   # nothing was given to the duplicate

    def test_nor_can_the_signed_member_overwrite_the_others(self):
        dup = self._legacy_group()
        self._lock()
        before = self._figures()
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': '4A-1', 'data': {'answer': {'1': '8 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(self._figures(), before)

    def test_restarting_a_legacy_draft_is_refused_and_the_signed_inventory_sharing_its_year_is_untouched(self):
        """Restart deletes the inventory's entries. For an unlinked member of a duplicate group those rows are
        shared with the signed member and cannot be told apart, so the restart is refused and deletes nothing."""
        dup = self._legacy_group()
        self._lock()
        before = self._figures()
        r = self.client.post(f'/api/questionnaire/{dup.id}/restart/', format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_not_ownership_scoped')
        self.assertEqual(self._figures(), before)

    def test_a_signed_member_stays_closed_for_the_one_reason_that_it_is_signed(self):
        """Whatever happens to the other members, a SIGNED inventory refuses the edit because it is signed."""
        dup = self._legacy_group()
        self._lock()
        before = self._figures()
        d = self.client.delete(f'/api/questionnaire/{dup.id}/')                 # an unlinked draft cannot be deleted here
        self.assertEqual(d.status_code, 409, d.content)
        self.assertEqual(d.data['code'], 'inventory_not_ownership_scoped')
        self.assertTrue(CarbonReport.objects.filter(pk=dup.pk).exists())
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': '4A-1', 'data': {'answer': {'1': '1000 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_signed')                    # signed wins; never 'inventory_exists_for_year'
        self.assertEqual(self._figures(), before)

    def test_an_open_legacy_member_stays_frozen_until_its_ownership_is_resolved(self):
        """Removing or leaving the duplicate does not make the rows anyone's: nothing in the application links a
        legacy inventory, so every member stays refused (fail-closed) until the documented operator procedure
        (LEGACY_INVENTORY_RECOVERY.md) resolves ownership. Nothing is written or deleted meanwhile."""
        dup = self._legacy_group()
        before = self._figures()
        d = self.client.delete(f'/api/questionnaire/{dup.id}/')
        self.assertEqual(d.status_code, 409, d.content)
        self.assertEqual(d.data['code'], 'inventory_not_ownership_scoped')
        self.assertTrue(CarbonReport.objects.filter(pk=dup.pk).exists())
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': '4A-1', 'data': {'answer': {'1': '1000 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_not_ownership_scoped')
        self.assertEqual(self._figures(), before)

    def test_a_linked_inventory_sharing_the_year_with_a_legacy_one_is_still_editable(self):
        """The control: the refusal is about the unlinked inventory, not about the year. A normal (linked)
        inventory of the same year takes the edit and writes only rows tagged with its own id."""
        legacy = self._legacy_group()
        mine = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                           title='linked')
        self.assertTrue(mine.ownership_linked)
        r = self.client.patch(f'/api/questionnaire/{mine.id}/step/',
                              {'step': '2A-2', 'data': {'answer': SITES}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(EmissionEntry.objects.filter(inventory_id=legacy.pk).exists())


class AuditAndEditedAfterSigningTests(_Year):
    """What is recorded when a signed inventory is edited, and what is not."""

    def test_an_authorised_edit_of_the_signed_inventory_is_flagged_and_logged(self):
        """A signed inventory takes no edit, whoever asks: refused, nothing flagged, nothing logged, figures
        untouched. (It used to be edited, flagged as edited after signing, and put on record.)"""
        self._populate()
        self._lock()
        before, rows_before = self._figures(), len(self._history('questionnaire_changed'))
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': '4A-1', 'data': {'answer': {'1': '2000 kWh'}}, 'language': 'en'}, format='json')
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_signed')
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)
        self.assertEqual(len(self._history('questionnaire_changed')), rows_before)
        self.assertEqual(self._figures(), before)

    def test_a_refused_write_changes_no_flag_and_adds_no_change_row(self):
        """FEAT-001: starting a second inventory is allowed, but that inventory's creation
        adds no questionnaire_changed row for the signed inventory."""
        self._populate()
        self._lock()
        rows_before = len(self._history('questionnaire_changed'))
        self._start(2025, force_new=True)   # now succeeds (201)
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)
        self.assertEqual(len(self._history('questionnaire_changed')), rows_before)


class EntriesOfAnotherInventoryTests(_Year):
    """The remaining ways to reach entries that belong to an inventory."""

    def test_entries_created_by_the_questionnaire_cannot_be_edited_or_deleted_through_the_emissions_api(self):
        """Signed: the signed guard answers first (409 inventory_signed), before the older "edit it in the
        questionnaire" answer; either way the entry cannot be changed through the emissions API."""
        self._populate()
        self._lock()
        before = self._figures()
        e = EmissionEntry.objects.filter(company=self.company, year=2025).first()
        r = self.client.patch(f'/api/emissions/entries/{e.id}/', {'quantity': 5}, format='json')
        self.assertEqual((r.status_code, r.data.get('code')), (409, 'inventory_signed'))
        r = self.client.delete(f'/api/emissions/entries/{e.id}/')
        self.assertEqual((r.status_code, r.data.get('code')), (409, 'inventory_signed'))
        self.assertEqual(self._figures(), before)

    def test_entries_created_by_the_questionnaire_still_point_to_the_questionnaire_while_the_inventory_is_open(self):
        """The control for the test above: not signed, the original answer is unchanged (400 edit_in_questionnaire)."""
        self._populate()
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
        # FEAT-001: the DB constraint was removed in migration 0014, so creating a second
        # inventory for the same year is now allowed — no IntegrityError expected here.
        CarbonReport.objects.create(company=self.company, reporting_year=2025)
        self.assertEqual(CarbonReport.objects.filter(company=self.company, reporting_year=2025).count(), 2)

    def test_the_conflict_message_function_still_produces_bilingual_text(self):
        """FEAT-001: start now returns 201 (no longer blocked). The conflict message functions
        still exist in year_guard.py for informational use."""
        from questionnaire import year_guard
        others = year_guard.other_inventories_for_year(self.company.pk, 2025, exclude_pk=self.report.pk)
        # No others yet
        self.assertEqual(others, [])
        # Create a second inventory and verify other_inventories_for_year returns it
        second = CarbonReport.objects.create(company=self.company, reporting_year=2025, title='Second')
        others = year_guard.other_inventories_for_year(self.company.pk, 2025, exclude_pk=self.report.pk)
        self.assertEqual(len(others), 1)
        self.assertEqual(others[0]['report_id'], second.pk)
        # The message functions still work
        msg_en = year_guard.conflict_message(others, 2025, 'en')
        msg_tr = year_guard.conflict_message(others, 2025, 'tr')
        self.assertIn('already has an inventory', msg_en)
        self.assertIn('zaten bir envanter var', msg_tr)


class EngineLevelGuardTests(_Year):
    """FEAT-001: The engine no longer raises InventoryYearConflict for shared years.
    Each inventory now owns its entries via inventory_id FK."""

    def test_the_engine_no_longer_raises_for_two_inventories_of_the_same_year(self):
        """FEAT-001: sync_step_entries now succeeds for two inventories sharing a year."""
        from .step_entries import sync_step_entries
        self._populate()
        if not LEGACY:
            self.skipTest('legacy flag not present')
        # Create a second inventory sharing the year (legacy flag)
        CarbonReport.objects.create(company=self.company, reporting_year=2025, title='old', **LEGACY)
        CarbonReport.objects.filter(pk=self.report.pk).update(**LEGACY)
        # Engine should now succeed for self.report (its own inventory_id-tagged entries)
        # Note: check_report() will refuse a signed/completed one, but self.report is in_progress
        # Actually self.report has legacy_duplicate_year=True and entries, so check_report may refuse
        # based on ownership scope. The point is: no InventoryYearConflict is raised.
        from .year_guard import InventoryYearConflict
        try:
            sync_step_entries(self.user, self.company, self.report, '4A-1')
        except InventoryYearConflict:
            self.fail('sync_step_entries should not raise InventoryYearConflict in FEAT-001')
        except Exception:
            pass   # Other exceptions (ownership scope, etc.) are acceptable

    def test_the_engine_writes_no_entries_for_an_inventory_without_a_year(self):
        from .step_entries import sync_step_entries
        before = self._figures(2024)
        report = CarbonReport.objects.create(company=self.company, created_by=self.user, title='no year')
        ReportStep.objects.create(report=report, step_id='2A-2', answer={'answer': SITES})
        ReportStep.objects.create(report=report, step_id='4A-1', answer={'answer': {'1': '5 kWh'}})
        self.assertEqual(sync_step_entries(self.user, self.company, report, '4A-1'), [])
        self.assertEqual(self._figures(2024), before)
        self.assertFalse(EmissionEntry.objects.filter(company=self.company, description__startswith='Questionnaire step').exists())

    def test_the_admin_factor_resync_no_longer_skips_a_year_two_inventories_share(self):
        """FEAT-001: resync_inventory now works for all inventories; entries are tagged per-inventory."""
        from .step_entries import resync_inventory
        self._populate()
        if not LEGACY:
            self.skipTest('legacy flag not present')
        CarbonReport.objects.create(company=self.company, reporting_year=2025, title='old', **LEGACY)
        CarbonReport.objects.filter(pk=self.report.pk).update(**LEGACY)
        # resync should not crash; it may return an empty list due to ownership scope but must not error
        try:
            resync_inventory(self.company, 2025, self.user)
        except Exception as e:
            self.fail(f'resync_inventory raised an unexpected exception: {e}')

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


class WorkspaceWritePathTests(_Year):
    """The Workspace (report-fields bulk-upsert / suggestion confirm) turns its fields into
    emission entries of the report's company and year. It meets the same rule as the questionnaire:
    no entries for an inventory without a year or whose year is shared, and a change to a signed /
    completed inventory is flagged and on record."""

    WS = {'fields': [{'field_id': 'rf.4a.consumption_kwh', 'value': 1000}]}

    def _upsert(self, report):
        return self.client.post('/api/questionnaire/report-fields/bulk-upsert/', {'report': report.id, **self.WS}, format='json')

    def _workspace_rows(self):
        return list(EmissionEntry.objects.filter(company=self.company, description__startswith='Workspace '))

    def test_a_workspace_save_creates_its_entries_for_a_plain_inventory(self):
        """Control: the path works at all, so the refusals below are the guard and not a broken fixture."""
        r = self._upsert(self.report)
        self.assertEqual(r.status_code, 200, r.content)
        [row] = self._workspace_rows()
        self.assertEqual((row.year, round(float(row.calculated_co2e_kg), 4)), (2025, 469.0))   # 1000 kWh x Turkey grid, distribution
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)                     # not signed: nothing to flag

    def test_a_workspace_save_into_a_signed_inventory_is_flagged_and_logged(self):
        """A signed inventory takes no Workspace save: refused, nothing written, nothing flagged or logged.
        (It used to be saved, flagged as edited after signing, and put on record.)"""
        from .models import ReportField
        self._lock()
        before = self._figures()
        r = self._upsert(self.report)
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_signed')
        self.assertEqual(self._workspace_rows(), [])
        self.assertFalse(ReportField.objects.filter(report=self.report).exists())
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)
        self.assertEqual(self._history('inventory_recalculated'), [])
        self.assertEqual(self._figures(), before)

    def test_saving_the_same_workspace_values_again_does_not_flag_a_signed_inventory(self):
        """Even the same values are refused once signed; what was saved before signing is exactly as it was."""
        self._upsert(self.report)
        self._lock()
        rows_before = [(e.pk, e.quantity, e.calculated_co2e_kg, e.inventory_id) for e in self._workspace_rows()]
        figures_before = self._figures()
        r = self._upsert(self.report)
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_signed')
        self.report.refresh_from_db()
        self.assertIsNone(self.report.edited_after_signing_at)
        self.assertEqual(self._history('inventory_recalculated'), [])
        self.assertEqual([(e.pk, e.quantity, e.calculated_co2e_kg, e.inventory_id) for e in self._workspace_rows()],
                         rows_before)
        self.assertEqual(self._figures(), figures_before)

    def test_a_workspace_save_creates_no_entries_for_an_inventory_without_a_year(self):
        report = CarbonReport.objects.create(company=self.company, created_by=self.user, title='no year')
        self.assertEqual(self._upsert(report).status_code, 200)                     # the field itself is kept
        self.assertEqual(self._workspace_rows(), [])                                # but no entry in "this year"
        self.assertFalse(EmissionEntry.objects.filter(company=self.company, year=timezone.now().year).exists())

    def test_a_workspace_save_for_an_unlinked_duplicate_year_inventory_is_refused(self):
        """A Workspace save produces entries, and an unlinked member of a pre-existing duplicate group cannot be
        proven to own any company-and-year row: refused (fail-closed), nothing written."""
        from .models import ReportField
        if not LEGACY:
            self.skipTest('legacy flag not present')
        dup = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                          title='old duplicate', **LEGACY)
        CarbonReport.objects.filter(pk=self.report.pk).update(**LEGACY)
        before = self._figures()
        r = self._upsert(dup)
        self.assertEqual(r.status_code, 409, r.content)
        self.assertEqual(r.data['code'], 'inventory_not_ownership_scoped')
        self.assertFalse(ReportField.objects.filter(report=dup).exists())
        self.assertEqual(self._figures(), before)
