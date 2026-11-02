"""Multi-inventory, stage 1: which inventory a NEW record is tagged with.

A new record is tagged only with an inventory that the caller named explicitly
(`inventory_id`) and that the server then checked: it exists, it belongs to the
caller's current company, and (where the record is a calculated entry or has a
reporting year) it fits. Nothing is guessed from company and year, and nothing
that already exists is ever changed here. No explicit inventory means NULL: the
record stays company-level, exactly as before.

`inventory` is never a serializer field a client can set; views read the id with
`explicit_inventory_id` and pass the checked report on with `serializer.save()`.
"""
from rest_framework.exceptions import ValidationError

KEY = 'inventory_id'

_MESSAGES = {
    'inventory_invalid': (
        'inventory_id must be a whole number.',
        'inventory_id bir tam sayı olmalıdır.'),
    # One message for "does not exist" and "belongs to another company": the
    # answer must not reveal that someone else's inventory exists.
    'inventory_not_found': (
        'Inventory not found for your company.',
        'Envanter şirketinizde bulunamadı.'),
    'inventory_year_mismatch': (
        'The inventory covers a different reporting year than this record.',
        'Envanter bu kaydın yılından farklı bir raporlama yılını kapsıyor.'),
    'inventory_locked': (
        'This inventory is signed/completed, so new records cannot be added to it.',
        'Bu envanter imzalı/tamamlanmış; yeni kayıt eklenemez.'),
}


class InventorySelectionError(Exception):
    """The named inventory cannot take this record. Carries a bilingual message."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code
        self.en, self.tr = _MESSAGES[code]

    def payload(self):
        return {'error': self.en, 'code': self.code, 'message_en': self.en, 'message_tr': self.tr,
                'error_en': self.en, 'error_tr': self.tr, KEY: [self.en]}

    def as_validation_error(self):
        return ValidationError({KEY: [self.en], 'code': self.code, 'message_en': self.en, 'message_tr': self.tr})


def explicit_inventory_id(data):
    """The raw `inventory_id` from a request body/dict, or None when the caller named none
    ('' and null mean none)."""
    try:
        raw = data.get(KEY)
    except AttributeError:
        return None
    return None if raw is None or (isinstance(raw, str) and not raw.strip()) else raw


def resolve_inventory(company, raw, year=None, forbid_locked=False):
    """The CarbonReport named by `raw`, checked against `company` — or None when `raw` is None.

    Raises InventorySelectionError when: the id is not an integer; no such inventory exists in
    `company` (or there is no company); `year` is given and differs from the inventory's reporting
    year; or `forbid_locked` and the inventory is signed/completed."""
    if raw is None:
        return None
    if isinstance(raw, bool):
        raise InventorySelectionError('inventory_invalid')
    try:
        pk = int(str(raw).strip())
    except (TypeError, ValueError):
        raise InventorySelectionError('inventory_invalid')
    if company is None:
        raise InventorySelectionError('inventory_not_found')
    from questionnaire.models import CarbonReport
    report = CarbonReport.objects.filter(pk=pk, company_id=company.pk).first()
    if report is None:
        raise InventorySelectionError('inventory_not_found')
    if year is not None and report.reporting_year != _as_int(year):
        raise InventorySelectionError('inventory_year_mismatch')
    if forbid_locked:
        from questionnaire.year_guard import _is_locked
        if _is_locked(report):
            raise InventorySelectionError('inventory_locked')
    return report


def _as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def inventory_for_request(request, company, year=None, forbid_locked=False):
    """resolve_inventory() for a DRF request; a refusal becomes a 400 ValidationError."""
    try:
        return resolve_inventory(company, explicit_inventory_id(request.data), year, forbid_locked)
    except InventorySelectionError as exc:
        raise exc.as_validation_error()
