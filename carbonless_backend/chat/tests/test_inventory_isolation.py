"""The chat assistant answers from ONE inventory.

Several inventories can share a reporting year. The assistant's database answers, its prompt context and
the part of the conversation sent to the model must hold only the active inventory's records — never a
sibling's of the same year. Selection only: no amount is calculated here (the figures are the stored
entries, exactly as the dashboard reads them).
"""
from datetime import datetime, timezone
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import UserProfile
from companies.models import Company, CompanyMembership
from emissions.models import EmissionEntry, EmissionFactor
from questionnaire.models import CarbonReport

from chat.local_answers import local_data_answer, direct_data_answer
from chat.models import ChatSession
from chat.views import _get_emission_data_context, _get_inventory_context, _get_user_emission_context

YEAR = datetime.now(timezone.utc).year


def _company(name, tax):
    return Company.objects.create(
        legal_entity_name=name, tax_number=tax, country_of_headquarters='TR', countries_of_operation='TR',
        main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)


class ChatInventoryIsolationTests(TestCase):

    def setUp(self):
        self.company = _company('Chat A.Ş.', '1111111111')
        self.user = User.objects.create_user('chatiso', 'chatiso@test.com', 'testpass123')
        UserProfile.objects.create(user=self.user, active_company=self.company)
        CompanyMembership.objects.create(company=self.company, user=self.user, role='owner')
        self.gas = EmissionFactor.objects.create(
            slug='ci-gas', name='Gas', name_tr='Gaz', scope='scope1', category='stationary_combustion',
            unit='m3', factor_kg_co2e=1, source='generic')
        mk = lambda title: CarbonReport.objects.create(
            company=self.company, created_by=self.user, reporting_year=YEAR, title=title)
        self.a, self.b, self.c = mk('Alpha'), mk('Bravo'), mk('Charlie')
        for inv, kg in ((self.a, 1000), (self.b, 5000), (self.c, 9000)):
            EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.gas, year=YEAR,
                                         month=1, quantity=kg, status='approved', inventory=inv,
                                         description=f'Questionnaire step 3A-1 · {inv.title}')
        # another company's inventory of the same year, with a figure of its own
        other = _company('Other A.Ş.', '2222222222')
        ou = User.objects.create_user('chatother', 'chatother@test.com', 'testpass123')
        self.foreign = CarbonReport.objects.create(company=other, created_by=ou, reporting_year=YEAR, title='Foreign')
        EmissionEntry.objects.create(user=ou, company=other, emission_factor=self.gas, year=YEAR, month=1,
                                     quantity=77000, status='approved', inventory=self.foreign)

    # ── database answers ────────────────────────────────────────────────────
    def test_each_inventory_is_answered_from_its_own_records_only(self):
        for inv, text in ((self.a, '1,00'), (self.b, '5,00'), (self.c, '9,00')):
            a = local_data_answer(self.user, f'{YEAR} toplam emisyonumuz ne kadar?', 'tr', inv)
            self.assertIn(f'**{text} tCO₂e**', a)
            for other in ('1,00', '5,00', '9,00', '77,00'):
                if other != text:
                    self.assertNotIn(f'**{other} tCO₂e**', a)

    def test_a_year_with_several_inventories_and_none_active_asks_for_a_choice(self):
        a = local_data_answer(self.user, f'{YEAR} toplam emisyonumuz ne kadar?', 'tr')
        self.assertIn('birden fazla envanter', a)
        self.assertNotRegex(a, r'\d,00 tCO₂e')
        en = local_data_answer(self.user, f'what are our total emissions in {YEAR}?', 'en')
        self.assertIn('Several inventories exist', en)

    def test_scope_top_source_and_month_answers_are_scoped(self):
        self.assertIn('**5,00 tCO₂e**', local_data_answer(self.user, f'{YEAR} kapsam 1 emisyonumuz ne kadar?', 'tr', self.b))
        self.assertIn('**9,00 tCO₂e**', local_data_answer(self.user, f'{YEAR} en büyük kaynak emisyon', 'tr', self.c))
        # Questionnaire rows are annual amounts: a month answer names them in a note instead of summing them
        month = local_data_answer(self.user, f'Ocak {YEAR} ayında ne kadar emisyon var?', 'tr', self.a)
        self.assertIn('Ocak', month)
        self.assertIn('(1,00 tCO₂e)', month)
        for other in ('5,00', '9,00', '77,00'):
            self.assertNotIn(other, month)

    def test_a_question_about_another_year_with_several_inventories_does_not_borrow_the_active_one(self):
        for inv in (self.a, self.b):
            CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=YEAR - 1, title=f'old {inv.title}')
        a = local_data_answer(self.user, f'{YEAR - 1} toplam emisyonumuz ne kadar?', 'tr', self.a)
        self.assertIn('birden fazla envanter', a)

    def test_a_year_with_one_inventory_reads_exactly_as_before(self):
        only = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=YEAR - 2, title='only')
        EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.gas, year=YEAR - 2,
                                     month=3, quantity=2000, status='approved')          # an unassigned row: read by the sole inventory
        for inv in (None, self.a):    # active inventory of ANOTHER year does not matter: the year has only one
            a = local_data_answer(self.user, f'{YEAR - 2} toplam emisyonumuz ne kadar?', 'tr', inv)
            self.assertIn('**2,00 tCO₂e**', a)
        self.assertIsNotNone(only.pk)

    def test_pending_approvals_are_those_of_the_active_inventory(self):
        EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.gas, year=YEAR, month=2,
                                     quantity=10, status='submitted', inventory=self.a, description='waiting A')
        EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.gas, year=YEAR, month=2,
                                     quantity=20, status='submitted', inventory=self.b, description='waiting B')
        a = direct_data_answer(self.user, 'onay bekleyen kayıt var mı', 'tr', self.a)
        self.assertIn('1 emisyon kaydı', a)
        company_wide = direct_data_answer(self.user, 'onay bekleyen kayıt var mı', 'tr')
        self.assertIn('2 emisyon kaydı', company_wide)

    # ── the AI prompt context ───────────────────────────────────────────────
    def test_prompt_context_holds_only_the_active_inventory(self):
        ctx = _get_user_emission_context(self.user, self.b)
        self.assertIn('TOTAL EMISSIONS: 5.000 tCO2e', ctx)          # 5000 kg
        self.assertIn('Bravo', ctx)
        for other in ('Alpha', 'Charlie', 'Foreign', '1.000 tCO2e', '9.000 tCO2e', '77.000'):
            self.assertNotIn(other, ctx)
        self.assertIn('2 other inventories', ctx)

    def test_prompt_context_without_a_choice_gives_no_figures_for_a_shared_year(self):
        ctx = _get_emission_data_context(self.user)
        self.assertIn('Several inventories exist', ctx)
        self.assertNotIn('TOTAL EMISSIONS', ctx)

    def test_prompt_context_never_falls_back_to_another_inventorys_year(self):
        empty = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=YEAR - 5, title='Empty')
        EmissionEntry.objects.create(user=self.user, company=self.company, emission_factor=self.gas, year=YEAR - 6,
                                     month=1, quantity=4000, status='approved')
        ctx = _get_emission_data_context(self.user, empty)
        self.assertIn('No emission entries recorded yet', ctx)
        self.assertNotIn('TOTAL EMISSIONS', ctx)

    def test_inventory_context_lists_only_the_active_one(self):
        text = _get_inventory_context(self.company, self.c)
        self.assertIn('Charlie', text)
        self.assertNotIn('Alpha', text)
        self.assertNotIn('Bravo', text)

    # ── the chat endpoint ───────────────────────────────────────────────────
    def _client(self):
        c = APIClient()
        c.force_authenticate(self.user)
        return c

    def _session(self):
        return ChatSession.objects.create(user=self.user, company=self.company)

    def test_endpoint_answers_for_the_named_inventory_and_refuses_a_foreign_one(self):
        s = self._session()
        c = self._client()
        with mock.patch('chat.views._get_groq_client', return_value=None):
            r = c.post(f'/api/chat/sessions/{s.id}/message/',
                       {'content': f'{YEAR} toplam emisyonumuz ne kadar?', 'language': 'tr', 'inventory_id': self.b.id},
                       format='json')
            self.assertEqual(r.status_code, 200, r.content)
            self.assertIn('**5,00 tCO₂e**', r.data['content'])
            s.refresh_from_db()
            self.assertEqual(s.inventory_id, self.b.id)
            for bad in (self.foreign.id, 999999, 'abc'):
                r = c.post(f'/api/chat/sessions/{s.id}/message/',
                           {'content': 'x', 'language': 'tr', 'inventory_id': bad}, format='json')
                self.assertEqual(r.status_code, 400, (bad, r.content))
            # no inventory named: the shared year is not answered with a blend
            r = c.post(f'/api/chat/sessions/{s.id}/message/',
                       {'content': f'{YEAR} toplam emisyonumuz ne kadar?', 'language': 'tr'}, format='json')
            self.assertIn('birden fazla envanter', r.data['content'])

    def test_switching_inventory_stops_sending_the_earlier_turns_to_the_model(self):
        s = self._session()
        c = self._client()
        seen = []

        def fake_call(history, ctx='', lang=None):
            seen.append(([m['content'] for m in history], ctx))
            return 'ok', None, 200

        with mock.patch('chat.views._get_groq_client', return_value=object()), \
                mock.patch('chat.views._call_groq', side_effect=fake_call):
            for text, inv in (('hello first', self.a), ('hello second', self.a), ('hello third', self.b)):
                r = c.post(f'/api/chat/sessions/{s.id}/message/',
                           {'content': text, 'language': 'en', 'inventory_id': inv.id}, format='json')
                self.assertEqual(r.status_code, 200, r.content)
        # same inventory: the conversation is remembered
        self.assertIn('hello first', seen[1][0])
        # switched to another inventory: nothing said under the first one is sent
        self.assertEqual(seen[2][0], ['hello third'])
        self.assertIn('Bravo', seen[2][1])
        self.assertNotIn('Alpha', seen[2][1])
        # the transcript itself is kept for the user
        self.assertEqual(s.messages.filter(role='user').count(), 3)
