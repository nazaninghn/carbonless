"""Calculation regression guard for the multi-inventory work.

The multi-inventory change may only change WHICH records feed the calculation engine, never the numbers it
produces. This module runs one fixed scenario (known inputs -> real questionnaire API -> summary endpoint and
ISO-report data) and reduces it to a plain dict.

* CALC_BASELINE_OUT=<file>  writes that dict (run it on the code BEFORE a change);
* CALC_BASELINE_CMP=<file>  asserts the dict equals the stored one, exactly;
* neither set: asserts the documented regression numbers only.

`scenario_numbers(client, report, ...)` is reused by test_multi_inventory so that every one of several
same-year inventories fed the same inputs must reproduce the same numbers.
"""
import json
import os

from django.contrib.auth.models import User

from companies.models import Company, CompanyMembership
from emissions.models import EmissionEntry, EmissionFactor
from questionnaire import tests as _base
from questionnaire.models import CarbonReport

SITES = {'1': {'name': 'Gebze', 'country': 'TR', 'grid_connection': 'distribution'}}


def make_factors():
    """The fixed factor values of the scenario (the project's regression guards)."""
    def f(slug, unit, value, scope, country='global'):
        EmissionFactor.objects.update_or_create(
            slug=slug, country=country, year=2024,
            defaults=dict(name=slug, scope=scope, category='x', unit=unit, factor_kg_co2e=value,
                          source='test', is_active=True, is_default=True))
    f('natural-gas-m3', 'm3', 2.02, 'scope1')
    f('diesel', 'liters', 3.0, 'scope1')
    f('tm-01', 'tonne-km', 0.062, 'scope3')
    EmissionFactor.objects.filter(slug__in=['turkey-grid-transmission', 'turkey-grid-distribution']).update(
        factor_kg_co2e=0.4199)


def post_scenario(client, report, gas='10000 m³', kwh='50000 kWh'):
    def step(step_id, answer):
        r = client.patch(f'/api/questionnaire/{report.id}/step/',
                         {'step': step_id, 'data': {'answer': answer}}, format='json')
        assert r.status_code == 200, r.content
    step('2A-2', SITES)
    step('3A-5', {'natural_gas': gas, 'diesel': '1.000 litre'})
    step('4A-1', {'1': kwh})
    step('K3C4-2', {'items': [{'transport_mode': 'TM-01', 'load_tonne': '5', 'distance_km': '100'}], 'draft': {}})


def _r(x):
    return None if x is None else round(float(x), 6)


def summary_numbers(payload):
    keys = ('total_kg', 'scope1_kg', 'scope2_kg', 'scope3_kg', 'annual_kg', 'unassigned_kg')
    out = {k: _r(payload[k]) for k in keys}
    out['by_category'] = sorted((c['category'], _r(c['total_kg'])) for c in payload['by_category'])
    out['scope3_by_category'] = [(c['category'], _r(c['total_co2e_kg'])) for c in payload['scope3_by_category']]
    out['monthly'] = [_r(m['total_kg']) for m in payload['monthly']]
    return out


def iso_numbers(report):
    from questionnaire.iso_report_pdf import _gather
    g = _gather(report, 'en')
    return {'total_kg': _r(g['total_kg']),
            'by_scope': sorted((k, _r(v)) for k, v in g['by_scope'].items()),
            'by_category': sorted((str(k), _r(v)) for k, v in g['by_category'].items()),
            'entry_count': g['entry_count'],
            'sources': sorted((s['iso_cat'] if isinstance(s['iso_cat'], str) else str(s['iso_cat']), _r(s['kg']))
                              for s in g['sources'])}


def factor_digest():
    """A digest of the whole emission-factor dataset (every factor, unit, scope, value and source): the
    factor tables must be byte-for-byte what they were before the multi-inventory work."""
    import hashlib
    rows = sorted((f.slug, f.country, f.year, f.unit, f.scope, f.category, str(f.factor_kg_co2e), f.source,
                   bool(f.is_active), bool(f.is_default))
                  for f in EmissionFactor.objects.all())
    return {'count': len(rows), 'sha256': hashlib.sha256(json.dumps(rows, default=str).encode()).hexdigest()}


def entry_numbers(qs):
    return sorted((e.emission_factor.slug, _r(e.quantity), _r(e.calculated_co2e_kg), e.status)
                  for e in qs.select_related('emission_factor'))


class CalcBaselineTests(_base.TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.user = User.objects.create_user('cb', 'cb@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Baseline Co', tax_number='7', country_of_headquarters='TR',
            countries_of_operation='TR', nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        make_factors()

    def test_scenario_matches_baseline(self):
        post_scenario(self.client, self.report)
        resp = self.client.get('/api/emissions/summary/?year=2025')
        self.assertEqual(resp.status_code, 200)
        got = {'entries': entry_numbers(EmissionEntry.objects.filter(company=self.company)),
               'summary': summary_numbers(resp.data),
               'iso': iso_numbers(self.report),
               'factors': factor_digest()}
        # documented regression guards
        self.assertEqual(_r(resp.data['scope1_kg']), 20200.0 + 3000.0)   # 10 000 m3 gas + 1 000 l diesel
        self.assertAlmostEqual(resp.data['scope2_kg'], 50000 * 0.4199, places=3)   # 20 995 kg
        out, cmp_ = os.environ.get('CALC_BASELINE_OUT'), os.environ.get('CALC_BASELINE_CMP')
        if out:
            with open(out, 'w', encoding='utf-8') as fh:
                json.dump(got, fh, sort_keys=True, indent=1)
        if cmp_:
            with open(cmp_, encoding='utf-8') as fh:
                want = json.load(fh)
            self.assertEqual(json.loads(json.dumps(got)), want)
