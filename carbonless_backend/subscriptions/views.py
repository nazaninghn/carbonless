import os
import json
import logging
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import Subscription

logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
STRIPE_PRICE_ID_PRO = os.environ.get('STRIPE_PRICE_ID_PRO', '')  # Monthly Pro price


def _get_stripe():
    """Lazy import stripe to avoid errors when key is not set"""
    if not STRIPE_SECRET_KEY:
        return None
    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY
        return stripe
    except ImportError:
        return None


def get_or_create_subscription(user):
    """Ensure every user has a Subscription record"""
    sub, _ = Subscription.objects.get_or_create(user=user)
    return sub


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def subscription_status(request):
    """Get current user's subscription status"""
    sub = get_or_create_subscription(request.user)
    return Response({
        'plan': sub.plan,
        'status': sub.status,
        'is_pro': sub.is_pro,
        'ai_messages_used': sub.ai_messages_this_month,
        'ai_message_limit': sub.ai_message_limit,
        'can_send_ai_message': sub.can_send_ai_message,
        'can_generate_report': sub.can_generate_report,
        'can_use_questionnaire': sub.can_use_questionnaire,
        'cancel_at_period_end': sub.cancel_at_period_end,
        'current_period_end': sub.current_period_end,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_checkout_session(request):
    """Create a Stripe Checkout Session for Pro upgrade"""
    stripe = _get_stripe()
    if not stripe:
        return Response({'error': 'Payment system not configured'}, status=503)

    if not STRIPE_PRICE_ID_PRO:
        return Response({'error': 'Pro plan price not configured'}, status=503)

    sub = get_or_create_subscription(request.user)

    # Create or get Stripe customer
    if not sub.stripe_customer_id:
        customer = stripe.Customer.create(
            email=request.user.email,
            metadata={'user_id': str(request.user.id), 'username': request.user.username}
        )
        sub.stripe_customer_id = customer.id
        sub.save(update_fields=['stripe_customer_id'])

    # Create checkout session
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    session = stripe.checkout.Session.create(
        customer=sub.stripe_customer_id,
        payment_method_types=['card'],
        line_items=[{'price': STRIPE_PRICE_ID_PRO, 'quantity': 1}],
        mode='subscription',
        success_url=f"{frontend_url}/dashboard?upgrade=success",
        cancel_url=f"{frontend_url}/dashboard?upgrade=canceled",
        metadata={'user_id': str(request.user.id)},
    )

    return Response({'checkout_url': session.url, 'session_id': session.id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_portal_session(request):
    """Create a Stripe Customer Portal session for managing subscription"""
    stripe = _get_stripe()
    if not stripe:
        return Response({'error': 'Payment system not configured'}, status=503)

    sub = get_or_create_subscription(request.user)
    if not sub.stripe_customer_id:
        return Response({'error': 'No active subscription'}, status=400)

    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    session = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{frontend_url}/dashboard",
    )

    return Response({'portal_url': session.url})


@csrf_exempt
def stripe_webhook(request):
    """Handle Stripe webhook events"""
    stripe = _get_stripe()
    if not stripe:
        return HttpResponse(status=503)

    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.warning('Stripe webhook signature failed: %s', e)
        return HttpResponse(status=400)

    event_type = event['type']
    data = event['data']['object']

    if event_type == 'checkout.session.completed':
        _handle_checkout_completed(data)
    elif event_type == 'customer.subscription.updated':
        _handle_subscription_updated(data)
    elif event_type == 'customer.subscription.deleted':
        _handle_subscription_deleted(data)
    elif event_type == 'invoice.payment_failed':
        _handle_payment_failed(data)

    return HttpResponse(status=200)


def _handle_checkout_completed(session_data):
    """Upgrade user to Pro after successful checkout"""
    customer_id = session_data.get('customer')
    subscription_id = session_data.get('subscription')

    try:
        sub = Subscription.objects.get(stripe_customer_id=customer_id)
        sub.plan = Subscription.Plan.PRO
        sub.status = Subscription.Status.ACTIVE
        sub.stripe_subscription_id = subscription_id or ''
        sub.save()
        logger.info('User %s upgraded to Pro', sub.user.username)
    except Subscription.DoesNotExist:
        logger.warning('Checkout completed but no subscription found for customer %s', customer_id)


def _handle_subscription_updated(sub_data):
    """Handle subscription changes (plan change, renewal, etc.)"""
    customer_id = sub_data.get('customer')
    status = sub_data.get('status', '')

    try:
        sub = Subscription.objects.get(stripe_customer_id=customer_id)
        sub.status = status
        sub.cancel_at_period_end = sub_data.get('cancel_at_period_end', False)

        # Update period dates
        from datetime import datetime, timezone
        period_start = sub_data.get('current_period_start')
        period_end = sub_data.get('current_period_end')
        if period_start:
            sub.current_period_start = datetime.fromtimestamp(period_start, tz=timezone.utc)
        if period_end:
            sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)

        sub.save()
    except Subscription.DoesNotExist:
        pass


def _handle_subscription_deleted(sub_data):
    """Handle subscription cancellation"""
    customer_id = sub_data.get('customer')
    try:
        sub = Subscription.objects.get(stripe_customer_id=customer_id)
        sub.plan = Subscription.Plan.FREE
        sub.status = Subscription.Status.CANCELED
        sub.stripe_subscription_id = ''
        sub.save()
        logger.info('User %s downgraded to Free (subscription canceled)', sub.user.username)
    except Subscription.DoesNotExist:
        pass


def _handle_payment_failed(invoice_data):
    """Handle failed payment"""
    customer_id = invoice_data.get('customer')
    try:
        sub = Subscription.objects.get(stripe_customer_id=customer_id)
        sub.status = Subscription.Status.PAST_DUE
        sub.save()
        logger.warning('Payment failed for user %s', sub.user.username)
    except Subscription.DoesNotExist:
        pass
