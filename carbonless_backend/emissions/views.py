from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from datetime import datetime
from .models import EmissionFactor, EmissionEntry, ReductionTarget, CustomEmissionRequest
from .serializers import (
    EmissionFactorSerializer, EmissionEntrySerializer,
    ReductionTargetSerializer, CustomEmissionRequestSerializer
)
from .calculator import calculate_emissions, get_available_countries
try:
    from .scope3_categories import SCOPE3_CATEGORIES, SCOPE3_GHG_NUMBER
except ImportError:
    SCOPE3_CATEGORIES = {}
    SCOPE3_GHG_NUMBER = {}
from companies.utils import get_current_company
from companies.permissions import NotAuditorForWrites, ApproverForWrites


class EmissionFactorViewSet(viewsets.ReadOnlyModelViewSet):
    """List and retrieve emission factors — returns only active defaults"""
    queryset = EmissionFactor.objects.filter(is_active=True, is_default=True)
    serializer_class = EmissionFactorSerializer
    permission_classes = [AllowAny]
    pagination_class = None  # Return all factors at once (small dataset)

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


APPROVER_ROLES = ('owner', 'admin', 'manager')
# Fields whose change alters an entry's emissions; changing them on an
# approved entry sends it back for approval when a data-entry member does it.
_AMOUNT_FIELDS = ('quantity', 'emission_factor', 'year', 'month')


def _log_entry(request, action, entry, detail, **extra):
    """Audit-trail row for an emission entry, tagged with its company so the
    company's change history (Settings → History) can list it."""
    from accounts.models import ActivityLog
    ActivityLog.objects.create(
        user=request.user, action=action, detail=detail,
        ip_address=request.META.get('REMOTE_ADDR'),
        target_type='EmissionEntry', target_id=str(entry.id),
        metadata={'company_id': entry.company_id, **extra},
    )


def _entry_summary(entry):
    return (f'{entry.emission_factor.name} · {entry.year}/{entry.month:02d} · '
            f'{format(entry.quantity.normalize(), "f") if hasattr(entry.quantity, "normalize") else entry.quantity} '
            f'{entry.emission_factor.unit}')


class EmissionEntryViewSet(viewsets.ModelViewSet):
    """CRUD for emission entries — fully company-scoped via membership"""
    serializer_class = EmissionEntrySerializer
    permission_classes = [IsAuthenticated, NotAuditorForWrites]

    def get_queryset(self):
        from emissions.utils import scope_queryset_to_company
        qs = scope_queryset_to_company(
            EmissionEntry.objects.select_related('emission_factor', 'company', 'facility', 'user'),
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
        company = get_current_company(self.request.user)
        if not company:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'error': 'No company found. Please create or join a company first.'})
        from .duplicates import find_duplicate, is_confirmed, PossibleDuplicate
        if not is_confirmed(self.request.data):
            v = serializer.validated_data
            existing = find_duplicate(company, v.get('emission_factor'), v.get('year'), v.get('month'), v.get('quantity'))
            if existing:
                raise PossibleDuplicate(existing)
        # Same rule as chat/questionnaire saves (create_entry_from_activity):
        # owners, admins and managers are approvers, so their own entries don't
        # wait in the review queue; data-entry members' entries do.
        from .factor_lookup import _get_entry_status
        serializer.save(
            user=self.request.user, company=company,
            status=_get_entry_status(self.request.user, company),
        )
        from .notifications import notify_entry_submitted
        notify_entry_submitted(serializer.instance)
        _log_entry(self.request, 'entry_created', serializer.instance, _entry_summary(serializer.instance))

    def _check_can_change(self, instance):
        """A data-entry member changes or deletes only their own entries;
        owner/admin/manager may change any entry of the company."""
        from rest_framework.exceptions import PermissionDenied
        from companies.permissions import current_role
        if instance.user_id != self.request.user.id and current_role(self.request.user) not in APPROVER_ROLES:
            raise PermissionDenied('Only the person who entered this record, or an owner, admin or manager, can change it.')

    def update(self, request, *args, **kwargs):
        # A questionnaire-created entry is rebuilt from its questionnaire answer
        # whenever that question is saved again, so an amount changed here
        # would silently come back. It is corrected in the questionnaire.
        instance = self.get_object()
        self._check_can_change(instance)
        if ((instance.description or '').startswith('Questionnaire step ')
                and any(k in request.data for k in ('quantity', 'emission_factor', 'year', 'month'))):
            return Response({
                'error': 'This entry comes from the questionnaire; correct it there.',
                'code': 'edit_in_questionnaire',
            }, status=400)
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        from .factor_lookup import _get_entry_status
        from .notifications import notify_entry_submitted
        before = serializer.instance
        old = _entry_summary(before)
        was_status = before.status
        amount_changed = any(
            f in serializer.validated_data and serializer.validated_data[f] != getattr(before, f)
            for f in _AMOUNT_FIELDS
        )
        # Editing a rejected entry is how its author fixes and resends it, and
        # changing the amount of an approved one is a new figure: both go back
        # through the same approval rule as a new entry (a data-entry member's
        # change waits for approval; an approver's counts at once).
        if was_status == 'draft' or (was_status == 'approved' and amount_changed):
            instance = serializer.save(
                status=_get_entry_status(self.request.user, before.company),
                rejected_reason='',
            )
            notify_entry_submitted(instance)
        else:
            instance = serializer.save()
        new = _entry_summary(instance)
        _log_entry(self.request, 'entry_updated', instance,
                   f'{old} → {new}' if old != new else new,
                   status_before=was_status, status_after=instance.status)

    def perform_destroy(self, instance):
        self._check_can_change(instance)
        _log_entry(self.request, 'entry_deleted', instance, _entry_summary(instance),
                   status_before=instance.status)
        instance.delete()


class ReductionTargetViewSet(viewsets.ModelViewSet):
    """CRUD for reduction targets — fully company-scoped. A target is the
    company's commitment, so only owner/admin/manager change it; data-entry
    members and auditors see it."""
    serializer_class = ReductionTargetSerializer
    permission_classes = [IsAuthenticated, NotAuditorForWrites, ApproverForWrites]

    def get_queryset(self):
        from emissions.utils import scope_queryset_to_company
        return scope_queryset_to_company(ReductionTarget.objects.all(), self.request.user)

    def perform_create(self, serializer):
        company = get_current_company(self.request.user)
        if not company:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'error': 'No company found.'})
        serializer.save(user=self.request.user, company=company)


class CustomEmissionRequestViewSet(viewsets.ModelViewSet):
    """User submits custom emission requests — fully company-scoped"""
    serializer_class = CustomEmissionRequestSerializer
    permission_classes = [IsAuthenticated, NotAuditorForWrites]

    def get_queryset(self):
        from emissions.utils import scope_queryset_to_company
        return scope_queryset_to_company(CustomEmissionRequest.objects.all(), self.request.user)

    def perform_create(self, serializer):
        company = get_current_company(self.request.user)
        if not company:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'error': 'No company found.'})
        serializer.save(user=self.request.user, company=company)

    def _check_can_change(self, obj):
        """A request is changed or withdrawn only while it waits for review,
        and only by the member who sent it or an owner/admin/manager."""
        from rest_framework.exceptions import PermissionDenied, ValidationError
        from companies.permissions import current_role
        if obj.status != 'pending':
            raise ValidationError({'error': 'This request has already been reviewed.', 'code': 'already_reviewed'})
        if obj.user_id != self.request.user.id and current_role(self.request.user) not in ('owner', 'admin', 'manager'):
            raise PermissionDenied()

    def perform_update(self, serializer):
        self._check_can_change(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._check_can_change(instance)
        instance.delete()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def emission_summary(request):
    """Get emission summary for a given year, enriched with questionnaire profile"""
    # Fix #63: was hardcoded to 2026 — use current year as the dynamic default
    year = request.query_params.get('year', datetime.now().year)
    company = get_current_company(request.user)
    # A rejected entry (a rejection moves it to 'draft') is not part of the
    # inventory; it stays listed, with its reason, on the emissions page until
    # it is corrected.
    entries = (EmissionEntry.objects.filter(company=company, year=year).exclude(status='draft')
               if company else EmissionEntry.objects.none())

    total = float(entries.aggregate(total=Sum('calculated_co2e_kg'))['total'] or 0)
    scope1 = float(entries.filter(emission_factor__scope='scope1').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    scope2 = float(entries.filter(emission_factor__scope='scope2').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    scope3 = float(entries.filter(emission_factor__scope='scope3').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)

    # Fix #33: Replace 12 sequential per-month aggregate queries with a single
    # GROUP BY — one SQL query instead of twelve.
    monthly_qs = (
        entries.values('month')
        .annotate(t=Sum('calculated_co2e_kg'))
        .order_by('month')
    )
    monthly_map = {row['month']: float(row['t'] or 0) for row in monthly_qs}
    monthly = [{'month': m, 'total_kg': monthly_map.get(m, 0.0)} for m in range(1, 13)]

    categories = entries.values('emission_factor__category').annotate(
        total_kg=Sum('calculated_co2e_kg')
    ).order_by('-total_kg')

    # Get questionnaire profile if available
    from questionnaire.models import QuestionnaireSession, CarbonReport
    from questionnaire.views import extract_profile
    questionnaire_profile = None
    session = QuestionnaireSession.objects.filter(
        user=request.user, is_complete=True
    ).first()
    if session:
        questionnaire_profile = extract_profile(session)

    # Also check CarbonReport completion (newer 137-question flow). The legacy
    # extract_profile() above returns period_type/base_year/report_language
    # fields that CarbonReport has no equivalent for — rather than force-map
    # mismatched fields, this fallback exposes CarbonReport's own fields
    # directly so ReportingTab can render real data instead of '-' placeholders.
    if not questionnaire_profile and company:
        completed_report = CarbonReport.objects.filter(
            company=company, status=CarbonReport.Status.COMPLETED
        ).order_by('-updated_at').first()
        if completed_report:
            questionnaire_profile = {
                'is_complete': True,
                'report_id': completed_report.id,
                'title': completed_report.title,
                'reporting_year': completed_report.reporting_year,
                'ef_database': completed_report.ef_database,
                'boundary_approach': completed_report.boundary_approach,
                'scope3_approach': completed_report.scope3_approach,
            }

    # Custom emission requests (approved)
    custom_approved = CustomEmissionRequest.objects.filter(
        company=company, year=year, status='approved', calculated_co2e_kg__isnull=False
    ) if company else CustomEmissionRequest.objects.none()
    custom_total = float(custom_approved.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    custom_pending = CustomEmissionRequest.objects.filter(
        company=company, year=year, status='pending'
    ).count() if company else 0

    # Fix #38: Replace Python loop (loaded all custom rows into memory) with a
    # single SQL GROUP BY so the scope breakdown is computed in the database.
    custom_scope_qs = (
        custom_approved.values('scope')
        .annotate(t=Sum('calculated_co2e_kg'))
    )
    for row in custom_scope_qs:
        val = float(row['t'] or 0)
        if row['scope'] == 'scope1':
            scope1 += val
        elif row['scope'] == 'scope2':
            scope2 += val
        else:
            scope3 += val
    total += custom_total

    # Scope 3 breakdown by GHG Protocol category (all 15 categories, zeros for empty)
    scope3_entries = entries.filter(emission_factor__scope='scope3')
    scope3_agg = (
        scope3_entries
        .values('emission_factor__category')
        .annotate(total_co2e_kg=Sum('calculated_co2e_kg'))
    )
    scope3_totals_map = {
        row['emission_factor__category']: float(row['total_co2e_kg'] or 0)
        for row in scope3_agg
    }
    scope3_by_category = []
    for cat_key, ghg_num in sorted(SCOPE3_GHG_NUMBER.items(), key=lambda x: x[1]):
        cat_meta = SCOPE3_CATEGORIES[cat_key]
        scope3_by_category.append({
            'category': cat_key,
            'ghg_number': ghg_num,
            'name_en': cat_meta['name_en'],
            'name_tr': cat_meta['name_tr'],
            'total_co2e_kg': scope3_totals_map.get(cat_key, 0.0),
        })

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
        'scope3_by_category': scope3_by_category,
        'custom_emissions': {
            'approved_total_kg': float(custom_total),
            'pending_count': custom_pending,
        },
        'questionnaire_profile': questionnaire_profile,
        # Lets the dashboard tell "no data for this year" apart from "no data yet".
        'years_with_data': sorted(
            set(EmissionEntry.objects.filter(company=company).values_list('year', flat=True)),
            reverse=True,
        ) if company else [],
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

    # Fix #41: Unguarded float()/int() raised ValueError/TypeError on non-numeric
    # input (e.g. "abc", null) producing an unhandled 500.  Now returns 400.
    try:
        activity_data = float(activity_data)
    except (TypeError, ValueError):
        return Response({'error': 'activity_data must be a valid number'}, status=400)
    if year is not None:
        try:
            year = int(year)
        except (TypeError, ValueError):
            return Response({'error': 'year must be a valid integer'}, status=400)

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
    # Subscription gate temporarily disabled — all users can generate reports
    # TODO: Re-enable when Stripe billing is connected

    year = int(request.query_params.get('year', datetime.now().year))
    lang = request.query_params.get('lang', 'tr')

    try:
        from .report_pdf import generate_report
        pdf_bytes = generate_report(request.user, year, lang)
    except Exception as e:
        import traceback, logging
        logging.getLogger(__name__).error('PDF generation failed: %s\n%s', e, traceback.format_exc())
        return Response({'error': f'PDF generation failed: {e}'}, status=500)

    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="carbonless_report_{year}_{lang}.pdf"'
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated, NotAuditorForWrites])
def bulk_import_view(request):
    """Import emission entries from CSV/JSON data.
    Expects: [{"factor_id": 1, "year": 2026, "month": 1, "quantity": 100, "description": "", "facility": ""}]
    """
    data = request.data
    if not isinstance(data, list):
        return Response({'error': 'Expected a list of entries'}, status=400)

    # Fix #36: Resolve company once outside the loop.
    # The old code called get_current_company(request.user) on every iteration —
    # that's N membership DB queries for N imported rows.
    company = get_current_company(request.user)

    created = 0
    errors = []
    for i, item in enumerate(data):
        try:
            from decimal import Decimal, InvalidOperation
            try:
                qty = Decimal(str(item['quantity']))
            except (InvalidOperation, TypeError, ValueError):
                raise ValueError(f"Invalid quantity: {item.get('quantity')!r}")
            if qty <= 0:
                raise ValueError('Quantity must be greater than zero.')
            if qty > Decimal('1000000000000'):
                raise ValueError('Quantity is unrealistically large — please check the value.')

            # Fix #48: facility is a ForeignKey — passing an empty string raised
            # ValueError on every row.  Use facility_id and coerce '' / None to None.
            facility_id = item.get('facility') or None
            if facility_id:
                from companies.models import Facility
                if not Facility.objects.filter(id=facility_id, company=company).exists():
                    raise ValueError('Facility not found.')

            factor = EmissionFactor.objects.get(pk=item['factor_id'], is_active=True)
            entry = EmissionEntry(
                user=request.user,
                company=company,
                emission_factor=factor,
                # Same hardcoded-year bug already fixed elsewhere in this file
                # (see Fix #63) — a 2026 default silently misdates every row
                # that omits "year" once the calendar moves past this year.
                year=item.get('year') or datetime.now().year,
                month=item.get('month', 1),
                quantity=qty,
                description=item.get('description', ''),
                facility_id=facility_id,
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
    # Fix #63: use dynamic current year instead of hardcoded 2026
    _cur = datetime.now().year
    year1 = int(request.query_params.get('year1', _cur - 1))
    year2 = int(request.query_params.get('year2', _cur))

    # Fix #37: Resolve company once — the old closure called get_current_company()
    # on every get_year_data() invocation (twice per request = 2 membership queries).
    _company = get_current_company(request.user)

    def get_year_data(y):
        company = _company
        qs = (EmissionEntry.objects.filter(company=company, year=y).exclude(status='draft')
              if company else EmissionEntry.objects.none())
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

def _export_rows(entries, lang):
    """Header and rows for the emissions CSV/Excel export, in the UI language:
    headers, factor names, scopes, categories, months and status (a rejected
    entry is listed but marked, so a column sum can leave it out). Numbers
    stay numbers; the CSV writer formats them."""
    from .report_pdf import _CAT
    tr = lang == 'tr'
    status_labels = {
        'approved': 'Onaylı' if tr else 'Approved',
        'submitted': 'Beklemede' if tr else 'Pending',
        'draft': 'Reddedildi' if tr else 'Rejected',
    }
    months = (['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos',
               'Eylül', 'Ekim', 'Kasım', 'Aralık'] if tr else
              ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
               'September', 'October', 'November', 'December'])
    header = (
        ['Kaynak', 'Kapsam', 'Kategori', 'Ay', 'Miktar', 'Birim', 'Faktör (kg CO2e/birim)',
         'kg CO2e', 'tCO2e', 'Faktör kaynağı', 'Tesis', 'Açıklama', 'Durum', 'Red nedeni'] if tr else
        ['Source', 'Scope', 'Category', 'Month', 'Quantity', 'Unit', 'Factor (kg CO2e/unit)',
         'kg CO2e', 'tCO2e', 'Factor reference', 'Facility', 'Description', 'Status', 'Rejection reason']
    )
    rows = []
    for e in entries:
        ef = e.emission_factor
        scope_num = (ef.scope or '').replace('scope', '')
        rows.append([
            (ef.name_tr or ef.name) if tr else ef.name,
            (f'Kapsam {scope_num}' if tr else f'Scope {scope_num}') if scope_num else '',
            _CAT[lang].get(ef.category, ef.category),
            months[e.month - 1] if e.month and 1 <= e.month <= 12 else e.month,
            float(e.quantity), ef.unit,
            float(ef.factor_kg_co2e), float(e.calculated_co2e_kg), float(e.calculated_co2e_kg) / 1000,
            ef.reference or '',
            e.facility.name if e.facility_id else '', e.description,
            status_labels.get(e.status, e.status),
            e.rejected_reason if e.status == 'draft' else '',
        ])
    return header, rows


def _csv_number(value, tr):
    """A number as plain text for CSV: no float noise (70.29185550000001),
    and a decimal comma for Turkish Excel."""
    text = f'{value:.6f}'.rstrip('0').rstrip('.') if isinstance(value, float) else str(value)
    return text.replace('.', ',') if tr else text


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_csv_view(request):
    """Export emission entries as CSV"""
    year = int(request.query_params.get('year', datetime.now().year))  # Fix #63
    company = get_current_company(request.user)
    # Fix #56: Added 'facility' to select_related \u2014 the old query only joined
    # emission_factor.  Writing e.facility in the loop (a ForeignKey) triggered
    # one extra SQL query per entry that had a facility set (classic N+1).
    # Also fixed the CSV value: use e.facility.name (or '') instead of the ORM
    # object, which printed the ugly __str__ representation.
    entries = (
        EmissionEntry.objects
        .filter(company=company, year=year)
        .select_related('emission_factor', 'facility', 'user')
        if company else EmissionEntry.objects.none()
    )

    # Same columns as the Excel export, in the UI language (?lang=tr). Turkish
    # Excel reads ";" as the column separator and "," as the decimal mark, so
    # a comma-separated file with "1250.5" opened as one column or as dates.
    lang = 'tr' if request.query_params.get('lang') == 'tr' else 'en'
    tr = lang == 'tr'
    header, rows = _export_rows(entries.order_by('month', 'id'), lang)

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = (f'attachment; filename="emisyonlar_{year}.csv"' if tr
                                       else f'attachment; filename="emissions_{year}.csv"')
    response.write('\ufeff')  # BOM so Excel reads UTF-8 (ş, ğ, ı)

    writer = csv.writer(response, delimiter=';' if tr else ',')
    writer.writerow(header)
    for row in rows:
        writer.writerow([_csv_number(v, tr) if isinstance(v, (int, float)) and not isinstance(v, bool) else v
                         for v in row])
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
    """The company's full backup (see full_export.py): JSON by default,
    an Excel workbook with ?file=xlsx (&lang=tr for Turkish sheets; DRF reserves ?format=)."""
    from .full_export import build_backup, backup_workbook_response
    data = build_backup(request.user, get_current_company(request.user))
    if request.query_params.get('file') == 'xlsx':
        return backup_workbook_response(data, request.query_params.get('lang') == 'tr')
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_proof_document(request, pk):
    """
    Serves an emission entry's proof document via Django's own file storage
    (works the same in DEBUG and production, unlike the raw /media/ URL —
    only served when DEBUG=True and with no access control at all when it
    is). Scoped to the requester's own company so one company's proof
    documents can never be fetched by guessing/incrementing the entry id.
    """
    company = get_current_company(request.user)
    try:
        entry = EmissionEntry.objects.get(pk=pk, company=company) if company else None
    except EmissionEntry.DoesNotExist:
        entry = None
    if not entry:
        return Response({'error': 'Entry not found'}, status=404)

    if not entry.proof_document:
        return Response({'error': 'This entry has no proof document'}, status=404)

    from django.http import FileResponse
    return FileResponse(
        entry.proof_document.open('rb'),
        as_attachment=True,
        filename=entry.proof_document.name.rsplit('/', 1)[-1],
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_entry_view(request, pk):
    """Approve or reject an emission entry (manager/admin only)"""
    from companies.utils import get_current_company
    company = get_current_company(request.user)
    if not company:
        return Response({'error': 'No company'}, status=403)

    # Fix #34: Enforce manager/admin role — previously any company member
    # (including data_entry and auditor) could approve entries via this endpoint.
    APPROVER_ROLES = {'owner', 'admin', 'manager'}
    membership = request.user.company_memberships.filter(
        company=company, is_active=True
    ).first()
    if not membership or membership.role not in APPROVER_ROLES:
        return Response({'error': 'Only managers and admins can approve entries'}, status=403)

    try:
        entry = EmissionEntry.objects.get(pk=pk, company=company)
    except EmissionEntry.DoesNotExist:
        return Response({'error': 'Entry not found'}, status=404)

    action = request.data.get('action')  # 'approve' or 'reject'
    if action == 'approve':
        entry.status = 'approved'
        entry.approved_by = request.user
        # Fix #50: django.utils.timezone.now() returns a timezone-aware datetime.
        # datetime.now() is naive — with USE_TZ=True Django raises RuntimeWarning
        # and may store an incorrect timestamp.
        entry.approved_at = timezone.now()
        entry.save()
        from .notifications import notify_entry_reviewed
        notify_entry_reviewed(entry, approved=True, reviewer=request.user)
        _log_entry(request, 'entry_approved', entry, _entry_summary(entry))
        return Response({'status': 'approved'})
    elif action == 'reject':
        entry.status = 'draft'
        entry.rejected_reason = request.data.get('reason', '')
        entry.save()
        from .notifications import notify_entry_reviewed
        notify_entry_reviewed(entry, approved=False, reviewer=request.user)
        _log_entry(request, 'entry_rejected', entry, _entry_summary(entry), reason=entry.rejected_reason)
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

    year = int(request.query_params.get('year', datetime.now().year))  # Fix #63
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
    ).select_related('emission_factor', 'facility', 'user').order_by('-created_at')

    from .serializers import EmissionEntrySerializer
    return Response(EmissionEntrySerializer(entries, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def scope3_categories_view(request):
    """Return the Scope 3 category registry as JSON.
    Categories are sorted by ghg_number (1-15), with water (ghg_number: None) at the end.
    """
    categories = []
    for key, cat in SCOPE3_CATEGORIES.items():
        subtypes = [
            {
                'key': st_key,
                'unit': st_val['unit'],
                'name_en': st_val['name_en'],
                'name_tr': st_val['name_tr'],
            }
            for st_key, st_val in cat['subtypes'].items()
        ]
        categories.append({
            'key': key,
            'ghg_number': cat['ghg_number'],
            'name_en': cat['name_en'],
            'name_tr': cat['name_tr'],
            'subtypes': subtypes,
        })

    # Sort by ghg_number (1-15), with None (water) at the end
    categories.sort(key=lambda c: (c['ghg_number'] is None, c['ghg_number'] or 0))

    return Response({'categories': categories})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_excel_view(request):
    """Export emission entries as Excel (xlsx)"""
    from openpyxl import Workbook
    year = int(request.query_params.get('year', datetime.now().year))  # Fix #63
    company = get_current_company(request.user)
    # Fix #59: Added 'facility' to select_related — same N+1 pattern as Bug #56
    # (export_csv_view). Only emission_factor was pre-fetched; accessing e.facility
    # inside the loop fired one extra SQL query per entry that had a facility set.
    # Also replaced str(e.facility) (Django __str__) with e.facility.name so the
    # Excel cell contains the plain facility name, consistent with the CSV export.
    entries = (
        EmissionEntry.objects
        .filter(company=company, year=year)
        .select_related('emission_factor', 'facility', 'user')
        if company else EmissionEntry.objects.none()
    )

    lang = 'tr' if request.query_params.get('lang') == 'tr' else 'en'
    header, rows = _export_rows(entries.order_by('month', 'id'), lang)
    wb = Workbook()
    ws = wb.active
    ws.title = f'Emisyonlar {year}' if lang == 'tr' else f'Emissions {year}'
    ws.append(header)
    for row in rows:
        ws.append(row)

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = f'attachment; filename="emissions_{year}.xlsx"'
    wb.save(response)
    return response
