"""Simultaneous refreshes: one old refresh token can start exactly ONE new chain, however many requests present it.

The tests run the real endpoint from several threads at once, each with its own database connection, against a real SQLite
file (Django's in-memory test database cannot wait on a lock): run them with
    python manage.py test accounts.test_refresh_concurrency --tag=filedb_only --settings=carbonless_api.settings_test_filedb
(CI does; see .github/workflows/ci.yml). A token is consumed by creating its blacklist row, a unique row in the database,
so the claim holds across threads, processes and gunicorn workers alike.

What is asserted every time: exactly one request answers 200, every other answers a definite 401 (never a 500, never a
second token), and afterwards exactly one refresh token of the user is still valid.
"""
import threading
import time

from django.core.cache import cache
from django.contrib.auth.models import User
from django.db import OperationalError, connection
from django.test import TransactionTestCase, tag
from rest_framework.test import APIClient
from rest_framework_simplejwt.state import token_backend
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from accounts.session import issue_refresh_for_user

N = 8
ATTEMPT = 'attempt-0123456789abcdef'


def refresh_call(old, attempt=None, activity=None):
    extra = {}
    if attempt:
        extra['HTTP_X_REFRESH_ATTEMPT'] = attempt
    if activity is not None:
        extra['HTTP_X_USER_ACTIVITY'] = str(activity)
    return APIClient().post('/api/accounts/token/refresh/', {'refresh': old}, format='json', **extra)


def at_once(calls):
    """Run each callable in its own thread (own DB connection) released together; returns [(status, refresh-or-None)]."""
    results, barrier = [], threading.Barrier(len(calls))

    def go(call):
        try:
            barrier.wait(timeout=10)
            for _ in range(60):
                try:
                    r = call()
                    results.append((r.status_code, r.data.get('refresh') if r.status_code == 200 else None))
                    return
                except OperationalError:        # a SQLite lock before anything was written: the request did not happen
                    time.sleep(0.05)
            results.append(('gave up', None))
        finally:
            connection.close()
    threads = [threading.Thread(target=go, args=(c,)) for c in calls]
    [t.start() for t in threads]
    [t.join(90) for t in threads]
    return results


def live_tokens(user):
    """Refresh tokens of this user that are outstanding and not blacklisted: the chains that could still be used."""
    return list(OutstandingToken.objects.filter(user=user).exclude(blacklistedtoken__isnull=False))


@tag('filedb_only')
class SimultaneousRefreshTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('race', 'race@test.com', 'pass12345')

    def assert_exactly_one(self, results):
        statuses = sorted(str(r[0]) for r in results)
        self.assertEqual(statuses, sorted(['200'] + ['401'] * (len(results) - 1)), statuses)   # one winner, definite losers
        winner = next(r[1] for r in results if r[0] == 200)
        live = live_tokens(self.user)
        self.assertEqual(len(live), 1, f'{len(live)} refresh tokens are still valid')            # no second chain
        self.assertEqual(token_backend.decode(winner)['jti'], live[0].jti)                       # and it is the winner's
        return winner

    def test_simultaneous_ordinary_refreshes_issue_exactly_one_new_token(self):
        old = str(issue_refresh_for_user(self.user))
        results = at_once([lambda: refresh_call(old)] * N)
        self.assert_exactly_one(results)
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=token_backend.decode(old)['jti']).exists())

    def test_simultaneous_first_tries_of_one_attempt_issue_exactly_one_new_token(self):
        old = str(issue_refresh_for_user(self.user))
        results = at_once([lambda: refresh_call(old, ATTEMPT)] * N)
        winner = self.assert_exactly_one(results)
        # the winner's answer is "lost": a repeat of that attempt (a browser waits a second) still recovers, and leaves
        # one live token again
        time.sleep(1.0)
        again = refresh_call(old, ATTEMPT)
        self.assertEqual(again.status_code, 200)
        self.assertNotEqual(again.data['refresh'], winner)
        self.assertEqual(token_backend.decode(again.data['refresh'])['jti'], live_tokens(self.user)[0].jti)
        self.assertEqual(len(live_tokens(self.user)), 1)

    def test_simultaneous_repeats_of_a_lost_answer_issue_exactly_one_new_token(self):
        old = str(issue_refresh_for_user(self.user))
        first = refresh_call(old, ATTEMPT)                    # its answer is "lost"
        self.assertEqual(first.status_code, 200)
        time.sleep(1.0)                                       # a repeat comes after the browser noticed the loss
        results = at_once([lambda: refresh_call(old, ATTEMPT)] * N)
        winner = self.assert_exactly_one(results)
        self.assertNotEqual(winner, first.data['refresh'])
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=token_backend.decode(first.data['refresh'])['jti']).exists())

    def test_a_repeat_racing_the_use_of_the_first_tries_token_cannot_make_two_chains(self):
        old = str(issue_refresh_for_user(self.user))
        first = refresh_call(old, ATTEMPT)                    # delivered after all: the browser may refresh with it ...
        self.assertEqual(first.status_code, 200)
        time.sleep(1.0)
        results = at_once([lambda: refresh_call(first.data['refresh']),     # ... while a late repeat of the same attempt arrives
                           lambda: refresh_call(old, ATTEMPT)])
        statuses = sorted(str(r[0]) for r in results)
        self.assertEqual(statuses, ['200', '401'], statuses)
        self.assertEqual(len(live_tokens(self.user)), 1)

    def test_simultaneous_refreshes_never_revive_a_token_that_was_signed_out(self):
        old = str(issue_refresh_for_user(self.user))
        access_old = None
        first = refresh_call(old, ATTEMPT)
        out = APIClient().post('/api/accounts/logout/', {'refresh': first.data['refresh']}, format='json',
                               HTTP_AUTHORIZATION=f"Bearer {first.data['access']}")
        self.assertEqual(out.status_code, 200)
        results = at_once([lambda: refresh_call(old, ATTEMPT), lambda: refresh_call(first.data['refresh'])] * (N // 2))
        self.assertEqual({r[0] for r in results}, {401}, results)
        self.assertEqual(live_tokens(self.user), [])
        self.assertIsNone(access_old)
