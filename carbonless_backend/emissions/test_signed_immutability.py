"""Stage 1: a SIGNED inventory takes no change through the emission-entry endpoints, whoever asks, and the
database stays byte-identical.

For every role (owner, admin, manager, data-entry, superuser) every way of writing an entry of a signed
inventory - edit, delete, delete-request, cancel-delete, approve, reject - answers 409 `inventory_signed`; a
record that names no inventory is refused in a signed year (manual, bulk, chat); and the model-level backstop
refuses `.save()`/create of signed data. The Django admin shows signed entries read-only and refuses to delete
them. After each attempt a full dump of the affected tables equals the dump taken before it.

NOT covered, because the guards cannot cover it (see the Stage 1 report): `QuerySet.update/delete`, `bulk_*`,
raw SQL, the shell, unguarded management commands and database cascades.
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import UserProfile
from companies.models import Company, CompanyMembership
from emissions.models import EmissionEntry, EmissionFactor
from questionnaire.immutability import InventoryGuardError
from questionnaire.models import CarbonReport, ReportField, ReportStep

CUTOVER = '2000-01-01T00:00:00+00:00'


def dump():
    return {m.__name__: list(m.objects.order_by('pk').values())
            for m in (EmissionEntry, CarbonReport, ReportStep, ReportField)}


@override_settings(INVENTORY_OWNERSHIP_CUTOVER=CUTOVER)
class SignedEntryTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()                       # rate-limit counters live in the shared cache and test users reuse the
        self.addCleanup(cache.clear)        # same ids: start clean, and leave nothing behind for the next test
        self.company = Company.objects.create(
            legal_entity_name='Sig Co', tax_number='3333333333', country_of_headquarters='TR',
            countries_of_operation='TR', nace_code='', main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1)
        self.users = {}
        for name, role, superuser in (('owner', 'owner', False), ('admin', 'admin', False),
                                      ('manager', 'manager', False), ('entry', 'data_entry', False),
                                      ('root', 'owner', True)):
            u = (User.objects.create_superuser if superuser else User.objects.create_user)(
                name, f'{name}@test.com', 'pass12345')
            UserProfile.objects.create(user=u, active_company=self.company)
            CompanyMembership.objects.create(user=u, company=self.company, role=role)
            self.users[name] = u
        self.factor = EmissionFactor.objects.create(
            slug='sig-test', name='Sig Test', name_tr='Imza', scope='scope2', category='electricity',
            country='turkey', unit='kwh', factor_kg_co2e=Decimal('0.4'), year=2023, source='atom_kablo',
            is_active=True, is_default=True)
        self.report = CarbonReport.objects.create(
            company=self.company, created_by=self.users['owner'], reporting_year=2025)
        self.by_owner = self._entry('owner', month=1)
        self.by_entry = self._entry('entry', month=2)
        self.waiting = self._entry('entry', month=3, status='submitted')
        CarbonReport.objects.filter(pk=self.report.pk).update(signed_at=timezone.now())     # now signed
        self.client = APIClient()

    def _entry(self, who, month, status='approved'):
        return EmissionEntry.objects.create(
            user=self.users[who], company=self.company, inventory=self.report, emission_factor=self.factor,
            year=2025, month=month, quantity=Decimal('100'), description=f'manual {month}', status=status)

    def _as(self, name):
        self.client.force_authenticate(user=self.users[name])

    def _refused(self, res):
        self.assertEqual(res.status_code, 409, res.content)
        self.assertEqual(res.json().get('code'), 'inventory_signed', res.content)
        self.assertTrue(res.json().get('message_en') and res.json().get('message_tr'))

    def test_every_role_is_refused_every_write_and_nothing_changes(self):
        for who in ('owner', 'admin', 'manager', 'root'):
            before = dump()
            self._as(who)
            pk = self.by_owner.pk
            self._refused(self.client.patch(f'/api/emissions/entries/{pk}/', {'quantity': 999}, format='json'))
            self._refused(self.client.delete(f'/api/emissions/entries/{pk}/'))
            self._refused(self.client.post(f'/api/emissions/entries/{pk}/cancel-delete/'))
            for action in ('approve', 'reject'):
                self._refused(self.client.post(f'/api/emissions/entries/{self.waiting.pk}/approve/',
                                               {'action': action}, format='json'))
            self.assertEqual(dump(), before, who)
        before = dump()
        self._as('entry')                                  # a data-entry member, on an entry of their own
        pk = self.by_entry.pk
        self._refused(self.client.patch(f'/api/emissions/entries/{pk}/', {'quantity': 999}, format='json'))
        self._refused(self.client.delete(f'/api/emissions/entries/{pk}/'))
        self.assertEqual(dump(), before)
        self.assertFalse(EmissionEntry.objects.filter(replaces_entry__isnull=False).exists())   # no replacement copy

    def test_new_records_that_name_no_inventory_are_refused_in_a_signed_year(self):
        before = dump()
        for who in ('owner', 'entry', 'root'):
            self._as(who)
            body = {'emission_factor': self.factor.pk, 'year': 2025, 'month': 6, 'quantity': 5,
                    'confirm_duplicate': True}
            self._refused(self.client.post('/api/emissions/entries/', body, format='json'))
            self._refused(self.client.post(
                '/api/emissions/bulk-import/',
                [{'factor_id': self.factor.pk, 'year': 2025, 'month': 6, 'quantity': 5}], format='json'))
            self._refused(self.client.post('/api/chat/confirm-entry/', {
                'fuel_type': 'electricity', 'quantity': 5, 'unit': 'kwh', 'year': 2025, 'month': 6,
                'language': 'en', 'confirm_duplicate': True, 'confirm_same_period': True}, format='json'))
            # naming the signed inventory is refused too (it is locked)
            res = self.client.post('/api/emissions/entries/', {**body, 'inventory_id': self.report.pk}, format='json')
            self.assertEqual(res.status_code, 400, res.content)
            self.assertEqual(res.json().get('code'), 'inventory_locked')
        self.assertEqual(dump(), before)

    def test_the_model_backstop_refuses_save_and_create_of_signed_data(self):
        before = dump()
        with self.assertRaises(InventoryGuardError):
            self._entry('owner', month=7)                                           # tagged to the signed inventory
        with self.assertRaises(InventoryGuardError):
            EmissionEntry.objects.create(                                           # unnamed, in the signed year
                user=self.users['owner'], company=self.company, emission_factor=self.factor, year=2025, month=8,
                quantity=Decimal('1'), description='x', status='approved')
        entry = EmissionEntry.objects.get(pk=self.by_owner.pk)
        entry.quantity = Decimal('1')
        with self.assertRaises(InventoryGuardError):
            entry.save()
        with self.assertRaises(InventoryGuardError):
            ReportStep.objects.create(report=self.report, step_id='3A-5', answer={'answer': {}})
        with self.assertRaises(InventoryGuardError):
            ReportField.objects.create(report=self.report, field_id='rf.4a.consumption_kwh', value=1)
        report = CarbonReport.objects.get(pk=self.report.pk)
        report.title = 'renamed'
        with self.assertRaises(InventoryGuardError):
            report.save()
        self.assertEqual(dump(), before)

    def test_another_year_and_an_unsigned_inventory_are_not_affected(self):
        self._as('owner')
        body = {'emission_factor': self.factor.pk, 'year': 2023, 'month': 1, 'quantity': 5, 'confirm_duplicate': True}
        self.assertEqual(self.client.post('/api/emissions/entries/', body, format='json').status_code, 201)
        draft = CarbonReport.objects.create(company=self.company, created_by=self.users['owner'], reporting_year=2022)
        res = self.client.post('/api/emissions/entries/', {**body, 'year': 2022, 'inventory_id': draft.pk},
                               format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(EmissionEntry.objects.get(pk=res.json()['id']).inventory_id, draft.pk)

    def test_the_admin_shows_signed_entries_read_only_and_refuses_to_delete_them(self):
        before = dump()
        self.client.force_login(self.users['root'])
        base = f'/admin/emissions/emissionentry/{self.by_owner.pk}'
        self.assertEqual(self.client.post(f'{base}/change/', {'quantity': '999', 'month': 1, 'year': 2025,
                                                              'description': 'changed'}).status_code, 403)
        self.assertEqual(self.client.post(f'{base}/delete/', {'post': 'yes'}).status_code, 403)
        self.client.post('/admin/emissions/emissionentry/', {
            'action': 'delete_selected', '_selected_action': [self.by_owner.pk], 'post': 'yes'})
        self.assertEqual(dump(), before)


class AuditSavepointTests(TestCase):
    """`log_company_activity` writes its best-effort history row in its OWN savepoint: a failed insert is rolled
    back on its own, is logged and does not raise, and the caller's transaction stays usable (on PostgreSQL a
    failed statement would otherwise abort it). It still never catches the caller's own errors: the savepoint
    wraps only the audit insert."""

    def test_the_insert_runs_in_its_own_savepoint_inside_a_transaction(self):
        from django.db import connection, transaction
        from django.test.utils import CaptureQueriesContext
        from accounts.models import ActivityLog
        from emissions.audit import log_company_activity
        with transaction.atomic(), CaptureQueriesContext(connection) as ctx:
            log_company_activity(None, 1, 'savepoint_probe', 'tr', 'en')
        sql = [q['sql'] for q in ctx.captured_queries]
        self.assertTrue(sql[0].startswith('SAVEPOINT'), sql)                       # opened before the insert
        self.assertTrue(any(s.startswith('INSERT INTO "accounts_activitylog"') for s in sql), sql)
        self.assertTrue(any(s.startswith('RELEASE SAVEPOINT') for s in sql), sql)
        self.assertEqual(ActivityLog.objects.filter(action='savepoint_probe').count(), 1)

    def test_a_failed_insert_is_logged_not_raised_and_the_callers_transaction_carries_on(self):
        from django.db import IntegrityError, connection, transaction
        from django.test.utils import CaptureQueriesContext
        from unittest import mock
        from accounts.models import ActivityLog
        from emissions.audit import log_company_activity
        with transaction.atomic(), CaptureQueriesContext(connection) as ctx:
            User.objects.create_user('before_audit', 'before@test.com', 'pass12345')
            with mock.patch.object(ActivityLog.objects, 'create', side_effect=IntegrityError('boom')):
                with self.assertLogs('emissions.audit', level='ERROR') as logs:
                    result = log_company_activity(None, 1, 'will_fail', 'tr', 'en')
            self.assertIsNone(result)                                              # nothing raised
            self.assertFalse(connection.needs_rollback)                            # the transaction is intact
            User.objects.create_user('after_audit', 'after@test.com', 'pass12345')  # and the real work continues
        self.assertTrue(any('Could not write a company history row (will_fail)' in m for m in logs.output))
        self.assertTrue(any(q['sql'].startswith('ROLLBACK TO SAVEPOINT') for q in ctx.captured_queries))
        self.assertEqual(sorted(User.objects.filter(username__endswith='_audit').values_list('username', flat=True)),
                         ['after_audit', 'before_audit'])                          # both real writes committed
        self.assertFalse(ActivityLog.objects.filter(action='will_fail').exists())  # only the audit row is missing
