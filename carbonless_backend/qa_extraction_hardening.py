"""
AI Extraction Hardening — 30 phrase variants across TR / EN / Mixed.

Modes:
  python -X utf8 qa_extraction_hardening.py          # analysis-only (no API key needed)
  GROQ_API_KEY=gsk_... python -X utf8 qa_extraction_hardening.py  # live Groq calls

The analysis-only mode shows expected vs likely-actual behavior based on
known LLM failure patterns, so you can improve the prompt before burning API calls.
"""
import os, sys, json, time, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'carbonless_api.settings'
os.environ['ALLOW_DEV_SECRET'] = 'true'
sys.path.insert(0, '.')
django.setup()

G  = '\033[92m[PASS]\033[0m'
R  = '\033[91m[FAIL]\033[0m'
Y  = '\033[93m[RISK]\033[0m'
B  = '\033[94m'
W  = '\033[93m'
E  = '\033[0m'

GROQ_KEY = os.environ.get('GROQ_API_KEY', '')
LIVE_MODE = bool(GROQ_KEY)

if LIVE_MODE:
    print(f'{B}MODE: LIVE — real Groq calls (llama-3.3-70b-versatile){E}')
else:
    print(f'{W}MODE: ANALYSIS — no API key set. Showing expected/risk classification only.')
    print(f'      To run live: set GROQ_API_KEY=gsk_... before running this script.{E}')

print()

# ── Test case definitions ─────────────────────────────────────────────────────
# Each test: phrase, expected extractions, risk reason (if any)
# 'expected' = {field_id: value} that MUST be in the suggestion
# 'risk' = why this might fail (None = high confidence pass)

TESTS = [
    # ══════════════════════════════════════
    # GROUP A — 3A Stationary Combustion
    # ══════════════════════════════════════
    {
        'id': 'A01', 'group': '3A', 'lang': 'TR',
        'phrase': 'Geçen yıl 15000 m³ doğalgaz kullandık.',
        'expected': {'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': 15000, 'rf.3a.unit': 'm3'},
        'risk': None,
        'note': 'Baseline — must pass',
    },
    {
        'id': 'A02', 'group': '3A', 'lang': 'TR',
        'phrase': '15.000 m³ doğalgaz kullandık.',
        'expected': {'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': 15000},
        'risk': 'Turkish thousand-sep: AI may parse 15.000 as 15.0 (float)',
        'note': 'TR period = thousand separator, NOT decimal',
    },
    {
        'id': 'A03', 'group': '3A', 'lang': 'TR',
        'phrase': 'Doğalgaz tüketimimiz 15000 m³ oldu.',
        'expected': {'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': 15000, 'rf.3a.unit': 'm3'},
        'risk': None,
        'note': 'Subject-first word order',
    },
    {
        'id': 'A04', 'group': '3A', 'lang': 'TR',
        'phrase': '50000 litre motorin kullandık.',
        'expected': {'rf.3a.fuel_type': 'diesel', 'rf.3a.consumption': 50000, 'rf.3a.unit': 'litre'},
        'risk': None,
        'note': 'Diesel / motorin synonym',
    },
    {
        'id': 'A05', 'group': '3A', 'lang': 'TR',
        'phrase': 'Fabrikamızda 8000 kg LPG kullandık.',
        'expected': {'rf.3a.fuel_type': 'lpg', 'rf.3a.consumption': 8000, 'rf.3a.unit': 'kg'},
        'risk': None,
        'note': 'LPG by kg',
    },
    {
        'id': 'A06', 'group': '3A', 'lang': 'TR',
        'phrase': 'Geçen yıl 25000 litre fuel oil yaktık.',
        'expected': {'rf.3a.fuel_type': 'fuel_oil', 'rf.3a.consumption': 25000, 'rf.3a.unit': 'litre'},
        'risk': None,
        'note': 'Fuel oil',
    },
    {
        'id': 'A07', 'group': '3A', 'lang': 'EN',
        'phrase': 'We consumed 15,000 cubic meters of natural gas last year.',
        'expected': {'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': 15000},
        'risk': None,
        'note': 'English standard — cubic meters → m3',
    },
    {
        'id': 'A08', 'group': '3A', 'lang': 'EN',
        'phrase': '15k m3 natural gas last year.',
        'expected': {'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': 15000},
        'risk': 'Abbreviation: AI may extract 15 not 15000 from "15k"',
        'note': 'k = ×1000 abbreviation',
    },
    {
        'id': 'A09', 'group': '3A', 'lang': 'EN',
        'phrase': 'Our natural gas consumption was 15,000 m3.',
        'expected': {'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': 15000, 'rf.3a.unit': 'm3'},
        'risk': None,
        'note': 'EN comma thousand sep — must parse correctly',
    },
    {
        'id': 'A10', 'group': '3A', 'lang': 'MIXED',
        'phrase': 'Natural gas tüketimimiz 15000 m³ oldu.',
        'expected': {'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': 15000, 'rf.3a.unit': 'm3'},
        'risk': None,
        'note': 'EN fuel name + TR sentence structure',
    },
    {
        'id': 'A11', 'group': '3A', 'lang': 'TR',
        'phrase': '15.000 m3 doğalgaz ve 2000 litre motorin kullandık.',
        'expected': {'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': 15000},
        'risk': 'Two fuels in one message — AI may pick only one or merge incorrectly',
        'note': 'Multi-fuel message; extraction picks highest-confidence one',
    },
    {
        'id': 'A12', 'group': '3A', 'lang': 'TR',
        'phrase': 'Kömür tüketimimiz 50 ton oldu.',
        'expected': {'rf.3a.fuel_type': 'coal', 'rf.3a.consumption': 50, 'rf.3a.unit': 'tonne'},
        'risk': 'kömür → coal mapping; "ton" → tonne unit',
        'note': 'Coal / kömür synonym',
    },

    # ══════════════════════════════════════
    # GROUP B — 4A Purchased Electricity
    # ══════════════════════════════════════
    {
        'id': 'B01', 'group': '4A', 'lang': 'TR',
        'phrase': "Geçen yıl TEDAŞ'tan 18000 kWh elektrik aldık.",
        'expected': {'rf.4a.supplier': 'TEDAŞ', 'rf.4a.consumption_kwh': 18000},
        'risk': None,
        'note': 'Baseline — must pass',
    },
    {
        'id': 'B02', 'group': '4A', 'lang': 'TR',
        'phrase': '18.000 kWh elektrik tükettik.',
        'expected': {'rf.4a.consumption_kwh': 18000},
        'risk': 'Turkish period thousand-sep: may parse as 18.0',
        'note': 'No supplier, TR number format',
    },
    {
        'id': 'B03', 'group': '4A', 'lang': 'TR',
        'phrase': 'Elektrik tüketimimiz 18 MWh oldu.',
        'expected': {'rf.4a.consumption_kwh': 18000},
        'risk': 'MWh → kWh unit conversion (×1000)',
        'note': 'MWh must be converted to kWh',
    },
    {
        'id': 'B04', 'group': '4A', 'lang': 'EN',
        'phrase': 'We purchased 18,000 kWh of electricity from the national grid.',
        'expected': {'rf.4a.consumption_kwh': 18000},
        'risk': None,
        'note': 'English standard',
    },
    {
        'id': 'B05', 'group': '4A', 'lang': 'EN',
        'phrase': '18k kWh of electricity last year.',
        'expected': {'rf.4a.consumption_kwh': 18000},
        'risk': 'k abbreviation — may extract 18 instead of 18000',
        'note': 'EN abbreviated number',
    },
    {
        'id': 'B06', 'group': '4A', 'lang': 'EN',
        'phrase': 'Purchased 18000 kWh from TEDAS.',
        'expected': {'rf.4a.supplier': 'TEDAS', 'rf.4a.consumption_kwh': 18000},
        'risk': None,
        'note': 'Supplier in EN spelling',
    },
    {
        'id': 'B07', 'group': '4A', 'lang': 'MIXED',
        'phrase': '18000 kWh elektrik purchased from TEDAS last year.',
        'expected': {'rf.4a.supplier': 'TEDAS', 'rf.4a.consumption_kwh': 18000},
        'risk': None,
        'note': 'Mixed sentence',
    },
    {
        'id': 'B08', 'group': '4A', 'lang': 'TR',
        'phrase': '18000 kWh aldık, bunun 2000 kWh sahada ürettik.',
        'expected': {'rf.4a.consumption_kwh': 18000, 'rf.4a.renewable_on_site': 2000},
        'risk': 'Two numbers in one message — AI may confuse gross vs renewable',
        'note': 'Renewable deduction mentioned',
    },
    {
        'id': 'B09', 'group': '4A', 'lang': 'TR',
        'phrase': 'Enerjisa üzerinden 18000 kWh çektik.',
        'expected': {'rf.4a.supplier': 'Enerjisa', 'rf.4a.consumption_kwh': 18000},
        'risk': 'Supplier name "Enerjisa" — unusual; colloquial "çektik" for purchased',
        'note': 'Alternative supplier and verb',
    },

    # ══════════════════════════════════════
    # GROUP C — K4 Upstream Transport
    # ══════════════════════════════════════
    {
        'id': 'C01', 'group': 'K4', 'lang': 'TR',
        'phrase': '45 ton malı 1200 km karayolu ile taşıdık.',
        'expected': {'rf.k4.total_tkm': 54000},
        'risk': None,
        'note': 'Baseline — must pass; tkm = 45×1200',
    },
    {
        'id': 'C02', 'group': 'K4', 'lang': 'TR',
        'phrase': 'Tedarikçimizden 45 tonluk malı 1200 km TIR ile getirttik.',
        'expected': {'rf.k4.total_tkm': 54000},
        'risk': 'TIR (TR word for HGV truck) → road mode mapping',
        'note': 'TIR = Turkish for semi-truck',
    },
    {
        'id': 'C03', 'group': 'K4', 'lang': 'TR',
        'phrase': '100 ton yükü 500 km trenle taşıdık.',
        'expected': {'rf.k4.total_tkm': 50000},
        'risk': '"tren" → rail mode — may assign wrong EF',
        'note': 'Rail transport',
    },
    {
        'id': 'C04', 'group': 'K4', 'lang': 'TR',
        'phrase': '2 ton malı 8000 km hava kargosuyla gönderdik.',
        'expected': {'rf.k4.total_tkm': 16000},
        'risk': '"hava kargo" → air mode — AI may not map to K4 category',
        'note': 'Air freight — high EF',
    },
    {
        'id': 'C05', 'group': 'K4', 'lang': 'TR',
        'phrase': '200 ton mal deniz yoluyla 5000 km taşındı.',
        'expected': {'rf.k4.total_tkm': 1000000},
        'risk': 'Passive voice ("taşındı") — may confuse extraction',
        'note': 'Sea freight, passive sentence',
    },
    {
        'id': 'C06', 'group': 'K4', 'lang': 'EN',
        'phrase': 'We shipped 45 tonnes over 1200 km by road truck.',
        'expected': {'rf.k4.total_tkm': 54000},
        'risk': None,
        'note': 'English standard',
    },
    {
        'id': 'C07', 'group': 'K4', 'lang': 'EN',
        'phrase': 'Total upstream transport: 54,000 tonne-km by road.',
        'expected': {'rf.k4.total_tkm': 54000},
        'risk': 'Direct tonne-km statement — AI must store in total_tkm not shipments',
        'note': 'Pre-aggregated tkm input',
    },
    {
        'id': 'C08', 'group': 'K4', 'lang': 'EN',
        'phrase': '45t goods, 1200km truck delivery.',
        'expected': {'rf.k4.total_tkm': 54000},
        'risk': 'Heavily abbreviated — may fail parsing',
        'note': 'Abbreviations: t, km',
    },
    {
        'id': 'C09', 'group': 'K4', 'lang': 'MIXED',
        'phrase': '45 ton malı 1200 km truck ile taşıdık.',
        'expected': {'rf.k4.total_tkm': 54000},
        'risk': None,
        'note': 'TR sentence + EN "truck"',
    },
]

# ── Analysis mode (no API key) ────────────────────────────────────────────────
def run_analysis():
    """Show risk classification and known failure patterns."""
    by_group = {}
    for t in TESTS:
        by_group.setdefault(t['group'], []).append(t)

    total_pass = sum(1 for t in TESTS if t['risk'] is None)
    total_risk = sum(1 for t in TESTS if t['risk'] is not None)

    print(f'{"═"*65}')
    print(f'EXTRACTION HARDENING — STATIC ANALYSIS ({len(TESTS)} test cases)')
    print(f'{"═"*65}')

    for group, tests in by_group.items():
        print(f'\n{B}── GROUP {group} ({len(tests)} phrases) ──{E}')
        for t in tests:
            icon = G if t['risk'] is None else Y
            status = 'PASS' if t['risk'] is None else 'RISK'
            print(f'  {icon} [{t["id"]}] [{t["lang"]:5}] {t["phrase"][:55]:<55}')
            if t['risk']:
                print(f'           {W}⚠ {t["risk"]}{E}')

    print(f'\n{"─"*65}')
    print(f'  Expected PASS : {total_pass}/{len(TESTS)}')
    print(f'  AT RISK       : {total_risk}/{len(TESTS)}')

    print(f'\n{B}FAILURE PATTERNS IDENTIFIED:{E}')
    patterns = [
        ('P1', 'Turkish thousand separator',
         '15.000 may be parsed as float 15.0 instead of int 15000',
         ['A02', 'A11', 'B02'],
         'Add note: "In Turkish, periods are thousand separators (15.000 = 15000)"'),
        ('P2', 'k-abbreviation (15k → 15000)',
         '"15k" or "18k" not expanded to full integer',
         ['A08', 'B05'],
         'Add rule: expand k/K suffix (×1000), M suffix (×1000000)'),
        ('P3', 'MWh → kWh unit conversion',
         'AI stores 18 MWh as-is, not converting to 18000 kWh',
         ['B03'],
         'Add rule: always store electricity in kWh; convert MWh×1000, GWh×1000000'),
        ('P4', 'Transport mode ambiguity',
         'TIR, kamyon, tır → need to map to GLEC road category codes',
         ['C02'],
         'Add mode synonym table in prompt for K4'),
        ('P5', 'Multi-fuel message',
         'Two fuels in one sentence — extraction may only capture one',
         ['A11'],
         'Add rule: if multiple categories detected, pick highest-confidence one and note others in reply'),
        ('P6', 'K4 pre-aggregated tkm',
         'User says "54000 tonne-km" directly → must go to total_tkm not shipments',
         ['C07'],
         'Add K4 note: direct tkm statement → rf.k4.total_tkm field'),
        ('P7', 'Passive voice in Turkish/EN',
         'taşındı / was shipped → extraction may miss subject numbers',
         ['C05'],
         'Add rule: extract quantities regardless of voice (active/passive)'),
    ]
    for pid, name, problem, cases, fix in patterns:
        casestr = ', '.join(cases)
        print(f'\n  [{pid}] {W}{name}{E}')
        print(f'        Problem: {problem}')
        print(f'        Cases  : {casestr}')
        print(f'        Fix    : {fix}')

    print(f'\n{B}RISK DISTRIBUTION: {total_risk} cases at risk across {len(set(p[0] for p in patterns))} failure patterns{E}')
    return total_pass, total_risk

# ── Live mode (real Groq calls) ───────────────────────────────────────────────
def run_live():
    from unittest.mock import patch, MagicMock
    from rest_framework.test import APIRequestFactory, force_authenticate
    from django.contrib.auth.models import User
    from questionnaire.models import CarbonReport
    from questionnaire.workspace_views import WorkspaceChatView

    admin   = User.objects.get(username='admin')
    report  = CarbonReport.objects.filter(created_by=admin).first()
    factory = APIRequestFactory()

    results = []
    print(f'{"═"*65}')
    print(f'EXTRACTION HARDENING — LIVE GROQ ({len(TESTS)} calls)')
    print(f'{"═"*65}')

    for t in TESTS:
        print(f'\n{B}[{t["id"]}] {t["lang"]:5} | {t["group"]} | {t["phrase"][:55]}{E}')
        req = factory.post('/api/chat/workspace/',
            {'report': report.id, 'message': t['phrase']}, format='json')
        force_authenticate(req, user=admin)
        try:
            resp = WorkspaceChatView.as_view()(req)
            sug  = resp.data.get('suggestion')
            if not sug:
                print(f'  {R} No suggestion returned')
                results.append((t, False, 'No suggestion'))
                continue

            # Check category
            if sug.get('category') != t['group']:
                print(f'  {R} Wrong category: got {sug.get("category")}, expected {t["group"]}')
                results.append((t, False, f'category={sug.get("category")}'))
                continue

            # Check expected fields
            fmap = {f['field_id']: f['value'] for f in sug.get('fields', [])}
            passed = True
            for fid, ev in t['expected'].items():
                got = fmap.get(fid)
                if isinstance(ev, int):
                    # Allow float that rounds to same value
                    ok = got is not None and abs(float(got) - ev) < 0.5
                else:
                    ok = str(got).lower() == str(ev).lower() if got is not None else False
                if not ok:
                    print(f'  {R} {fid}: expected {ev!r}, got {got!r}')
                    passed = False
                else:
                    print(f'  {G} {fid}: {got!r}')

            results.append((t, passed, fmap))
            if passed:
                print(f'  {G} ALL FIELDS CORRECT')
        except Exception as ex:
            print(f'  {R} EXCEPTION: {ex}')
            results.append((t, False, str(ex)))

        time.sleep(0.4)  # rate limit courtesy pause

    # Summary
    print(f'\n{"═"*65}')
    print('LIVE TEST SUMMARY')
    print(f'{"═"*65}')
    passed  = [(t,r,m) for t,r,m in results if r]
    failed  = [(t,r,m) for t,r,m in results if not r]
    at_risk_failed = [(t,r,m) for t,r,m in failed if t['risk']]
    surprise_fail  = [(t,r,m) for t,r,m in failed if not t['risk']]

    print(f'  PASS     : {len(passed)}/{len(TESTS)}')
    print(f'  FAIL     : {len(failed)}/{len(TESTS)}')
    if surprise_fail:
        print(f'  {R}UNEXPECTED FAILS (should have passed):{E}')
        for t,_,m in surprise_fail:
            print(f'    [{t["id"]}] {t["phrase"][:55]}')
    if at_risk_failed:
        print(f'  {Y}PREDICTED RISK cases that failed:{E}')
        for t,_,m in at_risk_failed:
            print(f'    [{t["id"]}] {t["phrase"][:55]}')
            print(f'           ⚠ {t["risk"]}')

    return passed, failed

# ── Entry point ───────────────────────────────────────────────────────────────
if LIVE_MODE:
    passed, failed = run_live()
else:
    run_analysis()
    print(f'\n{"─"*65}')
    print(f'  Run with GROQ_API_KEY set to execute live calls.')
    print(f'  Run analysis first, then apply prompt improvements,')
    print(f'  then run live to confirm fixes.')
    print(f'{"─"*65}')
