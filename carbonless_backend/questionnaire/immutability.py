"""Stage 1 write guards: signed and completed inventories, and the ownership boundary.

What this module is, and is not
-------------------------------
These are application-level guards. Every application write path that this stage covers calls one of
them BEFORE its first write. They are not database-level immutability: `QuerySet.update/delete`,
`bulk_*`, raw SQL, the shell, management commands that are not guarded, and database cascades
(company/account deletion, ...) can still change signed data. See the Stage 1 report for the list.

Lock levels
-----------
* SIGNED (`signed_at` set): nothing may change - answers, entries, sync, resync, Workspace, title,
  restart, draft-save, delete, advisor review, re-sign. Reading is unaffected.
* COMPLETED BUT UNSIGNED: only the sign-off steps (`7C-*`) may be saved (so the first signing stays
  possible). No entry-producing synchronisation, no new entries, no change to existing values.

Ownership
---------
`inventory_id` is the only ownership boundary. Nothing here ever assigns, infers or selects an
inventory's records by company, year, description, facility name or content. The company/year
"signed period" check only REJECTS (see `assert_period_writable`).

Ownership-scoped inventories (a TEMPORARY PROXY, not a durable marker)
-----------------------------------------------------------------------
Every entry an inventory created before this stage has `inventory = NULL`. A sync scoped to
`inventory_id` would not see those rows and would create a second, tagged set next to them. Telling
a pre-ownership inventory from a new one, without looking at any record, needs an attribute of the
inventory itself, and the only one available without a schema change is `CarbonReport.created_at`:

    ownership-scoped  <=>  created_at >= INVENTORY_OWNERSHIP_CUTOVER   (UTC, inclusive)

`INVENTORY_OWNERSHIP_CUTOVER` must be the exact moment the code that tags every new row went live in
Production (an inventory created before it is pre-ownership PERMANENTLY, even when edited later).
A missing, empty, unparseable or timezone-less value FAILS CLOSED: no inventory is then considered
ownership-scoped. The setting has no default; only `carbonless_api/settings_test.py` supplies one,
and it refuses to load in Production. A real ownership marker belongs to a separately approved
schema stage and replaces this proxy.
"""
import contextlib
import logging
from datetime import timezone as dt_timezone

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.http import Http404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)

SIGN_OFF_PREFIX = '7C-'

_MESSAGES = {
    'inventory_signed': (
        'This inventory is signed, so it cannot be changed.',
        'Bu envanter imzalı; değiştirilemez.'),
    'inventory_completed_locked': (
        'This inventory is completed. Only the sign-off step can be saved; its answers and records cannot change.',
        'Bu envanter tamamlandı. Yalnızca imza adımı kaydedilebilir; cevapları ve kayıtları değiştirilemez.'),
    'inventory_not_ownership_scoped': (
        'This inventory was created before inventories owned their records, so its records cannot be '
        'changed here until their ownership is resolved.',
        'Bu envanter, kayıtların envantere bağlandığı dönemden önce oluşturuldu; kayıtlarının sahipliği '
        'çözülene kadar burada değiştirilemez.'),
    'entry_unassigned': (
        'This record is not assigned to an inventory, so it cannot be changed until its ownership is resolved.',
        'Bu kayıt bir envantere atanmamış; sahipliği çözülene kadar değiştirilemez.'),
    'facility_locked_by_signed_inventory': (
        'A signed inventory depends on this facility, so this change is not allowed.',
        'İmzalı bir envanter bu tesise dayanıyor; bu değişikliğe izin verilmez.'),
    'inventory_link_failed': (
        'The record could not be linked to the inventory and was not saved.',
        'Kayıt envantere bağlanamadı ve kaydedilmedi.'),
}


class InventoryGuardError(APIException):
    """A write was refused before anything was written. Renders as a bilingual 409 in any DRF view."""
    status_code = 409
    default_code = 'inventory_guard'

    def __init__(self, code, **extra):
        en, tr = _MESSAGES[code]
        super().__init__(detail=en, code=code)
        self.code, self.en, self.tr = code, en, tr
        self.payload = {'success': False, 'code': code, 'error': en, 'error_en': en, 'error_tr': tr,
                        'message_en': en, 'message_tr': tr, 'bot_messages': [en], **extra}
        self.detail = self.payload          # rendered as is (DRF would otherwise stringify the values)

    def __str__(self):
        return self.code


# ── ownership cutover ────────────────────────────────────────────────────────────────────────────
_warned = set()


def _warn_once(key, message):
    if key not in _warned:
        _warned.add(key)
        logger.warning(message)


def ownership_cutover():
    """The configured cutover as an aware UTC datetime, or None (missing / empty / invalid / naive)."""
    raw = getattr(settings, 'INVENTORY_OWNERSHIP_CUTOVER', None)
    text = str(raw).strip() if raw is not None else ''
    if not text:
        _warn_once('', 'INVENTORY_OWNERSHIP_CUTOVER is not set: no inventory is treated as ownership-scoped.')
        return None
    try:
        moment = parse_datetime(text)
    except ValueError:
        moment = None
    if moment is None or timezone.is_naive(moment):
        _warn_once(text, 'INVENTORY_OWNERSHIP_CUTOVER=%r is not an ISO-8601 timestamp with a timezone: '
                         'no inventory is treated as ownership-scoped.' % text)
        return None
    return moment.astimezone(dt_timezone.utc)


def is_ownership_scoped(report):
    cutover = ownership_cutover()
    created = getattr(report, 'created_at', None)
    if cutover is None or created is None or timezone.is_naive(created):
        return False
    return created >= cutover


# ── inventory-level guards ───────────────────────────────────────────────────────────────────────
def is_signoff_step(step):
    return str(step or '').startswith(SIGN_OFF_PREFIX)


def _state(report):
    """The inventory as the database has it now (the object in hand may be stale)."""
    from .models import CarbonReport
    pk = getattr(report, 'pk', None)
    if pk is None:
        return report
    return CarbonReport.objects.filter(pk=pk).only('signed_at', 'status', 'created_at').first() or report


def assert_not_signed(report):
    if _state(report).signed_at:
        raise InventoryGuardError('inventory_signed')


def _apply_checks(state, step, entry_producing):
    """The lock-level rules, applied to an inventory state that is already authoritative."""
    from .models import CarbonReport
    if state.signed_at:
        raise InventoryGuardError('inventory_signed')
    if state.status == CarbonReport.Status.COMPLETED:
        if is_signoff_step(step) and not entry_producing:
            return
        raise InventoryGuardError('inventory_completed_locked')
    if entry_producing and not is_ownership_scoped(state):
        raise InventoryGuardError('inventory_not_ownership_scoped')


def check_report(report, step=None, entry_producing=False):
    """Refuse (409) a write to `report` that its lock level does not allow, from a fresh read.

    * signed: always refused;
    * completed, unsigned: refused unless `step` is a sign-off step and the write is not entry-producing;
    * an entry-producing write to a pre-ownership inventory: refused.

    This read takes no lock, so on its own it is only a FAIL-FAST: a write path must repeat the check
    through `lock_and_check()` inside its write transaction, which is the authoritative one."""
    _apply_checks(_state(report), step, entry_producing)


def lock_and_check(report, step=None, entry_producing=False):
    """THE GATE. Call it as the FIRST database operation of a write transaction.

    1. It takes the inventory's write lock with a conditional no-op UPDATE
       (`SET signed_at = signed_at WHERE pk = ... AND signed_at IS NULL`): no value changes (not `signed_at`,
       not `updated_at`, nothing else), and no signal fires. The lock is taken BEFORE anything is read, so the
       transaction never holds a read lock it will later need to upgrade (that read-then-write upgrade is what
       made concurrent saves fail each other on SQLite), and a concurrent request waits or fails at this
       statement holding nothing.
    2. Zero rows updated means the inventory is signed (or gone): refused. Signing writes `signed_at`, so
       it cannot slip in between this statement and the end of the transaction: it needs the same row.
    3. Only then is the state read, under the lock, and the completed / ownership rules applied to it.
       That state, not the object the caller loaded earlier, is authoritative.

    A refusal raises inside the transaction, so nothing written since it began survives. Returns the state
    read under the lock. Outside a transaction it opens its own, so the lock lasts only for the checks."""
    from django.db import connection
    from django.db.models import F
    from .models import CarbonReport
    pk = getattr(report, 'pk', None)
    if pk is None:
        check_report(report, step=step, entry_producing=entry_producing)
        return report

    def gate():
        touched = CarbonReport.objects.filter(pk=pk, signed_at__isnull=True).update(signed_at=F('signed_at'))
        state = CarbonReport.objects.filter(pk=pk).only('signed_at', 'status', 'created_at').first()
        if state is None:
            raise Http404('Inventory not found.')
        if not touched:
            raise InventoryGuardError('inventory_signed')
        _apply_checks(state, step, entry_producing)
        return state

    if connection.in_atomic_block:
        return gate()                       # the caller's transaction: the UPDATE is its first statement
    with transaction.atomic():
        return gate()


@contextlib.contextmanager
def write_gate(report, step=None, entry_producing=False):
    """atomic + select_for_update + check_report, for code that is not already inside a transaction."""
    with transaction.atomic():
        yield lock_and_check(report, step=step, entry_producing=entry_producing)


def assert_delete_allowed(report):
    """Deleting an inventory: never a signed one, never a pre-ownership one (even an empty draft)."""
    state = _state(report)
    if state.signed_at:
        raise InventoryGuardError('inventory_signed')
    if not is_ownership_scoped(state):
        raise InventoryGuardError('inventory_not_ownership_scoped')


# ── entry-level guards ───────────────────────────────────────────────────────────────────────────
def signed_period_exists(company_id, year):
    """True when the company has a signed inventory for `year`. A protective check only: it says nothing
    about which inventory a record belongs to and is never used to assign one."""
    from .models import CarbonReport
    if not company_id or year is None:
        return False
    return CarbonReport.objects.filter(company_id=company_id, reporting_year=year, signed_at__isnull=False).exists()


def assert_period_writable(company, year, inventory=None):
    """A NEW emission record. With a named inventory: that inventory must not be signed. Without one: the
    company must have no signed inventory for the record's year. Never assigns anything."""
    if inventory is not None:
        if _state(inventory).signed_at:
            raise InventoryGuardError('inventory_signed')
        return
    if signed_period_exists(getattr(company, 'pk', company), year):
        raise InventoryGuardError('inventory_signed')


def entry_block_code(entry):
    """The code of the guard that refuses a change to this EXISTING entry, or None."""
    from .models import CarbonReport
    if entry.inventory_id is None:
        return 'entry_unassigned'
    inv = CarbonReport.objects.filter(pk=entry.inventory_id).only('signed_at', 'status').first()
    if inv is None:
        return 'entry_unassigned'
    if inv.signed_at:
        return 'inventory_signed'
    if inv.status == CarbonReport.Status.COMPLETED:
        return 'inventory_completed_locked'
    return None


def assert_entry_mutable(entry):
    """Any change to an existing entry: refused when it is not assigned to an inventory (until a separately
    approved process resolves its ownership), or when its inventory is signed or completed. Never expands
    to other rows."""
    code = entry_block_code(entry)
    if code:
        raise InventoryGuardError(code)


# ── facility guards (signed inventories keep the facility they were calculated with) ─────────────
def _answers_name_facility(report, name):
    key = (name or '').strip().lower()
    if not key:
        return False
    from .models import ReportStep
    for step_id, stored in ReportStep.objects.filter(
            report=report, step_id__in=('2A-2', 'K3C8-1')).values_list('step_id', 'answer'):
        answer = stored.get('answer', stored) if isinstance(stored, dict) else None
        if not isinstance(answer, dict):
            continue
        if step_id == '2A-2':
            if any(isinstance(r, dict) and str(r.get('name') or '').strip().lower() == key for r in answer.values()):
                return True
        else:
            items = answer.get('items')
            if isinstance(items, list) and any(
                    isinstance(r, dict) and str(r.get('facility') or '').strip().lower() == key for r in items):
                return True
    return False


def _entries_reference_facility(report, facility_pk):
    """Entries that point at the facility and sit in this inventory, or (protective, rejection only) are
    unassigned in its reporting year."""
    from emissions.models import EmissionEntry
    cond = Q(inventory_id=report.pk)
    if report.reporting_year is not None:
        cond |= Q(inventory__isnull=True, company_id=report.company_id, year=report.reporting_year)
    return EmissionEntry.objects.filter(facility_id=facility_pk).filter(cond).exists()


def signed_reports_referencing(facility_pk, name=None, answers=True):
    """Signed inventories of the facility's company that depend on it. Used only to refuse a change."""
    from companies.models import Facility
    from .models import CarbonReport
    row = Facility.objects.filter(pk=facility_pk).values('company_id', 'name').first()
    if row is None:
        return []
    name = row['name'] if name is None else name
    hits = []
    for report in CarbonReport.objects.filter(company_id=row['company_id'], signed_at__isnull=False):
        if _entries_reference_facility(report, facility_pk) or (answers and _answers_name_facility(report, name)):
            hits.append(report)
    return hits


def report_references_facility(report, facility_pk):
    from companies.models import Facility
    name = Facility.objects.filter(pk=facility_pk).values_list('name', flat=True).first()
    return _entries_reference_facility(report, facility_pk) or _answers_name_facility(report, name)


def assert_facility_deletable(facility):
    """Refused when an entry of a signed inventory (or of its signed year) points at the facility: deleting it
    would null that reference."""
    if any(_entries_reference_facility(r, facility.pk)
           for r in _signed_reports_of(facility.company_id)):
        raise InventoryGuardError('facility_locked_by_signed_inventory')


def _signed_reports_of(company_id):
    from .models import CarbonReport
    return list(CarbonReport.objects.filter(company_id=company_id, signed_at__isnull=False))


def assert_facility_renamable(facility):
    """Refused when a signed inventory references the facility (an entry, or its own answers by name):
    signed answers are never rewritten, so the rename is not allowed."""
    if signed_reports_referencing(facility.pk):
        raise InventoryGuardError('facility_locked_by_signed_inventory')


def assert_facility_country_change_allowed(facility):
    """A signed inventory takes a facility's country from its own 2A-2 answer. When it references the
    facility but does not state a country for it, a change of the facility's country is refused."""
    from .step_entries import _stated_facilities
    key = (facility.name or '').strip().lower()
    for report in signed_reports_referencing(facility.pk):
        stated = _stated_facilities(report).get(key)
        if not stated or not stated.get('country'):
            raise InventoryGuardError('facility_locked_by_signed_inventory', report_id=report.pk)


# ── first signing ────────────────────────────────────────────────────────────────────────────────
def snapshot_applied_connections(report):
    """At the first signing: record the grid connection of every company facility in the inventory, adding a
    key only where none exists (an existing key is never overwritten). Missing keys of older inventories are
    never reconstructed here."""
    from companies.models import Facility
    from .models import CarbonReport
    with transaction.atomic():
        locked = CarbonReport.objects.select_for_update().filter(pk=report.pk).first()
        if locked is None:
            return
        applied = dict(locked.applied_grid_connections or {})
        added = False
        for pk, connection in Facility.objects.filter(company_id=locked.company_id).values_list('pk', 'grid_connection'):
            if str(pk) not in applied:
                applied[str(pk)] = connection or ''
                added = True
        if added:
            CarbonReport.objects.filter(pk=locked.pk).update(applied_grid_connections=applied)
