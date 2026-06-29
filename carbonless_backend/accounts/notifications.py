"""
Email notification service for Carbonless.
Sends transactional emails when important events happen.
"""
import logging
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


def notify_report_ready(user, report_year):
    """Send email when PDF report is generated"""
    try:
        send_mail(
            subject=f'Your {report_year} Carbon Report is Ready — Carbonless',
            message=(
                f"Hi {user.first_name or user.username},\n\n"
                f"Your ISO 14064-1 carbon inventory report for {report_year} has been generated.\n\n"
                f"Log in to download it: {settings.FRONTEND_URL or 'https://carbonless.app'}/dashboard\n\n"
                f"— Carbonless Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.error('Failed to send report-ready email to %s: %s', user.email, e)


def notify_target_exceeded(user, target, current_value):
    """Send email when emission target is exceeded"""
    try:
        send_mail(
            subject=f'⚠️ Carbon Target Alert — Carbonless',
            message=(
                f"Hi {user.first_name or user.username},\n\n"
                f"Your carbon emissions have exceeded a target:\n\n"
                f"Target: {target.target_value} tCO₂e\n"
                f"Current: {current_value:.2f} tCO₂e\n"
                f"Scope: {target.scope}\n\n"
                f"Log in to review: {settings.FRONTEND_URL or 'https://carbonless.app'}/dashboard\n\n"
                f"— Carbonless Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.error('Failed to send target-exceeded email to %s: %s', user.email, e)


def notify_entry_approved(user, entry):
    """Send email when an emission entry is approved"""
    try:
        send_mail(
            subject='Emission Entry Approved — Carbonless',
            message=(
                f"Hi {user.first_name or user.username},\n\n"
                f"Your emission entry has been approved:\n\n"
                f"• {entry.emission_factor.name}\n"
                f"• {entry.quantity} {entry.emission_factor.unit}\n"
                f"• {float(entry.calculated_co2e_kg)/1000:.3f} tCO₂e\n\n"
                f"— Carbonless Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.error('Failed to send entry-approved email to %s: %s', user.email, e)


def notify_entry_rejected(user, entry, reason=''):
    """Send email when an emission entry is rejected"""
    try:
        send_mail(
            subject='Emission Entry Rejected — Carbonless',
            message=(
                f"Hi {user.first_name or user.username},\n\n"
                f"Your emission entry has been rejected:\n\n"
                f"• {entry.emission_factor.name}\n"
                f"• Reason: {reason or 'No reason provided'}\n\n"
                f"Please log in to review and resubmit.\n\n"
                f"— Carbonless Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.error('Failed to send entry-rejected email to %s: %s', user.email, e)
