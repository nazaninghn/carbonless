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
