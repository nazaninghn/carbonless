"""The organisation's own emission factor for a source the list does not hold.

It says where the factor comes from. A published source is accepted when it is submitted and counts at once;
any other needs its document and waits for the advisor (admin panel). Neither stops the questionnaire; an
own factor still waiting holds the signature, because it is not counted yet."""
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from companies.models import Company, CompanyMembership
from questionnaire import tests as _base
from questionnaire.models import CarbonReport
from .models import CustomEmissionRequest

BASE = {'scope': 'scope1', 'category_name': 'Process', 'source_name': 'Compressed air', 'description': 'Plant air',
        'unit': 'm3', 'quantity': '1000', 'year': 2025, 'month': 12}


class OwnFactorTests(_base.TestCase):
    def setUp(self):
        self.user = User.objects.create_user('own', 'own@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Own Co', tax_number='7', country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _post(self, fmt='json', **extra):
        return self.client.post('/api/emissions/custom-requests/', {**BASE, 'inventory': self.report.pk, **extra}, format=fmt)

    def _doc(self, name='declaration.pdf', size=200):
        return SimpleUploadedFile(name, b'x' * size, content_type='application/pdf')

    def test_a_published_source_is_accepted_at_once_and_counts(self):
        r = self._post(proposed_factor_kg_co2e='0.12', factor_source_type='published',
                       factor_source='Ecoinvent 3.9, compressed air 7 bar, Table 4')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data['status'], r.data['auto_accepted']), ('approved', True))
        obj = CustomEmissionRequest.objects.get(pk=r.data['id'])
        self.assertEqual((obj.approved_factor_kg_co2e, obj.calculated_co2e_kg, obj.inventory_id),
                         (Decimal('0.120000'), Decimal('120.0000'), self.report.pk))     # 1,000 m3 x 0.12
        self.assertIn('Accepted when submitted', obj.admin_notes)

    def test_any_other_source_needs_its_document_and_waits_for_the_advisor(self):
        r = self._post(proposed_factor_kg_co2e='0.12', factor_source_type='supplier', factor_source='Supplier X declaration 2025')
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn('Upload the document', str(r.data['factor_document']))
        self.assertIn('danışman inceler', str(r.data['factor_document']))
        r = self._post('multipart', proposed_factor_kg_co2e='0.12', factor_source_type='supplier',
                       factor_source='Supplier X declaration 2025', factor_document=self._doc())
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data['status'], r.data['auto_accepted'], r.data['has_document']), ('pending', False, True))
        self.assertNotIn('factor_document', r.data)
        obj = CustomEmissionRequest.objects.get(pk=r.data['id'])
        self.assertIsNone(obj.calculated_co2e_kg)                                        # not counted until decided
        self.assertTrue(obj.factor_document.name.endswith('.pdf'))
        obj.factor_document.delete(save=False)

    def test_the_factor_must_say_where_it_comes_from_and_be_plausible(self):
        for extra, field, words in (
                ({'proposed_factor_kg_co2e': '0.12'}, 'factor_source_type', 'Choose where the factor comes from'),
                ({'proposed_factor_kg_co2e': '0.12', 'factor_source_type': 'published', 'factor_source': 'IPCC'}, 'factor_source', 'Write where the factor comes from'),
                ({'proposed_factor_kg_co2e': '0', 'factor_source_type': 'published', 'factor_source': 'IPCC 2006 Vol 2 Table 2.3'}, 'proposed_factor_kg_co2e', 'greater than zero'),
                ({'proposed_factor_kg_co2e': '5000000', 'factor_source_type': 'published', 'factor_source': 'IPCC 2006 Vol 2 Table 2.3'}, 'proposed_factor_kg_co2e', 'unrealistically large')):
            r = self._post(**extra)
            self.assertEqual(r.status_code, 400, extra)
            self.assertIn(words, str(r.data[field]))
        self.assertEqual(CustomEmissionRequest.objects.count(), 0)

    def test_the_document_is_bounded(self):
        common = dict(proposed_factor_kg_co2e='0.12', factor_source_type='own_calculation', factor_source='Own stack measurement 2025')
        r = self._post('multipart', **common, factor_document=self._doc('tool.exe'))
        self.assertIn('not accepted', str(r.data['factor_document']))
        r = self._post('multipart', **common, factor_document=self._doc(size=10 * 1024 * 1024 + 1))
        self.assertIn('under 10 MB', str(r.data['factor_document']))

    def test_a_request_without_a_factor_is_the_earlier_kind(self):
        r = self._post()
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual((r.data['status'], r.data['proposed_factor_kg_co2e'], r.data['auto_accepted']), ('pending', None, False))

    def test_another_companys_or_a_signed_inventory_is_refused(self):
        from django.utils import timezone
        other = Company.objects.create(
            legal_entity_name='Other', tax_number='8', country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1)
        foreign = CarbonReport.objects.create(company=other, created_by=self.user, reporting_year=2025)
        r = self.client.post('/api/emissions/custom-requests/', {**BASE, 'inventory': foreign.pk}, format='json')
        self.assertIn('Inventory not found', str(r.data['inventory']))
        CarbonReport.objects.filter(pk=self.report.pk).update(signed_at=timezone.now())
        self.assertIn('signed inventory', str(self._post().data['inventory']))

    def test_the_advisor_approves_with_the_proposed_factor_or_rejects_in_the_admin_panel(self):
        from django.contrib.admin.sites import site
        from django.contrib.messages.storage.fallback import FallbackStorage
        from django.test import RequestFactory
        r = self._post('multipart', proposed_factor_kg_co2e='0.12', factor_source_type='own_calculation',
                       factor_source='Own stack measurement 2025', factor_document=self._doc())
        obj = CustomEmissionRequest.objects.get(pk=r.data['id'])
        request = RequestFactory().post('/admin/')
        request.user = User.objects.create_superuser('advisor', 'advisor@test.com', 'pass12345')
        request.session = {}
        request._messages = FallbackStorage(request)
        model_admin = site._registry[CustomEmissionRequest]
        model_admin.approve_with_proposed_factor(request, CustomEmissionRequest.objects.filter(pk=obj.pk))
        obj.refresh_from_db()
        self.assertEqual((obj.status, obj.approved_factor_kg_co2e, obj.calculated_co2e_kg),
                         ('approved', Decimal('0.120000'), Decimal('120.0000')))
        model_admin.reject_selected(request, CustomEmissionRequest.objects.filter(pk=obj.pk))
        obj.refresh_from_db()
        self.assertEqual((obj.status, obj.calculated_co2e_kg), ('rejected', None))
        obj.factor_document.delete(save=False)

    def test_an_own_factor_waiting_for_the_advisor_holds_the_signature(self):
        from questionnaire.views import _data_quality_refusal
        self.assertIsNone(_data_quality_refusal(self.report, 'en'))
        self._post(proposed_factor_kg_co2e='0.12', factor_source_type='published', factor_source='Ecoinvent 3.9, Table 4')
        self.assertIsNone(_data_quality_refusal(self.report, 'en'))                      # accepted: nothing waits
        r = self._post('multipart', proposed_factor_kg_co2e='0.2', factor_source_type='supplier',
                       factor_source='Supplier X declaration 2025', factor_document=self._doc())
        refusal = _data_quality_refusal(self.report, 'en')
        self.assertEqual(refusal['code'], 'own_factor_pending')
        self.assertIn('waiting for the advisor (Compressed air)', refusal['error_en'])
        self.assertIn('danışman onayı bekliyor', refusal['error_tr'])
        obj = CustomEmissionRequest.objects.get(pk=r.data['id'])
        obj.status = 'rejected'
        obj.save()
        self.assertIsNone(_data_quality_refusal(self.report, 'en'))
        obj.factor_document.delete(save=False)

    def test_an_edit_never_moves_a_request_to_another_inventory(self):
        r = self._post('multipart', proposed_factor_kg_co2e='0.12', factor_source_type='supplier',
                       factor_source='Supplier X declaration 2025', factor_document=self._doc())
        other = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
        p = self.client.patch(f'/api/emissions/custom-requests/{r.data["id"]}/', {'inventory': other.pk, 'source_name': 'Plant air'}, format='json')
        self.assertEqual(p.status_code, 200, p.content)
        obj = CustomEmissionRequest.objects.get(pk=r.data['id'])
        self.assertEqual((obj.inventory_id, obj.source_name), (self.report.pk, 'Plant air'))
        obj.factor_document.delete(save=False)
