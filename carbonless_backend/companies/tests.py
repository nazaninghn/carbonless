from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import Company, Facility, CompanyMembership


class CompanyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('cuser', 'c@test.com', 'testpass123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_company(self):
        res = self.client.post('/api/companies/create/', {
            'legal_entity_name': 'Test Corp',
            'tax_number': '1234567890',
            'country_of_headquarters': 'Turkey',
            'countries_of_operation': 'Turkey',
            'main_activity_description': 'Manufacturing',
            'number_of_employees': '51-250',
            'annual_turnover_range': '1M-10M',
            'number_of_facilities': 1,
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(CompanyMembership.objects.filter(user=self.user, role='owner').exists())

    def test_get_company(self):
        company = Company.objects.create(
            legal_entity_name='Test Corp',
            tax_number='123', country_of_headquarters='TR',
            countries_of_operation='TR', main_activity_description='Test',
            number_of_employees='1-10', annual_turnover_range='<1M',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(company=company, user=self.user, role='owner')
        res = self.client.get('/api/companies/detail/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['legal_entity_name'], 'Test Corp')


class FacilityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('fuser', 'f@test.com', 'testpass123')
        self.company = Company.objects.create(
            legal_entity_name='Fac Corp',
            tax_number='999', country_of_headquarters='TR',
            countries_of_operation='TR', main_activity_description='Test',
            number_of_employees='1-10', annual_turnover_range='<1M',
            number_of_facilities=2,
        )
        CompanyMembership.objects.create(company=self.company, user=self.user, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_facility(self):
        res = self.client.post('/api/companies/facilities/', {
            'name': 'Main Office', 'city': 'Istanbul',
            'country': 'Turkey', 'facility_type': 'Office',
            'company': self.company.pk,
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_duplicate_name_is_rejected_and_country_defaults(self):
        res = self.client.post('/api/companies/facilities/', {'name': 'Gebze Fabrika'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['country'], 'TR')  # the company's own country
        res = self.client.post('/api/companies/facilities/', {'name': '  gebze fabrika '}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('name', res.data)
        other = self.client.post('/api/companies/facilities/', {'name': 'Bursa Depo'}, format='json').data
        # Renaming onto an existing name is refused; keeping its own name is fine.
        self.assertEqual(self.client.patch(f"/api/companies/facilities/{other['id']}/",
                                           {'name': 'Gebze Fabrika'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f"/api/companies/facilities/{other['id']}/",
                                           {'name': 'Bursa Depo', 'city': 'Bursa'}, format='json').status_code, 200)

    def test_list_facilities(self):
        Facility.objects.create(company=self.company, name='HQ', city='Istanbul')
        res = self.client.get('/api/companies/facilities/')
        self.assertEqual(res.status_code, 200)
        data = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        self.assertEqual(len(data), 1)


class CompanyAndFacilityRoleTests(FacilityTests):
    """Members read company details and facilities; only owners, admins and
    managers change them (a data-entry member could delete a facility, and
    its approved entries lost their facility)."""

    def _member(self, name, role):
        u = User.objects.create_user(name, f'{name}@test.com', 'testpass123')
        CompanyMembership.objects.create(company=self.company, user=u, role=role)
        c = APIClient()
        c.force_authenticate(user=u)
        return c

    def test_data_entry_reads_but_cannot_change(self):
        fac = Facility.objects.create(company=self.company, name='HQ', city='Istanbul')
        c = self._member('clerk', 'data_entry')
        self.assertEqual(c.get('/api/companies/detail/').status_code, 200)
        self.assertEqual(c.get('/api/companies/facilities/').status_code, 200)
        self.assertEqual(c.patch('/api/companies/detail/', {'tax_number': '1'}, format='json').status_code, 403)
        self.assertEqual(c.post('/api/companies/facilities/', {'name': 'Depo'}, format='json').status_code, 403)
        self.assertEqual(c.patch(f'/api/companies/facilities/{fac.id}/', {'name': 'X'}, format='json').status_code, 403)
        self.assertEqual(c.delete(f'/api/companies/facilities/{fac.id}/').status_code, 403)
        self.assertTrue(Facility.objects.filter(pk=fac.id, name='HQ').exists())
        self.company.refresh_from_db()
        self.assertEqual(self.company.tax_number, '999')

    def test_manager_can_change(self):
        fac = Facility.objects.create(company=self.company, name='HQ', city='Istanbul')
        c = self._member('mgr', 'manager')
        self.assertEqual(c.patch(f'/api/companies/facilities/{fac.id}/', {'city': 'Bursa'}, format='json').status_code, 200)
        self.assertEqual(c.post('/api/companies/facilities/', {'name': 'Depo'}, format='json').status_code, 201)


class CompanyIsolationTests(TestCase):
    """Test that users cannot access other companies' data"""

    def setUp(self):
        self.user1 = User.objects.create_user('user1', 'u1@test.com', 'pass12345')
        self.user2 = User.objects.create_user('user2', 'u2@test.com', 'pass12345')

        self.company1 = Company.objects.create(
            legal_entity_name='Company A', tax_number='111',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='A', number_of_employees='1-10',
            annual_turnover_range='<1M', number_of_facilities=1,
        )
        self.company2 = Company.objects.create(
            legal_entity_name='Company B', tax_number='222',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='B', number_of_employees='1-10',
            annual_turnover_range='<1M', number_of_facilities=1,
        )

        CompanyMembership.objects.create(company=self.company1, user=self.user1, role='owner')
        CompanyMembership.objects.create(company=self.company2, user=self.user2, role='owner')

        Facility.objects.create(company=self.company1, name='Facility A')
        Facility.objects.create(company=self.company2, name='Facility B')

    def test_user1_cannot_see_company2_facilities(self):
        client = APIClient()
        client.force_authenticate(user=self.user1)
        res = client.get('/api/companies/facilities/')
        self.assertEqual(res.status_code, 200)
        data = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        names = [f['name'] for f in data]
        self.assertIn('Facility A', names)
        self.assertNotIn('Facility B', names)

    def test_user2_cannot_see_company1_detail(self):
        client = APIClient()
        client.force_authenticate(user=self.user2)
        res = client.get('/api/companies/detail/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['legal_entity_name'], 'Company B')


class InviteFlowTests(TestCase):
    """An invite emails a join link, and a new signup with that address joins on verification."""

    def setUp(self):
        from accounts.models import UserProfile
        self.owner = User.objects.create_user('owner', 'owner@test.com', 'testpass123')
        UserProfile.objects.create(user=self.owner)
        self.company = Company.objects.create(
            legal_entity_name='Kaya Tekstil A.Ş.', tax_number='1234567890',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        CompanyMembership.objects.create(company=self.company, user=self.owner, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def _invite(self, email='ali@test.com'):
        res = self.client.post('/api/companies/invite/', {'email': email, 'role': 'data_entry'}, format='json')
        self.assertEqual(res.status_code, 200)
        return res.data

    def test_invite_sends_an_email_with_the_join_link(self):
        from django.core import mail
        data = self._invite()
        self.assertTrue(data['email_sent'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['ali@test.com'])
        self.assertIn(f"/accept-invite?token={data['token']}", mail.outbox[0].body)

    def test_new_signup_joins_the_team_when_the_email_is_verified(self):
        from accounts.models import EmailVerificationToken
        self._invite('ali@test.com')
        res = APIClient().post('/api/accounts/register/', {
            'username': 'ali', 'email': 'ali@test.com',
            'password': 'StrongPass123', 'password2': 'StrongPass123',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        ali = User.objects.get(username='ali')
        self.assertFalse(CompanyMembership.objects.filter(user=ali, company=self.company).exists())
        code = EmailVerificationToken.objects.get(user=ali).code
        res = APIClient().post('/api/accounts/verify-email-code/', {'email': 'ali@test.com', 'code': code}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['joined_companies'], ['Kaya Tekstil A.Ş.'])
        membership = CompanyMembership.objects.get(user=ali, company=self.company)
        self.assertEqual(membership.role, 'data_entry')
        ali.profile.refresh_from_db()
        self.assertEqual(ali.profile.active_company, self.company)

    def test_opening_the_link_after_auto_join_still_succeeds(self):
        data = self._invite('ali@test.com')
        ali = User.objects.create_user('ali', 'ali@test.com', 'testpass123')
        from companies.views import accept_pending_invites
        accept_pending_invites(ali)
        client = APIClient(); client.force_authenticate(user=ali)
        res = client.post('/api/companies/accept-invite/', {'token': data['token']}, format='json')
        self.assertEqual(res.status_code, 200)

    def test_used_invite_cannot_be_taken_by_someone_else(self):
        data = self._invite('ali@test.com')
        ali = User.objects.create_user('ali', 'ali@test.com', 'testpass123')
        from companies.views import accept_pending_invites
        accept_pending_invites(ali)
        other = User.objects.create_user('eve', 'eve@test.com', 'testpass123')
        client = APIClient(); client.force_authenticate(user=other)
        res = client.post('/api/companies/accept-invite/', {'token': data['token']}, format='json')
        self.assertEqual(res.status_code, 404)
        self.assertFalse(CompanyMembership.objects.filter(user=other, company=self.company).exists())


class InviteManagementTests(InviteFlowTests):
    """Invites are validated, renewed when sent again, listed and cancellable."""

    def _post(self, email):
        return self.client.post('/api/companies/invite/', {'email': email, 'role': 'data_entry'}, format='json')

    def test_invalid_email_is_refused(self):
        res = self._post('bozuk-adres')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'invalid_email')

    def test_existing_member_is_not_invited(self):
        member = User.objects.create_user('selin', 'Selin@Test.com', 'testpass123')
        CompanyMembership.objects.create(company=self.company, user=member, role='admin')
        res = self._post('selin@test.com')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'already_member')
        CompanyMembership.objects.filter(user=member).update(is_active=False)
        self.assertEqual(self._post('selin@test.com').data['code'], 'inactive_member')

    def test_sending_again_renews_an_expired_invite(self):
        import datetime
        from django.utils import timezone
        from .models import CompanyInvite
        first = self._invite('ali@test.com')
        CompanyInvite.objects.filter(email='ali@test.com').update(expires_at=timezone.now() - datetime.timedelta(days=1))
        second = self._invite('ali@test.com')
        invite = CompanyInvite.objects.get(email='ali@test.com')
        self.assertFalse(invite.is_expired)
        self.assertNotEqual(first['token'], second['token'])

    def test_pending_invites_are_listed_and_can_be_cancelled(self):
        self._invite('ali@test.com')
        res = self.client.get('/api/companies/invites/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual([r['email'] for r in res.data], ['ali@test.com'])
        res = self.client.delete(f"/api/companies/invites/{res.data[0]['id']}/")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(self.client.get('/api/companies/invites/').data, [])

    def test_data_entry_cannot_see_or_cancel_invites(self):
        self._invite('ali@test.com')
        clerk = User.objects.create_user('veri', 'veri@test.com', 'testpass123')
        from accounts.models import UserProfile
        UserProfile.objects.create(user=clerk, active_company=self.company)
        CompanyMembership.objects.create(company=self.company, user=clerk, role='data_entry')
        client = APIClient(); client.force_authenticate(user=clerk)
        self.assertEqual(client.get('/api/companies/invites/').status_code, 403)


class JoinFromInviteTests(InviteFlowTests):
    """Signing up from an invite joins the team without a company of one's own."""

    def test_invite_info_shows_company_role_and_email(self):
        data = self._invite('deniz@test.com')
        res = APIClient().get('/api/companies/invite-info/', {'token': data['token']})
        self.assertEqual(res.status_code, 200)
        self.assertEqual({k: res.data[k] for k in ('email', 'role', 'company')},
                         {'email': 'deniz@test.com', 'role': 'data_entry', 'company': 'Kaya Tekstil A.Ş.'})
        # The inviter is named as the invitee would know them: no full name
        # here, so the email address, not the username.
        self.assertEqual(res.data['invited_by'], 'owner@test.com')
        self.assertEqual(APIClient().get('/api/companies/invite-info/', {'token': 'x'}).status_code, 404)

    def test_signup_with_invite_creates_no_placeholder_company(self):
        from accounts.models import EmailVerificationToken
        data = self._invite('deniz@test.com')
        res = APIClient().post('/api/accounts/register/', {
            'username': 'deniz', 'email': 'deniz@test.com',
            'password': 'StrongPass123', 'password2': 'StrongPass123',
            'first_name': 'Deniz', 'last_name': 'Kaya',
            'invite_token': data['token'], 'language': 'tr',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        # The name typed on the join page is what the team list shows.
        self.assertEqual(User.objects.get(username='deniz').get_full_name(), 'Deniz Kaya')
        self.assertTrue(res.data['joining_team'])
        deniz = User.objects.get(username='deniz')
        # The invite link came to this address: no second emailed code — the
        # account is verified and in the team as soon as it is created.
        self.assertTrue(deniz.is_active)
        self.assertTrue(EmailVerificationToken.objects.get(user=deniz).is_verified)
        memberships = CompanyMembership.objects.filter(user=deniz)
        self.assertEqual([(m.company_id, m.role) for m in memberships], [(self.company.id, 'data_entry')])
        login = APIClient().post('/api/accounts/login/', {'username': 'deniz', 'password': 'StrongPass123'}, format='json')
        self.assertEqual(login.status_code, 200)

    def test_invite_email_names_role_and_inviter_not_username(self):
        from django.core import mail
        mail.outbox.clear()
        self._invite('deniz@test.com')
        body = mail.outbox[-1].body
        self.assertIn('Rolünüz: Veri Girişi', body)
        self.assertIn('Your role: Data Entry', body)
        self.assertNotIn('doğruladığınızda', body)

    def test_invite_token_for_another_email_still_gets_own_company(self):
        data = self._invite('deniz@test.com')
        APIClient().post('/api/accounts/register/', {
            'username': 'eve', 'email': 'eve@test.com',
            'password': 'StrongPass123', 'password2': 'StrongPass123',
            'invite_token': data['token'],
        }, format='json')
        eve = User.objects.get(username='eve')
        self.assertTrue(CompanyMembership.objects.filter(user=eve, role='owner').exists())
        self.assertFalse(CompanyMembership.objects.filter(user=eve, company=self.company).exists())


class CompanyContactValidationTests(TestCase):
    """Telephone and website are printed as stated in the ISO report, so they
    must look like a phone number and a web address."""

    def setUp(self):
        from accounts.models import UserProfile
        self.user = User.objects.create_user('contact', 'contact@test.com', 'testpass123')
        UserProfile.objects.create(user=self.user, language_preference='tr')
        company = Company.objects.create(
            legal_entity_name='İletişim A.Ş.', tax_number='1234567890', country_of_headquarters='TR',
            countries_of_operation='TR', main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        CompanyMembership.objects.create(company=company, user=self.user, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _patch(self, **data):
        return self.client.patch('/api/companies/detail/', data, format='json')

    def test_valid_contact_details_are_saved(self):
        res = self._patch(telephone='+90 212 555 01 23', website='https://www.iletisim.com.tr')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['telephone'], '+90 212 555 01 23')
        self.assertEqual(self._patch(telephone='', website='').status_code, 200)

    def test_text_is_not_a_phone_or_website(self):
        res = self._patch(telephone='Kaya Tekstil')
        self.assertEqual(res.status_code, 400)
        self.assertIn('telefon', str(res.data['telephone']))
        self.assertEqual(self._patch(telephone='123').status_code, 400)
        res = self._patch(website='Kaya Tekstil')
        self.assertEqual(res.status_code, 400)
        self.assertIn('internet sitesi', str(res.data['website']))

    def test_questionnaire_step_uses_the_same_check(self):
        from questionnaire.serializers import StepA7bSerializer
        s = StepA7bSerializer(data={'telephone': 'abc', 'website': 'kaya'}, context={'lang': 'tr'})
        self.assertFalse(s.is_valid())
        self.assertEqual(set(s.errors), {'telephone', 'website'})
        self.assertTrue(StepA7bSerializer(data={'telephone': '0212 555 01 23', 'website': 'kaya.com'}).is_valid())


class OwnershipTransferTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from django.contrib.auth.models import User
        from companies.models import Company, CompanyMembership
        self.company = Company.objects.create(
            legal_entity_name='Devir A.Ş.', tax_number='99', country_of_headquarters='TR',
            countries_of_operation='TR', nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        self.owner = User.objects.create_user('own', 'own@t.com', 'pass12345')
        self.admin = User.objects.create_user('adm', 'adm@t.com', 'pass12345')
        self.clerk = User.objects.create_user('clk', 'clk@t.com', 'pass12345')
        self.m_owner = CompanyMembership.objects.create(company=self.company, user=self.owner, role='owner')
        self.m_admin = CompanyMembership.objects.create(company=self.company, user=self.admin, role='admin')
        self.m_clerk = CompanyMembership.objects.create(company=self.company, user=self.clerk, role='data_entry')
        self.c = APIClient()

    def _transfer(self, user, membership, password='pass12345'):
        self.c.force_authenticate(user=user)
        return self.c.post('/api/companies/transfer-ownership/',
                           {'membership_id': membership.pk, 'password': password}, format='json')

    def test_owner_hands_over_to_an_admin(self):
        self.assertEqual(self._transfer(self.owner, self.m_admin).status_code, 200)
        self.m_owner.refresh_from_db(); self.m_admin.refresh_from_db()
        self.assertEqual((self.m_owner.role, self.m_admin.role), ('admin', 'owner'))

    def test_guards(self):
        self.assertEqual(self._transfer(self.owner, self.m_admin, 'wrong').data['code'], 'wrong_password')
        self.assertEqual(self._transfer(self.owner, self.m_clerk).data['code'], 'not_admin')
        self.assertEqual(self._transfer(self.admin, self.m_admin).status_code, 403)
        self.m_owner.refresh_from_db()
        self.assertEqual(self.m_owner.role, 'owner')


class TwoCompaniesTests(TestCase):
    """A user in two companies: a page names the company it was opened with,
    and is refused once another tab switched; a chat card is not saved into
    another company; other companies' unread notices are counted apart."""

    def setUp(self):
        from accounts.models import UserProfile
        from companies.models import Company, CompanyMembership
        from rest_framework_simplejwt.tokens import RefreshToken
        mk = lambda name, tax: Company.objects.create(
            legal_entity_name=name, tax_number=tax, country_of_headquarters='TR',
            countries_of_operation='TR', main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1)
        self.a, self.b = mk('Anadolu A.Ş.', '1111111111'), mk('Ege A.Ş.', '2222222222')
        self.user = User.objects.create_user('iki', 'iki@test.com', 'testpass123')
        UserProfile.objects.create(user=self.user, active_company=self.a)
        CompanyMembership.objects.create(company=self.a, user=self.user, role='owner')
        CompanyMembership.objects.create(company=self.b, user=self.user, role='owner')
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.user).access_token}')

    def test_a_page_of_the_old_company_is_refused_after_a_switch(self):
        ok = self.client.get('/api/emissions/entries/', HTTP_X_COMPANY_ID=str(self.a.pk))
        self.assertEqual(ok.status_code, 200)
        self.client.post('/api/companies/switch/', {'company_id': self.b.pk}, format='json',
                         HTTP_X_COMPANY_ID=str(self.a.pk))
        stale = self.client.get('/api/emissions/entries/', HTTP_X_COMPANY_ID=str(self.a.pk))
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.json()['code'], 'company_changed')
        self.assertEqual(stale.json()['active_company']['name'], 'Ege A.Ş.')
        # without the header (API clients) nothing changes
        self.assertEqual(self.client.get('/api/emissions/entries/').status_code, 200)

    def test_a_chat_card_is_not_saved_into_another_company(self):
        self.client.post('/api/companies/switch/', {'company_id': self.b.pk}, format='json')
        res = self.client.post('/api/chat/confirm-entry/', {
            'fuel_type': 'electricity', 'quantity': 1000, 'unit': 'kwh', 'year': 2024, 'month': 3,
            'company_id': self.a.pk, 'company_name': 'Anadolu A.Ş.'}, format='json')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'card_other_company')
        self.assertIn('Anadolu A.Ş. için hazırlandı', res.json()['message_tr'])

    def test_other_companies_unread_notices(self):
        from accounts.models import Notification
        Notification.objects.create(user=self.user, company=self.b, notification_type='entry_submitted',
                                    title='x', message='y')
        res = self.client.get('/api/accounts/notifications/unread-count/').json()
        self.assertEqual(res['unread_count'], 0)
        self.assertEqual(res['other_companies'], [{'id': self.b.pk, 'name': 'Ege A.Ş.', 'unread': 1}])
