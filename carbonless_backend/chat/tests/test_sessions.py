from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from ..models import ChatSession, ChatMessage


class ChatSessionTests(TestCase):
    def setUp(self):
        # The chat's per-user rate limit (20/min) is kept in the cache, and
        # test users share ids across classes: start each test with none used.
        from django.core.cache import cache
        cache.clear()
        self.user = User.objects.create_user('chatuser', 'chat@test.com', 'testpass123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_session(self):
        res = self.client.post('/api/chat/sessions/new/', {'title': 'Test Chat'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['title'], 'Test Chat')
        self.assertTrue(ChatSession.objects.filter(user=self.user).exists())

    def test_list_sessions(self):
        ChatSession.objects.create(user=self.user, title='Chat 1')
        ChatSession.objects.create(user=self.user, title='Chat 2')
        res = self.client.get('/api/chat/sessions/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)

    def test_get_session(self):
        session = ChatSession.objects.create(user=self.user, title='My Chat')
        ChatMessage.objects.create(session=session, role='user', content='Hello')
        ChatMessage.objects.create(session=session, role='assistant', content='Hi!')
        res = self.client.get(f'/api/chat/sessions/{session.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['messages']), 2)

    def test_delete_session(self):
        session = ChatSession.objects.create(user=self.user, title='Delete Me')
        res = self.client.delete(f'/api/chat/sessions/{session.id}/')
        # Fix #85 changed the DELETE response to 204 No Content (RFC 9110 §9.3.5).
        self.assertEqual(res.status_code, 204)
        self.assertFalse(ChatSession.objects.filter(id=session.id).exists())

    def test_session_isolation(self):
        """Other users cannot access sessions"""
        other = User.objects.create_user('other', 'other@test.com', 'testpass123')
        session = ChatSession.objects.create(user=other, title='Private')
        res = self.client.get(f'/api/chat/sessions/{session.id}/')
        self.assertEqual(res.status_code, 404)


class CompanyChatTests(TestCase):
    """A member of several companies sees each company's chats only while
    working in it."""

    def setUp(self):
        # The chat's per-user rate limit (20/min) is kept in the cache, and
        # test users share ids across classes: start each test with none used.
        from django.core.cache import cache
        cache.clear()
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        def company(name, tax):
            return Company.objects.create(
                legal_entity_name=name, tax_number=tax, country_of_headquarters='TR',
                countries_of_operation='TR', main_activity_description='x', number_of_employees='1-10',
                annual_turnover_range='x', number_of_facilities=1)
        self.a, self.b = company('A A.Ş.', '1'), company('B A.Ş.', '2')
        self.user = User.objects.create_user('multi', 'multi@test.com', 'testpass123')
        CompanyMembership.objects.create(company=self.a, user=self.user, role='owner')
        CompanyMembership.objects.create(company=self.b, user=self.user, role='data_entry')
        self.profile = UserProfile.objects.create(user=self.user, active_company=self.a)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_chats_follow_the_company(self):
        res = self.client.post('/api/chat/sessions/new/', {'title': 'A chat'}, format='json')
        a_chat = res.data['id']
        self.assertEqual(ChatSession.objects.get(id=a_chat).company, self.a)
        self.client.post('/api/companies/switch/', {'company_id': self.b.id}, format='json')
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.active_company, self.b)
        self.assertEqual(self.client.get('/api/chat/sessions/').data, [])
        self.assertEqual(self.client.get(f'/api/chat/sessions/{a_chat}/').status_code, 404)
        self.client.post('/api/companies/switch/', {'company_id': self.a.id}, format='json')
        self.assertEqual([s['id'] for s in self.client.get('/api/chat/sessions/').data], [a_chat])


class MultiItemMessageTests(TestCase):
    """The chat turns every item of a message into a pending entry and says what it couldn't read."""

    @classmethod
    def setUpTestData(cls):
        from django.core.management import call_command
        from io import StringIO
        call_command('seed_factors', stdout=StringIO())

    def setUp(self):
        # The chat's per-user rate limit (20/min) is kept in the cache, and
        # test users share ids across classes: start each test with none used.
        from django.core.cache import cache
        cache.clear()
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        self.user = User.objects.create_user('multi', 'multi@test.com', 'testpass123')
        company = Company.objects.create(
            legal_entity_name='Kaya Tekstil A.Ş.', tax_number='1234567890',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        UserProfile.objects.create(user=self.user, active_company=company)
        CompanyMembership.objects.create(company=company, user=self.user, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session = ChatSession.objects.create(user=self.user, title='t')

    def _send(self, text):
        return self.client.post(f'/api/chat/sessions/{self.session.id}/message/',
                                {'content': text, 'language': 'tr'}, format='json')

    def test_both_items_become_pending_entries(self):
        res = self._send("Ocak'ta 5.000 kWh elektrik ve 300 m3 doğalgaz kullandık")
        self.assertEqual(res.status_code, 200)
        kinds = [(p['fuel_type'], p['month']) for p in res.data['pending_entries']]
        self.assertEqual(kinds, [('electricity', 1), ('natural_gas', 1)])
        self.assertNotIn('anlayamadım', res.data['content'])

    def test_facility_electricity_uses_its_own_countrys_grid(self):
        # A Turkish company's site in Germany: the German grid, not Turkey's.
        # A site in a country without its own grid factor (Austria) is not
        # calculated — no EU average or headquarters grid in its place.
        from companies.models import Facility
        from emissions.models import EmissionEntry
        company = self.user.profile.active_company
        Facility.objects.create(company=company, name='Werk Stuttgart', country='DE')
        linz = Facility.objects.create(company=company, name='Werk Linz', country='AT')
        Facility.objects.create(company=company, name='Gebze Fabrika', country='TR', grid_connection='distribution')
        Facility.objects.create(company=company, name='Bursa Depo', country='TR')   # connection not chosen
        pe = self._send("Mart 2024 Werk Stuttgart'ta 5.000 kWh elektrik kullandık").data['pending_entries'][0]
        self.assertEqual(pe['factor_name'], 'Germany grid')
        self.assertAlmostEqual(pe['co2e_kg'], 5000 * pe['factor_used'], places=2)
        res = self._send("Mart 2024 Werk Linz'de 5.000 kWh elektrik kullandık")
        self.assertEqual(res.data['pending_entries'], [])
        self.assertIn('Werk Linz', res.data['content'])
        self.assertIn('Özel Talep', res.data['content'])
        pe = self._send("Mart 2024 Gebze Fabrika'da 5.000 kWh elektrik kullandık").data['pending_entries'][0]
        self.assertEqual(pe['factor_name_tr'], 'Türkiye şebekesi — dağıtım bağlantısı')
        res = self._send("Mart 2024 Bursa Depo'da 5.000 kWh elektrik kullandık")
        self.assertEqual(res.data['pending_entries'], [])
        self.assertIn('bağlantı türü', res.data['content'])
        # The confirm endpoint applies the same rule.
        bad = self.client.post('/api/chat/confirm-entry/', {**pe, 'facility_id': linz.id, 'year': 2024, 'month': 3},
                               format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bad.data['code'], 'facility_grid_missing')
        self.assertFalse(EmissionEntry.objects.filter(facility=linz).exists())

    def test_named_facility_and_annual_inventory_overlap(self):
        from companies.models import Facility
        from emissions.models import EmissionEntry, EmissionFactor
        company = self.user.profile.active_company
        gebze = Facility.objects.create(company=company, name='Gebze Fabrika')
        res = self._send("Mart 2024 Gebze Fabrika'da 5.000 kWh elektrik kullandık")
        pe = res.data['pending_entries'][0]
        self.assertEqual((pe['facility_id'], pe['facility_name']), (gebze.id, 'Gebze Fabrika'))
        saved = self.client.post('/api/chat/confirm-entry/', {**pe, 'year': 2024, 'month': 3}, format='json')
        self.assertEqual(saved.status_code, 201, saved.content)
        self.assertEqual(EmissionEntry.objects.get(id=saved.data['id']).facility_id, gebze.id)
        # the year's questionnaire already holds this facility's annual electricity
        grid = EmissionEntry.objects.get(id=saved.data['id']).emission_factor
        EmissionEntry.objects.create(user=self.user, company=company, emission_factor=grid, year=2024, month=1,
                                     quantity=120000, facility=gebze, status='approved',
                                     description='Questionnaire step 4A-1 · Gebze Fabrika')
        again = self.client.post('/api/chat/confirm-entry/', {**pe, 'quantity': 6000, 'year': 2024, 'month': 4},
                                 format='json')
        self.assertEqual(again.status_code, 409)
        self.assertEqual(again.data['code'], 'annual_overlap')
        self.assertIn('Gebze Fabrika için', again.data['message_tr'])
        self.assertIn('120.000 kWh', again.data['message_tr'])
        forced = self.client.post('/api/chat/confirm-entry/', {**pe, 'quantity': 6000, 'year': 2024, 'month': 4,
                                                               'confirm_duplicate': True}, format='json')
        self.assertEqual(forced.status_code, 201)
        # the form gets the same warning; another source does not
        r = self.client.post('/api/emissions/entries/', {'emission_factor': grid.id, 'year': 2024, 'month': 5,
                                                         'quantity': 700}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (409, 'annual_overlap'))
        gas = EmissionFactor.objects.filter(category='stationary_combustion', is_active=True).first()
        r = self.client.post('/api/emissions/entries/', {'emission_factor': gas.id, 'year': 2024, 'month': 5,
                                                         'quantity': 70}, format='json')
        self.assertEqual(r.status_code, 201, r.content)

    def test_unreadable_part_is_named_in_the_reply(self):
        res = self._send('3 ton çelik ve 500 kWh elektrik')
        self.assertEqual(len(res.data['pending_entries']), 1)
        self.assertIn('"3 ton"', res.data['content'])


class LocalDataAnswerTests(TestCase):
    """Without the AI, simple questions about the company's data are answered
    from the database, and the chat speaks the UI language."""

    def setUp(self):
        # The chat's per-user rate limit (20/min) is kept in the cache, and
        # test users share ids across classes: start each test with none used.
        from django.core.cache import cache
        cache.clear()
        from unittest import mock
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        from emissions.models import EmissionFactor, EmissionEntry
        self.user = User.objects.create_user('localq', 'localq@test.com', 'testpass123')
        company = Company.objects.create(
            legal_entity_name='Yerel A.Ş.', tax_number='1234567891',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        UserProfile.objects.create(user=self.user, active_company=company)
        CompanyMembership.objects.create(company=company, user=self.user, role='owner')
        gas = EmissionFactor.objects.create(slug='lq-gas', name='Gas', name_tr='Doğal Gaz', scope='scope1',
                                            category='stationary_combustion', country='turkey', unit='m3',
                                            factor_kg_co2e=2, source='test')
        grid = EmissionFactor.objects.create(slug='lq-grid', name='Grid', name_tr='Şebeke', scope='scope2',
                                             category='electricity', country='turkey', unit='kwh',
                                             factor_kg_co2e=0.5, source='test')
        for f, qty, status in ((gas, 1000, 'approved'), (grid, 1000, 'approved'), (grid, 9000, 'draft')):
            EmissionEntry.objects.create(company=company, user=self.user, emission_factor=f, year=2020, month=1,
                                         quantity=qty, calculated_co2e_kg=qty * float(f.factor_kg_co2e), status=status)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session = ChatSession.objects.create(user=self.user, title='t')
        patcher = mock.patch('chat.views._get_groq_client', return_value=None)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _send(self, text, lang='tr'):
        return self.client.post(f'/api/chat/sessions/{self.session.id}/message/',
                                {'content': text, 'language': lang}, format='json')

    def test_total_for_a_year(self):
        res = self._send('2020 yılı toplam emisyonumuz ne kadar?')
        self.assertEqual(res.status_code, 200)
        # 2 t gas + 0.5 t grid; the rejected 4.5 t is not counted.
        self.assertIn('**2,50 tCO₂e**', res.data['content'])
        self.assertIn('Kapsam 1: 2,00 t', res.data['content'])

    def test_largest_source(self):
        res = self._send('2020 yılında en çok emisyon hangi kaynaktan geliyor?')
        self.assertIn('**Doğal Gaz**', res.data['content'])
        # with the year's total and the next sources, not only the first one
        self.assertIn('toplam emisyonunuz **2,50 tCO₂e**', res.data['content'])
        self.assertIn('2. **', res.data['content'])

    def test_other_questions_get_a_turkish_unavailable_message(self):
        res = self._send('Emisyonlarımızı nasıl azaltabiliriz?')
        self.assertEqual(res.status_code, 503)
        self.assertIn('AI hizmetine şu an ulaşılamıyor', res.data['content'])


class SavedEntryQuestionsTests(MultiItemMessageTests):
    """A month that already holds the source asks before adding a second
    figure; asking to delete or correct points to the page that does it;
    a source's month and the pending list are answered from the data."""

    def _saved(self, qty=4000):
        pe = self._send('Nisan 2024 5.000 kWh elektrik kullandık').data['pending_entries'][0]
        res = self.client.post('/api/chat/confirm-entry/', {**pe, 'quantity': qty, 'year': 2024, 'month': 4},
                               format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return pe, res.data['id']

    def test_another_amount_for_the_same_month_asks_first(self):
        pe, eid = self._saved()
        res = self.client.post('/api/chat/confirm-entry/', {**pe, 'quantity': 3500, 'year': 2024, 'month': 4},
                               format='json')
        self.assertEqual(res.status_code, 409)
        self.assertEqual((res.data['code'], res.data['existing_id'], res.data['new_quantity'], res.data['can_change']),
                         ('same_period', eid, 3500.0, True))
        self.assertIn('4.000 kWh', res.data['message_tr'])
        added = self.client.post('/api/chat/confirm-entry/', {**pe, 'quantity': 3500, 'year': 2024, 'month': 4,
                                                              'confirm_same_period': True}, format='json')
        self.assertEqual(added.status_code, 201)
        other_month = self.client.post('/api/chat/confirm-entry/', {**pe, 'quantity': 3500, 'year': 2024, 'month': 5},
                                       format='json')
        self.assertEqual(other_month.status_code, 201)

    def test_delete_or_correct_request_points_to_the_page(self):
        res = self._send('Mayıs 2024 elektrik kaydını sil')
        self.assertEqual(res.data['source'], 'entry_change_help')
        self.assertIn('silemiyorum', res.data['content'])
        self.assertEqual(res.data['ui']['link']['href'], '/dashboard?tab=emissions&year=2024')
        self.assertEqual(self._send('Nisan kaydını düzeltmek istiyorum').data['source'], 'entry_change_help')
        # a correction with the new figure is data entry
        self.assertTrue(self._send('Nisan 2024 elektrik 4000 değil 3500 kWh').data['pending_entries'])

    def test_source_month_and_pending_list(self):
        self._saved()
        a = self._send('Nisan 2024 elektrik tüketimim ne kadardı?').data['content']
        self.assertIn('**4.000 kWh**', a)
        from emissions.models import EmissionEntry
        EmissionEntry.objects.filter(company=self.user.profile.active_company).update(status='submitted')
        a = self._send('Onay bekleyen kayıtlar neler?').data['content']
        self.assertIn('4.000 kWh · Nisan 2024 — yeni', a)
