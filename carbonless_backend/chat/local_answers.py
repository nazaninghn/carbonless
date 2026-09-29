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
_EMISSION_WORDS = re.compile(r'emisyon|emission|karbon|carbon|co2|ayak iz|footprint', re.I)
_TOP_WORDS = re.compile(r'en (çok|cok|fazla|büyük|buyuk|yüksek|yuksek)|\b(largest|biggest|most|highest|top)\b', re.I)
_SOURCE_WORDS = re.compile(r'kaynak|source|kalem|kategori|category', re.I)
_PENDING_WORDS = re.compile(r'onay bekle|bekleyen kayıt|bekleyen kayit|pending|awaiting approval', re.I)


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
    from django.db.models import Sum
    rows = (_entries(company, year)
            .values('emission_factor__name', 'emission_factor__name_tr')
            .annotate(t=Sum('calculated_co2e_kg')).order_by('-t'))
    rows = [r for r in rows if r['t']]
    if not rows:
        return (f'{year} yılı için kayıtlı emisyon verisi yok.' if lang == 'tr'
                else f'There is no emission data recorded for {year}.')
    total = sum(float(r['t']) for r in rows)
    top = rows[0]
    name = (top['emission_factor__name_tr'] or top['emission_factor__name']) if lang == 'tr' else top['emission_factor__name']
    share = float(top['t']) / total * 100 if total else 0
    if lang == 'tr':
        return (f'{year} yılında en büyük emisyon kaynağınız **{name}**: '
                f'{_fmt(float(top["t"]) / 1000, lang)} tCO₂e (toplamın %{_fmt(share, lang, 1)}).')
    return (f'Your largest emission source in {year} is **{name}**: '
            f'{_fmt(float(top["t"]) / 1000, lang)} tCO₂e ({_fmt(share, lang, 1)}% of the total).')


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
    if _TOTAL_WORDS.search(text) and _EMISSION_WORDS.search(text):
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
