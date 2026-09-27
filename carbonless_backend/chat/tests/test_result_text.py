from django.test import SimpleTestCase

from chat.views import _build_pending_entries_text

ENTRY = {
    'scope': 'scope2', 'fuel_type': 'electricity', 'factor_name_tr': 'Türkiye elektrik şebekesi',
    'co2e_kg': 5038.8, 'co2e_tonne': 5.0388, 'factor_source_label': 'Turkey Grid/National',
    'date_extracted': True,
}


class ResultTextLanguageTest(SimpleTestCase):
    def test_turkish_text_uses_turkish_name_labels_and_numbers(self):
        text = _build_pending_entries_text([ENTRY], 'tr')
        self.assertIn('Kapsam 2: Türkiye elektrik şebekesi sonucu', text)
        self.assertIn('5.038,80 kgCO₂e', text)
        self.assertIn('Kaynak: Kayıtlı faktör — Turkey Grid/National', text)

    def test_english_is_unchanged(self):
        text = _build_pending_entries_text([ENTRY])
        self.assertIn('Scope 2: Electricity result', text)
        self.assertIn('5,038.80 kgCO₂e', text)

    def test_period_note_follows_language(self):
        entry = {**ENTRY, 'date_extracted': False}
        self.assertIn('Dönem: bu ay', _build_pending_entries_text([entry], 'tr'))
        self.assertIn('Period: current month', _build_pending_entries_text([entry], 'en'))
