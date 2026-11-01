"""Test settings for the CONCURRENCY tests: the same as `settings_test`, but the test database is a real SQLite
FILE instead of Django's default in-memory database.

    TEST_SQLITE_FILE=<path> python manage.py test questionnaire.test_stage3_lifecycle.RapidDoubleSubmitTests \
        --settings=carbonless_api.settings_test_filedb

Why this exists (Phase 2 finding, evidence in the Phase 2 report):
* Django's SQLite test database is in-memory with a SHARED CACHE. In that mode a table-lock conflict raises
  `OperationalError` immediately: SQLite's busy timeout does not wait on it. A request that meets another
  request's write lock therefore fails instead of waiting.
* Django's test client also connects its exception capture to the global `got_request_exception` signal, so in a
  multi-threaded test one thread's failure is re-raised by every other client with a request in flight, and
  requests that actually committed are reported as errors.
* On a real SQLite file the normal busy timeout applies (a writer waits for the lock) and neither effect occurs.
  That is the locking behaviour of the development database, which is what the concurrency tests are about.

This changes only WHERE the test database lives. No application behaviour is altered to suit either mode, and
the signed-inventory gate, the transactions and the rate limits are exactly the ones the application ships.
The file is created by the test runner and removed by it when the run ends; it is never the development
database (`db.sqlite3`). Like `settings_test`, this module refuses to load in Production.

`TEST_SQLITE_FILE` chooses the file; without it a file in the system temp directory is used.
"""
import os
import tempfile

from .settings_test import *  # noqa: F401,F403
from .settings_test import DATABASES, IS_PRODUCTION

if IS_PRODUCTION:
    raise RuntimeError('settings_test_filedb must never be used in Production.')

_test_file = os.environ.get('TEST_SQLITE_FILE') or os.path.join(tempfile.gettempdir(), 'carbonless_test_filedb.sqlite3')
if os.path.abspath(_test_file) == os.path.abspath(str(DATABASES['default']['NAME'])):
    raise RuntimeError('The file-backed test database must not be the development database.')
DATABASES['default']['TEST'] = {'NAME': _test_file}
