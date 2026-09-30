"""
Checks for the organisation's contact details (telephone, website), which the
ISO 14064-1 report prints as stated. Used by Company Settings and by the
questionnaire step A7b; lib/companyFields.js applies the same rules in the UI.
"""
import re

PHONE_RE = re.compile(r'^\+?[0-9 ()./-]+$')
WEBSITE_RE = re.compile(r'^(https?://)?([^\s/.:]+\.)+[^\s/.:\d]{2,}(:\d+)?(/\S*)?$', re.IGNORECASE)

MESSAGES = {
    'invalid_phone': {
        'tr': 'Geçerli bir telefon numarası girin (örn. +90 212 555 01 23).',
        'en': 'Enter a valid phone number (e.g. +90 212 555 01 23).',
    },
    'invalid_website': {
        'tr': 'Geçerli bir internet sitesi adresi girin (örn. www.sirketiniz.com.tr).',
        'en': 'Enter a valid website address (e.g. www.yourcompany.com).',
    },
}


def phone_ok(value):
    value = (value or '').strip()
    return not value or (bool(PHONE_RE.match(value)) and 7 <= sum(ch.isdigit() for ch in value) <= 20)


def website_ok(value):
    value = (value or '').strip()
    return not value or bool(WEBSITE_RE.match(value))


def message(code, lang):
    return MESSAGES[code]['tr' if lang == 'tr' else 'en']
