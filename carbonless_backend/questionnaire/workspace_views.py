"""
Workspace API views — ReportField + PendingSuggestion + AI Chat with extraction.
"""
import json
import logging
import os
from django.utils import timezone
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from companies.permissions import NotAuditorForWrites
from chat.local_parser import parse_localized_number

from .models import CarbonReport, ReportField, PendingSuggestion
from emissions.models import EmissionEntry
from emissions.factor_lookup import resolve_factor_and_amount

logger = logging.getLogger(__name__)

# rf.k5.* leg field -> real activity_type (all measured in km, see ACTIVITY_TO_SLUG)
K5_LEG_TO_ACTIVITY = {
    'rf.k5.air_domestic_pkm':   'flight_domestic',
    'rf.k5.air_short_haul_pkm': 'flight_short_haul',
    'rf.k5.air_long_haul_pkm':  'flight_long_haul',
    'rf.k5.rail_pkm':           'train',
    'rf.k5.car_km':             'car_rental',
}


def _map_shipment_mode_to_activity(mode):
    """Maps a free-form K4 shipment 'mode' string (e.g. 'road_hgv_gt34t_full') to a
    real freight activity_type. Substring-based so it tolerates the different mode
    vocabularies used by the various upstream-transport UI panels."""
    mode = (mode or '').lower()
    if 'air' in mode:
        return 'air_freight'
    if 'rail' in mode:
        return 'rail_freight'
    if 'sea' in mode or 'inland' in mode or 'water' in mode:
        return 'sea_freight'
    if 'road' in mode or 'hgv' in mode or 'lgv' in mode or 'van' in mode or 'truck' in mode:
        return 'truck_freight'
    return None


def _sync_workspace_to_emission_entries(report, user):
    """
    Bridges the Workspace's ReportField data (rf.3a.*, rf.4a.*, rf.k4.*, rf.k5.*)
    into real EmissionEntry rows using the same shared, backend-validated factor
    lookup as the AI chat and the guided questionnaire — so data entered via the
    free-chat Workspace panels finally counts toward the dashboard/report totals
    instead of being an orphaned preview that only exists in ReportField.

    Every entry this function creates is tagged with a description containing
    'Workspace <tag> (report <id>)' so re-running it (fields change, shipments
    added/removed) updates/replaces the same rows instead of duplicating them.
    """
    values, _ = _fields_map(report)
    company = report.company
    year = report.reporting_year or timezone.now().year
    month = 1  # Workspace fields represent annual/period totals, not a specific month
    tag_prefix = f'(report {report.id})'

    def _upsert(tag, activity_type, quantity, unit):
        factor, qty, co2e_kg, error = resolve_factor_and_amount(activity_type, quantity, unit)
        if error:
            logger.warning('Workspace sync skipped %s for report %s: %s', tag, report.id, error)
            return
        desc = f'Workspace {tag} {tag_prefix}'
        existing = EmissionEntry.objects.filter(company=company, description=desc).first()
        if existing:
            existing.emission_factor = factor
            existing.quantity = qty
            existing.calculated_co2e_kg = co2e_kg
            existing.factor_value_snapshot = factor.factor_kg_co2e
            existing.factor_source_snapshot = factor.source
            existing.year = year
            existing.save()
        else:
            EmissionEntry.objects.create(
                user=user, company=company, emission_factor=factor,
                year=year, month=month, quantity=qty, calculated_co2e_kg=co2e_kg,
                description=desc, factor_value_snapshot=factor.factor_kg_co2e,
                factor_source_snapshot=factor.source, status='approved',
            )

    def _remove_stale(tag_startswith, keep_tags):
        stale = EmissionEntry.objects.filter(
            company=company, description__startswith=f'Workspace {tag_startswith}',
            description__endswith=tag_prefix,
        ).exclude(description__in=[f'Workspace {t} {tag_prefix}' for t in keep_tags])
        stale.delete()

    # 3A — Stationary combustion
    if values.get('rf.3a.fuel_type') and values.get('rf.3a.consumption') and values.get('rf.3a.unit'):
        _upsert('3A', values['rf.3a.fuel_type'], values['rf.3a.consumption'], values['rf.3a.unit'])

    # 4A — Purchased electricity (net of on-site renewable generation)
    if values.get('rf.4a.consumption_kwh'):
        try:
            net_kwh = float(values['rf.4a.consumption_kwh']) - float(values.get('rf.4a.renewable_on_site') or 0)
        except (TypeError, ValueError):
            net_kwh = None
        if net_kwh and net_kwh > 0:
            _upsert('4A', 'electricity', net_kwh, 'kwh')

    # K4 — Upstream transport: one entry per shipment (each may use a different mode)
    shipments = values.get('rf.k4.shipments')
    if isinstance(shipments, list) and shipments:
        keep_tags = []
        for i, s in enumerate(shipments):
            activity_type = _map_shipment_mode_to_activity(s.get('mode'))
            try:
                weight_t = float(s.get('weight_t') or 0)
                distance_km = float(s.get('distance_km') or 0)
            except (TypeError, ValueError):
                continue
            if not activity_type or weight_t <= 0 or distance_km <= 0:
                continue
            tag = f'K4-{i}'
            _upsert(tag, activity_type, weight_t * distance_km, 'tonne-km')
            keep_tags.append(tag)
        _remove_stale('K4-', keep_tags)

    # K5 — Business travel: one entry per travel-mode leg
    for field_id, activity_type in K5_LEG_TO_ACTIVITY.items():
        val = values.get(field_id)
        if val:
            try:
                distance = float(val)
            except (TypeError, ValueError):
                continue
            if distance > 0:
                _upsert(f'K5-{activity_type}', activity_type, distance, 'km')

# ── Groq client (reuse pattern from chat/views.py) ─────────────────────────
_groq_cache = None
_groq_key_cache = None


def _get_groq():
    global _groq_cache, _groq_key_cache
    api_key = os.environ.get('GROQ_API_KEY', '')
    if not api_key:
        return None
    if _groq_cache is None or _groq_key_cache != api_key:
        try:
            from groq import Groq
            _groq_cache = Groq(api_key=api_key)
            _groq_key_cache = api_key
        except Exception:
            return None
    return _groq_cache


# ── Helpers ────────────────────────────────────────────────────────────────

def _get_report(request, report_id):
    """Return report if it belongs to the current user, else None."""
    try:
        return CarbonReport.objects.get(id=report_id, created_by=request.user)
    except CarbonReport.DoesNotExist:
        return None


def _fields_map(report):
    """Return {field_id: value} dict and meta dict for a report."""
    qs = ReportField.objects.filter(report=report)
    values = {}
    meta = {}
    for rf in qs:
        values[rf.field_id] = rf.value
        meta[rf.field_id] = {
            'source': rf.source,
            'confidence': rf.confidence,
            'updated_at': rf.updated_at.isoformat(),
        }
    return values, meta


FIELD_HUMAN_LABELS = {
    # 3A — Stationary Combustion
    'rf.3a.fuel_type':              'Scope 1 / 3A — Fuel type',
    'rf.3a.consumption':            'Scope 1 / 3A — Consumption',
    'rf.3a.unit':                   'Scope 1 / 3A — Unit',
    'rf.3a.facility':               'Scope 1 / 3A — Facility',
    # 4A — Purchased Electricity
    'rf.4a.facility':               'Scope 2 / 4A — Facility',
    'rf.4a.consumption_kwh':        'Scope 2 / 4A — Electricity consumed (kWh)',
    'rf.4a.period':                 'Scope 2 / 4A — Reporting period',
    'rf.4a.data_source':            'Scope 2 / 4A — Data source',
    'rf.4a.supplier':               'Scope 2 / 4A — Electricity supplier',
    'rf.4a.renewable_on_site':      'Scope 2 / 4A — On-site renewable generation (kWh)',
    'rf.4a.emission_factor':        'Scope 2 / 4A — Emission factor (kgCO2e/kWh)',
    'rf.4a.emission_factor_source': 'Scope 2 / 4A — Emission factor source',
    # K4 — Upstream Transport
    'rf.k4.entry_method':           'Scope 3 / K4 — Data entry method',
    'rf.k4.shipments':              'Scope 3 / K4 — Shipment records',
    'rf.k4.total_tkm':              'Scope 3 / K4 — Total tonne-km',
    'rf.k4.total_emission_kgco2e':  'Scope 3 / K4 — Total emission (kgCO2e)',
    'rf.k4.data_source':            'Scope 3 / K4 — Data source',
    'rf.k4.ef_source':              'Scope 3 / K4 — Emission factor source',
}


def _context_summary(report):
    """Build a human-readable summary of existing ReportFields for the AI prompt."""
    values, _ = _fields_map(report)
    if not values:
        return 'No data entered yet.'
    lines = [
        f'- {FIELD_HUMAN_LABELS.get(k, k)}: {v}'
        for k, v in list(values.items())[:40]
    ]
    return '\n'.join(lines)


def _coerce_value(new_val, original_val):
    """
    If the original field value was a number (int/float) but the edited value
    arrived as a string (from an HTML input), coerce it back to a number.
    This prevents '16000' (str) being stored instead of 16000 (int).
    """
    if isinstance(original_val, (int, float)) and isinstance(new_val, str):
        # parse_localized_number distinguishes a thousands separator from a
        # decimal point — the old blind `.replace(',', '.')` here turned
        # "15.000" (a user typing fifteen thousand, Turkish-style) into
        # 15.0, and "15,000" into the same wrong 15.0 via the same path.
        try:
            parsed = parse_localized_number(new_val.strip())
            return int(parsed) if parsed.is_integer() else parsed
        except (ValueError, TypeError):
            pass
    return new_val


# ── Category → field_id schema (MVP: 3A, 4A, K4) ─────────────────────────
CATEGORY_SCHEMAS = {
    '3A': {
        'label': 'Stationary Combustion',
        'fields': [
            {'field_id': 'rf.3a.fuel_type',    'label': 'Fuel type',      'type': 'string'},
            {'field_id': 'rf.3a.consumption',  'label': 'Consumption',    'type': 'number'},
            {'field_id': 'rf.3a.unit',         'label': 'Unit',           'type': 'string'},
            {'field_id': 'rf.3a.facility',     'label': 'Facility',       'type': 'string'},
        ],
    },
    '4A': {
        'label': 'Purchased Electricity (Scope 2)',
        'fields': [
            {'field_id': 'rf.4a.facility',               'label': 'Facility',                    'type': 'string'},
            {'field_id': 'rf.4a.consumption_kwh',        'label': 'Electricity consumed (kWh)',  'type': 'number'},
            {'field_id': 'rf.4a.period',                 'label': 'Reporting period',            'type': 'string'},
            {'field_id': 'rf.4a.data_source',            'label': 'Data source',                 'type': 'string'},
            {'field_id': 'rf.4a.supplier',               'label': 'Electricity supplier',        'type': 'string'},
            {'field_id': 'rf.4a.renewable_on_site',      'label': 'On-site renewable (kWh)',     'type': 'number'},
            {'field_id': 'rf.4a.emission_factor',        'label': 'Emission factor (kgCO2e/kWh)', 'type': 'number'},
            {'field_id': 'rf.4a.emission_factor_source', 'label': 'Emission factor source',      'type': 'string'},
        ],
    },
    'K4': {
        'label': 'Upstream Transport (Scope 3 Cat.4)',
        'fields': [
            {'field_id': 'rf.k4.entry_method',           'label': 'Data entry method',            'type': 'string'},
            {'field_id': 'rf.k4.shipments',              'label': 'Shipment records',             'type': 'array'},
            {'field_id': 'rf.k4.total_tkm',              'label': 'Total tonne-km',               'type': 'number'},
            {'field_id': 'rf.k4.total_emission_kgco2e',  'label': 'Total emission (kgCO2e)',      'type': 'number'},
            {'field_id': 'rf.k4.data_source',            'label': 'Data source',                  'type': 'string'},
            {'field_id': 'rf.k4.ef_source',              'label': 'Emission factor source',       'type': 'string'},
        ],
    },
}

EXTRACTION_SYSTEM_PROMPT = """You are CarbonIQ, an expert carbon accounting AI.
Your task: extract structured emission data from the user's message.

EXISTING REPORT DATA (do NOT re-extract these unless the user explicitly updates them):
{context}

FIELD SCHEMAS (extract only from these categories):
{schemas}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NUMBER NORMALISATION (apply before extracting any value)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Turkish uses period as thousand separator and comma as decimal:
    15.000  → 15000   (integer, NOT 15.0)
    1.500,5 → 1500.5
• English comma = thousand separator:  15,000 → 15000
• k / K suffix = ×1000:   15k → 15000,  18K → 18000
• M suffix   = ×1000000:  1.5M → 1500000
• Always store numbers as plain integers or floats, never strings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIT SYNONYMS & CONVERSIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Electricity (4A) — ALWAYS store in kWh:
  MWh → multiply by 1000      (18 MWh  → 18000)
  GWh → multiply by 1000000

Gas volume:
  m³ / m3 / cubic meter / cubic metre / metreküp → use unit "m3"
  GJ, kWh also accepted as-is

Fuel oil / diesel:  litre / liter / lt / L → use unit "litre"
LPG:                kg or litre accepted

Transport distance: km / kilometre / kilometer → km
Transport weight:   ton / tonne / t → tonnes (store as cargo_t)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUEL TYPE MAPPING (→ rf.3a.fuel_type value)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
natural_gas : doğalgaz, natural gas, NG, methane, metan, gaz
diesel      : motorin, dizel, diesel, gasoil, HSD
fuel_oil    : fuel oil, mazot, ağır yakıt, HFO, kalorifer yakıtı
lpg         : LPG, likit petrol gazı, bütan, propan, autogas
coal        : kömür, coal, taşkömür, linyit (lignite)
biomass     : biyokütle, biomass, odun, wood, tarımsal atık

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSPORT MODE MAPPING (→ rf.k4.entry_method + shipment mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Road (karayolu, TIR, tır, kamyon, truck, lorry, HGV) → use entry_method "shipment_detail"
Rail (tren, demir yolu, ray, train, freight rail)    → note mode as rail
Sea  (deniz, gemi, konteyner, ship, vessel, bulk)    → note mode as sea
Air  (hava kargo, uçak, air freight, air cargo)      → note mode as air

For K4 extraction, compute tonne-km when possible:
  cargo_tonnes × distance_km = total_tkm → store in rf.k4.total_tkm

If user gives total tonne-km directly ("54000 tonne-km by road"):
  → store directly in rf.k4.total_tkm

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Extract quantities regardless of grammatical voice (active OR passive).
   "taşındı" / "was shipped" = same as "taşıdık" / "we shipped".
2. If message mentions TWO fuels (3A) or TWO categories, create ONE suggestion
   for the highest-confidence extraction. Mention the other in "reply".
3. For 4A with renewable deduction: if user says "X kWh aldık, Y kWh sahada ürettik"
   → consumption_kwh = X, renewable_on_site = Y.
4. Never invent data. Only extract what the user explicitly stated.
5. Only include fields with confidence > 0.5.
6. "reply" must be in the same language as the user's message (Turkish → Turkish, English → English).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEW-SHOT EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User: "15.000 m³ doğalgaz kullandık."
→ fuel_type="natural_gas", consumption=15000 (NOT 15.0), unit="m3"

User: "18 MWh elektrik tükettik."
→ consumption_kwh=18000 (converted from MWh)

User: "15k m3 natural gas."
→ consumption=15000 (k expanded)

User: "45 ton malı 1200 km TIR ile taşıdık."
→ entry_method="shipment_detail", total_tkm=54000 (45×1200)

User: "Total upstream: 54,000 tonne-km by road."
→ total_tkm=54000 (direct statement, no cargo/distance split needed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (ONLY valid JSON, no markdown, no explanation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{{
  "reply": "Short friendly response (1-2 sentences, same language as user).",
  "suggestions": [
    {{
      "category": "3A",
      "confidence": 0.85,
      "fields": [
        {{"field_id": "rf.3a.fuel_type", "label": "Fuel type", "value": "natural_gas", "confidence": 0.9}},
        {{"field_id": "rf.3a.consumption", "label": "Consumption", "value": 15000, "unit": "m3", "confidence": 0.92}}
      ]
    }}
  ]
}}

If nothing extractable: suggestions = []
"""


# ── Views ──────────────────────────────────────────────────────────────────

class ReportFieldMapView(APIView):
    """GET /api/questionnaire/report-fields/map/?report=1"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_id = request.query_params.get('report')
        if not report_id:
            return Response({'error': 'report param required'}, status=400)
        report = _get_report(request, report_id)
        if not report:
            return Response({'error': 'Not found'}, status=404)
        values, meta = _fields_map(report)
        return Response({'report': report.id, 'values': values, 'meta': meta})


class ReportFieldBulkUpsertView(APIView):
    """POST /api/questionnaire/report-fields/bulk-upsert/"""
    permission_classes = [IsAuthenticated, NotAuditorForWrites]

    def post(self, request):
        report_id = request.data.get('report')
        fields = request.data.get('fields', [])
        if not report_id:
            return Response({'error': 'report required'}, status=400)
        report = _get_report(request, report_id)
        if not report:
            return Response({'error': 'Not found'}, status=404)
        if not isinstance(fields, list) or not fields:
            return Response({'error': 'fields must be a non-empty list'}, status=400)

        updated = []
        for f in fields:
            fid = f.get('field_id')
            val = f.get('value')
            if not fid or val is None:
                continue
            obj, _ = ReportField.objects.update_or_create(
                report=report,
                field_id=fid,
                defaults={
                    'value': val,
                    'source': f.get('source', ReportField.Source.DASHBOARD),
                    'confidence': f.get('confidence'),
                    'updated_by': request.user,
                },
            )
            updated.append(obj.field_id)

        try:
            _sync_workspace_to_emission_entries(report, request.user)
        except Exception:
            logger.error('Workspace->EmissionEntry sync failed for report %s', report.id, exc_info=True)

        return Response({'updated': updated, 'count': len(updated)})


@method_decorator(ratelimit(key='user', rate='20/m', method='POST', block=True), name='post')
class WorkspaceChatView(APIView):
    """
    POST /api/chat/workspace/
    Send a message → AI extracts fields → returns PendingSuggestion (NOT saved to ReportField yet).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        report_id = request.data.get('report')
        message = (request.data.get('message') or '').strip()

        if not report_id or not message:
            return Response({'error': 'report and message required'}, status=400)
        if len(message) > 4000:
            return Response({'error': 'Message too long (max 4000 chars)'}, status=400)

        report = _get_report(request, report_id)
        if not report:
            return Response({'error': 'Report not found'}, status=404)

        client = _get_groq()
        if not client:
            return Response({'error': 'AI service unavailable'}, status=503)

        context = _context_summary(report)
        schemas_text = json.dumps(CATEGORY_SCHEMAS, ensure_ascii=False, indent=2)
        system = EXTRACTION_SYSTEM_PROMPT.format(context=context, schemas=schemas_text)

        try:
            completion = client.chat.completions.create(
                model='llama-3.3-70b-versatile',
                messages=[
                    {'role': 'system', 'content': system},
                    {'role': 'user', 'content': message},
                ],
                temperature=0.2,
                max_tokens=1200,
            )
            raw = completion.choices[0].message.content.strip()
        except Exception as e:
            logger.error('Workspace AI error: %s', e)
            return Response({'error': 'AI request failed'}, status=502)

        # Parse JSON from AI
        try:
            # Strip markdown code fences if present
            if raw.startswith('```'):
                raw = raw.split('```')[1]
                if raw.startswith('json'):
                    raw = raw[4:]
            parsed = json.loads(raw)
        except Exception:
            # Graceful fallback: return a plain reply with no suggestions
            return Response({
                'reply': raw[:500],
                'suggestion': None,
            })

        ai_reply = parsed.get('reply', '')
        ai_suggestions = parsed.get('suggestions', [])

        # Save at most one PendingSuggestion per message (the highest confidence one)
        created_suggestion = None
        if ai_suggestions:
            best = max(ai_suggestions, key=lambda s: s.get('confidence', 0))
            avg_conf = sum(
                f.get('confidence', 0.5) for f in best.get('fields', [])
            ) / max(len(best.get('fields', [])), 1)

            created_suggestion = PendingSuggestion.objects.create(
                report=report,
                category=best.get('category', 'UNKNOWN'),
                fields=best.get('fields', []),
                confidence=avg_conf,
                created_by=request.user,
                status=PendingSuggestion.Status.PENDING,
            )

        return Response({
            'reply': ai_reply,
            'suggestion': _serialize_suggestion(created_suggestion) if created_suggestion else None,
        })


class SuggestionConfirmView(APIView):
    """POST /api/chat/suggestions/{id}/confirm/"""
    permission_classes = [IsAuthenticated, NotAuditorForWrites]

    def post(self, request, suggestion_id):
        try:
            suggestion = PendingSuggestion.objects.get(
                id=suggestion_id,
                report__created_by=request.user,
                status=PendingSuggestion.Status.PENDING,
            )
        except PendingSuggestion.DoesNotExist:
            return Response({'error': 'Suggestion not found or already resolved'}, status=404)

        # Allow caller to override field values (Edit flow)
        edited_fields = request.data.get('fields')
        fields_to_save = suggestion.fields

        if edited_fields:
            # Merge: override only the fields the user edited
            edited_map = {f['field_id']: f for f in edited_fields if 'field_id' in f}
            original_val_map = {f['field_id']: f.get('value') for f in fields_to_save}
            fields_to_save = [
                {**f, 'value': _coerce_value(
                    edited_map[f['field_id']]['value'],
                    original_val_map.get(f['field_id']),
                )}
                if f['field_id'] in edited_map else f
                for f in fields_to_save
            ]
            suggestion.status = PendingSuggestion.Status.EDITED
        else:
            suggestion.status = PendingSuggestion.Status.CONFIRMED

        suggestion.confirmed_at = timezone.now()
        suggestion.fields = fields_to_save
        suggestion.save()

        # Write to ReportField
        saved = []
        for f in fields_to_save:
            fid = f.get('field_id')
            val = f.get('value')
            if not fid or val is None:
                continue
            ReportField.objects.update_or_create(
                report=suggestion.report,
                field_id=fid,
                defaults={
                    'value': val,
                    'source': ReportField.Source.CHATBOT,
                    'confidence': f.get('confidence'),
                    'updated_by': request.user,
                },
            )
            saved.append(fid)

        try:
            _sync_workspace_to_emission_entries(suggestion.report, request.user)
        except Exception:
            logger.error('Workspace->EmissionEntry sync failed for report %s', suggestion.report.id, exc_info=True)

        return Response({
            'status': suggestion.status,
            'saved_fields': saved,
            'suggestion': _serialize_suggestion(suggestion),
        })


class SuggestionRejectView(APIView):
    """POST /api/chat/suggestions/{id}/reject/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, suggestion_id):
        try:
            suggestion = PendingSuggestion.objects.get(
                id=suggestion_id,
                report__created_by=request.user,
                status=PendingSuggestion.Status.PENDING,
            )
        except PendingSuggestion.DoesNotExist:
            return Response({'error': 'Suggestion not found or already resolved'}, status=404)

        suggestion.status = PendingSuggestion.Status.REJECTED
        suggestion.save()
        return Response({'status': 'rejected'})


def _serialize_suggestion(s):
    if s is None:
        return None
    return {
        'id': s.id,
        'category': s.category,
        'fields': s.fields,
        'status': s.status,
        'confidence': s.confidence,
        'created_at': s.created_at.isoformat(),
    }
