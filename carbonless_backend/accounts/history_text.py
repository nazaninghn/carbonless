"""
Change-history details (Settings → Geçmiş) in the reader's language.

ActivityLog.detail is stored once, in English factor names with raw unit
codes and plain numbers ("Natural Gas (Turkey) · 2026/09 · 1250.5 gj ·
Kanıt eklendi: fatura.pdf"). `localize_detail` rewrites it for display:
Turkish factor name, month name, unit spelling and number format in the
reader's language. Text it doesn't recognise is returned unchanged.
"""
import re

from emissions.notifications import _MONTHS, _unit

_SEGMENT = re.compile(
    r'^(?P<name>.+?) · (?P<year>\d{4})/(?P<month>\d{1,2}) · (?P<qty>-?[\d.]+) (?P<unit>\S+)(?: · (?P<note>.*))?$')
# Older rows: "Created emission entry: X", "Updated emission entry: X (12 kwh)".
_LEGACY = re.compile(r'^(?:Created|Updated) emission entry: (?P<name>.+?)(?: \((?P<qty>-?[\d.]+) (?P<unit>\S+)\))?$')
_NOTES = (
    ('Kanıt eklendi: ', 'Proof added: '),
    ('Kanıt kaldırıldı: ', 'Proof removed: '),
)


def factor_names_tr():
    from emissions.models import EmissionFactor
    names = {}
    for name, name_tr in EmissionFactor.objects.exclude(name_tr='').values_list('name', 'name_tr'):
        names.setdefault(name, name_tr)
    return names


def _number(text, tr):
    try:
        value = float(text)
    except ValueError:
        return text
    s = f'{value:,.3f}'.rstrip('0').rstrip('.')
    return s.replace(',', '\x00').replace('.', ',').replace('\x00', '.') if tr else s


def _note(note, tr):
    for tr_prefix, en_prefix in _NOTES:
        for prefix in (tr_prefix, en_prefix):
            if note.startswith(prefix):
                return (tr_prefix if tr else en_prefix) + note[len(prefix):]
    return note


def localize_detail(detail, lang, names_tr=None):
    """`detail` rewritten for a reader in `lang` ('tr' or 'en')."""
    if not detail:
        return detail
    tr = lang == 'tr'
    names = names_tr if names_tr is not None else (factor_names_tr() if tr else {})
    ln = 'tr' if tr else 'en'

    def name_of(name):
        return names.get(name, name) if tr else name

    def segment(text):
        m = _SEGMENT.match(text)
        if m:
            month = int(m['month'])
            period = f"{_MONTHS[ln][month - 1]} {m['year']}" if 1 <= month <= 12 else f"{m['year']}/{m['month']}"
            out = f"{name_of(m['name'])} · {period} · {_number(m['qty'], tr)} {_unit(m['unit'], ln)}"
            return out + (f" · {_note(m['note'], tr)}" if m['note'] else '')
        m = _LEGACY.match(text)
        if m:
            out = name_of(m['name'])
            return out + (f" · {_number(m['qty'], tr)} {_unit(m['unit'], ln)}" if m['qty'] else '')
        return text

    return ' → '.join(segment(part) for part in detail.split(' → '))
