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


def display_description(desc, lang):
    desc = desc or ''
    tr = lang == 'tr'
    pick = (lambda pair: pair[0] if tr else pair[1])
    if desc.startswith('AI Chat:'):
        return pick(_LABELS['chat'])
    if desc.startswith('Questionnaire step '):
        rest = desc[len('Questionnaire step '):].strip()
        return f"{pick(_LABELS['questionnaire'])} — {rest}" if rest else pick(_LABELS['questionnaire'])
    if desc.startswith('Workspace '):
        tag = desc[len('Workspace '):].split(' ')[0]
        return f"{pick(_LABELS['workspace'])} — {tag}" if tag else pick(_LABELS['workspace'])
    return desc
