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
            year=2026, month=1, quantity=1000,
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
