"""
P2.4 Dashboard Sync

When an emission entry is saved in chat:
1. Emit WebSocket event to dashboard
2. Dashboard recalculates totals
3. User sees updates in real-time (no refresh needed)

Fallback: Dashboard polls every 5s if WebSocket unavailable
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from emissions.models import EmissionEntry
import logging
import json

logger = logging.getLogger(__name__)


def notify_dashboard_entry_saved(user_id: int, entry_id: int):
    """
    Notify dashboard that a new entry was saved.
    Uses WebSocket if available, falls back to polling.
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()

        # Send to user's dashboard group
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}_dashboard",
            {
                'type': 'emission_entry_saved',
                'entry_id': entry_id,
                'action': 'refresh_totals',
            }
        )
        logger.info(f"Dashboard notified for user {user_id}, entry {entry_id}")
    except Exception as e:
        logger.warning(f"WebSocket notification failed: {e}. Fallback to polling.")
        # Fallback: dashboard will poll
        pass


@receiver(post_save, sender=EmissionEntry)
def on_emission_entry_saved(sender, instance, created, **kwargs):
    """
    Signal handler: When EmissionEntry is saved.
    """
    if created:
        logger.info(f"New entry saved: {instance.id}")

        # Notify dashboard
        if instance.company and instance.company.account:
            notify_dashboard_entry_saved(
                user_id=instance.company.account.user.id,
                entry_id=instance.id
            )

        # Log to activity stream
        from accounts.models import ActivityLog
        try:
            ActivityLog.objects.create(
                user=instance.company.account.user,
                action='emission_entry_created',
                description=f"Added {instance.quantity} {instance.unit} of {instance.activity_type}",
                metadata={
                    'entry_id': instance.id,
                    'co2e_kg': float(instance.calculated_co2e_kg),
                    'scope': instance.emission_factor.scope if instance.emission_factor else None,
                }
            )
        except Exception as e:
            logger.warning(f"Activity log failed: {e}")


def get_dashboard_update_payload(user_id: int) -> dict:
    """
    Build the payload for dashboard refresh.
    Includes all aggregated data needed for display.
    """
    from emissions.models import EmissionEntry
    from django.utils import timezone
    from django.db.models import Sum

    current_year = timezone.now().year

    entries = EmissionEntry.objects.filter(
        company__account__user_id=user_id,
        year=current_year
    ).select_related('emission_factor')

    total_co2e_kg = entries.aggregate(Sum('calculated_co2e_kg'))['calculated_co2e_kg__sum'] or 0

    scope_breakdown = {}
    for scope in ['scope1', 'scope2', 'scope3']:
        total = entries.filter(
            emission_factor__scope=scope
        ).aggregate(Sum('calculated_co2e_kg'))['calculated_co2e_kg__sum'] or 0
        scope_breakdown[scope] = float(total)

    category_breakdown = entries.values('emission_factor__category').annotate(
        total=Sum('calculated_co2e_kg')
    ).order_by('-total')[:10]

    return {
        'year': current_year,
        'total_co2e_kg': float(total_co2e_kg),
        'total_co2e_tonne': float(total_co2e_kg / 1000),
        'scope_breakdown': scope_breakdown,
        'category_breakdown': [
            {
                'category': item['emission_factor__category'],
                'co2e_kg': float(item['total'] or 0),
                'percentage': (float(item['total'] or 0) / total_co2e_kg * 100) if total_co2e_kg > 0 else 0,
            }
            for item in category_breakdown
        ],
        'entry_count': entries.count(),
    }


# Decorator for chat endpoints that save entries
def sync_dashboard_after_save(view_func):
    """
    Decorator: After saving an entry, notify dashboard.

    Usage:
        @sync_dashboard_after_save
        def confirm_entry(request):
            ...
    """
    def wrapper(request, *args, **kwargs):
        response = view_func(request, *args, **kwargs)

        # If successful save, notify dashboard
        if response.status_code in [200, 201]:
            try:
                user_id = request.user.id
                notify_dashboard_entry_saved(user_id, None)  # Entry ID will be in response
            except Exception as e:
                logger.warning(f"Dashboard sync decorator failed: {e}")

        return response

    return wrapper
