"""
Workspace API views — ReportField + PendingSuggestion + AI Chat with extraction.
"""
import json
import logging
import os
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .models import CarbonReport, ReportField, PendingSuggestion

logger = logging.getLogger(__name__)

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


def _context_summary(report):
    """Build a compact text summary of existing ReportFields for the AI prompt."""
    values, _ = _fields_map(report)
    if not values:
        return 'No data entered yet.'
    lines = [f'- {k}: {v}' for k, v in list(values.items())[:40]]
    return '\n'.join(lines)


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
        'label': 'Electricity',
        'fields': [
            {'field_id': 'rf.4a.consumption_kwh', 'label': 'Electricity (kWh)', 'type': 'number'},
            {'field_id': 'rf.4a.supplier',        'label': 'Supplier',          'type': 'string'},
            {'field_id': 'rf.4a.renewable_pct',   'label': 'Renewable %',       'type': 'number'},
        ],
    },
    'K4': {
        'label': 'Upstream Transport',
        'fields': [
            {'field_id': 'rf.k4.transport_mode',  'label': 'Transport mode',   'type': 'string'},
            {'field_id': 'rf.k4.distance_km',     'label': 'Distance (km)',    'type': 'number'},
            {'field_id': 'rf.k4.cargo_tonnes',    'label': 'Cargo (tonnes)',   'type': 'number'},
            {'field_id': 'rf.k4.tkm',             'label': 'tonne-km',         'type': 'number'},
        ],
    },
}

EXTRACTION_SYSTEM_PROMPT = """You are CarbonIQ, an expert carbon accounting AI.
Your task: extract structured emission data from the user's message.

EXISTING REPORT DATA (do NOT re-extract these unless the user explicitly updates them):
{context}

FIELD SCHEMAS (extract only from these categories):
{schemas}

Reply with ONLY valid JSON in this format (no markdown, no explanation):
{{
  "reply": "A short friendly message to the user (1-2 sentences, same language as user).",
  "suggestions": [
    {{
      "category": "3A",
      "confidence": 0.85,
      "fields": [
        {{"field_id": "rf.3a.fuel_type", "label": "Fuel type", "value": "natural_gas", "confidence": 0.9}},
        {{"field_id": "rf.3a.consumption", "label": "Consumption", "value": 15000, "unit": "m3", "confidence": 0.82}}
      ]
    }}
  ]
}}

Rules:
- suggestions list can be empty [] if nothing extractable is found.
- Only include fields you are confident about (confidence > 0.5).
- Keep "reply" conversational and in the same language the user wrote in.
- Do NOT invent data. Only extract from the user message.
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
    permission_classes = [IsAuthenticated]

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

        return Response({'updated': updated, 'count': len(updated)})


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

        # Allow caller to override field values (Edit flow)
        edited_fields = request.data.get('fields')
        fields_to_save = suggestion.fields

        if edited_fields:
            # Merge: override only the fields the user edited
            edited_map = {f['field_id']: f for f in edited_fields if 'field_id' in f}
            fields_to_save = [
                {**f, 'value': edited_map[f['field_id']]['value']}
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
