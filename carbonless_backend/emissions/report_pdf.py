"""
ISO 14064-1 Carbon Inventory PDF Report Generator
Professional report with cover page, executive summary, scope breakdown,
category details, monthly trend, methodology, and references.
Supports Turkish characters via DejaVuSans / Arial font.
"""
import io
import os
from datetime import datetime
from decimal import Decimal
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, HRFlowable
)
from django.db.models import Sum
from .models import EmissionEntry, CustomEmissionRequest
from companies.utils import get_current_company


# ── Colors ──────────────────────────────────────────────
GREEN = colors.HexColor('#059669')
GREEN_LIGHT = colors.HexColor('#10b981')
GREEN_BG = colors.HexColor('#f0fdf4')
GRAY_BG = colors.HexColor('#f9fafb')
GRAY_BORDER = colors.HexColor('#e5e7eb')
DARK = colors.HexColor('#111827')
SCOPE1_COLOR = colors.HexColor('#ef4444')
SCOPE2_COLOR = colors.HexColor('#f59e0b')
SCOPE3_COLOR = colors.HexColor('#3b82f6')


# ── Font Registration ───────────────────────────────────
_font_registered = False

def _register_fonts():
    global _font_registered
    if _font_registered:
        return
    # Windows: Arial
    try:
        windir = os.environ.get('WINDIR', 'C:\\Windows')
        arial = os.path.join(windir, 'Fonts', 'arial.ttf')
        arialb = os.path.join(windir, 'Fonts', 'arialbd.ttf')
        if os.path.exists(arial):
            pdfmetrics.registerFont(TTFont('CF', arial))
            pdfmetrics.registerFont(TTFont('CFB', arialb if os.path.exists(arialb) else arial))
            _font_registered = True
            return
    except Exception:
        pass
    # Linux/Render: DejaVuSans
    try:
        dejavu = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        dejavub = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
        if os.path.exists(dejavu):
            pdfmetrics.registerFont(TTFont('CF', dejavu))
            pdfmetrics.registerFont(TTFont('CFB', dejavub if os.path.exists(dejavub) else dejavu))
            _font_registered = True
            return
    except Exception:
        pass
    _font_registered = True


def _get_fonts():
    _register_fonts()
    if _font_registered:
        return 'CF', 'CFB'
    return 'Helvetica', 'Helvetica-Bold'


# ── Category Labels ─────────────────────────────────────
CAT_LABELS = {
    'tr': {
        'stationary_combustion': 'Sabit Yanma',
        'mobile_combustion': 'Mobil Yanma',
        'fugitive_emissions': 'Kaçak Emisyonlar',
        'process_emissions': 'Proses Emisyonları',
        'electricity': 'Elektrik',
        'steam_heat': 'Buhar ve Isı',
        'purchased_goods': 'Satın Alınan Mallar',
        'capital_goods': 'Sermaye Malları',
        'fuel_energy': 'Yakıt ve Enerji',
        'upstream_transport': 'Yukarı Akış Taşıma',
        'waste': 'Atık',
        'business_travel': 'İş Seyahati',
        'employee_commuting': 'Çalışan Ulaşımı',
        'upstream_leased': 'Kiralık Varlıklar (Yukarı)',
        'downstream_transport': 'Aşağı Akış Taşıma',
        'processing_of_sold_products': 'Satılan Ürünlerin İşlenmesi',
        'use_of_sold_products': 'Satılan Ürünlerin Kullanımı',
        'end_of_life': 'Ömür Sonu',
        'downstream_leased': 'Kiralık Varlıklar (Aşağı)',
        'franchises': 'Franchise',
        'investments': 'Yatırımlar',
        'water': 'Su',
        'custom': 'Özel',
    },
    'en': {
        'stationary_combustion': 'Stationary Combustion',
        'mobile_combustion': 'Mobile Combustion',
        'fugitive_emissions': 'Fugitive Emissions',
        'process_emissions': 'Process Emissions',
        'electricity': 'Electricity',
        'steam_heat': 'Steam & Heat',
        'purchased_goods': 'Purchased Goods',
        'capital_goods': 'Capital Goods',
        'fuel_energy': 'Fuel & Energy',
        'upstream_transport': 'Upstream Transport',
        'waste': 'Waste',
        'business_travel': 'Business Travel',
        'employee_commuting': 'Employee Commuting',
        'upstream_leased': 'Upstream Leased Assets',
        'downstream_transport': 'Downstream Transport',
        'processing_of_sold_products': 'Processing of Sold Products',
        'use_of_sold_products': 'Use of Sold Products',
        'end_of_life': 'End of Life Treatment',
        'downstream_leased': 'Downstream Leased Assets',
        'franchises': 'Franchises',
        'investments': 'Investments',
        'water': 'Water',
        'custom': 'Custom',
    }
}

MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


# ── Styles ──────────────────────────────────────────────
def _build_styles():
    fn, fnb = _get_fonts()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle('CoverTitle', fontName=fnb, fontSize=28, textColor=GREEN, spaceAfter=4, alignment=TA_CENTER))
    styles.add(ParagraphStyle('CoverSub', fontName=fn, fontSize=14, textColor=DARK, spaceAfter=2, alignment=TA_CENTER))
    styles.add(ParagraphStyle('CoverCompany', fontName=fnb, fontSize=18, textColor=DARK, spaceAfter=2, alignment=TA_CENTER))
    styles.add(ParagraphStyle('CoverDate', fontName=fn, fontSize=10, textColor=colors.grey, alignment=TA_CENTER))
    styles.add(ParagraphStyle('H1', fontName=fnb, fontSize=16, textColor=GREEN, spaceBefore=8, spaceAfter=6))
    styles.add(ParagraphStyle('H2', fontName=fnb, fontSize=13, textColor=DARK, spaceBefore=6, spaceAfter=4))
    styles.add(ParagraphStyle('H3', fontName=fnb, fontSize=10, textColor=DARK, spaceBefore=4, spaceAfter=2))
    styles.add(ParagraphStyle('Body', fontName=fn, fontSize=9.5, textColor=DARK, spaceAfter=3, leading=13))
    styles.add(ParagraphStyle('Small', fontName=fn, fontSize=7.5, textColor=colors.grey, spaceAfter=2))
    styles.add(ParagraphStyle('Footer', fontName=fn, fontSize=7, textColor=colors.grey, alignment=TA_CENTER))
    styles.add(ParagraphStyle('BigNum', fontName=fnb, fontSize=36, textColor=GREEN, alignment=TA_CENTER))
    styles.add(ParagraphStyle('BigLabel', fontName=fn, fontSize=9, textColor=colors.grey, alignment=TA_CENTER))
    return styles, fn, fnb


# ── Table Helpers ───────────────────────────────────────
def _header_style(fn, fnb, header_color=GREEN):
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), header_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), fnb),
        ('FONTNAME', (0, 1), (-1, -1), fn),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.4, GRAY_BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, GRAY_BG]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ])


def _total_row_style(fn, fnb):
    return TableStyle([
        ('BACKGROUND', (0, -1), (-1, -1), GREEN_BG),
        ('FONTNAME', (0, -1), (-1, -1), fnb),
        ('LINEABOVE', (0, -1), (-1, -1), 1, GREEN),
    ])


# ── Main Generator ──────────────────────────────────────
def generate_report(user, year, lang='tr'):
    """Generate ISO 14064-1 PDF report. Returns bytes."""
    styles, fn, fnb = _build_styles()
    tr = lang == 'tr'
    cat_labels = CAT_LABELS.get(lang, CAT_LABELS['en'])
    months = MONTHS_TR if tr else MONTHS_EN

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=20*mm, bottomMargin=18*mm)
    elements = []

    # ── Data ────────────────────────────────────────────
    company = get_current_company(user)
    company_name = company.legal_entity_name if company else user.username

    entries = EmissionEntry.objects.filter(company=company, year=year).select_related('emission_factor') if company else EmissionEntry.objects.none()
    total_kg = float(entries.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    s1 = float(entries.filter(emission_factor__scope='scope1').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    s2 = float(entries.filter(emission_factor__scope='scope2').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    s3 = float(entries.filter(emission_factor__scope='scope3').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)

    # Custom approved
    custom_qs = CustomEmissionRequest.objects.filter(
        company=company, year=year, status='approved', calculated_co2e_kg__isnull=False
    ) if company else CustomEmissionRequest.objects.none()
    for cr in custom_qs:
        v = float(cr.calculated_co2e_kg)
        total_kg += v
        if cr.scope == 'scope1': s1 += v
        elif cr.scope == 'scope2': s2 += v
        else: s3 += v

    # Monthly
    monthly = []
    for m in range(1, 13):
        mk = float(entries.filter(month=m).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
        monthly.append(mk)

    # Categories
    cats = entries.values('emission_factor__scope', 'emission_factor__category').annotate(
        total=Sum('calculated_co2e_kg')
    ).order_by('emission_factor__scope', '-total')

    # Sources used
    sources_used = set()
    for e in entries:
        ef = e.emission_factor
        if ef.reference:
            sources_used.add(ef.reference[:100])

    # ════════════════════════════════════════════════════
    # PAGE 1: COVER
    # ════════════════════════════════════════════════════
    elements.append(Spacer(1, 50*mm))
    elements.append(HRFlowable(width='100%', thickness=3, color=GREEN, spaceAfter=8*mm))
    elements.append(Paragraph('CARBONLESS', styles['CoverTitle']))
    elements.append(Spacer(1, 3*mm))
    elements.append(Paragraph(
        'Sera Gazı Envanteri Raporu' if tr else 'Greenhouse Gas Inventory Report',
        styles['CoverSub']
    ))
    elements.append(Paragraph(f'ISO 14064-1:2018 | {year}', styles['CoverSub']))
    elements.append(Spacer(1, 15*mm))
    elements.append(HRFlowable(width='60%', thickness=1, color=GRAY_BORDER, spaceAfter=8*mm))
    elements.append(Paragraph(company_name, styles['CoverCompany']))
    elements.append(Spacer(1, 8*mm))
    elements.append(Paragraph(
        f"{'Rapor Tarihi' if tr else 'Report Date'}: {datetime.now().strftime('%d.%m.%Y')}",
        styles['CoverDate']
    ))
    elements.append(Paragraph(
        f"{'Raporlama Dönemi' if tr else 'Reporting Period'}: 01.01.{year} – 31.12.{year}",
        styles['CoverDate']
    ))
    elements.append(Spacer(1, 30*mm))
    elements.append(HRFlowable(width='100%', thickness=3, color=GREEN))
    elements.append(PageBreak())

    # ════════════════════════════════════════════════════
    # PAGE 2: EXECUTIVE SUMMARY
    # ════════════════════════════════════════════════════
    elements.append(Paragraph(
        '1. Yönetici Özeti' if tr else '1. Executive Summary', styles['H1']
    ))
    elements.append(Paragraph(
        f"{company_name} {'şirketinin' if tr else 'company'} {year} "
        f"{'yılına ait sera gazı emisyonları ISO 14064-1:2018 standardına uygun olarak hesaplanmış ve bu raporda sunulmuştur.' if tr else 'greenhouse gas emissions have been calculated in accordance with ISO 14064-1:2018 and are presented in this report.'}",
        styles['Body']
    ))
    elements.append(Spacer(1, 6*mm))

    # Big number cards
    total_t = total_kg / 1000
    card_data = [[
        Paragraph(f'{total_t:,.2f}', styles['BigNum']),
    ]]
    card_label = [[
        Paragraph(f"{'TOPLAM EMİSYONLAR (tCO2e)' if tr else 'TOTAL EMISSIONS (tCO2e)'}", styles['BigLabel']),
    ]]
    ct = Table(card_data + card_label, colWidths=[170*mm])
    ct.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), GREEN_BG),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 1, GREEN),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 10),
    ]))
    elements.append(ct)
    elements.append(Spacer(1, 6*mm))

    # Scope summary table
    elements.append(Paragraph(
        '1.1 Kapsam Dağılımı' if tr else '1.1 Scope Distribution', styles['H2']
    ))
    pct = lambda v: f'{v/total_kg*100:.1f}%' if total_kg > 0 else '0%'
    scope_data = [
        ['Scope', 'Açıklama' if tr else 'Description', 'tCO2e', '%'],
        ['Scope 1', 'Doğrudan Emisyonlar' if tr else 'Direct Emissions', f'{s1/1000:,.4f}', pct(s1)],
        ['Scope 2', 'Enerji Dolaylı Emisyonlar' if tr else 'Energy Indirect', f'{s2/1000:,.4f}', pct(s2)],
        ['Scope 3', 'Diğer Dolaylı Emisyonlar' if tr else 'Other Indirect', f'{s3/1000:,.4f}', pct(s3)],
        ['TOPLAM' if tr else 'TOTAL', '', f'{total_t:,.4f}', '100%'],
    ]
    st = Table(scope_data, colWidths=[25*mm, 65*mm, 35*mm, 20*mm])
    st.setStyle(_header_style(fn, fnb))
    st.setStyle(_total_row_style(fn, fnb))
    # Color-code scope rows
    st.setStyle(TableStyle([
        ('TEXTCOLOR', (0, 1), (0, 1), SCOPE1_COLOR),
        ('TEXTCOLOR', (0, 2), (0, 2), SCOPE2_COLOR),
        ('TEXTCOLOR', (0, 3), (0, 3), SCOPE3_COLOR),
    ]))
    elements.append(st)
    elements.append(Spacer(1, 8*mm))

    # ── Scope visual bars (text-based) ──
    if total_kg > 0:
        elements.append(Paragraph(
            '1.2 Görsel Dağılım' if tr else '1.2 Visual Distribution', styles['H2']
        ))
        for label, val, clr in [('Scope 1', s1, SCOPE1_COLOR), ('Scope 2', s2, SCOPE2_COLOR), ('Scope 3', s3, SCOPE3_COLOR)]:
            p = val / total_kg * 100
            bar_w = max(p * 1.4, 2)  # scale to ~140mm max
            bar_data = [[
                Paragraph(f'<b>{label}</b>  {val/1000:,.2f} tCO2e ({p:.1f}%)', styles['Body']),
            ]]
            bt = Table(bar_data, colWidths=[170*mm])
            bt.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
            ]))
            elements.append(bt)
            # Bar
            bar = Table([['']],  colWidths=[bar_w*mm], rowHeights=[4*mm])
            bar.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), clr),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))
            elements.append(bar)
            elements.append(Spacer(1, 2*mm))
    elements.append(PageBreak())

    # ════════════════════════════════════════════════════
    # PAGE 3: CATEGORY BREAKDOWN
    # ════════════════════════════════════════════════════
    elements.append(Paragraph(
        '2. Kategori Dağılımı' if tr else '2. Category Breakdown', styles['H1']
    ))
    if cats:
        cat_data = [['Scope', 'Kategori' if tr else 'Category', 'kg CO2e', 'tCO2e', '%']]
        for c in cats:
            scope_label = c['emission_factor__scope'].replace('scope', 'Scope ')
            cat_name = cat_labels.get(c['emission_factor__category'], c['emission_factor__category'])
            t = float(c['total'])
            cat_data.append([
                scope_label, cat_name,
                f'{t:,.2f}', f'{t/1000:,.4f}',
                f'{t/total_kg*100:.1f}%' if total_kg > 0 else '0%'
            ])
        ctt = Table(cat_data, colWidths=[22*mm, 55*mm, 32*mm, 28*mm, 15*mm])
        ctt.setStyle(_header_style(fn, fnb, GREEN_LIGHT))
        elements.append(ctt)
    else:
        elements.append(Paragraph(
            'Bu dönem için kategori verisi bulunmamaktadır.' if tr else 'No category data for this period.',
            styles['Body']
        ))
    elements.append(Spacer(1, 8*mm))

    # ── Monthly Trend ──
    elements.append(Paragraph(
        '2.1 Aylık Trend' if tr else '2.1 Monthly Trend', styles['H2']
    ))
    if any(m > 0 for m in monthly):
        month_data = [months, [f'{m/1000:,.2f}' if m > 0 else '-' for m in monthly]]
        mt = Table(month_data, colWidths=[14.2*mm]*12)
        mt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), GREEN),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), fn),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.3, GRAY_BORDER),
            ('BACKGROUND', (0, 1), (-1, 1), GREEN_BG),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        elements.append(mt)
        elements.append(Paragraph(
            f"{'(tCO2e cinsinden)' if tr else '(in tCO2e)'}", styles['Small']
        ))
    else:
        elements.append(Paragraph(
            'Aylık veri bulunmamaktadır.' if tr else 'No monthly data available.',
            styles['Body']
        ))
    elements.append(PageBreak())

    # ════════════════════════════════════════════════════
    # PAGE 4: DETAILED ENTRIES
    # ════════════════════════════════════════════════════
    elements.append(Paragraph(
        '3. Detaylı Emisyon Kayıtları' if tr else '3. Detailed Emission Entries', styles['H1']
    ))
    if entries.exists():
        detail_data = [[
            'Kaynak' if tr else 'Source', 'Scope', 'Ay' if tr else 'Mo',
            'Miktar' if tr else 'Qty', 'Birim' if tr else 'Unit',
            'Faktör' if tr else 'Factor', 'kg CO2e',
        ]]
        for e in entries[:200]:
            ef = e.emission_factor
            name = (ef.name_tr if tr and ef.name_tr else ef.name)[:28]
            detail_data.append([
                name,
                ef.scope.replace('scope', 'S'),
                months[e.month - 1] if 1 <= e.month <= 12 else str(e.month),
                f'{float(e.quantity):,.1f}',
                ef.unit,
                f'{float(ef.factor_kg_co2e):.4f}',
                f'{float(e.calculated_co2e_kg):,.2f}',
            ])
        dt = Table(detail_data, colWidths=[42*mm, 10*mm, 10*mm, 20*mm, 14*mm, 20*mm, 28*mm])
        dt.setStyle(_header_style(fn, fnb))
        elements.append(dt)
    else:
        elements.append(Paragraph(
            'Bu dönem için emisyon kaydı bulunmamaktadır.' if tr else 'No emission entries for this period.',
            styles['Body']
        ))
    elements.append(Spacer(1, 6*mm))

    # Custom approved entries
    if custom_qs.exists():
        elements.append(Paragraph(
            '3.1 Özel Emisyon Kayıtları (Onaylı)' if tr else '3.1 Custom Emission Entries (Approved)',
            styles['H2']
        ))
        cr_data = [['Kaynak' if tr else 'Source', 'Scope', 'Miktar' if tr else 'Qty', 'Birim' if tr else 'Unit', 'kg CO2e']]
        for cr in custom_qs:
            cr_data.append([
                cr.source_name[:35], cr.scope.replace('scope', 'S'),
                f'{float(cr.quantity):,.1f}', cr.unit,
                f'{float(cr.calculated_co2e_kg):,.2f}'
            ])
        crt = Table(cr_data, colWidths=[50*mm, 15*mm, 25*mm, 20*mm, 30*mm])
        crt.setStyle(_header_style(fn, fnb, SCOPE2_COLOR))
        elements.append(crt)
    elements.append(PageBreak())

    # ════════════════════════════════════════════════════
    # PAGE 5: METHODOLOGY & REFERENCES
    # ════════════════════════════════════════════════════
    elements.append(Paragraph(
        '4. Metodoloji' if tr else '4. Methodology', styles['H1']
    ))
    meth_items = [
        ('Standart / Standard', 'ISO 14064-1:2018, GHG Protocol Corporate Standard'),
        ('Kapsam Sınırı / Boundary' if tr else 'Organizational Boundary',
         'Operasyonel kontrol yaklaşımı' if tr else 'Operational control approach'),
        ('Sera Gazları / GHGs' if tr else 'Greenhouse Gases', 'CO2, CH4, N2O (CO2e olarak raporlanmıştır)' if tr else 'CO2, CH4, N2O (reported as CO2e)'),
        ('GWP Değerleri / GWP Values' if tr else 'GWP Values', 'IPCC AR6 (100-year GWP)'),
        ('Hesaplama / Calculation' if tr else 'Calculation',
         'Emisyon = Faaliyet Verisi × Emisyon Faktörü' if tr else 'Emission = Activity Data × Emission Factor'),
    ]
    for label, val in meth_items:
        elements.append(Paragraph(f'<b>{label}:</b> {val}', styles['Body']))
    elements.append(Spacer(1, 6*mm))

    # Scope definitions
    elements.append(Paragraph(
        '4.1 Kapsam Tanımları' if tr else '4.1 Scope Definitions', styles['H2']
    ))
    scope_defs = [
        ('Scope 1',
         'Şirketin sahip olduğu veya kontrol ettiği kaynaklardan doğrudan emisyonlar (yakıt yanması, kaçak gazlar, proses emisyonları).' if tr else
         'Direct emissions from owned or controlled sources (fuel combustion, fugitive gases, process emissions).'),
        ('Scope 2',
         'Satın alınan elektrik, buhar, ısıtma ve soğutmadan kaynaklanan dolaylı emisyonlar.' if tr else
         'Indirect emissions from purchased electricity, steam, heating and cooling.'),
        ('Scope 3',
         'Değer zincirindeki diğer tüm dolaylı emisyonlar (satın alınan mallar, iş seyahati, çalışan ulaşımı, atık, taşımacılık vb.).' if tr else
         'All other indirect emissions in the value chain (purchased goods, business travel, employee commuting, waste, transport, etc.).'),
    ]
    for scope, desc in scope_defs:
        elements.append(Paragraph(f'<b>{scope}:</b> {desc}', styles['Body']))
    elements.append(Spacer(1, 6*mm))

    # References
    elements.append(Paragraph(
        '4.2 Kullanılan Emisyon Faktör Kaynakları' if tr else '4.2 Emission Factor Sources', styles['H2']
    ))
    if sources_used:
        for i, s in enumerate(sorted(sources_used), 1):
            elements.append(Paragraph(f'{i}. {s}', styles['Small']))
    else:
        elements.append(Paragraph(
            'Henüz kaynak bilgisi bulunmamaktadır.' if tr else 'No source references available.',
            styles['Small']
        ))
    elements.append(Spacer(1, 10*mm))

    # ── Disclaimer ──
    elements.append(HRFlowable(width='100%', thickness=0.5, color=GRAY_BORDER, spaceAfter=4*mm))
    elements.append(Paragraph(
        f"{'Bu rapor Carbonless platformu tarafından otomatik olarak oluşturulmuştur. Veriler kullanıcı tarafından girilmiş olup, doğruluğu kullanıcının sorumluluğundadır.' if tr else 'This report was automatically generated by the Carbonless platform. Data was entered by the user and accuracy is the responsibility of the user.'}",
        styles['Small']
    ))
    elements.append(Paragraph(
        f"Carbonless | ISO 14064-1 | {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        styles['Footer']
    ))

    # Build PDF
    doc.build(elements)
    buf.seek(0)
    return buf.getvalue()
