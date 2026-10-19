"""
Question 2A-2 ("[Facility N] name and country") names the company's real
facilities — the ones the emissions form, Settings and the reports use.

Signup creates placeholder facilities ("Tesis 1", "Facility 2", …); the
questionnaire answers used to stay inside the questionnaire, so entries and
the ISO report kept showing the placeholders. On saving 2A-2:
- an answer naming an existing facility (same name) updates its country;
- otherwise the first unused placeholder is renamed to it;
- otherwise a new facility is created.
Nothing is ever deleted: entries may point at any facility.
"""
import re

PLACEHOLDER = re.compile(r'^(tesis|facility)\s*\d+$', re.I)
CONNECTIONS = ('transmission', 'distribution')
# Q24's "I don't know": the facility's electricity waits until it is found out.
UNKNOWN = 'unknown'


def _rows(data):
    answer = data.get('answer', data) if isinstance(data, dict) else None
    if not isinstance(answer, dict):
        return []
    def order(key):
        return (0, int(key)) if str(key).isdigit() else (1, str(key))
    rows = []
    for key in sorted(answer, key=order):
        row = answer[key]
        if isinstance(row, dict) and str(row.get('name') or '').strip():
            rows.append((str(row['name']).strip()[:255], str(row.get('country') or '').strip()[:100]))
    return rows


def _connections(data):
    """{facility name (lower): grid connection} given in a 2A-2 answer —
    '' for "I don't know". Rows that do not answer it are left out."""
    answer = data.get('answer', data) if isinstance(data, dict) else None
    out = {}
    if isinstance(answer, dict):
        for row in answer.values():
            if isinstance(row, dict) and row.get('grid_connection') in CONNECTIONS + (UNKNOWN,):
                conn = row['grid_connection']
                out[str(row.get('name') or '').strip().lower()] = '' if conn == UNKNOWN else conn
    return out


def duplicate_name(data):
    """The first facility name given twice in a 2A-2 answer (case-insensitive),
    or None. Each facility needs its own name: identical names are
    indistinguishable in the emissions form and break the per-company unique
    name rule Settings enforces."""
    seen = set()
    for name, _country in _rows(data):
        key = name.lower()
        if key in seen:
            return name
        seen.add(key)
    return None


def duplicate_message(name, lang):
    if str(lang).lower().startswith('tr'):
        return f'"{name}" adını birden fazla tesis için kullandınız. Her tesise farklı bir ad verin.'
    return f'You used the name "{name}" for more than one facility. Give each facility its own name.'


def sync_facilities(company, data, user=None, apply_connection=True):
    """Apply a 2A-2 answer to `company`'s facilities. Returns how many changed.

    The grid connection decides the official Turkish electricity factor, so it
    is applied only for a member who approves data (`apply_connection`, the
    owner's decision): a data-entry member's choice stays in the answer as a
    proposal until an approver accepts it (see proposed_connections). An
    applied change is carried into the company's other inventories and they
    are recalculated, as when it is changed in Settings."""
    from companies.models import Facility
    if company is None:
        return 0
    rows = _rows(data)
    if not rows:
        return 0
    existing = list(Facility.objects.filter(company=company).order_by('id'))
    connections = _connections(data) if apply_connection else {}
    used = set()
    changed = 0
    applied = []
    for name, country in rows:
        free = [f for f in existing if f.id not in used]
        match = (next((f for f in free if f.name.strip().lower() == name.lower()), None)
                 or next((f for f in free if PLACEHOLDER.match(f.name.strip())), None))
        if match is None:
            match = Facility.objects.create(company=company, name=name, country=country,
                                            grid_connection=connections.get(name.lower()) or '')
            existing.append(match)
            used.add(match.id)
            changed += 1
            continue
        used.add(match.id)
        fields = []
        if match.name != name:
            match.name = name
            fields.append('name')
        if country and match.country != country:
            match.country = country
            fields.append('country')
        if not match.is_active:
            match.is_active = True
            fields.append('is_active')
        conn = connections.get(name.lower())
        if conn is not None and match.grid_connection != conn:
            match.grid_connection = conn
            fields.append('grid_connection')
            applied.append((name, conn))
        if fields:
            match.save(update_fields=fields)
            changed += 1
    if user is not None:
        for name, conn in applied:
            set_connection_in_answers(company, user, name, conn)
    return changed


def proposed_connections(company):
    """{facility id: {'connection', 'year'}}: a grid connection given in Q24
    (2A-2) for a facility in Turkey that differs from the facility's own —
    entered by a data-entry member, it waits for an approver ('' = "I don't
    know"). The latest inventory's answer for a facility decides."""
    from companies.models import Facility
    from emissions.factor_lookup import facility_grid_slug
    from .models import ReportStep
    facilities = {f.name.strip().lower(): f for f in Facility.objects.filter(company=company, is_active=True)
                  if facility_grid_slug(f.country) == 'turkey-grid'}
    out, seen = {}, set()
    steps = (ReportStep.objects.filter(report__company=company, step_id='2A-2')
             .select_related('report').order_by('-report__reporting_year', '-report_id'))
    for step in steps:
        for key, conn in _connections(step.answer).items():
            fac = facilities.get(key)
            if fac is None or fac.pk in seen:
                continue
            seen.add(fac.pk)
            if conn != fac.grid_connection:
                out[fac.pk] = {'connection': conn, 'year': step.report.reporting_year}
    return out


def connection_notes(company, data, applied, lang='tr'):
    """What a Q24 save did with each Turkish facility's grid connection, for
    the person who saved it: a choice waiting for an approver, and an
    unknown connection (the electricity waits until it is found out)."""
    from companies.models import Facility
    from emissions.factor_lookup import facility_grid_slug
    tr = str(lang).lower().startswith('tr')
    labels = {'transmission': ('İletim', 'Transmission'), 'distribution': ('Dağıtım', 'Distribution')}
    facilities = {f.name.strip().lower(): f for f in Facility.objects.filter(company=company)
                  if facility_grid_slug(f.country) == 'turkey-grid'}
    notes = []
    for key, conn in _connections(data).items():
        fac = facilities.get(key)
        if fac is None:
            continue
        if not applied and conn != fac.grid_connection:
            if conn:
                label = labels[conn][0 if tr else 1]
                notes.append(
                    f'{fac.name}: şebeke bağlantısı ({label}) yönetici onaylayınca uygulanır.' if tr
                    else f'{fac.name}: the grid connection ({label}) is applied once an approver accepts it.')
            else:
                notes.append(
                    f'{fac.name}: "Bilmiyorum" seçiminiz yönetici onaylayınca uygulanır.' if tr
                    else f'{fac.name}: your "I don\'t know" is applied once an approver accepts it.')
        if not conn and not fac.grid_connection:
            notes.append(
                f'{fac.name}: şebeke bağlantı türü bilinmiyor. Elektrik şirketinden veya tesis sorumlusundan '
                'teyit alın; o zamana kadar bu tesisin elektriği hesaplanmaz, beklemede kalır.' if tr
                else f'{fac.name}: the grid connection is not known. Confirm it with the electricity company '
                'or the person responsible for the facility; until then this facility\'s electricity is not '
                'calculated and stays pending.')
    return notes


def rename_in_answers(company, old_name, new_name):
    """A facility renamed in Settings: rename it in the 2A-2 answers too, and
    refresh the text of the entries that name it. The questionnaire links each
    facility's entries by its 2A-2 name, so a name left behind there would read
    as another facility at the next save (a change waiting for approval that
    nobody made). Amounts, links and approvals are not touched."""
    from .models import CarbonReport, ReportStep
    from .step_entries import refresh_entry_text
    old_key = (old_name or '').strip().lower()
    if not old_key or old_key == (new_name or '').strip().lower():
        return 0
    changed_reports = []
    for step in ReportStep.objects.filter(report__company=company, step_id='2A-2'):
        stored = step.answer
        answer = stored.get('answer', stored) if isinstance(stored, dict) else None
        if not isinstance(answer, dict):
            continue
        hit = False
        for row in answer.values():
            if isinstance(row, dict) and str(row.get('name') or '').strip().lower() == old_key:
                row['name'] = new_name
                hit = True
        if hit:
            step.save(update_fields=['answer'])
            changed_reports.append(step.report_id)
    for report in CarbonReport.objects.filter(id__in=changed_reports):
        refresh_entry_text(report)
    return len(changed_reports)



def set_connection_in_answers(company, user, name, connection, recalculate=True):
    """A facility's grid connection chosen in Settings: write it into the 2A-2
    answers that list the facility (so the questionnaire shows it, and a later
    2A-2 save does not bring the old one back), then recalculate those
    inventories — the official Turkish factor depends on it. Recalculated as
    the user's own save (same approval rule as answering 4A-1 again).
    Declining a proposed connection only puts the facility's own back in the
    answers (`recalculate=False`): nothing calculated changes."""
    from .models import CarbonReport, ReportStep
    from .step_entries import sync_step_entries
    key = (name or '').strip().lower()
    if not key:
        return 0
    reports = []
    for step in ReportStep.objects.filter(report__company=company, step_id='2A-2'):
        stored = step.answer
        answer = stored.get('answer', stored) if isinstance(stored, dict) else None
        if not isinstance(answer, dict):
            continue
        hit = False
        for row in answer.values():
            if isinstance(row, dict) and str(row.get('name') or '').strip().lower() == key:
                if connection:
                    row['grid_connection'] = connection
                elif row.get('grid_connection'):
                    # No longer known: Q24 shows "I don't know", not a stale value.
                    row['grid_connection'] = UNKNOWN
                hit = True
        if hit:
            step.save(update_fields=['answer'])
            reports.append(step.report_id)
    if recalculate:
        for report in CarbonReport.objects.filter(id__in=reports):
            sync_step_entries(user, company, report, '4A-1')
    return len(reports)
