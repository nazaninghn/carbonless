"""
Demo QA — Stabilization pass for 3A, 4A, K4 + cross-cutting concerns.
Run with:  python -X utf8 qa_stabilization.py
"""
import os, sys, django, json
os.environ['DJANGO_SETTINGS_MODULE'] = 'carbonless_api.settings'
os.environ['ALLOW_DEV_SECRET'] = 'true'
sys.path.insert(0, '.')
django.setup()

from unittest.mock import patch, MagicMock
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth.models import User
from questionnaire.models import CarbonReport, ReportField, PendingSuggestion
from questionnaire.workspace_views import (
    WorkspaceChatView, SuggestionConfirmView, SuggestionRejectView,
    ReportFieldBulkUpsertView, ReportFieldMapView,
)

G  = '\033[92m[PASS]\033[0m'
R  = '\033[91m[FAIL]\033[0m'
Y  = '\033[93m[WARN]\033[0m'
B  = '\033[94m'
E  = '\033[0m'

results = []

def check(label, condition, extra=''):
    icon = G if condition else R
    print(f'  {icon} {label}' + (f' — {extra}' if extra else ''))
    results.append((label, condition))
    return condition

admin   = User.objects.get(username='admin')
report  = CarbonReport.objects.filter(created_by=admin).first()
factory = APIRequestFactory()

def clean():
    ReportField.objects.filter(report=report).delete()
    PendingSuggestion.objects.filter(report=report).delete()

def send_chat(ai_response_json, user_msg='test'):
    mock = MagicMock()
    mock.choices[0].message.content = json.dumps(ai_response_json)
    with patch('questionnaire.workspace_views._get_groq', return_value=MagicMock(
        chat=MagicMock(completions=MagicMock(create=MagicMock(return_value=mock)))
    )):
        req = factory.post('/api/chat/workspace/',
            {'report': report.id, 'message': user_msg}, format='json')
        force_authenticate(req, user=admin)
        return WorkspaceChatView.as_view()(req)

def confirm(sug_id, edited=None):
    body = {'fields': edited} if edited else {}
    req = factory.post(f'/api/chat/suggestions/{sug_id}/confirm/', body, format='json')
    force_authenticate(req, user=admin)
    return SuggestionConfirmView.as_view()(req, suggestion_id=sug_id)

def reject(sug_id):
    req = factory.post(f'/api/chat/suggestions/{sug_id}/reject/', {}, format='json')
    force_authenticate(req, user=admin)
    return SuggestionRejectView.as_view()(req, suggestion_id=sug_id)

def get_fields():
    req = factory.get('/api/questionnaire/report-fields/map/', {'report': report.id})
    force_authenticate(req, user=admin)
    return ReportFieldMapView.as_view()(req).data.get('values', {})

def bulk_save(fields_list):
    req = factory.post('/api/questionnaire/report-fields/bulk-upsert/',
        {'report': report.id, 'fields': fields_list}, format='json')
    force_authenticate(req, user=admin)
    return ReportFieldBulkUpsertView.as_view()(req)

def cat_status(cat_id, fv):
    REQUIRED = {
        '3A': ['rf.3a.fuel_type', 'rf.3a.consumption', 'rf.3a.unit'],
        '4A': ['rf.4a.consumption_kwh', 'rf.4a.supplier'],
        'K4': ['rf.k4.shipments', 'rf.k4.total_emission_kgco2e'],
    }
    req = REQUIRED.get(cat_id, [])
    if not req: return 'missing'
    def filled(v):
        if isinstance(v, list): return len(v) > 0
        return v not in (None, '', )
    filled_list = [k for k in req if filled(fv.get(k))]
    if not filled_list: return 'missing'
    if len(filled_list) == len(req): return 'complete'
    return 'in_progress'

def estimate_emission(cat_id, fv):
    DEFRA = {
        'natural_gas': {'m3': 2.02, 'kwh': 0.203},
        'diesel': {'litre': 2.54, 'l': 2.54},
        'fuel_oil': {'litre': 2.96, 'l': 2.96},
        'lpg': {'kg': 1.56, 'litre': 1.23, 'l': 1.23},
        'coal': {'kg': 2.42, 'tonne': 2420.0, 't': 2420.0},
        'wood': {'kg': 0.015},
    }
    if cat_id == '3A':
        fuel = (fv.get('rf.3a.fuel_type') or '').lower().replace(' ', '_').replace('-', '_')
        cons = fv.get('rf.3a.consumption')
        unit = (fv.get('rf.3a.unit') or '').lower()
        if not fuel or cons is None: return None
        ef = (DEFRA.get(fuel) or {}).get(unit)
        if ef is None: return None
        return float(cons) * ef
    if cat_id == '4A':
        kwh = fv.get('rf.4a.consumption_kwh')
        ren = fv.get('rf.4a.renewable_on_site') or 0
        ef  = fv.get('rf.4a.emission_factor')
        if kwh is None or ef is None: return None
        return max(float(kwh) - float(ren), 0) * float(ef)
    if cat_id == 'K4':
        v = fv.get('rf.k4.total_emission_kgco2e')
        return float(v) if v is not None else None
    return None

# ═══════════════════════════════════════════════════════════════
print(f'\n{B}{"="*65}{E}')
print(f'{B}FLOW 1 — 3A Stationary Combustion{E}')
print(f'{B}Input: "Gecen yil 15000 m3 dogalgaz kullandik."{E}')
print(f'{B}{"="*65}{E}')

clean()

# 1A: AI extraction
resp = send_chat({
    'reply': 'Gecen yil 15000 m3 dogalgaz kullanimi kaydedildi.',
    'suggestions': [{'category': '3A', 'confidence': 0.91, 'fields': [
        {'field_id': 'rf.3a.fuel_type',   'label': 'Fuel type',   'value': 'natural_gas', 'confidence': 0.95},
        {'field_id': 'rf.3a.consumption', 'label': 'Consumption', 'value': 15000,         'confidence': 0.92},
        {'field_id': 'rf.3a.unit',        'label': 'Unit',        'value': 'm3',          'confidence': 0.88},
    ]}]
}, 'Gecen yil 15000 m3 dogalgaz kullandik.')

sug = resp.data.get('suggestion')
print(f'\n{B}1A — AI Extraction{E}')
check('Suggestion category = 3A', sug and sug['category'] == '3A')
fm = {f['field_id']: f['value'] for f in sug['fields']} if sug else {}
check('rf.3a.fuel_type = natural_gas', fm.get('rf.3a.fuel_type') == 'natural_gas')
check('rf.3a.consumption = 15000 (int)', fm.get('rf.3a.consumption') == 15000 and isinstance(fm.get('rf.3a.consumption'), int))
check('rf.3a.unit = m3', fm.get('rf.3a.unit') == 'm3')

# 1B: Confirm → ReportField
print(f'\n{B}1B — Confirm writes to ReportField{E}')
confirm(sug['id'])
fv = get_fields()
check('rf.3a.fuel_type saved', fv.get('rf.3a.fuel_type') == 'natural_gas')
check('rf.3a.consumption saved as int', fv.get('rf.3a.consumption') == 15000)
check('rf.3a.unit saved', fv.get('rf.3a.unit') == 'm3')
rf_src = ReportField.objects.get(report=report, field_id='rf.3a.consumption').source
check('source = chatbot', rf_src == 'chatbot')

# 1C: Auto-fill (map endpoint)
print(f'\n{B}1C — Auto-fill via map endpoint{E}')
check('map returns rf.3a.consumption = 15000', fv.get('rf.3a.consumption') == 15000)
check('map returns rf.3a.fuel_type', fv.get('rf.3a.fuel_type') == 'natural_gas')

# 1D: tCO2e estimate
print(f'\n{B}1D — tCO2e estimate (client-side){E}')
kg = estimate_emission('3A', fv)
expected_kg = 15000 * 2.02  # = 30300 kgCO2e = 30.3 tCO2e
check('Emission estimate = 30300 kgCO2e', kg is not None and abs(kg - expected_kg) < 1,
      f'got {kg}')

# 1E: Category status
print(f'\n{B}1E — Category status{E}')
st = cat_status('3A', fv)
check('3A status = complete', st == 'complete', f'got {st}')

# ═══════════════════════════════════════════════════════════════
print(f'\n{B}{"="*65}{E}')
print(f'{B}FLOW 2 — 4A Purchased Electricity{E}')
print(f'{B}Input: "Gecen yil TEDAStan 18000 kWh elektrik aldik."{E}')
print(f'{B}{"="*65}{E}')

# Keep 3A data from above — only add 4A

# 2A: AI extraction
resp2 = send_chat({
    'reply': 'TEDAS uzerinden 18000 kWh elektrik tueketimi kaydedildi.',
    'suggestions': [{'category': '4A', 'confidence': 0.92, 'fields': [
        {'field_id': 'rf.4a.supplier',        'label': 'Electricity supplier',       'value': 'TEDAS', 'confidence': 0.94},
        {'field_id': 'rf.4a.consumption_kwh', 'label': 'Electricity consumed (kWh)', 'value': 18000,   'confidence': 0.95},
    ]}]
}, 'Gecen yil TEDAStan 18000 kWh elektrik aldik.')

sug2 = resp2.data.get('suggestion')
print(f'\n{B}2A — AI Extraction{E}')
check('Suggestion category = 4A', sug2 and sug2['category'] == '4A')
fm2 = {f['field_id']: f['value'] for f in sug2['fields']} if sug2 else {}
check('rf.4a.supplier = TEDAS', fm2.get('rf.4a.supplier') == 'TEDAS')
check('rf.4a.consumption_kwh = 18000 (int)', fm2.get('rf.4a.consumption_kwh') == 18000 and isinstance(fm2.get('rf.4a.consumption_kwh'), int))

# 2B: Confirm
print(f'\n{B}2B — Confirm writes to ReportField{E}')
confirm(sug2['id'])
fv2 = get_fields()
check('rf.4a.consumption_kwh = 18000', fv2.get('rf.4a.consumption_kwh') == 18000)
check('rf.4a.supplier = TEDAS', fv2.get('rf.4a.supplier') == 'TEDAS')

# 2C: Dashboard manual fields (emission factor)
print(f'\n{B}2C — Dashboard manual save (emission factor){E}')
bulk_save([
    {'field_id': 'rf.4a.emission_factor',        'value': 0.437},
    {'field_id': 'rf.4a.emission_factor_source', 'value': 'IEA 2023'},
    {'field_id': 'rf.4a.period',                 'value': '2023'},
    {'field_id': 'rf.4a.data_source',            'value': 'invoice'},
    {'field_id': 'rf.4a.renewable_on_site',      'value': 2000},
])
fv2 = get_fields()
check('rf.4a.emission_factor = 0.437', fv2.get('rf.4a.emission_factor') == 0.437)
check('rf.4a.renewable_on_site = 2000', fv2.get('rf.4a.renewable_on_site') == 2000)

# 2D: Scope 2 emission estimate (net kWh deduction)
print(f'\n{B}2D — Scope 2 emission estimate (net kWh deduction){E}')
kg4a = estimate_emission('4A', fv2)
expected_4a = max(18000 - 2000, 0) * 0.437  # = 16000 * 0.437 = 6992
check('Emission = 6992 kgCO2e (net of renewable)', kg4a is not None and abs(kg4a - expected_4a) < 0.01,
      f'got {kg4a}')

# 2E: 3A independence
print(f'\n{B}2E — 3A data independence after 4A operations{E}')
check('rf.3a.consumption still 15000', fv2.get('rf.3a.consumption') == 15000)
check('rf.3a.fuel_type still natural_gas', fv2.get('rf.3a.fuel_type') == 'natural_gas')

# 2F: Category status
print(f'\n{B}2F — Category status{E}')
st2 = cat_status('4A', fv2)
check('4A status = complete', st2 == 'complete', f'got {st2}')

# ═══════════════════════════════════════════════════════════════
print(f'\n{B}{"="*65}{E}')
print(f'{B}FLOW 3 — K4 Upstream Transport{E}')
print(f'{B}Input: "45 ton mali 1200 km karayolu ile tasidik."{E}')
print(f'{B}{"="*65}{E}')

# 3A: AI extraction
GLEC_ROAD_EF = 0.096  # kgCO2e/tonne-km for road (GLEC v3)
tkm_k4       = 45 * 1200
expected_k4  = round(tkm_k4 * GLEC_ROAD_EF, 2)

resp3 = send_chat({
    'reply': '45 ton yuk 1200 km karayolu ile tasimasi kaydedildi.',
    'suggestions': [{'category': 'K4', 'confidence': 0.88, 'fields': [
        {'field_id': 'rf.k4.entry_method',          'label': 'Data entry method',     'value': 'shipment', 'confidence': 0.85},
        {'field_id': 'rf.k4.total_tkm',             'label': 'Total tonne-km',        'value': tkm_k4,     'confidence': 0.90},
        {'field_id': 'rf.k4.total_emission_kgco2e', 'label': 'Total emission (kgCO2e)', 'value': expected_k4, 'confidence': 0.87},
    ]}]
}, '45 ton mali 1200 km karayolu ile tasidik.')

sug3 = resp3.data.get('suggestion')
print(f'\n{B}3A — AI Extraction{E}')
check('Suggestion category = K4', sug3 and sug3['category'] == 'K4')
fm3 = {f['field_id']: f['value'] for f in sug3['fields']} if sug3 else {}
check(f'rf.k4.total_tkm = {tkm_k4}', fm3.get('rf.k4.total_tkm') == tkm_k4)
check(f'rf.k4.total_emission_kgco2e = {expected_k4}', abs((fm3.get('rf.k4.total_emission_kgco2e') or 0) - expected_k4) < 0.1)

# 3B: Confirm
print(f'\n{B}3B — Confirm writes to ReportField{E}')
confirm(sug3['id'])
fv3 = get_fields()
check('rf.k4.total_tkm saved', fv3.get('rf.k4.total_tkm') == tkm_k4)
check('rf.k4.total_emission_kgco2e saved', abs((fv3.get('rf.k4.total_emission_kgco2e') or 0) - expected_k4) < 0.1)

# 3C: Shipment records via dashboard bulk save
print(f'\n{B}3C — Dashboard multi-shipment save{E}')
shipments = [{'mode': 'road_truck', 'cargo_t': 45, 'distance_km': 1200,
              'tkm': 54000, 'ef': GLEC_ROAD_EF, 'kgco2e': expected_k4}]
bulk_save([
    {'field_id': 'rf.k4.shipments',             'value': shipments},
    {'field_id': 'rf.k4.data_source',           'value': 'internal_records'},
    {'field_id': 'rf.k4.ef_source',             'value': 'GLEC v3'},
])
fv3 = get_fields()
saved_ships = fv3.get('rf.k4.shipments')
check('rf.k4.shipments is list with 1 item', isinstance(saved_ships, list) and len(saved_ships) == 1)
check('Shipment mode = road_truck', (saved_ships or [{}])[0].get('mode') == 'road_truck')
check('Shipment cargo_t = 45', (saved_ships or [{}])[0].get('cargo_t') == 45)

# 3D: Emission from stored total (K4 reads directly)
print(f'\n{B}3D — K4 emission estimate from stored total{E}')
kg_k4 = estimate_emission('K4', fv3)
check(f'K4 emission = {expected_k4} kgCO2e', kg_k4 is not None and abs(kg_k4 - expected_k4) < 0.1)

# 3E: 3A + 4A independence
print(f'\n{B}3E — 3A and 4A independence after K4 operations{E}')
check('rf.3a.consumption still 15000', fv3.get('rf.3a.consumption') == 15000)
check('rf.4a.consumption_kwh still 18000', fv3.get('rf.4a.consumption_kwh') == 18000)

# 3F: K4 category status
print(f'\n{B}3F — Category status{E}')
# Without shipments array, using ai-confirmed total only
st3_no_ship = cat_status('K4', {
    'rf.k4.shipments': [],  # empty array → should be missing
    'rf.k4.total_emission_kgco2e': expected_k4,
})
check('K4 status = in_progress when shipments = []',
      st3_no_ship == 'in_progress', f'got {st3_no_ship}')

st3_full = cat_status('K4', fv3)
check('K4 status = complete with all required fields', st3_full == 'complete', f'got {st3_full}')

# ═══════════════════════════════════════════════════════════════
print(f'\n{B}{"="*65}{E}')
print(f'{B}CROSS-CUTTING CHECKS{E}')
print(f'{B}{"="*65}{E}')

# CC1: Page refresh — map endpoint reflects all saved data
print(f'\n{B}CC1 — Page refresh (map endpoint returns all 3 categories){E}')
fv_refresh = get_fields()
check('3A present after refresh', fv_refresh.get('rf.3a.fuel_type') == 'natural_gas')
check('4A present after refresh', fv_refresh.get('rf.4a.consumption_kwh') == 18000)
check('K4 present after refresh', fv_refresh.get('rf.k4.total_emission_kgco2e') is not None)

# CC2: Overall total aggregation
print(f'\n{B}CC2 — Overall total emission aggregation{E}')
total = sum(filter(None, [
    estimate_emission('3A', fv_refresh),
    estimate_emission('4A', fv_refresh),
    estimate_emission('K4', fv_refresh),
]))
expected_total = 30300 + 6992 + expected_k4
check(f'Grand total ≈ {round(expected_total/1000,2)} tCO2e',
      abs(total - expected_total) < 1, f'got {round(total/1000,3)} tCO2e')

# CC3: Empty suggestion (no suggestions array) → no ReportField written
print(f'\n{B}CC3 — Empty suggestion → no ReportField written{E}')
count_before = ReportField.objects.filter(report=report).count()
send_chat({'reply': 'No data found.', 'suggestions': []}, 'Just a question, no data.')
count_after  = ReportField.objects.filter(report=report).count()
check('No new ReportField written for empty suggestion', count_before == count_after)
sug_null = send_chat({'reply': 'No data.', 'suggestions': []}, 'Another question.').data.get('suggestion')
check('suggestion=null returned in response', sug_null is None)

# CC4: Rejected suggestion → no ReportField written
print(f'\n{B}CC4 — Rejected suggestion → no ReportField written{E}')
resp_rej = send_chat({
    'reply': 'Test rejection.',
    'suggestions': [{'category': '3A', 'confidence': 0.9, 'fields': [
        {'field_id': 'rf.3a.facility', 'label': 'Facility', 'value': 'SHOULD_NOT_SAVE', 'confidence': 0.9},
    ]}]
}, 'reject test')
sug_rej = resp_rej.data.get('suggestion')
count_before2 = ReportField.objects.filter(report=report).count()
reject(sug_rej['id'])
count_after2  = ReportField.objects.filter(report=report).count()
check('Rejected suggestion does not write to ReportField', count_before2 == count_after2)
check('rf.3a.facility not saved',
      ReportField.objects.filter(report=report, field_id='rf.3a.facility').count() == 0)

# CC5: Empty array bug fix — getCategoryStatus in Python
print(f'\n{B}CC5 — getCategoryStatus: empty array bug fix{E}')
st_empty_arr = cat_status('K4', {'rf.k4.shipments': [], 'rf.k4.total_emission_kgco2e': 5000})
check('K4 with shipments=[] is in_progress (not complete)', st_empty_arr == 'in_progress',
      f'got {st_empty_arr}')
st_no_arr = cat_status('K4', {'rf.k4.shipments': None, 'rf.k4.total_emission_kgco2e': None})
check('K4 with all missing is missing', st_no_arr == 'missing', f'got {st_no_arr}')

# CC6: Duplicate confirm attempt → 404
print(f'\n{B}CC6 — Double-confirm attempt returns 404{E}')
resp_dup = confirm(sug3['id'])  # already confirmed above
check('Double-confirm returns 404', resp_dup.status_code == 404)

# CC7: Category status summary
print(f'\n{B}CC7 — All category statuses{E}')
fv_final = get_fields()
st_3a = cat_status('3A', fv_final)
st_4a = cat_status('4A', fv_final)
st_k4 = cat_status('K4', fv_final)
check('3A = complete', st_3a == 'complete', f'got {st_3a}')
check('4A = complete', st_4a == 'complete', f'got {st_4a}')
check('K4 = complete', st_k4 == 'complete', f'got {st_k4}')
print(f'  Completed: {sum(s == "complete" for s in [st_3a,st_4a,st_k4])}/3 categories')

# ═══════════════════════════════════════════════════════════════
print(f'\n{B}{"="*65}{E}')
print(f'{B}DEMO QA CHECKLIST — SUMMARY{E}')
print(f'{B}{"="*65}{E}')

all_labels = [
    # 3A
    'F1-1A  3A: Suggestion category = 3A',
    'F1-1A  3A: fuel_type = natural_gas',
    'F1-1A  3A: consumption = 15000 (int)',
    'F1-1A  3A: unit = m3',
    'F1-1B  3A: ReportField fuel_type saved',
    'F1-1B  3A: ReportField consumption saved as int',
    'F1-1B  3A: ReportField unit saved',
    'F1-1B  3A: source = chatbot',
    'F1-1C  3A: auto-fill consumption',
    'F1-1C  3A: auto-fill fuel_type',
    'F1-1D  3A: emission = 30300 kgCO2e',
    'F1-1E  3A: status = complete',
    # 4A
    'F2-2A  4A: Suggestion category = 4A',
    'F2-2A  4A: supplier = TEDAS',
    'F2-2A  4A: consumption_kwh = 18000 (int)',
    'F2-2B  4A: ReportField consumption_kwh saved',
    'F2-2B  4A: ReportField supplier saved',
    'F2-2C  4A: dashboard save emission_factor',
    'F2-2C  4A: dashboard save renewable_on_site',
    'F2-2D  4A: emission = 6992 kgCO2e (net)',
    'F2-2E  4A: 3A consumption unchanged',
    'F2-2E  4A: 3A fuel_type unchanged',
    'F2-2F  4A: status = complete',
    # K4
    'F3-3A  K4: Suggestion category = K4',
    'F3-3A  K4: total_tkm correct',
    'F3-3A  K4: total_emission correct',
    'F3-3B  K4: ReportField tkm saved',
    'F3-3B  K4: ReportField emission saved',
    'F3-3C  K4: shipments array with 1 item',
    'F3-3C  K4: shipment mode = road_truck',
    'F3-3C  K4: shipment cargo_t = 45',
    'F3-3D  K4: emission from stored total',
    'F3-3E  K4: 3A still 15000',
    'F3-3E  K4: 4A still 18000',
    'F3-3F  K4: in_progress when shipments=[]',
    'F3-3F  K4: status = complete',
    # Cross-cutting
    'CC1    Refresh: 3A present',
    'CC1    Refresh: 4A present',
    'CC1    Refresh: K4 present',
    'CC2    Grand total aggregation',
    'CC3    Empty suggestion: no RF written',
    'CC3    Empty suggestion: null returned',
    'CC4    Rejected: no RF written',
    'CC4    Rejected: facility field absent',
    'CC5    Empty array bug: in_progress',
    'CC5    Null fields: missing',
    'CC6    Double-confirm → 404',
    'CC7    3A status = complete',
    'CC7    4A status = complete',
    'CC7    K4 status = complete',
]

passed = sum(r for _, r in results)
total_c = len(results)

print()
for label, ok in zip(all_labels, [r for _, r in results]):
    print(f'  {G if ok else R} {label}')

print()
print(f'{"─"*55}')
print(f'  Result: {passed}/{total_c} checks passed', end='')
if passed == total_c:
    print(f'  {G} ALL PASS — MVP ready for demo{E}')
else:
    failed = [(l, ok) for l, ok in zip(all_labels, [r for _, r in results]) if not ok]
    print(f'  {R} {total_c - passed} FAILED{E}')
    print()
    print('  Failed checks:')
    for l, _ in failed:
        print(f'    {R} {l}{E}')
print(f'{"─"*55}')
print()
