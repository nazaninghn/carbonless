"""
Danışman Onayı (Advisor Approval) trigger evaluation.

Implements the 32-rule table from CarbonIQ_Kataloglar_v1.docx Bölüm 7 (client's
"Advisor Triggers" spec). Each rule watches one or more question_ids and, when a
newly-saved answer matches its condition, creates a pending AdvisorApproval
record via evaluate_advisor_triggers() — called from SubmitStepView.patch()
right after the ReportStep is saved.

Coverage note: 26 of the 32 rules have a concrete, verifiable signal in the
current questionnaire (see the RULES list below). 6 rules from the client's
table have no matching frontend field yet and are intentionally NOT
implemented here (never fire) rather than guessed at:
  - ef_doc_missing / declaration_doc_missing: no EF-document file-upload
    field exists anywhere in questions.js (the *-EF-a compounds capture
    value/unit/source/year as text, not an uploaded file).
  - location_based_confirmed: no discrete "D2" methodology-confirmation
    question exists in the current Stage 4 flow.
  - level_upgrade: requires diffing a field's data-quality level against its
    own previous value across two edits — no such history diffing exists.
  - permanent_exception: Stage 6C (6C-1..6C-3) has no permanent/temporary
    exception distinction, only a description + optional future-improvement note.
  - ef_catalog_mismatch / ef_catalog_update_needed: both would need a stored
    "previous EF database version" to diff against — not tracked anywhere.
"""

from decimal import Decimal, InvalidOperation


def _num(v):
    """Best-effort numeric coercion; returns None (not 0) on failure so a
    missing/non-numeric value never accidentally matches a `== 0` check."""
    try:
        return float(v)
    except (TypeError, ValueError, InvalidOperation):
        return None


def _answer_value(data):
    """A saved ReportStep.answer is usually {'answer': value} (the frontend's
    mapAnswerForBackend default case) but compound/loop questions store their
    own shape directly. Mirrors the frontend's readAnswerValue."""
    if isinstance(data, dict) and 'answer' in data and len(data) == 1:
        return data['answer']
    return data


def _iter_compound_or_loop_values(value, field_id):
    """Yields every value found under `field_id` across whatever shape a
    saved answer may have: a single compound {field_id: v}, a finished loop
    aggregate {itemKey: {field_id: v}}, or a repeatable compound
    {items: [{field_id: v}, ...]}."""
    if not isinstance(value, dict):
        return
    if 'items' in value and isinstance(value['items'], list):
        for item in value['items']:
            if isinstance(item, dict) and field_id in item:
                yield item[field_id]
        return
    if field_id in value:
        yield value[field_id]
        return
    # finished loop aggregate: { itemKey: {field_id: v} }
    for v in value.values():
        if isinstance(v, dict) and field_id in v:
            yield v[field_id]


def _flatten_scalar_values(value):
    """Flattens a scalar/array/loop-aggregate answer into a flat list of atomic
    values, so a matcher can test membership without caring whether the
    underlying question was a loop. Handles:
      - a bare scalar:                        'AR6'                    -> ['AR6']
      - a multi_select array:                 ['natural_gas','biomass'] -> ['natural_gas', 'biomass']
      - a finished loop-of-scalars aggregate:  {itemKey: 'AR6', ...}     -> ['AR6', ...]
      - a finished loop-of-arrays aggregate:   {itemKey: ['a','b']}      -> ['a', 'b', ...]
    Loop-of-*compound* aggregates are deliberately excluded (dict values are
    skipped) — those need _iter_compound_or_loop_values with an explicit field_id.
    """
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        flat = []
        for v in value.values():
            if isinstance(v, list):
                flat.extend(v)
            elif not isinstance(v, dict):
                flat.append(v)
        return flat
    return [value]


# ── Rule matchers ────────────────────────────────────────────────────────────
# Each matcher receives (question_id, raw_answer, report) and returns either
# None (no match) or a dict {reason_code, category, risk, description}.

def _match_3a6_data_source(qid, answer, report):
    # 3A-6 is a fuel_loop — its finished answer is { fuelType: dataSourceValue, ... },
    # not a bare string, so this must scan every fuel's value rather than compare
    # the whole aggregate to a string (which would never match).
    values = _flatten_scalar_values(_answer_value(answer))
    results = []
    seen = set()
    for v in values:
        if v == 'sector_average' and 'sector_average' not in seen:
            seen.add('sector_average')
            results.append({'reason_code': 'sector_average', 'category': 'Veri Girişi', 'risk': 'high',
                             'description': f'{qid}: sector average selected instead of invoice/meter data.'})
        elif v == 'engineering_estimate' and 'engineering_estimate' not in seen:
            seen.add('engineering_estimate')
            results.append({'reason_code': 'estimate_used', 'category': 'Veri Girişi', 'risk': 'medium',
                             'description': f'{qid}: engineering estimate selected instead of invoice/meter data.'})
    return results or None


def _match_ef_document(qid, answer, report):
    # *-EF-a compounds (3A-EF-a, 3B-EF-a, 3C-EF-a, ...) — a supplier/manufacturer
    # EF declaration was entered, overriding the system default.
    return {'reason_code': 'supplier_declaration', 'category': 'Veri Girişi', 'risk': 'medium',
            'description': f'{qid}: supplier/manufacturer EF declaration entered.'}


def _match_zero_refill_decision(qid, answer, report):
    val = _answer_value(answer)
    if val == 'ipcc_default':
        return {'reason_code': 'ipcc_default_leakage', 'category': 'Veri Girişi', 'risk': 'high',
                'description': f'{qid}: annual refill was 0; IPCC default leak rate applied.'}
    if val == 'zero_declared':
        return {'reason_code': 'zero_leakage_declaration', 'category': 'Veri Girişi', 'risk': 'high',
                'description': f'{qid}: annual refill was 0; user declared zero leakage.'}
    return None


def _match_no_op_control(qid, answer, report):
    # 3A-2b is a per-equipment loop; finished answer is {equipmentId: 'yes'|'no', ...}.
    if 'no' in _flatten_scalar_values(_answer_value(answer)):
        return {'reason_code': 'no_op_control_3a', 'category': 'Kapsam', 'risk': 'medium',
                'description': f'{qid}: no operational control — moved from Scope 1 to Scope 3 Category 8.'}
    return None


def _match_k3_category_no(qid, answer, report):
    if _answer_value(answer) == 'no':
        return {'reason_code': 'k3_category_no', 'category': 'Kapsam', 'risk': 'medium_high',
                'description': f'{qid}: Scope 3 category marked not applicable ("No").'}
    return None


def _match_rfi(qid, answer, report):
    """K3C6-2 is a repeatable compound with an rfi_applied boolean per flight
    entry — fires once per distinct true/false value found across all entries."""
    val = _answer_value(answer)
    results = []
    seen = set()
    for v in _iter_compound_or_loop_values(val, 'rfi_applied'):
        is_true = v is True or v == 'true'
        key = 'applied' if is_true else 'not_applied'
        if key in seen:
            continue
        seen.add(key)
        if is_true:
            results.append({'reason_code': 'rfi_applied', 'category': 'Metodoloji', 'risk': 'low',
                             'description': f'{qid}: RFI (radiative forcing) applied to a flight entry.'})
        else:
            results.append({'reason_code': 'rfi_not_applied', 'category': 'Metodoloji', 'risk': 'medium',
                             'description': f'{qid}: RFI not applied to a flight entry — likely underestimate.'})
    return results or None


def _match_biomass(qid, answer, report):
    # 3A-4 is a per-equipment loop of multi_select fuel-type arrays; finished
    # answer is {equipmentId: ['natural_gas', 'biomass'], ...}.
    if 'biomass' in _flatten_scalar_values(_answer_value(answer)):
        return {'reason_code': 'biomass_neutral', 'category': 'Metodoloji', 'risk': 'low',
                'description': f'{qid}: biomass selected — carbon-neutral combustion assumption applied.'}
    return None


def _match_ar6_gwp(qid, answer, report):
    # 3D-EF is a per-equipment loop; finished answer is {equipmentId: 'AR6'|'AR5'|'AR4', ...}.
    if 'AR6' in _flatten_scalar_values(_answer_value(answer)):
        return {'reason_code': 'ar6_gwp_confirmed', 'category': 'Metodoloji', 'risk': 'low',
                'description': f'{qid}: IPCC AR6 (2021) GWP reference confirmed.'}
    return None


def _match_ef_database_change(qid, answer, report):
    if _answer_value(answer) == 'custom':
        return {'reason_code': 'ef_database_change', 'category': 'Metodoloji', 'risk': 'medium',
                'description': f'{qid}: custom emission factor database selected instead of a standard one.'}
    return None


def _match_6a_reason(qid, answer, report):
    return {'reason_code': '6a_entity_exclusion', 'category': 'Kapsam', 'risk': 'high',
            'description': f'{qid}: an entity/facility was excluded from the inventory boundary.'}


def _match_6a_emission_band(qid, answer, report):
    val = _answer_value(answer)
    band_risk = {'5_10': ('6c_medium_materiality', 'high'), '10_20': ('6c_medium_materiality', 'high'),
                 'gt20': ('6c_high_materiality', 'critical')}
    if val in band_risk:
        code, risk = band_risk[val]
        return {'reason_code': code, 'category': 'Kapsam', 'risk': risk,
                'description': f'{qid}: excluded source estimated emission share is {val.replace("_", "-")}%.'}
    return None


def _match_pct5_exceeded(qid, answer, report):
    if _answer_value(answer) == 'go_back':
        return {'reason_code': 'pct5_exceeded', 'category': 'Kapsam', 'risk': 'critical',
                'description': f'{qid}: cumulative exclusion/materiality share exceeds the ISO 14064-1 5% threshold.'}
    return None


def _match_current_year_data(qid, answer, report):
    # A4 is a STRICT_STEPS question (its own serializer) — stored as
    # {'reporting_year': N}, not the generic {'answer': N} wrapper.
    import datetime
    raw = answer.get('reporting_year') if isinstance(answer, dict) else None
    val = _num(raw)
    if val is not None and int(val) == datetime.date.today().year:
        return {'reason_code': 'current_year_data', 'category': 'Tutarsızlık', 'risk': 'low',
                'description': f'{qid}: reporting year is the current year — some data may still be estimated.'}
    return None


# ── Rules requiring cross-report-state (checked separately, not per-field) ──

def _check_no_base_year_recalc(report):
    from .models import ReportStep
    f2 = ReportStep.objects.filter(report=report, step_id='6F-2').first()
    f3 = ReportStep.objects.filter(report=report, step_id='6F-3').first()
    if not f2 or not f3:
        return None
    if _answer_value(f2.answer) == 'yes' and _answer_value(f3.answer) == 'defer':
        return {
            'question_id': '6F-3', 'field_id': 'closing.base_year_recalc_needed',
            'reason_code': 'no_base_year_recalc', 'category': 'Kapsam', 'risk': 'medium',
            'description': 'Structural change impact exceeds 5% but base year recalculation was deferred.',
        }
    return None


def _check_overseas_site_c2_conflict(report):
    # C2 is a STRICT_STEPS question — stored as {'has_international': bool},
    # not the generic {'answer': 'no'} wrapper.
    from .models import ReportStep
    c2 = ReportStep.objects.filter(report=report, step_id='C2').first()
    if not c2 or not isinstance(c2.answer, dict) or c2.answer.get('has_international') is not False:
        return None
    facilities = ReportStep.objects.filter(report=report, step_id='2A-2').first()
    if not facilities:
        return None
    val = _answer_value(facilities.answer)
    countries = set()
    if isinstance(val, dict):
        for country in _iter_compound_or_loop_values(val, 'country'):
            if country:
                countries.add(country)
    if any(c and c != 'TR' for c in countries):
        return {
            'question_id': '2A-2', 'field_id': 'site.country',
            'reason_code': 'overseas_site_c2_conflict', 'category': 'Tutarsızlık', 'risk': 'medium',
            'description': f'C2 (international operations) is "No" but an overseas facility ({", ".join(sorted(countries))}) was added.',
        }
    return None


def _check_site_count_mismatch(report):
    # B4 is a STRICT_STEPS question — stored as {'number_of_facilities': N}.
    from .models import ReportStep
    b4 = ReportStep.objects.filter(report=report, step_id='B4').first()
    facilities = ReportStep.objects.filter(report=report, step_id='2A-2').first()
    if not b4 or not facilities:
        return None
    declared = _num(b4.answer.get('number_of_facilities')) if isinstance(b4.answer, dict) else None
    val = _answer_value(facilities.answer)
    actual = len(val.get('items', [])) if isinstance(val, dict) and 'items' in val else (len(val) if isinstance(val, dict) else 0)
    if declared is not None and actual and int(declared) != actual:
        return {
            'question_id': '2A-2', 'field_id': 'report.confirmed_site_count',
            'reason_code': 'site_count_mismatch', 'category': 'Tutarsızlık', 'risk': 'medium',
            'description': f'B4 declared {int(declared)} facilities but {actual} were entered in 2A-2.',
        }
    return None


# question_id -> matcher(qid, answer, report) -> dict | list[dict] | None
FIELD_RULES = {
    '3A-6': _match_3a6_data_source,
    '3A-EF-a': _match_ef_document,
    '3B-EF-a': _match_ef_document,
    '3C-EF-a': _match_ef_document,
    '3D-4-zero-decision': _match_zero_refill_decision,
    '3A-2b': _match_no_op_control,
    '3A-4': _match_biomass,
    '3D-EF': _match_ar6_gwp,
    'D1': _match_ef_database_change,
    'K3C6-2': _match_rfi,
    '6A-2': _match_6a_reason,
    '6A-4': _match_6a_emission_band,
    '6D-1': _match_pct5_exceeded,
    'A4': _match_current_year_data,
}

# Every Scope 3 category "gate" question — answering "No" triggers k3_category_no.
K3_GATE_QUESTIONS = {
    'K3C1-0', 'K3C2-0', 'K3C4-0', 'K3C5-0', 'K3C6-0', 'K3C8-0', 'K3C9-0',
    'K3C10-0', 'K3C12-0', 'K3C13-0', 'K3C14-0', 'K3C15-0',
}
for _q in K3_GATE_QUESTIONS:
    FIELD_RULES[_q] = _match_k3_category_no


# Cross-question checks: (questions whose save re-runs it, the question the
# flag is filed under, its reason code, the check).
CROSS_CHECKS = [
    (('6F-2', '6F-3'), '6F-3', 'no_base_year_recalc', _check_no_base_year_recalc),
    (('C2', '2A-2'), '2A-2', 'overseas_site_c2_conflict', _check_overseas_site_c2_conflict),
    (('B4', '2A-2'), '2A-2', 'site_count_mismatch', _check_site_count_mismatch),
]

# An answer that closes a branch: flags raised on the questions behind it no
# longer apply (their old answers stay stored but are not part of the report).
BRANCH_CLOSERS = {
    ('6A-1', 'none_flagged'): ('6A-1a', '6A-2', '6A-4', '6A-5', '6A-6'),
}


def _branch_closed(report, question_id):
    """True when the question sits behind a branch the current answers close
    (e.g. 6A-2 after 6A-1 = "no exclusions")."""
    from .models import ReportStep
    for (closer, value), dependents in BRANCH_CLOSERS.items():
        if question_id in dependents:
            step = ReportStep.objects.filter(report=report, step_id=closer).first()
            if step and _answer_value(step.answer) == value:
                return True
    return False


def evaluate_advisor_triggers(report, question_id, answer):
    """Called right after a ReportStep is saved. Brings the report's pending
    AdvisorApproval rows for this question in line with the new answer:
    creates newly-triggered flags, refreshes the text of ones still true and
    removes pending ones the answer no longer triggers. Flags the user has
    already approved or rejected are left as they are."""
    from .models import AdvisorApproval

    matches = []
    # (question_id, reason_code) pairs this evaluation decides; reason_code
    # None = every reason on that question (its own field rule).
    authority = set()

    matcher = FIELD_RULES.get(question_id)
    if matcher:
        authority.add((question_id, None))
    if matcher and not _branch_closed(report, question_id):
        result = matcher(question_id, answer, report)
        if isinstance(result, list):
            matches.extend(result)
        elif result:
            matches.append(result)

    for triggers, target, reason, check in CROSS_CHECKS:
        if question_id in triggers:
            authority.add((target, reason))
            result = check(report)
            if result:
                matches.append(result)

    value = _answer_value(answer)
    closed = BRANCH_CLOSERS.get((question_id, value), ()) if isinstance(value, str) else ()

    produced = {(m.get('question_id', question_id), m['reason_code']) for m in matches}
    pending = AdvisorApproval.objects.filter(report=report, status=AdvisorApproval.Status.PENDING)
    for a in pending:
        key = (a.question_id, a.reason_code)
        governed = (a.question_id, None) in authority or key in authority
        if a.question_id in closed or (governed and key not in produced):
            a.delete()

    created = []
    for m in matches:
        fields = {
            'field_id': m.get('field_id', ''),
            'trigger_category': m['category'],
            'risk_level': m['risk'],
            'description': m['description'],
        }
        obj, was_created = AdvisorApproval.objects.get_or_create(
            report=report,
            question_id=m.get('question_id', question_id),
            reason_code=m['reason_code'],
            defaults=fields,
        )
        if was_created:
            created.append(obj)
        elif obj.status == AdvisorApproval.Status.PENDING and obj.description != m['description']:
            for k, v in fields.items():
                setattr(obj, k, v)
            obj.save(update_fields=list(fields))
    return created


def reconcile_advisor_approvals(report):
    """Re-check a report's pending flags against its current answers — for
    flags raised before evaluate_advisor_triggers kept them in sync, whose
    answer has since changed or been removed."""
    from .models import AdvisorApproval, ReportStep

    qids = set(AdvisorApproval.objects.filter(
        report=report, status=AdvisorApproval.Status.PENDING).values_list('question_id', flat=True))
    if not qids:
        return
    for (closer, _value), dependents in BRANCH_CLOSERS.items():
        if qids & set(dependents):
            qids.add(closer)
    steps = {s.step_id: s.answer for s in ReportStep.objects.filter(report=report, step_id__in=qids)}
    # A flag whose question has no saved step is left alone — nothing to
    # re-check it against.
    for qid in sorted(qids):
        if qid in steps:
            evaluate_advisor_triggers(report, qid, steps[qid])
