"""Settings for running the test suite:

    python manage.py test --settings=carbonless_api.settings_test

The only difference from `settings` is a past ownership cutover, so the inventories the tests create count
as ownership-scoped. (The multi-threaded concurrency tests need real SQLite file locking: for those use
`--settings=carbonless_api.settings_test_filedb`, see that module for why.) It is a TEST-ONLY value: this module refuses to load in Production, and the production
settings carry no default (a missing cutover fails closed, see questionnaire/immutability.py).
"""
from .settings import *  # noqa: F401,F403
from .settings import IS_PRODUCTION

if IS_PRODUCTION:
    raise RuntimeError('settings_test must never be used in Production.')

INVENTORY_OWNERSHIP_CUTOVER = '2000-01-01T00:00:00+00:00'
