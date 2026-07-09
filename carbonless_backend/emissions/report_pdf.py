"""
ISO 14064-1 Carbon Inventory PDF Report Generator — Premium Edition
Enterprise-grade PDF with:
  - Elegant branded cover with geometric accents
  - Executive summary with large KPI display
  - Scope breakdown with gradient-style bars
  - Category analysis per scope
  - Monthly trend visualization
  - Facility performance breakdown
  - Methodology & compliance section
  - Professional header/footer on every page
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
from .models import EmissionEntry, CustomEmissionRequest, ReductionTarget
try:
    from .scope3_categories import SCOPE3_CATEGORIES, SCOPE3_GHG_NUMBER
except ImportError:
    SCOPE3_CATEGORIES = {}
    SCOPE3_GHG_NUMBER = {}
from companies.utils import get_current_company


# ═══════════════════════════════════════════════════════
# BRAND COLORS
# ═══════════════════════════════════════════════════════
BRAND_DARK = colors.HexColor('#302817')
OLIVE = colors.HexColor('#95A847')
OLIVE_DARK = colors.HexColor('#75863B')
OLIVE_LIGHT = colors.HexColor('#B4BE6A')
CREAM = colors.HexColor('#F9EFE5')
CREAM_LIGHT = colors.HexColor('#FDF8F3')

GRAY_50 = colors.HexColor('#FAFAFA')
GRAY_100 = colors.HexColor('#F5F5F5')
GRAY_200 = colors.HexColor('#E5E5E5')
GRAY_400 = colors.HexColor('#A3A3A3')
GRAY_600 = colors.HexColor('#525252')
GRAY_800 = colors.HexColor('#262626')

SCOPE1_COLOR = OLIVE_DARK
SCOPE1_BG = colors.HexColor('#F2F5E6')
SCOPE2_COLOR = OLIVE
SCOPE2_BG = colors.HexColor('#F5F8EA')
SCOPE3_COLOR = BRAND_DARK
SCOPE3_BG = colors.HexColor('#F8F6F2')

WHITE = colors.white


# ═══════════════════════════════════════════════════════
# FONT REGISTRATION
# ═══════════════════════════════════════════════════════
_font_tried = False
_font_registered = False  # True only when CF/CFB are actually registered

_FONT_CANDIDATES = [
    # Linux / Render (Ubuntu)
    ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
     '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
    ('/usr/share/fonts/dejavu/DejaVuSans.ttf',
     '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'),
    # macOS
    ('/System/Library/Fonts/Helvetica.ttc',
     '/System/Library/Fonts/Helvetica.ttc'),
    # Windows
    (os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'arial.ttf'),
     os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'arialbd.ttf')),
]


def _register_fonts():
    global _font_tried, _font_registered
    if _font_tried:
        return
    _font_tried = True
    for regular, bold in _FONT_CANDIDATES:
        try:
            if os.path.exists(regular):
                pdfmetrics.registerFont(TTFont('CF', regular))
                pdfmetrics.registerFont(TTFont('CFB', bold if os.path.exists(bold) else regular))
                _font_registered = True
                return
        except Exception:
            continue


def _fonts():
    _register_fonts()
    # Fall back to built-in ReportLab fonts — always available, no registration needed
    return ('CF', 'CFB') if _font_registered else ('Helvetica', 'Helvetica-Bold')


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
    S['cover_title'] = ParagraphStyle('ct', fontName=fnb, fontSize=36, textColor=BRAND_DARK, alignment=TA_CENTER, leading=42)
    S['cover_sub'] = ParagraphStyle('cs', fontName=fn, fontSize=13, textColor=GRAY_600, alignment=TA_CENTER, leading=18)
    S['cover_company'] = ParagraphStyle('cc', fontName=fnb, fontSize=22, textColor=BRAND_DARK, alignment=TA_CENTER, leading=28)
    S['cover_date'] = ParagraphStyle('cd', fontName=fn, fontSize=10, textColor=GRAY_400, alignment=TA_CENTER, leading=14)
    S['cover_badge'] = ParagraphStyle('cb', fontName=fnb, fontSize=9, textColor=OLIVE_DARK, alignment=TA_CENTER, leading=12)
    S['h1'] = ParagraphStyle('h1', fontName=fnb, fontSize=18, textColor=BRAND_DARK, spaceBefore=12, spaceAfter=8, leading=22)
    S['h2'] = ParagraphStyle('h2', fontName=fnb, fontSize=12, textColor=OLIVE_DARK, spaceBefore=10, spaceAfter=5, leading=16)
    S['h3'] = ParagraphStyle('h3', fontName=fnb, fontSize=10, textColor=GRAY_600, spaceBefore=6, spaceAfter=3, leading=13)
    S['body'] = ParagraphStyle('body', fontName=fn, fontSize=9.5, textColor=GRAY_800, spaceAfter=4, leading=14)
    S['body_sm'] = ParagraphStyle('body_sm', fontName=fn, fontSize=8.5, textColor=GRAY_600, spaceAfter=3, leading=12)
    S['small'] = ParagraphStyle('small', fontName=fn, fontSize=7.5, textColor=GRAY_400, spaceAfter=2, leading=10)
    S['footer'] = ParagraphStyle('footer', fontName=fn, fontSize=7, textColor=GRAY_400, alignment=TA_CENTER)
    S['big_num'] = ParagraphStyle('bn', fontName=fnb, fontSize=48, textColor=BRAND_DARK, alignment=TA_CENTER, leading=54)
    S['big_label'] = ParagraphStyle('bl', fontName=fnb, fontSize=9, textColor=OLIVE_DARK, alignment=TA_CENTER, leading=12)
    S['kpi_num'] = ParagraphStyle('kn', fontName=fnb, fontSize=24, textColor=BRAND_DARK, alignment=TA_CENTER, leading=30)
    S['kpi_label'] = ParagraphStyle('kl', fontName=fn, fontSize=8, textColor=GRAY_600, alignment=TA_CENTER, leading=11)
    S['kpi_pct'] = ParagraphStyle('kp', fontName=fnb, fontSize=8, textColor=OLIVE, alignment=TA_CENTER, leading=11)
    S['toc'] = ParagraphStyle('toc', fontName=fn, fontSize=11, textColor=GRAY_800, spaceBefore=7, spaceAfter=7, leading=16)
    S['toc_num'] = ParagraphStyle('tocn', fontName=fnb, fontSize=11, textColor=OLIVE_DARK, spaceBefore=7, spaceAfter=7, leading=16)
    S['quote'] = ParagraphStyle('quote', fontName=fn, fontSize=9, textColor=GRAY_600, leftIndent=12, spaceAfter=4, leading=13)
    return S


# ═══════════════════════════════════════════════════════
# TABLE HELPERS
# ═══════════════════════════════════════════════════════
def _tbl_style(fn, fnb, hdr_color=OLIVE_DARK):
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), hdr_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), fnb),
        ('FONTNAME', (0, 1), (-1, -1), fn),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.25, GRAY_200),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_50]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('ROUNDEDCORNERS', [3, 3, 3, 3]),
    ])

def _total_row_style(fnb):
    return TableStyle([
        ('BACKGROUND', (0, -1), (-1, -1), CREAM),
        ('FONTNAME', (0, -1), (-1, -1), fnb),
        ('LINEABOVE', (0, -1), (-1, -1), 1.5, OLIVE),
    ])

def _pct(v, total):
    return f'{v/total*100:.1f}%' if total > 0 else '0.0%'

def _fmt(v):
    return f'{v:,.2f}'

def _fmt4(v):
    return f'{v:,.4f}'


# ═══════════════════════════════════════════════════════
# PAGE TEMPLATES
# ═══════════════════════════════════════════════════════
class _ReportDocTemplate(BaseDocTemplate):
    def __init__(self, buf, company_name, year, lang, **kw):
        super().__init__(buf, **kw)
        self.company_name = company_name
        self.year = year
        self.lang = lang

        frame_cover = Frame(20*mm, 20*mm, A4[0]-40*mm, A4[1]-40*mm, id='cover')
        frame_body = Frame(20*mm, 20*mm, A4[0]-40*mm, A4[1]-48*mm, id='body')

        self.addPageTemplates([
            PageTemplate(id='cover', frames=[frame_cover], onPage=self._cover_page),
            PageTemplate(id='content', frames=[frame_body], onPage=self._content_page),
        ])

    def _cover_page(self, canvas, doc):
        w, h = A4
        # Top accent bar - olive gradient effect
        canvas.setFillColor(OLIVE_DARK)
        canvas.rect(0, h-6*mm, w, 6*mm, fill=1, stroke=0)
        # Thin olive line below
        canvas.setFillColor(OLIVE)
        canvas.rect(0, h-7*mm, w, 1*mm, fill=1, stroke=0)
        # Bottom brand bar
        canvas.setFillColor(BRAND_DARK)
        canvas.rect(0, 0, w, 4*mm, fill=1, stroke=0)
        # Decorative corner elements
        canvas.setStrokeColor(OLIVE_LIGHT)
        canvas.setLineWidth(0.5)
        canvas.line(20*mm, h-25*mm, 50*mm, h-25*mm)
        canvas.line(w-50*mm, h-25*mm, w-20*mm, h-25*mm)
        # Cream background rectangle for content area
        canvas.setFillColor(CREAM_LIGHT)
        canvas.roundRect(25*mm, 30*mm, w-50*mm, h-80*mm, 4*mm, fill=1, stroke=0)

    def _content_page(self, canvas, doc):
        fn, fnb = _fonts()
        w, h = A4
        # Header - thin olive line
        canvas.setStrokeColor(OLIVE)
        canvas.setLineWidth(1.2)
        canvas.line(20*mm, h-15*mm, w-20*mm, h-15*mm)
        # Header left - brand
        canvas.setFont(fnb, 8)
        canvas.setFillColor(OLIVE_DARK)
        canvas.drawString(20*mm, h-13*mm, 'CARBONLESS')
        # Header right - meta
        canvas.setFont(fn, 7)
        canvas.setFillColor(GRAY_400)
        canvas.drawRightString(w-20*mm, h-13*mm, f'ISO 14064-1 \u2022 {self.company_name} \u2022 {self.year}')
        # Footer line
        canvas.setStrokeColor(GRAY_200)
        canvas.setLineWidth(0.4)
        canvas.line(20*mm, 15*mm, w-20*mm, 15*mm)
        # Footer text
        canvas.setFont(fn, 7)
        canvas.setFillColor(GRAY_400)
        page_num = doc.page - 1
        label = 'Sayfa' if self.lang == 'tr' else 'Page'
        canvas.drawCentredString(w/2, 10*mm, f'\u2014  {label} {page_num}  \u2014')
        canvas.drawString(20*mm, 10*mm, 'Carbonless Platform')
        canvas.drawRightString(w-20*mm, 10*mm, datetime.now().strftime('%d.%m.%Y'))


# ═══════════════════════════════════════════════════════
# MAIN GENERATOR
# ═══════════════════════════════════════════════════════
def generate_report(user, year, lang='tr'):
    """Generate premium ISO 14064-1 PDF report. Returns bytes."""
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

    fac_data = entries.exclude(facility__isnull=True).values(
        'facility__name'
    ).annotate(total=Sum('calculated_co2e_kg')).order_by('-total')

    sources = set()
    for e in entries:
        if e.emission_factor.reference:
            sources.add(e.emission_factor.reference[:120])

    entry_count = entries.count()
    total_t = total_kg / 1000

    # ── Readiness / Compliance / AI Insights ──────────
    # Mirrors ReportingTab.jsx's client-side `checks`/`compliance`/`InsightItem`
    # logic exactly (same conditions, same data sources) so the PDF a user
    # downloads matches what the Reporting tab shows on screen — these cards
    # previously existed only in the UI and were absent from every export.
    targets_qs = ReductionTarget.objects.filter(company=company) if company else ReductionTarget.objects.none()
    targets_count = targets_qs.count()

    from questionnaire.models import QuestionnaireSession, CarbonReport as _CarbonReport
    questionnaire_complete = QuestionnaireSession.objects.filter(user=user, is_complete=True).exists()
    if not questionnaire_complete and company:
        questionnaire_complete = _CarbonReport.objects.filter(
            company=company, status=_CarbonReport.Status.COMPLETED
        ).exists()

    readiness_checks = [
        (questionnaire_complete, 'Anket tamamlandı' if tr else 'Questionnaire completed'),
        (entry_count > 0, 'Emisyon verisi girildi' if tr else 'Emission data entered'),
        (entry_count >= 5, 'Yeterli veri (5+ kayıt)' if tr else 'Sufficient data (5+ entries)'),
        (total_kg > 0, 'Scope haritalama tamam' if tr else 'Scope mapping complete'),
        (targets_count > 0, 'Azaltma hedefi belirlendi' if tr else 'Reduction target set'),
    ]
    readiness_pct = round(sum(1 for done, _ in readiness_checks if done) / len(readiness_checks) * 100)

    # Mirrors frontend exactly: entries.some(e => e.proof_document)
    has_evidence = entries.exclude(proof_document='').exclude(proof_document__isnull=True).exists()
    compliance_checks = [
        (entry_count > 0 and total_kg > 0, 'ISO 14064-1'),
        (entry_count > 0 and total_kg > 0, 'GHG Protocol'),
        (has_evidence, 'Kanıt eklendi' if tr else 'Evidence attached'),
        (readiness_pct >= 80, 'Denetim hazır' if tr else 'Audit ready'),
    ]

    ai_insights = []
    if total_kg > 0:
        s1_pct = (s1 / total_kg * 100) if s1 > 0 else 0
        ai_insights.append((
            f"Scope 1 toplam emisyonun %{s1_pct:.0f}'ini oluşturuyor." if tr
            else f"Scope 1 accounts for {s1_pct:.0f}% of total emissions.",
            'info'
        ))
        if s2 > s1:
            ai_insights.append((
                'Elektrik tüketimi Scope 2\'de baskın.' if tr else 'Electricity consumption dominates Scope 2.',
                'info'
            ))
        if entry_count < 10:
            ai_insights.append((
                'Daha fazla veri girişi rapor kalitesini artırır.' if tr else 'More data entries will improve report quality.',
                'warning'
            ))
        if entries.filter(emission_factor__category__in=[
            'transport', 'business_travel', 'employee_commuting', 'mobile_combustion'
        ]).exists():
            ai_insights.append((
                'Ulaşım aktivitelerinde azaltma potansiyeli tespit edildi.' if tr
                else 'Reduction potential detected in transport activities.',
                'info'
            ))
        if s3 > s1 + s2:
            ai_insights.append((
                'Scope 3 emisyonları baskın — tedarik zinciri odaklı azaltma önerilir.' if tr
                else 'Scope 3 dominates — consider supply chain focused reductions.',
                'info'
            ))
    else:
        ai_insights.append((
            'Veri girildikten sonra AI analizi burada görünecek.' if tr
            else 'AI analysis will appear here after data entry.',
            'neutral'
        ))

    # ── Pre-computed bilingual labels (avoids \u in f-string expressions, Python < 3.12) ──
    _yr   = 'Raporlama Yılı' if tr else 'Reporting Year'
    _per  = 'Raporlama Dönemi' if tr else 'Reporting Period'
    _dat  = 'Rapor Tarihi' if tr else 'Report Date'
    _cfid = ('GİZLİ — Bu rapor yalnızca yetkili kişiler içindir.'
             if tr else 'CONFIDENTIAL — This report is for authorized personnel only.')
    _tent = 'Toplam kayıt' if tr else 'Total entries'
    _tem  = 'Toplam emisyon' if tr else 'Total emissions'
    _gen  = 'Oluşturma' if tr else 'Generated'
    _of   = 'firmasının' if tr else 'company’s'
    _body = (
        'yılına ait sera gazı emisyonları ISO 14064-1:2018 standardına uygun olarak '
        'hesaplanmış ve bu raporda sunulmuştur. Hesaplamalar GHG Protocol Kurumsal '
        'Standardı çerçevesinde, operasyonel kontrol yaklaşımı kullanılarak yapılmıştır.'
        if tr else
        'greenhouse gas emissions have been calculated in accordance with ISO 14064-1:2018 and are '
        'presented in this report. Calculations follow the GHG Protocol Corporate Standard using '
        'the operational control approach.'
    )
    _peak = 'En yüksek emisyon ayı' if tr else 'Peak emission month'

    # ── Build PDF ───────────────────────────────────
    buf = io.BytesIO()
    doc = _ReportDocTemplate(buf, cname, year, lang, pagesize=A4,
                              leftMargin=20*mm, rightMargin=20*mm,
                              topMargin=22*mm, bottomMargin=20*mm)
    E = []

    # ════════════════════════════════════════════════
    # COVER PAGE
    # ════════════════════════════════════════════════
    E.append(Spacer(1, 45*mm))
    E.append(Paragraph('CARBONLESS', S['cover_title']))
    E.append(Spacer(1, 4*mm))
    E.append(Paragraph(
        'Sera Gaz\u0131 Envanteri Raporu' if tr else 'Greenhouse Gas Inventory Report', S['cover_sub']))
    E.append(Paragraph('ISO 14064-1:2018', S['cover_badge']))
    E.append(Spacer(1, 18*mm))
    E.append(HRFlowable(width='40%', thickness=2, color=OLIVE, spaceAfter=12*mm))
    E.append(Paragraph(cname, S['cover_company']))
    E.append(Spacer(1, 8*mm))
    E.append(Paragraph(f"{_yr}: {year}", S['cover_date']))
    E.append(Paragraph(f"{_per}: 01.01.{year} \u2013 31.12.{year}", S['cover_date']))
    E.append(Paragraph(f"{_dat}: {datetime.now().strftime('%d.%m.%Y')}", S['cover_date']))
    E.append(Spacer(1, 20*mm))
    E.append(Paragraph(_cfid, S['small']))
    E.append(NextPageTemplate('content'))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ════════════════════════════════════════════════
    E.append(Paragraph('\u0130\u00e7indekiler' if tr else 'Table of Contents', S['h1']))
    E.append(Spacer(1, 3*mm))
    toc_items = [
        ('1', 'Y\u00f6netici \u00d6zeti' if tr else 'Executive Summary'),
        ('2', 'Kapsam Da\u011f\u0131l\u0131m\u0131' if tr else 'Scope Distribution'),
        ('3', 'Kategori Analizi' if tr else 'Category Analysis'),
        ('4', 'Ayl\u0131k Trend' if tr else 'Monthly Trend'),
        ('5', 'Tesis Performans\u0131' if tr else 'Facility Performance'),
        ('6', 'Detayl\u0131 Kay\u0131tlar' if tr else 'Detailed Records'),
        ('7', 'Metodoloji ve Uyumluluk' if tr else 'Methodology & Compliance'),
        ('8', 'Rapor Haz\u0131rl\u0131\u011f\u0131 ve Uyumluluk Durumu' if tr else 'Report Readiness & Compliance Status'),
        ('9', 'AI Analizi ve \u00d6neriler' if tr else 'AI Analysis & Recommendations'),
    ]
    for num, title in toc_items:
        E.append(Paragraph(f'<font color="#{OLIVE_DARK.hexval()[2:]}">{num}.</font>  {title}', S['toc']))
    E.append(Spacer(1, 6*mm))
    E.append(HRFlowable(width='100%', thickness=0.5, color=GRAY_200, spaceAfter=4*mm))
    E.append(Paragraph(
        f"{_tent}: {entry_count}  \u2022  "
        f"{_tem}: {total_t:,.2f} tCO\u2082e  \u2022  "
        f"{_gen}: {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        S['body_sm']))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 1. EXECUTIVE SUMMARY
    # ════════════════════════════════════════════════
    E.append(Paragraph('1. ' + ('Y\u00f6netici \u00d6zeti' if tr else 'Executive Summary'), S['h1']))
    E.append(Paragraph(f"{cname} {_of} {year} {_body}", S['body']))
    E.append(Spacer(1, 8*mm))

    # Total KPI - large centered
    kpi_main = Table([
        [Paragraph(f'{total_t:,.2f}', S['big_num'])],
        [Paragraph(('TOPLAM EM\u0130SYONLAR' if tr else 'TOTAL EMISSIONS') + ' (tCO\u2082e)', S['big_label'])],
    ], colWidths=[150*mm])
    kpi_main.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CREAM),
        ('BOX', (0, 0), (-1, -1), 1.5, OLIVE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 14),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    E.append(kpi_main)
    E.append(Spacer(1, 6*mm))

    # 3 scope cards
    scope_cards = Table([
        [Paragraph(f'{s1/1000:,.2f}', S['kpi_num']),
         Paragraph(f'{s2/1000:,.2f}', S['kpi_num']),
         Paragraph(f'{s3/1000:,.2f}', S['kpi_num'])],
        [Paragraph('Scope 1 (tCO\u2082e)', S['kpi_label']),
         Paragraph('Scope 2 (tCO\u2082e)', S['kpi_label']),
         Paragraph('Scope 3 (tCO\u2082e)', S['kpi_label'])],
        [Paragraph(_pct(s1, total_kg), S['kpi_pct']),
         Paragraph(_pct(s2, total_kg), S['kpi_pct']),
         Paragraph(_pct(s3, total_kg), S['kpi_pct'])],
    ], colWidths=[53*mm]*3)
    scope_cards.setStyle(TableStyle([
        ('BOX', (0, 0), (0, -1), 0.8, SCOPE1_COLOR),
        ('BOX', (1, 0), (1, -1), 0.8, SCOPE2_COLOR),
        ('BOX', (2, 0), (2, -1), 0.8, SCOPE3_COLOR),
        ('BACKGROUND', (0, 0), (0, -1), SCOPE1_BG),
        ('BACKGROUND', (1, 0), (1, -1), SCOPE2_BG),
        ('BACKGROUND', (2, 0), (2, -1), SCOPE3_BG),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 10),
        ('ROUNDEDCORNERS', [3, 3, 3, 3]),
    ]))
    E.append(scope_cards)
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 2. SCOPE DISTRIBUTION
    # ════════════════════════════════════════════════
    E.append(Paragraph('2. ' + ('Kapsam Da\u011f\u0131l\u0131m\u0131' if tr else 'Scope Distribution'), S['h1']))

    scope_tbl = [
        ['Scope', 'A\u00e7\u0131klama' if tr else 'Description', 'kg CO\u2082e', 'tCO\u2082e', '%'],
        ['Scope 1', 'Do\u011frudan Emisyonlar' if tr else 'Direct Emissions', _fmt(s1), _fmt4(s1/1000), _pct(s1, total_kg)],
        ['Scope 2', 'Enerji Dolayl\u0131' if tr else 'Energy Indirect', _fmt(s2), _fmt4(s2/1000), _pct(s2, total_kg)],
        ['Scope 3', 'Di\u011fer Dolayl\u0131' if tr else 'Other Indirect', _fmt(s3), _fmt4(s3/1000), _pct(s3, total_kg)],
        ['TOPLAM' if tr else 'TOTAL', '', _fmt(total_kg), _fmt4(total_t), '100%'],
    ]
    st = Table(scope_tbl, colWidths=[22*mm, 52*mm, 32*mm, 28*mm, 16*mm])
    st.setStyle(_tbl_style(fn, fnb))
    st.setStyle(_total_row_style(fnb))
    E.append(st)
    E.append(Spacer(1, 8*mm))

    # Visual bars
    if total_kg > 0:
        E.append(Paragraph('2.1 ' + ('G\u00f6rsel Da\u011f\u0131l\u0131m' if tr else 'Visual Distribution'), S['h2']))
        for label, val, clr in [('Scope 1', s1, SCOPE1_COLOR), ('Scope 2', s2, SCOPE2_COLOR), ('Scope 3', s3, SCOPE3_COLOR)]:
            p = val / total_kg * 100
            bar_w = max(p * 1.4, 4)
            E.append(Paragraph(f'<b>{label}</b>  \u2014  {val/1000:,.2f} tCO\u2082e  ({p:.1f}%)', S['body']))
            bar = Table([['']],  colWidths=[bar_w*mm], rowHeights=[6*mm])
            bar.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), clr),
                ('ROUNDEDCORNERS', [3, 3, 3, 3]),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))
            E.append(bar)
            E.append(Spacer(1, 4*mm))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 3. CATEGORY ANALYSIS
    # ════════════════════════════════════════════════
    E.append(Paragraph('3. ' + ('Kategori Analizi' if tr else 'Category Analysis'), S['h1']))
    if cats:
        for scope_key, scope_label, scope_color in [
            ('scope1', 'Scope 1 \u2014 ' + ('Do\u011frudan' if tr else 'Direct'), SCOPE1_COLOR),
            ('scope2', 'Scope 2 \u2014 ' + ('Enerji Dolayl\u0131' if tr else 'Energy Indirect'), SCOPE2_COLOR),
            ('scope3', 'Scope 3 \u2014 ' + ('Di\u011fer Dolayl\u0131' if tr else 'Other Indirect'), SCOPE3_COLOR),
        ]:
            scope_cats = [c for c in cats if c['emission_factor__scope'] == scope_key]
            if not scope_cats:
                continue
            E.append(Paragraph(scope_label, S['h2']))
            data = [['Kategori' if tr else 'Category', 'kg CO\u2082e', 'tCO\u2082e', '%']]
            scope_total = sum(float(c['total']) for c in scope_cats)
            for c in scope_cats:
                t = float(c['total'])
                data.append([
                    cl.get(c['emission_factor__category'], c['emission_factor__category']),
                    _fmt(t), _fmt4(t/1000), _pct(t, total_kg)
                ])
            data.append(['Alt Toplam' if tr else 'Subtotal', _fmt(scope_total), _fmt4(scope_total/1000), _pct(scope_total, total_kg)])
            ct = Table(data, colWidths=[62*mm, 32*mm, 28*mm, 16*mm])
            ct.setStyle(_tbl_style(fn, fnb, scope_color))
            ct.setStyle(_total_row_style(fnb))
            E.append(ct)
            E.append(Spacer(1, 5*mm))
    else:
        E.append(Paragraph('Bu d\u00f6nem i\u00e7in kategori verisi bulunmamaktad\u0131r.' if tr else 'No category data for this period.', S['body']))

    # ── 3.1 Scope 3 Category Breakdown (ISO 14064-1 completeness) ──
    E.append(Spacer(1, 6*mm))
    E.append(Paragraph(
        '3.1 ' + ('Scope 3 Kategori Dağılımı' if tr else 'Scope 3 Category Breakdown'),
        S['h2']
    ))
    E.append(Paragraph(
        'GHG Protokolü kapsamında 15 Scope 3 kategorisinin tümü aşağıda listelenmiştir. '
        'Sıfır girişi olan kategoriler sınır değerlendirmesinin bütünlüğünü gösterir (ISO 14064-1).'
        if tr else
        'All 15 GHG Protocol Scope 3 categories are listed below. '
        'Categories with zero entries demonstrate completeness of boundary assessment (ISO 14064-1).',
        S['body_sm']
    ))
    E.append(Spacer(1, 3*mm))

    # Build a mapping: ghg_number -> total CO2e from entries
    scope3_entries = entries.filter(emission_factor__scope='scope3')
    scope3_by_cat = {}
    for row in scope3_entries.values('emission_factor__category').annotate(total=Sum('calculated_co2e_kg')):
        cat_key = row['emission_factor__category']
        scope3_by_cat[cat_key] = float(row['total'] or 0)

    # Also include custom entries that are scope3
    for cr in custom_qs.filter(scope='scope3'):
        # Try to map custom entry category to a known key
        cat_key = getattr(cr, 'category', None)
        if cat_key and cat_key in SCOPE3_GHG_NUMBER:
            scope3_by_cat[cat_key] = scope3_by_cat.get(cat_key, 0) + float(cr.calculated_co2e_kg)

    # Build table data for all 15 categories
    s3_breakdown_hdr = [
        '#',
        'Kategori (EN)' if tr else 'Category (EN)',
        'Kategori (TR)' if tr else 'Category (TR)',
        'kg CO\u2082e',
        'tCO\u2082e',
    ]
    s3_breakdown_rows = [s3_breakdown_hdr]
    s3_total_for_breakdown = 0.0

    # Sort SCOPE3_CATEGORIES by ghg_number (1-15)
    sorted_cats = sorted(
        [(k, v) for k, v in SCOPE3_CATEGORIES.items() if v.get('ghg_number') is not None],
        key=lambda x: x[1]['ghg_number']
    )

    for cat_key, cat_meta in sorted_cats:
        ghg_num = cat_meta['ghg_number']
        name_en = cat_meta['name_en']
        name_tr = cat_meta['name_tr']
        cat_total = scope3_by_cat.get(cat_key, 0.0)
        s3_total_for_breakdown += cat_total
        s3_breakdown_rows.append([
            str(ghg_num),
            name_en,
            name_tr,
            _fmt(cat_total),
            _fmt4(cat_total / 1000),
        ])

    # Add total row
    s3_breakdown_rows.append([
        '',
        'TOPLAM' if tr else 'TOTAL',
        '',
        _fmt(s3_total_for_breakdown),
        _fmt4(s3_total_for_breakdown / 1000),
    ])

    s3_tbl = Table(s3_breakdown_rows, colWidths=[8*mm, 50*mm, 50*mm, 28*mm, 22*mm])
    s3_tbl.setStyle(_tbl_style(fn, fnb, SCOPE3_COLOR))
    s3_tbl.setStyle(_total_row_style(fnb))
    E.append(s3_tbl)

    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 4. MONTHLY TREND
    # ════════════════════════════════════════════════
    E.append(Paragraph('4. ' + ('Ayl\u0131k Trend' if tr else 'Monthly Trend'), S['h1']))
    if any(m > 0 for m in monthly):
        mt_data = [
            [''] + months,
            ['tCO\u2082e'] + [f'{m/1000:,.3f}' if m > 0 else '\u2014' for m in monthly],
        ]
        mt = Table(mt_data, colWidths=[16*mm] + [12.5*mm]*12)
        mt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), OLIVE_DARK),
            ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
            ('BACKGROUND', (0, 1), (0, -1), GRAY_100),
            ('FONTNAME', (0, 0), (-1, -1), fn),
            ('FONTNAME', (0, 0), (0, -1), fnb),
            ('FONTSIZE', (0, 0), (-1, -1), 7.5),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.25, GRAY_200),
            ('ROWBACKGROUNDS', (1, 1), (-1, -1), [WHITE, GRAY_50]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('ROUNDEDCORNERS', [3, 3, 3, 3]),
        ]))
        E.append(mt)
        E.append(Spacer(1, 4*mm))
        max_m = max(range(12), key=lambda i: monthly[i])
        if monthly[max_m] > 0:
            E.append(Paragraph(
                f"\u25cf {_peak}: <b>{months[max_m]}</b> ({monthly[max_m]/1000:,.3f} tCO\u2082e)",
                S['body']))
    else:
        E.append(Paragraph('Ayl\u0131k veri bulunmamaktad\u0131r.' if tr else 'No monthly data available.', S['body']))
    E.append(Spacer(1, 6*mm))

    # ════════════════════════════════════════════════
    # 5. FACILITY PERFORMANCE
    # ════════════════════════════════════════════════
    E.append(Paragraph('5. ' + ('Tesis Performans\u0131' if tr else 'Facility Performance'), S['h1']))
    if fac_data:
        fd = [['Tesis' if tr else 'Facility', 'kg CO\u2082e', 'tCO\u2082e', '%']]
        for f in fac_data:
            t = float(f['total'])
            fd.append([f['facility__name'] or '\u2014', _fmt(t), _fmt4(t/1000), _pct(t, total_kg)])
        ft = Table(fd, colWidths=[62*mm, 32*mm, 28*mm, 16*mm])
        ft.setStyle(_tbl_style(fn, fnb, OLIVE))
        E.append(ft)
    else:
        E.append(Paragraph('Tesis bazl\u0131 veri bulunmamaktad\u0131r.' if tr else 'No facility-level data available.', S['body']))
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 6. DETAILED RECORDS
    # ════════════════════════════════════════════════
    E.append(Paragraph('6. ' + ('Detayl\u0131 Kay\u0131tlar' if tr else 'Detailed Records'), S['h1']))
    if entries.exists():
        hdr = ['Kaynak' if tr else 'Source', 'Scope', 'Ay' if tr else 'Mo',
               'Miktar' if tr else 'Qty', 'Birim' if tr else 'Unit',
               'Fakt\u00f6r' if tr else 'EF', 'kg CO\u2082e']
        rows = [hdr]
        for e in entries[:300]:
            ef = e.emission_factor
            nm = (ef.name_tr if tr and ef.name_tr else ef.name)[:28]
            rows.append([
                nm, ef.scope.replace('scope', 'S'),
                months[e.month-1] if 1 <= e.month <= 12 else str(e.month),
                f'{float(e.quantity):,.1f}', ef.unit,
                f'{float(ef.factor_kg_co2e):.4f}', _fmt(float(e.calculated_co2e_kg)),
            ])
        dt = Table(rows, colWidths=[42*mm, 10*mm, 10*mm, 20*mm, 13*mm, 18*mm, 28*mm])
        dt.setStyle(_tbl_style(fn, fnb))
        E.append(dt)
    else:
        E.append(Paragraph('Bu d\u00f6nem i\u00e7in emisyon kayd\u0131 bulunmamaktad\u0131r.' if tr else 'No emission entries for this period.', S['body']))

    if custom_qs.exists():
        E.append(Spacer(1, 6*mm))
        E.append(Paragraph('6.1 ' + ('\u00d6zel Emisyon Kay\u0131tlar\u0131' if tr else 'Custom Emission Entries'), S['h2']))
        cr_rows = [['Kaynak' if tr else 'Source', 'Scope', 'Miktar' if tr else 'Qty', 'Birim' if tr else 'Unit', 'kg CO\u2082e']]
        for cr in custom_qs:
            cr_rows.append([cr.source_name[:35], cr.scope.replace('scope', 'S'),
                           f'{float(cr.quantity):,.1f}', cr.unit, _fmt(float(cr.calculated_co2e_kg))])
        crt = Table(cr_rows, colWidths=[50*mm, 15*mm, 25*mm, 20*mm, 30*mm])
        crt.setStyle(_tbl_style(fn, fnb, SCOPE2_COLOR))
        E.append(crt)
    E.append(PageBreak())

    # ════════════════════════════════════════════════
    # 7. METHODOLOGY & COMPLIANCE
    # ════════════════════════════════════════════════
    E.append(Paragraph('7. ' + ('Metodoloji ve Uyumluluk' if tr else 'Methodology & Compliance'), S['h1']))

    E.append(Paragraph('7.1 ' + ('Standartlar ve \u00c7er\u00e7eve' if tr else 'Standards & Framework'), S['h2']))
    standards = [
        ('Standart' if tr else 'Standard', 'ISO 14064-1:2018'),
        ('\u00c7er\u00e7eve' if tr else 'Framework', 'GHG Protocol Corporate Standard'),
        ('S\u0131n\u0131r Yakla\u015f\u0131m\u0131' if tr else 'Boundary', 'Operasyonel kontrol' if tr else 'Operational control'),
        ('Sera Gazlar\u0131' if tr else 'GHGs', 'CO\u2082, CH\u2084, N\u2082O (CO\u2082e)'),
        ('GWP', 'IPCC AR6 (100-year)'),
        ('Hesaplama' if tr else 'Calculation', 'Emisyon = Faaliyet Verisi \u00d7 Emisyon Fakt\u00f6r\u00fc' if tr else 'Emission = Activity Data \u00d7 Emission Factor'),
    ]
    for label, val in standards:
        E.append(Paragraph(f'<b>{label}:</b>  {val}', S['body']))
    E.append(Spacer(1, 5*mm))

    E.append(Paragraph('7.2 ' + ('Kapsam Tan\u0131mlar\u0131' if tr else 'Scope Definitions'), S['h2']))
    for scope, desc in [
        ('Scope 1', '\u015eirketin sahip oldu\u011fu veya kontrol etti\u011fi kaynaklardan do\u011frudan emisyonlar.' if tr else 'Direct GHG emissions from owned or controlled sources.'),
        ('Scope 2', 'Sat\u0131n al\u0131nan elektrik, buhar, \u0131s\u0131tma ve so\u011futmadan kaynaklanan dolayl\u0131 emisyonlar.' if tr else 'Indirect emissions from purchased electricity, steam, heating and cooling.'),
        ('Scope 3', 'De\u011fer zincirindeki di\u011fer t\u00fcm dolayl\u0131 emisyonlar (15 kategori).' if tr else 'All other indirect value chain emissions (15 categories).'),
    ]:
        E.append(Paragraph(f'<b>{scope}:</b>  {desc}', S['body']))
    E.append(Spacer(1, 5*mm))

    E.append(Paragraph('7.3 ' + ('Emisyon Fakt\u00f6r Kaynaklar\u0131' if tr else 'Emission Factor Sources'), S['h2']))
    if sources:
        for i, s in enumerate(sorted(sources), 1):
            E.append(Paragraph(f'{i}. {s}', S['body_sm']))
    else:
        E.append(Paragraph('\u2014', S['body_sm']))
    E.append(PageBreak())

    # \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    # 8. REPORT READINESS & COMPLIANCE STATUS
    # \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    E.append(Paragraph('8. ' + ('Rapor Haz\u0131rl\u0131\u011f\u0131 ve Uyumluluk Durumu' if tr else 'Report Readiness & Compliance Status'), S['h1']))

    E.append(Paragraph('8.1 ' + ('Rapor Haz\u0131rl\u0131\u011f\u0131' if tr else 'Report Readiness') + f' \u2014 {readiness_pct}%', S['h2']))
    readiness_tbl_rows = [['', 'Kontrol' if tr else 'Check']]
    for done, label in readiness_checks:
        readiness_tbl_rows.append(['\u2713' if done else '\u2014', label])
    rt = Table(readiness_tbl_rows, colWidths=[10*mm, 130*mm])
    rt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), OLIVE_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), fnb),
        ('FONTNAME', (0, 1), (-1, -1), fn),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('TEXTCOLOR', (0, 1), (0, -1), OLIVE_DARK),
        ('FONTNAME', (0, 1), (0, -1), fnb),
        ('GRID', (0, 0), (-1, -1), 0.25, GRAY_200),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_50]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    E.append(rt)
    E.append(Spacer(1, 8*mm))

    E.append(Paragraph('8.2 ' + ('Uyumluluk Durumu' if tr else 'Compliance Status'), S['h2']))
    compliance_tbl_rows = [['', 'Standart' if tr else 'Standard']]
    for done, label in compliance_checks:
        compliance_tbl_rows.append(['\u2713' if done else '\u2014', label])
    ct2 = Table(compliance_tbl_rows, colWidths=[10*mm, 130*mm])
    ct2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), fnb),
        ('FONTNAME', (0, 1), (-1, -1), fn),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('TEXTCOLOR', (0, 1), (0, -1), OLIVE_DARK),
        ('FONTNAME', (0, 1), (0, -1), fnb),
        ('GRID', (0, 0), (-1, -1), 0.25, GRAY_200),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY_50]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    E.append(ct2)
    E.append(PageBreak())

    # \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    # 9. AI ANALYSIS & RECOMMENDATIONS
    # \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    E.append(Paragraph('9. ' + ('AI Analizi ve \u00d6neriler' if tr else 'AI Analysis & Recommendations'), S['h1']))
    insight_marker = {'warning': '\u26a0', 'neutral': '\u25cb', 'info': '\u25cf'}
    for text, kind in ai_insights:
        E.append(Paragraph(f'{insight_marker.get(kind, "\u25cf")}  {text}', S['body']))
        E.append(Spacer(1, 2*mm))
    E.append(Spacer(1, 10*mm))

    # Disclaimer
    E.append(HRFlowable(width='100%', thickness=0.5, color=GRAY_200, spaceAfter=5*mm))
    E.append(Paragraph(
        'G\u0130ZL\u0130L\u0130K NOTU: Bu rapor Carbonless platformu taraf\u0131ndan otomatik olarak olu\u015fturulmu\u015ftur. Veriler kullan\u0131c\u0131 taraf\u0131ndan girilmi\u015f olup, do\u011frulu\u011fu kullan\u0131c\u0131n\u0131n sorumlulu\u011fundad\u0131r. \u00dc\u00e7\u00fcnc\u00fc taraf do\u011frulamas\u0131 yap\u0131lmam\u0131\u015ft\u0131r.' if tr else
        'DISCLAIMER: This report was automatically generated by the Carbonless platform. Data was entered by the user and accuracy is the user\u2019s responsibility. No third-party verification has been performed.',
        S['small']))
    E.append(Spacer(1, 4*mm))
    E.append(Paragraph(
        f'\u00a9 {year} Carbonless  \u2022  ISO 14064-1:2018  \u2022  {datetime.now().strftime("%d.%m.%Y %H:%M")}',
        S['footer']))

    # Build
    doc.build(E)
    buf.seek(0)
    return buf.getvalue()
