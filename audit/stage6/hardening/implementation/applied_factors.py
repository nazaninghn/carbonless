"""DR-19: a signed / completed inventory keeps the factor rows it was calculated with.

`CarbonReport.applied_factors` = {"pins": {factor slug: EmissionFactor pk}, "provenance": {slug: how the pin was learned},
"frozen_at": ISO time}. While a locked inventory is calculated or reported (`recorded_connections`), `pick_factor`
resolves a slug to its pin, so a factor row added, withdrawn or re-defaulted later cannot move the inventory.
The only way to move it is `reprice_inventory` (explicit, reasoned, audited; the previous approved result is kept).

Provenance says how much a pin proves:
  entry / entry_value_drift  an approved entry of the inventory references the row: proven by the record itself
                             (drift: the row's value no longer equals the entry's value snapshot: someone edited it)
  factor_change              recorded just before a factor row was created / changed (same idea as freeze_applied_connection)
  lock                       resolved while the inventory was being locked
  deploy_time                a legacy inventory frozen at deployment: today's row, NOT proven to be the one used at signing
  first_use_unverified       first resolved after locking, with no record of what it used before: NOT proven
  repriced                   moved by reprice_inventory (see the history row)
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)

ENTRY, ENTRY_DRIFT, LOCK, FACTOR_CHANGE = 'entry', 'entry_value_drift', 'lock', 'factor_change'
DEPLOY, FIRST_USE, REPRICED = 'deploy_time', 'first_use_unverified', 'repriced'
UNPROVEN = frozenset({DEPLOY, FIRST_USE})


def locked_q():
    from .models import CarbonReport
    return Q(signed_at__isnull=False) | Q(status=CarbonReport.Status.COMPLETED)


def normalise(raw):
    raw = raw if isinstance(raw, dict) else {}
    out = {'pins': {str(k): int(v) for k, v in (raw.get('pins') or {}).items()},
           'provenance': {str(k): str(v) for k, v in (raw.get('provenance') or {}).items()},
           'frozen_at': raw.get('frozen_at')}
    if raw.get('hold'):
        out['hold'] = raw['hold']            # {'reason', 'since', 'by'}: automatic rebuilds of this inventory are refused
    return out


def stored(report):
    from .models import CarbonReport
    return normalise(CarbonReport.objects.filter(pk=report.pk).values_list('applied_factors', flat=True).first())


def _entries_of(report):
    """Every approved entry of the inventory (questionnaire, Workspace, dashboard, chat): all of them were priced with some row."""
    from emissions.models import EmissionEntry
    if not (report.company_id and report.reporting_year):
        return EmissionEntry.objects.none()
    return (EmissionEntry.objects.filter(company_id=report.company_id, year=report.reporting_year, status='approved')
            .select_related('emission_factor').order_by('pk'))


def entry_pins(report):
    """{slug: (factor pk, value_drift)} from the factor rows the inventory's own approved entries reference."""
    out = {}
    for e in _entries_of(report):
        f = e.emission_factor
        if f.slug.startswith('calculated-') or f.slug in out:
            continue
        drift = (e.factor_value_snapshot is not None
                 and Decimal(str(e.factor_value_snapshot)) != Decimal(str(f.factor_kg_co2e)))
        out[f.slug] = (f.pk, drift)
    return out


def load_pins(report, basis=FIRST_USE):
    from emissions.factor_lookup import FactorPins
    s = stored(report)
    pins = FactorPins(s['pins'], s['provenance'], basis)
    for slug, (pk, drift) in entry_pins(report).items():
        if slug not in pins.map:
            pins.map[slug], pins.added[slug] = pk, (ENTRY_DRIFT if drift else ENTRY)
    return pins


def _merge(report_pk, additions, frozen_at=None):
    """Add pins under a row lock; an existing pin is never overwritten (two writers cannot undo each other)."""
    from .models import CarbonReport
    with transaction.atomic():
        row = CarbonReport.objects.select_for_update().filter(pk=report_pk).first()
        if row is None:
            return None
        s = normalise(row.applied_factors)
        for slug, (pk, basis) in additions.items():
            if slug not in s['pins']:
                s['pins'][slug], s['provenance'][slug] = pk, basis
        if frozen_at and not s['frozen_at']:
            s['frozen_at'] = frozen_at
        CarbonReport.objects.filter(pk=report_pk).update(applied_factors=s)   # update(): no updated_at bump
        return s


def persist_pins(report, pins):
    if not pins.added:
        return
    s = _merge(report.pk, {slug: (pins.map[slug], basis) for slug, basis in pins.added.items()})
    pins.added.clear()
    if s is not None and hasattr(report, 'applied_factors'):
        report.applied_factors = s


def _resolve_all(report):
    """Run the inventory's own calculation once (read-only) so that every factor it resolves is recorded."""
    from .models import ReportStep
    from .step_entries import (ENTRY_STEPS, _entry_specs, _facility_lookup, _step_rows, _value, activities_for_report)
    company, year = report.company, report.reporting_year
    if not (company and year):
        return {}
    answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
    A = {k: _value(v) for k, v in answers.items()}
    groups = activities_for_report(answers, year, company)
    facility_of = _facility_lookup(company)
    return {step: _step_rows(step, _entry_specs(step, groups.get(step, []), A, year, company), facility_of)
            for step in ENTRY_STEPS}


def freeze_applied_factors(report, basis=LOCK, force=False):
    """Record the factor rows a signed / completed inventory is calculated with. Idempotent: an inventory that has a
    `frozen_at` is left alone. Call it where an inventory becomes locked (`basis=LOCK`), or at deployment for inventories
    that were locked before this existed (`basis=DEPLOY`, which is stored as unproven)."""
    from .models import CarbonReport
    from .step_entries import recorded_connections, report_is_locked
    fresh = CarbonReport.objects.filter(pk=report.pk).first()
    if fresh is None or not report_is_locked(fresh):
        return False
    if normalise(fresh.applied_factors)['frozen_at'] and not force:
        return False
    with recorded_connections(fresh, basis=basis):
        try:
            _resolve_all(fresh)
        except Exception:                     # a broken answer must not stop the entries being frozen
            logger.exception('could not resolve report %s while freezing its factors', fresh.pk)
    _merge(fresh.pk, {}, frozen_at=timezone.now().isoformat())
    if hasattr(report, 'applied_factors'):
        report.applied_factors = stored(fresh)
    return True


def freeze_slug(slug):
    """Just before a factor row of `slug` is created or changed: every locked inventory that holds an approved entry
    on that slug keeps the row it holds (the same pattern as freeze_applied_connection)."""
    from emissions.models import EmissionEntry
    from .models import CarbonReport
    if not CarbonReport.objects.filter(locked_q()).exists():
        return 0
    pairs = (EmissionEntry.objects.filter(emission_factor__slug=slug, status='approved')
             .values_list('company_id', 'year', 'emission_factor_id').distinct().order_by('company_id', 'year', 'emission_factor_id'))
    done, seen = 0, set()
    for company_id, year, factor_id in pairs:
        if (company_id, year) in seen:
            continue
        seen.add((company_id, year))
        for rid in CarbonReport.objects.filter(locked_q(), company_id=company_id, reporting_year=year).values_list('pk', flat=True):
            _merge(rid, {slug: (factor_id, FACTOR_CHANGE)})
            done += 1
    return done


def _lookup_countries(company):
    from .serializers import TURKEY_CODES
    hq = (getattr(company, 'country_of_headquarters', '') or '').strip().upper()
    return ('turkey', 'global') if hq in TURKEY_CODES else ('global', 'turkey')


def snapshot(report):
    """Every approved entry of the inventory: factor row, value, quantity and kg, with the total."""
    from emissions.models import EmissionEntry
    from .step_entries import entry_group
    rows = [{'entry': e.pk, 'step': entry_group(e.description) or e.description[:40], 'slug': e.emission_factor.slug,
             'factor_id': e.emission_factor_id, 'factor_kg_co2e': str(e.factor_value_snapshot),
             'quantity': str(e.quantity), 'kg': str(e.calculated_co2e_kg)}
            for e in EmissionEntry.objects.filter(company_id=report.company_id, year=report.reporting_year, status='approved')
            .select_related('emission_factor').order_by('pk')]
    return rows, round(sum(float(r['kg']) for r in rows), 6)


def reprice_inventory(report, user, reason, slugs=None):
    """The ONLY way a locked inventory moves to newer factor rows. Needs a reason; runs in one transaction (a failure
    leaves the map, the entries and the history untouched); keeps the previous approved result in the history row;
    flags a signed inventory as edited after signing when its total moved."""
    from emissions.audit import log_company_activity
    from emissions.factor_lookup import pick_factor
    from emissions.models import EmissionFactor
    from .models import CarbonReport
    from .step_entries import recorded_connections, report_is_locked, sync_step_entries
    if not (reason or '').strip():
        raise ValueError('A re-pricing needs a stated reason.')
    when = timezone.now()
    with transaction.atomic():
        row = CarbonReport.objects.select_for_update().get(pk=report.pk)
        if normalise(row.applied_factors).get('hold'):
            raise ValueError('This inventory is on hold (its provenance cannot be proven); release the hold first.')
        if not report_is_locked(row):
            raise ValueError('Only a signed / completed inventory is re-priced explicitly; a draft follows the newest factors.')
        company, year = row.company, row.reporting_year
        before_rows, before_total = snapshot(row)
        with recorded_connections(row):          # make sure the current pins exist (entries / first use)
            pass
        s = stored(row)
        previous = {'pins': dict(s['pins']), 'provenance': dict(s['provenance']), 'frozen_at': s['frozen_at']}
        targets = [x for x in (slugs or list(s['pins'])) if x in s['pins']]
        moved = {}
        for slug in targets:
            pinned = EmissionFactor.objects.filter(pk=s['pins'][slug]).first()
            current = None
            for c in _lookup_countries(company):
                current = pick_factor(slug, c, year)
                if current is not None:
                    break
            if current is not None and current.pk != s['pins'][slug]:
                moved[slug] = [s['pins'][slug], current.pk]
                s['pins'][slug], s['provenance'][slug] = current.pk, REPRICED
        CarbonReport.objects.filter(pk=row.pk).update(applied_factors=s)
        row.applied_factors = s
        sync_step_entries(user, company, row, '4A-1', as_status='approved')
        after_rows, after_total = snapshot(row)
        if row.signed_at and abs(after_total - before_total) > 1e-6:
            CarbonReport.objects.filter(pk=row.pk).update(edited_after_signing_at=when)
        actor = getattr(user, 'username', '') or ''
        log_company_activity(
            user, company.pk, 'inventory_repriced',
            f'{year} envanteri açıkça yeniden fiyatlandı ({actor}). Gerekçe: {reason}. Önceki onaylı toplam: {before_total} kg; yeni: {after_total} kg.',
            f'The {year} inventory was re-priced explicitly by {actor}. Reason: {reason}. Previous approved total: {before_total} kg; new: {after_total} kg.',
            target_type='CarbonReport', target_id=row.pk, reporting_year=year,
            reason=reason, actor_id=getattr(user, 'pk', None), actor=actor, at=when.isoformat(),
            previous_factor_map=previous, new_factor_map={'pins': dict(s['pins']), 'provenance': dict(s['provenance']), 'frozen_at': s['frozen_at']},
            moved=moved, before_total_kg=before_total, after_total_kg=after_total,
            before_entries=before_rows, after_entries=after_rows)
    report.applied_factors = s
    return {'moved': moved, 'before_total_kg': before_total, 'after_total_kg': after_total}


# ── read-only: which locked inventories could not be reconstructed ────────────────────────────────────────────────
def rebuild_preview(report, protect=True):
    """For each step: what a rebuild of this locked inventory would produce now, against the approved entries it has.
    Writes nothing. protect=False shows the exposure without the pins; protect=True with the pins the inventory's own
    entries provide (the rows that still differ are the ones whose original factor cannot be reconstructed)."""
    from .models import ReportStep
    from .step_entries import (ENTRY_STEPS, _entry_key, _entry_specs, _facility_lookup, _row_key, _step_entries, _step_rows,
                               _value, activities_for_report, recorded_connections)
    company, year = report.company, report.reporting_year
    answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
    A = {k: _value(v) for k, v in answers.items()}
    out = []
    with recorded_connections(report, persist=False, protect=protect):
        groups = activities_for_report(answers, year, company)
        facility_of = _facility_lookup(company)
        for step in ENTRY_STEPS:
            rows = _step_rows(step, _entry_specs(step, groups.get(step, []), A, year, company), facility_of)
            approved = [e for e in _step_entries(company, year, step) if e.status == 'approved']
            if not rows and not approved:
                continue
            same = sorted(_row_key(r) for r in rows) == sorted(_entry_key(e) for e in approved)
            out.append({'step': step, 'entries': len(approved), 'rows_now': len(rows), 'same': same,
                        'no_answer_behind_entries': bool(approved) and not rows,
                        'stored_kg': round(sum(float(e.calculated_co2e_kg) for e in approved), 4),
                        'now_kg': round(sum(float(r[1]) * float(r[0].factor_kg_co2e) for r in rows), 4),
                        'calculated': any(e.emission_factor.slug.startswith('calculated-') for e in approved)})
    return out


_UNDERLYING = None


def _underlying_of(entry):
    """(slug, value text) of the catalog factor a calculated entry says it was priced with ("… × 0,469 (turkey-grid-distribution)")."""
    import re
    from emissions.models import EmissionFactor
    text = ((entry.calc_detail or {}).get('en') or '') if isinstance(entry.calc_detail, dict) else ''
    for value, slug in re.findall(r'×\s*([\d.,]+)\s*\(([a-z0-9][a-z0-9-]*)\)', text):
        if EmissionFactor.objects.filter(slug=slug).exists():
            return slug, value
    return None, None


def provenance_report():
    """[(summary dict, [step dicts], [entry dicts])] for every signed / completed inventory. READ-ONLY.
    Entry classes: proven · record_inconsistent · unproven_reproducible_today · unprovable · answer_based ·
    no_answer_behind_entry. Nothing is rebuilt, repriced or written."""
    from emissions.models import EmissionEntry
    from .models import CarbonReport
    from .step_entries import entry_group
    out = []
    for report in CarbonReport.objects.filter(locked_q()).select_related('company').order_by('company_id', 'reporting_year', 'pk'):
        all_entries = list(EmissionEntry.objects.filter(
            company_id=report.company_id, year=report.reporting_year, status='approved').select_related('emission_factor').order_by('pk'))
        s = stored(report)
        drift = {e.pk for e in all_entries if Decimal(str(e.factor_value_snapshot)) != Decimal(str(e.emission_factor.factor_kg_co2e))}
        mismatch = {e.pk for e in all_entries
                    if abs(float(e.quantity) * float(e.factor_value_snapshot) - float(e.calculated_co2e_kg)) > 0.01}
        inactive = [e.pk for e in all_entries
                    if not e.emission_factor.is_active and not e.emission_factor.slug.startswith('calculated-')]
        steps = rebuild_preview(report, protect=False) if (report.company_id and report.reporting_year) else []
        steps_p = {x['step']: x for x in (rebuild_preview(report, protect=True) if steps else [])}
        exposed = [x for x in steps if not x['same']]
        unproven_steps = [steps_p[x['step']] for x in exposed if x['step'] in steps_p and not steps_p[x['step']]['same']
                          and not steps_p[x['step']]['no_answer_behind_entries']]
        unproven_names = {x['step'] for x in unproven_steps}
        no_answers = [x for x in steps_p.values() if x['no_answer_behind_entries']]
        no_answer_names = {x['step'] for x in no_answers}
        if not all_entries and exposed:
            verdict = 'ENTRIES_MISSING_REVIEW'     # saved answers would create entries on the next save of a signed inventory
        elif not all_entries:
            verdict = 'no_entries'
        elif unproven_steps:
            verdict = 'UNPROVABLE_REVIEW'
        elif drift or mismatch:
            verdict = 'RECORD_INCONSISTENT_REVIEW'
        else:
            verdict = 'provable'
        ents = []
        for e in all_entries:
            step = entry_group(e.description) or ''
            slug, under_value = (_underlying_of(e) if e.emission_factor.slug.startswith('calculated-') else (None, None))
            if e.emission_factor.slug.startswith('calculated-'):
                if step in unproven_names:
                    cls = 'unprovable'
                    missing = (f"underlying catalog factor row{' (' + slug + ')' if slug else ''} is recorded nowhere and today's rows no longer "
                               f"reproduce the stored figure (calc_detail value {under_value or 'n/a'})")
                elif step in no_answer_names:
                    cls, missing = 'no_answer_behind_entry', 'no saved answer behind this entry'
                elif slug:
                    cls, missing = 'unproven_reproducible_today', f"underlying catalog factor row ({slug}) is recorded nowhere; today's row reproduces the stored figure"
                else:
                    cls, missing = 'answer_based', 'none (figure comes from the answer, no catalog factor)'
            elif e.pk in drift or e.pk in mismatch:
                cls, missing = 'record_inconsistent', 'factor row value differs from the entry snapshot' if e.pk in drift else 'kg is not quantity x snapshot'
            else:
                cls, missing = 'proven', 'none'
            ents.append({'report_id': report.pk, 'status': report.status, 'entry_id': e.pk, 'step': step, 'factor_slug': e.emission_factor.slug,
                         'factor_id': e.emission_factor_id, 'quantity': str(e.quantity), 'kg': str(e.calculated_co2e_kg),
                         'class': cls, 'underlying_factor': slug or '', 'missing_provenance': missing,
                         'recommended_handling': RECOMMENDED.get({'no_answer_behind_entry': 'unprovable'}.get(cls, cls), '')})
        if verdict == 'ENTRIES_MISSING_REVIEW':
            for x in exposed:
                ents.append({'report_id': report.pk, 'status': report.status, 'entry_id': '', 'step': x['step'], 'factor_slug': '',
                             'factor_id': '', 'quantity': '', 'kg': '0', 'class': 'entries_missing', 'underlying_factor': '',
                             'missing_provenance': f"no entries on record; the saved answers would create {x['now_kg']} kg on the next save",
                             'recommended_handling': RECOMMENDED['entries_missing']})
        classes = {}
        for x in ents:
            classes[x['class']] = classes.get(x['class'], 0) + 1
        out.append(({'report_id': report.pk, 'company_id': report.company_id, 'year': report.reporting_year,
                     'status': report.status, 'signed': bool(report.signed_at),
                     'frozen_at': s['frozen_at'] or '', 'held': bool(s.get('hold')), 'pins': len(s['pins']),
                     'approved_entries': len(all_entries), 'approved_kg': round(sum(float(e.calculated_co2e_kg) for e in all_entries), 2),
                     'calculated_entries': sum(1 for e in all_entries if e.emission_factor.slug.startswith('calculated-')),
                     'steps_exposed_without_pins': len(exposed), 'steps_unprotected_with_pins': len(unproven_steps),
                     'unprotected_stored_kg': round(sum(x['stored_kg'] for x in unproven_steps), 2),
                     'unprotected_now_kg': round(sum(x['now_kg'] for x in unproven_steps), 2),
                     'steps_without_answers': len(no_answers), 'entries_value_drift': len(drift),
                     'entries_qty_x_snapshot_mismatch': len(mismatch), 'entries_on_withdrawn_factor': len(inactive),
                     'entry_classes': ';'.join(f'{k}={v}' for k, v in sorted(classes.items())), 'verdict': verdict},
                    unproven_steps + no_answers + (exposed if verdict == 'ENTRIES_MISSING_REVIEW' else []), ents))
    return out


# ── every other route: dashboard, chat, admin, background jobs ────────────────────────────────────────────────────
import contextlib  # noqa: E402


def _locked_report(company, year):
    from .models import CarbonReport
    company_id = getattr(company, 'pk', company)
    try:
        y = int(year)
    except (TypeError, ValueError):
        return None
    if not company_id or not y:
        return None
    return CarbonReport.objects.filter(locked_q(), company_id=company_id, reporting_year=y).order_by('-updated_at').first()


@contextlib.contextmanager
def locked_inventory_pins(company, year):
    """The shared factor lookup (chat, dashboard, previews) resolves with the factor rows of the signed / completed inventory
    of that company and year, if there is one. Already inside a pinned context (questionnaire, Workspace): nothing to do."""
    from emissions.factor_lookup import _PINS_MANAGED
    report = _locked_report(company, year) if not _PINS_MANAGED.get() else None
    if report is None:
        yield
        return
    from .step_entries import recorded_connections
    with recorded_connections(report):
        yield


def pinned_factor_for(company_id, year, factor):
    """For an entry about to be created (or whose factor is being changed) in a signed / completed inventory: the row the
    inventory holds for that factor's slug, when it is a different row. None = nothing to substitute."""
    from emissions.factor_lookup import _PINS_MANAGED
    from emissions.models import EmissionFactor
    if factor is None or factor.slug.startswith('calculated-') or _PINS_MANAGED.get():
        return None
    report = _locked_report(company_id, year)
    if report is None:
        return None
    pk = load_pins(report).map.get(factor.slug)
    if pk and pk != factor.pk:
        return EmissionFactor.objects.filter(pk=pk).first()
    return None


def entry_pin_guard(entry):
    """EmissionEntry.save(): a NEW entry, or one whose factor row is being changed, in a signed / completed inventory takes the
    row the inventory holds for that slug. The substitution is written to the company history; it is never silent."""
    from emissions.models import EmissionEntry
    if not (entry.company_id and entry.year and entry.emission_factor_id):
        return
    if entry.pk:
        was = EmissionEntry.objects.filter(pk=entry.pk).values_list('emission_factor_id', flat=True).first()
        if was == entry.emission_factor_id:
            return
    pinned = pinned_factor_for(entry.company_id, entry.year, entry.emission_factor)
    if pinned is None:
        return
    requested = entry.emission_factor
    entry.emission_factor = pinned
    entry.factor_value_snapshot = pinned.factor_kg_co2e
    entry.factor_source_snapshot = f'{pinned.source}: {(pinned.reference or "")[:100]}'
    if entry.quantity is not None:
        entry.calculated_co2e_kg = entry.quantity * pinned.factor_kg_co2e        # bulk_create() never calls save()
    from emissions.audit import log_company_activity
    log_company_activity(
        getattr(entry, 'user', None), entry.company_id, 'entry_factor_pinned',
        f'{entry.year} envanteri imzalı/tamamlanmış: "{requested.slug}" için kayıtlı faktör satırı #{pinned.pk} kullanıldı (istenen #{requested.pk}).',
        f'The {entry.year} inventory is signed/completed: the recorded factor row #{pinned.pk} was used for "{requested.slug}" (requested #{requested.pk}).',
        target_type='EmissionFactor', target_id=pinned.pk, reporting_year=entry.year,
        requested_factor_id=requested.pk, pinned_factor_id=pinned.pk)


def locked_year_has_entries(queryset):
    """True when any entry of the queryset belongs to a signed / completed inventory (used by the update() guard)."""
    for company_id, year in queryset.values_list('company_id', 'year').distinct():
        if company_id and _locked_report(company_id, year) is not None:
            return True
    return False


# ── hold: an inventory whose figures cannot be proven is never rebuilt automatically ──────────────────────────────
HOLD_VERDICTS = ('UNPROVABLE_REVIEW', 'ENTRIES_MISSING_REVIEW', 'RECORD_INCONSISTENT_REVIEW')


def is_held(report):
    from .models import CarbonReport
    row = CarbonReport.objects.filter(locked_q(), pk=report.pk).values_list('applied_factors', flat=True).first()
    return bool(normalise(row).get('hold'))


def set_hold(report, reason, by='deploy_command'):
    from .models import CarbonReport
    with transaction.atomic():
        row = CarbonReport.objects.select_for_update().get(pk=report.pk)
        s = normalise(row.applied_factors)
        s['hold'] = {'reason': reason, 'since': timezone.now().isoformat(), 'by': by}
        CarbonReport.objects.filter(pk=row.pk).update(applied_factors=s)


def release_hold(report, user, reason):
    """Explicit, reasoned and audited. After release the inventory can be rebuilt again by the normal routes."""
    from emissions.audit import log_company_activity
    from .models import CarbonReport
    if not (reason or '').strip():
        raise ValueError('Releasing a hold needs a stated reason.')
    with transaction.atomic():
        row = CarbonReport.objects.select_for_update().get(pk=report.pk)
        s = normalise(row.applied_factors)
        previous = s.pop('hold', None)
        if previous is None:
            raise ValueError('This inventory has no hold.')
        CarbonReport.objects.filter(pk=row.pk).update(applied_factors=s)
        actor = getattr(user, 'username', '') or ''
        log_company_activity(
            user, row.company_id, 'inventory_hold_released',
            f'{row.reporting_year} envanterindeki bekletme kaldırıldı ({actor}). Gerekçe: {reason}.',
            f'The hold on the {row.reporting_year} inventory was released by {actor}. Reason: {reason}.',
            target_type='CarbonReport', target_id=row.pk, reporting_year=row.reporting_year,
            reason=reason, actor=actor, previous_hold=previous, at=timezone.now().isoformat())


def log_hold_skip(user, report, route):
    from emissions.audit import log_company_activity
    h = stored(report)['hold']
    log_company_activity(
        user, report.company_id, 'rebuild_held',
        f'{report.reporting_year} envanterinin hesaplaması durduruldu ({route}): imzalı envanterin kaynağı kanıtlanamıyor ({h["reason"]}). Hiçbir kayıt değiştirilmedi.',
        f'Rebuild of the {report.reporting_year} inventory was refused ({route}): the signed inventory cannot be proven ({h["reason"]}). Nothing was changed.',
        target_type='CarbonReport', target_id=report.pk, reporting_year=report.reporting_year, route=route, hold=h)


RECOMMENDED = {
    'proven': 'none: the entry references the factor row it was priced with and its value snapshot still matches.',
    'record_inconsistent': 'do not rebuild; compare the entry snapshot with the factor row (the row value was edited after the entry); restore through a new factor row, not an edit.',
    'unproven_reproducible_today': "freeze before any factor change (deploy command; stored as deploy_time = unproven); today's rows still reproduce the stored figure.",
    'unprovable': 'HOLD; do not rebuild or reprice; recompute from the retained answers with the factors in force at signing, document the source, then release the hold with a reason.',
    'answer_based': "none: the figure comes from the user's own answer (supplier factor, declaration, reported total), not from a catalog row.",
    'entries_missing': 'HOLD; do not save, rebuild or recalculate; follow the recovery procedure.',
}
