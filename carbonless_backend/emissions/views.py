from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db.models import Sum
from django.http import HttpResponse
from datetime import datetime
from .models import EmissionFactor, EmissionEntry, ReductionTarget, CustomEmissionRequest
from .serializers import (
    EmissionFactorSerializer, EmissionEntrySerializer,
    ReductionTargetSerializer, CustomEmissionRequestSerializer
)
from .calculator import calculate_emissions, get_available_countries
from companies.utils import get_current_company


class EmissionFactorViewSet(viewsets.ReadOnlyModelViewSet):
    """List and retrieve emission factors — returns only active defaults"""
    queryset = EmissionFactor.objects.filter(is_active=True, is_default=True)
    serializer_class = EmissionFactorSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        scope = self.request.query_params.get('scope')
        category = self.request.query_params.get('category')
        country = self.request.query_params.get('country')
        source = self.request.query_params.get('source')
        if scope:
            qs = qs.filter(scope=scope)
        if category:
            qs = qs.filter(category=category)
        if country:
            qs = qs.filter(country=country)
        if source:
            qs = qs.filter(source=source)
        return qs


class EmissionEntryViewSet(viewsets.ModelViewSet):
    """CRUD for emission entries — fully company-scoped via membership"""
    serializer_class = EmissionEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from emissions.utils import scope_queryset_to_company
        qs = scope_queryset_to_company(
            EmissionEntry.objects.select_related('emission_factor', 'company', 'facility_ref'),
            self.request.user
        )
        year = self.request.query_params.get('year')
        scope = self.request.query_params.get('scope')
        if year:
            qs = qs.filter(year=year)
        if scope:
            qs = qs.filter(emission_factor__scope=scope)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, company=get_current_company(self.request.user))


class ReductionTargetViewSet(viewsets.ModelViewSet):
    """CRUD for reduction targets — fully company-scoped"""
    serializer_class = ReductionTargetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from emissions.utils import scope_queryset_to_company
        return scope_queryset_to_company(ReductionTarget.objects.all(), self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, company=get_current_company(self.request.user))


class CustomEmissionRequestViewSet(viewsets.ModelViewSet):
    """User submits custom emission requests — fully company-scoped"""
    serializer_class = CustomEmissionRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from emissions.utils import scope_queryset_to_company
        return scope_queryset_to_company(CustomEmissionRequest.objects.all(), self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, company=get_current_company(self.request.user))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def emission_summary(request):
    """Get emission summary for a given year, enriched with questionnaire profile"""
    year = request.query_params.get('year', 2026)
    company = get_current_company(request.user)
    entries = EmissionEntry.objects.filter(company=company, year=year) if company else EmissionEntry.objects.none()

    total = float(entries.aggregate(total=Sum('calculated_co2e_kg'))['total'] or 0)
    scope1 = float(entries.filter(emission_factor__scope='scope1').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    scope2 = float(entries.filter(emission_factor__scope='scope2').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    scope3 = float(entries.filter(emission_factor__scope='scope3').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)

    monthly = []
    for m in range(1, 13):
        month_total = entries.filter(month=m).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0
        monthly.append({'month': m, 'total_kg': float(month_total)})

    categories = entries.values('emission_factor__category').annotate(
        total_kg=Sum('calculated_co2e_kg')
    ).order_by('-total_kg')

    # Get questionnaire profile if available
    from questionnaire.models import QuestionnaireSession
    from questionnaire.views import extract_profile
    questionnaire_profile = None
    session = QuestionnaireSession.objects.filter(
        user=request.user, is_complete=True
    ).first()
    if session:
        questionnaire_profile = extract_profile(session)

    # Custom emission requests (approved)
    custom_approved = CustomEmissionRequest.objects.filter(
        company=company, year=year, status='approved', calculated_co2e_kg__isnull=False
    ) if company else CustomEmissionRequest.objects.none()
    custom_total = float(custom_approved.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    custom_pending = CustomEmissionRequest.objects.filter(
        company=company, year=year, status='pending'
    ).count() if company else 0

    # Add custom approved to scope totals
    for cr in custom_approved:
        if cr.scope == 'scope1':
            scope1 += float(cr.calculated_co2e_kg)
        elif cr.scope == 'scope2':
            scope2 += float(cr.calculated_co2e_kg)
        else:
            scope3 += float(cr.calculated_co2e_kg)
    total += custom_total

    return Response({
        'year': int(year),
        'total_kg': float(total),
        'total_tonne': float(total) / 1000,
        'scope1_kg': float(scope1),
        'scope2_kg': float(scope2),
        'scope3_kg': float(scope3),
        'scope1_tonne': float(scope1) / 1000,
        'scope2_tonne': float(scope2) / 1000,
        'scope3_tonne': float(scope3) / 1000,
        'monthly': monthly,
        'by_category': [
            {'category': c['emission_factor__category'], 'total_kg': float(c['total_kg'])}
            for c in categories
        ],
        'custom_emissions': {
            'approved_total_kg': float(custom_total),
            'pending_count': custom_pending,
        },
        'questionnaire_profile': questionnaire_profile,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def calculate_view(request):
    """Quick calculation without saving — supports both factor_id and slug-based lookup"""
    factor_id = request.data.get('factor_id')
    slug = request.data.get('slug') or request.data.get('source')
    activity_data = request.data.get('activity_data')
    year = request.data.get('year')  # optional

    if activity_data is None:
        return Response({'error': 'activity_data required'}, status=400)

    activity_data = float(activity_data)
    if year is not None:
        year = int(year)

    # Method 1: by factor_id (dashboard form)
    if factor_id:
        result = calculate_emissions(int(factor_id), activity_data)
        if 'error' in result:
            return Response(result, status=404)
        return Response(result)

    # Method 2: by slug + country + category (production API)
    if slug:
        country = request.data.get('country', 'global')
        category = request.data.get('category')
        if not category:
            return Response({'error': 'category required for slug-based lookup'}, status=400)

        from .calculator import calculate_by_slug
        result = calculate_by_slug(slug, country, category, activity_data, year)
        if 'error' in result:
            return Response(result, status=404)
        return Response(result)

    return Response({'error': 'factor_id or slug+category required'}, status=400)


@api_view(['GET'])
@permission_classes([AllowAny])
def countries_view(request):
    """List available countries with emission factors"""
    return Response(get_available_countries())


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_report_view(request):
    """Generate ISO 14064-1 PDF report"""
    year = int(request.query_params.get('year', 2026))
    lang = request.query_params.get('lang', 'tr')

    from .report_pdf import generate_report
    pdf_bytes = generate_report(request.user, year, lang)

    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="carbonless_report_{year}_{lang}.pdf"'
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_import_view(request):
    """Import emission entries from CSV/JSON data.
    Expects: [{"factor_id": 1, "year": 2026, "month": 1, "quantity": 100, "description": "", "facility": ""}]
    """
    data = request.data
    if not isinstance(data, list):
        return Response({'error': 'Expected a list of entries'}, status=400)

    created = 0
    errors = []
    for i, item in enumerate(data):
        try:
            factor = EmissionFactor.objects.get(pk=item['factor_id'], is_active=True)
            entry = EmissionEntry(
                user=request.user,
                company=get_current_company(request.user),
                emission_factor=factor,
                year=item.get('year', 2026),
                month=item.get('month', 1),
                quantity=item['quantity'],
                description=item.get('description', ''),
                facility=item.get('facility', ''),
            )
            entry.save()
            created += 1
        except Exception as e:
            errors.append(f'Row {i+1}: {str(e)}')

    return Response({
        'created': created,
        'errors': errors,
        'total_rows': len(data),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def comparison_view(request):
    """Compare emissions between two years."""
    year1 = int(request.query_params.get('year1', 2025))
    year2 = int(request.query_params.get('year2', 2026))

    def get_year_data(y):
        company = get_current_company(request.user)
        qs = EmissionEntry.objects.filter(company=company, year=y) if company else EmissionEntry.objects.none()
        total = qs.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0
        s1 = qs.filter(emission_factor__scope='scope1').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0
        s2 = qs.filter(emission_factor__scope='scope2').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0
        s3 = qs.filter(emission_factor__scope='scope3').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0
        return {'year': y, 'total_kg': float(total), 'total_tonne': float(total)/1000,
                'scope1_tonne': float(s1)/1000, 'scope2_tonne': float(s2)/1000, 'scope3_tonne': float(s3)/1000}

    d1 = get_year_data(year1)
    d2 = get_year_data(year2)

    change_pct = 0
    if d1['total_kg'] > 0:
        change_pct = ((d2['total_kg'] - d1['total_kg']) / d1['total_kg']) * 100

    return Response({
        'year1': d1, 'year2': d2,
        'change_percent': round(change_pct, 2),
        'change_direction': 'increase' if change_pct > 0 else 'decrease' if change_pct < 0 else 'no_change',
    })


import csv

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_csv_view(request):
    """Export emission entries as CSV"""
    year = int(request.query_params.get('year', 2026))
    company = get_current_company(request.user)
    entries = EmissionEntry.objects.filter(company=company, year=year).select_related('emission_factor') if company else EmissionEntry.objects.none()

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="emissions_{year}.csv"'
    response.write('\ufeff')  # BOM for Excel UTF-8

    writer = csv.writer(response)
    writer.writerow(['Source', 'Scope', 'Category', 'Month', 'Quantity', 'Unit',
                     'Factor (kg CO2e)', 'Emissions (kg CO2e)', 'Emissions (tCO2e)',
                     'Facility', 'Description', 'Reference'])

    for e in entries:
        ef = e.emission_factor
        writer.writerow([
            ef.name, ef.scope, ef.category, e.month,
            float(e.quantity), ef.unit, float(ef.factor_kg_co2e),
            float(e.calculated_co2e_kg), float(e.calculated_co2e_kg) / 1000,
            e.facility, e.description, ef.reference,
        ])

    return response


@api_view(['GET'])
@permission_classes([AllowAny])
def api_docs_view(request):
    """Simple API documentation endpoint"""
    return Response({
        'name': 'Carbonless API',
        'version': '1.0',
        'description': 'ISO 14064-1 Carbon Inventory Platform API',
        'endpoints': {
            'auth': {
                'POST /api/accounts/register/': 'Register new user',
                'POST /api/accounts/login/': 'Login (JWT)',
                'POST /api/accounts/token/refresh/': 'Refresh token',
                'GET /api/accounts/profile/': 'Get user profile + role',
                'POST /api/accounts/change-password/': 'Change password',
                'GET /api/accounts/notifications/': 'List notifications',
            },
            'emissions': {
                'GET /api/emissions/factors/': 'List emission factors (filterable)',
                'GET /api/emissions/entries/': 'List emission entries',
                'POST /api/emissions/entries/': 'Create emission entry',
                'PATCH /api/emissions/entries/{id}/': 'Update entry',
                'DELETE /api/emissions/entries/{id}/': 'Delete entry',
                'GET /api/emissions/summary/': 'Emission summary by year',
                'POST /api/emissions/calculate/': 'Calculate emissions (by ID or slug)',
                'GET /api/emissions/report/': 'Generate PDF report',
                'GET /api/emissions/export-csv/': 'Export CSV',
                'POST /api/emissions/bulk-import/': 'Bulk import entries',
                'GET /api/emissions/comparison/': 'Year-over-year comparison',
                'GET /api/emissions/custom-requests/': 'List custom requests',
                'POST /api/emissions/custom-requests/': 'Submit custom request',
            },
            'questionnaire': {
                'POST /api/questionnaire/start/': 'Start/resume questionnaire',
                'POST /api/questionnaire/answer/': 'Submit answer',
                'GET /api/questionnaire/profile/': 'Get questionnaire profile',
                'POST /api/questionnaire/reset/': 'Reset questionnaire',
            },
            'companies': {
                'POST /api/companies/create/': 'Create company',
                'GET /api/companies/detail/': 'Get/update company',
                'GET /api/companies/facilities/': 'List facilities',
                'POST /api/companies/facilities/': 'Create facility',
            },
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_all_view(request):
    """Export all user data as JSON (backup)"""
    company = get_current_company(request.user)
    entries = EmissionEntry.objects.filter(company=company).select_related('emission_factor') if company else EmissionEntry.objects.none()
    targets = ReductionTarget.objects.filter(company=company) if company else ReductionTarget.objects.none()
    custom = CustomEmissionRequest.objects.filter(company=company) if company else CustomEmissionRequest.objects.none()

    from emissions.serializers import EmissionEntrySerializer, ReductionTargetSerializer, CustomEmissionRequestSerializer
    return Response({
        'user': request.user.username,
        'exported_at': str(datetime.now()) if True else '',
        'entries': EmissionEntrySerializer(entries, many=True).data,
        'targets': ReductionTargetSerializer(targets, many=True).data,
        'custom_requests': CustomEmissionRequestSerializer(custom, many=True).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_entry_view(request, pk):
    """Approve or reject an emission entry (manager/admin only)"""
    from companies.utils import get_current_company
    company = get_current_company(request.user)
    if not company:
        return Response({'error': 'No company'}, status=403)

    try:
        entry = EmissionEntry.objects.get(pk=pk, company=company)
    except EmissionEntry.DoesNotExist:
        return Response({'error': 'Entry not found'}, status=404)

    action = request.data.get('action')  # 'approve' or 'reject'
    if action == 'approve':
        entry.status = 'approved'
        entry.approved_by = request.user
        entry.approved_at = datetime.now()
        entry.save()
        return Response({'status': 'approved'})
    elif action == 'reject':
        entry.status = 'draft'
        entry.rejected_reason = request.data.get('reason', '')
        entry.save()
        return Response({'status': 'rejected'})
    return Response({'error': 'action must be approve or reject'}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def by_facility_view(request):
    """Emissions breakdown by facility"""
    from companies.utils import get_current_company
    from django.db.models import Sum
    company = get_current_company(request.user)
    if not company:
        return Response([])

    year = int(request.query_params.get('year', 2026))
    data = (
        EmissionEntry.objects
        .filter(company=company, year=year, facility__isnull=False)
        .values('facility__name', 'facility__id')
        .annotate(total_kg=Sum('calculated_co2e_kg'))
        .order_by('-total_kg')
    )
    return Response([{
        'facility_id': d['facility__id'],
        'facility_name': d['facility__name'],
        'total_kg': float(d['total_kg']),
        'total_tonne': float(d['total_kg']) / 1000,
    } for d in data])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_entries_view(request):
    """List pending emission entries for current company (for review)"""
    company = get_current_company(request.user)
    if not company:
        return Response([])
    entries = EmissionEntry.objects.filter(
        company=company, status='submitted'
    ).select_related('emission_factor', 'facility').order_by('-created_at')

    from .serializers import EmissionEntrySerializer
    return Response(EmissionEntrySerializer(entries, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_excel_view(request):
    """Export emission entries as Excel (xlsx)"""
    from openpyxl import Workbook
    year = int(request.query_params.get('year', 2026))
    company = get_current_company(request.user)
    entries = EmissionEntry.objects.filter(company=company, year=year).select_related('emission_factor') if company else EmissionEntry.objects.none()

    wb = Workbook()
    ws = wb.active
    ws.title = f'Emissions {year}'
    ws.append(['Source', 'Scope', 'Category', 'Month', 'Quantity', 'Unit', 'Factor', 'kg CO2e', 'tCO2e', 'Facility', 'Description'])

    for e in entries:
        ef = e.emission_factor
        ws.append([ef.name, ef.scope, ef.category, e.month, float(e.quantity), ef.unit,
                   float(ef.factor_kg_co2e), float(e.calculated_co2e_kg), float(e.calculated_co2e_kg)/1000,
                   str(e.facility) if e.facility else '', e.description])

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = f'attachment; filename="emissions_{year}.xlsx"'
    wb.save(response)
    return response
