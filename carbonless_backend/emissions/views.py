from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db.models import Sum
from django.http import HttpResponse
from .models import EmissionFactor, EmissionEntry, ReductionTarget, CustomEmissionRequest
from .serializers import (
    EmissionFactorSerializer, EmissionEntrySerializer,
    ReductionTargetSerializer, CustomEmissionRequestSerializer
)
from .calculator import calculate_emissions, get_available_countries


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
    """CRUD for emission entries"""
    serializer_class = EmissionEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = EmissionEntry.objects.filter(user=self.request.user)
        year = self.request.query_params.get('year')
        scope = self.request.query_params.get('scope')
        if year:
            qs = qs.filter(year=year)
        if scope:
            qs = qs.filter(emission_factor__scope=scope)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ReductionTargetViewSet(viewsets.ModelViewSet):
    """CRUD for reduction targets"""
    serializer_class = ReductionTargetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ReductionTarget.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CustomEmissionRequestViewSet(viewsets.ModelViewSet):
    """User submits custom emission requests when no factor exists.
    Users can create/list their own. Admin can see all via admin panel."""
    serializer_class = CustomEmissionRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CustomEmissionRequest.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def emission_summary(request):
    """Get emission summary for a given year, enriched with questionnaire profile"""
    year = request.query_params.get('year', 2026)
    entries = EmissionEntry.objects.filter(user=request.user, year=year)

    total = entries.aggregate(total=Sum('calculated_co2e_kg'))['total'] or 0
    scope1 = entries.filter(emission_factor__scope='scope1').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0
    scope2 = entries.filter(emission_factor__scope='scope2').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0
    scope3 = entries.filter(emission_factor__scope='scope3').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0

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
        user=request.user, year=year, status='approved', calculated_co2e_kg__isnull=False
    )
    custom_total = custom_approved.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0
    custom_pending = CustomEmissionRequest.objects.filter(
        user=request.user, year=year, status='pending'
    ).count()

    # Add custom approved to scope totals
    for cr in custom_approved:
        if cr.scope == 'scope1':
            scope1 += float(cr.calculated_co2e_kg)
        elif cr.scope == 'scope2':
            scope2 += float(cr.calculated_co2e_kg)
        else:
            scope3 += float(cr.calculated_co2e_kg)
    total += float(custom_total)

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
