"""Assumptions recorded while the inventory was filled in.

Several answers mean the inventory rests on an estimate or a default rather
than measured data — a distance instead of a fuel bill, a floor-area share
instead of a building statement, the GLEC default load factor. The questions
tell the user "this will be documented as an assumption"; this module is
where that list comes from. It only reads the answers — it does not change
how anything is calculated.

Each assumption is {'step_id', 'type', 'text'} where type follows the
Assumption model: A = data gap, B = methodology choice, C = boundary decision.
"""
import datetime

from .models import ReportStep


def _value(stored):
    if isinstance(stored, dict) and set(stored.keys()) == {'answer'}:
        return stored['answer']
    return stored


def _loop_values(value):
    """{itemKey: code} of a finished per-item question (3A-6, 3B-6)."""
    if not isinstance(value, dict):
        return {}
    return {k: v for k, v in value.items() if isinstance(v, str)}


def _items(value):
    if isinstance(value, dict) and isinstance(value.get('items'), list):
        return [r for r in value['items'] if isinstance(r, dict)]
    return []


# 3A-2 fuel options (questions.js) — the per-fuel answers are keyed by these codes.
FUEL_LABELS = {
    'natural_gas': ('Doğalgaz', 'Natural gas'),
    'fuel_oil': ('Fuel oil', 'Fuel oil'),
    'diesel': ('Motorin / Dizel', 'Diesel'),
    'lpg': ('LPG', 'LPG'),
    'coal': ('Kömür', 'Coal'),
    'biomass': ('Biyokütle', 'Biomass'),
    'other_fossil': ('Diğer fosil yakıt', 'Other fossil fuel'),
}


def derive_assumptions(answers, lang='tr'):
    """answers: {step_id: stored answer}. Returns the list in survey order."""
    tr = lang != 'en'
    A = {k: _value(v) for k, v in (answers or {}).items()}
    out = []

    def add(step_id, kind, text_tr, text_en):
        out.append({'step_id': step_id, 'type': kind, 'text': text_tr if tr else text_en})

    year = (answers or {}).get('A4')
    year = year.get('reporting_year') if isinstance(year, dict) else year
    try:
        if year is not None and int(year) == datetime.date.today().year:
            add('A4', 'A',
                f'Raporlama yılı ({year}) henüz bitmedi; yılın kalan aylarının verisi tahmin içerebilir.',
                f'The reporting year ({year}) has not ended; data for its remaining months may be estimated.')
    except (TypeError, ValueError):
        pass

    fuels = _loop_values(A.get('3A-6'))
    def fuel(k):
        pair = FUEL_LABELS.get(k)
        return pair[0 if tr else 1] if pair else str(k).replace('_', ' ')
    est = [fuel(k) for k, v in fuels.items() if v == 'engineering_estimate']
    avg = [fuel(k) for k, v in fuels.items() if v == 'sector_average']
    if est:
        add('3A-6', 'A',
            f'Sabit yanma tüketimi mühendislik hesabı veya tahmine dayanıyor: {", ".join(est)}.',
            f'Stationary combustion consumption is based on an engineering calculation or estimate: {", ".join(est)}.')
    if avg:
        add('3A-6', 'A',
            f'Sabit yanma tüketimi için sektör ortalaması kullanıldı: {", ".join(avg)}.',
            f'A sector average was used for stationary combustion consumption: {", ".join(avg)}.')

    km = [k for k, v in _loop_values(A.get('3B-6')).items() if v == 'annual_km']
    if km:
        add('3B-6', 'B',
            f'{len(km)} araç tipi/grubu için yakıt yerine yıllık km girildi; tüketim ortalama yakıt tüketim faktörüyle '
            f'tahmin edildi (Seviye 2).',
            f'Annual km instead of fuel was entered for {len(km)} vehicle type(s)/group(s); consumption is estimated with an '
            f'average fuel-consumption factor (Level 2).')

    if A.get('4A-2a') == 'no':
        add('4A-2a', 'A',
            'Paylaşımlı binada şirket payı belgesi alınamadı; elektrik payı metrekare oranıyla tahmin edildi.',
            'No consumption-share document was available for the shared building; the electricity share is '
            'estimated from the floor-area ratio.')

    rows = _items(A.get('K3C4-2'))
    no_lf = [r for r in rows if str(r.get('load_factor_pct') or '').strip() == '']
    if no_lf:
        add('K3C4-2', 'A',
            f'Yukarı akış nakliyesinde {len(no_lf)} satır için doluluk oranı girilmedi; GLEC Tier 1 %50 '
            f'varsayılanı uygulandı.',
            f'No load factor was entered for {len(no_lf)} upstream transport row(s); the GLEC Tier 1 50% '
            f'default applies.')

    if A.get('K3C5-1') == 'S3':
        add('K3C5-1', 'A',
            'Atık verisi yok; faaliyetlerde oluşan atık çalışan başına tahminle hesaplandı (Seviye 3).',
            'No waste data is available; waste generated in operations is estimated per employee (Level 3).')
    if A.get('K3C6-1') == 'S3':
        add('K3C6-1', 'B',
            'İş seyahatleri yalnızca harcama verisiyle hesaplandı (Seviye 3).',
            'Business travel is calculated from spend data only (Level 3).')
    if A.get('K3C7-0') == 'estimate':
        add('K3C7-0', 'A',
            'Çalışan ulaşımı için anket yapılmadı; ulaşım modu dağılımı ve mesafeler tahmine dayanıyor.',
            'No commuting survey was carried out; the transport-mode split and distances are estimated.')

    if (A.get('K3C6-1') not in ('S1', 'S3')
            and any(r.get('travel_mode') == 'BT-10' for r in _items(A.get('K3C6-2')))):
        add('K3C6-2', 'B',
            'Otel konaklamaları Türkiye faktörüyle hesaplandı (32,1 kg CO₂e / oda-gece, DESNZ/DEFRA 2024).',
            'Hotel stays are calculated with the Turkey factor (32.1 kg CO₂e per room-night, DESNZ/DEFRA 2024).')

    declared = sorted({str(r.get('category')) for r in _items(A.get('K3C1-4a'))
                       if r.get('category') and year is not None
                       and str(r.get('year') or '').strip() == str(year)})
    if declared and A.get('K3C1-4') != 'no':
        add('K3C1-4a', 'B',
            f'Tedarikçi beyanı olan kategorilerde ({", ".join(declared)}) beyan değeri kullanıldı; '
            f'bu kategorilerin harcama / miktar bazlı genel hesabı yapılmadı.',
            f'For categories with a supplier declaration ({", ".join(declared)}) the declared value is used; '
            f'their spend / quantity based generic calculation is not made.')

    fr = A.get('K3C14-1') if isinstance(A.get('K3C14-1'), dict) else {}
    if A.get('K3C14-0') == 'yes' and fr.get('total_tco2e') not in (None, ''):
        count, reporting = fr.get('franchise_count'), fr.get('reporting_count')
        cov_tr = f'{reporting or "?"}/{count} işletmenin' if count else 'raporu olan işletmelerin'
        cov_en = f'{reporting or "?"} of {count} outlets' if count else 'the outlets with a report'
        add('K3C14-1', 'C',
            f'Franchise emisyonu yalnızca {cov_tr} raporladığı toplamdır; raporu olmayan işletmeler tahmin edilmedi.',
            f'Franchise emissions are only the total reported by {cov_en}; outlets without a report are not estimated.')

    if A.get('6A-1') == 'yes':
        names = [str(r.get('source')) for r in _items(A.get('6A-1a')) if r.get('source')]
        if names:
            add('6A-1a', 'C',
                f'Envanter sınırı dışında bırakılan kaynaklar: {", ".join(names)}.',
                f'Sources left outside the inventory boundary: {", ".join(names)}.')
    return out


def report_assumptions(report, lang='tr'):
    answers = dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))
    return derive_assumptions(answers, lang)
