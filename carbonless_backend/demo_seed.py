"""
Demo seed / reset utility for CarbonIQ Workspace.

Usage:
  python -X utf8 demo_seed.py reset           # clear all ReportField + PendingSuggestion
  python -X utf8 demo_seed.py seed            # reset + seed 3A, 4A, K4 demo data
  python -X utf8 demo_seed.py seed --partial  # seed only 3A (for AI-demo flow)
  python -X utf8 demo_seed.py status          # show current field counts per category
"""
import os, sys, django, json, argparse
os.environ['DJANGO_SETTINGS_MODULE'] = 'carbonless_api.settings'
os.environ['ALLOW_DEV_SECRET'] = 'true'
sys.path.insert(0, '.')
django.setup()

from django.contrib.auth.models import User
from questionnaire.models import CarbonReport, ReportField, PendingSuggestion

G = '\033[92m'; R = '\033[91m'; B = '\033[94m'; Y = '\033[93m'; E = '\033[0m'

def get_demo_report():
    admin = User.objects.get(username='admin')
    report = CarbonReport.objects.filter(created_by=admin).first()
    if not report:
        print(f'{R}No CarbonReport found for admin user.{E}')
        sys.exit(1)
    return report

def do_reset(report):
    rf_count  = ReportField.objects.filter(report=report).delete()[0]
    ps_count  = PendingSuggestion.objects.filter(report=report).delete()[0]
    print(f'{G}Reset:{E} deleted {rf_count} ReportField(s) and {ps_count} PendingSuggestion(s)')

def do_seed(report, partial=False):
    from django.contrib.auth.models import User
    admin = User.objects.get(username='admin')

    # ── 3A — Stationary Combustion ────────────────────────────
    fields_3a = [
        {'field_id': 'rf.3a.fuel_type',   'value': 'natural_gas', 'source': 'demo'},
        {'field_id': 'rf.3a.consumption', 'value': 15000,          'source': 'demo'},
        {'field_id': 'rf.3a.unit',        'value': 'm³',           'source': 'demo'},
        {'field_id': 'rf.3a.facility',    'value': 'Merkez Ofis',  'source': 'demo'},
    ]
    for f in fields_3a:
        ReportField.objects.update_or_create(
            report=report, field_id=f['field_id'],
            defaults={'value': f['value'], 'source': f['source'],
                      'confidence': 0.95, 'updated_by': admin},
        )
    print(f'{G}Seeded 3A:{E} natural_gas · 15,000 m³ · Merkez Ofis')

    if partial:
        print(f'{Y}Partial seed: 3A only. 4A and K4 left empty for AI demo.{E}')
        return

    # ── 4A — Purchased Electricity ────────────────────────────
    fields_4a = [
        {'field_id': 'rf.4a.facility',               'value': 'Merkez Ofis'},
        {'field_id': 'rf.4a.consumption_kwh',        'value': 18000},
        {'field_id': 'rf.4a.period',                 'value': '2023'},
        {'field_id': 'rf.4a.data_source',            'value': 'invoice'},
        {'field_id': 'rf.4a.supplier',               'value': 'TEDAŞ'},
        {'field_id': 'rf.4a.renewable_on_site',      'value': 2000},
        {'field_id': 'rf.4a.emission_factor',        'value': 0.437},
        {'field_id': 'rf.4a.emission_factor_source', 'value': 'IEA 2023 — Turkey'},
    ]
    for f in fields_4a:
        ReportField.objects.update_or_create(
            report=report, field_id=f['field_id'],
            defaults={'value': f['value'], 'source': 'demo',
                      'confidence': None, 'updated_by': admin},
        )
    print(f'{G}Seeded 4A:{E} TEDAŞ · 18,000 kWh · EF 0.437 IEA2023 · 2,000 kWh renewable')

    # ── K4 — Upstream Transport ───────────────────────────────
    shipments = [
        {'mode': 'road_hgv_full',  'cargo_t': 45,   'distance_km': 1200, 'tkm': 54000},
        {'mode': 'rail_electric',  'cargo_t': 120,  'distance_km': 800,  'tkm': 96000},
    ]
    total_tkm    = sum(s['tkm'] for s in shipments)
    GLEC_EF      = {'road_hgv_full': 0.062, 'rail_electric': 0.006}
    total_kgco2e = round(sum(s['tkm'] * GLEC_EF[s['mode']] for s in shipments), 1)

    fields_k4 = [
        {'field_id': 'rf.k4.entry_method',          'value': 'shipment_detail'},
        {'field_id': 'rf.k4.shipments',             'value': shipments},
        {'field_id': 'rf.k4.total_tkm',             'value': total_tkm},
        {'field_id': 'rf.k4.total_emission_kgco2e', 'value': total_kgco2e},
        {'field_id': 'rf.k4.data_source',           'value': 'waybill'},
        {'field_id': 'rf.k4.ef_source',             'value': 'GLEC Framework v3'},
    ]
    for f in fields_k4:
        ReportField.objects.update_or_create(
            report=report, field_id=f['field_id'],
            defaults={'value': f['value'], 'source': 'demo',
                      'confidence': None, 'updated_by': admin},
        )
    print(f'{G}Seeded K4:{E} 2 shipments · {total_tkm:,} tkm · {total_kgco2e} kgCO₂e (GLEC v3)')

    # Summary
    print()
    print('─' * 50)
    print(f'  3A emission estimate : {15000 * 2.02:,.0f} kgCO₂e  = {15000 * 2.02 / 1000:.2f} tCO₂e  (DEFRA 2023)')
    net_4a = max(18000 - 2000, 0) * 0.437
    print(f'  4A emission estimate : {net_4a:,.0f} kgCO₂e  = {net_4a / 1000:.3f} tCO₂e  (IEA 2023)')
    print(f'  K4 emission estimate : {total_kgco2e:,.1f} kgCO₂e  = {total_kgco2e / 1000:.3f} tCO₂e  (GLEC v3)')
    total = 15000 * 2.02 + net_4a + total_kgco2e
    print(f'  Total                : {total:,.1f} kgCO₂e  = {total / 1000:.2f} tCO₂e')
    print('─' * 50)

def do_status(report):
    fields = ReportField.objects.filter(report=report).order_by('field_id')
    if not fields.exists():
        print(f'{Y}No ReportFields found for this report.{E}')
        return
    by_cat = {}
    for f in fields:
        cat = f.field_id.split('.')[1].upper() if '.' in f.field_id else 'OTHER'
        by_cat.setdefault(cat, []).append(f)
    for cat, flist in by_cat.items():
        print(f'\n{B}{cat}{E} ({len(flist)} field(s)):')
        for f in flist:
            v = f.value
            display = f'{v[:60]}…' if isinstance(v, str) and len(v) > 60 else (
                f'[{len(v)} entries]' if isinstance(v, list) else str(v)
            )
            src = f' [{f.source}]' if f.source else ''
            print(f'  {f.field_id:<40} {display}{src}')

    pending = PendingSuggestion.objects.filter(report=report, status='pending').count()
    if pending:
        print(f'\n{Y}{pending} pending suggestion(s) — not yet confirmed/rejected{E}')

# ── CLI ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description='CarbonIQ Demo seed/reset tool')
parser.add_argument('command', choices=['reset', 'seed', 'status'])
parser.add_argument('--partial', action='store_true', help='seed 3A only (for AI demo)')
args = parser.parse_args()

report = get_demo_report()
print(f'\n{B}Report:{E} #{report.id} — {report.reporting_year}\n')

if args.command == 'reset':
    do_reset(report)
elif args.command == 'seed':
    do_reset(report)
    print()
    do_seed(report, partial=args.partial)
elif args.command == 'status':
    do_status(report)

print()
