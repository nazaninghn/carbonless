"""Profile answers that would change what the company already declared.

The Company Profile steps (B1 sector, B3 employees, B4 facilities, B6
turnover, C1 subsidiaries, C2 overseas operations) write to the Company
record that sign-up and Settings also fill. They used to overwrite it
without a word: a QA user registered as NACE C10 food manufacturing became
"A — Agriculture" after one click, and "Yes, we have subsidiaries" turned a
declared 3 subsidiaries into 1.

company_conflict() names the change an answer would make; SubmitStepView
answers 409 (code "company_conflict") until the request confirms it with
confirm_company_update, and the questionnaire asks the user before resending.
Answers that agree with the record (or fill an empty one) never ask.
"""

_SIGNUP_EMPLOYEE_BAND = {
    '1-10': '1-50', '11-50': '1-50', '1-50': '1-50', '51-250': '51-250',
    '251-1000': '251-1000', '1000+': '1001-5000', '1001-5000': '1001-5000', '5000+': '5000+',
}


def _nace_letter(code):
    code = str(code or '').strip().upper().replace('NACE_', '').replace('NACE ', '')
    return code[:1] if code[:1].isalpha() else ''


def _yes_no(value, lang):
    if lang == 'tr':
        return 'Evet' if value else 'Hayır'
    return 'Yes' if value else 'No'


def _message(lang, field_tr, field_en, old, new):
    if lang == 'tr':
        return (f'Şirket profilinizde {field_tr} "{old}" olarak kayıtlı; bu cevap onu "{new}" yapacak. '
                f'Şirket bilgisi güncellensin mi? (Ayarlar → Şirket\'te de görünür.)')
    return (f'Your company profile has {field_en} as "{old}"; this answer would change it to "{new}". '
            f'Update the company record? (It also shows in Settings → Company.)')


def company_conflict(step, data, company, lang='en'):
    """{'field', 'message'} when the validated answer of a profile step would
    replace a different value already on the company; None otherwise."""
    if company is None:
        return None
    if step == 'B1':
        old, new = _nace_letter(company.nace_code), _nace_letter(data.get('nace_code'))
        if old and new and old != new:
            return {'field': 'nace_code', 'message': _message(
                lang, 'sektör (NACE)', 'the sector (NACE)', f'NACE {company.nace_code}', f'NACE {new}')}
    elif step == 'B3':
        old = _SIGNUP_EMPLOYEE_BAND.get(str(company.number_of_employees or '').strip())
        new = data.get('employee_band')
        if old and new and old != new:
            return {'field': 'number_of_employees', 'message': _message(
                lang, 'çalışan sayısı', 'the number of employees', company.number_of_employees, new)}
    elif step in ('B4', '2A-1'):
        old = company.number_of_facilities
        new = data.get('number_of_facilities')
        if old and new and int(old) != int(new):
            return {'field': 'number_of_facilities', 'message': _message(
                lang, 'tesis sayısı', 'the number of facilities', old, new)}
    elif step == 'B6':
        old, new = str(company.annual_turnover_range or '').strip(), data.get('revenue_band')
        if old and new and new != 'skip' and old != new:
            return {'field': 'annual_turnover_range', 'message': _message(
                lang, 'yıllık ciro aralığı', 'the annual turnover range', old, new)}
    elif step == 'C1':
        count, has = company.number_of_subsidiaries or 0, bool(data.get('has_subsidiaries'))
        if has != (count > 0):
            old = count if count else _yes_no(False, lang)
            return {'field': 'number_of_subsidiaries', 'message': _message(
                lang, 'bağlı ortaklık sayısı', 'the number of subsidiaries', old, _yes_no(has, lang))}
    elif step == 'C2':
        old, new = bool(company.has_overseas_operations), bool(data.get('has_international'))
        if old != new:
            return {'field': 'has_overseas_operations', 'message': _message(
                lang, 'yurt dışı faaliyet', 'overseas operations', _yes_no(old, lang), _yes_no(new, lang))}
    return None
