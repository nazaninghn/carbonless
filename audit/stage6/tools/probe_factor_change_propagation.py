from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from emissions.models import EmissionEntry, EmissionFactor
from . import tests as _base
from .models import CarbonReport
from .step_entries import resync_inventory


class Probe(TestCase):
    def setUp(self):
        _base.StepEntriesTests.setUp(self)
        call_command('seed_factors', verbosity=0)
        self.f = EmissionFactor.objects.get(slug='natural-gas-m3', country='turkey')

    def step(self, sid, ans):
        cache.clear()
        return _base.StepEntriesTests._step(self, sid, ans)

    def rows(self):
        return sorted((e.emission_factor.slug, e.emission_factor_id, float(e.quantity), round(float(e.calculated_co2e_kg), 2), e.status)
                      for e in EmissionEntry.objects.filter(company=self.company, year=2025, description__startswith='Questionnaire step 3A-5'))

    def show(self, label):
        print('PROBE', label, self.rows())

    def lock(self):
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED, signed_at=timezone.now())
        self.report.refresh_from_db()

    def test_in_place_edit(self):
        self.step('3A-5', {'natural_gas': '10000 m³', 'diesel': '1.000 litre'}); self.show('A0 baseline (draft)')
        EmissionFactor.objects.filter(pk=self.f.pk).update(factor_kg_co2e='2.14288')
        resync_inventory(self.company, 2025, self.user); self.show('A1 after in-place edit + resync_inventory')
        self.step('3A-5', {'natural_gas': '10000 m³', 'diesel': '1.000 litre'}); self.show('A2 same answer saved again')
        self.step('3A-5', {'natural_gas': '10000 m³', 'diesel': '2.000 litre'}); self.show('A3 diesel changed (gas untouched)')
        self.step('3A-5', {'natural_gas': '11000 m³', 'diesel': '2.000 litre'}); self.show('A4 gas quantity changed')

    def test_in_place_edit_on_a_signed_inventory(self):
        self.step('3A-5', {'natural_gas': '10000 m³', 'diesel': '1.000 litre'}); self.lock()
        EmissionFactor.objects.filter(pk=self.f.pk).update(factor_kg_co2e='2.14288')
        self.step('3A-5', {'natural_gas': '10000 m³', 'diesel': '2.000 litre'}); self.show('B1 signed, in-place edit, unrelated diesel edit')
        self.report.refresh_from_db(); print('PROBE B1 flagged edited_after_signing:', self.report.edited_after_signing_at is not None)

    def test_new_version_row_same_year_as_inventory(self):
        EmissionFactor.objects.filter(pk=self.f.pk).update(is_default=False)
        self.step('3A-5', {'natural_gas': '10000 m³', 'diesel': '1.000 litre'}); self.show('C0 baseline')
        EmissionFactor.objects.filter(pk=self.f.pk).update(is_default=True)
        new = EmissionFactor.objects.create(slug='natural-gas-m3', country='turkey', year=2025, name=self.f.name, scope=self.f.scope, category=self.f.category,
                                            unit=self.f.unit, factor_kg_co2e='2.14288', source='defra_2024', is_active=True, is_default=True)
        print('PROBE C pick for 2025 ->', new.id, 'old', self.f.id)
        self.lock()
        self.step('3A-5', {'natural_gas': '10000 m³', 'diesel': '2.000 litre'}); self.show('C1 signed, NEW version row (year 2025), unrelated diesel edit')
        self.report.refresh_from_db(); print('PROBE C1 flagged edited_after_signing:', self.report.edited_after_signing_at is not None)

    def test_new_version_row_for_a_later_year(self):
        self.step('3A-5', {'natural_gas': '10000 m³', 'diesel': '1.000 litre'}); self.lock()
        EmissionFactor.objects.create(slug='natural-gas-m3', country='turkey', year=2026, name=self.f.name, scope=self.f.scope, category=self.f.category,
                                      unit=self.f.unit, factor_kg_co2e='2.14288', source='defra_2024', is_active=True, is_default=True)
        self.step('3A-5', {'natural_gas': '10000 m³', 'diesel': '2.000 litre'}); self.show('D1 signed 2025, NEW row year 2026, unrelated edit')
