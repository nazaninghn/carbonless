"""Inactivity timeout of a signed-in session, enforced by the server.

Rule: a session ends after SESSION_IDLE_TIMEOUT_SECONDS (30 minutes) without MEANINGFUL USER ACTIVITY. There is no
absolute lifetime: a user who keeps working stays signed in for as long as they work.

How it is enforced without a database column (and so without a migration): every token carries an `act` claim, the
moment of the user's last meaningful activity as the server last learned of it.

* Login stamps `act = now` on the refresh token (the access token inherits it).
* EVERY authenticated request rejects an access token whose `act` is older than the limit (accounts.authentication).
* A refresh is rejected, and the refresh token blacklisted, when its `act` is older than the limit: a refresh token
  can never revive a session that has been idle for 30 minutes.
* A refresh moves `act` forward ONLY when the request says it follows real user activity (header X-User-Activity:
  seconds since that activity). Any other refresh (the automatic retry after an expired access token, a background
  call) keeps the old `act`: automatic refreshing never keeps an inactive session alive.

Honest limit: whether the user was active is reported by the browser (it can see clicks and keys, the server cannot).
X-User-Activity is a CLIENT-REPORTED SIGNAL, not cryptographic proof of human activity. The server enforces the 30-minute
bound on that report; it cannot prove the report is true. Anyone holding a refresh token can fabricate the header on every
refresh and so keep that token chain alive indefinitely; this is NOT eliminated. What is guaranteed: an unused token, or a
token used only by automatic (header-less) refreshes, dies 30 minutes after the user's last reported activity.
See SESSION_TIMEOUT.md for the guarantees, the limits and the options reviewed.

Exclusive rotation: a refresh token is consumed by creating its (unique) blacklist row before anything new is issued, so one
old token can start only one new chain, across workers. The replay cache never decides anything the database does not also
allow, and its failure only disables the lost-answer retry.

Tokens issued before this rule existed carry no `act`; their issue time (`iat`) is used, which is the moment of their
last refresh: a session that was active then is unaffected, an idle one ends.
"""
import hashlib
import logging
import re
import time

from django.conf import settings
from django.core.cache import caches
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer

ACTIVITY_CLAIM = 'act'
ACTIVITY_HEADER = 'X-User-Activity'
ATTEMPT_HEADER = 'X-Refresh-Attempt'
REPLAY_SECONDS = 60        # how long a refresh attempt can be repeated after its answer was lost
MAX_REPLAYS = 3            # tries of one attempt in all (the first and its repeats)
MIN_REPLAY_DELAY = 0.9     # seconds: a repeat cannot come sooner than a browser can notice a lost answer (it waits 1 s)
_ATTEMPT_RE = re.compile(r'^[A-Za-z0-9-]{16,64}$')
EXPIRED_CODE = 'session_expired'

logger = logging.getLogger(__name__)


def idle_limit_seconds():
    return int(getattr(settings, 'SESSION_IDLE_TIMEOUT_SECONDS', 30 * 60))


def last_activity(payload):
    """Epoch seconds of the user's last activity as recorded in a token payload."""
    act = payload.get(ACTIVITY_CLAIM)
    if isinstance(act, (int, float)) and not isinstance(act, bool):
        return int(act)
    iat = payload.get('iat')
    return int(iat) if isinstance(iat, (int, float)) else 0


def is_idle_expired(payload, now=None):
    now = int(time.time() if now is None else now)
    return now - last_activity(payload) > idle_limit_seconds()


def session_expired_error():
    return InvalidToken({'detail': 'Session expired due to inactivity.', 'code': EXPIRED_CODE, 'messages': []})


def stamp(token, now=None):
    """Record "the user was active just now" on a freshly issued token."""
    token[ACTIVITY_CLAIM] = int(time.time() if now is None else now)
    return token


def issue_refresh_for_user(user):
    """A refresh token for a sign-in (the access token derived from it carries the same `act`)."""
    from rest_framework_simplejwt.tokens import RefreshToken
    return stamp(RefreshToken.for_user(user))


class ActivityTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        return stamp(super().get_token(user))


def reported_activity_age(request):
    """Seconds since the user's last activity, as the browser reports it; None when absent or not a sane number."""
    raw = request.headers.get(ACTIVITY_HEADER) if request is not None else None
    try:
        age = int(str(raw).strip())
    except (TypeError, ValueError):
        return None
    return age if 0 <= age <= idle_limit_seconds() else None


def reported_attempt(request):
    """The browser's id for one refresh attempt (a random value it keeps in memory, never in a cookie), or None."""
    raw = request.headers.get(ATTEMPT_HEADER) if request is not None else None
    return raw if raw and _ATTEMPT_RE.match(raw) else None


def _replay_key(old_jti, attempt):
    return 'refresh-attempt:' + hashlib.sha256(f'{old_jti}:{attempt}'.encode()).hexdigest()


# ---- the replay cache: an optimisation that may fail at any time, never a source of truth ---------------------------------
# Every access is guarded. A cache that cannot be read or written only switches the lost-answer retry off for that attempt;
# the validated refresh itself (signature, expiry, blacklist, idle rule, rotation) never depends on it.

def _replay_cache():
    from django.core.cache import caches
    try:
        return caches['session_replay']
    except Exception:  # not configured: the default cache (per process) still serves a retry that lands on the same worker
        return caches['default']


def _cache_warning(action, exc):
    # the exception TYPE only: neither a token nor a key nor anything of the request is logged
    logger.warning('session replay cache unavailable (%s failed: %s); the lost-answer retry is disabled for this attempt',
                   action, type(exc).__name__)


def _cache_get(key):
    try:
        entry = _replay_cache().get(key)
    except Exception as exc:
        _cache_warning('read', exc)
        return None
    # what comes out of a cache is not trusted: only this exact shape is considered at all
    if (isinstance(entry, dict) and isinstance(entry.get('jti'), str) and type(entry.get('n')) is int
            and 0 < entry['n'] < MAX_REPLAYS and isinstance(entry.get('at'), (int, float))):
        return entry
    return None


def _cache_set(key, jti, count):
    try:
        _replay_cache().set(key, {'jti': jti, 'n': count, 'at': time.time()}, REPLAY_SECONDS)
    except Exception as exc:
        _cache_warning('write', exc)


# ---- consuming a refresh token: exactly one request can do it -------------------------------------------------------------
# BlacklistedToken.token is a unique (one-to-one) column, so creating that row is an atomic claim enforced by the database
# itself, across every worker and process: of any number of simultaneous requests, exactly one gets created=True.
# The claim is made in autocommit as the first write (no read-then-write transaction that SQLite would refuse to upgrade).

def _blacklisted(jti):
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
    return BlacklistedToken.objects.filter(token__jti=jti).exists()


def _claim_token(refresh):
    """Consume this (already verified) refresh token. True only for the single request that blacklists it."""
    try:
        _, created = refresh.blacklist()
    except AttributeError:      # the blacklist app is not installed: nothing can be consumed or revoked
        return True
    return created


def _claim_jti(jti, user_id):
    """Revoke the token with this id, which must be one of this user's outstanding tokens. True only for the single request
    that creates its blacklist row; False when it does not exist, belongs to someone else, or is already revoked."""
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    outstanding = OutstandingToken.objects.filter(jti=jti, user_id=user_id).first()
    if outstanding is None:
        return False
    _, created = BlacklistedToken.objects.get_or_create(token=outstanding)
    return created


class ActivityTokenRefreshSerializer(TokenRefreshSerializer):
    """SimpleJWT's refresh, plus the inactivity rule, exclusive rotation and a safe retry (see the module docstring).

    Exclusive rotation. A refresh token is consumed by creating its blacklist row (unique in the database), BEFORE anything
    new is issued. Of simultaneous requests presenting the same token only the one that creates the row gets new tokens; the
    others receive a definite 401. So one old token can never start more than one chain, whatever the number of workers.

    Retry after a lost answer. A refresh rotates the refresh token: the old one is blacklisted at once. If the answer
    never reaches the browser (a dropped connection, a page that navigated away), the browser still holds the old token,
    which is now dead, and the user would be signed out for nothing. To avoid that, the browser labels each attempt with a
    random id and repeats the SAME attempt (same id) when it got no answer. The server remembers, for 60 seconds and only
    as a hash of (old token id, attempt id), the id of the token it issued. A repeat that proves both the old token and
    the attempt id:
      * revokes the token issued by the first try (it was never acknowledged, so nothing legitimate holds it), and
      * issues a fresh one.
    The revocation is the same exclusive claim as above, so of simultaneous repeats exactly one succeeds, and the repeat can
    never leave two live tokens: the first try's token is revoked before the new one exists.
    Nothing secret is stored, and the retry needs something a thief of the cookie alone does not have (the attempt id).
    It is refused when the token the first try issued has already been used or revoked (the chain moved on, or the user
    signed out), after 3 tries in all, when it arrives less than 0.9 s after the try it repeats (a duplicate, not a retry),
    when the session is idle, when the cache entry is not exactly what this server wrote, and whenever the cache cannot be read.
    """

    def validate(self, attrs):
        from rest_framework_simplejwt.exceptions import AuthenticationFailed, TokenError
        from rest_framework_simplejwt.settings import api_settings
        from rest_framework_simplejwt.state import token_backend
        from rest_framework_simplejwt.tokens import RefreshToken
        request = self.context.get('request')
        attempt = reported_attempt(request)
        presented = attrs['refresh']

        replay = None
        if attempt:
            try:
                payload = token_backend.decode(presented, verify=True)   # signature + expiry, not the blacklist
            except Exception:
                payload = None
            if payload is not None and _blacklisted(payload.get('jti')):  # a retry only ever follows a rotation that consumed it
                entry = _cache_get(_replay_key(payload.get('jti'), attempt))
                # a repeat comes AFTER the first try was answered or lost: a duplicate that arrives at the same moment as the
                # first try is not a retry and loses the race like any other (a definite 401)
                if entry is not None and time.time() - entry['at'] >= MIN_REPLAY_DELAY and not _blacklisted(entry['jti']):
                    replay = (payload, entry)
        if replay is not None:
            refresh = RefreshToken()                           # built from the payload verified above, never from unchecked text
            refresh.payload = dict(replay[0])
            old_jti, count = replay[0].get('jti'), replay[1]['n'] + 1
        else:
            refresh = RefreshToken(presented)                  # signature, expiry and blacklist are checked here
            old_jti, count = refresh.payload.get('jti'), 1

        now = int(time.time())
        if is_idle_expired(refresh.payload, now):
            if replay is None:
                try:
                    refresh.blacklist()
                except (AttributeError, TokenError):
                    pass
            raise session_expired_error()
        user_id = refresh.payload.get(api_settings.USER_ID_CLAIM, None)
        if user_id:
            from django.contrib.auth import get_user_model
            user = get_user_model().objects.filter(**{api_settings.USER_ID_FIELD: user_id}).first()
            if user is None or not api_settings.USER_AUTHENTICATION_RULE(user):
                raise AuthenticationFailed(self.error_messages['no_active_account'], 'no_active_account')
        age = reported_activity_age(request)
        if age is not None:
            # never backwards, never into the future
            refresh[ACTIVITY_CLAIM] = min(now, max(last_activity(refresh.payload), now - age))
        elif ACTIVITY_CLAIM not in refresh.payload:
            refresh[ACTIVITY_CLAIM] = last_activity(refresh.payload)   # a legacy token keeps its (old) time, not "now"

        if not api_settings.ROTATE_REFRESH_TOKENS:
            return {'access': str(refresh.access_token)}

        # consume first: only the request that wins this claim may issue anything
        if replay is not None:
            claimed = _claim_jti(replay[1]['jti'], user_id)    # revoke the first try's never-delivered token
        elif api_settings.BLACKLIST_AFTER_ROTATION:
            claimed = _claim_token(refresh)
        else:
            claimed = True
        if not claimed:
            from rest_framework_simplejwt.exceptions import InvalidToken
            raise InvalidToken({'detail': 'Token is blacklisted', 'code': 'token_not_valid', 'messages': []})

        data = {'access': str(refresh.access_token)}
        refresh.set_jti()
        refresh.set_exp()
        refresh.set_iat()
        refresh.outstand()
        data['refresh'] = str(refresh)
        if attempt:
            _cache_set(_replay_key(old_jti, attempt), refresh.payload['jti'], count)
        return data
