"""
Data for the custom admin dashboard homepage (see templates/admin/index.html).
Wired up via UNFOLD["DASHBOARD_CALLBACK"] in settings.py.
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone

from companies.models import Company
from emissions.models import EmissionEntry, CustomEmissionRequest
from questionnaire.models import AdvisorApproval
from subscriptions.models import Subscription
from support.models import AnswerFeedback, SupportRequest


def dashboard_callback(request, context):
    context.update({
        'kpi_users': User.objects.count(),
        'kpi_companies': Company.objects.count(),
        'kpi_pro_subscriptions': Subscription.objects.filter(
            plan=Subscription.Plan.PRO,
            status__in=[Subscription.Status.ACTIVE, Subscription.Status.TRIALING],
        ).count(),
        'kpi_emission_entries': EmissionEntry.objects.count(),
        'kpi_pending_custom_requests': CustomEmissionRequest.objects.filter(status='pending').count(),
        'kpi_pending_advisor_approvals': AdvisorApproval.objects.filter(status='pending').count(),
        'kpi_open_support_requests': SupportRequest.objects.filter(status=SupportRequest.Status.OPEN).count(),
        'kpi_unhelpful_answers_30d': AnswerFeedback.objects.filter(
            helpful=False, created_at__gte=timezone.now() - timedelta(days=30)).count(),
        'kpi_product_gaps': SupportRequest.objects.filter(is_gap=True).count(),
        'current_year': timezone.now().year,
    })
    return context
