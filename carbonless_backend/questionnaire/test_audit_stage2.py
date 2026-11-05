"""Second-stage audit of the multi-inventory isolation.

* An admin-approved electricity factor (Özel Talep) is a SHARED reference factor of a facility and a reporting
  year, not an inventory-specific input: every inventory of that year uses it with its OWN kWh, the approval
  is never duplicated or moved, and the factor of another year is unaffected.
* `review_duplicate_inventories --evidence` is read-only: it reports what each legacy member owns and which
  members could own the shared rows, and changes nothing.
"""
import json
import os
import tempfile
from decimal import Decimal
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework.test import APIClient

from companies.models import Company, CompanyMembership, Facility
from emissions.models import CustomEmissionRequest, EmissionEntry, EmissionFactor
from questionnaire import tests as _base
from questionnaire.models import CarbonReport, ReportStep
from questionnaire.test_calc_baseline import make_factors


def _company(name='Audit Co', tax='31'):
    return Company.objects.create(
        legal_entity_name=name, tax_number=tax, country_of_headquarters='TR', countries_of_operation='TR',
        nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
        number_of_facilities=1)


class SharedApprovedElectricityFactorTests(_base.TestCase):
    """The approved factor belongs to (facility, year, method); inventories only supply the kWh."""

    def setUp(self):
        self.user = User.objects.create_user('el', 'el@test.com', 'pass12345')
        self.company = _company()
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.facility = Facility.objects.create(company=self.company, name='Gebze', country='TR',
                                                grid_connection='distribution')
        make_factors()
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.request = CustomEmissionRequest.objects.create(
            user=self.user, company=self.company, scope='scope2', category_name='electricity', source_name='Gebze',
            description='', unit='kWh', quantity=Decimal(1), year=2025, month=1, facility=self.facility,
            status='approved', electricity_method='location_based', approved_factor_kg_co2e=Decimal('0.5'))

    def _inventory(self, year, title, kwh):
        r = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=year, title=title)
        for step, answer in (('2A-2', {'1': {'name': 'Gebze', 'country': 'TR', 'grid_connection': 'distribution'}}),
                             ('4A-1', {'1': f'{kwh} kWh'})):
            resp = self.client.patch(f'/api/questionnaire/{r.id}/step/', {'step': step, 'data': {'answer': answer}},
                                     format='json')
            self.assertEqual(resp.status_code, 200, resp.content)
        return r

    def _scope2_kg(self, inv):
        resp = self.client.get(f'/api/emissions/summary/?inventory_id={inv.id}')
        self.assertEqual(resp.status_code, 200, resp.content)
        return float(resp.data['scope2_kg']), float(resp.data['total_kg'])

    def test_every_inventory_of_the_year_applies_the_one_approved_factor_to_its_own_kwh(self):
        a, b, c = (self._inventory(2025, t, kwh) for t, kwh in (('A', 10000), ('B', 20000), ('C', 30000)))
        for inv, kwh in ((a, 10000), (b, 20000), (c, 30000)):
            scope2, total = self._scope2_kg(inv)
            self.assertAlmostEqual(scope2, kwh * 0.5, places=3)       # the approved 0.5, not the registered 0.4199
            self.assertAlmostEqual(total, kwh * 0.5, places=3)        # and the request is not added on top
        # nothing was duplicated, moved or changed by the three inventories
        self.assertEqual(CustomEmissionRequest.objects.count(), 1)
        self.request.refresh_from_db()
        self.assertEqual((self.request.status, self.request.approved_factor_kg_co2e, self.request.inventory_id),
                         ('approved', Decimal('0.500000'), None))

    def test_the_approval_is_for_its_year_only(self):
        self._inventory(2025, 'A', 10000)
        other_year = self._inventory(2024, 'old', 10000)
        scope2, _ = self._scope2_kg(other_year)
        self.assertAlmostEqual(scope2, 10000 * 0.4199, places=3)     # no 2024 approval: the registered factor


class EvidenceCommandTests(_base.TestCase):
    """The manual-review aid reports and never writes."""

    def setUp(self):
        self.user = User.objects.create_user('ev', 'ev@test.com', 'pass12345')
        self.company = _company('Evidence Co', '32')
        self.gas = EmissionFactor.objects.create(slug='ev-gas', name='Gas', scope='scope1', category='x', unit='m3',
                                                 factor_kg_co2e=1, source='generic')
        mk = lambda title, **kw: CarbonReport.objects.create(
            company=self.company, created_by=self.user, reporting_year=2022, title=title,
            legacy_duplicate_year=True, ownership_linked=False, **kw)
        self.m1, self.m2 = mk('first'), mk('second')
        ReportStep.objects.create(report=self.m1, step_id='3A-5', answer={'answer': {}})
        ReportStep.objects.create(report=self.m2, step_id='3A-5', answer={'answer': {}})
        ReportStep.objects.create(report=self.m2, step_id='4A-1', answer={'answer': {}})
        for desc in ('Questionnaire step 3A-5 · gas', 'Questionnaire step 4A-1', 'monthly form entry'):
            EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.gas, year=2022,
                                         month=1, quantity=100, status='approved', description=desc)

    def _snapshot(self):
        return (sorted(EmissionEntry.objects.values_list('pk', 'inventory_id', 'quantity', 'calculated_co2e_kg', 'status')),
                sorted(CarbonReport.objects.values_list('pk', 'legacy_duplicate_year', 'ownership_linked', 'status')),
                CustomEmissionRequest.objects.count())

    def test_reports_candidates_without_assigning_anything(self):
        before = self._snapshot()
        path = os.path.join(tempfile.mkdtemp(), 'evidence.json')
        out = StringIO()
        call_command('review_duplicate_inventories', '--evidence', '--json', path, stdout=out)
        self.assertEqual(self._snapshot(), before)                    # read-only, to the last column
        data = json.load(open(path, encoding='utf-8'))
        self.assertEqual(len(data), 1)
        group = data[0]
        self.assertTrue(group['records_at_stake'])
        verdicts = {r['step']: (r['candidates'], r['verdict']) for r in group['shared_rows']}
        self.assertEqual(verdicts['3A-5'][0], [self.m1.pk, self.m2.pk])        # both answered it: ambiguous
        self.assertIn('ambiguous', verdicts['3A-5'][1])
        self.assertEqual(verdicts['4A-1'][0], [self.m2.pk])                    # one answered it: a candidate only
        self.assertIn('candidate only', verdicts['4A-1'][1])
        self.assertIn('chat/form', verdicts[None][1])                          # not a questionnaire row
        self.assertIn('needs:', out.getvalue())

    def test_a_group_with_no_records_is_reported_as_nothing_at_stake(self):
        EmissionEntry.objects.all().delete()
        out = StringIO()
        call_command('review_duplicate_inventories', '--evidence', stdout=out)
        self.assertIn('nothing a decision could change', out.getvalue())
        self.assertEqual(CarbonReport.objects.filter(legacy_duplicate_year=True).count(), 2)   # flags untouched


class StaleInventoryAndTargetsAndUnassignedTests(_base.TestCase):
    """Final polish: a deleted inventory is refused clearly (never answered from another), the ISO report lists the
    company's real targets, and records that belong to no inventory are visible but never in an inventory's totals."""

    def setUp(self):
        self.user = User.objects.create_user('pol', 'pol@test.com', 'pass12345')
        self.company = _company('Polish Co', '33')
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        from accounts.models import UserProfile
        UserProfile.objects.create(user=self.user, active_company=self.company)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.gas = EmissionFactor.objects.create(slug='pol-gas', name='Gas', scope='scope1', category='x', unit='m3',
                                                 factor_kg_co2e=1, source='generic')
        self.a = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025, title='A')
        self.b = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025, title='B')

    def _entry(self, qty, inv=None, desc='x'):
        return EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.gas, year=2025,
                                            month=2, quantity=qty, status='approved', inventory=inv, description=desc)

    def test_a_deleted_inventory_is_refused_with_a_code_and_nothing_is_answered_or_saved(self):
        from unittest import mock
        from chat.models import ChatMessage, ChatSession
        s = ChatSession.objects.create(user=self.user, company=self.company)
        gone = self.b.pk
        self.b.delete()
        with mock.patch('chat.views._get_groq_client', return_value=None):
            r = self.client.post(f'/api/chat/sessions/{s.id}/message/',
                                 {'content': '2025 toplam emisyonumuz ne kadar?', 'language': 'tr', 'inventory_id': gone},
                                 format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data['code'], 'inventory_not_found')
        self.assertIn('message_tr', r.data)
        self.assertEqual(ChatMessage.objects.filter(session=s).count(), 0)     # not even the question was kept
        s.refresh_from_db()
        self.assertIsNone(s.inventory_id)                                      # and the session was not re-pointed

    def test_iso_report_lists_the_companys_real_targets(self):
        import io
        import re
        from pypdf import PdfReader
        from emissions.models import ReductionTarget
        other = _company('Other Co', '34')
        ReductionTarget.objects.create(company=self.company, user=None, title='Cut scope 1', base_year=2022, target_year=2030,
                                       base_emissions_kg=Decimal('1000'), target_reduction_percent=Decimal('30.00'))
        ReductionTarget.objects.create(company=other, title='Foreign target', base_year=2020, target_year=2035,
                                       base_emissions_kg=Decimal('1'), target_reduction_percent=Decimal('55.00'))
        before = list(ReductionTarget.objects.order_by('pk').values_list('pk', 'base_emissions_kg', 'target_reduction_percent'))
        res = self.client.get(f'/api/questionnaire/{self.a.id}/iso-report/?lang=en')
        self.assertEqual(res.status_code, 200)
        text = re.sub(r'\s+', ' ', '\n'.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(res.content)).pages))
        self.assertIn('Cut scope 1', text)
        self.assertIn('2022', text)
        self.assertIn('2030', text)
        self.assertIn('30 %', text)
        self.assertNotIn('Foreign target', text)                               # another company's, never listed
        self.assertEqual(list(ReductionTarget.objects.order_by('pk').values_list(
            'pk', 'base_emissions_kg', 'target_reduction_percent')), before)   # snapshots untouched

    def test_unassigned_records_are_visible_but_never_in_an_inventory_total(self):
        self._entry(1000, self.a, 'assigned to A')
        self._entry(5000, self.b, 'assigned to B')
        un = self._entry(700, None, 'chat entry')
        s = self.client.get(f'/api/emissions/summary/?inventory_id={self.a.id}').data
        self.assertEqual(s['total_kg'], 1000.0)                                # the unassigned 700 is not in it
        self.assertEqual(s['unassigned_records'], {'entries': 1, 'total_kg': 700.0})
        lst = self.client.get(f'/api/emissions/entries/?inventory_id={self.a.id}&year=2025').data
        rows = lst if isinstance(lst, list) else lst['results']
        self.assertEqual([r['description'] for r in rows], ['assigned to A'])
        self.assertEqual(rows[0]['inventory_id'], self.a.pk)
        un_rows = self.client.get('/api/emissions/entries/?unassigned=1&year=2025').data
        un_rows = un_rows if isinstance(un_rows, list) else un_rows['results']
        self.assertEqual([(r['id'], r['inventory_id']) for r in un_rows], [(un.pk, None)])
        un.refresh_from_db()
        self.assertIsNone(un.inventory_id)                                     # never assigned automatically

    def test_a_sole_inventorys_list_and_summary_agree_about_its_unassigned_rows(self):
        CarbonReport.objects.filter(pk=self.b.pk).delete()
        self._entry(1000, self.a, 'own')
        self._entry(300, None, 'legacy company row')
        s = self.client.get(f'/api/emissions/summary/?inventory_id={self.a.id}').data
        lst = self.client.get(f'/api/emissions/entries/?inventory_id={self.a.id}&year=2025').data
        rows = lst if isinstance(lst, list) else lst['results']
        self.assertEqual(s['total_kg'], 1300.0)
        self.assertAlmostEqual(sum(float(r['calculated_co2e_kg']) for r in rows), s['total_kg'], places=3)
