class ContentSecurityPolicyMiddleware:
    """Adds a CSP header to every response.

    This is a pure JSON API consumed by a separate Next.js frontend, so the
    only real HTML surface CSP protects is the Django admin (django-unfold,
    which bundles its own self-hosted CSS/JS — no third-party CDN is used).
    Unfold's interactivity is built on Alpine.js, which needs 'unsafe-eval'
    to evaluate x-data/x-on expressions, and Tailwind's admin theme relies on
    inline styles — so this can't be a fully strict policy. It still blocks
    the main thing CSP is for here: an XSS payload loading/exfiltrating to an
    attacker-controlled origin, since every directive is locked to 'self'.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "object-src 'none'; "
            "base-uri 'self'"
        )
        return response


class CompanyGuardMiddleware:
    """A page sends the company it was opened with (X-Company-Id). The
    company a request works in is the user's active one, kept on the
    server — so a tab left open on company A, after another tab switched to
    company B, would show B's data under A's name and save into B. When the
    two differ the request is refused (409 company_changed) and the page
    reloads. Requests without the header (API clients, tests) and the
    switch / sign-in calls themselves are not checked."""

    EXEMPT = ('/api/companies/switch/', '/api/companies/my-companies/', '/api/auth/',
              '/api/accounts/login/', '/api/accounts/logout/', '/api/accounts/token/')

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        wanted = (request.headers.get('X-Company-Id') or '').strip()
        if wanted and request.method != 'OPTIONS' and request.path.startswith('/api/') \
                and not request.path.startswith(self.EXEMPT):
            current = self._current_company(request)
            if current is not None and str(current.pk) != wanted:
                from django.http import JsonResponse
                return JsonResponse({
                    'error': 'The active company was changed in another tab.',
                    'code': 'company_changed',
                    'active_company': {'id': current.pk, 'name': current.legal_entity_name},
                }, status=409)
        return self.get_response(request)

    @staticmethod
    def _current_company(request):
        try:
            from accounts.authentication import CookieJWTAuthentication
            from companies.utils import get_current_company
            result = CookieJWTAuthentication().authenticate(request)
            if not result:
                return None
            return get_current_company(result[0])
        except Exception:
            return None
