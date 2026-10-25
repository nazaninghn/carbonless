"""Apply the DR-19 v2 PROTOTYPE to a fresh ISOLATED COPY of the backend (never to the repository)."""
import os
import shutil

SP = r'C:\Users\UP\AppData\Local\Temp\claude\D--ACADEMIA-PROJECTS-CARBONLESS\b954cafe-f9a3-4334-be50-4ecff1db1b77\scratchpad'
ROOT = os.path.join(SP, 's6_proto2', 'carbonless_backend')
SRC = os.path.join(SP, 'dr19v2')
assert 's6_proto2' in ROOT


def rw(rel, fn):
    p = os.path.join(ROOT, rel)
    s = open(p, encoding='utf-8', newline='').read()
    crlf = '\r\n' in s
    t = fn(s.replace('\r\n', '\n'))
    open(p, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if crlf else t)


def once(t, old, new):
    assert t.count(old) == 1, (t.count(old), old[:70])
    return t.replace(old, new)


# 1. schema ------------------------------------------------------------------------------------------------------
rw(r'questionnaire\models.py', lambda t: once(
    t, "    applied_grid_connections = models.JSONField(default=dict, blank=True, null=True)\n",
    "    applied_grid_connections = models.JSONField(default=dict, blank=True, null=True)\n"
    "    # DR-19: {\"pins\": {factor slug: EmissionFactor pk}, \"provenance\": {...}, \"frozen_at\": ...} a signed / completed inventory is\n"
    "    # calculated with (see applied_factors.py). Nullable for the same rolling-deploy reason as the column above.\n"
    "    applied_factors = models.JSONField(default=dict, blank=True, null=True)\n"))
open(os.path.join(ROOT, r'questionnaire\migrations\0013_report_applied_factors.py'), 'w', encoding='utf-8').write('''from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('questionnaire', '0012_one_inventory_per_year')]
    operations = [migrations.AddField(
        model_name='carbonreport', name='applied_factors',
        field=models.JSONField(blank=True, default=dict, null=True))]
''')

# 2. pick_factor honours / records the pins -------------------------------------------------------------------------
def lookup(t):
    t = once(t, "from decimal import Decimal, InvalidOperation\n", "import contextvars\nfrom decimal import Decimal, InvalidOperation\n")
    return once(t, "def pick_factor(slug, country=None, year=None):\n", '''class FactorPins:
    """The factor row per slug a signed / completed inventory is calculated with (CarbonReport.applied_factors)."""
    def __init__(self, mapping, provenance, basis):
        self.map = {str(k): int(v) for k, v in (mapping or {}).items()}
        self.provenance = dict(provenance or {})
        self.basis = basis
        self.added = {}          # slug -> how it was learned, for pins recorded in this context (persisted by a merge)


_FACTOR_PINS = contextvars.ContextVar('applied_factor_pins', default=None)
_PINS_MANAGED = contextvars.ContextVar('applied_factor_pins_managed', default=False)    # set inside recorded_connections


def pick_factor(slug, country=None, year=None):
    """A locked inventory resolves a slug to the row it was calculated with (even if that row was withdrawn since); a slug
    it has no record of resolves normally and is recorded. A draft (no pins) always gets the newest eligible row."""
    pins = _FACTOR_PINS.get()
    if pins is None:
        return _pick_latest(slug, country, year)
    pinned = pins.map.get(slug)
    if pinned is not None:
        row = EmissionFactor.objects.filter(pk=pinned).first()
        if row is not None:
            return row
    row = _pick_latest(slug, country, year)
    if row is not None:
        pins.map[slug], pins.added[slug] = row.pk, pins.basis
    return row


def _pick_latest(slug, country=None, year=None):
''')
rw(r'emissions\factor_lookup.py', lookup)

# 3. factor rows: no in-place value edit through save / update / bulk_update; freeze before a change ---------------
def emodels(t):
    t = once(t, "class EmissionFactor(models.Model):\n", '''_FACTOR_USED = 'This factor is used by recorded entries; add a new factor row instead of editing its value.'


def _freeze_slugs(slugs):
    from questionnaire.applied_factors import freeze_slug
    for slug in set(slugs):
        freeze_slug(slug)


class FactorQuerySet(models.QuerySet):
    """update() and bulk_update() skip save() and its signals, so they carry the same two controls."""
    def update(self, **kwargs):
        if 'factor_kg_co2e' in kwargs:
            changing = self.exclude(factor_kg_co2e=kwargs['factor_kg_co2e'])
            if EmissionEntry.objects.filter(emission_factor__in=changing.values('pk')).exists():
                raise ValidationError(_FACTOR_USED)
        if {'factor_kg_co2e', 'is_active', 'is_default'} & set(kwargs):
            _freeze_slugs(self.values_list('slug', flat=True))
        return super().update(**kwargs)

    def bulk_update(self, objs, fields, batch_size=None):
        objs = list(objs)
        if 'factor_kg_co2e' in fields:
            for o in objs:
                old = type(o).objects.filter(pk=o.pk).values_list('factor_kg_co2e', flat=True).first()
                if (old is not None and Decimal(str(old)) != Decimal(str(o.factor_kg_co2e))
                        and EmissionEntry.objects.filter(emission_factor_id=o.pk).exists()):
                    raise ValidationError(_FACTOR_USED)
        if {'factor_kg_co2e', 'is_active', 'is_default'} & set(fields):
            _freeze_slugs(o.slug for o in objs)
        return super().bulk_update(objs, fields, batch_size)


class EmissionFactor(models.Model):
''')
    t = once(t, "    name = models.CharField(max_length=255)\n    name_tr = models.CharField(max_length=255, blank=True)\n    slug = models.CharField(max_length=100, default=''",
            "    objects = FactorQuerySet.as_manager()\n\n    name = models.CharField(max_length=255)\n    name_tr = models.CharField(max_length=255, blank=True)\n    slug = models.CharField(max_length=100, default=''")
    return once(t, "    GAS_SPLIT_TOLERANCE = Decimal('0.01')\n",
                "    GAS_SPLIT_TOLERANCE = Decimal('0.01')\n\n"
                "    def save(self, *args, **kwargs):\n"
                "        # A factor row that an entry points at records how that entry was priced: its value is not edited in\n"
                "        # place. A correction is a new row (new year / is_default), never an overwrite.\n"
                "        if self.pk:\n"
                "            old = type(self).objects.filter(pk=self.pk).values_list('factor_kg_co2e', flat=True).first()\n"
                "            if old is not None and Decimal(str(old)) != Decimal(str(self.factor_kg_co2e)) \\\n"
                "                    and EmissionEntry.objects.filter(emission_factor_id=self.pk).exists():\n"
                "                raise ValidationError(_FACTOR_USED)\n"
                "        super().save(*args, **kwargs)\n")
rw(r'emissions\models.py', emodels)

# 4. recorded_connections also pins the factors ---------------------------------------------------------------------
def step(t):
    t = once(t, "def recorded_connections(report):\n", "def recorded_connections(report, basis='first_use_unverified', persist=True, protect=True):\n")
    t = once(t, "    applied, countries = None, {}\n    if report is not None and getattr(report, 'pk', None):\n",
             "    applied, countries, pins = None, {}, None\n    if report is not None and getattr(report, 'pk', None):\n")
    t = once(t, "            countries = _stated_facilities(report)\n    token = _APPLIED_CONNECTIONS.set(applied)\n    country_token = _APPLIED_COUNTRIES.set(countries)\n    try:\n        yield\n    finally:\n",
             "            countries = _stated_facilities(report)\n            if protect:\n                from .applied_factors import load_pins\n                pins = load_pins(report, basis)\n"
             "    token = _APPLIED_CONNECTIONS.set(applied)\n    country_token = _APPLIED_COUNTRIES.set(countries)\n"
             "    from emissions.factor_lookup import _FACTOR_PINS, _PINS_MANAGED\n    pin_token = _FACTOR_PINS.set(pins)\n    managed_token = _PINS_MANAGED.set(True)\n    try:\n        yield\n    finally:\n"
             "        _PINS_MANAGED.reset(managed_token)\n        _FACTOR_PINS.reset(pin_token)\n        if pins is not None and persist and pins.added:\n"
             "            from .applied_factors import persist_pins\n            persist_pins(report, pins)\n")
    return t
rw(r'questionnaire\step_entries.py', step)

# 5. the Workspace sync is a rebuild path too -----------------------------------------------------------------------
def ws(t):
    t = once(t, "    before = _workspace_entry_figures(report)\n    _write_workspace_entries(report, user)\n",
             "    before = _workspace_entry_figures(report)\n    from .step_entries import recorded_connections\n    with recorded_connections(report):\n        _write_workspace_entries(report, user)\n")
    return t
rw(r'questionnaire\workspace_views.py', ws)

# 6. every path that locks an inventory ------------------------------------------------------------------------------
def views(t):
    t = once(t, "        report.signed_at, report.edited_after_signing_at = now, None\n",
             "        report.signed_at, report.edited_after_signing_at = now, None\n"
             "        from .applied_factors import freeze_applied_factors\n        freeze_applied_factors(report)\n")
    t = once(t, "        CarbonReport.objects.filter(\n            company=company,\n            status__in=[CarbonReport.Status.DRAFT, CarbonReport.Status.IN_PROGRESS],\n        ).update(status=CarbonReport.Status.COMPLETED)\n",
             "        closing = list(CarbonReport.objects.filter(\n            company=company,\n            status__in=[CarbonReport.Status.DRAFT, CarbonReport.Status.IN_PROGRESS]).values_list('pk', flat=True))\n"
             "        CarbonReport.objects.filter(pk__in=closing).update(status=CarbonReport.Status.COMPLETED)\n"
             "        from .applied_factors import freeze_applied_factors\n"
             "        for closed in CarbonReport.objects.filter(pk__in=closing):\n            freeze_applied_factors(closed)\n")
    return t
rw(r'questionnaire\views.py', views)


def signals(t):
    t = once(t, "from django.db.models.signals import pre_save\n", "from django.db.models.signals import post_save, pre_save\n")
    return t + '''

@receiver(pre_save, sender='emissions.EmissionFactor')
def freeze_before_factor_change(sender, instance, raw=False, **kwargs):
    """A factor row is about to be created or changed: locked inventories that hold an entry on its slug keep the row they hold."""
    if raw:
        return
    from decimal import Decimal
    if instance.pk:
        old = sender.objects.filter(pk=instance.pk).values('factor_kg_co2e', 'is_active', 'is_default').first()
        if old and (Decimal(str(old['factor_kg_co2e'])) == Decimal(str(instance.factor_kg_co2e))
                    and old['is_active'] == instance.is_active and old['is_default'] == instance.is_default):
            return
    from .applied_factors import freeze_slug
    freeze_slug(instance.slug)


@receiver(post_save, sender='questionnaire.CarbonReport')
def freeze_when_locked(sender, instance, raw=False, **kwargs):
    """Whatever saves an inventory as signed / completed (the final question, the admin, a script) freezes its factor map."""
    if raw:
        return
    from .step_entries import report_is_locked
    if report_is_locked(instance):
        from .applied_factors import freeze_applied_factors, normalise
        if not normalise(instance.applied_factors)['frozen_at']:
            freeze_applied_factors(instance)
'''
rw(r'questionnaire\signals.py', signals)

# 7. new files -------------------------------------------------------------------------------------------------------
shutil.copy(os.path.join(SRC, 'applied_factors.py'), os.path.join(ROOT, r'questionnaire\applied_factors.py'))
cmd = os.path.join(ROOT, r'questionnaire\management\commands')
shutil.copy(os.path.join(SRC, 'report_factor_provenance.py'), os.path.join(cmd, 'report_factor_provenance.py'))
shutil.copy(os.path.join(SRC, 'freeze_applied_factors_cmd.py'), os.path.join(cmd, 'freeze_applied_factors.py'))
print('patched v2')
