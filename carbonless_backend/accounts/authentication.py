from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')


class CookieJWTAuthentication(JWTAuthentication):
    """
    Reads JWT from HttpOnly cookie first, falls back to Authorization header.
    This allows both cookie-based (browser) and header-based (API) auth.

    Security note: cookie-only auth is accepted for state-changing (unsafe)
    requests ONLY IF an Authorization header is also present. The access_token
    cookie is set with SameSite=None in production (needed for the Vercel
    frontend / Render backend cross-subdomain setup), which means it is sent
    on cross-site requests too — without this restriction, a page on any
    other site could trigger a state-changing request (e.g. POST a chat
    message, confirm an emission entry) using the victim's ambient cookie,
    since this app doesn't use Django's session-based CSRF machinery. A
    cross-site attacker cannot set a custom Authorization header (forms
    can't, and a fetch with one triggers a CORS preflight this backend's
    CORS_ALLOWED_ORIGINS already rejects for unknown origins), so requiring
    the header for unsafe methods closes that gap while every real request
    from this app's own frontend already sends it (see api.js's `request()`).
    """

    def authenticate(self, request):
        # Try header first (API clients, tests, and our own frontend — every
        # request the frontend makes already attaches this header, see
        # nexus_insights-saas-neon_nextjs/src/lib/utils/api.js).
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        # Cookie-only fallback: safe for read-only requests, but a
        # state-changing request must not authenticate off the cookie alone.
        if request.method not in SAFE_METHODS:
            return None

        # Try cookie (browser)
        raw_token = request.COOKIES.get('access_token')
        if raw_token is None:
            return None

        # Fix #52: Wrap cookie validation so an expired or tampered cookie
        # returns None (anonymous) instead of raising InvalidToken.
        # Without this guard, any AllowAny endpoint hard-fails with 401 for
        # users who have a stale cookie — the exception propagates through DRF's
        # authentication middleware before permission checks even run.
        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except (InvalidToken, TokenError):
            return None
