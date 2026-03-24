"""
Carbonless Questionnaire Flow Engine
Based on ISO 14064-1 / GHG Protocol questionnaire
Implements the conditional logic from the flowchart
"""

QUESTIONS = {
    'S1': {
        'text_tr': 'Bu karbon envanteri hangi dönemi kapsıyor?',
        'text_en': 'What period does this carbon inventory cover?',
        'type': 'single',
        'options': [
            {'key': 'C1.1', 'text_tr': 'Takvim yılı', 'text_en': 'Calendar year', 'has_input': True, 'input_type': 'year', 'input_label_tr': 'Yıl seçiniz (örn: 2024)', 'input_label_en': 'Select year (e.g. 2024)'},
            {'key': 'C1.2', 'text_tr': 'Mali yıl (başlangıç/bitiş tarihi)', 'text_en': 'Fiscal year (start/end date)', 'has_input': True, 'input_type': 'date_range', 'input_label_tr': 'Başlangıç ve bitiş tarihi', 'input_label_en': 'Start and end date'},
            {'key': 'C1.3', 'text_tr': 'Özel dönem (manuel tarih giriniz)', 'text_en': 'Custom period (enter dates manually)', 'has_input': True, 'input_type': 'date_range', 'input_label_tr': 'Başlangıç ve bitiş tarihi', 'input_label_en': 'Start and end date'},
        ],
        'next': 'S2',
    },
    'S2': {
        'text_tr': 'Rapor periyodunuz her yıl aynı şekilde mi ilerleyecek?',
        'text_en': 'Will your reporting period continue the same way every year?',
        'type': 'single',
        'options': [
            {'key': 'C2.1', 'text_tr': 'Evet', 'text_en': 'Yes'},
            {'key': 'C2.2', 'text_tr': 'Hayır', 'text_en': 'No'},
            {'key': 'C2.3', 'text_tr': 'Bilmiyorum', 'text_en': "I don't know", 'warning': True},
        ],
        'next': 'S3',
    },
    'S3': {
        'text_tr': 'Daha önce resmi bir karbon envanteri oluşturuldu mu?',
        'text_en': 'Has an official carbon inventory been created before?',
        'type': 'single',
        'options': [
            {'key': 'C3.1', 'text_tr': 'Evet', 'text_en': 'Yes'},
            {'key': 'C3.2', 'text_tr': 'Hayır', 'text_en': 'No'},
            {'key': 'C3.3', 'text_tr': 'Resmi olmayan bir çalışma yapıldı', 'text_en': 'An unofficial study was done', 'warning': True},
        ],
        'next': 'S4',
    },
    'S4': {
        'text_tr': 'Bir baz yıl (base year) belirlemek istiyor musunuz?',
        'text_en': 'Do you want to set a base year?',
        'type': 'single',
        'options': [
            {'key': 'C4.1', 'text_tr': 'Evet', 'text_en': 'Yes', 'has_input': True, 'input_type': 'year', 'input_label_tr': 'Baz yıl hangi yıl olacak?', 'input_label_en': 'What will the base year be?'},
            {'key': 'C4.2', 'text_tr': 'Hayır', 'text_en': 'No', 'warning': True},
            {'key': 'C4.3', 'text_tr': 'Emin değilim', 'text_en': "I'm not sure", 'warning': True},
        ],
        'next': 'S5',
    },
    'S5': {
        'text_tr': 'Bu envanter hangi amaçla hazırlanıyor?',
        'text_en': 'What is the purpose of this inventory?',
        'type': 'multi',
        'options': [
            {'key': 'C5.1', 'text_tr': 'ISO 14064-1 doğrulama', 'text_en': 'ISO 14064-1 verification'},
            {'key': 'C5.2', 'text_tr': 'İç raporlama', 'text_en': 'Internal reporting'},
            {'key': 'C5.3', 'text_tr': 'Grup raporlaması', 'text_en': 'Group reporting'},
            {'key': 'C5.4', 'text_tr': 'Finansman/yeşil kredi', 'text_en': 'Financing/green credit'},
            {'key': 'C5.5', 'text_tr': 'İhracat baskısı', 'text_en': 'Export pressure'},
            {'key': 'C5.6', 'text_tr': 'Diğer', 'text_en': 'Other', 'has_input': True, 'input_type': 'text', 'input_label_tr': 'Yazınız', 'input_label_en': 'Please specify'},
        ],
        'next': 'S6',
    },
    'S6': {
        'text_tr': 'Bağımsız 3. taraf doğrulaması planlanıyor mu?',
        'text_en': 'Is independent third-party verification planned?',
        'type': 'single',
        'options': [
            {'key': 'C6.1', 'text_tr': 'Evet', 'text_en': 'Yes', 'has_input': True, 'input_type': 'date', 'input_label_tr': 'Planlanan tarih', 'input_label_en': 'Planned date'},
            {'key': 'C6.2', 'text_tr': '12 ay içinde planlıyoruz', 'text_en': 'We plan within 12 months'},
            {'key': 'C6.3', 'text_tr': 'Henüz plan yok', 'text_en': 'No plan yet'},
        ],
        'next': 'S7',
        'conditional_warning': {
            'condition': lambda answers: 'C5.1' in answers.get('S5', {}).get('selected', []) and answers.get('S6', {}).get('selected') == 'C6.2',
            'text_tr': '⚠️ ISO 14064-1 doğrulama hedefleniyorken 3. taraf doğrulaması henüz planlanmamış. Bu süreç için zaman planlaması yapmanız önerilir.',
            'text_en': '⚠️ Third-party verification not yet planned while targeting ISO 14064-1. It is recommended to plan a timeline for this process.',
        },
    },
    'S7': {
        'text_tr': 'Emisyon faktörlerinde öncelikli kaynak tercihiniz var mı?',
        'text_en': 'Do you have a preferred source for emission factors?',
        'type': 'single',
        'options': [
            {'key': 'C7.1', 'text_tr': 'Ulusal kaynaklar', 'text_en': 'National sources'},
            {'key': 'C7.2', 'text_tr': 'DEFRA', 'text_en': 'DEFRA'},
            {'key': 'C7.3', 'text_tr': 'IPCC', 'text_en': 'IPCC'},
            {'key': 'C7.4', 'text_tr': 'Karışık', 'text_en': 'Mixed', 'warning': True},
            {'key': 'C7.5', 'text_tr': 'Emin değilim', 'text_en': "I'm not sure", 'warning': True},
        ],
        'next': 'S8',
    },
    'S8': {
        'text_tr': 'Rapor kamuya açık paylaşılacak mı?',
        'text_en': 'Will the report be shared publicly?',
        'type': 'single',
        'options': [
            {'key': 'C8.1', 'text_tr': 'Evet', 'text_en': 'Yes'},
            {'key': 'C8.2', 'text_tr': 'Hayır', 'text_en': 'No'},
            {'key': 'C8.3', 'text_tr': 'Henüz karar verilmedi', 'text_en': 'Not decided yet'},
        ],
        'next': 'S9',
    },
    'S9': {
        'text_tr': 'Rapor hangi dilde hazırlanacak?',
        'text_en': 'In which language will the report be prepared?',
        'type': 'single',
        'options': [
            {'key': 'C9.1', 'text_tr': 'Türkçe', 'text_en': 'Turkish'},
            {'key': 'C9.2', 'text_tr': 'İngilizce', 'text_en': 'English'},
            {'key': 'C9.3', 'text_tr': 'Çift dilli', 'text_en': 'Bilingual'},
        ],
        'next': 'DONE',
    },
}


def get_question(question_id, lang='tr'):
    """Get question data formatted for the frontend"""
    q = QUESTIONS.get(question_id)
    if not q:
        return None
    text_key = f'text_{lang}'
    options = []
    for opt in q['options']:
        o = {
            'key': opt['key'],
            'text': opt.get(f'text_{lang}', opt.get('text_en', '')),
        }
        if opt.get('has_input'):
            o['has_input'] = True
            o['input_type'] = opt['input_type']
            o['input_label'] = opt.get(f'input_label_{lang}', opt.get('input_label_en', ''))
        if opt.get('warning'):
            o['warning'] = True
        options.append(o)
    return {
        'id': question_id,
        'text': q.get(text_key, q.get('text_en', '')),
        'type': q['type'],
        'options': options,
    }


def process_answer(session_answers, question_id, answer_data):
    """
    Process an answer and return next question + any warnings.
    answer_data: {'selected': 'C1.1' or ['C5.1','C5.2'], 'input_value': '2024'}
    """
    q = QUESTIONS.get(question_id)
    if not q:
        return {'error': 'Invalid question'}

    warnings = []

    # Check option-level warnings
    selected = answer_data.get('selected', '')
    if isinstance(selected, str):
        selected_list = [selected]
    else:
        selected_list = selected

    for opt in q['options']:
        if opt['key'] in selected_list and opt.get('warning'):
            warnings.append({
                'question': question_id,
                'option': opt['key'],
                'text_tr': f"🟡 {opt.get('text_tr', '')} seçildi - bu konuda danışmanlık almanız önerilir.",
                'text_en': f"🟡 '{opt.get('text_en', '')}' selected - consulting is recommended on this topic.",
            })

    # Check conditional warnings
    cw = q.get('conditional_warning')
    if cw:
        # Build temp answers with current answer included
        temp_answers = {**session_answers, question_id: answer_data}
        try:
            if cw['condition'](temp_answers):
                warnings.append({
                    'question': question_id,
                    'text_tr': cw['text_tr'],
                    'text_en': cw['text_en'],
                })
        except Exception:
            pass

    next_q = q.get('next', 'DONE')
    return {
        'next_question': next_q,
        'warnings': warnings,
        'is_complete': next_q == 'DONE',
    }
