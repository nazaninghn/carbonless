"""Data quality of an inventory: where each amount comes from, and the uncertainty that follows.

The owner's specification (2026-11-22):

  1. each calculating question records the source of its activity data;
  2A. activity-data uncertainty u_a by source:  measurement 1 %, invoice / system data 7 %, estimate 20 %;
  2B. emission-factor uncertainty u_ef = sqrt(base² + add-on²)
        base    — supplier declaration 5 %, Turkish official source 15 %, IPCC / DEFRA / global set 30 %,
                  the organisation's own undocumented factor 30 %;
        add-on  — by the factor's unit: one variable (kg, L, kWh) 0, several variables (t·km, person·km) 15 %,
                  dependent / ratio (per person, per USD) 25 %;
  3. row:    u_row = sqrt(u_a² + u_ef²),   absolute_row = u_row x E_row;
  4. a row above 60 % is flagged;
  5. total:  absolute_total = sqrt(sum(absolute_row²)),  u_total = absolute_total / E_total,
             interval = E_total ± absolute_total  (rows taken as independent — said in the report).

Nothing here changes a calculated emission: it reads the entries and says how sure they are.
A question whose source is not chosen is taken as an estimate (the cautious reading), and said so.

What needs a person is sent to the advisor queue (AdvisorApproval, reason codes below; listed in the review
inbox and in the admin panel):

  UT-02  a "measurement" with its document         -> the advisor reviews the record
  UT-04  a source "other" with a hand-entered %    -> needs a written reason and the advisor's approval
  UT-05  a supplier's declaration for the factor   -> with approval the factor counts as a declaration (5 %)
  UT-03  a row above 60 %                          -> the advisor reviews the row

A "measurement" without a document (UT-01) is not accepted as one: it is counted as an estimate until the
record is uploaded. A claim the advisor rejects is counted as an estimate (own factor: 30 %) as well.
A row under 1 % of the total whose source is not stated may be accepted as an estimate, up to 5 % of the
total in all. While an item waits for the advisor the inventory cannot be signed.
"""
from decimal import Decimal
from math import sqrt

MEASUREMENT, INVOICE, ESTIMATE, OTHER = 'measurement', 'invoice', 'estimate', 'other'
ACTIVITY_PERCENT = {MEASUREMENT: 1.0, INVOICE: 7.0, ESTIMATE: 20.0}
SOURCES = (MEASUREMENT, INVOICE, ESTIMATE, OTHER)
SOURCE_LABELS = {
    MEASUREMENT: {'tr': 'Ölçüm', 'en': 'Measurement'},
    INVOICE: {'tr': 'Fatura / sistem verisi', 'en': 'Invoice / system data'},
    ESTIMATE: {'tr': 'Tahmin', 'en': 'Estimate'},
    OTHER: {'tr': 'Diğer', 'en': 'Other'},
}
UNSPECIFIED = ''                      # not chosen: counted as an estimate
# How the figure was entered: one total for several devices / sites / items, or item by item. A total is less
# precise (the factor of each item cannot be applied to it): the user is told so and the report states the share
# of emissions entered that way. It has NO numeric effect on the uncertainty: the specification gives no
# percentage for it, and none is invented (owner's decision, 2026-11-22).
TOTAL, ITEMISED = 'total', 'itemised'
DETAILS = (TOTAL, ITEMISED)
ROW_FLAG_PERCENT = 60.0
OTHER_PERCENT_MIN, OTHER_PERCENT_MAX = 0.1, 100.0
OTHER_REASON_MIN, OTHER_REASON_MAX = 20, 500
SMALL_ROW_SHARE, SMALL_ROWS_TOTAL_SHARE = 1.0, 5.0      # per cent of the inventory

BASE_SUPPLIER, BASE_OFFICIAL_TR, BASE_GLOBAL, BASE_OWN = 5.0, 15.0, 30.0, 30.0
ADDON_SINGLE, ADDON_MULTI, ADDON_RATIO = 0.0, 15.0, 25.0
_MULTI_UNITS = {'tonne-km', 'person-km', 'passenger-km', 'tkm', 'pkm'}
_RATIO_UNITS = {'usd', 'eur', 'try', 'nights', 'days', 'employees', 'packages', 'franchises', 'units',
                'multiplier', 'm2'}

# Advisor queue: reason codes of the data-quality items.
UT_MEASUREMENT, UT_OTHER, UT_SUPPLIER, UT_ROW = (
    'ut02_measurement_document', 'ut04_other_source', 'ut05_supplier_declaration', 'ut03_row_above_60')
UT_CODES = (UT_MEASUREMENT, UT_OTHER, UT_SUPPLIER, UT_ROW)
DOC_MEASUREMENT, DOC_SUPPLIER = 'measurement', 'supplier_declaration'

# 3A-6 already asks, per fuel, how the stationary-fuel amount was obtained.
_FUEL_SOURCE = {'invoice_meter': INVOICE, 'engineering_estimate': ESTIMATE, 'sector_average': ESTIMATE}


def _tr(lang):
    return str(lang or '').lower().startswith('tr')


def checked_data_source(step_id, data, saved_answers, lang='en'):
    """(data, error) for a calculating question's answer about to be saved: the source of its amount travels
    with the answer as `data_source` (for "other": with `data_source_percent` and `data_source_reason`).
    Kept from the saved answer when a save does not repeat it; refused at the serializer when it is not valid.
    Not required — an answer without one is read as an estimate."""
    from .step_entries import ENTRY_STEPS
    if step_id not in ENTRY_STEPS or not isinstance(data, dict) or 'answer' not in data:
        return data, None
    keys = ('data_source', 'data_source_percent', 'data_source_reason', 'data_source_small')
    saved = (saved_answers or {}).get(step_id)
    saved = saved if isinstance(saved, dict) else {}
    given = {k: data[k] for k in keys if data.get(k) not in (None, '')}
    if 'data_source' not in given:
        given = {k: saved[k] for k in keys if saved.get(k) not in (None, '')}
    detail = data.get('data_detail') if data.get('data_detail') not in (None, '') else saved.get('data_detail')
    data = {k: v for k, v in data.items() if k not in keys and k != 'data_detail'}
    if detail not in (None, ''):
        if detail not in DETAILS:
            return data, detail_error(lang)
        data['data_detail'] = detail
    if not given.get('data_source'):
        return data, None
    cleaned, error = clean_source(given, lang)
    if error:
        return data, error
    return {**data, **cleaned}, None


def detail_error(lang='en'):
    return ('Geçersiz giriş biçimi. "Toplam" veya "kalem kalem" seçin.' if _tr(lang) else
            'Invalid entry form. Choose "total" or "item by item".')


def step_detail(answers, step_id):
    """'total' / 'itemised' as declared for a question's figure, or '' when not declared."""
    stored = (answers or {}).get(step_id)
    detail = stored.get('data_detail') if isinstance(stored, dict) else None
    return detail if detail in DETAILS else ''


def detail_warning(detail, lang='en'):
    """What the user is told when a figure is one total for several devices, sites or items."""
    if detail != TOTAL:
        return ''
    return ('Toplam değer girdiniz: cihaz, tesis veya kalem bazında ayrı değerler olmadan her birinin kendi faktörü '
            'uygulanamaz ve sonucun doğruluğu düşer. Ayrı değerleriniz varsa tek tek girin. Bu, raporda belirtilir.'
            if _tr(lang) else
            'You entered a total: without a separate figure for each device, site or item, the factor of each one '
            'cannot be applied and the result is less accurate. Enter them one by one if you have them. The report '
            'states this.')


def clean_source(given, lang='en'):
    """({data_source, …} to store, error) — the one validation of a data source, at the serializer."""
    from .serializers import DataSourceSerializer
    ser = DataSourceSerializer(data=given)
    if not ser.is_valid():
        first = next(iter(ser.errors.values()))
        text = str(first[0] if isinstance(first, (list, tuple)) else first)
        tr, _, en = text.partition(' / ')
        return None, tr if _tr(lang) else (en or tr)
    v = ser.validated_data
    out = {'data_source': v['data_source']}
    if v['data_source'] == OTHER:
        out['data_source_percent'] = float(v['data_source_percent'])
        out['data_source_reason'] = v['data_source_reason']
    if v['data_source'] == ESTIMATE and v.get('data_source_small'):
        out['data_source_small'] = True
    return out, None


def step_source(answers, step_id):
    """The source recorded for a question's amount, or '' when none is."""
    stored = (answers or {}).get(step_id)
    chosen = stored.get('data_source') if isinstance(stored, dict) else None
    if chosen in SOURCES:
        return chosen
    if step_id == '3A-5':                 # the per-fuel answer of 3A-6: the least sure of them
        raw = (answers or {}).get('3A-6')
        raw = raw.get('answer') if isinstance(raw, dict) and 'answer' in raw else raw
        values = list(raw.values()) if isinstance(raw, dict) else [raw]
        mapped = [_FUEL_SOURCE[v] for v in values if v in _FUEL_SOURCE]
        if mapped:
            return ESTIMATE if ESTIMATE in mapped else INVOICE
    return UNSPECIFIED


class _Context:
    """What the calculation needs to know about an inventory beyond its answers: the documents uploaded per
    question and what the advisor decided on its data-quality items."""

    def __init__(self, report):
        from .models import AdvisorApproval, ReportStep, StepDocument
        self.answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
        self.documents = set(StepDocument.objects.filter(report=report).values_list('step_id', 'kind'))
        self.decisions = {(a.question_id, a.reason_code): a.status for a in AdvisorApproval.objects.filter(
            report=report, reason_code__in=UT_CODES)}

    def rejected(self, step, code):
        return self.decisions.get((step, code)) == 'rejected'

    def approved(self, step, code):
        return self.decisions.get((step, code)) == 'approved'

    def activity(self, step):
        """(per cent, source as stated, state) — state says why a stated source is not applied as stated."""
        source = step_source(self.answers, step)
        stored = self.answers.get(step) if isinstance(self.answers.get(step), dict) else {}
        if source == MEASUREMENT:
            if (step, DOC_MEASUREMENT) not in self.documents:
                return ACTIVITY_PERCENT[ESTIMATE], source, 'measurement_no_document'
            if self.rejected(step, UT_MEASUREMENT):
                return ACTIVITY_PERCENT[ESTIMATE], source, 'rejected'
            return ACTIVITY_PERCENT[MEASUREMENT], source, 'ok' if self.approved(step, UT_MEASUREMENT) else 'pending'
        if source == OTHER:
            if self.rejected(step, UT_OTHER):
                return ACTIVITY_PERCENT[ESTIMATE], source, 'rejected'
            try:
                percent = float(stored.get('data_source_percent'))
            except (TypeError, ValueError):
                return ACTIVITY_PERCENT[ESTIMATE], source, 'rejected'
            return percent, source, 'ok' if self.approved(step, UT_OTHER) else 'pending'
        if source in ACTIVITY_PERCENT:
            return ACTIVITY_PERCENT[source], source, 'accepted_small' if stored.get('data_source_small') else 'ok'
        return ACTIVITY_PERCENT[ESTIMATE], UNSPECIFIED, 'unspecified'

    def factor(self, step, factor):
        return factor_percent(factor, supplier_declared=(
            (step, DOC_SUPPLIER) in self.documents and self.approved(step, UT_SUPPLIER)))


def factor_percent(factor, supplier_declared=False):
    """(u_ef, base, add-on) of an emission factor, in per cent.

    A value stated on the factor itself (catalogue or advisor input) is used as it is. Otherwise the base
    value of the factor's source, combined with the add-on of its unit."""
    stated = getattr(factor, 'uncertainty_percent', None)
    if stated is not None:
        return float(stated), float(stated), 0.0
    slug, source = str(factor.slug or ''), str(factor.source or '')
    if slug.startswith('calculated-'):
        # CO2e from a supplier's or the organisation's own figure: a declaration once the advisor approved
        # its document, the organisation's own undocumented factor until then.
        base = BASE_SUPPLIER if supplier_declared else BASE_OWN
    elif source == 'turkey_grid':
        base = BASE_OFFICIAL_TR
    else:
        base = BASE_GLOBAL
    unit = str(factor.unit or '').strip().lower()
    addon = ADDON_MULTI if unit in _MULTI_UNITS else ADDON_RATIO if unit in _RATIO_UNITS else ADDON_SINGLE
    return sqrt(base ** 2 + addon ** 2), base, addon


def inventory_uncertainty(report):
    """The uncertainty of an inventory, from its questionnaire entries.

    {total_kg, absolute_kg, percent, low_kg, high_kg, rows, flagged, unspecified_steps, small_rows,
     accepted_small_share, pending_approvals}
    Each row: step_id, label_tr / label_en, factor, co2e_kg, source ('' = not chosen), source_state,
    activity_percent, factor_percent, row_percent, absolute_kg, share_percent, flagged."""
    from emissions.inventory_scope import entries_of
    from .step_entries import entry_group, question_label
    ctx = _Context(report)
    rows, unspecified = [], []
    for entry in entries_of(report).select_related('emission_factor').order_by('pk'):
        step = entry_group(entry.description)
        kg = float(entry.calculated_co2e_kg or Decimal('0'))
        if not step or not kg:
            continue
        u_a, source, state = ctx.activity(step)
        if state == 'unspecified' and step not in unspecified:
            unspecified.append(step)
        u_ef, base, addon = ctx.factor(step, entry.emission_factor)
        u_row = sqrt(u_a ** 2 + u_ef ** 2)
        rows.append({
            'step_id': step, 'label_tr': question_label(step, 'tr'), 'label_en': question_label(step, 'en'),
            'factor': entry.emission_factor.name, 'factor_tr': entry.emission_factor.name_tr or entry.emission_factor.name,
            'co2e_kg': round(kg, 4), 'source': source, 'source_state': state, 'detail': step_detail(ctx.answers, step),
            'activity_percent': u_a,
            'factor_base_percent': base, 'factor_addon_percent': addon, 'factor_percent': round(u_ef, 2),
            'row_percent': round(u_row, 2), 'absolute_kg': round(abs(kg) * u_row / 100, 4),
            'flagged': u_row > ROW_FLAG_PERCENT,
        })
    total = sum(r['co2e_kg'] for r in rows)
    gross = sum(abs(r['co2e_kg']) for r in rows)
    absolute = sqrt(sum(r['absolute_kg'] ** 2 for r in rows))
    percent = (absolute / abs(total) * 100) if total else 0.0
    by_step = {}
    for r in rows:
        r['share_percent'] = round(abs(r['co2e_kg']) / gross * 100, 2) if gross else 0.0
        by_step[r['step_id']] = by_step.get(r['step_id'], 0.0) + (abs(r['co2e_kg']) / gross * 100 if gross else 0.0)
    accepted = sum(share for step, share in by_step.items()
                   if any(r['step_id'] == step and r['source_state'] == 'accepted_small' for r in rows))
    small = [step for step in unspecified
             if by_step.get(step, 0.0) < SMALL_ROW_SHARE and accepted + by_step.get(step, 0.0) <= SMALL_ROWS_TOTAL_SHARE]
    return {
        'total_kg': round(total, 2), 'absolute_kg': round(absolute, 2), 'percent': round(percent, 2),
        'low_kg': round(total - absolute, 2), 'high_kg': round(total + absolute, 2),
        'rows': rows, 'flagged': [r for r in rows if r['flagged']], 'unspecified_steps': unspecified,
        'small_rows': small, 'step_share_percent': {k: round(v, 2) for k, v in by_step.items()},
        'accepted_small_share': round(accepted, 2), 'row_flag_percent': ROW_FLAG_PERCENT,
        'pending_approvals': sum(1 for status in ctx.decisions.values() if status == 'pending'),
        # Figures entered as one total (less precise; no numeric effect on the percentages above).
        'total_entry_steps': list(dict.fromkeys(r['step_id'] for r in rows if r['detail'] == TOTAL)),
        'total_entry_share': round(sum(abs(r['co2e_kg']) for r in rows if r['detail'] == TOTAL) / gross * 100, 2) if gross else 0.0,
    }


def small_row_refusal(report, step, lang='en'):
    """Why this question cannot be accepted as a small estimated row, or None when it can: its emissions are
    under 1 % of the inventory and the rows accepted this way stay within 5 % of it."""
    u = inventory_uncertainty(report)
    share = u['step_share_percent'].get(step)
    if share is None:
        return ('Bu soru henüz bir emisyon üretmedi.' if _tr(lang) else 'This question has produced no emission yet.')
    if share >= SMALL_ROW_SHARE:
        return (f'Bu kaynağın payı %{share:.2f}; yalnızca envanterin %1\'inden küçük kaynaklar bu şekilde tahmin olarak '
                f'kabul edilebilir.' if _tr(lang) else
                f'This source is {share:.2f} % of the inventory; only sources under 1 % may be accepted as an estimate '
                f'this way.')
    already = u['accepted_small_share'] - (share if any(
        r['step_id'] == step and r['source_state'] == 'accepted_small' for r in u['rows']) else 0.0)
    if already + share > SMALL_ROWS_TOTAL_SHARE:
        return (f'Bu şekilde kabul edilen kaynakların toplam payı %5\'i aşamaz (şu an %{already:.2f}).' if _tr(lang) else
                f'Sources accepted this way may not exceed 5 % of the inventory in all (now {already:.2f} %).')
    return None


def sync_data_quality_approvals(report):
    """Brings the advisor queue in line with the inventory's data-quality claims: one item per question and
    reason, created when the claim appears, removed (while still pending) when it no longer applies, and sent
    back for review when an already-decided claim changes. Returns the items created.
    A signed inventory is left as it is."""
    from .models import AdvisorApproval
    from .step_entries import question_label
    if report.signed_at is not None:
        return []
    ctx = _Context(report)
    wanted = {}
    for step in {s for s, _ in ctx.documents} | set(ctx.answers):
        source = step_source(ctx.answers, step)
        stored = ctx.answers.get(step) if isinstance(ctx.answers.get(step), dict) else {}
        if source == MEASUREMENT and (step, DOC_MEASUREMENT) in ctx.documents:
            wanted[(step, UT_MEASUREMENT)] = ('Belge', 'medium', (
                f'UT-02 · {question_label(step, "en")}: the figure is declared as a measurement (±1 %) and a '
                f'measurement record is uploaded. Review the document and approve or reject.'))
        if source == OTHER:
            wanted[(step, UT_OTHER)] = ('Veri Girişi', 'medium_high', (
                f'UT-04 · {question_label(step, "en")}: data source "other" with a hand-entered uncertainty of '
                f'±{stored.get("data_source_percent")} %. Reason given: {stored.get("data_source_reason")}'))
        if (step, DOC_SUPPLIER) in ctx.documents:
            wanted[(step, UT_SUPPLIER)] = ('Belge', 'medium', (
                f'UT-05 · {question_label(step, "en")}: a supplier declaration is uploaded for the emission factor. '
                f'Approved, the factor counts as a supplier declaration (5 %) instead of an undocumented own '
                f'factor (30 %).'))
    flagged = {}
    for r in inventory_uncertainty(report)['flagged']:
        flagged.setdefault(r['step_id'], []).append(r)
    for step, rows in flagged.items():
        worst = max(rows, key=lambda r: r['row_percent'])
        wanted[(step, UT_ROW)] = ('Tutarsızlık', 'high', (
            f'UT-03 · {question_label(step, "en")}: a row has an uncertainty of {worst["row_percent"]:.1f} % '
            f'(above {ROW_FLAG_PERCENT:.0f} %): {worst["factor"]}, activity data ±{worst["activity_percent"]:.0f} %, '
            f'emission factor ±{worst["factor_percent"]:.1f} %. Review before the result is relied on.'))
    created = []
    existing = {(a.question_id, a.reason_code): a for a in AdvisorApproval.objects.filter(
        report=report, reason_code__in=UT_CODES)}
    for key, a in existing.items():
        if key not in wanted and a.status == AdvisorApproval.Status.PENDING:
            a.delete()
    for (step, code), (category, risk, description) in wanted.items():
        a = existing.get((step, code))
        if a is None:
            created.append(AdvisorApproval.objects.create(
                report=report, question_id=step, field_id='data_quality', reason_code=code,
                trigger_category=category, risk_level=risk, description=description))
        elif a.description != description:
            # The claim changed: a decision taken on the earlier one does not cover it.
            a.description = description
            if a.status != AdvisorApproval.Status.PENDING:
                a.status, a.reviewed_by, a.reviewed_at, a.rejection_reason = AdvisorApproval.Status.PENDING, None, None, ''
            a.save()
    return created


def pending_data_quality(report):
    """The data-quality items of this inventory still waiting for the advisor."""
    from .models import AdvisorApproval
    return list(AdvisorApproval.objects.filter(report=report, reason_code__in=UT_CODES,
                                               status=AdvisorApproval.Status.PENDING).order_by('question_id'))


def signed_uncertainty(answers):
    """The uncertainty recorded with the signature (7C-2): the figures as signed, never recomputed."""
    raw = (answers or {}).get('7C-2')
    raw = raw.get('answer') if isinstance(raw, dict) and 'answer' in raw else raw
    snap = raw.get('uncertainty') if isinstance(raw, dict) else None
    return snap if isinstance(snap, dict) and 'rows' in snap else None


def source_warning(source, lang='en', state='ok'):
    """What the user is told about the source chosen (or not chosen) for a question."""
    tr = _tr(lang)
    if source == MEASUREMENT and state == 'measurement_no_document':
        return ('Ölçüm seçildi ancak ölçüm kaydı yüklenmedi: belge yüklenene kadar bu değer tahmin (±%20) olarak '
                'sayılır. Ölçüm kaydını yükleyin; danışman inceler.' if tr else
                'Measurement is chosen but no measurement record is uploaded: until it is, this figure is counted '
                'as an estimate (±20 %). Upload the record; an advisor reviews it.')
    if state == 'rejected':
        return ('Danışman bu beyanı onaylamadı: değer tahmin (±%20) olarak sayılır. Kaynağı veya belgeyi düzeltin.' if tr else
                'The advisor did not approve this claim: the figure is counted as an estimate (±20 %). Correct the '
                'source or the document.')
    if source == MEASUREMENT:
        return ('Ölçüm: faaliyet verisi belirsizliği ±%1. Ölçüm kaydı yüklendi; danışman inceler.' if tr else
                'Measurement: activity-data uncertainty ±1 %. The record is uploaded; an advisor reviews it.')
    if source == INVOICE:
        return ('Fatura / sistem verisi: faaliyet verisi belirsizliği ±%7.' if tr else
                'Invoice / system data: activity-data uncertainty ±7 %.')
    if source == OTHER:
        return ('Diğer: girdiğiniz belirsizlik uygulanır; gerekçeniz danışman onayına gider. Onaylanana kadar envanter '
                'imzalanamaz.' if tr else
                'Other: the uncertainty you entered is applied; your reason goes to the advisor for approval. The '
                'inventory cannot be signed until it is approved.')
    if source == ESTIMATE:
        return ('Tahmin: faaliyet verisi belirsizliği ±%20. Kesin olmayan bir değer envanterin doğruluğunu düşürür; '
                'girilen değerin sorumluluğu kuruluşunuza aittir.' if tr else
                'Estimate: activity-data uncertainty ±20 %. An imprecise figure lowers the accuracy of the inventory; '
                'the figure you enter is your organisation\'s responsibility.')
    return ('Veri kaynağı seçilmedi: bu değer tahmin (±%20) olarak sayılır. Değerin doğruluğu kuruluşunuzun '
            'sorumluluğundadır; fatura veya ölçüm varsa kaynağı seçin.' if tr else
            'No data source is chosen: this figure is counted as an estimate (±20 %). Its accuracy is your '
            'organisation\'s responsibility; choose the source if you have an invoice or a measurement.')
