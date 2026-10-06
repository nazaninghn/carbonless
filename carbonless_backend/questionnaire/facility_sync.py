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


def sync_facilities(company, data):
    """Apply a 2A-2 answer to `company`'s facilities. Returns how many changed."""
    from companies.models import Facility
    if company is None:
        return 0
    rows = _rows(data)
    if not rows:
        return 0
    existing = list(Facility.objects.filter(company=company).order_by('id'))
    used = set()
    changed = 0
    for name, country in rows:
        free = [f for f in existing if f.id not in used]
        match = (next((f for f in free if f.name.strip().lower() == name.lower()), None)
                 or next((f for f in free if PLACEHOLDER.match(f.name.strip())), None))
        if match is None:
            match = Facility.objects.create(company=company, name=name, country=country)
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
        if fields:
            match.save(update_fields=fields)
            changed += 1
    return changed
