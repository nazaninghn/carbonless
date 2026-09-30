"""
"Tüm Verileri İndir" — the company's full backup: company details,
facilities, every emission entry, reduction targets, custom emission requests
and every inventory with its questionnaire answers.

JSON (default) is the machine-readable backup; ?file=xlsx gives the same
content as an Excel workbook (one sheet per part) that a person can open.
"""
from django.http import HttpResponse
from django.utils import timezone


def _inventories(company):
    from questionnaire.models import CarbonReport
    out = []
    for r in (CarbonReport.objects.filter(company=company)
              .select_related('created_by').prefetch_related('steps').order_by('reporting_year', 'id')):
        out.append({
            'id': r.id,
            'title': r.title,
            'reporting_year': r.reporting_year,
            'status': r.status,
            'created_by': (r.created_by.email or r.created_by.username) if r.created_by else None,
            'created_at': r.created_at.isoformat() if r.created_at else None,
            'answers': {s.step_id: s.answer for s in r.steps.all()},
        })
    return out


def build_backup(user, company):
    from companies.serializers import CompanySerializer, FacilitySerializer
    from .models import EmissionEntry, ReductionTarget, CustomEmissionRequest
    from .serializers import EmissionEntrySerializer, ReductionTargetSerializer, CustomEmissionRequestSerializer
    if not company:
        return {'user': user.username, 'exported_at': str(timezone.now()), 'company': None,
                'facilities': [], 'entries': [], 'targets': [], 'custom_requests': [], 'inventories': []}
    entries = (EmissionEntry.objects.filter(company=company)
               .select_related('emission_factor', 'facility', 'user').order_by('year', 'month', 'id'))
    return {
        'user': user.username,
        'exported_at': str(timezone.now()),
        'company': CompanySerializer(company).data,
        'facilities': FacilitySerializer(company.facilities.all().order_by('id'), many=True).data,
        'entries': EmissionEntrySerializer(entries, many=True).data,
        'targets': ReductionTargetSerializer(ReductionTarget.objects.filter(company=company), many=True).data,
        'custom_requests': CustomEmissionRequestSerializer(
            CustomEmissionRequest.objects.filter(company=company), many=True).data,
        'inventories': _inventories(company),
    }


# The Excel copy is for people: labels, codes, numbers and dates in the reader's
# language (the JSON backup keeps the raw values).
_COMPANY_FIELDS = [
    ('legal_entity_name', 'Şirket adı', 'Company name'),
    ('tax_number', 'Vergi no', 'Tax number'),
    ('tax_office', 'Vergi dairesi', 'Tax office'),
    ('trade_registry_number', 'Ticaret sicil no', 'Trade registry number'),
    ('country_of_headquarters', 'Merkez ülkesi', 'Headquarters country'),
    ('countries_of_operation', 'Faaliyet ülkeleri', 'Countries of operation'),
    ('nace_code', 'NACE kodu', 'NACE code'),
    ('main_activity_description', 'Ana faaliyet', 'Main activity'),
    ('registered_address', 'Kayıtlı adres', 'Registered address'),
    ('telephone', 'Telefon', 'Telephone'),
    ('website', 'İnternet sitesi', 'Website'),
    ('number_of_employees', 'Çalışan sayısı', 'Number of employees'),
    ('annual_turnover_range', 'Yıllık ciro', 'Annual turnover'),
    ('number_of_facilities', 'Tesis sayısı', 'Number of facilities'),
    ('number_of_subsidiaries', 'Bağlı şirket sayısı', 'Number of subsidiaries'),
    ('has_overseas_operations', 'Yurt dışı faaliyet', 'Overseas operations'),
    ('has_iso_14001', 'ISO 14001', 'ISO 14001'),
    ('has_iso_50001', 'ISO 50001', 'ISO 50001'),
    ('has_iso_14064_work', 'ISO 14064 çalışması', 'ISO 14064 work'),
    ('target_iso_14064_verification', 'ISO 14064 doğrulama hedefi', 'ISO 14064 verification target'),
    ('has_3rd_party_audit_plan', 'Üçüncü taraf denetim planı', 'Third-party audit plan'),
    ('is_for_financing', 'Finansman için', 'For financing'),
    ('is_due_to_export_pressure', 'İhracat baskısı nedeniyle', 'Due to export pressure'),
    ('is_for_group_reporting', 'Grup raporlaması için', 'For group reporting'),
    ('inventory_declaration_scope', 'Envanter beyan kapsamı', 'Inventory declaration scope'),
    ('environmental_regulations', 'Çevre mevzuatı', 'Environmental regulations'),
    ('certificates', 'Sertifikalar', 'Certificates'),
    ('created_at', 'Oluşturulma', 'Created'),
    ('updated_at', 'Son güncelleme', 'Last updated'),
]
_INVENTORY_STATUS = {
    'draft': ('Taslak', 'Draft'),
    'in_progress': ('Devam ediyor', 'In progress'),
    'completed': ('Tamamlandı', 'Completed'),
}
_ENTRY_STATUS = {
    'approved': ('Onaylı', 'Approved'),
    'submitted': ('Beklemede', 'Pending'),
    'draft': ('Reddedildi', 'Rejected'),
}
_MONTHS = {
    True: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos',
           'Eylül', 'Ekim', 'Kasım', 'Aralık'],
    False: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
            'September', 'October', 'November', 'December'],
}


def _text(v, tr):
    """A readable cell: yes/no for booleans, "key: value" lines for answers."""
    if v is None:
        return ''
    if isinstance(v, bool):
        return ('Evet' if v else 'Hayır') if tr else ('Yes' if v else 'No')
    if isinstance(v, dict):
        return '\n'.join(f'{k}: {_text(x, tr)}' for k, x in v.items() if x not in (None, '', [], {}))
    if isinstance(v, list):
        return ', '.join(_text(x, tr) for x in v) if all(not isinstance(x, (dict, list)) for x in v) \
            else '\n'.join(_text(x, tr) for x in v)
    return v


def _number(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return v if v is not None else ''


def _date(v, tr):
    """ISO timestamp -> 28.09.2026 12:21 (tr) / 2026-09-28 12:21."""
    from django.utils.dateparse import parse_datetime
    d = parse_datetime(str(v)) if v else None
    if not d:
        return v or ''
    d = timezone.localtime(d) if timezone.is_aware(d) else d
    return d.strftime('%d.%m.%Y %H:%M' if tr else '%Y-%m-%d %H:%M')


def _sheet(wb, title, header, rows):
    ws = wb.create_sheet(title[:31])
    ws.append(header)
    for row in rows:
        ws.append(row)
    return ws


def backup_workbook_response(data, tr):
    from openpyxl import Workbook
    from .descriptions import display_description
    from .notifications import _unit
    from .report_pdf import _CAT
    lang = 'tr' if tr else 'en'
    pick = (lambda pair: pair[0] if tr else pair[1])
    wb = Workbook()
    wb.remove(wb.active)

    company = data.get('company') or {}
    ws = wb.create_sheet('Şirket' if tr else 'Company')
    ws.append(['Alan' if tr else 'Field', 'Değer' if tr else 'Value'])
    for key, label_tr, label_en in _COMPANY_FIELDS:
        if key in company:
            value = company[key]
            value = _date(value, tr) if key.endswith('_at') else _text(value, tr)
            ws.append([label_tr if tr else label_en, value])
    ws.append([])
    ws.append(['Dışa aktarma zamanı' if tr else 'Exported at', _date(data.get('exported_at'), tr)])

    _sheet(wb, 'Tesisler' if tr else 'Facilities',
           ['Ad', 'Şehir', 'Ülke', 'Tür', 'Adres'] if tr else ['Name', 'City', 'Country', 'Type', 'Address'],
           [[f.get('name', ''), f.get('city', ''), f.get('country', ''), f.get('facility_type', ''),
             f.get('address', '')] for f in data['facilities']])

    def entry_row(e):
        scope_num = (e.get('scope') or '').replace('scope', '')
        month = e.get('month')
        kg = _number(e.get('calculated_co2e_kg'))
        return [
            e.get('year'),
            _MONTHS[tr][month - 1] if isinstance(month, int) and 1 <= month <= 12 else month,
            (e.get('emission_factor_name_tr') or e.get('emission_factor_name')) if tr else e.get('emission_factor_name'),
            (f'Kapsam {scope_num}' if tr else f'Scope {scope_num}') if scope_num else '',
            _CAT[lang].get(e.get('category'), e.get('category') or ''),
            _number(e.get('quantity')), _unit(e.get('unit') or '', lang),
            kg, kg / 1000 if isinstance(kg, float) else '',
            e.get('facility_name') or '', display_description(e.get('description'), lang),
            pick(_ENTRY_STATUS.get(e.get('status'), (e.get('status'), e.get('status')))),
            e.get('rejected_reason') if e.get('status') == 'draft' else '',
            e.get('entered_by') or '',
        ]
    _sheet(wb, 'Emisyon Kayıtları' if tr else 'Emission Entries',
           ['Yıl', 'Ay', 'Kaynak', 'Kapsam', 'Kategori', 'Miktar', 'Birim', 'kg CO2e', 'tCO2e',
            'Tesis', 'Açıklama', 'Durum', 'Red nedeni', 'Giren'] if tr else
           ['Year', 'Month', 'Source', 'Scope', 'Category', 'Quantity', 'Unit', 'kg CO2e', 'tCO2e',
            'Facility', 'Description', 'Status', 'Rejection reason', 'Entered by'],
           [entry_row(e) for e in data['entries']])

    _sheet(wb, 'Hedefler' if tr else 'Targets',
           ['Başlık', 'Baz yıl', 'Hedef yıl', 'Baz emisyon (kg CO2e)', 'Azaltma (%)'] if tr else
           ['Title', 'Base year', 'Target year', 'Base emissions (kg CO2e)', 'Reduction (%)'],
           [[t.get('title', ''), t.get('base_year'), t.get('target_year'),
             _number(t.get('base_emissions_kg')), _number(t.get('target_reduction_percent'))]
            for t in data['targets']])

    _sheet(wb, 'Envanterler' if tr else 'Inventories',
           ['Envanter', 'Yıl', 'Durum', 'Oluşturan', 'Oluşturulma'] if tr else
           ['Inventory', 'Year', 'Status', 'Created by', 'Created'],
           [[inv['title'], inv['reporting_year'] or '',
             pick(_INVENTORY_STATUS.get(inv['status'], (inv['status'], inv['status']))),
             inv['created_by'] or '', _date(inv['created_at'], tr)] for inv in data['inventories']])

    answers = []
    for inv in data['inventories']:
        for qid, ans in inv['answers'].items():
            if isinstance(ans, dict) and set(ans) == {'answer'}:
                ans = ans['answer']
            answers.append([inv['title'], inv['reporting_year'] or '', qid, _text(ans, tr)])
    ws = _sheet(wb, 'Anket Cevapları' if tr else 'Questionnaire Answers',
                ['Envanter', 'Yıl', 'Soru kodu', 'Cevap'] if tr else ['Inventory', 'Year', 'Question id', 'Answer'],
                answers)
    from openpyxl.styles import Alignment
    for cell in ws['D'][1:]:
        cell.alignment = Alignment(wrap_text=True, vertical='top')
    ws.column_dimensions['D'].width = 80

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="carbonless_yedek.xlsx"' if tr \
        else 'attachment; filename="carbonless_backup.xlsx"'
    wb.save(response)
    return response
