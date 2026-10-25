"""Phase 1 label-only release (audit/stage6/label_changes.csv).

Proves that correcting factor source labels moves no number:
  * every non-label field of every seeded factor equals the frozen pre-release baseline
    (seed_non_label_baseline.json: value, unit, slug, source, year, scope, category, method, ...);
  * exactly the approved factors changed their `reference` text, each in English and Turkish;
  * re-seeding the new labels over a database seeded with the old ones updates rows in place
    (same ids, same values, same per-gas splits, no new rows);
  * the calculator returns the same numbers with the old and the new label;
  * an existing entry keeps its calculated kg, value snapshot and source snapshot, and the company's year total is identical.
"""
import json
import os
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase

from accounts.models import UserProfile
from companies.models import Company, CompanyMembership
from . import seed_data
from .calculator import calculate_by_slug, calculate_emissions
from .models import EmissionEntry, EmissionFactor

HERE = os.path.dirname(__file__)
BASELINE = json.load(open(os.path.join(HERE, 'seed_non_label_baseline.json'), encoding='utf-8'))
REFS_BEFORE = json.load(open(os.path.join(HERE, 'seed_references_before.json'), encoding='utf-8'))

# The approved Phase 1 set: (slug, country). Source: audit/stage6/label_changes.csv
APPROVED = {
    ('natural-gas-m3', 'global'), ('natural-gas-m3', 'turkey'), ('cement-clinker', 'global'), ('ferry-travel', 'global'),
    ('fuel-extraction', 'global'), ('car-commute', 'global'), ('product-fuel-use', 'global'), ('gasoline-generic', 'global'),
    ('diesel-generic', 'global'), ('vehicle-km', 'global'), ('taxi', 'global'), ('off-road-gasoline-desnz', 'global'),
    ('on-road-petrol-desnz', 'global'), ('diesel-kwh', 'global'), ('cleaning-services', 'global'), ('food-catering', 'global'),
    ('it-telecom-services', 'global'), ('legal-accounting', 'global'), ('marketing-advertising', 'global'),
    ('r134a', 'global'), ('r32', 'global'), ('r22', 'global'), ('r410a', 'global'), ('r404a', 'global'),
    ('hfc-227ea', 'global'), ('sf6', 'global'),
}


def _key(fd):
    return fd['slug'], fd.get('country', 'global')


def _old_catalog():
    """The pre-release catalog: today's non-label fields with yesterday's reference text."""
    out = []
    for fd, ref in zip(seed_data.EMISSION_FACTORS, REFS_BEFORE):
        d = dict(fd)
        if 'reference' in d or ref:
            d['reference'] = ref
        out.append(d)
    return out


class LabelOnlyCatalogTests(TestCase):
    def test_every_non_label_field_equals_the_frozen_baseline(self):
        now = []
        for fd in seed_data.EMISSION_FACTORS:
            d = {k: (str(v) if not isinstance(v, (str, int, bool, type(None))) else v) for k, v in fd.items() if k != 'reference'}
            d['factor_kg_co2e'] = str(fd['factor_kg_co2e'])
            now.append(d)
        self.assertEqual(len(now), len(BASELINE))
        self.assertEqual(json.loads(json.dumps(now, sort_keys=True)), BASELINE)

    def test_exactly_the_approved_labels_changed(self):
        changed = {_key(fd) for fd, ref in zip(seed_data.EMISSION_FACTORS, REFS_BEFORE) if fd.get('reference', '') != ref}
        self.assertEqual(changed, APPROVED)

    def test_every_new_label_is_bilingual_and_non_empty(self):
        for fd in seed_data.EMISSION_FACTORS:
            if _key(fd) in APPROVED:
                ref = fd['reference']
                self.assertIn(' / ', ref, fd['slug'])                       # "English / Türkçe"
                en, tr = ref.split(' / ', 1)
                self.assertTrue(en.strip() and tr.strip(), fd['slug'])
                self.assertTrue(any(c in tr for c in 'çğıöşüÇĞİÖŞÜ') or ',' in tr or tr.isascii(), fd['slug'])

    def test_no_new_label_still_claims_a_source_the_evidence_rejects(self):
        refs = {_key(fd): fd['reference'] for fd in seed_data.EMISSION_FACTORS}
        self.assertNotIn('DEFRA 2024 –', refs[('natural-gas-m3', 'global')])
        self.assertIn('not a DEFRA 2024 factor', refs[('natural-gas-m3', 'global')])
        self.assertIn('Eq. 2.4 gives 520', refs[('cement-clinker', 'global')])
        self.assertTrue(refs[('cement-clinker', 'global')].startswith('525'))
        for slug in ('cleaning-services', 'food-catering', 'it-telecom-services', 'legal-accounting', 'marketing-advertising'):
            self.assertNotIn('DEFRA 2024', refs[(slug, 'global')].replace('DESNZ 2024 workbook', ''))
        for slug in ('r134a', 'r32', 'r22', 'r410a', 'r404a'):
            self.assertIn('AR4', refs[(slug, 'global')])
            self.assertNotIn('AR6 GWP100', refs[(slug, 'global')])
        self.assertIn('AR5', refs[('hfc-227ea', 'global')])
        self.assertIn('Table 7.SM.7', refs[('sf6', 'global')])
        self.assertNotIn('GHG Protocol – Scope', ' '.join(refs[(s, 'global')] for s in ('fuel-extraction', 'car-commute', 'product-fuel-use')).replace('not a GHG Protocol factor', ''))


class LabelOnlyDatabaseTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            legal_entity_name='Label Co', tax_number='910', country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        self.user = User.objects.create_user('labeluser', 'l@test.com', 'testpass123')
        UserProfile.objects.create(user=self.user, active_company=self.company)
        CompanyMembership.objects.create(company=self.company, user=self.user, role='owner')

    @staticmethod
    def _snapshot():
        return {(f.slug, f.country, f.year): {k: getattr(f, k) for k in (
            'id', 'unit', 'factor_kg_co2e', 'source', 'scope', 'category', 'method', 'is_active', 'is_default', 'valid_until',
            'gas_split_basis', 'co2_kg', 'ch4_kg', 'n2o_kg', 'hfc_kg', 'pfc_kg', 'sf6_kg', 'nf3_kg') if hasattr(f, k)}
            for f in EmissionFactor.objects.all()}

    def _seed_old_then_new(self):
        with mock.patch('emissions.management.commands.seed_factors.EMISSION_FACTORS', _old_catalog()):
            call_command('seed_factors', verbosity=0)
        call_command('seed_gas_splits', verbosity=0)
        return self._snapshot()

    def test_reseeding_new_labels_updates_rows_in_place(self):
        old = self._seed_old_then_new()
        call_command('seed_factors', verbosity=0)                      # the new labels
        call_command('seed_gas_splits', verbosity=0)
        new = self._snapshot()
        self.assertEqual(set(new), set(old))                           # no row added or removed
        self.assertEqual(new, old)                                     # ids, values, units, sources, years, splits identical
        refs = {(f.slug, f.country): f.reference for f in EmissionFactor.objects.all()}
        for key in APPROVED:
            self.assertIn(' / ', refs[key])

    def test_factor_selection_is_identical_for_every_slug_country_and_year(self):
        from .factor_lookup import pick_factor
        self._seed_old_then_new()
        keys = sorted({(f.slug, f.country) for f in EmissionFactor.objects.all()})

        def picks():
            return {(s, c, y): (lambda f: (f.id, f.year, str(f.factor_kg_co2e)) if f else None)(pick_factor(s, c, y))
                    for s, c in keys for y in (None, 2005, 2019, 2023, 2024, 2025, 2026, 2030)}
        before = picks()
        call_command('seed_factors', verbosity=0)                      # the new labels
        self.assertEqual(picks(), before)
        self.assertEqual(len(before), len(keys) * 8)

    def test_calculator_returns_the_same_numbers_under_the_old_and_the_new_label(self):
        self._seed_old_then_new()
        probes = {(s, c): EmissionFactor.objects.get(slug=s, country=c) for (s, c) in APPROVED}
        before = {k: calculate_emissions(f.id, 1234.5678, f.unit) for k, f in probes.items()}
        call_command('seed_factors', verbosity=0)
        after = {k: calculate_emissions(f.id, 1234.5678, f.unit) for k, f in probes.items()}
        for k in APPROVED:
            b, a = dict(before[k]), dict(after[k])
            b.pop('reference', None); a.pop('reference', None)
            self.assertEqual(a, b, k)
            self.assertNotEqual(before[k].get('reference'), after[k].get('reference'), k)

    def test_regression_guards_hold(self):
        call_command('seed_factors', verbosity=0)
        for country in ('global', 'turkey'):
            gas = calculate_by_slug('natural-gas-m3', country, 'stationary_combustion', 10000)
            self.assertEqual(Decimal(str(gas['emissions_kg'])), Decimal('20200'), country)    # 10,000 m³ = 20.2 t

    def test_existing_entries_and_year_totals_are_untouched_by_relabelling(self):
        self._seed_old_then_new()
        entries = []
        for (slug, country) in sorted(APPROVED):
            f = EmissionFactor.objects.get(slug=slug, country=country)
            entries.append(EmissionEntry.objects.create(
                user=self.user, company=self.company, emission_factor=f, year=2025, month=3,
                quantity=Decimal('137.25'), status='approved'))
        def state():
            return [(e.id, e.emission_factor_id, e.quantity, e.calculated_co2e_kg, e.factor_value_snapshot, e.factor_source_snapshot)
                    for e in EmissionEntry.objects.filter(company=self.company).order_by('id')]
        total = lambda: sum(e.calculated_co2e_kg for e in EmissionEntry.objects.filter(company=self.company, year=2025))
        s0, t0 = state(), total()
        call_command('seed_factors', verbosity=0)                      # apply the new labels
        self.assertEqual(state(), s0)                                  # snapshot rows byte-identical (incl. old source snapshot)
        self.assertEqual(total(), t0)
        for e in EmissionEntry.objects.filter(company=self.company):   # even a re-save (which recomputes qty x factor) gives the same kg
            kg = e.calculated_co2e_kg
            e.save()
            e.refresh_from_db()
            self.assertEqual(e.calculated_co2e_kg, kg)
        self.assertEqual(total(), t0)
