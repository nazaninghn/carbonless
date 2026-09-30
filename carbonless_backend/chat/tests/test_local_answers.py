from datetime import datetime, timezone

from django.contrib.auth.models import User
from django.test import TestCase

from chat.local_answers import local_data_answer


class LocalAnswerTests(TestCase):
    """Database answers used when the AI is unavailable: month, scope and
    year-on-year questions get the matching figure, not the year total."""

    def setUp(self):
        from accounts.models import UserProfile
        from companies.models import Company, CompanyMembership
        from emissions.models import EmissionEntry, EmissionFactor
        self.year = datetime.now(timezone.utc).year
        company = Company.objects.create(
            legal_entity_name='Yerel A.Ş.', tax_number='1234567890', country_of_headquarters='TR',
            countries_of_operation='TR', main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1)
        self.user = User.objects.create_user('local', 'local@test.com', 'testpass123')
        UserProfile.objects.create(user=self.user, active_company=company)
        CompanyMembership.objects.create(company=company, user=self.user, role='owner')
        gas = EmissionFactor.objects.create(slug='la-gas', name='Gas', name_tr='Gaz', scope='scope1',
                                            category='stationary_combustion', unit='m3', factor_kg_co2e=2,
                                            source='generic')
        grid = EmissionFactor.objects.create(slug='la-grid', name='Grid', name_tr='Şebeke', scope='scope2',
                                             category='electricity', unit='kwh', factor_kg_co2e=0.5,
                                             source='generic')
        mk = lambda f, year, month, kg: EmissionEntry.objects.create(
            user=self.user, company=company, emission_factor=f, year=year, month=month,
            quantity=kg / float(f.factor_kg_co2e), status='approved')  # saved kg = quantity × factor
        mk(gas, self.year, 1, 3000)     # January: 3 t scope 1
        mk(grid, self.year, 1, 1000)    # January: 1 t scope 2
        mk(gas, self.year - 1, 1, 8000)  # last year: 8 t

    def ask(self, q, lang='tr'):
        return local_data_answer(self.user, q, lang)

    def test_month_question_gets_that_month(self):
        a = self.ask(f'Ocak {self.year} ayında ne kadar emisyon var?')
        self.assertIn(f'Ocak {self.year} emisyonunuz **4,00 tCO₂e**', a)
        self.assertIn('Şubat', self.ask(f'Şubat {self.year} emisyonumuz ne kadar?'))

    def test_scope_question_gets_that_scope(self):
        a = self.ask('Kapsam 2 emisyonumuz ne kadar?')
        self.assertIn('Kapsam 2 emisyonunuz **1,00 tCO₂e**', a)
        self.assertIn('%25,0', a)

    def test_year_on_year(self):
        a = self.ask('Geçen yıla göre durumumuz nasıl?')
        self.assertIn('**4,00 tCO₂e**', a)
        self.assertIn('8,00 tCO₂e', a)
        self.assertIn('%50,0 azaldı', a)
        self.assertIn('down 50.0%', self.ask('How are we doing compared to last year?', 'en'))

    def test_plain_total_is_unchanged(self):
        self.assertIn(f'{self.year} yılı toplam emisyonunuz **4,00 tCO₂e**',
                      self.ask('Toplam emisyonumuz ne kadar?'))
