"""Multi-inventory, stages 1-2: the nullable inventory link and the read-only link dry run.

Stage 1 only adds a nullable `inventory` link (to CarbonReport) on emission entries,
custom factor requests, reduction targets and chat sessions; nothing reads or writes
it yet. Stage 2 is `manage.py link_inventory_records --dry-run`, a report of which
existing records could be linked safely. These tests pin that:

* the link is nullable, defaults to empty, and never touches a calculated value
  (regression guard: 10,000 m3 natural gas = 20,200 kg CO2e);
* deleting an inventory never deletes a record through the link;
* the dry run classifies every record (linkable / no inventory / ambiguous /
  no company / no year) and leaves the database exactly as it was;
* without --dry-run the command refuses, and a write inside the dry run is blocked.
"""
from decimal import Decimal
from io import StringIO
import json
from unittest import mock

from django.contrib.auth.models import User
from django.core.management import CommandError, call_command
from django.db import models, transaction
from django.conf import settings
from django.test import TestCase, override_settings

from chat.models import ChatSession
from companies.models import Company
from emissions.management.commands import link_inventory_records as cmd
from emissions.models import CustomEmissionRequest, EmissionEntry, EmissionFactor, ReductionTarget
from questionnaire.models import CarbonReport


def _company(name):
    return Company.objects.create(
        legal_entity_name=name, tax_number='1', country_of_headquarters='TR', countries_of_operation='TR',
        nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
        number_of_facilities=1)


class InventoryLinkSchemaTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('linkuser', 'l@test.com', 'pass12345')
        self.company = _company('Link Co')
        self.gas = EmissionFactor.objects.update_or_create(
            slug='test-natural-gas', country='global', year=2024,
            defaults=dict(name='natural gas', scope='scope1', category='x', unit='m3', factor_kg_co2e=Decimal('2.02'),
                          source='test', is_active=True, is_default=True))[0]

    def test_the_link_is_nullable_on_all_four_models_and_never_cascades(self):
        for model, related in ((EmissionEntry, 'emission_entries'), (CustomEmissionRequest, 'custom_emission_requests'),
                               (ReductionTarget, 'reduction_targets'), (ChatSession, 'chat_sessions')):
            f = model._meta.get_field('inventory')
            self.assertTrue(f.null and f.blank, model.__name__)
            self.assertIs(f.related_model, CarbonReport, model.__name__)
            self.assertIs(f.remote_field.on_delete, models.SET_NULL, model.__name__)
            self.assertEqual(f.remote_field.related_name, related, model.__name__)

    def test_a_new_entry_is_unassigned_and_its_calculation_is_unchanged(self):
        e = EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.gas,
                                         year=2024, month=1, quantity=Decimal('10000'))
        e.refresh_from_db()
        self.assertIsNone(e.inventory_id)
        self.assertEqual(e.calculated_co2e_kg, Decimal('20200.0000'))      # the 20.2 t regression guard
        self.assertEqual(e.factor_value_snapshot, Decimal('2.020000'))

    def test_deleting_an_inventory_keeps_its_linked_records_as_they_were(self):
        inv = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2024)
        e = EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.gas,
                                         year=2024, month=1, quantity=Decimal('10000'), inventory=inv)
        t = ReductionTarget.objects.create(company=self.company, title='t', base_year=2024, target_year=2030,
                                           base_emissions_kg=Decimal('1'), target_reduction_percent=Decimal('10'),
                                           inventory=inv)
        inv.delete()
        e.refresh_from_db(); t.refresh_from_db()
        self.assertIsNone(e.inventory_id); self.assertIsNone(t.inventory_id)
        self.assertEqual(e.calculated_co2e_kg, Decimal('20200.0000'))


class LinkInventoryRecordsDryRunTests(TestCase):
    """company A: one 2024 inventory, nothing for 2023, a legacy duplicate pair for 2022; company B: one 2024."""

    def setUp(self):
        self.user = User.objects.create_user('dryuser', 'd@test.com', 'pass12345')
        self.a, self.b = _company('A'), _company('B')
        self.f = EmissionFactor.objects.update_or_create(
            slug='test-diesel', country='global', year=2024,
            defaults=dict(name='diesel', scope='scope1', category='x', unit='l', factor_kg_co2e=Decimal('2.5'),
                          source='test', is_active=True, is_default=True))[0]
        mk = lambda c, y, **kw: CarbonReport.objects.create(company=c, created_by=self.user, reporting_year=y, **kw)
        self.inv_a24, self.inv_b24 = mk(self.a, 2024), mk(self.b, 2024)
        self.dup1 = mk(self.a, 2022, legacy_duplicate_year=True)
        self.dup2 = mk(self.a, 2022, legacy_duplicate_year=True)
        entry = lambda c, y: EmissionEntry.objects.create(user=self.user, company=c, emission_factor=self.f,
                                                          year=y, month=3, quantity=Decimal('100'))
        self.e_a24, self.e_b24 = entry(self.a, 2024), entry(self.b, 2024)
        self.e_a23 = entry(self.a, 2023)            # no inventory covers 2023
        self.e_a22 = entry(self.a, 2022)            # two (legacy) inventories cover 2022
        self.e_none = entry(None, 2024)             # no company
        self.req = CustomEmissionRequest.objects.create(
            user=self.user, company=self.b, scope='scope3', category_name='x', source_name='x', description='x',
            unit='kg', quantity=Decimal('1'), year=2024, month=1)
        self.target = ReductionTarget.objects.create(company=self.a, title='t', base_year=2024, target_year=2030,
                                                     base_emissions_kg=Decimal('1'), target_reduction_percent=Decimal('10'))
        self.chat = ChatSession.objects.create(user=self.user, company=self.a)

    def _state(self):
        rows = lambda m: sorted(m.objects.values_list(*[f.attname for f in m._meta.concrete_fields]))
        return {m.__name__: rows(m) for m in (EmissionEntry, CustomEmissionRequest, ReductionTarget, ChatSession,
                                              CarbonReport)}

    def _run(self):
        out = StringIO()
        call_command('link_inventory_records', '--dry-run', '--json', stdout=out)
        return json.loads(out.getvalue())

    def test_every_record_is_classified(self):
        r = self._run()
        linked = {(x['model'], x['id']): x['inventory_id'] for x in r['linked']}
        unlinked = {(x['model'], x['id']): x['reason'] for x in r['unlinked']}
        self.assertEqual(linked[('EmissionEntry', self.e_a24.id)], self.inv_a24.id)
        self.assertEqual(linked[('EmissionEntry', self.e_b24.id)], self.inv_b24.id)   # never the other company's 2024
        self.assertEqual(linked[('ReductionTarget', self.target.id)], self.inv_a24.id)
        self.assertEqual(unlinked[('EmissionEntry', self.e_a23.id)], 'no_inventory')
        self.assertEqual(unlinked[('EmissionEntry', self.e_a22.id)], 'ambiguous')
        self.assertEqual(unlinked[('EmissionEntry', self.e_none.id)], 'no_company')
        self.assertEqual(unlinked[('ChatSession', self.chat.id)], 'no_year')
        self.assertEqual(linked[('CustomEmissionRequest', self.req.id)], self.inv_b24.id)
        self.assertTrue(all(x['label'] == 'Not assigned to an inventory' for x in r['unlinked']))
        self.assertEqual(r['totals']['EmissionEntry'],
                         {'inspected': 5, 'linkable': 2, 'no_inventory': 1, 'ambiguous': 1, 'no_company': 1, 'no_year': 0})
        self.assertEqual(r['inventories']['legacy_duplicate_year'], 2)
        self.assertTrue(any('2022: 2 inventories' in f for f in r['findings']))

    def test_the_dry_run_changes_nothing(self):
        before = self._state()
        self._run()
        out = StringIO()
        call_command('link_inventory_records', '--dry-run', stdout=out)        # the text report too
        self.assertIn('DRY RUN', out.getvalue())
        self.assertEqual(self._state(), before)
        self.assertFalse(EmissionEntry.objects.exclude(inventory=None).exists())
        self.dup1.refresh_from_db()
        self.assertTrue(self.dup1.legacy_duplicate_year)                          # legacy inventories stay as they are

    def test_without_dry_run_it_refuses_and_changes_nothing(self):
        before = self._state()
        with self.assertRaises(CommandError):
            call_command('link_inventory_records', stdout=StringIO())
        self.assertEqual(self._state(), before)

    def test_a_write_inside_the_dry_run_is_blocked(self):
        def writes():
            EmissionEntry.objects.filter(pk=self.e_a24.pk).update(inventory=self.inv_a24)
        with mock.patch.object(cmd, 'build_report', side_effect=writes):
            with self.assertRaises(cmd.ReadOnlyViolation), transaction.atomic():
                call_command('link_inventory_records', '--dry-run', stdout=StringIO())
        self.e_a24.refresh_from_db()
        self.assertIsNone(self.e_a24.inventory_id)


class InventoryLinkIsNotClientWritableTests(TestCase):
    """Before stage 3 nothing may set the link by hand: not an API client (the target
    serializer is '__all__'), and not the staff admin's forms."""

    def setUp(self):
        from rest_framework.test import APIClient
        from companies.models import CompanyMembership
        self.owner = User.objects.create_user('targetowner', 't@test.com', 'pass12345')
        self.a, self.b = _company('A'), _company('B')
        CompanyMembership.objects.create(user=self.owner, company=self.a, role='owner')
        self.inv_a = CarbonReport.objects.create(company=self.a, created_by=self.owner, reporting_year=2024)
        self.inv_b = CarbonReport.objects.create(company=self.b, reporting_year=2024)   # another company's
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def _body(self, **extra):
        return {'title': 'Cut 30%', 'description': '', 'base_year': 2024, 'target_year': 2030,
                'base_emissions_kg': '1000.0000', 'target_reduction_percent': '30.00', 'status': 'on_track', **extra}

    def test_create_ignores_an_inventory_from_the_client(self):
        for inv in (self.inv_b, self.inv_a):                      # another company's, and even its own
            r = self.client.post('/api/emissions/targets/', self._body(inventory=inv.id), format='json')
            self.assertEqual(r.status_code, 201, r.content)
            self.assertIsNone(r.data['inventory'])
            t = ReductionTarget.objects.get(pk=r.data['id'])
            self.assertIsNone(t.inventory_id)
            # everything else is saved as before
            self.assertEqual((t.company_id, t.user_id, t.title, t.base_year, t.target_year, t.base_emissions_kg,
                              t.target_reduction_percent), (self.a.id, self.owner.id, 'Cut 30%', 2024, 2030,
                                                            Decimal('1000.0000'), Decimal('30.00')))

    def test_patch_and_put_cannot_set_or_change_it(self):
        t = ReductionTarget.objects.create(company=self.a, user=self.owner, title='t', base_year=2024, target_year=2030,
                                           base_emissions_kg=Decimal('1'), target_reduction_percent=Decimal('10'))
        r = self.client.patch(f'/api/emissions/targets/{t.id}/', {'inventory': self.inv_b.id, 'title': 'renamed'},
                              format='json')
        self.assertEqual(r.status_code, 200, r.content)
        t.refresh_from_db()
        self.assertEqual((t.inventory_id, t.title), (None, 'renamed'))     # the title still changes
        r = self.client.put(f'/api/emissions/targets/{t.id}/', self._body(inventory=self.inv_b.id), format='json')
        self.assertEqual(r.status_code, 200, r.content)
        t.refresh_from_db()
        self.assertIsNone(t.inventory_id)
        # a link set by the application is kept, not cleared, by a client's update
        ReductionTarget.objects.filter(pk=t.pk).update(inventory=self.inv_a)
        self.client.patch(f'/api/emissions/targets/{t.id}/', {'inventory': None, 'title': 'again'}, format='json')
        t.refresh_from_db()
        self.assertEqual((t.inventory_id, t.title), (self.inv_a.id, 'again'))

    # The admin pages need the static-files manifest, which only `collectstatic` (a deploy) writes;
    # plain static storage renders them in a test run.
    @override_settings(STORAGES={**settings.STORAGES, 'staticfiles': {
        'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'}})
    def test_the_admin_shows_the_link_read_only(self):
        from django.contrib import admin as dj_admin
        staff = User.objects.create_superuser('linkadmin', 'a@test.com', 'pass12345')
        f = EmissionFactor.objects.update_or_create(
            slug='test-admin-fuel', country='global', year=2024,
            defaults=dict(name='fuel', scope='scope1', category='x', unit='l', factor_kg_co2e=Decimal('2'),
                          source='test', is_active=True, is_default=True))[0]
        e = EmissionEntry.objects.create(user=staff, company=self.a, emission_factor=f, year=2024, month=1,
                                         quantity=Decimal('1'), inventory=self.inv_a)
        t = ReductionTarget.objects.create(company=self.a, title='t', base_year=2024, target_year=2030,
                                           base_emissions_kg=Decimal('1'), target_reduction_percent=Decimal('10'),
                                           inventory=self.inv_a)
        for model in (EmissionEntry, ReductionTarget):
            self.assertIn('inventory', dj_admin.site._registry[model].readonly_fields, model.__name__)
        self.assertNotIn('inventory', [f for _, o in dj_admin.site._registry[CustomEmissionRequest].fieldsets
                                       for f in o['fields']])
        self.client.force_login(staff)
        for url in (f'/admin/emissions/emissionentry/{e.id}/change/', f'/admin/emissions/reductiontarget/{t.id}/change/'):
            r = self.client.get(url)
            self.assertEqual(r.status_code, 200, url)
            self.assertNotContains(r, 'name="inventory"')                  # no editable input or drop-down
