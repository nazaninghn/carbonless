"""Hardening stage: every write path, the hold, and a fail-safe freeze signal. Applied after patch.py on the same ISOLATED copy."""
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


# 1. the shared factor lookup (chat, dashboard previews, duplicate checks) follows a locked inventory --------------------
def lookup(t):
    return once(t, "def resolve_factor_and_amount(activity_type, quantity, unit, company=None, facility=None, year=None):\n",
                '''def resolve_factor_and_amount(activity_type, quantity, unit, company=None, facility=None, year=None):
    """The shared lookup. For a company and year that have a signed / completed inventory it resolves with the factor rows that
    inventory was calculated with (DR-19), whichever route calls it: chat, dashboard, previews, duplicate checks."""
    from questionnaire.applied_factors import locked_inventory_pins
    with locked_inventory_pins(company, year):
        return _resolve_factor_and_amount(activity_type, quantity, unit, company, facility, year)


def _resolve_factor_and_amount(activity_type, quantity, unit, company=None, facility=None, year=None):
''')
rw(r'emissions\factor_lookup.py', lookup)


# 2. EmissionEntry: new entry / changed factor in a locked inventory follows the pin; update() and bulk_create() too -----
def emodels(t):
    t = once(t, "class EmissionEntry(models.Model):\n", '''class EntryQuerySet(models.QuerySet):
    """update() and bulk_create() skip save(), so they follow the same rule as save()."""
    def update(self, **kwargs):
        if {'emission_factor', 'emission_factor_id'} & set(kwargs):
            from questionnaire.applied_factors import locked_year_has_entries
            if locked_year_has_entries(self):
                raise ValidationError('An entry of a signed or completed inventory keeps its recorded factor; use the explicit re-pricing action.')
        return super().update(**kwargs)

    def bulk_create(self, objs, *args, **kwargs):
        from questionnaire.applied_factors import entry_pin_guard
        objs = list(objs)
        for o in objs:
            entry_pin_guard(o)
        return super().bulk_create(objs, *args, **kwargs)


class EmissionEntry(models.Model):
''')
    t = once(t, "    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='emission_entries')\n",
             "    objects = EntryQuerySet.as_manager()\n\n    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='emission_entries')\n")
    return once(t, "        self.calculated_co2e_kg = self.quantity * self.emission_factor.factor_kg_co2e\n",
                "        from questionnaire.applied_factors import entry_pin_guard\n        entry_pin_guard(self)         # DR-19: a locked inventory keeps its recorded factor rows\n"
                "        self.calculated_co2e_kg = self.quantity * self.emission_factor.factor_kg_co2e\n")
rw(r'emissions\models.py', emodels)


# 3. hold: an inventory that cannot be proven is never rebuilt automatically ------------------------------------------------
def step(t):
    return once(t, "    others = other_inventories_for_year(report.company_id, year, exclude_pk=report.pk)\n    if others:\n        raise InventoryYearConflict(others, year)\n    with recorded_connections(report):\n        return _sync_step_entries(",
                "    from .applied_factors import is_held, log_hold_skip\n    if is_held(report):\n        log_hold_skip(user, report, 'questionnaire')\n        return []          # held: answers are saved by the caller, entries are not touched\n"
                "    others = other_inventories_for_year(report.company_id, year, exclude_pk=report.pk)\n    if others:\n        raise InventoryYearConflict(others, year)\n    with recorded_connections(report):\n        return _sync_step_entries(")
rw(r'questionnaire\step_entries.py', step)


def ws(t):
    return once(t, "    others = other_inventories_for_year(report.company_id, year, exclude_pk=report.pk)\n    if others:\n        log_blocked(user, report.company_id, others, year, 'save Workspace figures')\n        return 'inventory_exists_for_year'\n",
                "    others = other_inventories_for_year(report.company_id, year, exclude_pk=report.pk)\n    if others:\n        log_blocked(user, report.company_id, others, year, 'save Workspace figures')\n        return 'inventory_exists_for_year'\n"
                "    from .applied_factors import is_held, log_hold_skip\n    if is_held(report):\n        log_hold_skip(user, report, 'workspace')\n        return 'inventory_on_hold'\n")
rw(r'questionnaire\workspace_views.py', ws)


# 4. a failure while freezing must never break saving the inventory ---------------------------------------------------------
def sig(t):
    t = once(t, "        if not normalise(instance.applied_factors)['frozen_at']:\n            freeze_applied_factors(instance)\n",
             "        if not normalise(instance.applied_factors)['frozen_at']:\n"
             "            try:\n                freeze_applied_factors(instance)\n"
             "            except Exception:      # the lazy freeze (from the inventory's own entries) still protects it; never block the save\n"
             "                import logging\n                logging.getLogger(__name__).exception('could not freeze the factor map of report %s', instance.pk)\n")
    return t
rw(r'questionnaire\signals.py', sig)

# 4b. the deploy-time backfill (build.sh runs it on every deploy) must not write pins of its own
def backfill(t):
    return once(t, "            with recorded_connections(report):\n                groups = activities_for_report(answers, year, company)\n",
                "            with recorded_connections(report, persist=False):      # DR-19: a deploy job never records pins\n                groups = activities_for_report(answers, year, company)\n")
rw(r'questionnaire\management\commands\backfill_calc_detail.py', backfill)

# 5. reprice refuses a held inventory
def af(t):
    return once(t, "        if not report_is_locked(row):\n            raise ValueError('Only a signed",
                "        if normalise(row.applied_factors).get('hold'):\n            raise ValueError('This inventory is on hold (its provenance cannot be proven); release the hold first.')\n        if not report_is_locked(row):\n            raise ValueError('Only a signed")

# 6. files
shutil.copy(os.path.join(SRC, 'applied_factors.py'), os.path.join(ROOT, r'questionnaire\applied_factors.py'))
rw(r'questionnaire\applied_factors.py', af)
cmd = os.path.join(ROOT, r'questionnaire\management\commands')
shutil.copy(os.path.join(SRC, 'report_factor_provenance.py'), os.path.join(cmd, 'report_factor_provenance.py'))
shutil.copy(os.path.join(SRC, 'freeze_applied_factors_cmd.py'), os.path.join(cmd, 'freeze_applied_factors.py'))
shutil.copy(os.path.join(SRC, 'release_inventory_hold.py'), os.path.join(cmd, 'release_inventory_hold.py'))
print('patch2 applied')
