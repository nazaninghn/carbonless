"""
Who is asking — for rate limits.

Behind Render's proxy (and, for sign-in, the Next.js /api/auth routes on
Vercel) REMOTE_ADDR is the proxy's address for every visitor, so a limit keyed
on it is one shared limit for the whole site: ten failed logins by anyone
locked everybody out for a minute, and ten sign-ups an hour closed sign-up.

client_ip() takes the address the trusted proxy recorded in X-Forwarded-For
instead: the entry RATELIMIT_TRUSTED_PROXIES places from the right (1 = the
address that connected to Render). Sign-in is limited per account instead
(see accounts.views), since those requests all arrive from Vercel.
"""
from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def client_ip(request):
    hops = getattr(settings, 'RATELIMIT_TRUSTED_PROXIES', 0)
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if hops and forwarded:
        parts = [p.strip() for p in forwarded.split(',') if p.strip()]
        if len(parts) >= hops:
            return parts[-hops]
    return request.META.get('REMOTE_ADDR', '')


def client_ip_key(group, request):
    """django-ratelimit key: the visitor's own address."""
    return client_ip(request)


def login_key(group, request):
    """Sign-in attempts are counted per account name (case-insensitive), so
    one person's wrong passwords never lock anybody else out."""
    # DRF's Request (the view's .post receives it) parses JSON into .data.
    data = getattr(request, 'data', None)
    name = data.get('username', '') if hasattr(data, 'get') else request.POST.get('username', '')
    return str(name).strip().lower() or client_ip(request)


def exception_handler(exc, context):
    """A rate-limited request answers 429 with a code the frontend can put
    into words, instead of DRF's 403 'You do not have permission…'."""
    from django_ratelimit.exceptions import Ratelimited
    if isinstance(exc, Ratelimited):
        return Response({
            'error': 'Too many attempts. Please wait a little and try again.',
            'code': 'rate_limited',
        }, status=429)
    return drf_exception_handler(exc, context)
