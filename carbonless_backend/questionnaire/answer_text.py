"""
Inventory answers in words, for exports: "Soru 43 — Hangi yakıt türlerini
kullanıyor?" / "Sıcak su kazanı: Doğalgaz" instead of "3A-4" /
"EQ-3A-01: natural_gas".

The words come from data/carboniq_labels.json, generated from the survey's
own question definitions (frontend scripts/extract-carboniq-schema.mjs
--labels), so they read exactly as the user saw them.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

_LABELS_PATH = Path(__file__).resolve().parent / 'data' / 'carboniq_labels.json'
# Screens that only move through the survey ("which section to fix?") —
# not answers about the company.
NAVIGATION_TYPES = {'info', 'section_picker'}
_CODE_PREFIX = re.compile(r'^[A-Z]{2,}[A-Z0-9]*-[\w-]+\s+[—–-]\s+')
_PLACEHOLDER_PREFIX = re.compile(r'^(?:\[[^\]]*\]\s*[—–-]?\s*)+')
_YES_NO = {'yes': ('Evet', 'Yes'), 'no': ('Hayır', 'No'), 'true': ('Evet', 'Yes'),
           'false': ('Hayır', 'No'), 'none': ('Yok', 'None'), 'unknown': ('Bilinmiyor', 'Unknown'),
           'confirmed': ('Onaylandı', 'Confirmed')}


@lru_cache(maxsize=1)
def _labels():
    try:
        with open(_LABELS_PATH, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _pick(words, lang):
    if not words:
        return ''
    return words.get(lang) or words.get('en') or words.get('tr') or ''


def is_navigation(step_id):
    q = _labels().get(step_id)
    return bool(q and q.get('type') in NAVIGATION_TYPES) or step_id.endswith('-edit')


def question_title(step_id, lang='tr'):
    """'Soru 43 — Hangi yakıt türlerini kullanıyor?'; the step id when the
    question is unknown."""
    q = _labels().get(step_id)
    if not q:
        return step_id
    text = _PLACEHOLDER_PREFIX.sub('', _pick(q.get('text'), lang)).strip()
    number = q.get('number')
    head = (f'Soru {number}' if lang == 'tr' else f'Question {number}') if number not in (None, '') else step_id
    return f'{head} — {text}' if text else head


def _option(options, value, lang):
    key = str(value)
    words = (options or {}).get(key)
    if words:
        return _CODE_PREFIX.sub('', _pick(words, lang))
    yn = _YES_NO.get(key.lower()) if isinstance(value, (str, bool)) else None
    if yn:
        return yn[0] if lang == 'tr' else yn[1]
    return key


def _item_label(q, key, answers, lang, depth=0):
    """What a loop item key stands for: the equipment, fuel, category … of
    the question the loop runs over, or the facility for "1", "2" …"""
    base, _, group = str(key).partition('#')
    source_id = q.get('loopSource')
    source = _labels().get(source_id) if source_id else None
    label = base
    if source and source.get('options') and base in source['options']:
        label = _option(source['options'], base, lang)
    elif source_id == '2A-1' or (base.isdigit() and not source):
        sites = _unwrap(answers.get('2A-2'))
        name = (sites or {}).get(base, {}).get('name') if isinstance(sites, dict) else None
        label = name or ((f'Tesis {base}' if lang == 'tr' else f'Facility {base}') if base.isdigit() else base)
    elif source and source.get('loopSource') and depth < 3:
        label = _item_label(source, base, answers, lang, depth + 1)
    if group:
        label += f' ({"Grup" if lang == "tr" else "group"} {group})'
    return label


def _unwrap(v):
    if isinstance(v, dict) and set(v) == {'answer'}:
        return v['answer']
    return v


def _fields_text(q, row, lang):
    fields = q.get('fields') or {}
    parts = []
    for k, v in row.items():
        if v in (None, '', [], {}):
            continue
        f = fields.get(k) or {}
        name = _pick(f.get('label'), lang) or k
        if isinstance(v, list):
            val = ', '.join(_option(f.get('options'), x, lang) for x in v)
        else:
            val = _option(f.get('options'), v, lang)
        parts.append(f'{name}: {val}')
    return ' · '.join(parts)


def _value_text(q, value, lang):
    if isinstance(value, list):
        return ', '.join(_option(q.get('options'), v, lang) for v in value)
    if isinstance(value, dict):
        if isinstance(value.get('items'), list):  # repeatable form
            rows = [r for r in value['items'] if isinstance(r, dict)]
            return '\n'.join(_fields_text(q, r, lang) for r in rows)
        if not q.get('fields'):
            # Company-profile answers keep named keys ({'legal_name': …}).
            parts = []
            for v in value.values():
                if v in (None, '', [], {}) or isinstance(v, dict):
                    continue
                parts.append(', '.join(_option(q.get('options'), x, lang) for x in v)
                             if isinstance(v, list) else _option(q.get('options'), v, lang))
            return ' · '.join(parts)
        return _fields_text(q, value, lang)
    if isinstance(value, bool):
        return _option(None, str(value).lower(), lang)
    return _option(q.get('options'), value, lang)


def answer_text(step_id, value, answers, lang='tr'):
    """One answer in words. *answers* holds the inventory's other answers
    (facility names for "Tesis 1" …)."""
    value = _unwrap(value)
    q = _labels().get(step_id)
    if not q:
        return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    if q.get('loopSource') and isinstance(value, dict) and 'items' not in value:
        return '\n'.join(
            f'{_item_label(q, k, answers, lang)}: {_value_text(q, v, lang)}'
            for k, v in value.items() if v not in (None, '', [], {}))
    return _value_text(q, value, lang)


def sort_key(step_id):
    """Survey order: by question number ("43", "47a"), unknown ones last."""
    number = str((_labels().get(step_id) or {}).get('number') or '')
    m = re.match(r'(\d+)(.*)', number)
    return (int(m.group(1)), m.group(2)) if m else (10 ** 6, step_id)
