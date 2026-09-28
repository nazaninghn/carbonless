"""
"Tüm Verileri İndir" — the company's full backup: company details,
facilities, every emission entry, reduction targets, custom emission requests
and every inventory with its questionnaire answers.

JSON (default) is the machine-readable backup; ?file=xlsx gives the same
content as an Excel workbook (one sheet per part) that a person can open.
"""
import json

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


def _cell(v):
    if v is None:
        return ''
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return v


def _sheet(wb, title, rows, columns):
    """rows: list of dicts; columns: [(key, header)]."""
    ws = wb.create_sheet(title[:31])
    ws.append([h for _, h in columns])
    for r in rows:
        ws.append([_cell(r.get(k)) for k, _ in columns])
    return ws


def backup_workbook_response(data, tr):
    from openpyxl import Workbook
    wb = Workbook()
    wb.remove(wb.active)

    ws = wb.create_sheet('Şirket' if tr else 'Company')
    ws.append(['Alan' if tr else 'Field', 'Değer' if tr else 'Value'])
    for k, v in (data.get('company') or {}).items():
        ws.append([k, _cell(v)])
    ws.append([])
    ws.append(['Dışa aktarma zamanı' if tr else 'Exported at', data.get('exported_at')])

    _sheet(wb, 'Tesisler' if tr else 'Facilities', data['facilities'], [
        ('name', 'Ad' if tr else 'Name'), ('city', 'Şehir' if tr else 'City'),
        ('country', 'Ülke' if tr else 'Country'), ('facility_type', 'Tür' if tr else 'Type'),
        ('address', 'Adres' if tr else 'Address')])

    _sheet(wb, 'Emisyon Kayıtları' if tr else 'Emission Entries', [
        {**e, 'source': (e.get('emission_factor_name_tr') or e.get('emission_factor_name')) if tr
         else e.get('emission_factor_name')} for e in data['entries']], [
        ('year', 'Yıl' if tr else 'Year'), ('month', 'Ay' if tr else 'Month'),
        ('source', 'Kaynak' if tr else 'Source'), ('scope', 'Kapsam' if tr else 'Scope'),
        ('category', 'Kategori' if tr else 'Category'), ('quantity', 'Miktar' if tr else 'Quantity'),
        ('unit', 'Birim' if tr else 'Unit'), ('calculated_co2e_kg', 'kg CO2e'),
        ('facility_name', 'Tesis' if tr else 'Facility'), ('description', 'Açıklama' if tr else 'Description'),
        ('status', 'Durum' if tr else 'Status'), ('rejected_reason', 'Red nedeni' if tr else 'Rejection reason'),
        ('entered_by', 'Giren' if tr else 'Entered by')])

    _sheet(wb, 'Hedefler' if tr else 'Targets', data['targets'], [
        ('title', 'Başlık' if tr else 'Title'), ('base_year', 'Baz yıl' if tr else 'Base year'),
        ('target_year', 'Hedef yıl' if tr else 'Target year'),
        ('base_emissions_kg', 'Baz emisyon (kg CO2e)' if tr else 'Base emissions (kg CO2e)'),
        ('target_reduction_percent', 'Azaltma (%)' if tr else 'Reduction (%)')])

    _sheet(wb, 'Envanterler' if tr else 'Inventories', data['inventories'], [
        ('title', 'Envanter' if tr else 'Inventory'), ('reporting_year', 'Yıl' if tr else 'Year'),
        ('status', 'Durum' if tr else 'Status'), ('created_by', 'Oluşturan' if tr else 'Created by'),
        ('created_at', 'Oluşturulma' if tr else 'Created at')])

    answers = [
        {'inventory': inv['title'], 'year': inv['reporting_year'], 'question': qid,
         'answer': (ans.get('answer', ans) if isinstance(ans, dict) and set(ans) == {'answer'} else ans)}
        for inv in data['inventories'] for qid, ans in inv['answers'].items()
    ]
    _sheet(wb, 'Anket Cevapları' if tr else 'Questionnaire Answers', answers, [
        ('inventory', 'Envanter' if tr else 'Inventory'), ('year', 'Yıl' if tr else 'Year'),
        ('question', 'Soru kodu' if tr else 'Question id'), ('answer', 'Cevap' if tr else 'Answer')])

    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="carbonless_yedek.xlsx"' if tr \
        else 'attachment; filename="carbonless_backup.xlsx"'
    wb.save(response)
    return response
