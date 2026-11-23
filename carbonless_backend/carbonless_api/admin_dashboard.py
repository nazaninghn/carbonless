"""
Data for the admin panel's home page (templates/admin/index.html), wired up via
UNFOLD["DASHBOARD_CALLBACK"] in settings.py, and the sidebar badges.

The home page is the platform advisor's desk: what waits for a decision, how
long it has waited and where to decide it. Everything here is a count or a
list read from the database; nothing is calculated and no emission figure is
produced.
"""
from collections import Counter
from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from companies.models import Company
from emissions.models import CustomEmissionRequest, EmissionEntry, EmissionFactor
from questionnaire.models import AdvisorApproval, CarbonReport, ReportStep
from subscriptions.models import Subscription
from support.models import AnswerFeedback, SupportRequest

APPROVALS_URL = '/admin/questionnaire/advisorapproval/'
REQUESTS_URL = '/admin/emissions/customemissionrequest/'

# The data-quality reasons the advisor decides (questionnaire/uncertainty.py), in the words of the desk.
REASON_LABELS = {
    'ut02_measurement_document': 'Measurement records',
    'ut04_other_source': 'Own uncertainty claims',
    'ut05_supplier_declaration': 'Supplier declarations',
    'ut03_row_above_60': 'Rows above 60 % uncertainty',
}
STANDARD_LABELS = (('', 'Platform catalogue'), ('defra', 'DEFRA'), ('ipcc', 'IPCC'),
                   ('ghg', 'GHG Protocol'), ('mix', 'Mix'))
CHART_DAYS = 30


def _pending_approvals():
    return AdvisorApproval.objects.filter(status=AdvisorApproval.Status.PENDING)


def _own_factor_requests():
    return CustomEmissionRequest.objects.filter(status='pending', proposed_factor_kg_co2e__isnull=False)


def _other_requests():
    return CustomEmissionRequest.objects.filter(status='pending', proposed_factor_kg_co2e__isnull=True)


def advisor_approvals_badge(request):
    n = _pending_approvals().count()
    return str(n) if n else None


def custom_requests_badge(request):
    n = CustomEmissionRequest.objects.filter(status='pending').count()
    return str(n) if n else None


def _age(created, now):
    days = (now - created).days
    if days >= 1:
        return days, f'{days} d'
    hours = int((now - created).total_seconds() // 3600)
    return 0, f'{hours} h' if hours else 'now'


def _waiting(now, limit=5):
    """The items that have waited longest, oldest first, whatever queue they are in."""
    rows = []
    for a in _pending_approvals().select_related('report__company').order_by('created_at')[:limit]:
        company = a.report.company.legal_entity_name if a.report_id and a.report.company_id else '—'
        rows.append({
            'created': a.created_at, 'company': company,
            'what': REASON_LABELS.get(a.reason_code, a.reason_code.replace('_', ' ')),
            'detail': f'Question {a.question_id}', 'kind': 'Approval',
            'url': f'{APPROVALS_URL}{a.pk}/change/',
        })
    for r in CustomEmissionRequest.objects.filter(status='pending').select_related('company').order_by('created_at')[:limit]:
        own = r.proposed_factor_kg_co2e is not None
        rows.append({
            'created': r.created_at, 'company': r.company.legal_entity_name if r.company_id else '—',
            'what': 'Own emission factor' if own else 'Factor request',
            'detail': r.source_name, 'kind': 'Own factor' if own else 'Request',
            'url': f'{REQUESTS_URL}{r.pk}/change/',
        })
    rows.sort(key=lambda row: row['created'])
    for row in rows:
        row['days'], row['age'] = _age(row['created'], now)
    return rows[:limit]


def _entries_per_day(now):
    """[{label, day, count, today}] for the last CHART_DAYS days, oldest first."""
    today = timezone.localdate(now)
    start = today - timedelta(days=CHART_DAYS - 1)
    counted = dict(EmissionEntry.objects.filter(created_at__date__gte=start)
                   .annotate(day=TruncDate('created_at')).values_list('day').annotate(n=Count('pk')))
    days = [start + timedelta(days=i) for i in range(CHART_DAYS)]
    peak = max([counted.get(d, 0) for d in days] + [1])
    return [{'day': d.day, 'label': d.strftime('%d %b'), 'count': counted.get(d, 0),
             'height': round(counted.get(d, 0) * 100 / peak), 'today': d == today} for d in days], peak


def _standards():
    """How many inventories are on each factor standard (question D1)."""
    from questionnaire.step_entries import inventory_standard
    chosen = Counter(inventory_standard({'D1': answer})
                     for answer in ReportStep.objects.filter(step_id='D1').values_list('answer', flat=True))
    total = CarbonReport.objects.count()
    chosen[''] += max(total - sum(chosen.values()), 0)       # no D1 answer yet: the platform catalogue
    rows = [{'key': key or 'catalogue', 'label': label, 'count': chosen.get(key, 0)} for key, label in STANDARD_LABELS]
    for row in rows:
        row['share'] = round(row['count'] * 100 / total) if total else 0
    return rows


def dashboard_callback(request, context):
    now = timezone.now()
    approvals = _pending_approvals()
    by_reason = dict(approvals.values_list('reason_code').annotate(n=Count('pk')))
    data_quality = [{'label': label, 'count': by_reason.get(code, 0),
                     'url': f'{APPROVALS_URL}?status__exact=pending&reason_code__exact={code}'}
                    for code, label in REASON_LABELS.items()]
    other_rules = sum(n for code, n in by_reason.items() if code not in REASON_LABELS)
    own_factors, other_requests = _own_factor_requests().count(), _other_requests().count()
    approvals_total = approvals.count()
    queue_total = approvals_total + own_factors + other_requests
    waiting = _waiting(now)
    bars, peak = _entries_per_day(now)
    inventories = CarbonReport.objects.count()
    signed = CarbonReport.objects.filter(signed_at__isnull=False).count()
    hour = timezone.localtime(now).hour
    context.update({
        'today': timezone.localdate(now),
        'greeting': 'Good morning' if hour < 12 else 'Good afternoon' if hour < 18 else 'Good evening',
        'queue_total': queue_total,
        'approvals_total': approvals_total,
        'own_factors': own_factors,
        'other_requests': other_requests,
        'auto_accepted_30d': CustomEmissionRequest.objects.filter(
            auto_accepted=True, created_at__gte=now - timedelta(days=30)).count(),
        'queue_rows': data_quality + [
            {'label': 'Other advisor rules', 'count': other_rules, 'url': f'{APPROVALS_URL}?status__exact=pending'},
            {'label': 'Own emission factors', 'count': own_factors, 'url': f'{REQUESTS_URL}?status__exact=pending'},
            {'label': 'Factor requests', 'count': other_requests, 'url': f'{REQUESTS_URL}?status__exact=pending'},
        ],
        'waiting': waiting,
        'oldest': waiting[0] if waiting else None,
        'bars': bars,
        'bars_peak': peak,
        'entries_30d': sum(b['count'] for b in bars),
        'entries_7d': sum(b['count'] for b in bars[-7:]),
        'inventories': inventories,
        'inventories_signed': signed,
        'inventories_open': inventories - signed,
        'signed_share': round(signed * 100 / inventories) if inventories else 0,
        'standards': _standards(),
        'standard_rows': EmissionFactor.objects.exclude(standard='').filter(is_active=True).count(),
        'withheld_rows': EmissionFactor.objects.exclude(standard='').filter(is_active=False).count(),
        'kpi_open_support_requests': SupportRequest.objects.filter(status=SupportRequest.Status.OPEN).count(),
        'platform': [
            {'label': 'Users', 'value': User.objects.count(), 'icon': 'group', 'url': '/admin/auth/user/'},
            {'label': 'Companies', 'value': Company.objects.count(), 'icon': 'apartment',
             'url': '/admin/companies/company/'},
            {'label': 'Pro subscriptions', 'icon': 'workspace_premium', 'url': '/admin/subscriptions/subscription/',
             'value': Subscription.objects.filter(
                 plan=Subscription.Plan.PRO,
                 status__in=[Subscription.Status.ACTIVE, Subscription.Status.TRIALING]).count()},
            {'label': 'Emission entries', 'value': EmissionEntry.objects.count(), 'icon': 'local_fire_department',
             'url': '/admin/emissions/emissionentry/'},
            {'label': 'Unhelpful answers, 30 days', 'icon': 'thumb_down',
             'url': '/admin/support/answerfeedback/?helpful__exact=0',
             'value': AnswerFeedback.objects.filter(helpful=False, created_at__gte=now - timedelta(days=30)).count()},
            {'label': 'Product gaps', 'value': SupportRequest.objects.filter(is_gap=True).count(),
             'icon': 'lightbulb', 'url': '/admin/support/supportrequest/?is_gap__exact=1'},
        ],
    })
    return context
