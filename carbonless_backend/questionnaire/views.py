from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
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


class StartReportView(APIView):
    """POST /api/questionnaire/start/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from companies.utils import get_current_company
        company = get_current_company(request.user)
        if not company:
            return Response({'error': 'No company found. Please create a company first.'}, status=400)

        existing = CarbonReport.objects.filter(
            company=company,
            status__in=[CarbonReport.Status.DRAFT, CarbonReport.Status.IN_PROGRESS]
        ).first()

        if existing:
            return Response({
                'report_id': existing.id,
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

        report = CarbonReport.objects.create(
            company=company,
            created_by=request.user,
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

        if step not in STEP_SERIALIZERS:
            return Response({'error': f'Unknown step: {step}'}, status=400)

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


class ReportStatusView(APIView):
    """GET /api/questionnaire/<report_id>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        try:
            report = CarbonReport.objects.get(id=report_id, created_by=request.user)
        except CarbonReport.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        completed_steps = list(report.steps.values_list('step_id', flat=True))
        return Response({
            'report_id': report.id,
            'current_step': report.current_step,
            'status': report.status,
            'company': {
                'name': report.company.legal_entity_name,
                'tax_id': report.company.tax_number,
                'country': report.company.country_of_headquarters,
                'nace_code': report.company.nace_code,
            },
            'reporting_year': report.reporting_year,
            'ef_database': report.ef_database,
            'boundary_approach': report.boundary_approach,
            'scope3_approach': report.scope3_approach,
            'completed_steps': completed_steps,
            'progress': {
                'completed': len(completed_steps),
                'total_phase1': 21,
                'percent': round(len(completed_steps) / 21 * 100)
            }
        })


class ReportListView(APIView):
    """GET /api/questionnaire/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from companies.utils import get_current_company
        company = get_current_company(request.user)
        reports = CarbonReport.objects.filter(created_by=request.user).select_related('company')
        data = [{
            'report_id': r.id,
            'company': r.company.legal_entity_name,
            'reporting_year': r.reporting_year,
            'status': r.status,
            'current_step': r.current_step,
            'created_at': r.created_at,
        } for r in reports]
        return Response({'reports': data})


# ── Legacy views (backward compat) ──────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_session(request):
    from .flow import get_question
    existing = QuestionnaireSession.objects.filter(user=request.user, is_complete=False).first()
    if existing:
        lang = request.data.get('lang', 'tr')
        q = get_question(existing.current_question, lang)
        return Response({
            'session_id': existing.pk,
            'question': q,
            'answers': existing.answers,
            'warnings': existing.warnings,
            'resumed': True,
        })
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
    QuestionnaireSession.objects.filter(user=request.user, is_complete=False).delete()
    return Response({'status': 'ok'})


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
