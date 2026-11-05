"""The 30-minute inactivity timeout (accounts/session.py): what the server enforces, and what it never touches."""
import time as real_time
from contextlib import contextmanager
from types import SimpleNamespace
from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.state import token_backend
from rest_framework_simplejwt.tokens import RefreshToken

from accounts import session
from companies.models import Company, CompanyMembership
from questionnaire.models import CarbonReport

IDLE = 30 * 60


@contextmanager
def clock_ahead(seconds):
    """accounts.session sees the time `seconds` later (the token library's own expiry clock is left alone: the
    tokens are real and valid for 30 minutes / 7 days, only the INACTIVITY rule's clock moves)."""
    fake = SimpleNamespace(time=lambda: real_time.time() + seconds)
    with mock.patch.object(session, 'time', fake):
        yield


def act_of(token_str):
    return RefreshToken(token_str).payload.get('act')


class _Base(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user('idle', 'idle@test.com', 'pass12345')
        self.company = Company.objects.create(legal_entity_name='Idle Co', tax_number='9', country_of_headquarters='TR',
                                              countries_of_operation='TR', nace_code='', main_activity_description='x',
                                              number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')

    def login(self):
        cache.clear()                                   # the login rate limit (10 a minute) is not what is tested here
        r = APIClient().post('/api/accounts/login/', {'username': 'idle', 'password': 'pass12345'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        return r.data['access'], r.data['refresh']

    def me(self, access):
        c = APIClient()
        return c.get('/api/accounts/profile/', HTTP_AUTHORIZATION=f'Bearer {access}')

    def refresh(self, refresh, activity_age=None):
        extra = {} if activity_age is None else {'HTTP_X_USER_ACTIVITY': str(activity_age)}
        return APIClient().post('/api/accounts/token/refresh/', {'refresh': refresh}, format='json', **extra)


class StampTests(_Base):
    def test_login_stamps_the_time_of_the_last_activity_on_both_tokens(self):
        access, refresh = self.login()
        now = int(real_time.time())
        self.assertAlmostEqual(act_of(refresh), now, delta=5)
        from rest_framework_simplejwt.tokens import AccessToken
        self.assertAlmostEqual(AccessToken(access).payload['act'], now, delta=5)


class EnforcementTests(_Base):
    def test_a_request_after_30_minutes_without_activity_is_refused_with_a_clear_code(self):
        access, _ = self.login()
        self.assertEqual(self.me(access).status_code, 200)
        with clock_ahead(IDLE + 60):
            r = self.me(access)
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.data.get('code'), 'session_expired')

    def test_a_request_just_inside_the_limit_still_works(self):
        access, _ = self.login()
        with clock_ahead(IDLE - 60):
            self.assertEqual(self.me(access).status_code, 200)

    def test_a_refresh_token_cannot_revive_an_idle_session_and_is_blacklisted(self):
        _, refresh = self.login()
        with clock_ahead(IDLE + 60):
            r = self.refresh(refresh, activity_age=0)           # even claiming activity does not help
            self.assertEqual(r.status_code, 401)
            self.assertEqual(r.data.get('code'), 'session_expired')
        # the cookies are cleared in the answer
        self.assertEqual(r.cookies['refresh_token'].value, '')
        # and the token stays dead later, within any clock
        self.assertEqual(self.refresh(refresh).status_code, 401)

    def test_an_automatic_refresh_does_not_extend_the_session(self):
        _, refresh = self.login()
        start = act_of(refresh)
        with clock_ahead(20 * 60):
            r = self.refresh(refresh)                            # no activity header: automatic
            self.assertEqual(r.status_code, 200)
        self.assertEqual(act_of(r.data['refresh']), start)       # `act` did not move
        self.assertEqual(RefreshToken(r.data['refresh']).payload['act'], start)
        # ... so 11 more minutes later (31 after the real activity) the session is over, refreshed or not
        with clock_ahead(31 * 60):
            self.assertEqual(self.me(r.data['access']).status_code, 401)
            self.assertEqual(self.refresh(r.data['refresh']).status_code, 401)

    def test_a_refresh_that_reports_activity_moves_the_time_forward_by_what_was_reported(self):
        _, refresh = self.login()
        start = act_of(refresh)
        with clock_ahead(25 * 60):
            r = self.refresh(refresh, activity_age=10)
            self.assertEqual(r.status_code, 200)
            self.assertAlmostEqual(act_of(r.data['refresh']), start + 25 * 60 - 10, delta=5)
            self.assertEqual(self.me(r.data['access']).status_code, 200)

    def test_nonsense_activity_reports_are_ignored(self):
        _, refresh = self.login()
        start = act_of(refresh)
        for bad in ('-5', 'abc', '', str(IDLE + 1), '1e9'):
            r = self.refresh(refresh, activity_age=bad)
            self.assertEqual(r.status_code, 200, bad)
            self.assertEqual(act_of(r.data['refresh']), start, bad)
            refresh = r.data['refresh']

    def test_a_user_who_keeps_working_is_never_logged_out_however_long_the_work_lasts(self):
        access, refresh = self.login()
        # two hours of work: activity every 20 minutes, each reported on the next refresh
        for minute in range(20, 121, 20):
            with clock_ahead(minute * 60):
                r = self.refresh(refresh, activity_age=5)
                self.assertEqual(r.status_code, 200, f'minute {minute}')
                access, refresh = r.data['access'], r.data['refresh']
                self.assertEqual(self.me(access).status_code, 200, f'minute {minute}')
        # and then 31 minutes with no activity ends it
        with clock_ahead(120 * 60 + 31 * 60):
            self.assertEqual(self.me(access).status_code, 401)

    def test_a_token_from_before_this_rule_is_judged_by_its_issue_time(self):
        fresh = RefreshToken.for_user(self.user)                 # no `act`: issued by the old code
        self.assertNotIn('act', fresh.payload)
        self.assertEqual(self.me(str(fresh.access_token)).status_code, 200)
        with clock_ahead(IDLE + 60):
            self.assertEqual(self.me(str(fresh.access_token)).status_code, 401)
            self.assertEqual(self.refresh(str(fresh)).status_code, 401)


class DataSurvivesTests(_Base):
    def test_an_expired_session_deletes_nothing_and_everything_is_there_after_signing_in_again(self):
        a = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025, title='A')
        b = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025, title='B')
        before = list(CarbonReport.objects.order_by('id').values_list('id', 'title', 'reporting_year', 'status', 'company_id'))
        access, refresh = self.login()
        with clock_ahead(IDLE + 60):
            self.assertEqual(self.me(access).status_code, 401)
            self.assertEqual(self.refresh(refresh).status_code, 401)
        self.assertEqual(list(CarbonReport.objects.order_by('id').values_list('id', 'title', 'reporting_year', 'status', 'company_id')), before)
        self.assertEqual(User.objects.filter(username='idle').count(), 1)
        # sign in again: both inventories (same year) are listed, each as it was
        access, _ = self.login()
        r = APIClient().get('/api/questionnaire/', HTTP_AUTHORIZATION=f'Bearer {access}')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(sorted(x['report_id'] for x in r.data['reports']), sorted([a.id, b.id]))


class LogoutTests(_Base):
    """Signing out must end the refresh token at the server too, not only delete the browser's copy of it."""

    def logout(self, access, refresh=None):
        body = {} if refresh is None else {'refresh': refresh}
        return APIClient().post('/api/accounts/logout/', body, format='json', HTTP_AUTHORIZATION=f'Bearer {access}')

    def test_logout_blacklists_the_refresh_token_it_is_given(self):
        access, refresh = self.login()
        self.assertEqual(self.logout(access, refresh).status_code, 200)
        r = self.refresh(refresh)                                  # the token is dead, even when it claims activity
        self.assertEqual(r.status_code, 401)
        self.assertEqual(self.refresh(refresh, activity_age=0).status_code, 401)

    def test_without_the_refresh_token_logout_still_succeeds_and_leaves_the_token_untouched(self):
        access, refresh = self.login()
        self.assertEqual(self.logout(access).status_code, 200)
        self.assertEqual(self.refresh(refresh).status_code, 200)   # nothing was given to blacklist (the old behaviour)

    def test_logout_needs_a_signed_in_user(self):
        _, refresh = self.login()
        r = APIClient().post('/api/accounts/logout/', {'refresh': refresh}, format='json')
        self.assertEqual(r.status_code, 401)
        self.assertEqual(self.refresh(refresh).status_code, 200)   # an anonymous caller cannot kill someone's token

    def test_logout_deletes_nothing(self):
        CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025, title='kept')
        access, refresh = self.login()
        self.logout(access, refresh)
        self.assertEqual(CarbonReport.objects.filter(title='kept').count(), 1)
        self.assertTrue(User.objects.filter(username='idle').exists())


class LostAnswerRetryTests(_Base):
    """A refresh whose answer never arrived can be repeated (same attempt id) without signing the user out, and without
    giving a thief of the cookie anything: see ActivityTokenRefreshSerializer."""

    ATTEMPT = 'attempt-0123456789abcdef'

    def setUp(self):
        super().setUp()
        # a repeat normally waits at least 0.9 s (a browser waits 1 s); these tests repeat at once
        patcher = mock.patch.object(session, 'MIN_REPLAY_DELAY', 0)
        patcher.start()
        self.addCleanup(patcher.stop)

    def refresh(self, refresh, attempt=ATTEMPT, activity_age=None):
        extra = {}
        if attempt is not None:
            extra['HTTP_X_REFRESH_ATTEMPT'] = attempt
        if activity_age is not None:
            extra['HTTP_X_USER_ACTIVITY'] = str(activity_age)
        return APIClient().post('/api/accounts/token/refresh/', {'refresh': refresh}, format='json', **extra)

    def test_a_repeat_of_the_same_attempt_gets_a_working_token_and_the_lost_one_is_revoked(self):
        _, old = self.login()
        first = self.refresh(old)                       # its answer is "lost": the browser keeps `old`
        self.assertEqual(first.status_code, 200)
        again = self.refresh(old)                       # the same attempt, repeated
        self.assertEqual(again.status_code, 200)
        self.assertNotEqual(again.data['refresh'], first.data['refresh'])
        # the token the first try issued was never delivered: it is dead; the one just issued works
        self.assertEqual(self.refresh(first.data['refresh'], attempt=None).status_code, 401)
        self.assertEqual(self.me(again.data['access']).status_code, 200)
        ok = self.refresh(again.data['refresh'], attempt=None)
        self.assertEqual(ok.status_code, 200)

    def test_a_duplicate_arriving_at_the_same_moment_is_not_a_retry(self):
        with mock.patch.object(session, 'MIN_REPLAY_DELAY', 0.9):
            _, old = self.login()
            first = self.refresh(old)
            self.assertEqual(first.status_code, 200)
            self.assertEqual(self.refresh(old).status_code, 401)                 # too soon to be a retry of a lost answer
            self.assertEqual(self.refresh(first.data['refresh'], attempt=None).status_code, 200)   # the first try's token is intact
            with clock_ahead(1.5):
                _, old2 = self.login()
                a = self.refresh(old2)
            with clock_ahead(3):
                self.assertEqual(self.refresh(old2).status_code, 200)            # a second later it IS one
            self.assertEqual(a.status_code, 200)

    def test_the_old_token_without_the_attempt_id_is_still_refused(self):
        _, old = self.login()
        self.assertEqual(self.refresh(old).status_code, 200)
        self.assertEqual(self.refresh(old, attempt=None).status_code, 401)       # a thief with only the cookie
        self.assertEqual(self.refresh(old, attempt='another-attempt-id-123456').status_code, 401)

    def test_the_attempt_id_alone_is_worth_nothing(self):
        _, mine = self.login()
        _, other = self.login()
        self.assertEqual(self.refresh(mine).status_code, 200)
        self.assertEqual(self.refresh(other, attempt=self.ATTEMPT).status_code, 200)   # a different token: an ordinary first try
        self.assertEqual(self.refresh(other, attempt=self.ATTEMPT).status_code, 200)   # ... which is repeatable too, for ITS owner
        self.assertEqual(self.refresh('x' * 40, attempt=self.ATTEMPT).status_code, 401)  # not a token at all

    def test_no_repeat_once_the_chain_has_moved_on(self):
        _, old = self.login()
        first = self.refresh(old)
        self.assertEqual(self.refresh(first.data['refresh'], attempt=None).status_code, 200)   # the first try's token WAS delivered and used
        self.assertEqual(self.refresh(old).status_code, 401)                                    # so the repeat is refused

    def test_no_repeat_after_signing_out(self):
        access, old = self.login()
        first = self.refresh(old)
        out = APIClient().post('/api/accounts/logout/', {'refresh': first.data['refresh']}, format='json',
                               HTTP_AUTHORIZATION=f"Bearer {first.data['access']}")
        self.assertEqual(out.status_code, 200)
        self.assertEqual(self.refresh(old).status_code, 401)

    def test_a_repeat_is_limited_and_expires(self):
        from django.core.cache import caches
        _, old = self.login()
        for _ in range(session.MAX_REPLAYS):                                     # the first try and its repeats
            self.assertEqual(self.refresh(old).status_code, 200)
        self.assertEqual(self.refresh(old).status_code, 401)                     # one more than allowed
        _, old = self.login()
        self.assertEqual(self.refresh(old).status_code, 200)
        caches['session_replay'].clear()                                         # what the 60 seconds do
        self.assertEqual(self.refresh(old).status_code, 401)

    def test_a_repeat_does_not_revive_an_idle_session(self):
        _, old = self.login()
        self.assertEqual(self.refresh(old).status_code, 200)
        with clock_ahead(IDLE + 60):
            r = self.refresh(old, activity_age=0)
            self.assertEqual(r.status_code, 401)
            self.assertEqual(r.data.get('code'), 'session_expired')

    def test_a_malformed_attempt_id_is_ignored(self):
        _, old = self.login()
        self.assertEqual(self.refresh(old, attempt='short').status_code, 200)
        self.assertEqual(self.refresh(old, attempt='short').status_code, 401)    # no id was recorded: an ordinary reuse

    def test_the_stored_entry_holds_no_token(self):
        from django.core.cache import caches
        _, old = self.login()
        first = self.refresh(old)
        entry = caches['session_replay'].get(session._replay_key(token_backend.decode(old)['jti'], self.ATTEMPT))
        self.assertEqual(set(entry), {'jti', 'n', 'at'})                         # a token id, a counter and a time ...
        self.assertEqual(entry['jti'], RefreshToken(first.data['refresh']).payload['jti'])
        self.assertNotIn(first.data['refresh'], str(entry))                      # ... never the token itself
        self.assertNotIn(first.data['access'], str(entry))


class _BrokenCache:
    """A replay cache that fails the way a full disk or an unwritable directory does."""

    def __init__(self, fail_get=False, fail_set=False, real=None):
        self.fail_get, self.fail_set, self.real = fail_get, fail_set, real

    def get(self, key, default=None):
        if self.fail_get:
            raise OSError('disk gone')
        return self.real.get(key, default) if self.real is not None else default

    def set(self, key, value, timeout=None):
        if self.fail_set:
            raise OSError('disk full')
        if self.real is not None:
            self.real.set(key, value, timeout)


class CacheFailureTests(_Base):
    """The replay cache is an optimisation. When it fails, only the lost-answer retry is lost: the validated refresh, the
    blacklist, rotation and the idle rule behave exactly as without it, and nothing is ever issued on a cache's say-so."""

    ATTEMPT = 'attempt-0123456789abcdef'

    def setUp(self):
        super().setUp()
        patcher = mock.patch.object(session, 'MIN_REPLAY_DELAY', 0)
        patcher.start()
        self.addCleanup(patcher.stop)
        from django.core.cache import caches
        self.real = caches['session_replay']
        self.real.clear()

    def refresh(self, token, attempt=ATTEMPT, activity_age=None):
        extra = {}
        if attempt is not None:
            extra['HTTP_X_REFRESH_ATTEMPT'] = attempt
        if activity_age is not None:
            extra['HTTP_X_USER_ACTIVITY'] = str(activity_age)
        return APIClient().post('/api/accounts/token/refresh/', {'refresh': token}, format='json', **extra)

    def broken(self, **kw):
        return mock.patch.object(session, '_replay_cache', return_value=_BrokenCache(real=self.real, **kw))

    def live(self):
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
        return list(OutstandingToken.objects.filter(user=self.user).exclude(blacklistedtoken__isnull=False))

    def test_a_normal_refresh_completes_when_the_cache_cannot_be_read_or_written(self):
        _, old = self.login()
        with self.broken(fail_get=True, fail_set=True), self.assertLogs('accounts.session', 'WARNING') as logs:
            r = self.refresh(old)
        self.assertEqual(r.status_code, 200)                                      # not a 500
        self.assertEqual(self.me(r.data['access']).status_code, 200)
        self.assertEqual(len(self.live()), 1)                                     # rotation happened exactly once
        self.assertEqual(self.refresh(old, attempt=None).status_code, 401)        # the old token is dead
        self.assertEqual(self.refresh(r.data['refresh'], attempt=None).status_code, 200)   # the new one works
        joined = ' '.join(logs.output)
        self.assertIn('replay cache unavailable', joined)
        self.assertIn('OSError', joined)
        self.assertNotIn(old, joined)                                             # no token in the log
        self.assertNotIn(r.data['refresh'], joined)

    def test_a_cache_write_failure_after_rotation_does_not_lose_the_new_token(self):
        _, old = self.login()
        with self.broken(fail_set=True):
            r = self.refresh(old)
        self.assertEqual(r.status_code, 200)                                      # the answer reaches the browser
        self.assertEqual(self.me(r.data['access']).status_code, 200)
        live = self.live()
        self.assertEqual(len(live), 1)
        self.assertEqual(live[0].jti, token_backend.decode(r.data['refresh'])['jti'])
        self.assertEqual(self.refresh(r.data['refresh'], attempt=None).status_code, 200)

    def test_a_cache_read_failure_turns_the_retry_off_and_nothing_else(self):
        _, old = self.login()
        first = self.refresh(old)                                                 # healthy cache: an entry is stored
        self.assertEqual(first.status_code, 200)
        with self.broken(fail_get=True), self.assertLogs('accounts.session', 'WARNING'):
            again = self.refresh(old)                                             # the repeat cannot be recognised ...
        self.assertEqual(again.status_code, 401)                                  # ... a definite 401, not a 500
        self.assertEqual(len(self.live()), 1)                                     # no second chain
        self.assertEqual(self.refresh(first.data['refresh'], attempt=None).status_code, 200)   # the first try's token is untouched

    def test_the_retry_is_unavailable_for_an_attempt_whose_entry_could_not_be_written(self):
        _, old = self.login()
        with self.broken(fail_set=True):
            first = self.refresh(old)
        self.assertEqual(first.status_code, 200)
        again = self.refresh(old)                                                 # the cache works again: there is simply no entry
        self.assertEqual(again.status_code, 401)
        self.assertEqual(len(self.live()), 1)
        self.assertEqual(self.refresh(first.data['refresh'], attempt=None).status_code, 200)

    def test_logout_and_revocation_hold_while_the_cache_is_down(self):
        _, old = self.login()
        first = self.refresh(old)                                                 # an entry exists for (old, attempt)
        with self.broken(fail_get=True, fail_set=True):
            out = APIClient().post('/api/accounts/logout/', {'refresh': first.data['refresh']}, format='json',
                                   HTTP_AUTHORIZATION=f"Bearer {first.data['access']}")
            self.assertEqual(out.status_code, 200)
            self.assertEqual(self.refresh(first.data['refresh']).status_code, 401)   # signed out stays signed out
            self.assertEqual(self.refresh(old).status_code, 401)
        self.assertEqual(self.live(), [])
        self.assertEqual(self.refresh(old).status_code, 401)                       # and when the cache is back: still no retry

    def test_the_idle_rule_holds_while_the_cache_is_down(self):
        _, old = self.login()
        with self.broken(fail_get=True, fail_set=True), clock_ahead(IDLE + 60):
            r = self.refresh(old, activity_age=0)
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.data.get('code'), 'session_expired')
        self.assertEqual(self.live(), [])

    def test_a_missing_cache_alias_is_not_an_error(self):
        _, old = self.login()
        with mock.patch.object(session, '_replay_cache', side_effect=KeyError('session_replay')), \
                self.assertLogs('accounts.session', 'WARNING'):
            r = self.refresh(old)
        self.assertEqual(r.status_code, 200)

    def test_an_entry_that_is_not_what_the_server_wrote_is_never_trusted(self):
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
        other = User.objects.create_user('other', 'o@test.com', 'pass12345')
        other_token = session.issue_refresh_for_user(other)
        other_token.outstand()
        other_jti = other_token.payload['jti']
        _, old = self.login()
        first = self.refresh(old)                                                 # consumes `old`; a real entry now exists
        self.assertEqual(first.status_code, 200)
        key = session._replay_key(token_backend.decode(old)['jti'], self.ATTEMPT)
        junk = [None, 'text', 7, ['jti'], {}, {'jti': 5, 'n': 1, 'at': 0}, {'jti': 'x', 'n': 'one', 'at': 0},
                {'jti': 'x', 'n': 99, 'at': 0}, {'jti': 'x', 'n': 1}, {'jti': 'x', 'n': True, 'at': 0},
                {'jti': 'no-such-token', 'n': 1, 'at': 0},                          # not an outstanding token at all
                {'jti': other_jti, 'n': 1, 'at': 0}]                                # SOMEONE ELSE's live token
        for entry in junk:
            self.real.set(key, entry, 60)
            r = self.refresh(old)
            self.assertEqual(r.status_code, 401, entry)
            self.assertFalse(BlacklistedToken.objects.filter(token__jti=other_jti).exists(), entry)   # never revoked on a cache's word
        self.assertEqual(len(self.live()), 1)                                      # still only the first try's token

    def test_an_entry_for_a_token_that_was_not_consumed_does_not_start_a_second_chain(self):
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
        _, fresh = self.login()
        sibling = session.issue_refresh_for_user(self.user)
        sibling.outstand()
        key = session._replay_key(token_backend.decode(fresh)['jti'], self.ATTEMPT)
        self.real.set(key, {'jti': sibling.payload['jti'], 'n': 1, 'at': 0}, 60)  # planted for a token nobody has used
        r = self.refresh(fresh)                                                   # an ordinary refresh, with that attempt id
        self.assertEqual(r.status_code, 200)
        self.assertFalse(BlacklistedToken.objects.filter(token__jti=sibling.payload['jti']).exists())
        self.assertEqual(self.refresh(fresh, attempt=None).status_code, 401)      # `fresh` was consumed: no second chain from it
        self.assertEqual(len(self.live()), 2)                                      # the user's own other token, and the one new token
