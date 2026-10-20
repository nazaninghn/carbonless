"""A facility's grid connection decides the Turkish electricity factor, and it
is one value per facility. Whatever changes it (Settings, an approver's Q24,
the admin, a script), the signed / completed inventories must keep the
connection they were calculated with — so it is recorded in each of them just
before the change."""
from django.db.models import Q
from django.db.models.signals import pre_save
from django.dispatch import receiver


def freeze_applied_connection(company_id, facility_pk, connection):
    """Record `connection` as the one applied to `facility_pk` in every signed /
    completed inventory of the company that has no applied value for it yet."""
    from django.db import transaction
    from .models import CarbonReport
    with transaction.atomic():   # lock the rows: a concurrent save must not overwrite what is recorded here
        locked = CarbonReport.objects.select_for_update().filter(company_id=company_id).filter(
            Q(signed_at__isnull=False) | Q(status=CarbonReport.Status.COMPLETED))
        for report in locked:
            applied = dict(report.applied_grid_connections or {})
            if str(facility_pk) not in applied:
                applied[str(facility_pk)] = connection or ''
                # update(): no updated_at bump, no signature fields touched
                CarbonReport.objects.filter(pk=report.pk).update(applied_grid_connections=applied)


@receiver(pre_save, sender='companies.Facility')
def freeze_before_connection_change(sender, instance, raw=False, **kwargs):
    if raw or not instance.pk:
        return
    old = sender.objects.filter(pk=instance.pk).values_list('grid_connection', flat=True).first()
    if old is not None and old != instance.grid_connection:
        freeze_applied_connection(instance.company_id, instance.pk, old)
