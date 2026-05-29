from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class CookieJWTAuthentication(JWTAuthentication):
    """
    Reads JWT from HttpOnly cookie first, falls back to Authorization header.
    This allows both cookie-based (browser) and header-based (API) auth.
    """

    def authenticate(self, request):
        # Try header first (API clients, tests)
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

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
