"""Multi-inventory, stage 1 (API side): a NEW emission record is tagged only with an inventory the client
named explicitly (`inventory_id`) and the server accepted - and an entry that is not assigned to an inventory
is read-only through the entry endpoints.

Covers manual entries, bulk import and chat/confirm-entry:
* tagged when valid, the row created WITH its inventory link (no later UPDATE); NULL (company-level) when none
  is named; refused with a bilingual 400 when the id is malformed, unknown, another company's, of another year,
  or signed/completed;
* a record that names no inventory is refused while the company has a signed inventory for its year (a
  protective check: nothing is assigned);
* `inventory` itself is never mass-assignable;
* an entry with `inventory IS NULL` takes no change at all (edit, delete, approve, reject, delete-request,
  replacement), and nothing is expanded to other rows; a tagged entry of an open inventory still works;
* a chat entry whose link is not what the database holds is rolled back, never reported as saved;
* existing rows are never touched, and the calculation is unchanged.

Run with `--settings=carbonless_api.settings_test` (the classes also pin the cutover themselves).
"""
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import ActivityLog, UserProfile
from companies.models import Company, CompanyMembership
from emissions.inventory_link import InventorySelectionError, explicit_inventory_id, resolve_inventory
from emissions.models import EmissionEntry, EmissionFactor
from questionnaire.models import CarbonReport

CUTOVER = '2000-01-01T00:00:00+00:00'


def _company(name, tax):
    return Company.objects.create(
        legal_entity_name=name, tax_number=tax, country_of_headquarters='TR', countries_of_operation='TR',
        nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
        number_of_facilities=1)


def ensure_grid_factor(value=Decimal('0.4')):
    """The factor `electricity / kwh` resolves to for a Turkish company without a facility
    (`turkey-grid-distribution`), at a known value - so chat tests never depend on seed data."""
    rows = EmissionFactor.objects.filter(slug='turkey-grid-distribution', country='turkey')
    if rows.exists():
        rows.update(factor_kg_co2e=value, is_active=True, is_default=True)
    else:
        EmissionFactor.objects.create(
            slug='turkey-grid-distribution', name='Turkey grid (distribution)', name_tr='Türkiye şebekesi (dağıtım)',
            scope='scope2', category='electricity', country='turkey', unit='kwh', factor_kg_co2e=value, year=2024,
            source='atom_kablo', is_active=True, is_default=True)


def entry_dump():
    return list(EmissionEntry.objects.order_by('pk').values())


@override_settings(INVENTORY_OWNERSHIP_CUTOVER=CUTOVER)
class _Base(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()                       # rate-limit counters live in the shared cache and test users reuse the
        self.addCleanup(cache.clear)        # same ids: start clean, and leave nothing behind for the next test
        self.a, self.b = _company('A Co', '1111111111'), _company('B Co', '2222222222')
        self.users = {}
        for name, company, role in (('owner', self.a, 'owner'), ('entry', self.a, 'data_entry'),
                                    ('auditor', self.a, 'auditor'), ('bowner', self.b, 'owner')):
            u = User.objects.create_user(name, f'{name}@test.com', 'pass12345')
            UserProfile.objects.create(user=u, active_company=company)
            CompanyMembership.objects.create(user=u, company=company, role=role)
            self.users[name] = u
        self.inv_a = CarbonReport.objects.create(company=self.a, created_by=self.users['owner'], reporting_year=2025)
        self.inv_a_locked = CarbonReport.objects.create(
            company=self.a, created_by=self.users['owner'], reporting_year=2024,
            status=CarbonReport.Status.COMPLETED, signed_at=timezone.now())
        self.inv_b = CarbonReport.objects.create(company=self.b, created_by=self.users['bowner'], reporting_year=2025)
        self.factor = EmissionFactor.objects.create(
            slug='tag-test', name='Tag Test', name_tr='Etiket', scope='scope2', category='electricity',
            country='turkey', unit='kwh', factor_kg_co2e=Decimal('0.4'), year=2023, source='atom_kablo',
            is_active=True, is_default=True)
        self.client = APIClient()

    def _as(self, name):
        self.client.force_authenticate(user=self.users[name])

    def _entry_body(self, **extra):
        return {'emission_factor': self.factor.pk, 'year': 2025, 'month': 1, 'quantity': 500,
                'confirm_duplicate': True, **extra}

    def _post_entry(self, **extra):
        return self.client.post('/api/emissions/entries/', self._entry_body(**extra), format='json')

    def _assert_bilingual_400(self, res, code):
        self.assertEqual(res.status_code, 400, res.content)
        body = res.json()
        self.assertEqual(body.get('code'), code, body)
        self.assertTrue(body.get('message_en') and body.get('message_tr'), body)

    def _assert_bilingual_409(self, res, code):
        self.assertEqual(res.status_code, 409, res.content)
        body = res.json()
        self.assertEqual(body.get('code'), code, body)
        self.assertTrue(body.get('message_en') and body.get('message_tr'), body)


class HelperTests(_Base):
    def test_no_id_means_none(self):
        for raw in (None, '', '  '):
            self.assertIsNone(explicit_inventory_id({'inventory_id': raw}))
        self.assertIsNone(explicit_inventory_id({}))
        self.assertIsNone(explicit_inventory_id([1, 2]))                       # a bulk-import list body
        self.assertIsNone(resolve_inventory(self.a, None))

    def test_checks(self):
        self.assertEqual(resolve_inventory(self.a, self.inv_a.pk), self.inv_a)
        self.assertEqual(resolve_inventory(self.a, str(self.inv_a.pk), year=2025), self.inv_a)
        for raw, code in (('abc', 'inventory_invalid'), (True, 'inventory_invalid'), (1.5, 'inventory_invalid'),
                          (999999, 'inventory_not_found'), (self.inv_b.pk, 'inventory_not_found')):
            with self.assertRaises(InventorySelectionError) as cm:
                resolve_inventory(self.a, raw)
            self.assertEqual(cm.exception.code, code, raw)
        with self.assertRaises(InventorySelectionError) as cm:
            resolve_inventory(None, self.inv_a.pk)
        self.assertEqual(cm.exception.code, 'inventory_not_found')
        with self.assertRaises(InventorySelectionError) as cm:
            resolve_inventory(self.a, self.inv_a.pk, year=2024)
        self.assertEqual(cm.exception.code, 'inventory_year_mismatch')
        with self.assertRaises(InventorySelectionError) as cm:
            resolve_inventory(self.a, self.inv_a_locked.pk, year=2024, forbid_locked=True)
        self.assertEqual(cm.exception.code, 'inventory_locked')
        self.assertEqual(resolve_inventory(self.a, self.inv_a_locked.pk, year=2024), self.inv_a_locked)

    def test_another_companys_inventory_looks_exactly_like_a_missing_one(self):
        with self.assertRaises(InventorySelectionError) as foreign:
            resolve_inventory(self.a, self.inv_b.pk)
        with self.assertRaises(InventorySelectionError) as missing:
            resolve_inventory(self.a, 999999)
        self.assertEqual((foreign.exception.code, foreign.exception.en, foreign.exception.tr),
                         (missing.exception.code, missing.exception.en, missing.exception.tr))

    def test_an_absurdly_large_id_is_a_clean_not_found(self):
        with self.assertRaises(InventorySelectionError) as cm:
            resolve_inventory(self.a, 10 ** 30)
        self.assertEqual(cm.exception.code, 'inventory_not_found')


class ManualEntryTests(_Base):
    def test_named_inventory_is_tagged_and_the_calculation_is_unchanged(self):
        self._as('owner')
        res = self._post_entry(inventory_id=self.inv_a.pk)
        self.assertEqual(res.status_code, 201, res.content)
        e = EmissionEntry.objects.get(pk=res.json()['id'])
        self.assertEqual(e.inventory_id, self.inv_a.pk)
        self.assertEqual(e.calculated_co2e_kg, Decimal('200.0000'))            # 500 kWh x 0.4

    def test_no_inventory_named_stays_company_level(self):
        self._as('owner')
        res = self._post_entry()
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIsNone(EmissionEntry.objects.get(pk=res.json()['id']).inventory_id)

    def test_mass_assigning_the_model_field_is_ignored(self):
        self._as('owner')
        res = self._post_entry(inventory=self.inv_a.pk)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIsNone(EmissionEntry.objects.get(pk=res.json()['id']).inventory_id)

    def test_refusals(self):
        self._as('owner')
        for extra, code in (({'inventory_id': 'x'}, 'inventory_invalid'),
                            ({'inventory_id': 999999}, 'inventory_not_found'),
                            ({'inventory_id': self.inv_b.pk}, 'inventory_not_found'),           # another company's
                            ({'inventory_id': self.inv_a.pk, 'year': 2023}, 'inventory_year_mismatch'),
                            ({'inventory_id': self.inv_a_locked.pk, 'year': 2024}, 'inventory_locked')):
            self._assert_bilingual_400(self._post_entry(**extra), code)
        self.assertEqual(EmissionEntry.objects.count(), 0)

    def test_authorisation_is_unchanged(self):
        self._as('auditor')
        self.assertEqual(self._post_entry(inventory_id=self.inv_a.pk).status_code, 403)
        self._as('bowner')                                   # a member of another company cannot use A's inventory
        self._assert_bilingual_400(self._post_entry(inventory_id=self.inv_a.pk), 'inventory_not_found')
        self.assertEqual(EmissionEntry.objects.count(), 0)

    def test_data_entry_member_can_tag_an_inventory_of_their_own_company(self):
        self._as('entry')
        res = self._post_entry(inventory_id=self.inv_a.pk)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(EmissionEntry.objects.get(pk=res.json()['id']).inventory_id, self.inv_a.pk)

    def test_a_record_naming_no_inventory_is_refused_in_a_signed_year_and_assigns_nothing(self):
        CarbonReport.objects.filter(pk=self.inv_a.pk).update(signed_at=timezone.now())
        self._as('owner')
        self._assert_bilingual_409(self._post_entry(), 'inventory_signed')            # year 2025 is signed
        self.assertEqual(EmissionEntry.objects.count(), 0)
        self.assertEqual(self._post_entry(year=2023).status_code, 201)                # an unsigned year is fine
        self.assertIsNone(EmissionEntry.objects.get().inventory_id)                   # and nothing was assigned


class NullEntryFreezeTests(_Base):
    """An entry with inventory IS NULL takes no change at all: field edit, delete, approve, reject,
    delete-request and replacement. Nothing is expanded to other rows. Reading stays allowed."""

    def _null_entry(self, user, **extra):
        self._as(user)
        res = self._post_entry(**extra)
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()['id']

    def test_edit_delete_and_cancel_delete_are_refused_and_change_nothing(self):
        pk = self._null_entry('owner')
        other = self._null_entry('owner', month=2)
        before = entry_dump()
        self._as('owner')
        self._assert_bilingual_409(self.client.patch(f'/api/emissions/entries/{pk}/', {'quantity': 999}, format='json'),
                                   'entry_unassigned')
        self._assert_bilingual_409(self.client.delete(f'/api/emissions/entries/{pk}/'), 'entry_unassigned')
        self._assert_bilingual_409(self.client.post(f'/api/emissions/entries/{pk}/cancel-delete/'), 'entry_unassigned')
        self.assertEqual(entry_dump(), before)                      # this row and its neighbour: byte-identical
        self.assertEqual(self.client.get(f'/api/emissions/entries/{pk}/').status_code, 200)    # reading is allowed
        self.assertTrue(EmissionEntry.objects.filter(pk=other).exists())

    def test_approve_and_reject_are_refused_and_the_entry_stays_pending(self):
        pk = self._null_entry('entry')                                    # a data-entry member's entry waits
        self.assertEqual(EmissionEntry.objects.get(pk=pk).status, 'submitted')
        before = entry_dump()
        self._as('owner')
        for action in ('approve', 'reject'):
            self._assert_bilingual_409(
                self.client.post(f'/api/emissions/entries/{pk}/approve/', {'action': action}, format='json'),
                'entry_unassigned')
        self.assertEqual(entry_dump(), before)

    def test_the_data_entry_replacement_flow_is_refused_and_creates_no_copy(self):
        pk = self._null_entry('entry')
        EmissionEntry.objects.filter(pk=pk).update(status='approved')
        before = entry_dump()
        self._as('entry')
        self._assert_bilingual_409(self.client.patch(f'/api/emissions/entries/{pk}/', {'quantity': 700}, format='json'),
                                   'entry_unassigned')
        self.assertEqual(entry_dump(), before)
        self.assertFalse(EmissionEntry.objects.filter(replaces_entry_id=pk).exists())

    def test_unrelated_null_entries_never_block_a_tagged_entry(self):
        self._null_entry('owner')                                               # an unrelated NULL entry
        tagged = self._null_entry('owner', inventory_id=self.inv_a.pk, month=2)
        self._as('owner')
        res = self.client.patch(f'/api/emissions/entries/{tagged}/',
                                {'quantity': 600, 'inventory_id': self.inv_b.pk, 'inventory': None}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        e = EmissionEntry.objects.get(pk=tagged)
        self.assertEqual((e.quantity, e.inventory_id), (Decimal('600.0000'), self.inv_a.pk))   # link cannot move

    def test_a_tagged_entry_of_an_open_inventory_keeps_its_inventory_through_a_pending_change(self):
        pk = self._null_entry('entry', inventory_id=self.inv_a.pk)
        EmissionEntry.objects.filter(pk=pk).update(status='approved')
        self._as('entry')
        res = self.client.patch(f'/api/emissions/entries/{pk}/', {'quantity': 700}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        copy = EmissionEntry.objects.get(replaces_entry_id=pk)
        self.assertEqual(copy.inventory_id, self.inv_a.pk)         # an explicit copy of the entry's own link
        self.assertEqual(EmissionEntry.objects.get(pk=pk).quantity, Decimal('500.0000'))

    def test_a_tagged_entry_of_a_completed_inventory_takes_no_change(self):
        pk = self._null_entry('owner', inventory_id=self.inv_a.pk)
        CarbonReport.objects.filter(pk=self.inv_a.pk).update(status=CarbonReport.Status.COMPLETED)
        before = entry_dump()
        self._as('owner')
        self._assert_bilingual_409(self.client.patch(f'/api/emissions/entries/{pk}/', {'quantity': 1}, format='json'),
                                   'inventory_completed_locked')
        self.assertEqual(entry_dump(), before)


class BulkImportTests(_Base):
    def _post(self, query='', rows=None):
        rows = rows or [{'factor_id': self.factor.pk, 'year': 2025, 'month': 1, 'quantity': 10}]
        return self.client.post('/api/emissions/bulk-import/' + query, rows, format='json')

    def test_tagged_when_named_and_untagged_otherwise(self):
        self._as('owner')
        self.assertEqual(self._post(f'?inventory_id={self.inv_a.pk}').json()['created'], 1)
        self.assertEqual(self._post().json()['created'], 1)
        got = list(EmissionEntry.objects.order_by('id').values_list('inventory_id', flat=True))
        self.assertEqual(got, [self.inv_a.pk, None])

    def test_refusals_and_year_mismatch_rows(self):
        self._as('owner')
        self._assert_bilingual_400(self._post(f'?inventory_id={self.inv_b.pk}'), 'inventory_not_found')
        self._assert_bilingual_400(self._post('?inventory_id=zz'), 'inventory_invalid')
        self._assert_bilingual_400(self._post(f'?inventory_id={self.inv_a_locked.pk}'), 'inventory_locked')
        res = self._post(f'?inventory_id={self.inv_a.pk}',
                         [{'factor_id': self.factor.pk, 'year': 2023, 'month': 1, 'quantity': 10}]).json()
        self.assertEqual(res['created'], 0)
        self.assertEqual(len(res['errors']), 1)
        self.assertEqual(EmissionEntry.objects.count(), 0)

    def test_an_unnamed_import_touching_a_signed_year_is_refused_as_a_whole(self):
        self._as('owner')
        rows = [{'factor_id': self.factor.pk, 'year': 2025, 'month': 1, 'quantity': 10},
                {'factor_id': self.factor.pk, 'year': 2024, 'month': 1, 'quantity': 10}]     # 2024 is signed
        self._assert_bilingual_409(self._post('', rows), 'inventory_signed')
        self.assertEqual(EmissionEntry.objects.count(), 0)                                    # not even the 2025 row


class ChatConfirmTests(_Base):
    def setUp(self):
        super().setUp()
        ensure_grid_factor()

    def _card(self, **extra):
        return {'fuel_type': 'electricity', 'quantity': 500, 'unit': 'kwh', 'year': 2025, 'month': 1,
                'language': 'en', 'confirm_duplicate': True, 'confirm_same_period': True, **extra}

    def _post(self, **extra):
        return self.client.post('/api/chat/confirm-entry/', self._card(**extra), format='json')

    def test_named_inventory_is_tagged_and_the_number_is_the_same_as_without_it(self):
        self._as('owner')
        plain = self._post()
        self.assertEqual(plain.status_code, 201, plain.content)
        tagged = self._post(month=2, inventory_id=self.inv_a.pk)
        self.assertEqual(tagged.status_code, 201, tagged.content)
        p, t = EmissionEntry.objects.get(pk=plain.json()['id']), EmissionEntry.objects.get(pk=tagged.json()['id'])
        self.assertIsNone(p.inventory_id)
        self.assertEqual(t.inventory_id, self.inv_a.pk)                         # what the response claims is stored
        self.assertEqual((p.quantity, p.calculated_co2e_kg, p.factor_value_snapshot),
                         (t.quantity, t.calculated_co2e_kg, t.factor_value_snapshot))
        self.assertEqual(t.calculated_co2e_kg, Decimal('200.0000'))

    def test_refusals_create_nothing(self):
        self._as('owner')
        for extra, code in (({'inventory_id': 'x'}, 'inventory_invalid'),
                            ({'inventory_id': self.inv_b.pk}, 'inventory_not_found'),
                            ({'inventory_id': self.inv_a.pk, 'year': 2024}, 'inventory_year_mismatch'),
                            ({'inventory_id': self.inv_a_locked.pk, 'year': 2024}, 'inventory_locked')):
            self._assert_bilingual_400(self._post(**extra), code)
        self.assertEqual(EmissionEntry.objects.count(), 0)

    def test_the_model_field_is_ignored_in_a_card(self):
        self._as('owner')
        res = self._post(inventory=self.inv_a.pk)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIsNone(EmissionEntry.objects.get(pk=res.json()['id']).inventory_id)

    def test_a_card_naming_no_inventory_is_refused_in_a_signed_year(self):
        self._as('owner')
        self._assert_bilingual_409(self._post(year=2024), 'inventory_signed')       # 2024 has a signed inventory
        self.assertEqual(EmissionEntry.objects.count(), 0)

    def test_a_link_the_database_does_not_hold_rolls_everything_back(self):
        from emissions import factor_lookup
        real = factor_lookup.create_entry_from_activity

        def forget_the_link(*args, **kwargs):
            kwargs['inventory'] = None                     # the entry is created WITHOUT the requested link
            return real(*args, **kwargs)

        self._as('owner')
        with mock.patch('chat.views.create_entry_from_activity', side_effect=forget_the_link):
            res = self._post(inventory_id=self.inv_a.pk)
        self._assert_bilingual_409(res, 'inventory_link_failed')
        self.assertNotIn('id', res.json())                                      # no success body
        self.assertEqual(EmissionEntry.objects.count(), 0)                      # the entry is gone ...
        self.assertFalse(ActivityLog.objects.filter(action='entry_created').exists())   # ... and so is its history row
