"""Which records belong to which inventory (multi-inventory data isolation).

This module only SELECTS records. It contains no calculation: every amount, factor, unit and rounding rule
stays where it was (emissions/calculator.py and friends). What changes is the data handed to them: the
records of ONE inventory instead of "everything of the company in that year".

The ownership rule
------------------
A record (EmissionEntry, CustomEmissionRequest) belongs to the inventory named by its `inventory` column.
A record with `inventory IS NULL` was written before inventories owned their records, or by a path that was
not told which inventory it is for (company-level). It is read as part of inventory X only when that is
unambiguous:

* X is the only inventory of its company and reporting year, or
* X is a member of a legacy duplicate group (`legacy_duplicate_year`): the group always shared those rows
  and nothing is hidden from it.

A NULL row is never copied, never moved to the "newest" inventory, and never read by two inventories of a
year that has several (except a legacy duplicate group, as before). When a second inventory is added to a
year, `claim_unassigned_rows` first tags the sole inventory's NULL rows with its id, so it keeps them.
Rows that belong to no inventory (a year with several inventories) are reported by `unassigned_rows`.
"""
from django.db.models import Q, Sum


def _sibling_count(inventory):
    from questionnaire.models import CarbonReport
    if inventory.reporting_year is None:
        return 1
    return CarbonReport.objects.filter(
        company_id=inventory.company_id, reporting_year=inventory.reporting_year).count()


def reads_unassigned_rows(inventory):
    """Whether `inventory` also reads the rows of its company and year that carry no inventory."""
    if inventory.reporting_year is None:
        return False
    return bool(inventory.legacy_duplicate_year) or _sibling_count(inventory) == 1


def scope_q(inventory):
    """Q selecting the records of `inventory` (for a model with company, year and inventory columns)."""
    q = Q(inventory_id=inventory.pk)
    if reads_unassigned_rows(inventory):
        q |= Q(inventory__isnull=True, company_id=inventory.company_id, year=inventory.reporting_year)
    return q


def entries_of(inventory):
    """All EmissionEntry rows (any status) of the inventory. An unsaved/None inventory owns nothing."""
    from .models import EmissionEntry
    if inventory is None or inventory.pk is None:
        return EmissionEntry.objects.none()
    return EmissionEntry.objects.filter(company_id=inventory.company_id).filter(scope_q(inventory))


def customs_of(inventory):
    """All CustomEmissionRequest rows of the inventory."""
    from .models import CustomEmissionRequest
    if inventory is None or inventory.pk is None:
        return CustomEmissionRequest.objects.none()
    return CustomEmissionRequest.objects.filter(company_id=inventory.company_id).filter(scope_q(inventory))


def sole_inventory_for(company, year):
    """The inventory of `company` and `year` when there is exactly one, else None."""
    from questionnaire.models import CarbonReport
    if company is None or year is None:
        return None
    found = list(CarbonReport.objects.filter(company=company, reporting_year=year)[:2])
    return found[0] if len(found) == 1 else None


def inventories_for(company, year):
    from questionnaire.models import CarbonReport
    if company is None or year is None:
        return CarbonReport.objects.none()
    return CarbonReport.objects.filter(company=company, reporting_year=year)


def claim_unassigned_rows(company_id, year):
    """If exactly one inventory covers (company, year), tag the unassigned rows of that year with its id.

    Called inside the transaction that adds a second inventory to the year, BEFORE the second one is
    created, so the first keeps the rows it has always been reading. Idempotent; touches only rows whose
    inventory is NULL and changes nothing but that column. Members of a legacy duplicate group are skipped
    (their rows are shared and stay unassigned). Returns the number of rows tagged."""
    from questionnaire.models import CarbonReport
    from .models import CustomEmissionRequest, EmissionEntry
    if company_id is None or year is None:
        return 0
    found = list(CarbonReport.objects.filter(company_id=company_id, reporting_year=year)[:2])
    if len(found) != 1 or found[0].legacy_duplicate_year:
        return 0
    pk = found[0].pk
    n = EmissionEntry.objects.filter(company_id=company_id, year=year, inventory__isnull=True).update(inventory_id=pk)
    n += CustomEmissionRequest.objects.filter(company_id=company_id, year=year, inventory__isnull=True).update(
        inventory_id=pk)
    return n


def unassigned_rows(inventory):
    """{'entries': n, 'total_kg': kg} of the company-and-year rows that belong to NO inventory and that
    `inventory` does not read, so they are reported instead of silently dropped from every inventory."""
    from .models import EmissionEntry
    if inventory is None or inventory.reporting_year is None or reads_unassigned_rows(inventory):
        return {'entries': 0, 'total_kg': 0.0}
    qs = EmissionEntry.objects.filter(company_id=inventory.company_id, year=inventory.reporting_year,
                                      inventory__isnull=True, status='approved')
    return {'entries': qs.count(), 'total_kg': float(qs.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)}


class InventoryRequired(Exception):
    """Several inventories cover the year and none was named: the records of a year would be mixed."""

    def __init__(self, candidates):
        super().__init__('inventory_required')
        self.candidates = candidates

    def payload(self):
        en = 'Several inventories exist for this year. Choose one (inventory_id).'
        tr = 'Bu yıl için birden fazla envanter var. Birini seçin (inventory_id).'
        return {'error': en, 'code': 'inventory_required', 'message_en': en, 'message_tr': tr,
                'candidates': self.candidates}


def resolve_scope(company, year, raw_inventory_id=None):
    """(inventory or None, year) for an endpoint that takes `?inventory_id=` and/or `?year=`.

    * inventory_id given: checked against the caller's company (InventorySelectionError otherwise); the year
      is the inventory's own;
    * not given, the year has exactly one inventory: that one (so existing clients see what they always saw);
    * not given, the year has none: (None, year), the caller keeps the company-and-year reading;
    * not given, the year has several: InventoryRequired, never a mix of them."""
    from .inventory_link import resolve_inventory
    if raw_inventory_id not in (None, ''):
        inventory = resolve_inventory(company, raw_inventory_id)
        return inventory, (inventory.reporting_year if inventory.reporting_year is not None else year)
    if company is None:
        return None, year
    found = list(inventories_for(company, year).order_by('-updated_at')[:6]) if year is not None else []
    if len(found) == 1:
        return found[0], year
    if len(found) > 1:
        raise InventoryRequired([{'report_id': r.pk, 'title': r.title} for r in found])
    return None, year
