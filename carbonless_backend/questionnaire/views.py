from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from companies.permissions import NotAuditorForWrites
from .step_entries import sync_step_entries
import logging
import re
import time

# Denominator for a draft's progress in report lists: the questions every
# user is asked — CARBONIQ_QUESTIONS that are not `type: 'info'` screens and
# have no `conditionalShow` (120 of the 157 objects). It is the same number the
# survey's own progress sidebar starts from ("0 / 120"), so the inventory
# library and the survey agree; the raw object count (157) made a draft look
# far less complete there than the survey itself said. Keep in sync with
# questions.js:
#   CARBONIQ_QUESTIONS.filter(q => q.type !== 'info' && !q.conditionalShow).length
BASELINE_QUESTIONS = 120


def _client_progress_from(payload):
    """The questionnaire's own {answered, total} progress, if sent and sane."""
    if not isinstance(payload, dict):
        return None
    try:
        answered, total = int(payload.get('answered')), int(payload.get('total'))
    except (TypeError, ValueError):
        return None
    if total <= 0 or answered < 0 or answered > total or total > 1000:
        return None
    return {'answered': answered, 'total': total}


def _progress(completed_count, status, client_progress=None):
    """Coarse progress for report *lists*.

    This is deliberately an approximation: of the 157 question objects, 8 are
    info screens and 29 are conditional branches whose reachability depends on
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
    client = _client_progress_from(client_progress)
    if client:
        # Same numbers the survey's own progress bar shows.
        percent = min(99, round(client['answered'] / client['total'] * 100))
        return {'completed': client['answered'], 'total': client['total'], 'percent': percent}
    total = max(BASELINE_QUESTIONS, completed_count)
    # Branches can push a draft past the baseline; it is still not done, so
    # never show 100% before the report is actually completed.
    percent = min(99, round(completed_count / total * 100)) if total else 0
    return {'completed': completed_count, 'total': total, 'percent': percent}
from django.utils import timezone

logger = logging.getLogger(__name__)
from django.db import IntegrityError, OperationalError, transaction
from companies.models import CompanyMembership
from .models import CarbonReport, ReportStep, QuestionnaireSession, AdvisorApproval
from .advisor_triggers import evaluate_advisor_triggers


def _save_report_step(report, step_id, answer, is_skipped=False):
    """update_or_create for ReportStep, safe against the same step being
    submitted twice at once (a double-tap, or a client-side retry racing the
    original request — both real, observed in production).

    ReportStep has unique_together = ['report', 'step_id']. Plain
    update_or_create() first checks for an existing row and only inserts if
    none is found — classic check-then-act, not atomic. Two concurrent
    requests for a step that doesn't exist yet can both pass that check and
    both attempt to INSERT: one succeeds, the other hits the unique
    constraint (IntegrityError on Postgres) or SQLite's writer lock
    (OperationalError: database is locked) — previously unhandled, so it
    surfaced as a raw 500 and the frontend showed a bare "Save failed" with
    no way for the user to recover except retrying into the same race again.

    On conflict, retry the whole operation a few times with a short backoff
    rather than immediately reading the row: on SQLite the other writer's
    transaction may not have committed yet at the instant this one's insert
    is rejected, so an immediate .get() can itself raise DoesNotExist. A
    short retry loop is safe either way — update_or_create is idempotent.
    """
    last_exc = None
    for attempt in range(5):
        try:
            with transaction.atomic():
                return ReportStep.objects.update_or_create(
                    report=report, step_id=step_id,
                    defaults={'answer': answer, 'is_skipped': is_skipped},
                )
        except (IntegrityError, OperationalError) as exc:
            last_exc = exc
            time.sleep(0.05 * (attempt + 1))
    raise last_exc
from .serializers import (
    StepA1Serializer, StepA2Serializer, StepA3Serializer,
    StepA4Serializer, StepA5Serializer, StepA6Serializer,
    StepA7Serializer, StepA7aSerializer, StepA7bSerializer,
    StepB1Serializer, StepB2Serializer, StepB3Serializer,
    StepB4Serializer, StepB5Serializer, StepB6Serializer,
    StepC1Serializer, StepC2Serializer, StepC3Serializer,
    StepD1Serializer, StepD3Serializer, StepD4Serializer,
)
from .step_handlers import handle_step, STRICT_STEP_ORDER

STEP_SERIALIZERS = {
    'A1': StepA1Serializer, 'A2': StepA2Serializer,
    'A3': StepA3Serializer, 'A4': StepA4Serializer,
    'A5': StepA5Serializer, 'A6': StepA6Serializer,
    'A7': StepA7Serializer, 'A7a': StepA7aSerializer, 'A7b': StepA7bSerializer,
    'B1': StepB1Serializer, 'B2': StepB2Serializer,
    'B3': StepB3Serializer, 'B4': StepB4Serializer,
    'B5': StepB5Serializer, 'B6': StepB6Serializer,
    'C1': StepC1Serializer, 'C2': StepC2Serializer,
    'C3': StepC3Serializer, 'D1': StepD1Serializer,
    'D3': StepD3Serializer, 'D4': StepD4Serializer,
}


def extract_profile(session):
    """
    Read-only helper: reconstructs a display profile from a completed legacy
    QuestionnaireSession. The legacy creation/answering endpoints are gone,
    but sessions completed under that flow before the cutover still exist in
    the DB, and emissions.views.emission_summary falls back to this to render
    those companies' profile data in ReportingTab instead of showing blanks.
    """
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


def _company_reports(user):
    """Inventories of every company the user is an active member of.

    An inventory belongs to the company, not only to whoever started it: an
    admin or manager must be able to open, continue and download the reports
    of an inventory a teammate created (auditors stay read-only through
    NotAuditorForWrites)."""
    return CarbonReport.objects.filter(
        company__memberships__user=user, company__memberships__is_active=True,
    ).distinct()


class StartReportView(APIView):
    """POST /api/questionnaire/start/"""
    permission_classes = [IsAuthenticated, NotAuditorForWrites]

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


@method_decorator(ratelimit(key='user', rate='60/m', method='PATCH', block=True), name='patch')
class SubmitStepView(APIView):
    """PATCH /api/questionnaire/<report_id>/step/"""
    permission_classes = [IsAuthenticated, NotAuditorForWrites]

    def patch(self, request, report_id):
        try:
            report = _company_reports(request.user).get(id=report_id)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Report not found'}, status=404)

        step = request.data.get('step')
        data = request.data.get('data', {})

        if not step:
            return Response({'error': 'step is required'}, status=400)

        # Stored with whichever save below succeeds (validation failures
        # return before saving, so a rejected answer doesn't move it).
        client_progress = _client_progress_from(request.data.get('progress'))
        if client_progress:
            report.client_progress = client_progress

        # Steps with strict serializer validation + DB side-effects.
        # Fix #60b: B1-D4 were missing — their handlers were never called, so
        # company fields (nace_code, employees, facilities, revenue, etc.) and
        # report fields (ef_database, boundary_approach, scope3_approach) were
        # never persisted.  Adding them here routes their saves through the
        # serializer → handle_step() path, matching A1-A7a behaviour.
        STRICT_STEPS = {
            'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A7a', 'A7b',
            'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
            'C1', 'C2', 'C3', 'D1', 'D3', 'D4',
        }

        if step in STRICT_STEPS and step in STEP_SERIALIZERS:
            serializer = STEP_SERIALIZERS[step](data=data, context={
                'company': report.company, 'lang': request.data.get('language') or 'en'})
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
                # A conflict, not a success: the answer was NOT saved. This
                # used to come back as 200 (so the questionnaire moved on and
                # the answer was silently lost) and named the other company,
                # which let anyone look up who is registered under a tax ID.
                msg = (
                    'Bu vergi numarası Carbonless\'ta başka bir şirket hesabında kayıtlı. '
                    'Numarayı kontrol edin; doğruysa bizimle iletişime geçin.'
                    if request.data.get('language') == 'tr' else
                    'This tax number is already used by another company account on Carbonless. '
                    'Please check it; if it is correct, contact us.'
                )
                return Response({
                    'success': False,
                    'step': step,
                    'next_step': step,
                    'error': msg,
                    'code': 'duplicate_tax_id',
                    'bot_messages': [msg],
                    'warnings': result.get('warnings', []),
                }, status=409)

            _save_report_step(report, step, serializer.validated_data)
            evaluate_advisor_triggers(report, step, serializer.validated_data)

            next_step = result['next_step']
            # Only move current_step forward. Re-submitting an earlier step
            # (e.g. via the review table's per-question Edit button, reachable
            # at any point after that step's block is complete) used to
            # unconditionally overwrite current_step with ITS next_step,
            # rewinding the resume pointer even though nothing past it was
            # lost — a save-and-exit right after such an edit then forced the
            # user to click through every already-answered question again.
            # `current_idx is None` means current_step has already left the
            # strict A-D flow (a Phase-2 id, or 'DONE') — never let a strict-
            # step edit pull it back.
            current_idx = (
                STRICT_STEP_ORDER.index(report.current_step)
                if report.current_step in STRICT_STEP_ORDER else None
            )
            next_idx = (
                STRICT_STEP_ORDER.index(next_step)
                if next_step in STRICT_STEP_ORDER else len(STRICT_STEP_ORDER)
            )
            if current_idx is not None and next_idx > current_idx:
                report.current_step = next_step
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

        # Generic step: covers Stage 2-7 questions (2A-0 … 7B-INFO). Validated
        # against the extracted CarbonIQ schema (type/options/units/bounds) so
        # a numeric question can't be saved as garbage text, a select can't be
        # saved with a value outside its option list, etc. — this used to be
        # enforced only client-side.
        from .carboniq_validation import validate_generic_step
        lang = request.data.get('language') or 'en'
        is_valid, validation_error = validate_generic_step(step, data, lang=lang)
        if not is_valid:
            return Response({
                'success': False,
                'step': step,
                'next_step': step,
                'error': validation_error,
                'bot_messages': [f'❌ {validation_error}'],
            }, status=400)

        _save_report_step(report, step, data if data else {})
        evaluate_advisor_triggers(report, step, data)

        # ✅ CRITICAL: Mark report as COMPLETED when final question is submitted
        is_final_step = (
            step == '7B-INFO' and
            isinstance(data, dict) and
            data.get('answer') == 'done'
        )

        if is_final_step:
            # Completion used to be gated purely on "was 7B-INFO answered
            # 'done'", with no check that anything came before it. Verified
            # live: PATCHing a brand-new report (nothing saved but the
            # auto-created A1) straight to 7B-INFO/'done' instantly marked it
            # COMPLETED and both PDF exports generated successfully for an
            # essentially empty report. Exact per-user question counts can't
            # be replicated here (only the frontend's getApplicableQuestions
            # knows which of the ~130 Phase-2 questions apply after
            # conditional branches — see _progress()'s docstring above), so
            # this is a floor, not an exact check: Phase 1 must have actually
            # finished (handle_D4 flips status to IN_PROGRESS) and a
            # meaningful number of Phase-2 answers must exist.
            PHASE1_STEP_IDS = {
                'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A7a', 'A7b',
                'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
                'C1', 'C2', 'C3', 'D1', 'D3', 'D4',
            }
            MIN_PHASE2_STEPS = 15
            phase2_count = report.steps.exclude(step_id__in=PHASE1_STEP_IDS).count()
            if report.status == CarbonReport.Status.DRAFT or phase2_count < MIN_PHASE2_STEPS:
                return Response({
                    'success': False,
                    'step': step,
                    'next_step': step,
                    'error': 'This inventory cannot be marked complete yet — required questions have not been answered.',
                    'bot_messages': [
                        '❌ This inventory cannot be marked complete yet — required questions have not been answered.'
                    ],
                }, status=400)

            report.status = CarbonReport.Status.COMPLETED
            report.current_step = 'DONE'
            report.save(update_fields=['status', 'current_step', 'updated_at', 'client_progress'])
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
        report.save(update_fields=['current_step', 'updated_at', 'client_progress'])

        # ── Phase 2: questions that ask for an activity amount (fuel, electricity,
        # freight, waste) become EmissionEntry rows; see step_entries.py ──
        saved_entry = None
        if step == '2A-2':
            # The facility names/countries answered here become the company's
            # real facilities (emissions form, Settings, reports).
            from .facility_sync import sync_facilities
            sync_facilities(report.company, data)
        entries = sync_step_entries(request.user, report.company, report, step, data)
        if entries:
            co2e_kg = sum(float(e.calculated_co2e_kg) for e in entries)
            saved_entry = {
                'id': entries[0].id,
                'co2e_kg': co2e_kg,
                'co2e_tonne': co2e_kg / 1000,
                'factor_name': ', '.join(e.emission_factor.name for e in entries),
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
    """GET /api/questionnaire/<report_id>/ — also handles DELETE."""
    permission_classes = [IsAuthenticated, NotAuditorForWrites]

    def get(self, request, report_id):
        try:
            report = _company_reports(request.user).select_related('company').prefetch_related('steps').get(id=report_id)
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
                # Who started this inventory, when it wasn't the requester —
                # the questionnaire says "baris started it" instead of
                # "welcome back" to a team mate opening it the first time.
                'started_by': (
                    None if not report.created_by_id or report.created_by_id == request.user.id
                    else (report.created_by.get_full_name() or report.created_by.email or report.created_by.username)
                ),
                'progress': _progress(len(completed_steps), report.status, report.client_progress),
            })
        except Exception as e:
            logger.error(f'Error in ReportStatusView: {e}', exc_info=True)
            return Response({'error': f'Server error: {str(e)}'}, status=500)

    def delete(self, request, report_id):
        """DELETE /api/questionnaire/<report_id>/ — remove a draft/completed inventory."""
        try:
            report = _company_reports(request.user).get(id=report_id)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        if report.created_by_id != request.user.id:
            from companies.models import CompanyMembership
            if not CompanyMembership.objects.filter(
                company=report.company, user=request.user, is_active=True,
                role__in=('owner', 'admin'),
            ).exists():
                return Response({'error': 'Only the creator or a company owner/admin can delete this inventory.',
                                 'code': 'forbidden'}, status=403)

        # The emission entries the questionnaire created for this inventory go
        # with it — unless another inventory covers the same year, since
        # entries are kept per company and year and are shared with it. Chat
        # and form entries are never touched.
        deleted_entries = 0
        year = report.reporting_year
        if year and not CarbonReport.objects.filter(
                company=report.company, reporting_year=year).exclude(id=report.id).exists():
            from emissions.models import EmissionEntry
            deleted_entries, _ = EmissionEntry.objects.filter(
                company=report.company, year=year,
                description__startswith='Questionnaire step ',
            ).delete()

        report.delete()
        return Response({'deleted_entries': deleted_entries}, status=200)


# ── Company Profile reuse ─────────────────────────────────────────────────────
# "Company Profile" = Phase 1 = the A1-D4 steps (STRICT_STEPS in SubmitStepView).
# Their answers live as individual ReportStep rows, but the meaningful values
# also get denormalised onto CarbonReport itself by step_handlers.py — both
# need copying for a report to look/behave as if the user answered them fresh.

PHASE1_STEP_IDS = [
    'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A7a', 'A7b',
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


def _registration_prefill_answers(company):
    """Phase-1 answers derivable from what the user entered at sign-up."""
    answers = {}
    if company is None:
        return answers
    name = (company.legal_entity_name or '').strip()
    if name:
        answers['A1'] = {'legal_name': name}
    tax = (company.tax_number or '').strip()
    # Registration treats the tax number as optional; only offer it when A2
    # would accept it (VKN/TCKN for a Turkish company, any registration
    # number for one based elsewhere).
    from .serializers import StepA2Serializer
    if tax and StepA2Serializer(data={'tax_id': tax}, context={'company': company}).is_valid():
        answers['A2'] = {'tax_id': tax}
    return answers


def _facility_count(company):
    """Facilities registered today (sign-up or Settings). Only a hint for
    B4: an inventory for an earlier year may have had a different number, so
    it is never filled in as the answer."""
    return company.facilities.count() if company else 0


def _find_previous_profile_source(report):
    """
    Most recent OTHER CarbonReport for the same company that has ANY Phase 1
    (Company Profile) step answered. Any status counts (draft/in_progress/
    completed) — per product decision, we don't require the source report to
    itself be finished/submitted.

    Previously this required the exact 'D4' step (the last Phase 1 question),
    so a report that had answered most of Phase 1 but not reached that final
    question — e.g. one resumed mid-way, or one seeded/imported without a
    full step trail — was invisible to the reuse-profile offer even though it
    clearly had reusable company data. Matching on any PHASE1_STEP_IDS entry
    is a much lower bar and reflects what the feature is actually for.
    """
    return (
        CarbonReport.objects
        .filter(company=report.company, steps__step_id__in=PHASE1_STEP_IDS)
        .exclude(id=report.id)
        .order_by('-updated_at')
        .first()
    )


def _other_inventories(report):
    """The company's other inventories, so the survey can warn before a second
    inventory is started for a year that already has one: emission entries are
    kept per company and year, so both would share (and overwrite) one set of
    numbers."""
    return [
        {'report_id': r.id, 'title': r.title, 'reporting_year': r.reporting_year,
         'status': r.status}
        for r in (CarbonReport.objects
                  .filter(company=report.company, reporting_year__isnull=False)
                  .exclude(id=report.id)
                  .order_by('-reporting_year', '-created_at'))
    ]


class PreviousCompanyProfileView(APIView):
    """GET /api/questionnaire/<report_id>/previous-profile/

    Lets the frontend ask "does this company already have a completed
    Company Profile from an earlier report?" before Phase 1 starts, so it can
    offer to reuse it instead of re-asking ~20 questions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        try:
            report = _company_reports(request.user).get(id=report_id)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Report not found'}, status=404)

        source = _find_previous_profile_source(report)
        if not source:
            # No earlier report to reuse, but the company was already named
            # (and maybe given a tax number) at registration — hand those back
            # so the first questions arrive pre-filled instead of re-asking
            # what the user just typed. Same answer shape as a stored step, so
            # the frontend's unmapPhase1Answer reads it unchanged.
            return Response({
                'available': False,
                'answers': _registration_prefill_answers(report.company),
                'other_inventories': _other_inventories(report),
                'facility_count': _facility_count(report.company),
            })

        # The earlier report's answers win; anything it never answered falls
        # back to what the company entered at registration.
        registration = _registration_prefill_answers(report.company)
        answers = dict(registration)
        answers.update({
            step.step_id: step.answer
            for step in source.steps.filter(step_id__in=PHASE1_STEP_IDS)
        })

        return Response({
            'available': True,
            'source_report_id': source.id,
            'company_name': source.company.legal_entity_name,
            'reporting_year': source.reporting_year,
            'updated_at': source.updated_at,
            'answers': answers,
            # What the user answers "No, let me re-enter" with: only the name
            # and tax number from sign-up, nothing from the earlier report.
            'registration_answers': registration,
            'other_inventories': _other_inventories(report),
            'facility_count': _facility_count(report.company),
        })


class ReuseCompanyProfileView(APIView):
    """POST /api/questionnaire/<report_id>/reuse-profile/

    Copies the Phase 1 (Company Profile) answers from the company's most
    recent other report into this one, and fast-forwards current_step past
    Phase 1 — used when the user confirms "yes, same info as before".
    """
    permission_classes = [IsAuthenticated, NotAuditorForWrites]

    def post(self, request, report_id):
        try:
            report = _company_reports(request.user).get(id=report_id)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Report not found'}, status=404)

        source = _find_previous_profile_source(report)
        if not source:
            return Response({'error': 'No previous company profile found to reuse'}, status=404)

        # The reporting year is this inventory's own: it is chosen in the
        # reuse dialog, never copied (copying it made a "2025" inventory a
        # second 2020 one that overwrote the first one's numbers).
        year = request.data.get('reporting_year')
        try:
            year = int(year)
        except (TypeError, ValueError):
            return Response({'error': 'reporting_year is required', 'code': 'year_required'}, status=400)
        from django.utils import timezone
        if not 1990 <= year <= timezone.now().year:
            return Response({'error': 'Invalid reporting year', 'code': 'invalid_year'}, status=400)

        for field in PHASE1_REPORT_FIELDS:
            if field != 'reporting_year':
                setattr(report, field, getattr(source, field))
        report.reporting_year = year
        # '2A-0' is the real first Stage-2 question id (see questions.js) —
        # more useful than the 'PHASE2' sentinel step_handlers.py normally
        # writes here, which the frontend has no routing entry for.
        report.current_step = '2A-0'
        report.status = CarbonReport.Status.IN_PROGRESS
        report.save()

        answers = {}
        for step in source.steps.filter(step_id__in=PHASE1_STEP_IDS).exclude(step_id='A4'):
            ReportStep.objects.update_or_create(
                report=report,
                step_id=step.step_id,
                defaults={'answer': step.answer, 'is_skipped': False},
            )
            answers[step.step_id] = step.answer
        ReportStep.objects.update_or_create(
            report=report, step_id='A4',
            defaults={'answer': {'reporting_year': year}, 'is_skipped': False},
        )
        answers['A4'] = {'reporting_year': year}

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
            report = _company_reports(request.user).select_related('company').get(id=report_id)
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


class ISOInventoryReportView(APIView):
    """GET /api/questionnaire/<report_id>/iso-report/?lang=en|tr

    The full ISO 14064-1:2018 GHG inventory report — organisational
    information, boundaries, methodology, exclusions and assumptions, the
    inventory table itself and the per-category analyses, laid out in the
    six-category structure the standard uses.

    Distinct from the two narrower PDFs: /pdf/ above is the qualitative
    questionnaire profile, and /emissions/report/ is the Scope 1/2/3
    quantified summary.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        try:
            report = _company_reports(request.user).select_related('company').get(id=report_id)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        lang = 'tr' if request.query_params.get('lang') == 'tr' else 'en'
        try:
            from .iso_report_pdf import generate_iso_report
            pdf_bytes = generate_iso_report(report, lang)
        except Exception as e:
            logger.error(
                f'ISO 14064-1 report generation failed for report {report_id}: {e}',
                exc_info=True,
            )
            return Response({'error': f'Report generation failed: {e}'}, status=500)

        from django.http import HttpResponse
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        year = report.reporting_year or ''
        response['Content-Disposition'] = (
            f'attachment; filename="iso14064-1_inventory_report_{year}_{lang}.pdf"'
        )
        return response


class CombinedReportView(APIView):
    """GET /api/questionnaire/<report_id>/combined-report/?lang=en|tr&year=YYYY

    All three reports bound into one PDF: the full ISO 14064-1 inventory, the
    qualitative Carbon Inventory Profile, and the quantified Scope 1/2/3
    summary, with continuous page numbering, a contents page and PDF
    bookmarks. The three remain available separately from the endpoints above.

    `year` scopes the emissions summary and defaults to the report's own
    reporting year, so every part of a pack covers the same period.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        try:
            report = _company_reports(request.user).select_related('company').get(id=report_id)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        lang = 'tr' if request.query_params.get('lang') == 'tr' else 'en'
        year = request.query_params.get('year')
        try:
            year = int(year) if year else None
        except ValueError:
            return Response({'error': 'year must be a whole number'}, status=400)

        try:
            from .combined_report_pdf import generate_combined_report
            pdf_bytes = generate_combined_report(report, lang, year)
        except Exception as e:
            logger.error(
                f'Combined report generation failed for report {report_id}: {e}',
                exc_info=True,
            )
            return Response({'error': f'Report generation failed: {e}'}, status=500)

        from django.http import HttpResponse
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        stamp = year or report.reporting_year or ''
        response['Content-Disposition'] = (
            f'attachment; filename="ghg_reporting_pack_{stamp}_{lang}.pdf"'
        )
        return response


class SaveDraftView(APIView):
    """PATCH /api/questionnaire/<report_id>/draft/"""
    permission_classes = [IsAuthenticated, NotAuditorForWrites]

    def patch(self, request, report_id):
        try:
            report = _company_reports(request.user).get(id=report_id)
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
            company=company
        ).select_related('company', 'created_by').prefetch_related('steps').order_by('-updated_at')

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
                'progress': _progress(completed, r.status, r.client_progress),
                # Who started it, when that was a teammate (None for your own).
                'created_by': (
                    None if r.created_by_id == request.user.id or not r.created_by
                    else (r.created_by.get_full_name() or r.created_by.email or r.created_by.username)
                ),
            })
        return Response({'reports': data})


@api_view(['POST'])
@permission_classes([IsAuthenticated, NotAuditorForWrites])
def reset_session(request):
    """Reset/delete current session (complete or incomplete) and start fresh."""
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
def pending_advisor_approvals_view(request):
    """GET /api/questionnaire/advisor-approvals/pending/
    List pending Danışman Onayı flags across all of the current company's
    reports (for the ReviewTab "Onay Bekleyenler" inbox)."""
    from companies.utils import get_current_company
    company = get_current_company(request.user)
    if not company:
        return Response([])

    approvals = AdvisorApproval.objects.filter(
        report__company=company, status=AdvisorApproval.Status.PENDING
    ).select_related('report').order_by('-created_at')

    # The flagged answer itself, so the approver sees what they approve
    # (the card used to show only the question). ReportStep.answer holds
    # {"answer": <value>} for most steps; older rows hold the value directly.
    approvals = list(approvals)
    steps = {
        (s.report_id, s.step_id): s.answer
        for s in ReportStep.objects.filter(
            report_id__in={a.report_id for a in approvals},
            step_id__in={a.question_id for a in approvals},
        )
    }

    def _answer(a):
        raw = steps.get((a.report_id, a.question_id))
        if isinstance(raw, dict) and set(raw) == {'answer'}:
            return raw['answer']
        return raw

    return Response([{
        'id': a.id,
        'report_id': a.report_id,
        'report_title': a.report.title or f'Report {a.report_id}',
        'reporting_year': a.report.reporting_year,
        'answer': _answer(a),
        'question_id': a.question_id,
        'field_id': a.field_id,
        'reason_code': a.reason_code,
        'trigger_category': a.trigger_category,
        'risk_level': a.risk_level,
        'description': a.description,
        'created_at': a.created_at,
    } for a in approvals])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_advisor_approval_view(request, pk):
    """POST /api/questionnaire/advisor-approvals/<pk>/approve/
    Approve or reject a Danışman Onayı flag (manager/admin only) — mirrors
    emissions.approve_entry_view's role check and action contract exactly."""
    from companies.utils import get_current_company
    company = get_current_company(request.user)
    if not company:
        return Response({'error': 'No company'}, status=403)

    APPROVER_ROLES = {'owner', 'admin', 'manager'}
    membership = request.user.company_memberships.filter(
        company=company, is_active=True
    ).first()
    if not membership or membership.role not in APPROVER_ROLES:
        return Response({'error': 'Only managers and admins can approve entries'}, status=403)

    try:
        approval = AdvisorApproval.objects.get(pk=pk, report__company=company)
    except AdvisorApproval.DoesNotExist:
        return Response({'error': 'Entry not found'}, status=404)

    action = request.data.get('action')
    if action == 'approve':
        approval.status = AdvisorApproval.Status.APPROVED
        approval.reviewed_by = request.user
        approval.reviewed_at = timezone.now()
        approval.save()
        return Response({'status': 'approved'})
    elif action == 'reject':
        approval.status = AdvisorApproval.Status.REJECTED
        approval.reviewed_by = request.user
        approval.reviewed_at = timezone.now()
        approval.rejection_reason = request.data.get('reason', '')
        approval.save()
        return Response({'status': 'rejected'})
    return Response({'error': 'action must be approve or reject'}, status=400)
