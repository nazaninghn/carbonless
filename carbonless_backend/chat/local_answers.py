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
    qs = _entries(company, year).filter(month=month)
    total = float(qs.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    name = _MONTH_NAMES['tr' if lang == 'tr' else 'en'][month - 1].capitalize()
    if total == 0:
        return (f'{name} {year} için kayıtlı (onaylı) emisyon verisi yok.' if lang == 'tr'
                else f'There is no approved emission data for {name} {year}.')
    by = {s: float(qs.filter(emission_factor__scope=s).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
          for s in ('scope1', 'scope2', 'scope3')}
    if lang == 'tr':
        return (f'{name} {year} emisyonunuz **{_fmt(total, lang)} tCO₂e**.\n\n'
                f'• Kapsam 1: {_fmt(by["scope1"], lang)} t\n'
                f'• Kapsam 2: {_fmt(by["scope2"], lang)} t\n'
                f'• Kapsam 3: {_fmt(by["scope3"], lang)} t')
    return (f'Your emissions for {name} {year} are **{_fmt(total, lang)} tCO₂e**.\n\n'
            f'• Scope 1: {_fmt(by["scope1"], lang)} t\n'
            f'• Scope 2: {_fmt(by["scope2"], lang)} t\n'
            f'• Scope 3: {_fmt(by["scope3"], lang)} t')


def _scope_answer(company, year, scope_n, lang):
    from django.db.models import Sum
    qs = _entries(company, year)
    total = float(qs.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    part = float(qs.filter(emission_factor__scope=f'scope{scope_n}')
                 .aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
    share = part / total * 100 if total else 0
    if lang == 'tr':
        return (f'{year} yılı Kapsam {scope_n} emisyonunuz **{_fmt(part, lang)} tCO₂e** '
                f'(toplam {_fmt(total, lang)} tCO₂e içinde %{_fmt(share, lang, 1)}).')
    return (f'Your Scope {scope_n} emissions for {year} are **{_fmt(part, lang)} tCO₂e** '
            f'({_fmt(share, lang, 1)}% of {_fmt(total, lang)} tCO₂e in total).')


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
    if total == 0:
        return (f'{year} yılı için kayıtlı emisyon verisi yok.' if lang == 'tr'
                else f'There is no emission data recorded for {year}.')
    by = {s: float(qs.filter(emission_factor__scope=s).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) / 1000
          for s in ('scope1', 'scope2', 'scope3')}
    if lang == 'tr':
        return (f'{year} yılı toplam emisyonunuz **{_fmt(total, lang)} tCO₂e**.\n\n'
                f'• Kapsam 1: {_fmt(by["scope1"], lang)} t\n'
                f'• Kapsam 2: {_fmt(by["scope2"], lang)} t\n'
                f'• Kapsam 3: {_fmt(by["scope3"], lang)} t')
    return (f'Your total emissions for {year} are **{_fmt(total, lang)} tCO₂e**.\n\n'
            f'• Scope 1: {_fmt(by["scope1"], lang)} t\n'
            f'• Scope 2: {_fmt(by["scope2"], lang)} t\n'
            f'• Scope 3: {_fmt(by["scope3"], lang)} t')


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


def _pending_answer(user, company, lang):
    from emissions.models import EmissionEntry
    from companies.models import CompanyMembership
    membership = CompanyMembership.objects.filter(user=user, company=company, is_active=True).first()
    approver = bool(membership and membership.role in ('owner', 'admin', 'manager'))
    entries = EmissionEntry.objects.filter(company=company, status='submitted')
    if not approver:
        entries = entries.filter(user=user)
    n = entries.count()
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
                    'Onay Bekleyenler sayfasından inceleyebilirsiniz.')
        return (f'Onay bekleyen {n} kaydınız var.' if n else 'Onay bekleyen kaydınız yok.')
    if approver:
        if not n and not advisor:
            return 'Nothing is waiting for your approval.'
        return (f'{n} emission entries and {advisor} advisor approvals are waiting for your approval. '
                'Review them on the Pending Review page.')
    return (f'You have {n} entries awaiting approval.' if n else 'You have no entries awaiting approval.')


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
    if _TOP_WORDS.search(text) and (_SOURCE_WORDS.search(text) or _EMISSION_WORDS.search(text)):
        return _top_source_answer(company, year, lang)
    about_emissions = _EMISSION_WORDS.search(text) or _SCOPE_RE.search(text)
    if _COMPARE_WORDS.search(text) and (about_emissions or re.search(r'durum|nasıl|nasil|doing|how are we', text, re.I)):
        return _compare_answer(company, year, lang)
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
    if lang == 'tr':
        if rate_limited:
            return '⚠️ AI kullanım sınırına ulaşıldı. Lütfen biraz sonra tekrar deneyin; bu arada verilerinizi Emisyon Yönetimi sayfasından girebilirsiniz.'
        return '⚠️ AI hizmetine şu an ulaşılamıyor. Lütfen birkaç dakika sonra tekrar deneyin; bu arada verilerinizi Emisyon Yönetimi sayfasından girebilirsiniz.'
    if rate_limited:
        return '⚠️ The AI usage limit was reached. Please try again later; meanwhile you can add data on the Emissions page.'
    return '⚠️ The AI service is unavailable right now. Please try again in a few minutes; meanwhile you can add data on the Emissions page.'
