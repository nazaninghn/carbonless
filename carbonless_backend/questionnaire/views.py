from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
import logging

# Fix #28: Keep in sync with the frontend's CARBONIQ_QUESTIONS.length.
# Verify with:
#   node -e "const s=require('fs').readFileSync('src/lib/carboniq/questions.js','utf8');
#            console.log([...s.matchAll(/^\s{4}id: '[^']+',/gm)].length)"
TOTAL_QUESTIONS = 138


def _progress(completed_count, status):
    """Coarse progress for report *lists*.

    This is deliberately an approximation: of the 138 question objects, 8 are
    info screens and 21 are conditional branches whose reachability depends on
    the user's own answers — and only the client has the question definitions
    needed to evaluate those conditions. So the survey UI computes its own
    exact denominator (see getApplicableQuestions in CarbonAIPage.jsx) and this
    is just for the inventory library's summary bars.

    A finished report therefore has to be special-cased to 100%, or it would
    sit at ~80% forever purely because the user never hit the branches that
    don't apply to them.
    """
    if status == CarbonReport.Status.COMPLETED:
        return {'completed': completed_count, 'total': completed_count, 'percent': 100}
    percent = round(completed_count / TOTAL_QUESTIONS * 100) if TOTAL_QUESTIONS else 0
    return {'completed': completed_count, 'total': TOTAL_QUESTIONS, 'percent': percent}
from django.utils import timezone

logger = logging.getLogger(__name__)
from companies.models import CompanyMembership
from .models import CarbonReport, ReportStep, QuestionnaireSession
from .serializers import (
    StepA1Serializer, StepA2Serializer, StepA3Serializer,
    StepA4Serializer, StepA5Serializer, StepA6Serializer,
    StepA7Serializer, StepA7aSerializer,
    StepB1Serializer, StepB2Serializer, StepB3Serializer,
    StepB4Serializer, StepB5Serializer, StepB6Serializer,
    StepC1Serializer, StepC2Serializer, StepC3Serializer,
    StepD1Serializer, StepD3Serializer, StepD4Serializer,
)
from .step_handlers import handle_step

STEP_SERIALIZERS = {
    'A1': StepA1Serializer, 'A2': StepA2Serializer,
    'A3': StepA3Serializer, 'A4': StepA4Serializer,
    'A5': StepA5Serializer, 'A6': StepA6Serializer,
    'A7': StepA7Serializer, 'A7a': StepA7aSerializer,
    'B1': StepB1Serializer, 'B2': StepB2Serializer,
    'B3': StepB3Serializer, 'B4': StepB4Serializer,
    'B5': StepB5Serializer, 'B6': StepB6Serializer,
    'C1': StepC1Serializer, 'C2': StepC2Serializer,
    'C3': StepC3Serializer, 'D1': StepD1Serializer,
    'D3': StepD3Serializer, 'D4': StepD4Serializer,
}


def extract_profile(session):
    """Extract structured profile from legacy QuestionnaireSession"""
    answers = session.answers or {}
    profile = {'is_complete': session.is_complete, 'session_id': session.pk}

    s1 = answers.get('S1', {})
    sel = s1.get('selected', '')
    if sel == 'C1.1':
        profile['period_type'] = 'calendar_year'
        profile['period_year'] = s1.get('input_C1.1', '')
    elif sel == 'C1.2':
        profile['period_type'] = 'fiscal_year'
        profile['period_range'] = s1.get('input_C1.2', '')
    elif sel == 'C1.3':
        profile['period_type'] = 'custom'
        profile['period_range'] = s1.get('input_C1.3', '')

    s4 = answers.get('S4', {})
    sel4 = s4.get('selected', '')
    profile['has_base_year'] = sel4 == 'C4.1'
    if sel4 == 'C4.1':
        profile['base_year'] = s4.get('input_C4.1', '')

    s5 = answers.get('S5', {})
    selected5 = s5.get('selected', [])
    if isinstance(selected5, str):
        selected5 = [selected5]
    purpose_map = {
        'C5.1': 'iso_14064_verification', 'C5.2': 'internal_reporting',
        'C5.3': 'group_reporting', 'C5.4': 'financing',
        'C5.5': 'export_pressure', 'C5.6': 'other',
    }
    profile['purposes'] = [purpose_map.get(k, k) for k in selected5]

    s6 = answers.get('S6', {})
    sel6 = s6.get('selected', '')
    profile['verification_planned'] = sel6 == 'C6.1'
    profile['verification_within_12m'] = sel6 == 'C6.2'
    if sel6 == 'C6.1':
        profile['verification_date'] = s6.get('input_C6.1', '')

    s7 = answers.get('S7', {})
    source_map = {
        'C7.1': 'national', 'C7.2': 'defra', 'C7.3': 'ipcc',
        'C7.4': 'mixed', 'C7.5': 'unsure',
    }
    profile['preferred_factor_source'] = source_map.get(s7.get('selected', ''), 'mixed')

    s9 = answers.get('S9', {})
    lang_map = {'C9.1': 'tr', 'C9.2': 'en', 'C9.3': 'bilingual'}
    profile['report_language'] = lang_map.get(s9.get('selected', ''), 'tr')
    profile['warnings'] = session.warnings or []
    return profile


def _extract_emission_from_step(step_id, data, report):
    """
    Check if a questionnaire step contains consumption data that should create
    an EmissionEntry. Returns a dict with fuel_type, quantity, unit, etc. or None.
    """
    # Phase 2 consumption steps follow patterns:
    # 3A-5: stationary combustion consumption (quantity + unit per fuel)
    # 3B-7: mobile combustion fuel litres
    # 4A-1a: electricity consumption kWh per facility
    # Data format from frontend: { answer: "15000", unit: "m³", fuel_type: "natural_gas" }
    # or compound: { consumption: "15000", unit: "m³" }

    if not data:
        return None

    # Direct consumption data (most common pattern from frontend questionnaire)
    quantity = (
        data.get('consumption') or data.get('quantity') or
        data.get('answer') or data.get('value')
    )
    if not quantity:
        return None

    # Try to parse as number
    try:
        qty = float(str(quantity).replace(',', '').replace(' ', ''))
    except (ValueError, TypeError):
        return None

    if qty <= 0:
        return None

    fuel_type = data.get('fuel_type', '')
    unit = data.get('unit', '')

    # Determine scope/category based on step pattern
    if step_id.startswith('3A'):
        # Scope 1 - Stationary combustion
        scope = 'scope1'
        if not fuel_type:
            fuel_type = 'natural_gas'  # default
    elif step_id.startswith('3B'):
        # Scope 1 - Mobile combustion
        scope = 'scope1'
        if not fuel_type:
            fuel_type = 'diesel'
    elif step_id.startswith('3C'):
        # Scope 1 - Process emissions
        scope = 'scope1'
        if not fuel_type:
            fuel_type = 'process'
    elif step_id.startswith('4A') or step_id.startswith('4B'):
        # Scope 2 - Electricity
        scope = 'scope2'
        fuel_type = 'electricity'
        if not unit:
            unit = 'kWh'
    elif step_id.startswith('5') or step_id.startswith('6') or step_id.startswith('7'):
        # Scope 3
        scope = 'scope3'
    else:
        return None

    year = report.reporting_year or 2024
    month = data.get('month', 1)  # Default to January (annual data)
    description = data.get('description', f'Questionnaire step {step_id}')

    return {
        'fuel_type': fuel_type,
        'quantity': qty,
        'unit': unit or 'kWh',
        'year': year,
        'month': month,
        'scope': scope,
        'description': description,
        'step_id': step_id,
    }


def _create_entry_from_questionnaire(user, company, emission_data):
    """
    Create an EmissionEntry from questionnaire-extracted data.

    Factor resolution is shared with the AI chat (chat/views.py) via
    emissions/factor_lookup.py, so a fuel_type+unit resolves to the exact same
    registered factor no matter which entry point produced it — no more
    fuzzy slug matching or unit-mismatched factors being silently applied.

    Returns (entry, error) tuple.
    """
    from emissions.models import EmissionEntry
    from emissions.factor_lookup import resolve_factor_and_amount

    if not company:
        return None, 'No company'

    fuel_type = emission_data['fuel_type']
    quantity = emission_data['quantity']
    unit = emission_data['unit']
    year = emission_data['year']
    month = emission_data['month']
    description = emission_data['description']

    factor, qty_decimal, co2e_kg, error = resolve_factor_and_amount(fuel_type, quantity, unit)
    if error:
        return None, error

    # Check for duplicate (same step, same report year, same fuel)
    existing = EmissionEntry.objects.filter(
        user=user, company=company, year=year,
        description__contains=f'step {emission_data["step_id"]}'
    ).first()
    if existing:
        # Update instead of duplicate
        existing.emission_factor = factor
        existing.quantity = qty_decimal
        existing.calculated_co2e_kg = co2e_kg
        existing.factor_value_snapshot = factor.factor_kg_co2e
        existing.factor_source_snapshot = factor.source
        existing.save()
        return existing, None

    entry = EmissionEntry.objects.create(
        user=user,
        company=company,
        emission_factor=factor,
        year=year,
        month=month,
        quantity=qty_decimal,
        calculated_co2e_kg=co2e_kg,
        description=description,
        factor_value_snapshot=factor.factor_kg_co2e,
        factor_source_snapshot=factor.source,
        status='approved',
    )
    return entry, None


class StartReportView(APIView):
    """POST /api/questionnaire/start/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Subscription gate temporarily disabled — all users can access questionnaire
        # TODO: Re-enable when Stripe billing is connected
        # try:
        #     from subscriptions.views import get_or_create_subscription
        #     sub = get_or_create_subscription(request.user)
        #     if not sub.can_use_questionnaire:
        #         return Response(
        #             {'error': 'AI Questionnaire is a Pro feature. Please upgrade your plan.'},
        #             status=403,
        #         )
        # except Exception:
        #     pass

        from companies.utils import get_current_company
        company = get_current_company(request.user)
        if not company:
            return Response({'error': 'No company found. Please create a company first.'}, status=400)

        # If force_new is passed, skip resume and always create new
        force_new = request.data.get('force_new', False)
        title = (request.data.get('title') or '').strip()

        if not force_new:
            existing = CarbonReport.objects.filter(
                company=company,
                status__in=[CarbonReport.Status.DRAFT, CarbonReport.Status.IN_PROGRESS]
            ).first()

            if existing:
                return Response({
                    'report_id': existing.id,
                    'title': existing.title,
                    'current_step': existing.current_step,
                    'resumed': True,
                    'company': {
                        'name': company.legal_entity_name,
                        'tax_id': company.tax_number,
                        'country': company.country_of_headquarters,
                    },
                    'bot_messages': [
                        f"👋 Welcome back! Resuming your report from step **{existing.current_step}**.",
                        f"Company: **{company.legal_entity_name}**"
                    ]
                })

        # Default title if none provided
        if not title:
            from datetime import datetime
            title = f"Carbon Report — {datetime.now().strftime('%Y-%m-%d %H:%M')}"

        report = CarbonReport.objects.create(
            company=company,
            created_by=request.user,
            title=title,
            status=CarbonReport.Status.IN_PROGRESS,
            current_step='A1'
        )

        return Response({
            'report_id': report.id,
            'current_step': 'A1',
            'resumed': False,
            'company': {
                'name': company.legal_entity_name,
                'tax_id': company.tax_number,
                'country': company.country_of_headquarters,
            },
            'bot_messages': [
                "👋 Welcome to **CarbonIQ**! Let's prepare your ISO 14064-1 carbon report.",
                f"I can see your company is **{company.legal_entity_name}**.",
                "Let's start with the company name. Please confirm or enter the full legal name:"
            ]
        }, status=201)


class SubmitStepView(APIView):
    """PATCH /api/questionnaire/<report_id>/step/"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, report_id):
        try:
            report = CarbonReport.objects.get(id=report_id, created_by=request.user)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Report not found'}, status=404)

        step = request.data.get('step')
        data = request.data.get('data', {})

        if not step:
            return Response({'error': 'step is required'}, status=400)

        # Steps with strict serializer validation + DB side-effects.
        # Fix #60b: B1-D4 were missing — their handlers were never called, so
        # company fields (nace_code, employees, facilities, revenue, etc.) and
        # report fields (ef_database, boundary_approach, scope3_approach) were
        # never persisted.  Adding them here routes their saves through the
        # serializer → handle_step() path, matching A1-A7a behaviour.
        STRICT_STEPS = {
            'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A7a',
            'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
            'C1', 'C2', 'C3', 'D1', 'D3', 'D4',
        }

        if step in STRICT_STEPS and step in STEP_SERIALIZERS:
            serializer = STEP_SERIALIZERS[step](data=data)
            if not serializer.is_valid():
                first_error = list(serializer.errors.values())[0]
                if isinstance(first_error, list):
                    first_error = first_error[0]
                return Response({
                    'success': False,
                    'step': step,
                    'errors': serializer.errors,
                    'next_step': step,
                    'bot_messages': [f"❌ {first_error}"]
                }, status=400)

            result = handle_step(report, step, serializer.validated_data)

            if result.get('duplicate'):
                return Response({
                    'success': False,
                    'step': step,
                    'next_step': step,
                    'duplicate': result['duplicate'],
                    'bot_messages': result['bot_messages'],
                    'warnings': result.get('warnings', [])
                })

            ReportStep.objects.update_or_create(
                report=report,
                step_id=step,
                defaults={'answer': serializer.validated_data, 'is_skipped': False}
            )

            next_step = result['next_step']
            report.current_step = next_step
            if next_step == 'PHASE2':
                report.status = CarbonReport.Status.IN_PROGRESS
            report.save()

            return Response({
                'success': True,
                'step': step,
                'next_step': next_step,
                'message': result['message'],
                'warnings': result.get('warnings', []),
                'bot_messages': result['bot_messages'],
                'phase_complete': result.get('phase_complete', False),
                'cluster': result.get('cluster'),
                'suggested_ef': result.get('suggested_ef'),
            })

        # Generic step: store any step answer as raw JSON without strict validation.
        # Covers B1-B6, C1-C3, D1-D4, Stage 2-7 questions (2A-0 … 7B-INFO).
        ReportStep.objects.update_or_create(
            report=report,
            step_id=step,
            defaults={'answer': data if data else {}, 'is_skipped': False}
        )

        # ✅ CRITICAL: Mark report as COMPLETED when final question is submitted
        is_final_step = (
            step == '7B-INFO' and
            isinstance(data, dict) and
            data.get('answer') == 'done'
        )

        if is_final_step:
            report.status = CarbonReport.Status.COMPLETED
            report.current_step = 'DONE'
            report.save(update_fields=['status', 'current_step', 'updated_at'])
            logger.info(f"✅ COMPLETED: Report {report.id} by user {request.user.id}")

            return Response({
                'success': True,
                'step': step,
                'next_step': None,  # ✅ CRITICAL: NULL means done
                'completed': True,
                'status': 'COMPLETED',
                'report_id': report.id,
                'message': 'Survey completed successfully'
            })

        # Not final step - update and continue
        report.current_step = step
        report.save(update_fields=['current_step', 'updated_at'])

        # ── Phase 2: Auto-create EmissionEntry for consumption data steps ──
        # If this step contains emission/consumption data, create a real entry
        saved_entry = None
        emission_data = _extract_emission_from_step(step, data, report)
        if emission_data:
            entry, err = _create_entry_from_questionnaire(
                request.user, report.company, emission_data
            )
            if entry:
                saved_entry = {
                    'id': entry.id,
                    'co2e_kg': float(entry.calculated_co2e_kg),
                    'co2e_tonne': float(entry.calculated_co2e_kg) / 1000,
                    'factor_name': entry.emission_factor.name,
                }

        return Response({
            'success': True,
            'step': step,
            'next_step': step,
            'message': 'Step saved.',
            'warnings': [],
            'bot_messages': [],
            'saved_entry': saved_entry,
        })


class ReportStatusView(APIView):
    """GET /api/questionnaire/<report_id>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        try:
            report = CarbonReport.objects.select_related('company').prefetch_related('steps').get(
                id=report_id, created_by=request.user
            )
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        try:
            # ✅ Get all answers from completed steps
            # Note: ReportStep has no created_at field — only completed_at
            steps = report.steps.all().order_by('completed_at')
            answers = {}
            for step in steps:
                try:
                    answers[step.step_id] = step.answer
                except Exception as e:
                    logger.warning(f'Could not serialize step {step.step_id}: {e}')
                    answers[step.step_id] = None
            completed_steps = list(answers.keys())

            # ✅ Safe company access
            company_data = {}
            if report.company:
                company_data = {
                    'name': report.company.legal_entity_name or 'Unknown',
                    'tax_id': report.company.tax_number or '',
                    'country': report.company.country_of_headquarters or '',
                    'nace_code': report.company.nace_code or '',
                }

            return Response({
                'report_id': report.id,
                'title': report.title or f'Report {report.id}',
                'current_step': report.current_step or 'A1',
                'status': report.status,
                'answers': answers,  # ✅ Include all answers
                'company': company_data,
                'reporting_year': report.reporting_year,
                'ef_database': report.ef_database,
                'boundary_approach': report.boundary_approach,
                'scope3_approach': report.scope3_approach,
                'completed_steps': completed_steps,
                'progress': _progress(len(completed_steps), report.status),
            })
        except Exception as e:
            logger.error(f'Error in ReportStatusView: {e}', exc_info=True)
            return Response({'error': f'Server error: {str(e)}'}, status=500)

    def delete(self, request, report_id):
        """DELETE /api/questionnaire/<report_id>/ — remove a draft/completed inventory."""
        try:
            report = CarbonReport.objects.get(id=report_id, created_by=request.user)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        report.delete()
        return Response(status=204)


# ── Company Profile reuse ─────────────────────────────────────────────────────
# "Company Profile" = Phase 1 = the A1-D4 steps (STRICT_STEPS in SubmitStepView).
# Their answers live as individual ReportStep rows, but the meaningful values
# also get denormalised onto CarbonReport itself by step_handlers.py — both
# need copying for a report to look/behave as if the user answered them fresh.

PHASE1_STEP_IDS = [
    'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A7a',
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
    'C1', 'C2', 'C3', 'D1', 'D3', 'D4',
]

PHASE1_REPORT_FIELDS = [
    'reporting_year', 'prepared_by', 'purposes', 'legal_framework',
    'voluntary_framework', 'has_previous_report', 'baseline_year',
    'has_subsidiaries', 'has_international', 'has_jv_franchise',
    'ef_database', 'ef_custom_source', 'ef_custom_year', 'scope2_method',
    'boundary_approach', 'scope3_approach',
]


def _find_previous_profile_source(report):
    """
    Most recent OTHER CarbonReport for the same company that finished Phase 1
    (has a 'D4' step — i.e. Company Profile was completed there). Any status
    counts (draft/in_progress/completed) — per product decision, we don't
    require the source report to itself be finished/submitted.
    """
    return (
        CarbonReport.objects
        .filter(company=report.company, steps__step_id='D4')
        .exclude(id=report.id)
        .order_by('-updated_at')
        .first()
    )


class PreviousCompanyProfileView(APIView):
    """GET /api/questionnaire/<report_id>/previous-profile/

    Lets the frontend ask "does this company already have a completed
    Company Profile from an earlier report?" before Phase 1 starts, so it can
    offer to reuse it instead of re-asking ~20 questions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        try:
            report = CarbonReport.objects.get(id=report_id, created_by=request.user)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Report not found'}, status=404)

        source = _find_previous_profile_source(report)
        if not source:
            return Response({'available': False})

        answers = {
            step.step_id: step.answer
            for step in source.steps.filter(step_id__in=PHASE1_STEP_IDS)
        }

        return Response({
            'available': True,
            'source_report_id': source.id,
            'company_name': source.company.legal_entity_name,
            'reporting_year': source.reporting_year,
            'updated_at': source.updated_at,
            'answers': answers,
        })


class ReuseCompanyProfileView(APIView):
    """POST /api/questionnaire/<report_id>/reuse-profile/

    Copies the Phase 1 (Company Profile) answers from the company's most
    recent other report into this one, and fast-forwards current_step past
    Phase 1 — used when the user confirms "yes, same info as before".
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, report_id):
        try:
            report = CarbonReport.objects.get(id=report_id, created_by=request.user)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Report not found'}, status=404)

        source = _find_previous_profile_source(report)
        if not source:
            return Response({'error': 'No previous company profile found to reuse'}, status=404)

        for field in PHASE1_REPORT_FIELDS:
            setattr(report, field, getattr(source, field))
        # '2A-0' is the real first Stage-2 question id (see questions.js) —
        # more useful than the 'PHASE2' sentinel step_handlers.py normally
        # writes here, which the frontend has no routing entry for.
        report.current_step = '2A-0'
        report.status = CarbonReport.Status.IN_PROGRESS
        report.save()

        answers = {}
        for step in source.steps.filter(step_id__in=PHASE1_STEP_IDS):
            ReportStep.objects.update_or_create(
                report=report,
                step_id=step.step_id,
                defaults={'answer': step.answer, 'is_skipped': False},
            )
            answers[step.step_id] = step.answer

        return Response({
            'success': True,
            'report_id': report.id,
            'current_step': report.current_step,
            'source_report_id': source.id,
            'answers': answers,
        })


class QuestionnairePDFView(APIView):
    """GET /api/questionnaire/<report_id>/pdf/?lang=en|tr

    Generates the qualitative Carbon Inventory Profile PDF from the
    questionnaire's own answers (company profile, reporting framework,
    boundaries, section coverage) — distinct from /emissions/report/, which
    generates the quantified-emissions PDF from logged EmissionEntry rows.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        try:
            report = CarbonReport.objects.select_related('company').get(
                id=report_id, created_by=request.user
            )
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        lang = request.query_params.get('lang', 'en')
        try:
            from .report_pdf import generate_questionnaire_report
            pdf_bytes = generate_questionnaire_report(report, lang)
        except Exception as e:
            logger.error(f'Questionnaire PDF generation failed for report {report_id}: {e}', exc_info=True)
            return Response({'error': f'PDF generation failed: {e}'}, status=500)

        from django.http import HttpResponse
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="carbon_inventory_profile_{report_id}_{lang}.pdf"'
        return response


class SaveDraftView(APIView):
    """PATCH /api/questionnaire/<report_id>/draft/"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, report_id):
        try:
            report = CarbonReport.objects.get(id=report_id, created_by=request.user)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Report not found'}, status=404)

        if report.status == CarbonReport.Status.COMPLETED:
            return Response(
                {'error': 'Completed report cannot be saved as draft'},
                status=400
            )

        title = (request.data.get('title') or '').strip()
        current_step = request.data.get('current_step')

        if title:
            report.title = title
        if current_step:
            report.current_step = current_step

        report.status = CarbonReport.Status.IN_PROGRESS
        report.save(update_fields=['title', 'current_step', 'status', 'updated_at'])

        return Response({
            'success': True,
            'report_id': report.id,
            'title': report.title,
            'status': report.status,
            'current_step': report.current_step,
            'updated_at': report.updated_at,
        })


class ReportListView(APIView):
    """GET /api/questionnaire/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from companies.utils import get_current_company
        company = get_current_company(request.user)
        if not company:
            return Response({'reports': []})

        reports = CarbonReport.objects.filter(
            company=company, created_by=request.user
        ).select_related('company').prefetch_related('steps').order_by('-updated_at')

        data = []
        for r in reports:
            completed = r.steps.count()
            data.append({
                'report_id': r.id,
                'title': r.title or f'Report — {r.created_at.strftime("%Y-%m-%d")}',
                'company': r.company.legal_entity_name,
                'reporting_year': r.reporting_year,
                'status': str(r.status).lower(),  # ✅ Ensure lowercase
                'current_step': r.current_step,
                'created_at': r.created_at.isoformat() if r.created_at else None,
                'updated_at': r.updated_at.isoformat() if r.updated_at else None,
                'progress': _progress(completed, r.status),
            })
        return Response({'reports': data})


# ── Legacy views (backward compat) ──────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_session(request):
    from .flow import get_question

    # Resume incomplete session if it exists
    existing_incomplete = QuestionnaireSession.objects.filter(user=request.user, is_complete=False).first()
    if existing_incomplete:
        lang = request.data.get('lang', 'tr')
        q = get_question(existing_incomplete.current_question, lang)
        return Response({
            'session_id': existing_incomplete.pk,
            'question': q,
            'answers': existing_incomplete.answers,
            'warnings': existing_incomplete.warnings,
            'resumed': True,
        })

    # No incomplete session exists — create brand new one
    # (This handles both: first-time users AND users starting fresh after completion)
    session = QuestionnaireSession.objects.create(user=request.user)
    lang = request.data.get('lang', 'tr')
    q = get_question('S1', lang)
    return Response({
        'session_id': session.pk,
        'question': q,
        'answers': {},
        'warnings': [],
        'resumed': False,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def answer_question(request):
    from .flow import get_question, process_answer
    session_id = request.data.get('session_id')
    question_id = request.data.get('question_id')
    answer_data = request.data.get('answer', {})
    lang = request.data.get('lang', 'tr')

    try:
        session = QuestionnaireSession.objects.get(pk=session_id, user=request.user)
    except QuestionnaireSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=404)

    if session.is_complete:
        return Response({'error': 'Session already complete'}, status=400)

    session.answers[question_id] = answer_data
    result = process_answer(session.answers, question_id, answer_data)

    if result.get('error'):
        return Response(result, status=400)

    if result['warnings']:
        session.warnings = session.warnings + result['warnings']

    if result['is_complete']:
        session.is_complete = True
        session.completed_at = timezone.now()
        session.current_question = 'DONE'

        # Generate report and sync dashboard
        try:
            from .report_generator import generate_report_from_session
            report = generate_report_from_session(session, request.user)
            if report:
                logger.info(f"Report generated for user {request.user.id}, report {report.id}")
        except Exception as e:
            logger.warning(f"Report generation failed: {e}")
    else:
        session.current_question = result['next_question']

    session.save()

    response = {
        'session_id': session.pk,
        'warnings': result['warnings'],
        'is_complete': result['is_complete'],
        'all_warnings': session.warnings,
    }

    if not result['is_complete']:
        response['question'] = get_question(result['next_question'], lang)
    else:
        response['summary'] = session.answers
        # Add report summary with results and dashboard link (ALWAYS provide, no exceptions)
        report_summary = None
        try:
            from .report_generator import build_report_summary
            # Don't call generate_report_from_session again — it was already called above!
            # Just fetch the report that was created
            from companies.utils import get_current_company
            from questionnaire.models import CarbonReport
            company = get_current_company(request.user)

            if company:
                reporting_year = timezone.now().year
                report = CarbonReport.objects.filter(
                    company=company,
                    status=CarbonReport.Status.COMPLETED
                ).order_by('-created_at').first()

                if report:
                    report_summary = build_report_summary(report, request.user)
                    response['report_id'] = report.id
                    logger.info(f"✅ Report retrieved for user {request.user.id}: {report.id}")
                else:
                    # Report not in DB yet? Use minimal
                    logger.warning(f"No report found in DB for user {request.user.id}")
                    report_summary = {
                        'status': 'Complete ✅',
                        'message': '✅ Questionnaire complete! You can now log emissions via Chat.'
                    }
            else:
                logger.warning(f"No company for user {request.user.id}")
                report_summary = {
                    'status': 'Complete ✅',
                    'message': '✅ Questionnaire complete! Set up company and log emissions via Chat.'
                }
        except Exception as e:
            logger.error(f"Report summary retrieval FAILED: {e}", exc_info=True)
            report_summary = {
                'status': 'Complete ✅',
                'message': '✅ Questionnaire complete! You can now log emissions via Chat.'
            }

        # ALWAYS add report_summary to response
        if report_summary:
            response['report_summary'] = report_summary

        response['next_action'] = {
            'message': '✅ Questionnaire Complete!',
            'subtitle': 'Ready to log emissions via Chat?',
            'action': 'open_chat',
            'link': '/app/chat'
        }

    return Response(response)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_sessions(request):
    sessions = QuestionnaireSession.objects.filter(user=request.user)
    data = [{
        'id': s.pk, 'started_at': s.started_at, 'completed_at': s.completed_at,
        'is_complete': s.is_complete, 'current_question': s.current_question,
        'answers': s.answers, 'warnings': s.warnings,
    } for s in sessions]
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_session(request):
    """Reset/delete current session (complete or incomplete) and start fresh."""
    from .flow import get_question
    from .models import CarbonReport

    # Delete ALL legacy sessions (both incomplete and complete)
    QuestionnaireSession.objects.filter(user=request.user).delete()

    # Mark any IN_PROGRESS CarbonReport as completed so StartReportView creates a new one
    from companies.utils import get_current_company
    company = get_current_company(request.user)
    if company:
        CarbonReport.objects.filter(
            company=company,
            status__in=[CarbonReport.Status.DRAFT, CarbonReport.Status.IN_PROGRESS],
        ).update(status=CarbonReport.Status.COMPLETED)

    return Response({
        'status': 'reset',
        'message': 'Questionnaire reset. You can start a new survey.',
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_report_summary(request, report_id=None):
    """GET /api/questionnaire/report/<report_id>/ or /api/questionnaire/report/latest/"""
    try:
        from companies.utils import get_current_company
        company = get_current_company(request.user)
        if not company:
            return Response({'error': 'No company found'}, status=400)

        if report_id == 'latest':
            report = CarbonReport.objects.filter(
                company=company,
                status=CarbonReport.Status.COMPLETED
            ).order_by('-created_at').first()
        elif report_id:
            report = CarbonReport.objects.get(id=report_id, company=company)
        else:
            # List all reports
            reports = CarbonReport.objects.filter(company=company).values(
                'id', 'status', 'reporting_year', 'created_at', 'current_step'
            ).order_by('-created_at')
            return Response({'reports': list(reports)})

        if not report:
            return Response({'error': 'Report not found'}, status=404)

        from .report_generator import build_report_summary
        summary = build_report_summary(report, request.user)

        return Response({
            'report': summary,
            'status': report.status,
        })
    except Exception as e:
        logger.error(f"Get report summary failed: {e}")
        return Response({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_profile(request):
    session = QuestionnaireSession.objects.filter(user=request.user, is_complete=True).first()
    if not session:
        incomplete = QuestionnaireSession.objects.filter(user=request.user, is_complete=False).first()
        if incomplete:
            return Response({
                'status': 'incomplete',
                'current_question': incomplete.current_question,
                'progress': list(incomplete.answers.keys()),
            })
        return Response({'status': 'not_started'})
    profile = extract_profile(session)
    profile['status'] = 'complete'
    return Response(profile)
