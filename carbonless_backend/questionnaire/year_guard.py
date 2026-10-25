"""One inventory per company and reporting year.

Emission entries are stored per company and year (not per inventory), so two
inventories of the same year share one set of numbers: saving a question in the
second silently replaced the first one's calculated entries — a signed,
completed inventory included. The rule is one inventory per company per year:

* the database refuses a second one (partial unique constraint
  `uniq_inventory_per_company_year`);
* starting one, moving one onto a covered year (question A4), restarting one,
  and any write to one whose year is shared are refused here with a 409 that
  names the inventory in the way;
* groups that already existed when the rule was introduced are flagged
  (`legacy_duplicate_year`, set by migration 0012 — nothing else is touched);
  they are exempt from the constraint, but none of their members can write
  until the duplicate is resolved (`manage.py review_duplicate_inventories`).
"""
from django.utils import timezone


class InventoryYearConflict(Exception):
    """Another inventory of the same company already covers the year."""

    def __init__(self, others, year=None):
        super().__init__(f'inventory already exists for {year}')
        self.others, self.year = others, year


def _is_locked(report):
    from .models import CarbonReport
    return bool(report.signed_at) or report.status == CarbonReport.Status.COMPLETED


def other_inventories_for_year(company_id, year, exclude_pk=None):
    """[{report_id, title, reporting_year, status, signed}] of the company's
    other inventories of `year` (empty when none, or when year/company is unknown)."""
    from .models import CarbonReport
    if not company_id or not year:
        return []
    qs = CarbonReport.objects.filter(company_id=company_id, reporting_year=year)
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    return [{'report_id': r.pk, 'title': r.title, 'reporting_year': r.reporting_year, 'status': str(r.status).lower(),
             'signed': bool(r.signed_at), 'locked': _is_locked(r)}
            for r in qs.order_by('-signed_at', '-updated_at')]


def _label(r, lang):
    name = r['title'] or str(r['reporting_year'])
    state = ({'completed': 'tamamlandı', 'in_progress': 'devam ediyor', 'draft': 'taslak'} if lang == 'tr'
             else {'completed': 'completed', 'in_progress': 'in progress', 'draft': 'draft'}).get(r['status'], r['status'])
    return f'“{name}” ({state}{", imzalı" if lang == "tr" and r["signed"] else ", signed" if r["signed"] else ""})'


def conflict_message(others, year, lang='en', moving=False):
    first = _label(others[0], lang)
    more = len(others) - 1
    if lang == 'tr':
        extra = f' (ve {more} diğeri)' if more else ''
        verb = 'Bu envanterin yılı' if moving else 'Bir envanter başlatılamaz:'
        return (f'{verb} {year} yılı için zaten bir envanter var: {first}{extra}. Bir şirket için her yıla en fazla bir '
                f'envanter olabilir; emisyon kayıtları şirkete ve yıla bağlıdır, ikinci bir envanter mevcut olanın '
                f'değerlerinin yerine geçerdi. Mevcut envanteri açın; fazlalık varsa önce onu silin.')
    extra = f' (and {more} more)' if more else ''
    return (f'{"This inventory cannot take that year: " if moving else "An inventory cannot be started: "}'
            f'{year} already has an inventory: {first}{extra}. A company can have one inventory per year — emission '
            f'entries belong to the company and year, so a second one would replace the values of the first. Open the '
            f'existing one; if there is an extra, delete it first.')


def conflict_payload(others, year, lang='en', moving=False, step=None):
    msg = conflict_message(others, year, lang, moving)
    body = {'success': False, 'code': 'inventory_exists_for_year', 'error': msg, 'bot_messages': [msg],
            'error_en': conflict_message(others, year, 'en', moving), 'error_tr': conflict_message(others, year, 'tr', moving),
            'existing': others[0], 'others': others, 'reporting_year': year}
    if step:
        body.update({'step': step, 'next_step': step})
    return body


def year_required_payload(step, lang='en'):
    msg = ('Önce raporlama yılını belirleyin (soru A4); yıl olmadan emisyon kayıtları oluşturulamaz.' if lang == 'tr'
           else 'Set the reporting year first (question A4): without a year no emission entries can be created.')
    return {'success': False, 'code': 'reporting_year_required', 'error': msg, 'bot_messages': [msg],
            'step': step, 'next_step': step}


def year_change_blocked(report, new_year, lang='en', step=None):
    """409 body when `report` already has entries and `new_year` is a different year, else None.

    Entries are stored by company and year. Moving an inventory's year would leave its entries behind in the
    old year (counted by the Dashboard, the exports and the reports, belonging to no inventory) while the new
    year had none until the next save recreated them. Moving or deleting them for the user would change approved
    numbers (and let a data-entry member remove them), so the change is refused instead; an inventory that has
    no entries yet - the normal flow - is free to choose its year."""
    old = report.reporting_year
    if not old or not report.company_id or new_year == old:
        return None
    from emissions.models import EmissionEntry
    n = EmissionEntry.objects.filter(company_id=report.company_id, year=old,
                                     description__startswith='Questionnaire step ').count()
    if not n:
        return None
    en = (f'The reporting year cannot be changed to {new_year}: this inventory already has {n} calculated '
          f'entr{"y" if n == 1 else "ies"} for {old}, and entries belong to their year. Start a new inventory for '
          f'{new_year}, or restart this one (a draft) to choose another year.')
    tr = (f'Raporlama yılı {new_year} olarak değiştirilemez: bu envanterin {old} yılı için {n} hesaplanmış kaydı var '
          f've kayıtlar yıllarına bağlıdır. {new_year} için yeni bir envanter başlatın veya başka bir yıl seçmek için '
          f'bu envanteri (taslaksa) sıfırlayın.')
    msg = tr if lang == 'tr' else en
    body = {'success': False, 'code': 'year_has_entries', 'error': msg, 'bot_messages': [msg],
            'error_en': en, 'error_tr': tr, 'entries': n, 'reporting_year': old}
    if step:
        body.update({'step': step, 'next_step': step})
    return body


def locked_payload(report, what, lang='en'):
    """409 body for an action that would reopen or rewrite a signed / completed inventory."""
    en = (f'This inventory ({report.title or report.reporting_year}) is signed/completed, so it cannot {what}. '
          f'Edit its answers one by one instead; every change is flagged as edited after signing.')
    tr = (f'Bu envanter ({report.title or report.reporting_year}) imzalı/tamamlanmış; bu işlem yapılamaz. '
          f'Cevaplarını tek tek düzenleyin; her değişiklik "imzadan sonra düzenlendi" olarak işaretlenir.')
    msg = tr if lang == 'tr' else en
    return {'success': False, 'code': 'inventory_locked', 'error': msg, 'bot_messages': [msg],
            'error_en': en, 'error_tr': tr, 'report_id': report.pk}


def log_blocked(user, company_id, others, year, what, request=None):
    """Put a refused attempt on a signed / completed inventory in the company's history —
    nothing in it changed, but somebody tried."""
    locked = [r for r in others if r['locked']]
    if not locked:
        return
    from emissions.audit import log_company_activity
    r = locked[0]
    log_company_activity(
        user, company_id, 'inventory_duplicate_blocked',
        f'{year} için {what} denemesi engellendi: {year} yılında zaten imzalı/tamamlanmış bir envanter var '
        f'({r["title"] or year}). Değerleri değişmedi.',
        f'An attempt to {what} for {year} was refused: {year} already has a signed/completed inventory '
        f'({r["title"] or year}). Its values were not changed.',
        target_type='CarbonReport', target_id=r['report_id'], request=request,
        reporting_year=year, attempted=what, at=timezone.now().isoformat())


def write_block(report, step, profile_steps, lang='en'):
    """(status, payload) when a save of `step` into `report` must be refused, else None.

    * no reporting year: only the profile steps may be saved (they set the year);
      every other step would create entries, and without a year they used to land in 2024;
    * the year is shared with another inventory: nothing may be saved until it is resolved."""
    if report.reporting_year is None:
        if step in profile_steps:
            return None
        return 409, year_required_payload(step, lang), []
    others = other_inventories_for_year(report.company_id, report.reporting_year, exclude_pk=report.pk)
    if others:
        return 409, conflict_payload(others, report.reporting_year, lang, step=step), others
    return None
