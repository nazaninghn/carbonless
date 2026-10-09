"""
Descriptions the system writes on entries it creates ("AI Chat: electricity
1250.5 kwh", "Questionnaire step 3A-5 · Merkez", "Workspace 3A …") are stored
as they are — the questionnaire finds its own entries by that prefix — but
are shown to people in their language: "AI sohbetinden", "Anketten — 3A-5 ·
Merkez". A description a person typed is returned unchanged.
lib/entryDescription.js does the same in the UI.
"""

_LABELS = {
    'chat': ('AI sohbetinden', 'From AI chat'),
    'questionnaire': ('Anketten', 'From the questionnaire'),
    'workspace': ('Çalışma alanından', 'From the workspace'),
}


def display_description(desc, lang, calc_detail=None):
    desc = desc or ''
    tr = lang == 'tr'
    pick = (lambda pair: pair[0] if tr else pair[1])
    if desc.startswith('AI Chat:'):
        return pick(_LABELS['chat'])
    if desc.startswith('Questionnaire step '):
        # "Anketten — Soru 68 · <how it was calculated>": the question's
        # number, not its internal step code (4A-1, K3C3-INFO).
        from questionnaire.step_entries import entry_group, question_label
        parts = [question_label(entry_group(desc), lang)]
        detail = (calc_detail or {}).get(lang) if isinstance(calc_detail, dict) else None
        if not detail and ' · ' in desc:
            detail = desc.split(' · ', 1)[1]  # an entry from before calc_detail
        if detail:
            parts.append(detail)
        return f"{pick(_LABELS['questionnaire'])} — {' · '.join(parts)}"
    if desc.startswith('Workspace '):
        tag = desc[len('Workspace '):].split(' ')[0]
        return f"{pick(_LABELS['workspace'])} — {tag}" if tag else pick(_LABELS['workspace'])
    return desc
