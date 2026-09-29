from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .gas_split_data import fuel_gas_shares
from .models import EmissionFactor, EmissionEntry


class EmissionFactorTests(TestCase):
    def setUp(self):
        self.factor = EmissionFactor.objects.create(
            slug='test-gas', name='Test Gas', name_tr='Test Gaz',
            scope='scope1', category='stationary_combustion', country='global',
            unit='kg', factor_kg_co2e=2.5, year=2024, source='generic',
            is_active=True, is_default=True,
        )

    def test_factor_created(self):
        self.assertEqual(EmissionFactor.objects.count(), 1)
        self.assertEqual(self.factor.factor_kg_co2e, 2.5)

    def test_factor_str(self):
        self.assertIn('Test Gas', str(self.factor))


class GasSplitTests(TestCase):
    """The per-gas breakdown ISO 14064-1 reporting needs."""

    def _factor(self, **kw):
        defaults = dict(
            slug='split-test', name='Split Test', scope='scope1',
            category='stationary_combustion', country='global', unit='kg',
            factor_kg_co2e=Decimal('100'), year=2024, source='generic',
        )
        defaults.update(kw)
        return EmissionFactor(**defaults)

    def test_no_split_reads_as_none(self):
        """A factor with no breakdown must not look like an all-zero one."""
        f = self._factor()
        self.assertIsNone(f.gas_split())
        self.assertIsNone(f.gas_split_shares())

    def test_shares_sum_to_one(self):
        f = self._factor(
            factor_co2_kg_co2e=Decimal('97'), factor_ch4_kg_co2e=Decimal('1'),
            factor_n2o_kg_co2e=Decimal('2'), gas_split_basis='apportioned')
        shares = f.gas_split_shares()
        self.assertEqual(sorted(shares), ['CH4', 'CO2', 'N2O'])
        self.assertAlmostEqual(float(sum(shares.values())), 1.0, places=9)
        self.assertAlmostEqual(float(shares['CO2']), 0.97, places=9)

    def test_gases_with_no_contribution_are_omitted(self):
        f = self._factor(factor_sf6_kg_co2e=Decimal('100'),
                         gas_split_basis='single_gas')
        self.assertEqual(f.gas_split(), {'SF6': Decimal('100')})

    def test_split_must_add_up_to_the_factor(self):
        f = self._factor(factor_co2_kg_co2e=Decimal('50'),
                         gas_split_basis='apportioned')
        with self.assertRaises(ValidationError) as ctx:
            f.clean()
        self.assertIn('factor_kg_co2e', ctx.exception.message_dict)

    def test_rounding_drift_is_tolerated(self):
        f = self._factor(factor_co2_kg_co2e=Decimal('99.995'),
                         gas_split_basis='apportioned')
        f.clean()  # within tolerance — must not raise

    def test_split_requires_a_stated_basis(self):
        """A breakdown with no provenance cannot go in an assurance document."""
        f = self._factor(factor_co2_kg_co2e=Decimal('100'))
        with self.assertRaises(ValidationError) as ctx:
            f.clean()
        self.assertIn('gas_split_basis', ctx.exception.message_dict)

    def test_seeded_combustion_factor_keeps_its_total(self):
        """Apportioning must divide a factor, never change it."""
        shares = fuel_gas_shares('diesel_onroad')
        self.assertAlmostEqual(sum(shares.values()), 1.0, places=9)
        # CO2 dominates, but CH4 and N2O are both present and non-zero.
        self.assertGreater(shares['CO2'], 0.9)
        self.assertGreater(shares['CH4'], 0)
        self.assertGreater(shares['N2O'], 0)


class EmissionEntryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('testuser', 'test@test.com', 'testpass123')
        self.factor = EmissionFactor.objects.create(
            slug='test-elec', name='Test Electricity', name_tr='Test Elektrik',
            scope='scope2', category='electricity', country='turkey',
            unit='kwh', factor_kg_co2e=0.4199, year=2023, source='atom_kablo',
            is_active=True, is_default=True,
        )

    def test_entry_auto_calculate(self):
        entry = EmissionEntry.objects.create(
            user=self.user, emission_factor=self.factor,
            year=2026, month=1, quantity=1000,
        )
        self.assertAlmostEqual(float(entry.calculated_co2e_kg), 419.9, places=1)

    def test_entry_tonne(self):
        entry = EmissionEntry.objects.create(
            user=self.user, emission_factor=self.factor,
            year=2026, month=1, quantity=1000,
        )
        self.assertAlmostEqual(float(entry.calculated_co2e_tonne), 0.4199, places=3)


class CalculatorTests(TestCase):
    def setUp(self):
        self.factor = EmissionFactor.objects.create(
            slug='test-diesel', name='Test Diesel', name_tr='Test Dizel',
            scope='scope1', category='mobile_combustion', country='turkey',
            unit='liters', factor_kg_co2e=2.696, year=2023, source='atom_kablo',
            is_active=True, is_default=True,
        )

    def test_calculate_by_id(self):
        from .calculator import calculate_emissions
        result = calculate_emissions(self.factor.pk, 100)
        self.assertAlmostEqual(result['emissions_kg'], 269.6, places=1)
        self.assertEqual(result['scope'], 'scope1')

    def test_calculate_negative(self):
        from .calculator import calculate_emissions
        result = calculate_emissions(self.factor.pk, -10)
        self.assertIn('error', result)

    def test_get_factor_lookup(self):
        from .calculator import get_emission_factor
        f = get_emission_factor('test-diesel', 'turkey', 'mobile_combustion')
        self.assertIsNotNone(f)
        self.assertEqual(float(f.factor_kg_co2e), 2.696)

    def test_get_factor_not_found(self):
        from .calculator import get_emission_factor
        f = get_emission_factor('nonexistent', 'turkey', 'electricity')
        self.assertIsNone(f)


class APITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('apiuser', 'api@test.com', 'testpass123')
        from companies.models import Company, CompanyMembership
        self.company = Company.objects.create(
            legal_entity_name='Test Co', tax_number='123',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='Test', number_of_employees='1-10',
            annual_turnover_range='<1M', number_of_facilities=1,
        )
        CompanyMembership.objects.create(company=self.company, user=self.user, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.factor = EmissionFactor.objects.create(
            slug='api-test', name='API Test Factor', name_tr='API Test',
            scope='scope2', category='electricity', country='turkey',
            unit='kwh', factor_kg_co2e=0.4199, year=2023, source='atom_kablo',
            is_active=True, is_default=True,
        )

    def test_list_factors(self):
        res = self.client.get('/api/emissions/factors/')
        self.assertEqual(res.status_code, 200)

    def test_create_entry(self):
        res = self.client.post('/api/emissions/entries/', {
            'emission_factor': self.factor.pk,
            'year': 2026, 'month': 1, 'quantity': 500,
        })
        self.assertEqual(res.status_code, 201)

    def test_summary(self):
        EmissionEntry.objects.create(
            user=self.user, company=self.company, emission_factor=self.factor,
            year=2026, month=1, quantity=1000, status='approved',
        )
        res = self.client.get('/api/emissions/summary/?year=2026')
        self.assertEqual(res.status_code, 200)
        self.assertGreater(res.data['total_kg'], 0)

    def test_calculate_endpoint(self):
        res = self.client.post('/api/emissions/calculate/', {
            'factor_id': self.factor.pk, 'activity_data': 1000,
        })
        self.assertEqual(res.status_code, 200)
        self.assertAlmostEqual(res.data['emissions_kg'], 419.9, places=1)


class ProofAndAccountDeletionTests(TestCase):
    """Proof uploads are stored, and company data outlives the member who entered it."""

    def setUp(self):
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        self.factor = EmissionFactor.objects.create(
            slug='test-gas-proof', name='Test Gas', name_tr='Test Gaz',
            scope='scope1', category='stationary_combustion', country='global',
            unit='kg', factor_kg_co2e=2.5, year=2024, source='generic',
            is_active=True, is_default=True,
        )
        self.company = Company.objects.create(
            legal_entity_name='Kaya Tekstil A.Ş.', tax_number='1234567890',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        self.users = {}
        for name, role in [('aylin', 'owner'), ('ali', 'data_entry')]:
            u = User.objects.create_user(name, f'{name}@test.com', 'testpass123')
            UserProfile.objects.create(user=u, active_company=self.company)
            CompanyMembership.objects.create(company=self.company, user=u, role=role)
            self.users[name] = u
        self.client = APIClient()

    def _as(self, name):
        self.client.force_authenticate(user=self.users[name])

    def _entry(self, **extra):
        return self.client.post('/api/emissions/entries/', {
            'emission_factor': self.factor.id, 'year': 2026, 'month': 3, 'quantity': 10, **extra,
        }, format='multipart')

    def _file(self, name, size=100):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return SimpleUploadedFile(name, b'%PDF' + b'0' * size, content_type='application/pdf')

    def test_proof_document_is_saved_and_downloadable(self):
        import shutil, tempfile
        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, True)
        with self.settings(MEDIA_ROOT=media):
            self._as('aylin')
            res = self._entry(proof_document=self._file('fatura.pdf'))
            self.assertEqual(res.status_code, 201, res.data)
            self.assertTrue(res.data['proof_document'])
            dl = self.client.get(f"/api/emissions/entries/{res.data['id']}/proof/")
            self.assertEqual(dl.status_code, 200)
            self.assertTrue(b''.join(dl.streaming_content).startswith(b'%PDF'))

    def test_bad_proof_document_is_a_400_not_a_500(self):
        self._as('aylin')
        self.assertEqual(self._entry(proof_document=self._file('virus.exe')).status_code, 400)
        self.assertEqual(self._entry(proof_document=self._file('big.pdf', 10 * 1024 * 1024 + 1)).status_code, 400)
        self.assertEqual(EmissionEntry.objects.count(), 0)

    def _delete_account(self, name):
        self._as(name)
        return self.client.delete('/api/accounts/delete-account/', {'password': 'testpass123'}, format='json')

    def test_member_leaving_keeps_their_entries_in_the_company(self):
        self._as('ali')
        entry_id = self._entry().data['id']
        self.assertEqual(self._delete_account('ali').status_code, 200)
        entry = EmissionEntry.objects.get(id=entry_id)
        self.assertEqual(entry.company, self.company)
        self.assertIsNone(entry.user)
        self._as('aylin')
        listed = self.client.get('/api/emissions/entries/').data
        rows = listed['results'] if isinstance(listed, dict) else listed
        self.assertIn(entry_id, [r['id'] for r in rows])

    def test_owner_needs_an_admin_or_manager_to_take_over(self):
        res = self._delete_account('aylin')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'owner_successor_needed')
        self.assertTrue(User.objects.filter(username='aylin').exists())

    def test_owner_leaving_hands_the_company_to_a_manager(self):
        from companies.models import CompanyMembership
        CompanyMembership.objects.filter(user=self.users['ali']).update(role='manager')
        self._as('aylin')
        entry_id = self._entry().data['id']
        self.assertEqual(self._delete_account('aylin').status_code, 200)
        self.assertEqual(CompanyMembership.objects.get(user=self.users['ali']).role, 'owner')
        self.assertTrue(EmissionEntry.objects.filter(id=entry_id, company=self.company).exists())

    def test_sole_owner_leaving_deletes_their_company(self):
        from companies.models import Company, CompanyMembership
        CompanyMembership.objects.filter(user=self.users['ali']).delete()
        self._as('aylin')
        self._entry()
        self.assertEqual(self._delete_account('aylin').status_code, 200)
        self.assertFalse(Company.objects.filter(id=self.company.id).exists())
        self.assertEqual(EmissionEntry.objects.count(), 0)

    def test_wrong_password_has_a_code(self):
        self._as('aylin')
        res = self.client.delete('/api/accounts/delete-account/', {'password': 'nope'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'wrong_password')

    def test_form_entry_status_follows_role_like_chat(self):
        self._as('aylin')
        self.assertEqual(self._entry().data['status'], 'approved')
        self._as('ali')
        self.assertEqual(self._entry(quantity=11).data['status'], 'submitted')


class ApprovalNotificationAndDuplicateTests(TestCase):
    """Approvers hear about new entries, authors hear back, and duplicates are flagged."""

    def setUp(self):
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        self.factor = EmissionFactor.objects.create(
            slug='test-gas-dup', name='Test Gas', name_tr='Test Gaz',
            scope='scope1', category='stationary_combustion', country='global',
            unit='kg', factor_kg_co2e=2.5, year=2024, source='generic',
            is_active=True, is_default=True,
        )
        self.company = Company.objects.create(
            legal_entity_name='Kaya Tekstil A.Ş.', tax_number='1234567890',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        self.users = {}
        for name, role, lang in [('aylin', 'owner', 'tr'), ('ali', 'data_entry', 'en')]:
            u = User.objects.create_user(name, f'{name}@test.com', 'testpass123')
            UserProfile.objects.create(user=u, active_company=self.company, language_preference=lang)
            CompanyMembership.objects.create(company=self.company, user=u, role=role)
            self.users[name] = u
        self.client = APIClient()

    def _as(self, name):
        self.client.force_authenticate(user=self.users[name])

    def _entry(self, **extra):
        return self.client.post('/api/emissions/entries/', {
            'emission_factor': self.factor.id, 'year': 2026, 'month': 3, 'quantity': 10, **extra,
        }, format='json')

    def _notes(self, name, kind):
        from accounts.models import Notification
        return list(Notification.objects.filter(user=self.users[name], notification_type=kind))

    def test_submitted_entry_notifies_the_approver_in_their_language(self):
        self._as('ali')
        self.assertEqual(self._entry().status_code, 201)
        notes = self._notes('aylin', 'entry_submitted')
        self.assertEqual(len(notes), 1)
        self.assertEqual(notes[0].title, 'Onay bekleyen kayıt')
        self.assertIn('Test Gaz', notes[0].message)
        # No name on the account: the e-mail stands in for it, as in the
        # Onay Bekleyenler list ("Giren: …").
        self.assertTrue(notes[0].message.startswith('ali@test.com '))

    def test_notice_names_the_author_by_full_name(self):
        self.users['ali'].first_name, self.users['ali'].last_name = 'Ali', 'Kaya'
        self.users['ali'].save()
        self._as('ali')
        self._entry()
        self.assertTrue(self._notes('aylin', 'entry_submitted')[0].message.startswith('Ali Kaya yeni bir kayıt ekledi'))

    def test_owner_entry_needs_no_approval_notice(self):
        self._as('aylin')
        self._entry()
        self.assertEqual(self._notes('aylin', 'entry_submitted'), [])

    def test_rejection_tells_the_author_why_and_editing_resubmits(self):
        self._as('ali')
        entry_id = self._entry().data['id']
        self._as('aylin')
        res = self.client.post(f'/api/emissions/entries/{entry_id}/approve/',
                               {'action': 'reject', 'reason': 'Invoice missing'}, format='json')
        self.assertEqual(res.status_code, 200)
        notes = self._notes('ali', 'entry_rejected')
        self.assertEqual(len(notes), 1)
        self.assertIn('Invoice missing', notes[0].message)

        self._as('ali')
        res = self.client.patch(f'/api/emissions/entries/{entry_id}/', {'quantity': 12}, format='json')
        self.assertEqual(res.status_code, 200)
        entry = EmissionEntry.objects.get(id=entry_id)
        self.assertEqual(entry.status, 'submitted')
        self.assertEqual(entry.rejected_reason, '')
        self.assertEqual(len(self._notes('aylin', 'entry_submitted')), 2)

    def test_approval_tells_the_author(self):
        self._as('ali')
        entry_id = self._entry().data['id']
        self._as('aylin')
        self.client.post(f'/api/emissions/entries/{entry_id}/approve/', {'action': 'approve'}, format='json')
        self.assertEqual(len(self._notes('ali', 'entry_approved')), 1)

    def test_turned_off_approval_notifications_are_respected(self):
        self.users['aylin'].profile.notify_approvals = False
        self.users['aylin'].profile.save()
        self._as('ali')
        self._entry()
        self.assertEqual(self._notes('aylin', 'entry_submitted'), [])

    def test_same_entry_twice_is_flagged_unless_confirmed(self):
        self._as('aylin')
        self.assertEqual(self._entry().status_code, 201)
        res = self._entry()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.data['code'], 'possible_duplicate')
        self.assertEqual(EmissionEntry.objects.count(), 1)
        self.assertEqual(self._entry(confirm_duplicate=True).status_code, 201)
        self.assertEqual(EmissionEntry.objects.count(), 2)

    def test_different_month_or_rejected_entry_is_not_a_duplicate(self):
        self._as('aylin')
        self._entry()
        self.assertEqual(self._entry(month=4).status_code, 201)
        EmissionEntry.objects.filter(month=3).update(status='draft')
        self.assertEqual(self._entry().status_code, 201)


class YearsAndFacilityTests(TestCase):
    """The summary lists the years that have data; deleting a facility keeps its entries."""

    def setUp(self):
        from companies.models import Company, CompanyMembership, Facility
        from accounts.models import UserProfile
        self.factor = EmissionFactor.objects.create(
            slug='test-gas-years', name='Test Gas', name_tr='Test Gaz',
            scope='scope1', category='stationary_combustion', country='global',
            unit='kg', factor_kg_co2e=2.5, year=2024, source='generic',
            is_active=True, is_default=True,
        )
        self.company = Company.objects.create(
            legal_entity_name='Kaya Tekstil A.Ş.', tax_number='1234567890',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        self.user = User.objects.create_user('aylin', 'aylin@test.com', 'testpass123')
        UserProfile.objects.create(user=self.user, active_company=self.company)
        CompanyMembership.objects.create(company=self.company, user=self.user, role='owner')
        self.facility = Facility.objects.create(company=self.company, name='Fabrika 1')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _entry(self, year, **extra):
        return self.client.post('/api/emissions/entries/', {
            'emission_factor': self.factor.id, 'year': year, 'month': 3, 'quantity': 10, **extra,
        }, format='json')

    def test_summary_lists_years_with_data_newest_first(self):
        self._entry(2024)
        self._entry(2026)
        data = self.client.get('/api/emissions/summary/?year=2025').data
        self.assertEqual(data['years_with_data'], [2026, 2024])
        self.assertEqual(data['total_kg'], 0)

    def test_facility_shows_entry_count_and_delete_keeps_entries(self):
        entry_id = self._entry(2026, facility=self.facility.id).data['id']
        listed = self.client.get('/api/companies/facilities/').data
        rows = listed['results'] if isinstance(listed, dict) else listed
        self.assertEqual(rows[0]['entry_count'], 1)
        res = self.client.patch(f'/api/companies/facilities/{self.facility.id}/', {'name': 'Fabrika A'}, format='json')
        self.assertEqual(res.data['name'], 'Fabrika A')
        self.assertEqual(self.client.delete(f'/api/companies/facilities/{self.facility.id}/').status_code, 204)
        entry = EmissionEntry.objects.get(id=entry_id)
        self.assertIsNone(entry.facility)


class ExcelExportLanguageTests(TestCase):
    """The Excel export follows the UI language and shows each entry's status."""

    def setUp(self):
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        factor = EmissionFactor.objects.create(
            slug='test-gas-xlsx', name='Natural Gas (Turkey)', name_tr='Doğal Gaz (Türkiye)',
            scope='scope1', category='stationary_combustion', country='global',
            unit='gj', factor_kg_co2e=56.211, year=2024, source='generic',
            is_active=True, is_default=True,
        )
        company = Company.objects.create(
            legal_entity_name='Kaya Tekstil A.Ş.', tax_number='1234567890',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        self.user = User.objects.create_user('xlsx', 'xlsx@test.com', 'testpass123')
        UserProfile.objects.create(user=self.user, active_company=company)
        CompanyMembership.objects.create(company=company, user=self.user, role='owner')
        EmissionEntry.objects.create(user=self.user, company=company, emission_factor=factor,
                                     year=2026, month=3, quantity=10, status='draft',
                                     rejected_reason='Fatura eksik')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _rows(self, lang):
        import io
        from openpyxl import load_workbook
        res = self.client.get(f'/api/emissions/export-excel/?year=2026&lang={lang}')
        self.assertEqual(res.status_code, 200)
        ws = load_workbook(io.BytesIO(res.content)).active
        return [list(r) for r in ws.iter_rows(values_only=True)]

    def test_turkish_export(self):
        header, row = self._rows('tr')
        self.assertEqual(header[0], 'Kaynak')
        self.assertEqual(row[:4], ['Doğal Gaz (Türkiye)', 'Kapsam 1', 'Sabit Yanma', 'Mart'])
        self.assertEqual(row[-2:], ['Reddedildi', 'Fatura eksik'])

    def test_english_export(self):
        header, row = self._rows('en')
        self.assertEqual(header[-2:], ['Status', 'Rejection reason'])
        self.assertEqual(row[1:3], ['Scope 1', 'Stationary Combustion'])
        self.assertEqual(row[-2], 'Rejected')

    def _csv(self, lang):
        res = self.client.get(f'/api/emissions/export-csv/?year=2026&lang={lang}')
        self.assertEqual(res.status_code, 200)
        text = res.content.decode('utf-8')
        self.assertTrue(text.startswith('\ufeff'))
        return [line for line in text.lstrip('\ufeff').splitlines() if line]

    def test_turkish_csv_opens_in_turkish_excel(self):
        header, row = self._csv('tr')
        self.assertTrue(header.startswith('Kaynak;Kapsam;Kategori;Ay;Miktar'))
        cells = row.split(';')
        self.assertEqual(cells[:5], ['Doğal Gaz (Türkiye)', 'Kapsam 1', 'Sabit Yanma', 'Mart', '10'])
        self.assertEqual(cells[6], '56,211')       # decimal comma
        self.assertEqual(cells[8], '0,56211')      # no float noise
        self.assertEqual(cells[-2:], ['Reddedildi', 'Fatura eksik'])

    def test_english_csv(self):
        header, row = self._csv('en')
        self.assertTrue(header.startswith('Source,Scope,Category'))
        self.assertIn('Rejected', row)
        self.assertIn('56.211', row)


class TargetAndCustomRequestRoleTests(TestCase):
    """Targets are the company's commitment: only owner/admin/manager change
    them. A custom request is withdrawn or edited only while pending, by its
    sender or an owner/admin/manager."""

    def setUp(self):
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        self.company = Company.objects.create(
            legal_entity_name='Rol A.Ş.', tax_number='1234567891',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        self.users = {}
        for name, role in [('sahip', 'owner'), ('mudur', 'manager'), ('veri', 'data_entry'), ('veri2', 'data_entry')]:
            u = User.objects.create_user(name, f'{name}@test.com', 'testpass123')
            UserProfile.objects.create(user=u, active_company=self.company)
            CompanyMembership.objects.create(company=self.company, user=u, role=role)
            self.users[name] = u
        self.client = APIClient()

    def _as(self, name):
        self.client.force_authenticate(user=self.users[name])

    def _target(self):
        return self.client.post('/api/emissions/targets/', {
            'title': '2030', 'base_year': 2024, 'target_year': 2030,
            'base_emissions_kg': 1000, 'target_reduction_percent': 30,
        }, format='json')

    def test_data_entry_cannot_change_targets_but_can_read_them(self):
        self._as('veri')
        self.assertEqual(self._target().status_code, 403)
        self._as('mudur')
        res = self._target()
        self.assertEqual(res.status_code, 201, res.content)
        tid = res.json()['id']
        self._as('veri')
        self.assertEqual(self.client.get('/api/emissions/targets/').status_code, 200)
        self.assertEqual(self.client.delete(f'/api/emissions/targets/{tid}/').status_code, 403)
        self.assertEqual(self.client.patch(f'/api/emissions/targets/{tid}/', {'title': 'x'}, format='json').status_code, 403)
        self._as('sahip')
        self.assertEqual(self.client.delete(f'/api/emissions/targets/{tid}/').status_code, 204)

    def _request(self):
        return self.client.post('/api/emissions/custom-requests/', {
            'scope': 'scope1', 'category_name': 'Jeneratör', 'source_name': 'Dizel jeneratör',
            'description': 'x', 'unit': 'litre', 'quantity': 120.5, 'year': 2026, 'month': 3,
        }, format='json')

    def test_custom_request_withdrawn_by_sender_not_by_other_member(self):
        self._as('veri')
        rid = self._request().json()['id']
        self._as('veri2')
        self.assertEqual(self.client.delete(f'/api/emissions/custom-requests/{rid}/').status_code, 403)
        self._as('veri')
        self.assertEqual(self.client.delete(f'/api/emissions/custom-requests/{rid}/').status_code, 204)

    def test_reviewed_custom_request_cannot_be_changed(self):
        from .models import CustomEmissionRequest
        self._as('veri')
        rid = self._request().json()['id']
        CustomEmissionRequest.objects.filter(id=rid).update(status='approved')
        self._as('sahip')
        res = self.client.delete(f'/api/emissions/custom-requests/{rid}/')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'already_reviewed')


class EntryChangeRulesTests(TestCase):
    """A data-entry member changes only their own entries; changing the amount
    of an approved entry sends it back for approval; every change is in the
    company's history."""

    def setUp(self):
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        self.factor = EmissionFactor.objects.create(
            slug='test-gas-rules', name='Test Gas', name_tr='Test Gaz',
            scope='scope1', category='stationary_combustion', country='global',
            unit='m3', factor_kg_co2e=2, year=2024, source='generic',
            is_active=True, is_default=True,
        )
        self.company = Company.objects.create(
            legal_entity_name='Kural A.Ş.', tax_number='1234567892',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        self.users = {}
        for name, role in [('sahip', 'owner'), ('veri', 'data_entry'), ('denetci', 'auditor')]:
            u = User.objects.create_user(name, f'{name}@test.com', 'testpass123')
            UserProfile.objects.create(user=u, active_company=self.company)
            CompanyMembership.objects.create(company=self.company, user=u, role=role)
            self.users[name] = u
        self.client = APIClient()

    def _as(self, name):
        self.client.force_authenticate(user=self.users[name])

    def _entry(self, qty=300):
        res = self.client.post('/api/emissions/entries/', {
            'emission_factor': self.factor.id, 'year': 2026, 'month': 7, 'quantity': qty}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()['id']

    def test_data_entry_cannot_change_or_delete_others_entries(self):
        self._as('sahip')
        eid = self._entry()
        self._as('veri')
        self.assertEqual(self.client.patch(f'/api/emissions/entries/{eid}/', {'quantity': 3}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(f'/api/emissions/entries/{eid}/').status_code, 403)
        self.assertEqual(EmissionEntry.objects.get(id=eid).quantity, 300)

    def test_changing_an_approved_amount_goes_back_for_approval(self):
        self._as('veri')
        eid = self._entry()
        EmissionEntry.objects.filter(id=eid).update(status='approved')
        res = self.client.patch(f'/api/emissions/entries/{eid}/', {'quantity': 3}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(EmissionEntry.objects.get(id=eid).status, 'submitted')
        # A description-only edit keeps the approval.
        EmissionEntry.objects.filter(id=eid).update(status='approved')
        self.client.patch(f'/api/emissions/entries/{eid}/', {'description': 'fatura no 12'}, format='json')
        self.assertEqual(EmissionEntry.objects.get(id=eid).status, 'approved')

    def test_owner_change_stays_approved_and_is_in_history(self):
        self._as('sahip')
        eid = self._entry()
        self.assertEqual(EmissionEntry.objects.get(id=eid).status, 'approved')
        self.client.patch(f'/api/emissions/entries/{eid}/', {'quantity': 250}, format='json')
        self.assertEqual(EmissionEntry.objects.get(id=eid).status, 'approved')
        self._as('denetci')
        res = self.client.get('/api/accounts/history/')
        self.assertEqual(res.status_code, 200)
        actions = [r['action'] for r in res.json()]
        self.assertEqual(actions[:2], ['entry_updated', 'entry_created'])
        self.assertIn('300 m3 → Test Gas · 2026/07 · 250 m3', res.json()[0]['detail'])

    def test_data_entry_cannot_read_history(self):
        self._as('veri')
        self.assertEqual(self.client.get('/api/accounts/history/').status_code, 403)


class ProofDocumentTests(EntryChangeRulesTests):
    """Proof can be attached, replaced and removed after an entry exists, and
    a proof file lost from storage answers 410 instead of a 500."""

    def _pdf(self, name='fatura.pdf'):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return SimpleUploadedFile(name, b'%PDF-1.4 test', content_type='application/pdf')

    def setUp(self):
        super().setUp()
        import tempfile
        from django.test import override_settings
        self._media = tempfile.TemporaryDirectory()
        self._override = override_settings(MEDIA_ROOT=self._media.name)
        self._override.enable()
        self.addCleanup(self._override.disable)
        self.addCleanup(self._media.cleanup)

    def test_attach_replace_and_remove_proof_later(self):
        self._as('veri')
        eid = self._entry()
        res = self.client.post(f'/api/emissions/entries/{eid}/proof/', {'proof_document': self._pdf()}, format='multipart')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(res.json()['proof_available'])
        self.assertEqual(self.client.get(f'/api/emissions/entries/{eid}/proof/').status_code, 200)
        res = self.client.post(f'/api/emissions/entries/{eid}/proof/', {'proof_document': self._pdf('yeni.pdf')}, format='multipart')
        self.assertIn('yeni', res.json()['proof_document'])
        self.assertEqual(self.client.delete(f'/api/emissions/entries/{eid}/proof/').status_code, 204)
        self.assertFalse(EmissionEntry.objects.get(id=eid).proof_document)

    def test_other_members_entry_proof_is_protected(self):
        self._as('sahip')
        eid = self._entry()
        self._as('veri')
        res = self.client.post(f'/api/emissions/entries/{eid}/proof/', {'proof_document': self._pdf()}, format='multipart')
        self.assertEqual(res.status_code, 403)

    def test_bad_file_type_is_refused(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self._as('veri')
        eid = self._entry()
        res = self.client.post(f'/api/emissions/entries/{eid}/proof/',
                               {'proof_document': SimpleUploadedFile('x.exe', b'MZ')}, format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_lost_file_answers_410(self):
        self._as('veri')
        eid = self._entry()
        self.client.post(f'/api/emissions/entries/{eid}/proof/', {'proof_document': self._pdf()}, format='multipart')
        entry = EmissionEntry.objects.get(id=eid)
        entry.proof_document.storage.delete(entry.proof_document.name)
        res = self.client.get(f'/api/emissions/entries/{eid}/proof/')
        self.assertEqual(res.status_code, 410)
        self.assertEqual(res.json()['code'], 'proof_missing')
        listed = self.client.get('/api/emissions/entries/?year=2026').json()
        listed = listed.get('results', listed)
        self.assertFalse([e for e in listed if e['id'] == eid][0]['proof_available'])


class OnlyApprovedEntriesCountTests(TestCase):
    """Totals and reports count approved entries only; pending and rejected
    ones are reported separately, for information."""

    def setUp(self):
        from companies.models import Company, CompanyMembership
        self.user = User.objects.create_user('countu', 'count@test.com', 'testpass123')
        self.company = Company.objects.create(
            legal_entity_name='Sayım A.Ş.', tax_number='7777777777',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        CompanyMembership.objects.create(company=self.company, user=self.user, role='owner')
        self.factor = EmissionFactor.objects.create(
            slug='count-gas', name='Count Gas', scope='scope1', category='stationary_combustion',
            country='global', unit='kg', factor_kg_co2e=2, year=2024, source='generic',
            is_active=True, is_default=True,
        )
        for qty, status in ((100, 'approved'), (40, 'submitted'), (10, 'draft')):
            EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.factor,
                                         year=2026, month=3, quantity=qty, status=status)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_summary_counts_approved_only_and_reports_the_rest(self):
        data = self.client.get('/api/emissions/summary/?year=2026').data
        self.assertAlmostEqual(data['total_kg'], 200.0)
        self.assertAlmostEqual(data['scope1_kg'], 200.0)
        self.assertEqual(data['not_counted']['pending'], {'count': 1, 'total_kg': 80.0})
        self.assertEqual(data['not_counted']['rejected'], {'count': 1, 'total_kg': 20.0})

    def test_year_comparison_and_facility_breakdown_count_approved_only(self):
        data = self.client.get('/api/emissions/comparison/?year1=2025&year2=2026').data
        self.assertAlmostEqual(data['year2']['total_kg'], 200.0)
        from companies.models import Facility
        fac = Facility.objects.create(company=self.company, name='Fab', country='TR')
        EmissionEntry.objects.filter(company=self.company).update(facility=fac)
        rows = self.client.get('/api/emissions/by-facility/?year=2026').data
        self.assertAlmostEqual(rows[0]['total_kg'], 200.0)

    def test_note_text(self):
        from .inventory import not_counted, not_counted_note
        info = not_counted(EmissionEntry.objects.filter(company=self.company, year=2026))
        tr = not_counted_note(info, tr=True)
        self.assertIn('1 onay bekleyen kayıt (0,080 tCO₂e)', tr)
        self.assertIn('1 reddedilen kayıt (0,020 tCO₂e)', tr)
        self.assertIn('dahil değildir', tr)
        self.assertEqual(not_counted_note({'pending': {'count': 0}, 'rejected': {'count': 0}}), '')

    def test_emissions_pdf_carries_the_note(self):
        from io import BytesIO
        from pypdf import PdfReader
        res = self.client.get('/api/emissions/report/?year=2026&lang=tr')
        self.assertEqual(res.status_code, 200)
        text = ' '.join(' '.join(p.extract_text() for p in PdfReader(BytesIO(res.content)).pages).split())
        self.assertIn('Toplam emisyon: 0,20 tCO₂e', text)  # approved only
        self.assertIn('onay bekleyen kayıt', text)
        self.assertIn('dahil değildir', text)

    def test_legacy_migration_approves_only_approver_entries(self):
        import importlib
        from django.apps import apps
        from companies.models import CompanyMembership
        member = User.objects.create_user('dataent', 'de@test.com', 'testpass123')
        CompanyMembership.objects.create(company=self.company, user=member, role='data_entry')
        mine = EmissionEntry.objects.filter(company=self.company, status='submitted').get()
        theirs = EmissionEntry.objects.create(user=member, company=self.company, emission_factor=self.factor,
                                              year=2026, month=4, quantity=5, status='submitted')
        rejected = EmissionEntry.objects.filter(company=self.company, status='draft').get()
        mig = importlib.import_module('emissions.migrations.0016_approve_legacy_approver_entries')
        mig.approve_legacy(apps, None)
        mine.refresh_from_db(); theirs.refresh_from_db(); rejected.refresh_from_db()
        self.assertEqual(mine.status, 'approved')
        self.assertEqual(theirs.status, 'submitted')
        self.assertEqual(rejected.status, 'draft')
