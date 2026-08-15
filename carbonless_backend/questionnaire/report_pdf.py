"""
Carbon Inventory Profile Report — generated from the 137-question CarbonIQ
questionnaire (CarbonReport / ReportStep), not from logged EmissionEntry rows.

emissions/report_pdf.py already produces a polished ISO 14064-1 report driven
entirely by quantified EmissionEntry data — this module is the counterpart for
the *qualitative* organizational/boundary profile a completed questionnaire
actually captures (company profile, reporting framework, boundary approach,
corporate structure, section completion). It reuses that module's fonts,
styles, colors, table helpers and page template rather than re-implementing
them, so both PDFs stay visually consistent.

If quantified emissions exist for the reporting year (auto-created from
Scope 1/2/3 questionnaire answers via _create_entry_from_questionnaire, or
logged separately via Chat/manual entry — see views.py), Section 5 reports
the real Scope 1/2/3 totals using the exact same aggregation this app's
existing report already uses. No new calculation logic is introduced here.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable, NextPageTemplate,
)
from django.db.models import Sum

from emissions.report_pdf import (
    _fonts, _styles, _tbl_style, _total_row_style, _fmt, _fmt4, _pct,
    _ReportDocTemplate, _scope_pie_chart,
    BRAND_DARK, OLIVE, OLIVE_DARK, OLIVE_LIGHT, CREAM, CREAM_LIGHT,
    GRAY_50, GRAY_100, GRAY_200, GRAY_400, GRAY_600, GRAY_800, WHITE,
    SCOPE1_COLOR, SCOPE1_BG, SCOPE2_COLOR, SCOPE2_BG, SCOPE3_COLOR, SCOPE3_BG,
    WARN_AMBER, WARN_BG,
    _CAT,
)
from .step_handlers import NACE_CLUSTER
from .models import CarbonReport, ReportStep

try:
    from emissions.models import EmissionEntry, CustomEmissionRequest
except ImportError:
    EmissionEntry = None
    CustomEmissionRequest = None


# ═══════════════════════════════════════════════════════
# LABEL MAPS — presentation only, mirrors choice values already stored on
# CarbonReport/Company (see models.py), not questionnaire branching logic.
# ═══════════════════════════════════════════════════════
EF_DATABASE_LABELS = {
    'DEFRA': 'DEFRA 2023',
    'DEFRA_TUIK': 'DEFRA + TÜİK',
    'IPCC_AR6': 'IPCC AR6 2021',
    'EPA': 'EPA',
    'custom': {'tr': 'Özel Kaynak', 'en': 'Custom Source'},
}
BOUNDARY_LABELS = {
    'operational_control': {'tr': 'Operasyonel Kontrol', 'en': 'Operational Control'},
    'financial_control': {'tr': 'Finansal Kontrol', 'en': 'Financial Control'},
    'equity_share': {'tr': 'Hisse Payı Yaklaşımı', 'en': 'Equity Share Approach'},
}
SCOPE3_APPROACH_LABELS = {
    'materiality': {'tr': 'Önemlilik Bazlı (Materiality)', 'en': 'Materiality-Based'},
    'full': {'tr': 'Tüm 15 Kategori', 'en': 'Full 15 Categories'},
}
PURPOSE_LABELS = {
    'internal': {'tr': 'İç yönetim stratejisi', 'en': 'Internal management strategy'},
    'legal': {'tr': 'Yasal yükümlülük', 'en': 'Legal/regulatory obligation'},
    'voluntary': {'tr': 'Gönüllü kamuya açıklama', 'en': 'Voluntary public disclosure'},
    'client': {'tr': 'Müşteri talebi', 'en': 'Customer/client request'},
}
NACE_CLUSTER_LABELS = {
    'agriculture': {'tr': 'Tarım', 'en': 'Agriculture'},
    'mining': {'tr': 'Madencilik', 'en': 'Mining'},
    'manufacturing': {'tr': 'İmalat', 'en': 'Manufacturing'},
    'energy': {'tr': 'Enerji', 'en': 'Energy'},
    'water': {'tr': 'Su Yönetimi', 'en': 'Water Management'},
    'construction': {'tr': 'İnşaat', 'en': 'Construction'},
    'service': {'tr': 'Hizmet', 'en': 'Services'},
    'finance': {'tr': 'Finans', 'en': 'Finance'},
    'public': {'tr': 'Kamu', 'en': 'Public Sector'},
}

# Stage grouping for the completion-coverage table — mirrors the 7 stages the
# frontend's CARBONIQ_STAGES defines (nexus_insights.../lib/carboniq/questions.js).
# This is section *labeling* metadata only (7 entries), not question content,
# branching, or validation logic.
STAGE_BLOCKS = [
    ({'tr': 'Şirketi Tanıma', 'en': 'Company Profile'}, ('A', 'B', 'C', 'D')),
    ({'tr': 'Organizasyon Sınırı', 'en': 'Organizational Boundary'}, ('2A', '2B', '2C')),
    ({'tr': 'Kapsam 1', 'en': 'Scope 1'}, ('3A', '3B', '3C', '3D')),
    ({'tr': 'Kapsam 2', 'en': 'Scope 2'}, ('4A', '4B', '4C')),
    ({'tr': 'Kapsam 3', 'en': 'Scope 3'}, tuple(f'5{c}' for c in 'ABCDEFGHIJKLMNOP')),
    ({'tr': 'Hariç Tutmalar ve Kabuller', 'en': 'Exclusions and Assumptions'}, ('6', '6A', '6B', '6C', '6D', '6E', '6F')),
    ({'tr': 'Rapor Üretimi', 'en': 'Report Generation'}, ('7', '7A', '7B', '7C')),
]


def _label(map_, key, lang):
    if not key:
        return None
    entry = map_.get(key)
    if entry is None:
        return key
    if isinstance(entry, str):
        return entry
    return entry.get(lang) or entry.get('en')


def _bool_label(value, lang):
    if value is None:
        return '—'
    yes = 'Evet' if lang == 'tr' else 'Yes'
    no = 'Hayır' if lang == 'tr' else 'No'
    return yes if value else no


def _step_stage_index(step_id):
    """Map a ReportStep.step_id (e.g. '3B-EF', 'A1', '5C-2') to a STAGE_BLOCKS index."""
    for i, (_, prefixes) in enumerate(STAGE_BLOCKS):
        for p in prefixes:
            if step_id == p or step_id.startswith(p + '-') or step_id.startswith(p):
                # Guard against '3A' matching before a more specific check needed —
                # prefixes are already distinct per stage so first match is correct.
                return i
    return None


def generate_questionnaire_report(report: CarbonReport, lang='en') -> bytes:
    """Generate the qualitative Carbon Inventory Profile PDF for a completed
    (or in-progress) CarbonReport. Returns raw PDF bytes."""
    S = _styles()
    fn, fnb = S['fn'], S['fnb']
    tr = lang == 'tr'
    cl = _CAT.get(lang, _CAT['en'])

    company = report.company
    cname = company.legal_entity_name if company else '—'
    year = report.reporting_year or datetime.now().year

    steps = list(ReportStep.objects.filter(report=report))
    answered_ids = {s.step_id for s in steps}

    # ── Build PDF ───────────────────────────────────
    buf = io.BytesIO()
    doc = _ReportDocTemplate(buf, cname, year, lang, pagesize=A4,
                              leftMargin=20 * mm, rightMargin=20 * mm,
                              topMargin=22 * mm, bottomMargin=20 * mm)
    E = []

    # ════════════════════════════════════════════════
    # COVER PAGE
    # ════════════════════════════════════════════════
    E.append(Spacer(1, 45 * mm))
    E.append(Paragraph('CARBONLESS', S['cover_title']))
    E.append(Spacer(1, 4 * mm))
    E.append(Paragraph(
        'Karbon Envanteri Profil Raporu' if tr else 'Carbon Inventory Profile Report', S['cover_sub']))
    E.append(Paragraph('ISO 14064-1:2018', S['cover_badge']))
    E.append(Spacer(1, 18 * mm))
    E.append(HRFlowable(width='40%', thickness=2, color=OLIVE, spaceAfter=12 * mm))
    E.append(Paragraph(cname, S['cover_company']))
    E.append(Spacer(1, 8 * mm))
    E.append(Paragraph(f"{'Raporlama Yılı' if tr else 'Reporting Year'}: {year}", S['cover_date']))
    if report.prepared_by:
        E.append(Paragraph(f"{'Hazırlayan' if tr else 'Prepared By'}: {report.prepared_by}", S['cover_date']))
    E.append(Paragraph(f"{'Rapor Tarihi' if tr else 'Report Date'}: {datetime.now().strftime('%d.%m.%Y')}", S['cover_date']))
    E.append(Spacer(1, 20 * mm))
    E.append(Paragraph(
        'GİZLİ — Bu rapor yalnızca yetkili kişiler içindir.' if tr
        else 'CONFIDENTIAL — This report is for authorized personnel only.', S['small']))
    E.append(NextPageTemplate('content'))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ════════════════════════════════════════════════
    E.append(Paragraph('İçindekiler' if tr else 'Table of Contents', S['h1']))
    E.append(Spacer(1, 3 * mm))
    toc_items = [
        ('1', 'Kurumsal Profil' if tr else 'Organizational Profile'),
        ('2', 'Raporlama Çerçevesi ve Sınırları' if tr else 'Reporting Framework & Boundaries'),
        ('3', 'Kurumsal Yapı' if tr else 'Corporate Structure'),
        ('4', 'Anket Tamamlanma ve Veri Kapsamı' if tr else 'Questionnaire Completion & Data Coverage'),
        ('5', 'Ölçülen Sera Gazı Emisyonları' if tr else 'Quantified GHG Emissions'),
        ('6', 'Metodoloji ve Uyumluluk' if tr else 'Methodology & Compliance'),
    ]
    for num, title in toc_items:
        E.append(Paragraph(f'<font color="#{OLIVE_DARK.hexval()[2:]}">{num}.</font>  {title}', S['toc']))
    E.append(Spacer(1, 6 * mm))
    E.append(HRFlowable(width='100%', thickness=0.5, color=GRAY_200, spaceAfter=4 * mm))
    E.append(Paragraph(
        f"{'Toplam yanıtlanan soru' if tr else 'Total questions answered'}: {len(answered_ids)}  •  "
        f"{'Oluşturma' if tr else 'Generated'}: {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        S['body_sm']))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 1. ORGANIZATIONAL PROFILE
    # ════════════════════════════════════════════════
    E.append(Paragraph('1. ' + ('Kurumsal Profil' if tr else 'Organizational Profile'), S['h1']))

    nace_letter = (company.nace_code or '')[:1].upper() if company else ''
    cluster = NACE_CLUSTER.get(nace_letter, None) if company else None
    cluster_label = _label(NACE_CLUSTER_LABELS, cluster, lang) if cluster else None

    intro = (
        f"{cname}, ISO 14064-1:2018 standardına uygun bir sera gazı envanteri hazırlamak amacıyla "
        f"CarbonIQ AI destekli anketini tamamlamıştır."
        + (f" Şirket, {cluster_label} sektöründe faaliyet göstermektedir." if cluster_label else '')
        if tr else
        f"{cname} has completed the CarbonIQ AI-guided questionnaire to establish a greenhouse gas "
        f"inventory in accordance with ISO 14064-1:2018."
        + (f" The organization operates within the {cluster_label} sector." if cluster_label else '')
    )
    E.append(Paragraph(intro, S['body']))
    E.append(Spacer(1, 5 * mm))

    profile_rows = [
        ('Yasal Unvan' if tr else 'Legal Entity Name', cname),
        ('Vergi/Kayıt No' if tr else 'Tax / Registration ID', company.tax_number if company else '—'),
        ('Merkez Ülke' if tr else 'Headquarters Country', company.country_of_headquarters if company else '—'),
        ('NACE Sektör Kodu' if tr else 'NACE Sector Code', company.nace_code if company and company.nace_code else '—'),
        ('Faaliyet Açıklaması' if tr else 'Activity Description', (company.main_activity_description[:120] + '…') if company and company.main_activity_description and len(company.main_activity_description) > 120 else (company.main_activity_description if company else '—') or '—'),
        ('Çalışan Sayısı Aralığı' if tr else 'Employee Count Band', company.number_of_employees if company and company.number_of_employees else '—'),
        ('Yıllık Ciro Aralığı' if tr else 'Annual Turnover Band', company.annual_turnover_range if company and company.annual_turnover_range else '—'),
        ('Tesis Sayısı' if tr else 'Number of Facilities', str(company.number_of_facilities) if company and company.number_of_facilities is not None else '—'),
        ('Bağlı Kuruluş Sayısı' if tr else 'Number of Subsidiaries', str(company.number_of_subsidiaries) if company else '0'),
        ('Denizaşırı Operasyon' if tr else 'Overseas Operations', _bool_label(company.has_overseas_operations if company else None, lang)),
    ]
    pt = Table([[k, v] for k, v in profile_rows], colWidths=[55 * mm, 95 * mm])
    pt.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), fnb),
        ('FONTNAME', (1, 0), (1, -1), fn),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('TEXTCOLOR', (0, 0), (0, -1), GRAY_600),
        ('TEXTCOLOR', (1, 0), (1, -1), GRAY_800),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [WHITE, GRAY_50]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.25, GRAY_200),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    E.append(pt)
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 2. REPORTING FRAMEWORK & BOUNDARIES
    # ════════════════════════════════════════════════
    E.append(Paragraph('2. ' + ('Raporlama Çerçevesi ve Sınırları' if tr else 'Reporting Framework & Boundaries'), S['h1']))

    purposes = report.purposes or []
    purpose_labels = [_label(PURPOSE_LABELS, p, lang) or p for p in purposes]
    boundary_label = _label(BOUNDARY_LABELS, report.boundary_approach, lang)
    ef_label = _label(EF_DATABASE_LABELS, report.ef_database, lang)
    scope3_label = _label(SCOPE3_APPROACH_LABELS, report.scope3_approach, lang)

    framework_body = (
        f"Bu envanter {year} raporlama yılını kapsamaktadır"
        + (f" ve {', '.join(purpose_labels)} amacıyla hazırlanmıştır." if purpose_labels else '.')
        + (f" Kuruluşun sınır belirleme yaklaşımı {boundary_label} olarak seçilmiştir." if boundary_label else '')
        if tr else
        f"This inventory covers reporting year {year}"
        + (f" and was prepared for {', '.join(purpose_labels).lower()}." if purpose_labels else '.')
        + (f" The organizational boundary was established using the {boundary_label} approach." if boundary_label else '')
    )
    E.append(Paragraph(framework_body, S['body']))
    E.append(Spacer(1, 5 * mm))

    framework_rows = [
        ('Raporlama Yılı' if tr else 'Reporting Year', str(year)),
        ('Raporlama Amaçları' if tr else 'Reporting Purposes', ', '.join(purpose_labels) if purpose_labels else '—'),
        ('Önceki Rapor Var Mı' if tr else 'Previous Report Exists', _bool_label(report.has_previous_report, lang)),
        ('Baz Yıl' if tr else 'Baseline Year', str(report.baseline_year) if report.baseline_year else '—'),
        ('Organizasyon Sınırı Yaklaşımı' if tr else 'Organizational Boundary Approach', boundary_label or '—'),
        ('Emisyon Faktör Veritabanı' if tr else 'Emission Factor Database', ef_label or '—'),
        ('Kapsam 3 Yaklaşımı' if tr else 'Scope 3 Approach', scope3_label or '—'),
        ('Kapsam 2 Yöntemi' if tr else 'Scope 2 Method', (report.scope2_method or '').replace('_', ' ').title() or '—'),
    ]
    ft = Table([[k, v] for k, v in framework_rows], colWidths=[55 * mm, 95 * mm])
    ft.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), fnb),
        ('FONTNAME', (1, 0), (1, -1), fn),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('TEXTCOLOR', (0, 0), (0, -1), GRAY_600),
        ('TEXTCOLOR', (1, 0), (1, -1), GRAY_800),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [WHITE, GRAY_50]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.25, GRAY_200),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    E.append(ft)
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 3. CORPORATE STRUCTURE
    # ════════════════════════════════════════════════
    E.append(Paragraph('3. ' + ('Kurumsal Yapı' if tr else 'Corporate Structure'), S['h1']))
    E.append(Paragraph(
        'ISO 14064-1 §5 uyarınca, kurumsal yapı unsurları organizasyon sınırının doğru '
        'belirlenmesinde dikkate alınmıştır.'
        if tr else
        'In accordance with ISO 14064-1 §5, the following corporate structure elements were '
        'considered when establishing the organizational boundary.',
        S['body']))
    E.append(Spacer(1, 4 * mm))
    structure_rows = [
        ('Bağlı Kuruluşlar' if tr else 'Has Subsidiaries', _bool_label(report.has_subsidiaries, lang)),
        ('Uluslararası Operasyonlar' if tr else 'International Operations', _bool_label(report.has_international, lang)),
        ('Ortak Girişim / Franchise' if tr else 'Joint Ventures / Franchises', _bool_label(report.has_jv_franchise, lang)),
    ]
    st = Table([[k, v] for k, v in structure_rows], colWidths=[70 * mm, 40 * mm])
    st.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), fnb),
        ('FONTNAME', (1, 0), (1, -1), fn),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('TEXTCOLOR', (0, 0), (0, -1), GRAY_600),
        ('TEXTCOLOR', (1, 0), (1, -1), GRAY_800),
        ('GRID', (0, 0), (-1, -1), 0.25, GRAY_200),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [WHITE, GRAY_50]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    E.append(st)
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 4. QUESTIONNAIRE COMPLETION & DATA COVERAGE
    # ════════════════════════════════════════════════
    E.append(Paragraph('4. ' + ('Anket Tamamlanma ve Veri Kapsamı' if tr else 'Questionnaire Completion & Data Coverage'), S['h1']))
    E.append(Paragraph(
        'Aşağıdaki tablo, anketin her bölümünde yanıtlanan soru sayısını göstermektedir.'
        if tr else
        'The table below shows the number of questions answered in each section of the questionnaire.',
        S['body']))
    E.append(Spacer(1, 4 * mm))

    stage_counts = [0] * len(STAGE_BLOCKS)
    for step_id in answered_ids:
        idx = _step_stage_index(step_id)
        if idx is not None:
            stage_counts[idx] += 1

    cov_rows = [['#', 'Bölüm' if tr else 'Section', 'Yanıtlanan' if tr else 'Answered']]
    for i, (title, _prefixes) in enumerate(STAGE_BLOCKS):
        label = title.get(lang) or title.get('en')
        cov_rows.append([str(i + 1), label, str(stage_counts[i])])
    cov_rows.append(['', 'TOPLAM' if tr else 'TOTAL', str(len(answered_ids))])
    cov = Table(cov_rows, colWidths=[10 * mm, 110 * mm, 30 * mm])
    cov.setStyle(_tbl_style(fn, fnb))
    cov.setStyle(_total_row_style(fnb))
    E.append(cov)
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 5. QUANTIFIED GHG EMISSIONS
    # ════════════════════════════════════════════════
    E.append(Paragraph('5. ' + ('Ölçülen Sera Gazı Emisyonları' if tr else 'Quantified GHG Emissions'), S['h1']))

    entries = EmissionEntry.objects.filter(company=company, year=year).select_related('emission_factor') \
        if (EmissionEntry is not None and company) else []
    entry_count = entries.count() if hasattr(entries, 'count') else 0

    if entry_count > 0:
        total_kg = float(entries.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
        s1 = float(entries.filter(emission_factor__scope='scope1').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
        s2 = float(entries.filter(emission_factor__scope='scope2').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
        s3 = float(entries.filter(emission_factor__scope='scope3').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)

        E.append(Paragraph(
            f"{cname} için {year} yılına ait {entry_count} emisyon kaydı tespit edilmiştir. "
            f"Toplam emisyon {total_kg/1000:,.2f} tCO₂e olarak hesaplanmıştır."
            if tr else
            f"{entry_count} emission entries were identified for {cname} in reporting year {year}. "
            f"Total emissions are calculated at {total_kg/1000:,.2f} tCO₂e.",
            S['body']))
        E.append(Spacer(1, 5 * mm))

        scope_tbl = [
            ['Scope', 'kg CO₂e', 'tCO₂e', '%'],
            ['Scope 1', _fmt(s1), _fmt4(s1 / 1000), _pct(s1, total_kg)],
            ['Scope 2', _fmt(s2), _fmt4(s2 / 1000), _pct(s2, total_kg)],
            ['Scope 3', _fmt(s3), _fmt4(s3 / 1000), _pct(s3, total_kg)],
            ['TOPLAM' if tr else 'TOTAL', _fmt(total_kg), _fmt4(total_kg / 1000), '100%'],
        ]
        sct = Table(scope_tbl, colWidths=[30 * mm, 40 * mm, 35 * mm, 20 * mm])
        sct.setStyle(_tbl_style(fn, fnb))
        sct.setStyle(_total_row_style(fnb))
        E.append(sct)

        # A scope reading exactly zero while others have real data almost
        # always means it hasn't been measured yet, not that it's genuinely
        # nil — flag it so a reader doesn't mistake "0" for a complete figure.
        missing_scopes = [
            label for label, val in (('Scope 1', s1), ('Scope 2', s2), ('Scope 3', s3)) if val <= 0
        ]
        if missing_scopes:
            E.append(Spacer(1, 4 * mm))
            missing_list = ', '.join(missing_scopes)
            warn_text = (
                f"⚠ EKSİK: {missing_list} için bu dönemde veri kaydedilmemiş."
                if tr else
                f"⚠ INCOMPLETE: No data recorded for {missing_list} in this period."
            )
            warn_box = Table([[Paragraph(warn_text, S['warning'])]], colWidths=[125 * mm])
            warn_box.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), WARN_BG),
                ('BOX', (0, 0), (-1, -1), 0.8, WARN_AMBER),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
            E.append(warn_box)

        pie = _scope_pie_chart(s1, s2, s3, fn)
        if pie:
            E.append(Spacer(1, 6 * mm))
            E.append(pie)
    else:
        E.append(Paragraph(
            'Bu raporlama yılı için henüz ölçülen emisyon verisi bulunmamaktadır. Anket, kuruluşun '
            'organizasyonel profilini ve raporlama sınırlarını başarıyla belirlemiştir; bir sonraki '
            'adım Sohbet veya Emisyonlar bölümü üzerinden faaliyet verilerinin (yakıt tüketimi, '
            'elektrik kullanımı, seyahat vb.) girilmesidir. Veri girildikten sonra bu bölüm otomatik '
            'olarak Kapsam 1/2/3 toplamlarıyla güncellenecektir.'
            if tr else
            'No quantified emission data is available yet for this reporting year. The questionnaire has '
            'successfully established the organization’s profile and reporting boundaries; the next '
            'step is to enter activity data (fuel consumption, electricity use, travel, etc.) via Chat or '
            'the Emissions section. This section will automatically populate with Scope 1/2/3 totals once '
            'that data is recorded.',
            S['body']))

    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 6. METHODOLOGY & COMPLIANCE
    # ════════════════════════════════════════════════
    E.append(Paragraph('6. ' + ('Metodoloji ve Uyumluluk' if tr else 'Methodology & Compliance'), S['h1']))
    standards = [
        ('Standart' if tr else 'Standard', 'ISO 14064-1:2018'),
        ('Çerçeve' if tr else 'Framework', 'GHG Protocol Corporate Standard'),
        ('Sınır Yaklaşımı' if tr else 'Boundary Approach', boundary_label or '—'),
        ('Sera Gazları' if tr else 'GHGs Covered', 'CO₂, CH₄, N₂O (CO₂e)'),
        ('GWP', 'IPCC AR6 (100-year)'),
        ('Emisyon Faktör Kaynağı' if tr else 'Emission Factor Source', ef_label or '—'),
    ]
    for label, val in standards:
        E.append(Paragraph(f'<b>{label}:</b>  {val}', S['body']))
    E.append(Spacer(1, 10 * mm))

    E.append(HRFlowable(width='100%', thickness=0.5, color=GRAY_200, spaceAfter=5 * mm))
    E.append(Paragraph(
        'GİZLİLİK NOTU: Bu rapor, kullanıcı tarafından tamamlanan CarbonIQ anketi temel alınarak '
        'Carbonless platformu tarafından otomatik olarak oluşturulmuştur. Nicel emisyon verileri '
        '(varsa) ayrıca girilmiş olup doğruluğu kullanıcının sorumluluğundadır. Üçüncü taraf '
        'doğrulaması yapılmamıştır.'
        if tr else
        'DISCLAIMER: This report was automatically generated by the Carbonless platform based on the '
        'user-completed CarbonIQ questionnaire. Quantified emission data (where present) was entered '
        'separately and its accuracy is the user’s responsibility. No third-party verification has '
        'been performed.',
        S['small']))
    E.append(Spacer(1, 4 * mm))
    E.append(Paragraph(
        f'© {year} Carbonless  •  ISO 14064-1:2018  •  {datetime.now().strftime("%d.%m.%Y %H:%M")}',
        S['footer']))

    doc.build(E)
    buf.seek(0)
    return buf.getvalue()
