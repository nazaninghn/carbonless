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

Not built yet (they need documents and the advisor queue): a source "other" with a hand-entered percentage,
the document a "measurement" must carry, the 5 % of an approved supplier declaration, and the suggestion of
"estimate" for rows under 1 % of the total.
"""
from decimal import Decimal
from math import sqrt

MEASUREMENT, INVOICE, ESTIMATE = 'measurement', 'invoice', 'estimate'
ACTIVITY_PERCENT = {MEASUREMENT: 1.0, INVOICE: 7.0, ESTIMATE: 20.0}
SOURCE_LABELS = {
    MEASUREMENT: {'tr': 'Ölçüm', 'en': 'Measurement'},
    INVOICE: {'tr': 'Fatura / sistem verisi', 'en': 'Invoice / system data'},
    ESTIMATE: {'tr': 'Tahmin', 'en': 'Estimate'},
}
UNSPECIFIED = ''                      # not chosen: counted as an estimate
ROW_FLAG_PERCENT = 60.0

BASE_SUPPLIER, BASE_OFFICIAL_TR, BASE_GLOBAL, BASE_OWN = 5.0, 15.0, 30.0, 30.0
ADDON_SINGLE, ADDON_MULTI, ADDON_RATIO = 0.0, 15.0, 25.0
_MULTI_UNITS = {'tonne-km', 'person-km', 'passenger-km', 'tkm', 'pkm'}
_RATIO_UNITS = {'usd', 'eur', 'try', 'nights', 'days', 'employees', 'packages', 'franchises', 'units',
                'multiplier', 'm2'}

# 3A-6 already asks, per fuel, how the stationary-fuel amount was obtained.
_FUEL_SOURCE = {'invoice_meter': INVOICE, 'engineering_estimate': ESTIMATE, 'sector_average': ESTIMATE}


def checked_data_source(step_id, data, saved_answers, lang='en'):
    """(data, error) for a calculating question's answer about to be saved: the source of its amount travels
    with the answer as `data_source`. Kept from the saved answer when a save does not repeat it; refused
    when it is not one of the sources. Not required — an answer without one is read as an estimate."""
    from .step_entries import ENTRY_STEPS
    if step_id not in ENTRY_STEPS or not isinstance(data, dict) or 'answer' not in data:
        return data, None
    chosen = data.get('data_source')
    if chosen in (None, ''):
        saved = (saved_answers or {}).get(step_id)
        chosen = saved.get('data_source') if isinstance(saved, dict) else None
    if chosen not in (None, '') and chosen not in ACTIVITY_PERCENT:
        tr = str(lang or '').lower().startswith('tr')
        return data, ('Geçersiz veri kaynağı. Ölçüm, fatura / sistem verisi veya tahmin seçin.' if tr else
                      'Invalid data source. Choose measurement, invoice / system data or estimate.')
    data = {k: v for k, v in data.items() if k != 'data_source'}
    if chosen:
        data['data_source'] = chosen
    return data, None


def step_source(answers, step_id):
    """The source recorded for a question's amount, or '' when none is."""
    stored = (answers or {}).get(step_id)
    chosen = stored.get('data_source') if isinstance(stored, dict) else None
    if chosen in ACTIVITY_PERCENT:
        return chosen
    if step_id == '3A-5':                 # the per-fuel answer of 3A-6: the least sure of them
        raw = (answers or {}).get('3A-6')
        raw = raw.get('answer') if isinstance(raw, dict) and 'answer' in raw else raw
        values = list(raw.values()) if isinstance(raw, dict) else [raw]
        mapped = [_FUEL_SOURCE[v] for v in values if v in _FUEL_SOURCE]
        if mapped:
            return ESTIMATE if ESTIMATE in mapped else INVOICE
    return UNSPECIFIED


def factor_percent(factor):
    """(u_ef, base, add-on) of an emission factor, in per cent."""
    slug, source = str(factor.slug or ''), str(factor.source or '')
    if slug.startswith('calculated-'):
        base = BASE_OWN            # CO2e from the organisation's own or a supplier's figure, no approved document yet
    elif source == 'turkey_grid':
        base = BASE_OFFICIAL_TR
    else:
        base = BASE_GLOBAL
    unit = str(factor.unit or '').strip().lower()
    addon = ADDON_MULTI if unit in _MULTI_UNITS else ADDON_RATIO if unit in _RATIO_UNITS else ADDON_SINGLE
    return sqrt(base ** 2 + addon ** 2), base, addon


def inventory_uncertainty(report):
    """The uncertainty of an inventory, from its questionnaire entries.

    {total_kg, absolute_kg, percent, low_kg, high_kg, rows: [...], flagged: [...], unspecified_steps: [...]}
    Each row: step_id, label_tr / label_en, factor, co2e_kg, source ('' = not chosen), activity_percent,
    factor_percent, row_percent, absolute_kg, flagged."""
    from emissions.inventory_scope import entries_of
    from .models import ReportStep
    from .step_entries import entry_group, question_label
    answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
    rows, unspecified = [], []
    for entry in entries_of(report).select_related('emission_factor').order_by('pk'):
        step = entry_group(entry.description)
        kg = float(entry.calculated_co2e_kg or Decimal('0'))
        if not step or not kg:
            continue
        source = step_source(answers, step)
        if not source and step not in unspecified:
            unspecified.append(step)
        u_a = ACTIVITY_PERCENT[source or ESTIMATE]
        u_ef, base, addon = factor_percent(entry.emission_factor)
        u_row = sqrt(u_a ** 2 + u_ef ** 2)
        rows.append({
            'step_id': step, 'label_tr': question_label(step, 'tr'), 'label_en': question_label(step, 'en'),
            'factor': entry.emission_factor.name, 'factor_tr': entry.emission_factor.name_tr or entry.emission_factor.name,
            'co2e_kg': round(kg, 4), 'source': source, 'activity_percent': u_a,
            'factor_base_percent': base, 'factor_addon_percent': addon, 'factor_percent': round(u_ef, 2),
            'row_percent': round(u_row, 2), 'absolute_kg': round(abs(kg) * u_row / 100, 4),
            'flagged': u_row > ROW_FLAG_PERCENT,
        })
    total = sum(r['co2e_kg'] for r in rows)
    absolute = sqrt(sum(r['absolute_kg'] ** 2 for r in rows))
    percent = (absolute / abs(total) * 100) if total else 0.0
    return {
        'total_kg': round(total, 2), 'absolute_kg': round(absolute, 2), 'percent': round(percent, 2),
        'low_kg': round(total - absolute, 2), 'high_kg': round(total + absolute, 2),
        'rows': rows, 'flagged': [r for r in rows if r['flagged']], 'unspecified_steps': unspecified,
        'row_flag_percent': ROW_FLAG_PERCENT,
    }


def source_warning(source, lang='en'):
    """What the user is told about the source chosen (or not chosen) for a question."""
    tr = str(lang or '').lower().startswith('tr')
    if source == MEASUREMENT:
        return ('Ölçüm: faaliyet verisi belirsizliği ±%1. Ölçüm kaydını saklayın; doğrulamada istenir.' if tr else
                'Measurement: activity-data uncertainty ±1 %. Keep the measurement record; a verifier will ask for it.')
    if source == INVOICE:
        return ('Fatura / sistem verisi: faaliyet verisi belirsizliği ±%7.' if tr else
                'Invoice / system data: activity-data uncertainty ±7 %.')
    if source == ESTIMATE:
        return ('Tahmin: faaliyet verisi belirsizliği ±%20. Kesin olmayan bir değer envanterin doğruluğunu düşürür; '
                'girilen değerin sorumluluğu kuruluşunuza aittir.' if tr else
                'Estimate: activity-data uncertainty ±20 %. An imprecise figure lowers the accuracy of the inventory; '
                'the figure you enter is your organisation\'s responsibility.')
    return ('Veri kaynağı seçilmedi: bu değer tahmin (±%20) olarak sayılır. Değerin doğruluğu kuruluşunuzun '
            'sorumluluğundadır; fatura veya ölçüm varsa kaynağı seçin.' if tr else
            'No data source is chosen: this figure is counted as an estimate (±20 %). Its accuracy is your '
            'organisation\'s responsibility; choose the source if you have an invoice or a measurement.')
