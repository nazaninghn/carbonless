"""
Answers to a few common questions about the company's own data, read straight
from the database — used when the AI service is unavailable, so the chat still
answers "what are our 2020 emissions?" instead of only apologising.

Only plain look-ups: totals by scope, the largest source and pending approvals,
using the same rules as the dashboard summary (rejected entries excluded).
Nothing is calculated here that the dashboard does not already show.
"""
import re
from datetime import datetime, timezone

_YEAR_RE = re.compile(r'\b(20\d\d)\b')

_TOTAL_WORDS = re.compile(r'toplam|total|ne kadar|how much|kaç ton|kac ton', re.I)
_EMISSION_WORDS = re.compile(r'emisyon|emission|emit|karbon|carbon|co2|ayak iz|footprint', re.I)
_TOP_WORDS = re.compile(r'en (çok|cok|fazla|büyük|buyuk|yüksek|yuksek)|\b(largest|biggest|most|highest|top)\b', re.I)
_SOURCE_WORDS = re.compile(r'kaynak|source|kalem|kategori|category', re.I)
_PENDING_WORDS = re.compile(r'onay bekle|bekleyen kayıt|bekleyen kayit|pending|awaiting approval', re.I)
_SCOPE_RE = re.compile(r'\b(?:kapsam|scope)\s*([123])\b', re.I)
_COMPARE_WORDS = re.compile(r'geçen yıl|gecen yil|önceki yıl|onceki yil|geçen seneye|last year|previous year|'
                            r'compared to|göre durum|gore durum|kıyasla|kiyasla|karşılaştır|karsilastir', re.I)
_THIS_MONTH = re.compile(r'\bbu ay\b|\bthis month\b', re.I)
_LAST_MONTH = re.compile(r'geçen ay|gecen ay|önceki ay|last month|previous month', re.I)
_MONTH_NAMES = {
    'tr': ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos',
           'eylül', 'ekim', 'kasım', 'aralık'],
    'en': ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
           'september', 'october', 'november', 'december'],
}


_TOP_N = 3


def _fmt(n, lang, digits=2):
    s = f'{n:,.{digits}f}'
    if lang == 'tr':
        s = s.replace(',', '\x00').replace('.', ',').replace('\x00', '.')
    return s


def _entries(company, year):
    from emissions.models import EmissionEntry
    # Same rule as the dashboard summary: only approved entries are part of
    # the inventory (pending and rejected ones are not counted).
    return (EmissionEntry.objects.filter(company=company, year=year)
            .filter(status='approved').select_related('emission_factor'))


def _custom_note(company, year, lang):
    """The year's approved custom requests, which the dashboard total adds
    to the entries. Said apart rather than summed in, so the answer still
    matches the entries — it said "no data" while the dashboard showed them."""
    from django.db.models import Sum
    from emissions.models import CustomEmissionRequest
    kg = float(CustomEmissionRequest.objects.filter(
        company=company, year=year, status='approved', calculated_co2e_kg__isnull=False,
        electricity_method='',
    ).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    if not kg:
        return ''
    if lang == 'tr':
        return (f'Onaylı özel talepleriniz: **{_fmt(kg / 1000, lang)} tCO₂e** '
                f'(Kontrol Paneli toplamına dahil).')
    return (f'Your approved custom requests: **{_fmt(kg / 1000, lang)} tCO₂e** '
            f'(included in the dashboard total).')


def _month_in(text, year_given):
    """(year or None, month) the question is about, or None: "bu ay", "geçen ay",
    or a month name ("Mart", "March")."""
    now = datetime.now(timezone.utc)
    if _THIS_MONTH.search(text):
        return None, now.month
    if _LAST_MONTH.search(text):
        return (now.year - 1, 12) if now.month == 1 else (None, now.month - 1)
    low = text.lower().replace('İ', 'i')
    for names in _MONTH_NAMES.values():
        for i, name in enumerate(names):
            if name == 'may':  # also an ordinary English word
                continue
            if re.search(r'\b' + name + r"(?:'?[a-zçğıöşü]*)\b", low):
                return None, i + 1
    return None


def _month_answer(company, year, month, lang):
    from django.db.models import Sum
    from emissions.inventory import ANNUAL_PREFIX
    # The questionnaire's annual amounts are stored as January; they belong
    # to no month, so they are named in a note instead.
    year_qs = _entries(company, year)
    qs = year_qs.filter(month=month).exclude(description__startswith=ANNUAL_PREFIX)
    annual = float(year_qs.filter(description__startswith=ANNUAL_PREFIX)
                   .aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    note = ''
    if annual:
        note = (f'\n\nAnketten gelen yıllık envanter ({_fmt(annual, lang)} tCO₂e) aylara dağıtılmadığı için buna dahil değil.'
                if lang == 'tr' else
                f'\n\nThe annual inventory from the questionnaire ({_fmt(annual, lang)} tCO₂e) is not split by month, so it is not included.')
    total = float(qs.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    name = _MONTH_NAMES['tr' if lang == 'tr' else 'en'][month - 1].capitalize()
    if total == 0:
        return (f'{name} {year} için kayıtlı (onaylı) aylık emisyon verisi yok.' if lang == 'tr'
                else f'There is no approved monthly emission data for {name} {year}.') + note
    by = {s: float(qs.filter(emission_factor__scope=s).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
          for s in ('scope1', 'scope2', 'scope3')}
    if lang == 'tr':
        return (f'{name} {year} emisyonunuz **{_fmt(total, lang)} tCO₂e**.\n\n'
                f'• Kapsam 1: {_fmt(by["scope1"], lang)} t\n'
                f'• Kapsam 2: {_fmt(by["scope2"], lang)} t\n'
                f'• Kapsam 3: {_fmt(by["scope3"], lang)} t') + note
    return (f'Your emissions for {name} {year} are **{_fmt(total, lang)} tCO₂e**.\n\n'
            f'• Scope 1: {_fmt(by["scope1"], lang)} t\n'
            f'• Scope 2: {_fmt(by["scope2"], lang)} t\n'
            f'• Scope 3: {_fmt(by["scope3"], lang)} t') + note


def _facility_in(company, text):
    """The company facility the message names ("Gebze Fabrika tesisinin …"), or None."""
    from companies.models import Facility
    low = text.lower()
    for facility in Facility.objects.filter(company=company):
        name = (facility.name or '').strip().lower()
        if name and name in low:
            return facility
    return None


def _facility_answer(company, year, facility, lang):
    """A facility's approved emissions of the year, and how much of the
    company's total is not tied to any facility (so it is not read as the
    facility's whole share)."""
    from django.db.models import Sum
    qs = _entries(company, year)
    total = float(qs.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    mine = qs.filter(facility=facility)
    part = float(mine.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    unassigned = float(qs.filter(facility__isnull=True).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    by = {s: float(mine.filter(emission_factor__scope=s).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
          for s in ('scope1', 'scope2', 'scope3')}
    if lang == 'tr':
        if not part:
            text = f'{year} yılında {facility.name} tesisine atanmış onaylı emisyon kaydı yok.'
        else:
            text = (f'{facility.name} tesisinin {year} emisyonu **{_fmt(part, lang)} tCO₂e**.\n\n'
                    f'• Kapsam 1: {_fmt(by["scope1"], lang)} t\n'
                    f'• Kapsam 2: {_fmt(by["scope2"], lang)} t\n'
                    f'• Kapsam 3: {_fmt(by["scope3"], lang)} t')
        if unassigned:
            text += (f'\n\nŞirketin {year} toplamı {_fmt(total, lang)} tCO₂e; bunun {_fmt(unassigned, lang)} tCO₂e\'si '
                     'tesis bazında değil şirket geneli için girildiğinden hiçbir tesise atanmamıştır.')
        return text
    if not part:
        text = f'There are no approved emission entries assigned to {facility.name} for {year}.'
    else:
        text = (f'{facility.name} emitted **{_fmt(part, lang)} tCO₂e** in {year}.\n\n'
                f'• Scope 1: {_fmt(by["scope1"], lang)} t\n'
                f'• Scope 2: {_fmt(by["scope2"], lang)} t\n'
                f'• Scope 3: {_fmt(by["scope3"], lang)} t')
    if unassigned:
        text += (f'\n\nThe company total for {year} is {_fmt(total, lang)} tCO₂e; {_fmt(unassigned, lang)} tCO₂e of it '
                 'was entered for the company as a whole, not per facility, so it is not assigned to any facility.')
    return text


def _scope_answer(company, year, scope_n, lang):
    from django.db.models import Sum
    qs = _entries(company, year)
    total = float(qs.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    part = float(qs.filter(emission_factor__scope=f'scope{scope_n}')
                 .aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    share = part / total * 100 if total else 0
    market = _market_result(company, year) if scope_n == 2 else None
    if lang == 'tr':
        text = (f'{year} yılı Kapsam {scope_n} emisyonunuz **{_fmt(part, lang)} tCO₂e** '
                f'(toplam {_fmt(total, lang)} tCO₂e içinde %{_fmt(share, lang, 1)}).')
        if market and market['has_instrument']:
            text += (f' Bu konum bazlı sonuçtur; piyasa bazlı sonuç ayrıca '
                     f'{_fmt(market["total_kg"] / 1000, lang)} tCO₂e (toplama eklenmez).')
        return text
    text = (f'Your Scope {scope_n} emissions for {year} are **{_fmt(part, lang)} tCO₂e** '
            f'({_fmt(share, lang, 1)}% of {_fmt(total, lang)} tCO₂e in total).')
    if market and market['has_instrument']:
        text += (f' This is the location-based result; the market-based result is separately '
                 f'{_fmt(market["total_kg"] / 1000, lang)} tCO₂e (not added).')
    return text


_MARKET_RE = re.compile(r'piyasa[\s-]*baz|market[\s-]*based', re.I)


def _market_result(company, year):
    """The market-based Scope 2 of the company's inventory of `year` (the
    figure the ISO report states next to Category II), or None."""
    from questionnaire.models import CarbonReport
    from questionnaire.step_entries import recorded_connections, scope2_market_based
    report = (CarbonReport.objects.filter(company=company, reporting_year=year)
              .order_by('-updated_at').first())
    if report is None:
        return None
    with recorded_connections(report):
        return scope2_market_based(dict(report.steps.values_list('step_id', 'answer')), year, company)


def _market_answer(company, year, lang):
    from django.db.models import Sum
    m = _market_result(company, year)
    scope2 = _entries(company, year).filter(emission_factor__scope='scope2')
    location = float(scope2.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    # The market-based result covers purchased electricity only: its
    # location-based counterpart, so the two are compared like for like.
    location_el = float(scope2.filter(emission_factor__category='electricity')
                        .aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    if not m:
        return (f'{year} için piyasa bazlı Kapsam 2 hesaplanamıyor: bu sonuç envanterin elektrik sorusundan '
                f'(Soru 68) hesaplanır ve {year} envanterinde elektrik tüketimi yok.'
                if lang == 'tr' else
                f'No market-based Scope 2 for {year}: it is calculated from the inventory\'s electricity '
                f'question (Q68), and the {year} inventory has no electricity consumption.')
    t = m['total_kg'] / 1000
    if lang == 'tr':
        text = (f'{year} piyasa bazlı Kapsam 2 sonucunuz **{_fmt(t, lang)} tCO₂e** — ayrıca raporlanır, '
                f'toplamlara eklenmez. Envanter toplamındaki Kapsam 2 konum bazlıdır: {_fmt(location, lang)} tCO₂e'
                + (f' (satın alınan elektrik: {_fmt(location_el, lang)} tCO₂e).' if abs(location - location_el) > 1e-9 else '.'))
        if m['rows'] and not m['has_instrument']:
            text += (' Tedarikçi beyanı veya onaylı piyasa bazlı faktör olmadığından piyasa bazlı sonuç '
                     'konum bazlı faktörlerle hesaplandı.')
        waiting = len(m.get('pending_connection') or [])
        if len(m['missing']) - waiting:
            text += f' Faktörü olmayan {len(m["missing"]) - waiting} elektrik kaydı bu sonuçta da hesaplanmadı.'
        if waiting:
            text += (f' Şebeke bağlantı türü seçilmemiş {waiting} tesisin elektriği bu sonuçta da hesaplanmadı; '
                     f'bağlantı türünü Ayarlar › Tesisler\'den seçin.')
        return text
    text = (f'Your market-based Scope 2 for {year} is **{_fmt(t, lang)} tCO₂e** — reported separately, not '
            f'added to the totals. Scope 2 in the inventory total is location-based: {_fmt(location, lang)} tCO₂e'
            + (f' (purchased electricity: {_fmt(location_el, lang)} tCO₂e).' if abs(location - location_el) > 1e-9 else '.'))
    if m['rows'] and not m['has_instrument']:
        text += (' With no supplier declaration or approved market-based factor, the market-based result uses '
                 'the location-based factors.')
    waiting = len(m.get('pending_connection') or [])
    if len(m['missing']) - waiting:
        text += f' {len(m["missing"]) - waiting} electricity record(s) without a factor are not calculated in it either.'
    if waiting:
        text += (f' The electricity of {waiting} facilit{"y" if waiting == 1 else "ies"} with no grid connection '
                 f'chosen is not calculated in it either; choose it in Settings › Facilities.')
    return text


def _compare_answer(company, year, lang):
    from django.db.models import Sum
    cur = float(_entries(company, year).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    prev = float(_entries(company, year - 1).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    if not prev:
        return (f'{year - 1} yılı için kayıtlı emisyon verisi olmadığından karşılaştırma yapılamıyor. '
                f'{year} toplamı: {_fmt(cur, lang)} tCO₂e.' if lang == 'tr'
                else f'There is no emission data for {year - 1} to compare with. '
                     f'{year} total: {_fmt(cur, lang)} tCO₂e.')
    change = (cur - prev) / prev * 100
    if lang == 'tr':
        way = 'arttı' if change > 0 else 'azaldı' if change < 0 else 'değişmedi'
        return (f'{year} toplamınız **{_fmt(cur, lang)} tCO₂e**, {year - 1} toplamınız '
                f'{_fmt(prev, lang)} tCO₂e: emisyonunuz %{_fmt(abs(change), lang, 1)} {way}.')
    way = 'up' if change > 0 else 'down' if change < 0 else 'unchanged'
    return (f'Your {year} total is **{_fmt(cur, lang)} tCO₂e** against {_fmt(prev, lang)} tCO₂e in '
            f'{year - 1}: {way} {_fmt(abs(change), lang, 1)}%.')


def _total_answer(company, year, lang):
    from django.db.models import Sum
    qs = _entries(company, year)
    total = float(qs.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    custom = _custom_note(company, year, lang)
    if total == 0:
        if custom:
            return (f'{year} yılı için onaylı emisyon kaydı yok. {custom}' if lang == 'tr'
                    else f'There are no approved emission entries for {year}. {custom}')
        return (f'{year} yılı için kayıtlı emisyon verisi yok.' if lang == 'tr'
                else f'There is no emission data recorded for {year}.')
    by = {s: float(qs.filter(emission_factor__scope=s).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
          for s in ('scope1', 'scope2', 'scope3')}
    if lang == 'tr':
        answer = (f'{year} yılı toplam emisyonunuz **{_fmt(total, lang)} tCO₂e**.\n\n'
                  f'• Kapsam 1: {_fmt(by["scope1"], lang)} t\n'
                  f'• Kapsam 2: {_fmt(by["scope2"], lang)} t\n'
                  f'• Kapsam 3: {_fmt(by["scope3"], lang)} t')
    else:
        answer = (f'Your total emissions for {year} are **{_fmt(total, lang)} tCO₂e**.\n\n'
                  f'• Scope 1: {_fmt(by["scope1"], lang)} t\n'
                  f'• Scope 2: {_fmt(by["scope2"], lang)} t\n'
                  f'• Scope 3: {_fmt(by["scope3"], lang)} t')
    return answer + (f'\n\n{custom}' if custom else '')


def _top_source_answer(company, year, lang):
    """The year's total and its largest sources (three, or the number asked
    for: "en büyük 5 kaynak") — "toplam ve en büyük 3 kaynak" used to get
    only the single largest one."""
    from django.db.models import Sum
    rows = (_entries(company, year)
            .values('emission_factor__name', 'emission_factor__name_tr')
            .annotate(t=Sum('calculated_co2e_kg')).order_by('-t'))
    rows = [r for r in rows if r['t']]
    if not rows:
        custom = _custom_note(company, year, lang)
        if custom:
            return (f'{year} yılı için onaylı emisyon kaydı yok. {custom}' if lang == 'tr'
                    else f'There are no approved emission entries for {year}. {custom}')
        return (f'{year} yılı için kayıtlı emisyon verisi yok.' if lang == 'tr'
                else f'There is no emission data recorded for {year}.')
    total = sum(float(r['t']) for r in rows)
    lines = []
    for i, r in enumerate(rows[:_TOP_N], 1):
        name = (r['emission_factor__name_tr'] or r['emission_factor__name']) if lang == 'tr' else r['emission_factor__name']
        share = float(r['t']) / total * 100 if total else 0
        lines.append(f'{i}. **{name}**: {_fmt(float(r["t"]) / 1000, lang)} tCO₂e '
                     + (f'(%{_fmt(share, lang, 1)})' if lang == 'tr' else f'({_fmt(share, lang, 1)}%)'))
    if lang == 'tr':
        head = (f'{year} yılı toplam emisyonunuz **{_fmt(total / 1000, lang)} tCO₂e**. '
                f'En büyük {len(lines)} kaynağınız:' if len(lines) > 1 else
                f'{year} yılı toplam emisyonunuz **{_fmt(total / 1000, lang)} tCO₂e**. En büyük kaynağınız:')
    else:
        head = (f'Your total emissions for {year} are **{_fmt(total / 1000, lang)} tCO₂e**. '
                + (f'Your {len(lines)} largest sources:' if len(lines) > 1 else 'Your largest source:'))
    return head + '\n\n' + '\n'.join(lines)


def _pending_line(e, lang):
    from emissions.notifications import _describe, _qty
    if e.delete_requested:
        kind = 'silme talebi' if lang == 'tr' else 'deletion request'
        return f'- {_describe(e, lang)} — {kind}'
    old = e.replaces_entry if e.replaces_entry_id else None
    if old is not None:
        kind = 'değişiklik' if lang == 'tr' else 'change'
        return f'- {_describe(e, lang)} — {kind} ({_qty(old, lang)} → {_qty(e, lang)})'
    kind = 'yeni' if lang == 'tr' else 'new'
    return f'- {_describe(e, lang)} — {kind}'


_LIST_MAX = 5


def _pending_answer(user, company, lang):
    """What is waiting: the count, and up to five of them by name — new
    entries, changes to approved ones and deletion requests told apart."""
    from django.db.models import Q
    from emissions.models import EmissionEntry
    from companies.models import CompanyMembership
    membership = CompanyMembership.objects.filter(user=user, company=company, is_active=True).first()
    approver = bool(membership and membership.role in ('owner', 'admin', 'manager'))
    entries = (EmissionEntry.objects
               .filter(Q(status='submitted') | Q(status='approved', delete_requested=True), company=company)
               .select_related('emission_factor', 'replaces_entry__emission_factor')
               .order_by('-created_at'))
    if not approver:
        entries = entries.filter(user=user)
    n = entries.count()
    lines = [_pending_line(e, lang) for e in entries[:_LIST_MAX]]
    more = n - len(lines)
    if more > 0:
        lines.append(f'- … ve {more} kayıt daha' if lang == 'tr' else f'- … and {more} more')
    listing = ('\n\n' + '\n'.join(lines)) if lines else ''
    advisor = 0
    if approver:
        from questionnaire.models import AdvisorApproval
        advisor = AdvisorApproval.objects.filter(
            report__company=company, status=AdvisorApproval.Status.PENDING).count()
    if lang == 'tr':
        if approver:
            if not n and not advisor:
                return 'Onayınızı bekleyen kayıt yok.'
            return (f'Onayınızı bekleyen {n} emisyon kaydı ve {advisor} danışman onayı var. '
                    'Onay Bekleyenler sayfasından inceleyebilirsiniz.') + listing
        return (f'Onay bekleyen {n} kaydınız var.' + listing) if n else 'Onay bekleyen kaydınız yok.'
    if approver:
        if not n and not advisor:
            return 'Nothing is waiting for your approval.'
        return (f'{n} emission entries and {advisor} advisor approvals are waiting for your approval. '
                'Review them on the Pending Review page.') + listing
    return (f'You have {n} entries awaiting approval.' + listing) if n else 'You have no entries awaiting approval.'


# A source named in a question ("Nisan elektrik tüketimim ne kadardı?").
_SOURCES = [
    (re.compile(r'elektri|electric', re.I), {'category': 'electricity'}, ('Elektrik', 'Electricity')),
    (re.compile(r'doğal ?gaz|dogal ?gaz|natural gas', re.I), {'name_any': ('natural gas', 'doğal gaz', 'dogal gaz')}, ('Doğal gaz', 'Natural gas')),
    (re.compile(r'dizel|motorin|diesel', re.I), {'name_any': ('diesel', 'dizel', 'motorin')}, ('Dizel', 'Diesel')),
    (re.compile(r'benzin|gasoline|petrol', re.I), {'name_any': ('gasoline', 'petrol', 'benzin')}, ('Benzin', 'Petrol')),
    (re.compile(r'\blpg\b', re.I), {'name_any': ('lpg',)}, ('LPG', 'LPG')),
    (re.compile(r'\bsu\b|su tüketim|water', re.I), {'category': 'water'}, ('Su', 'Water')),
]
_QUESTION_WORDS = re.compile(r'ne kadar|kaç|kac|nedir|neydi|how much|how many|what (was|is)', re.I)
_DELETE_WORDS = re.compile(r'\bsil(?:|in|iniz|er misin|ebilir|mek|eyim)\b|kaldır|kaldir|\bdelete\b|\bremove\b', re.I)
_CHANGE_WORDS = re.compile(r'düzelt|duzelt|değiştir|degistir|güncelle|guncelle|\bcorrect\b|\bchange\b|\bupdate\b|\bedit\b', re.I)
_RECORD_WORDS = re.compile(r'kayıt|kayit|kayd|\bentry\b|\bentries\b|\brecord', re.I)


def _source_in(text):
    for rx, flt, labels in _SOURCES:
        if rx.search(text):
            return flt, labels
    return None


def _source_filter(qs, flt):
    from django.db.models import Q
    if 'category' in flt:
        return qs.filter(emission_factor__category=flt['category'])
    q = Q()
    for w in flt['name_any']:
        q |= Q(emission_factor__name__icontains=w) | Q(emission_factor__name_tr__icontains=w)
    return qs.filter(q)


def entry_change_request(user, content, lang):
    """(text, link) when the message asks the chat to delete or correct a
    saved entry ("Mayıs elektrik kaydını sil", "Nisan kaydını düzelt"): the
    chat can't do that, so it says where it is done instead of answering
    as if it had. A correction that carries the new figure ("4000 değil
    3500") is left to the entry card, which offers to change the existing
    entry. None otherwise."""
    from companies.utils import get_current_company
    text = content or ''
    deleting = bool(_DELETE_WORDS.search(text))
    changing = bool(_CHANGE_WORDS.search(text)) and not re.search(r'\d{2,}', re.sub(r'\b20\d\d\b', '', text))
    if not (deleting or changing):
        return None
    month = _month_in(text, False)
    if not (_RECORD_WORDS.search(text) or month or _source_in(text)):
        return None
    if not get_current_company(user):
        return None
    lang = 'tr' if lang == 'tr' else 'en'
    m = _YEAR_RE.search(text)
    year = int(m.group(1)) if m else datetime.now(timezone.utc).year
    link = {'href': f'/dashboard?tab=emissions&year={year}',
            'label': f'Emisyon Yönetimi · {year}' if lang == 'tr' else f'Emissions · {year}'}
    if lang == 'tr':
        what = 'silmek' if deleting else 'düzeltmek'
        text_out = (f'Sohbetten kayıt {"silemiyorum" if deleting else "değiştiremiyorum"}. Kaydı {what} için '
                    f'Emisyon Yönetimi\'nde ilgili satırdaki {"çöp kutusu" if deleting else "kalem"} simgesini kullanın. '
                    'Onaylı bir kaydı veri giriş rolüyle değiştirir veya silerseniz istek onaya gider; '
                    'onaylanana kadar mevcut değer toplamlarda kalır.'
                    + ('' if deleting else ' Yeni değeri buraya yazarsanız ("Nisan elektrik 3500 kWh") mevcut kaydı değiştirmeyi de önerebilirim.'))
    else:
        text_out = (f'I can\'t {"delete" if deleting else "change"} entries from the chat. To {"delete" if deleting else "correct"} it, '
                    f'use the {"bin" if deleting else "pencil"} icon on its row in Emissions. '
                    'If you have the data-entry role, a change or deletion of an approved entry goes for approval; '
                    'until then the current value stays in the totals.'
                    + ('' if deleting else ' If you write the new figure here ("April electricity 3500 kWh"), I can offer to change the existing entry.'))
    return text_out, link


def _source_month_answer(company, year, month, flt, labels, lang):
    """A source's amount in a month ("Nisan elektrik ne kadardı?"): the
    approved figure, and what is waiting on it."""
    from django.db.models import Sum
    from emissions.inventory import ANNUAL_PREFIX
    from emissions.models import EmissionEntry
    from emissions.notifications import _unit
    qs = _source_filter(EmissionEntry.objects.filter(company=company, year=year, month=month)
                        .exclude(description__startswith=ANNUAL_PREFIX), flt).select_related('emission_factor')
    approved = qs.filter(status='approved')
    label = labels[0] if lang == 'tr' else labels[1]
    name = _MONTH_NAMES['tr' if lang == 'tr' else 'en'][month - 1].capitalize()
    rows = list(approved.values('emission_factor__unit').annotate(q=Sum('quantity'), t=Sum('calculated_co2e_kg')))
    waiting = qs.filter(status='submitted').count()
    deleting = approved.filter(delete_requested=True).count()
    if not rows:
        out = (f'{name} {year} için onaylı {label.lower()} kaydı yok.' if lang == 'tr'
               else f'There is no approved {label.lower()} entry for {name} {year}.')
    else:
        amounts = ', '.join(f"{_fmt(float(r['q']), lang, 0)} {_unit(r['emission_factor__unit'], lang)}" for r in rows)
        t = sum(float(r['t'] or 0) for r in rows) / 1000
        out = (f'{name} {year} {label.lower()}: **{amounts}** ({_fmt(t, lang)} tCO₂e, onaylı).' if lang == 'tr'
               else f'{label} in {name} {year}: **{amounts}** ({_fmt(t, lang)} tCO₂e, approved).')
    notes = []
    if waiting:
        notes.append(f'{waiting} kayıt/değişiklik onay bekliyor' if lang == 'tr' else f'{waiting} entry/change awaiting approval')
    if deleting:
        notes.append(f'{deleting} silme talebi var' if lang == 'tr' else f'{deleting} deletion request pending')
    if notes:
        out += (' ' + '; '.join(notes) + (' — onaylanana kadar onaylı değer geçerli.' if lang == 'tr'
                                           else ' — until approved, the approved figure stands.'))
    return out


def direct_data_answer(user, content, lang):
    """The look-ups answered from the database even when the AI is up — a
    month's figure for a named source, and the list of what is waiting for
    approval — where a guess would be worse than the stored data. None for
    anything else (and for a message carrying an amount: that is data entry)."""
    from companies.utils import get_current_company
    text = content or ''
    if re.search(r'\d{3,}', re.sub(r'\b(19|20)\d\d\b', '', text)):
        return None
    company = get_current_company(user)
    if not company:
        return None
    lang = 'tr' if lang == 'tr' else 'en'
    m = _YEAR_RE.search(text)
    year = int(m.group(1)) if m else datetime.now(timezone.utc).year
    if _PENDING_WORDS.search(text):
        return _pending_answer(user, company, lang)
    source = _source_in(text)
    if source and _QUESTION_WORDS.search(text):
        month = _month_in(text, bool(m))
        if month:
            return _source_month_answer(company, month[0] or year, month[1], source[0], source[1], lang)
    return None


def local_data_answer(user, content, lang):
    """A database answer for a simple question about the company's own data,
    or None when the message is not one of those questions."""
    from companies.utils import get_current_company
    lang = 'tr' if lang == 'tr' else 'en'
    text = content or ''
    company = get_current_company(user)
    if not company:
        return None
    m = _YEAR_RE.search(text)
    year = int(m.group(1)) if m else datetime.now(timezone.utc).year
    if _PENDING_WORDS.search(text):
        return _pending_answer(user, company, lang)
    source = _source_in(text)
    if source and _QUESTION_WORDS.search(text):
        month = _month_in(text, bool(m))
        if month:
            return _source_month_answer(company, month[0] or year, month[1], source[0], source[1], lang)
    if _TOP_WORDS.search(text) and (_SOURCE_WORDS.search(text) or _EMISSION_WORDS.search(text)):
        return _top_source_answer(company, year, lang)
    about_emissions = _EMISSION_WORDS.search(text) or _SCOPE_RE.search(text)
    if _MARKET_RE.search(text) and (about_emissions or _TOTAL_WORDS.search(text)):
        return _market_answer(company, year, lang)
    if _COMPARE_WORDS.search(text) and (about_emissions or re.search(r'durum|nasıl|nasil|doing|how are we', text, re.I)):
        return _compare_answer(company, year, lang)
    facility = _facility_in(company, text)
    if facility and about_emissions:
        return _facility_answer(company, year, facility, lang)
    if _TOTAL_WORDS.search(text) and about_emissions:
        month = _month_in(text, bool(m))
        if month:
            return _month_answer(company, month[0] or year, month[1], lang)
        scope = _SCOPE_RE.search(text)
        if scope:
            return _scope_answer(company, year, int(scope.group(1)), lang)
        return _total_answer(company, year, lang)
    return None


def ai_unavailable_text(lang, rate_limited=False):
    # Even when the AI can't answer free-form questions, the user can still log
    # emissions by typing an amount + activity (handled by the local parser).
    # Surface that as an actionable next step rather than a bare apology.
    if lang == 'tr':
        log_hint = ('Serbest sorulara şu an yanıt veremesem de, bir miktar ve faaliyet yazarak '
                    '("14000 kWh of electricity" gibi) emisyon kaydetmeye devam edebilirsiniz; '
                    'ayrıca verilerinizi Emisyon Yönetimi sayfasından da girebilirsiniz.')
        if rate_limited:
            return '⚠️ AI kullanım sınırına ulaşıldı. Lütfen biraz sonra tekrar deneyin. ' + log_hint
        return '⚠️ AI hizmetine şu an ulaşılamıyor. Lütfen birkaç dakika sonra tekrar deneyin. ' + log_hint
    log_hint = ('I can\'t answer free-form questions right now, but you can still log emissions by '
                'typing an amount and activity (e.g. "14000 kWh of electricity"); '
                'you can also add data on the Emissions page.')
    if rate_limited:
        return '⚠️ The AI usage limit was reached. Please try again later. ' + log_hint
    return '⚠️ The AI service is unavailable right now. Please try again in a few minutes. ' + log_hint
