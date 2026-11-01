"""A facility's grid connection decides the Turkish electricity factor, and it
is one value per facility. Whatever changes it (Settings, an approver's Q24,
the admin, a script), the signed / completed inventories must keep the
connection they were calculated with.

* A COMPLETED (unsigned) inventory records the connection in force just before the
  change (a protective snapshot: it changes no value).
* A SIGNED inventory is never written to. When it depends on the facility and has
  no recorded connection for it, the change is refused (`InventoryGuardError`); a
  missing snapshot is never reconstructed here.

Also here: `pre_save` backstops for signed data. They cover `.save()` and create only —
`QuerySet.update/delete`, `bulk_*` and raw SQL do not fire signals, so every application
write path also checks explicitly (see immutability.py). They are a second line, not the first.
"""
from django.db.models import Q
from django.db.models.signals import pre_save
from django.dispatch import receiver


def freeze_applied_connection(company_id, facility_pk, connection):
    """Record `connection` as the one applied to `facility_pk` in every COMPLETED (unsigned) inventory of the
    company that has no applied value for it yet. For a SIGNED inventory nothing is written: when it depends on
    the facility and has no recorded value, the change is refused."""
    from django.db import transaction
    from .immutability import InventoryGuardError, report_references_facility
    from .models import CarbonReport
    with transaction.atomic():   # lock the rows: a concurrent save must not overwrite what is recorded here
        locked = CarbonReport.objects.select_for_update().filter(company_id=company_id).filter(
            Q(signed_at__isnull=False) | Q(status=CarbonReport.Status.COMPLETED))
        for report in locked:
            applied = dict(report.applied_grid_connections or {})
            if str(facility_pk) in applied:
                continue
            if report.signed_at:
                if report_references_facility(report, facility_pk):
                    # Raised inside the transaction: nothing recorded earlier in this loop survives either.
                    raise InventoryGuardError('facility_locked_by_signed_inventory', report_id=report.pk)
                continue
            applied[str(facility_pk)] = connection or ''
            # update(): no updated_at bump, no signature fields touched
            CarbonReport.objects.filter(pk=report.pk).update(applied_grid_connections=applied)


@receiver(pre_save, sender='companies.Facility')
def freeze_before_connection_change(sender, instance, raw=False, **kwargs):
    if raw or not instance.pk:
        return
    old = sender.objects.filter(pk=instance.pk).values('name', 'country', 'grid_connection', 'company_id').first()
    if old is None:
        return
    from .immutability import (assert_facility_country_change_allowed, assert_facility_renamable)
    if old['name'] != instance.name:
        assert_facility_renamable(sender(pk=instance.pk, company_id=old['company_id'], name=old['name']))
    if old['country'] != instance.country:
        assert_facility_country_change_allowed(sender(pk=instance.pk, company_id=old['company_id'], name=old['name']))
    if old['grid_connection'] is not None and old['grid_connection'] != instance.grid_connection:
        freeze_applied_connection(instance.company_id, instance.pk, old['grid_connection'])


# ── backstops for signed data (.save() / create only) ────────────────────────────────────────────
@receiver(pre_save, sender='emissions.EmissionEntry')
def guard_entry_save(sender, instance, raw=False, **kwargs):
    """No save of an entry that sits in a signed inventory, or (protective) in a signed year without an
    inventory of its own. Never assigns anything."""
    if raw:
        return
    from .immutability import InventoryGuardError, signed_period_exists
    from .models import CarbonReport
    if instance.inventory_id:
        if CarbonReport.objects.filter(pk=instance.inventory_id, signed_at__isnull=False).exists():
            raise InventoryGuardError('inventory_signed')
    elif signed_period_exists(instance.company_id, instance.year):
        raise InventoryGuardError('inventory_signed')


@receiver(pre_save, sender='questionnaire.ReportStep')
@receiver(pre_save, sender='questionnaire.ReportField')
def guard_report_child_save(sender, instance, raw=False, **kwargs):
    if raw:
        return
    from .immutability import InventoryGuardError
    from .models import CarbonReport
    if instance.report_id and CarbonReport.objects.filter(pk=instance.report_id, signed_at__isnull=False).exists():
        raise InventoryGuardError('inventory_signed')


@receiver(pre_save, sender='questionnaire.CarbonReport')
def guard_report_save(sender, instance, raw=False, **kwargs):
    if raw or not instance.pk:
        return
    from .immutability import InventoryGuardError
    if sender.objects.filter(pk=instance.pk, signed_at__isnull=False).exists():
        raise InventoryGuardError('inventory_signed')
