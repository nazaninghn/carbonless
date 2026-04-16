"""
ISO 14064-1 Carbon Inventory PDF Report Generator — Professional Edition
Generates enterprise-grade PDF reports with:
  - Branded cover page with green accent
  - Table of contents
  - Executive summary with KPI cards
  - Scope breakdown with visual bars
  - Category breakdown per scope
  - Monthly trend table
  - Detailed emission entries
  - Facility breakdown
  - Custom emission entries
  - Methodology & scope definitions
  - Emission factor source references
  - Header/footer on every page with page numbers
Supports Turkish characters via DejaVuSans / Arial font.
"""
import io
import os
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    HRFlowable, NextPageTemplate
)
from django.db.models import Sum
from .models import EmissionEntry, CustomEmissionRequest
from companies.utils import get_current_company


# ═══════════════════════════════════════════════════════
# COLORS
# ═══════════════════════════════════════════════════════
PRIMARY = colors.HexColor('#059669')
PRIMARY_LIGHT = colors.HexColor('#10b981')
PRIMARY_BG = colors.HexColor('#ecfdf5')
GREEN_BG = colors.HexColor('#f0fdf4')
GRAY_50 = colors.HexColor('#f9fafb')
GRAY_100 = colors.HexColor('#f3f4f6')
GRAY_200 = colors.HexColor('#e5e7eb')
GRAY_400 = colors.HexColor('#9ca3af')
GRAY_600 = colors.HexColor('#4b5563')
GRAY_900 = colors.HexColor('#111827')
SCOPE1 = colors.HexColor('#ef4444')
SCOPE2 = colors.HexColor('#f59e0b')
SCOPE3 = colors.HexColor('#3b82f6')
WHITE = colors.white


# ═══════════════════════════════════════════════════════
# FONT REGISTRATION
# ═══════════════════════════════════════════════════════
_font_ok = False

def _register_fonts():
    global _font_ok
    if _font_ok:
        return
    # Windows: Arial
    try:
        wd = os.environ.get('WINDIR', 'C:\\Windows')
        a = os.path.join(wd, 'Fonts', 'arial.ttf')
        ab = os.path.join(wd, 'Fonts', 'arialbd.ttf')
        if os.path.exists(a):
            pdfmetrics.registerFont(TTFont('CF', a))
            pdfmetrics.registerFont(TTFont('CFB', ab if os.path.exists(ab) else a))
            _font_ok = True
            return
    except Exception:
        pass
    # Linux: DejaVuSans
    try:
        d = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        db = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
        if os.path.exists(d):
            pdfmetrics.registerFont(TTFont('CF', d))
            pdfmetrics.registerFont(TTFont('CFB', db if os.path.exists(db) else d))
            _font_ok = True
            return
    except Exception:
        pass
    _font_ok = True

def _fonts():
    _register_fonts()
    return ('CF', 'CFB') if _font_ok else ('Helvetica', 'Helvetica-Bold')


# ═══════════════════════════════════════════════════════
# CATEGORY LABELS
# ═══════════════════════════════════════════════════════
_CAT = {
    'tr': {
        'stationary_combustion': 'Sabit Yanma', 'mobile_combustion': 'Mobil Yanma',
        'fugitive_emissions': 'Kaçak Emisyonlar', 'process_emissions': 'Proses Emisyonları',
        'electricity': 'Elektrik', 'steam_heat': 'Buhar ve Isı',
        'purchased_goods': 'Satın Alınan Mallar', 'capital_goods': 'Sermaye Malları',
        'fuel_energy': 'Yakıt ve Enerji', 'upstream_transport': 'Yukarı Akış Taşıma',
        'waste': 'Atık', 'business_travel': 'İş Seyahati',
        'employee_commuting': 'Çalışan Ulaşımı', 'upstream_leased': 'Kiralık Varlıklar (Yukarı)',
        'downstream_transport': 'Aşağı Akış Taşıma',
        'processing_of_sold_products': 'Satılan Ürünlerin İşlenmesi',
        'use_of_sold_products': 'Satılan Ürünlerin Kullanımı',
        'end_of_life': 'Ömür Sonu İşleme', 'downstream_leased': 'Kiralık Varlıklar (Aşağı)',
        'franchises': 'Franchise', 'investments': 'Yatırımlar',
        'water': 'Su', 'custom': 'Özel',
    },
    'en': {
        'stationary_combustion': 'Stationary Combustion', 'mobile_combustion': 'Mobile Combustion',
        'fugitive_emissions': 'Fugitive Emissions', 'process_emissions': 'Process Emissions',
        'electricity': 'Electricity', 'steam_heat': 'Steam & Heat',
        'purchased_goods': 'Purchased Goods', 'capital_goods': 'Capital Goods',
        'fuel_energy': 'Fuel & Energy Related', 'upstream_transport': 'Upstream Transportation',
        'waste': 'Waste Generated', 'business_travel': 'Business Travel',
        'employee_commuting': 'Employee Commuting', 'upstream_leased': 'Upstream Leased Assets',
        'downstream_transport': 'Downstream Transportation',
        'processing_of_sold_products': 'Processing of Sold Products',
        'use_of_sold_products': 'Use of Sold Products',
        'end_of_life': 'End-of-Life Treatment', 'downstream_leased': 'Downstream Leased Assets',
        'franchises': 'Franchises', 'investments': 'Investments',
        'water': 'Water', 'custom': 'Custom',
    }
}

_MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
_MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


# ═══════════════════════════════════════════════════════
# STYLES
# ═══════════════════════════════════════════════════════
def _styles():
    fn, fnb = _fonts()
    S = {}
    S['fn'] = fn
    S['fnb'] = fnb
    S['cover_title'] = ParagraphStyle('ct', fontName=fnb, fontSize=32, textColor=PRIMARY, alignment=TA_CENTER, leading=38)
    S['cover_sub'] = ParagraphStyle('cs', fontName=fn, fontSize=14, textColor=GRAY_600, alignment=TA_CENTER, leading=18)
    S['cover_company'] = ParagraphStyle('cc', fontName=fnb, fontSize=20, textColor=GRAY_900, alignment=TA_CENTER, leading=26)
    S['cover_date'] = ParagraphStyle('cd', fontName=fn, fontSize=10, textColor=GRAY_400, alignment=TA_CENTER)
    S['h1'] = ParagraphStyle('h1', fontName=fnb, fontSize=16, textColor=PRIMARY, spaceBefore=10, spaceAfter=6, leading=20)
    S['h2'] = ParagraphStyle('h2', fontName=fnb, fontSize=12, textColor=GRAY_900, spaceBefore=8, spaceAfter=4, leading=16)
    S['h3'] = ParagraphStyle('h3', fontName=fnb, fontSize=10, textColor=GRAY_600, spaceBefore=4, spaceAfter=3, leading=13)
    S['body'] = ParagraphStyle('body', fontName=fn, fontSize=9, textColor=GRAY_900, spaceAfter=3, leading=13)
    S['small'] = ParagraphStyle('small', fontName=fn, fontSize=7.5, textColor=GRAY_400, spaceAfter=2, leading=10)
    S['footer'] = ParagraphStyle('footer', fontName=fn, fontSize=7, textColor=GRAY_400, alignment=TA_CENTER)
    S['big_num'] = ParagraphStyle('bn', fontName=fnb, fontSize=42, textColor=PRIMARY, alignment=TA_CENTER, leading=48)
    S['big_label'] = ParagraphStyle('bl', fontName=fn, fontSize=9, textColor=GRAY_600, alignment=TA_CENTER)
    S['kpi_num'] = ParagraphStyle('kn', fontName=fnb, fontSize=22, textColor=GRAY_900, alignment=TA_CENTER, leading=28)
    S['kpi_label'] = ParagraphStyle('kl', fontName=fn, fontSize=8, textColor=GRAY_600, alignment=TA_CENTER)
    S['toc'] = ParagraphStyle('toc', fontName=fn, fontSize=11, textColor=GRAY_900, spaceBefore=6, spaceAfter=6, leading=16)
    return S


# ═══════════════════════════════════════════════════════
# TABLE HELPERS
# ═══════════════════════════════════════════════════════
def _tbl_style(fn, fnb, hdr_color=PRIMARY):
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), hdr_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), fnb),
        ('FONTNAME', (0, 1), (-1, -1), fn),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.3, GRAY_200),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_50]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ])

def _total_style(fnb):
    return TableStyle([
        ('BACKGROUND', (0, -1), (-1, -1), GREEN_BG),
        ('FONTNAME', (0, -1), (-1, -1), fnb),
        ('LINEABOVE', (0, -1), (-1, -1), 1.2, PRIMARY),
    ])

def _pct(v, total):
    return f'{v/total*100:.1f}%' if total > 0 else '0.0%'

def _fmt(v):
    return f'{v:,.2f}'

def _fmt4(v):
    return f'{v:,.4f}'


# ═══════════════════════════════════════════════════════
# PAGE TEMPLATES (Header/Footer)
# ═══════════════════════════════════════════════════════
class _ReportDocTemplate(BaseDocTemplate):
    def __init__(self, buf, company_name, year, lang, **kw):
        super().__init__(buf, **kw)
        self.company_name = company_name
        self.year = year
        self.lang = lang
        self.page_count = 0

        frame_cover = Frame(18*mm, 18*mm, A4[0]-36*mm, A4[1]-36*mm, id='cover')
        frame_body = Frame(18*mm, 18*mm, A4[0]-36*mm, A4[1]-46*mm, id='body')

        self.addPageTemplates([
            PageTemplate(id='cover', frames=[frame_cover], onPage=self._cover_page),
            PageTemplate(id='content', frames=[frame_body], onPage=self._content_page),
        ])

    def _cover_page(self, canvas, doc):
        # Green top bar
        canvas.setFillColor(PRIMARY)
        canvas.rect(0, A4[1]-8*mm, A4[0], 8*mm, fill=1, stroke=0)
        # Green bottom bar
        canvas.rect(0, 0, A4[0], 5*mm, fill=1, stroke=0)

    def _content_page(self, canvas, doc):
        fn, fnb = _fonts()
        w, h = A4
        # Header line
        canvas.setStrokeColor(PRIMARY)
        canvas.setLineWidth(1.5)
        canvas.line(18*mm, h-14*mm, w-18*mm, h-14*mm)
        # Header text
        canvas.setFont(fnb, 8)
        canvas.setFillColor(PRIMARY)
        canvas.drawString(18*mm, h-12*mm, 'CARBONLESS')
        canvas.setFont(fn, 7)
        canvas.setFillColor(GRAY_400)
        canvas.drawRightString(w-18*mm, h-12*mm, f'ISO 14064-1 | {self.company_name} | {self.year}')
        # Footer
        canvas.setStrokeColor(GRAY_200)
        canvas.setLineWidth(0.5)
        canvas.line(18*mm, 14*mm, w-18*mm, 14*mm)
        canvas.setFont(fn, 7)
        canvas.setFillColor(GRAY_400)
        page_num = doc.page - 1  # cover is page 0
        label = 'Sayfa' if self.lang == 'tr' else 'Page'
        canvas.drawCentredString(w/2, 9*mm, f'{label} {page_num}')
        canvas.drawString(18*mm, 9*mm, 'Carbonless Platform')
        canvas.drawRightString(w-18*mm, 9*mm, datetime.now().strftime('%d.%m.%Y'))


# ═══════════════════════════════════════════════════════
# MAIN GENERATOR
# ═══════════════════════════════════════════════════════
def generate_report(user, year, lang='tr'):
    """Generate professional ISO 14064-1 PDF report. Returns bytes."""
    S = _styles()
    fn, fnb = S['fn'], S['fnb']
    tr = lang == 'tr'
    cl = _CAT.get(lang, _CAT['en'])
    months = _MONTHS_TR if tr else _MONTHS_EN

    # ── Data ────────────────────────────────────────
    company = get_current_company(user)
    cname = company.legal_entity_name if company else user.username

    entries = EmissionEntry.objects.filter(company=company, year=year).select_related(
        'emission_factor', 'facility'
    ) if company else EmissionEntry.objects.none()

    total_kg = float(entries.aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    s1 = float(entries.filter(emission_factor__scope='scope1').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    s2 = float(entries.filter(emission_factor__scope='scope2').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)
    s3 = float(entries.filter(emission_factor__scope='scope3').aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0)

    custom_qs = CustomEmissionRequest.objects.filter(
        company=company, year=year, status='approved', calculated_co2e_kg__isnull=False
    ) if company else CustomEmissionRequest.objects.none()
    for cr in custom_qs:
        v = float(cr.calculated_co2e_kg)
        total_kg += v
        if cr.scope == 'scope1': s1 += v
        elif cr.scope == 'scope2': s2 += v
        else: s3 += v

    monthly = [float(entries.filter(month=m).aggregate(t=Sum('calculated_co2e_kg'))['t'] or 0) for m in range(1, 13)]

    cats = entries.values('emission_factor__scope', 'emission_factor__category').annotate(
        total=Sum('calculated_co2e_kg')
    ).order_by('emission_factor__scope', '-total')

    # Facility breakdown
    fac_data = entries.exclude(facility__isnull=True).values(
        'facility__name'
    ).annotate(total=Sum('calculated_co2e_kg')).order_by('-total')

    sources = set()
    for e in entries:
        if e.emission_factor.reference:
            sources.add(e.emission_factor.reference[:120])

    entry_count = entries.count()
    cat_count = len(set(e.emission_factor.category for e in entries))
    fac_count = len(set(e.facility_id for e in entries if e.facility_id))

    # ── Build PDF ───────────────────────────────────
    buf = io.BytesIO()
    doc = _ReportDocTemplate(buf, cname, year, lang, pagesize=A4,
                              leftMargin=18*mm, rightMargin=18*mm,
                              topMargin=20*mm, bottomMargin=18*mm)
    E = []

    # ════════════════════════════════════════════════
    # COVER PAGE
    # ════════════════════════════════════════════════
    E.append(Spacer(1, 55*mm))
    E.append(Paragraph('CARBONLESS', S['cover_title']))
    E.append(Spacer(1, 6*mm))
    E.append(Paragraph(
        'Sera Gazı Envanteri Raporu' if tr else 'Greenhouse Gas Inventory Report', S['cover_sub']))
    E.append(Paragraph(f'ISO 14064-1:2018', S['cover_sub']))
    E.append(Spacer(1, 20*mm))
    E.append(HRFlowable(width='50%', thickness=2, color=PRIMARY, spaceAfter=10*mm))
    E.append(Paragraph(cname, S['cover_company']))
    E.append(Spacer(1, 6*mm))
    E.append(Paragraph(f"{'Raporlama Yılı' if tr else 'Reporting Year'}: {year}", S['cover_date']))
    E.append(Paragraph(
        f"{'Raporlama Dönemi' if tr else 'Reporting Period'}: 01.01.{year} – 31.12.{year}", S['cover_date']))
    E.append(Paragraph(
        f"{'Rapor Tarihi' if tr else 'Report Date'}: {datetime.now().strftime('%d.%m.%Y')}", S['cover_date']))
    E.append(Spacer(1, 25*mm))
    # Confidential notice
    E.append(Paragraph(
        f"{'GİZLİ — Bu rapor yalnızca yetkili kişiler içindir.' if tr else 'CONFIDENTIAL — This report is for authorized personnel only.'}",
        S['small']))
    E.append(NextPageTemplate('content'))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ════════════════════════════════════════════════
    E.append(Paragraph('İçindekiler' if tr else 'Table of Contents', S['h1']))
    E.append(Spacer(1, 4*mm))
    toc_items = [
        ('1', 'Yönetici Özeti' if tr else 'Executive Summary'),
        ('2', 'Kapsam Dağılımı' if tr else 'Scope Distribution'),
        ('3', 'Kategori Dağılımı' if tr else 'Category Breakdown'),
        ('4', 'Aylık Trend' if tr else 'Monthly Trend'),
        ('5', 'Tesis Dağılımı' if tr else 'Facility Breakdown'),
        ('6', 'Detaylı Emisyon Kayıtları' if tr else 'Detailed Emission Entries'),
        ('7', 'Metodoloji ve Referanslar' if tr else 'Methodology & References'),
    ]
    for num, title in toc_items:
        E.append(Paragraph(f'<b>{num}.</b>  {title}', S['toc']))
    E.append(HRFlowable(width='100%', thickness=0.5, color=GRAY_200, spaceBefore=6*mm, spaceAfter=4*mm))
    E.append(Paragraph(
        f"{'Toplam kayıt sayısı' if tr else 'Total entries'}: {entry_count}  |  "
        f"{'Kategori' if tr else 'Categories'}: {cat_count}  |  "
        f"{'Tesis' if tr else 'Facilities'}: {fac_count}", S['body']))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 1. EXECUTIVE SUMMARY
    # ════════════════════════════════════════════════
    E.append(Paragraph('1. ' + ('Yönetici Özeti' if tr else 'Executive Summary'), S['h1']))
    E.append(Paragraph(
        f"{cname} {'şirketinin' if tr else 'company'} {year} "
        f"{'yılına ait sera gazı emisyonları ISO 14064-1:2018 standardına uygun olarak hesaplanmış ve bu raporda sunulmuştur. Hesaplamalar GHG Protocol Kurumsal Standardı çerçevesinde, operasyonel kontrol yaklaşımı kullanılarak yapılmıştır.' if tr else 'greenhouse gas emissions have been calculated in accordance with ISO 14064-1:2018 and are presented in this report. Calculations follow the GHG Protocol Corporate Standard using the operational control approach.'}",
        S['body']))
    E.append(Spacer(1, 6*mm))

    # KPI Cards
    total_t = total_kg / 1000
    kpi_data = [[
        Paragraph(f'{total_t:,.2f}', S['big_num']),
    ], [
        Paragraph('TOPLAM EMİSYONLAR (tCO2e)' if tr else 'TOTAL EMISSIONS (tCO2e)', S['big_label']),
    ]]
    kpi = Table(kpi_data, colWidths=[170*mm])
    kpi.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY_BG),
        ('BOX', (0, 0), (-1, -1), 1.5, PRIMARY),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 12),
    ]))
    E.append(kpi)
    E.append(Spacer(1, 4*mm))

    # 3 scope mini-cards
    scope_cards = [[
        Paragraph(f'{s1/1000:,.2f}', S['kpi_num']),
        Paragraph(f'{s2/1000:,.2f}', S['kpi_num']),
        Paragraph(f'{s3/1000:,.2f}', S['kpi_num']),
    ], [
        Paragraph('Scope 1 (tCO2e)', S['kpi_label']),
        Paragraph('Scope 2 (tCO2e)', S['kpi_label']),
        Paragraph('Scope 3 (tCO2e)', S['kpi_label']),
    ]]
    sc = Table(scope_cards, colWidths=[56.6*mm]*3)
    sc.setStyle(TableStyle([
        ('BOX', (0, 0), (0, -1), 0.8, SCOPE1),
        ('BOX', (1, 0), (1, -1), 0.8, SCOPE2),
        ('BOX', (2, 0), (2, -1), 0.8, SCOPE3),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#fef2f2')),
        ('BACKGROUND', (1, 0), (1, -1), colors.HexColor('#fffbeb')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#eff6ff')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 8),
    ]))
    E.append(sc)
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 2. SCOPE DISTRIBUTION
    # ════════════════════════════════════════════════
    E.append(Paragraph('2. ' + ('Kapsam Dağılımı' if tr else 'Scope Distribution'), S['h1']))

    scope_tbl = [
        ['Scope', 'Açıklama' if tr else 'Description', 'kg CO2e', 'tCO2e', '%'],
        ['Scope 1', 'Doğrudan Emisyonlar' if tr else 'Direct Emissions', _fmt(s1), _fmt4(s1/1000), _pct(s1, total_kg)],
        ['Scope 2', 'Enerji Dolaylı' if tr else 'Energy Indirect', _fmt(s2), _fmt4(s2/1000), _pct(s2, total_kg)],
        ['Scope 3', 'Diğer Dolaylı' if tr else 'Other Indirect', _fmt(s3), _fmt4(s3/1000), _pct(s3, total_kg)],
        ['TOPLAM' if tr else 'TOTAL', '', _fmt(total_kg), _fmt4(total_t), '100%'],
    ]
    st = Table(scope_tbl, colWidths=[22*mm, 55*mm, 32*mm, 28*mm, 16*mm])
    st.setStyle(_tbl_style(fn, fnb))
    st.setStyle(_total_style(fnb))
    st.setStyle(TableStyle([
        ('TEXTCOLOR', (0, 1), (0, 1), SCOPE1),
        ('TEXTCOLOR', (0, 2), (0, 2), SCOPE2),
        ('TEXTCOLOR', (0, 3), (0, 3), SCOPE3),
    ]))
    E.append(st)
    E.append(Spacer(1, 6*mm))

    # Visual bars
    if total_kg > 0:
        E.append(Paragraph('2.1 ' + ('Görsel Dağılım' if tr else 'Visual Distribution'), S['h2']))
        for label, val, clr in [('Scope 1', s1, SCOPE1), ('Scope 2', s2, SCOPE2), ('Scope 3', s3, SCOPE3)]:
            p = val / total_kg * 100
            bar_w = max(p * 1.5, 3)
            E.append(Paragraph(f'<b>{label}</b>  —  {val/1000:,.2f} tCO2e  ({p:.1f}%)', S['body']))
            bar = Table([['']],  colWidths=[bar_w*mm], rowHeights=[5*mm])
            bar.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), clr),
                ('ROUNDEDCORNERS', [2, 2, 2, 2]),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))
            E.append(bar)
            E.append(Spacer(1, 3*mm))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 3. CATEGORY BREAKDOWN
    # ════════════════════════════════════════════════
    E.append(Paragraph('3. ' + ('Kategori Dağılımı' if tr else 'Category Breakdown'), S['h1']))
    if cats:
        # Per-scope sections
        for scope_key, scope_label, scope_color in [
            ('scope1', 'Scope 1 — ' + ('Doğrudan' if tr else 'Direct'), SCOPE1),
            ('scope2', 'Scope 2 — ' + ('Enerji Dolaylı' if tr else 'Energy Indirect'), SCOPE2),
            ('scope3', 'Scope 3 — ' + ('Diğer Dolaylı' if tr else 'Other Indirect'), SCOPE3),
        ]:
            scope_cats = [c for c in cats if c['emission_factor__scope'] == scope_key]
            if not scope_cats:
                continue
            E.append(Paragraph(scope_label, S['h2']))
            data = [['Kategori' if tr else 'Category', 'kg CO2e', 'tCO2e', '%']]
            scope_total = sum(float(c['total']) for c in scope_cats)
            for c in scope_cats:
                t = float(c['total'])
                data.append([
                    cl.get(c['emission_factor__category'], c['emission_factor__category']),
                    _fmt(t), _fmt4(t/1000), _pct(t, total_kg)
                ])
            data.append([
                'Alt Toplam' if tr else 'Subtotal',
                _fmt(scope_total), _fmt4(scope_total/1000), _pct(scope_total, total_kg)
            ])
            ct = Table(data, colWidths=[65*mm, 32*mm, 28*mm, 16*mm])
            ct.setStyle(_tbl_style(fn, fnb, scope_color))
            ct.setStyle(_total_style(fnb))
            E.append(ct)
            E.append(Spacer(1, 4*mm))
    else:
        E.append(Paragraph(
            'Bu dönem için kategori verisi bulunmamaktadır.' if tr else 'No category data for this period.', S['body']))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 4. MONTHLY TREND
    # ════════════════════════════════════════════════
    E.append(Paragraph('4. ' + ('Aylık Trend' if tr else 'Monthly Trend'), S['h1']))
    if any(m > 0 for m in monthly):
        mt_data = [
            [''] + months,
            ['tCO2e'] + [f'{m/1000:,.3f}' if m > 0 else '—' for m in monthly],
            ['kg CO2e'] + [_fmt(m) if m > 0 else '—' for m in monthly],
        ]
        mt = Table(mt_data, colWidths=[16*mm] + [12.5*mm]*12)
        mt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
            ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
            ('BACKGROUND', (0, 1), (0, -1), GRAY_100),
            ('FONTNAME', (0, 0), (-1, -1), fn),
            ('FONTNAME', (0, 0), (0, -1), fnb),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.3, GRAY_200),
            ('ROWBACKGROUNDS', (1, 1), (-1, -1), [WHITE, GRAY_50]),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        E.append(mt)
        E.append(Spacer(1, 2*mm))
        # Peak month
        max_m = max(range(12), key=lambda i: monthly[i])
        if monthly[max_m] > 0:
            E.append(Paragraph(
                f"{'En yüksek emisyon ayı' if tr else 'Peak emission month'}: <b>{months[max_m]}</b> ({monthly[max_m]/1000:,.3f} tCO2e)",
                S['body']))
    else:
        E.append(Paragraph(
            'Aylık veri bulunmamaktadır.' if tr else 'No monthly data available.', S['body']))
    E.append(Spacer(1, 6*mm))

    # ════════════════════════════════════════════════
    # 5. FACILITY BREAKDOWN
    # ════════════════════════════════════════════════
    E.append(Paragraph('5. ' + ('Tesis Dağılımı' if tr else 'Facility Breakdown'), S['h1']))
    if fac_data:
        fd = [['Tesis' if tr else 'Facility', 'kg CO2e', 'tCO2e', '%']]
        for f in fac_data:
            t = float(f['total'])
            fd.append([f['facility__name'] or '—', _fmt(t), _fmt4(t/1000), _pct(t, total_kg)])
        ft = Table(fd, colWidths=[65*mm, 32*mm, 28*mm, 16*mm])
        ft.setStyle(_tbl_style(fn, fnb, PRIMARY_LIGHT))
        E.append(ft)
    else:
        E.append(Paragraph(
            'Tesis bazlı veri bulunmamaktadır.' if tr else 'No facility-level data available.', S['body']))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 6. DETAILED ENTRIES
    # ════════════════════════════════════════════════
    E.append(Paragraph('6. ' + ('Detaylı Emisyon Kayıtları' if tr else 'Detailed Emission Entries'), S['h1']))
    if entries.exists():
        hdr = ['Kaynak' if tr else 'Source', 'Scope', 'Ay' if tr else 'Mo',
               'Miktar' if tr else 'Qty', 'Birim' if tr else 'Unit',
               'Faktör' if tr else 'EF', 'kg CO2e']
        rows = [hdr]
        for e in entries[:300]:
            ef = e.emission_factor
            nm = (ef.name_tr if tr and ef.name_tr else ef.name)[:26]
            rows.append([
                nm, ef.scope.replace('scope', 'S'),
                months[e.month-1] if 1 <= e.month <= 12 else str(e.month),
                f'{float(e.quantity):,.1f}', ef.unit,
                f'{float(ef.factor_kg_co2e):.4f}', _fmt(float(e.calculated_co2e_kg)),
            ])
        dt = Table(rows, colWidths=[40*mm, 10*mm, 10*mm, 20*mm, 13*mm, 20*mm, 28*mm])
        dt.setStyle(_tbl_style(fn, fnb))
        E.append(dt)
    else:
        E.append(Paragraph(
            'Bu dönem için emisyon kaydı bulunmamaktadır.' if tr else 'No emission entries for this period.', S['body']))

    if custom_qs.exists():
        E.append(Spacer(1, 6*mm))
        E.append(Paragraph('6.1 ' + ('Özel Emisyon Kayıtları' if tr else 'Custom Emission Entries'), S['h2']))
        cr_rows = [['Kaynak' if tr else 'Source', 'Scope', 'Miktar' if tr else 'Qty', 'Birim' if tr else 'Unit', 'kg CO2e']]
        for cr in custom_qs:
            cr_rows.append([cr.source_name[:35], cr.scope.replace('scope', 'S'),
                           f'{float(cr.quantity):,.1f}', cr.unit, _fmt(float(cr.calculated_co2e_kg))])
        crt = Table(cr_rows, colWidths=[50*mm, 15*mm, 25*mm, 20*mm, 30*mm])
        crt.setStyle(_tbl_style(fn, fnb, SCOPE2))
        E.append(crt)
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 7. METHODOLOGY & REFERENCES
    # ════════════════════════════════════════════════
    E.append(Paragraph('7. ' + ('Metodoloji ve Referanslar' if tr else 'Methodology & References'), S['h1']))

    E.append(Paragraph('7.1 ' + ('Standartlar' if tr else 'Standards'), S['h2']))
    for label, val in [
        ('Standart', 'ISO 14064-1:2018, GHG Protocol Corporate Standard'),
        ('Kapsam Sınırı' if tr else 'Boundary', 'Operasyonel kontrol yaklaşımı' if tr else 'Operational control approach'),
        ('Sera Gazları' if tr else 'GHGs', 'CO2, CH4, N2O (CO2e)'),
        ('GWP', 'IPCC AR6 (100-year GWP)'),
        ('Hesaplama' if tr else 'Calculation', 'Emisyon = Faaliyet Verisi × Emisyon Faktörü' if tr else 'Emission = Activity Data × Emission Factor'),
    ]:
        E.append(Paragraph(f'<b>{label}:</b>  {val}', S['body']))
    E.append(Spacer(1, 4*mm))

    E.append(Paragraph('7.2 ' + ('Kapsam Tanımları' if tr else 'Scope Definitions'), S['h2']))
    for scope, desc in [
        ('Scope 1', 'Şirketin sahip olduğu veya kontrol ettiği kaynaklardan doğrudan emisyonlar.' if tr else 'Direct GHG emissions from owned or controlled sources.'),
        ('Scope 2', 'Satın alınan elektrik, buhar, ısıtma ve soğutmadan kaynaklanan dolaylı emisyonlar.' if tr else 'Indirect emissions from purchased electricity, steam, heating and cooling.'),
        ('Scope 3', 'Değer zincirindeki diğer tüm dolaylı emisyonlar (15 kategori).' if tr else 'All other indirect value chain emissions (15 categories).'),
    ]:
        E.append(Paragraph(f'<b>{scope}:</b>  {desc}', S['body']))
    E.append(Spacer(1, 4*mm))

    E.append(Paragraph('7.3 ' + ('Emisyon Faktör Kaynakları' if tr else 'Emission Factor Sources'), S['h2']))
    if sources:
        for i, s in enumerate(sorted(sources), 1):
            E.append(Paragraph(f'{i}. {s}', S['small']))
    else:
        E.append(Paragraph('—', S['small']))
    E.append(Spacer(1, 10*mm))

    # Disclaimer
    E.append(HRFlowable(width='100%', thickness=0.5, color=GRAY_200, spaceAfter=4*mm))
    E.append(Paragraph(
        'GİZLİLİK NOTU: Bu rapor Carbonless platformu tarafından otomatik olarak oluşturulmuştur. Veriler kullanıcı tarafından girilmiş olup, doğruluğu kullanıcının sorumluluğundadır. Üçüncü taraf doğrulaması yapılmamıştır.' if tr else
        'DISCLAIMER: This report was automatically generated by the Carbonless platform. Data was entered by the user and accuracy is the user\'s responsibility. No third-party verification has been performed.',
        S['small']))
    E.append(Spacer(1, 4*mm))
    E.append(Paragraph(
        f'© {year} Carbonless  |  ISO 14064-1:2018  |  {datetime.now().strftime("%d.%m.%Y %H:%M")}',
        S['footer']))

    # Build
    doc.build(E)
    buf.seek(0)
    return buf.getvalue()
