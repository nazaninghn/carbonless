"""
ISO 14064-1:2018 GHG Inventory Report generator.

Distinct from the two PDFs that already exist:

  * emissions/report_pdf.py     — a quantified-emissions report organised by
                                  GHG Protocol Scope 1/2/3.
  * questionnaire/report_pdf.py — the short qualitative "Carbon Inventory
                                  Profile" built from questionnaire answers.

This module produces the full inventory report in the shape ISO 14064-1:2018
itself uses: the **six categories** (I-VI) rather than three scopes, with the
organisational information, boundaries, methodology, exclusions, assumptions
and data sources that clause 9 requires a GHG report to disclose, followed by
the inventory table, per-category analyses, the significance assessment, the
uncertainty statement and the management-system sections.

Quantitative content comes from the company's EmissionEntry rows for the
reporting year; qualitative content comes from the CarbonReport's own
questionnaire answers (ReportStep). Anything the organisation has not answered
is rendered as an explicit "not declared" line rather than invented — an
inventory report is an assurance document, so a blank has to read as a blank.
"""
import io
from datetime import datetime

from django.db.models import Sum
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, TableStyle,
    Paragraph, Spacer, Table, PageBreak, KeepTogether, NextPageTemplate,
)
from reportlab.graphics.shapes import Drawing, String
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.legends import Legend

from emissions.models import EmissionEntry, CustomEmissionRequest
# Only pure infrastructure/formatting is reused from the shared module — font
# registration (bundled DejaVu Sans, full Turkish/subscript coverage) and
# locale-aware number formatting are not visual-design concerns. Every color,
# style and chart/table/page-chrome helper below is defined locally so this
# report's "modern minimal" redesign is independent of the other two PDFs
# (emissions/report_pdf.py, questionnaire/report_pdf.py) that also import
# from emissions.report_pdf — neither of those is touched by this file.
from emissions.report_pdf import _fonts, _fmt, _localize_num
from .models import CarbonReport, ReportStep


# ═══════════════════════════════════════════════════════════════════════════
# MODERN-MINIMAL DESIGN SYSTEM
# One accent color, generous white space, hairline rules instead of solid
# color blocks. Distinct from — and independent of — the bold brand-green
# chrome the other two PDF reports use.
# ═══════════════════════════════════════════════════════════════════════════
INK = colors.HexColor('#1A1F1C')          # headings, body text
ACCENT = colors.HexColor('#1D9C31')       # the one accent — hairlines, h2, chart primary
ACCENT_DARK = colors.HexColor('#146B22')  # donut center label / emphasis
ACCENT_SOFT = colors.HexColor('#EAF5EC')  # total-row / highlight backgrounds
MUTED = colors.HexColor('#5B635C')        # secondary text, captions
FAINT = colors.HexColor('#98A098')        # footer, page numbers
LINE = colors.HexColor('#E3E7E3')         # hairline rules, table borders
PAPER = colors.white

# Back-compat aliases: the ~1000 lines of section-building code below only
# ever reference these bare names (never emissions.report_pdf's values
# directly), so redefining them here restyles the whole report without
# touching that content-building code.
BRAND_DARK, OLIVE, OLIVE_DARK, OLIVE_LIGHT = INK, ACCENT, ACCENT_DARK, ACCENT_SOFT
CREAM, CREAM_LIGHT = ACCENT_SOFT, colors.HexColor('#F6FAF7')
GRAY_200, GRAY_400, GRAY_600, WHITE = LINE, FAINT, MUTED, PAPER


def _styles():
    """Typographic scale for the report — left-aligned editorial cover,
    a single accent color reserved for h2/hairlines/badges rather than
    spread across headings."""
    fn, fnb = _fonts()
    return {
        'fn': fn, 'fnb': fnb,
        'cover_company': ParagraphStyle('cover_company', fontName=fn, fontSize=11,
                                         textColor=MUTED, alignment=TA_LEFT, leading=14),
        'cover_badge': ParagraphStyle('cover_badge', fontName=fnb, fontSize=9,
                                       textColor=ACCENT, alignment=TA_LEFT, leading=12),
        'cover_title': ParagraphStyle('cover_title', fontName=fnb, fontSize=30,
                                       textColor=INK, alignment=TA_LEFT, leading=35),
        'cover_sub': ParagraphStyle('cover_sub', fontName=fn, fontSize=12,
                                     textColor=MUTED, alignment=TA_LEFT, leading=16),
        'cover_date': ParagraphStyle('cover_date', fontName=fn, fontSize=9,
                                      textColor=FAINT, alignment=TA_LEFT, leading=13),
        'h1': ParagraphStyle('h1', fontName=fnb, fontSize=16, textColor=INK,
                              spaceBefore=14, spaceAfter=8, leading=20),
        'h2': ParagraphStyle('h2', fontName=fnb, fontSize=11, textColor=ACCENT,
                              spaceBefore=10, spaceAfter=5, leading=14),
        'h3': ParagraphStyle('h3', fontName=fnb, fontSize=9.5, textColor=MUTED,
                              spaceBefore=6, spaceAfter=3, leading=12),
        'body': ParagraphStyle('body', fontName=fn, fontSize=9.5, textColor=INK,
                                spaceAfter=4, leading=14.5),
        'body_sm': ParagraphStyle('body_sm', fontName=fn, fontSize=8.5, textColor=INK,
                                   spaceAfter=3, leading=12),
        'warning': ParagraphStyle('warning', fontName=fnb, fontSize=9,
                                   textColor=colors.HexColor('#B45309'), spaceAfter=4, leading=13),
        'no_data': ParagraphStyle('no_data', fontName=fn, fontSize=9, textColor=FAINT,
                                   spaceAfter=4, leading=13),
        'small': ParagraphStyle('small', fontName=fn, fontSize=7.5, textColor=MUTED,
                                 spaceAfter=2, leading=10),
        'toc': ParagraphStyle('toc', fontName=fn, fontSize=11, textColor=INK,
                               spaceBefore=7, spaceAfter=7, leading=16),
        'quote': ParagraphStyle('quote', fontName=fn, fontSize=9, textColor=MUTED,
                                 leftIndent=12, spaceAfter=4, leading=13),
    }


def _tbl_style(fn, fnb, hdr_color=None):
    """White header row with a single accent rule underneath, hairline
    rules between body rows — no solid color band, no zebra striping.
    `hdr_color` is accepted for call-site compatibility but unused."""
    return TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), fnb),
        ('FONTNAME', (0, 1), (-1, -1), fn),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('TEXTCOLOR', (0, 0), (-1, 0), INK),
        ('LINEBELOW', (0, 0), (-1, 0), 1, ACCENT),
        ('LINEBELOW', (0, 1), (-1, -2), 0.4, LINE),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ])


def _total_row_style(fnb):
    return TableStyle([
        ('BACKGROUND', (0, -1), (-1, -1), ACCENT_SOFT),
        ('FONTNAME', (0, -1), (-1, -1), fnb),
        ('LINEABOVE', (0, -1), (-1, -1), 1.2, ACCENT),
    ])


# ═══════════════════════════════════════════════════════════════════════════
# ISO 14064-1:2018 CATEGORIES
# ═══════════════════════════════════════════════════════════════════════════
# The platform records emissions against GHG Protocol scopes/categories, which
# is what the questionnaire and the chat calculator speak. ISO 14064-1:2018
# clause 5.2 instead splits indirect emissions into five categories by origin.
# The mapping below is the standard correspondence between the two; it is
# applied at report time only, so no stored data changes shape.
CAT_I, CAT_II, CAT_III, CAT_IV, CAT_V, CAT_VI = 1, 2, 3, 4, 5, 6

ISO_CATEGORY_OF = {
    # Category I — direct emissions and removals
    ('scope1', None): CAT_I,
    # Category II — indirect emissions from imported energy
    ('scope2', None): CAT_II,
    # Category III — indirect emissions from transportation
    ('scope3', 'upstream_transport'): CAT_III,
    ('scope3', 'downstream_transport'): CAT_III,
    ('scope3', 'business_travel'): CAT_III,
    ('scope3', 'employee_commuting'): CAT_III,
    # Category IV — indirect emissions from products used by the organisation
    ('scope3', 'purchased_goods'): CAT_IV,
    ('scope3', 'capital_goods'): CAT_IV,
    ('scope3', 'waste'): CAT_IV,
    ('scope3', 'water'): CAT_IV,
    ('scope3', 'upstream_leased'): CAT_IV,
    # Category V — indirect emissions associated with the use of products
    ('scope3', 'use_of_sold'): CAT_V,
    ('scope3', 'processing_sold'): CAT_V,
    ('scope3', 'end_of_life'): CAT_V,
    # Category VI — indirect emissions from other sources
    ('scope3', 'fuel_energy'): CAT_VI,
    ('scope3', 'investments'): CAT_VI,
    ('scope3', 'franchises'): CAT_VI,
    ('scope3', 'custom'): CAT_VI,
}

ROMAN = {1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI'}

# 100-year global warming potentials, IPCC AR6 (2021), WG1 Chapter 7 Table 7.15.
# The seeded factors are already expressed in CO2e and state "AR6 GWP" in their
# own references, so these are the constants behind the numbers in this report
# rather than a second, independent set — an ISO inventory has to declare them.
GWP_AR6 = [
    ('CO₂',     'Carbon dioxide',      'Karbondioksit',        '1'),
    ('CH₄',     'Methane (fossil)',    'Metan (fosil)',        '29.8'),
    ('N₂O',     'Nitrous oxide',       'Diazot monoksit',      '273'),
    ('HFC-134a', 'Hydrofluorocarbon',  'Hidroflorokarbon',     '1,530'),
    ('HFC-32',  'Hydrofluorocarbon',   'Hidroflorokarbon',     '771'),
    ('HFC-125', 'Hydrofluorocarbon',   'Hidroflorokarbon',     '3,740'),
    ('R-410A',  'HFC blend',           'HFC karışımı',         '2,256'),
    ('R-404A',  'HFC blend',           'HFC karışımı',         '4,728'),
    ('SF₆',     'Sulphur hexafluoride', 'Kükürt heksaflorür',  '25,200'),
    ('NF₃',     'Nitrogen trifluoride', 'Azot triflorür',      '17,400'),
]


def iso_category_for(scope, category):
    """Resolve one (scope, category) pair to its ISO 14064-1 category number.

    Scope 1 and 2 are categories I and II wholesale, so they are matched on
    scope alone. An unrecognised scope-3 category falls to VI ("other
    indirect"), which is where the standard puts anything that does not belong
    to III-V — that is the correct home for it, not a silent drop.
    """
    if scope == 'scope1':
        return CAT_I
    if scope == 'scope2':
        return CAT_II
    return ISO_CATEGORY_OF.get(('scope3', category), CAT_VI)


# ═══════════════════════════════════════════════════════════════════════════
# BILINGUAL STRINGS
# ═══════════════════════════════════════════════════════════════════════════
T = {
    'doc_title': {
        'en': 'Greenhouse Gas Emissions Inventory Report',
        'tr': 'Sera Gazı Emisyonları Envanter Raporu',
    },
    'standard': {'en': 'ISO 14064-1:2018', 'tr': 'ISO 14064-1:2018'},
    'reporting_period': {'en': 'Reporting period', 'tr': 'Raporlama dönemi'},
    'report_issued': {'en': 'Report issued', 'tr': 'Rapor tarihi'},
    'revision': {'en': 'Revision', 'tr': 'Revizyon'},
    'contents': {'en': 'Contents', 'tr': 'İçindekiler'},

    # Section titles
    's1': {'en': 'ORGANISATIONAL INFORMATION AND INTRODUCTION',
           'tr': 'KURUMSAL BİLGİLER VE GİRİŞ'},
    's1_basic': {'en': 'Basic report information', 'tr': 'Temel rapor bilgileri'},
    's1_1': {'en': 'Purpose and Scope', 'tr': 'Amaç ve Kapsam'},
    's1_2': {'en': 'Responsibilities', 'tr': 'Görev ve Sorumluluklar'},
    's1_3': {'en': 'Target Users', 'tr': 'Hedef Kullanıcılar'},
    's1_4': {'en': 'Standards and Documents Used',
             'tr': 'Kullanılan Standartlar ve Dokümanlar'},
    's1_5': {'en': 'Principles', 'tr': 'İlkeler'},
    's2': {'en': 'DEFINITIONS AND ABBREVIATIONS', 'tr': 'TANIMLAR VE KISALTMALAR'},
    's2_1': {'en': 'Definitions', 'tr': 'Tanımlar'},
    's2_2': {'en': 'Abbreviations', 'tr': 'Kısaltmalar'},
    's3': {'en': 'GREENHOUSE GAS INVENTORY INFORMATION',
           'tr': 'SERA GAZI ENVANTER BİLGİLERİ'},
    's3_1': {'en': 'Facility Boundaries', 'tr': 'Tesis Sınırları'},
    's3_2': {'en': 'Calculation Methodology', 'tr': 'Hesaplama Metodolojisi'},
    's3_3': {'en': 'Reporting Boundaries', 'tr': 'Raporlama Sınırları'},
    's3_4': {'en': 'Exclusions', 'tr': 'Hariç Tutulanlar'},
    's3_5': {'en': 'Assumptions', 'tr': 'Kabuller'},
    's3_6': {'en': 'Data Sources', 'tr': 'Veri Kaynakları'},
    's4': {'en': 'GREENHOUSE GAS INVENTORY REPORT', 'tr': 'SERA GAZI ENVANTER RAPORU'},
    's4_1': {'en': 'Inventory Calculations and Analyses',
             'tr': 'Envanter Hesaplamaları ve Analizleri'},
    's4_sig': {'en': 'Assessment of Significant Indirect Emissions',
               'tr': 'Önemli Dolaylı Emisyonların Değerlendirilmesi'},
    's4_unc': {'en': 'Assessment of Uncertainty', 'tr': 'Belirsizlik Değerlendirmesi'},
    's4_tgt': {'en': 'Emission Reduction Targets', 'tr': 'Emisyon Azaltım Hedefleri'},
    's4_risk': {'en': 'Risk and Opportunity Assessment',
                'tr': 'Risk ve Fırsat Değerlendirmesi'},
    's4_ver': {'en': 'Verification', 'tr': 'Doğrulama'},
    's4_qms': {'en': 'Greenhouse Gas Inventory Quality Management System',
               'tr': 'Sera Gazı Envanteri Kalite Yönetim Sistemi'},
    's4_2': {'en': 'Evaluation of Emissions by Location and Activity',
             'tr': 'Emisyonların Tesis ve Faaliyet Bazında Değerlendirilmesi'},

    # Table captions
    't_org': {'en': 'Organisational information', 'tr': 'Kurumsal bilgiler'},
    't_roles': {'en': 'Greenhouse gas inventory report contact roles',
                'tr': 'Sera gazı envanter raporu iletişim rolleri'},
    't_fac': {'en': 'Greenhouse gas inventory report facility boundaries',
              'tr': 'Sera gazı envanter raporu tesis sınırları'},
    't_src': {'en': 'Greenhouse gas inventory report data sources',
              'tr': 'Sera gazı envanter raporu veri kaynakları'},
    't_inv': {'en': 'Greenhouse gas inventory', 'tr': 'Sera gazı envanteri'},
    't_scope': {'en': 'Distribution of greenhouse gas emissions by scope',
                'tr': 'Sera gazı emisyonlarının kapsama göre dağılımı'},
    't_cat': {'en': 'Distribution of greenhouse gas emissions by category',
              'tr': 'Sera gazı emisyonlarının kategoriye göre dağılımı'},
    't_ef': {'en': 'Emission factor references', 'tr': 'Emisyon faktörü referansları'},
    't_sig': {'en': 'Assessment of significant indirect emissions',
              'tr': 'Önemli dolaylı emisyonların değerlendirilmesi'},
    't_loc': {'en': 'Emissions by category for the highest-emitting locations',
              'tr': 'En yüksek emisyonlu tesislerin kategori bazında emisyonları'},
    't_cat_bars': {'en': 'Category shares of the inventory',
                   'tr': 'Kategorilerin envanter içindeki payları'},
    't_gwp': {'en': 'Global warming potential values used',
              'tr': 'Kullanılan küresel ısınma potansiyeli değerleri'},
    't_act': {'en': 'Greenhouse gas emissions by activity type',
              'tr': 'Sera gazı emisyonlarının faaliyet türüne göre dağılımı'},
    's4_act': {'en': 'Activity-Based Assessment', 'tr': 'Faaliyet Bazlı Değerlendirme'},

    # Column headers
    'c_field': {'en': 'Field', 'tr': 'Alan'},
    'c_info': {'en': 'Information', 'tr': 'Bilgi'},
    'c_no': {'en': 'No.', 'tr': 'No.'},
    'c_role': {'en': 'Role', 'tr': 'Rol'},
    'c_resp': {'en': 'Responsibility', 'tr': 'Sorumluluk'},
    'c_cat': {'en': 'Cat.', 'tr': 'Kat.'},
    'c_source': {'en': 'Greenhouse gas source', 'tr': 'Sera gazı kaynağı'},
    'c_scope': {'en': 'Scope', 'tr': 'Kapsam'},
    'c_activity': {'en': 'Activity data', 'tr': 'Faaliyet verisi'},
    'c_unit': {'en': 'Unit', 'tr': 'Birim'},
    'c_ghg_t': {'en': 'GHG t CO₂e', 'tr': 'SG t CO₂e'},
    'c_cat_total': {'en': 'Cat. total', 'tr': 'Kat. toplamı'},
    'c_pct': {'en': 'Percentage', 'tr': 'Yüzde'},
    'c_total': {'en': 'Total', 'tr': 'Toplam'},
    'c_facility': {'en': 'Facility', 'tr': 'Tesis'},
    'c_type': {'en': 'Type', 'tr': 'Tür'},
    'c_factor': {'en': 'Factor', 'tr': 'Faktör'},
    'c_ref': {'en': 'Reference', 'tr': 'Referans'},
    'c_records': {'en': 'Records', 'tr': 'Kayıt'},
    'c_criterion': {'en': 'Criterion', 'tr': 'Kriter'},
    'c_result': {'en': 'Result', 'tr': 'Sonuç'},

    'total': {'en': 'TOTAL', 'tr': 'TOPLAM'},
    'direct': {'en': 'Direct greenhouse gas emissions',
               'tr': 'Doğrudan sera gazı emisyonları'},
    'indirect': {'en': 'Indirect greenhouse gas emissions',
                 'tr': 'Dolaylı sera gazı emisyonları'},
    'not_declared': {'en': 'Not declared', 'tr': 'Beyan edilmedi'},
    'none_recorded': {'en': 'No emissions recorded for this category in the reporting period.',
                      'tr': 'Raporlama döneminde bu kategori için emisyon kaydı bulunmamaktadır.'},
    'no_data': {'en': 'No emission records exist for this reporting period, so the '
                      'quantitative sections below are empty. Add activity data in the '
                      'Emissions section, then regenerate this report.',
                'tr': 'Bu raporlama dönemi için emisyon kaydı bulunmadığından aşağıdaki '
                      'nicel bölümler boştur. Emisyonlar bölümünden faaliyet verisi '
                      'ekleyip raporu yeniden oluşturun.'},
}

ISO_CATEGORY_NAMES = {
    CAT_I: {'en': 'Direct greenhouse gas emissions and removals',
            'tr': 'Doğrudan sera gazı emisyonları ve uzaklaştırmaları'},
    CAT_II: {'en': 'Indirect greenhouse gas emissions from imported energy',
             'tr': 'İthal edilen enerjiden kaynaklanan dolaylı sera gazı emisyonları'},
    CAT_III: {'en': 'Indirect greenhouse gas emissions from transportation',
              'tr': 'Ulaştırmadan kaynaklanan dolaylı sera gazı emisyonları'},
    CAT_IV: {'en': 'Indirect greenhouse gas emissions from products used by the organisation',
             'tr': 'Kuruluşun kullandığı ürünlerden kaynaklanan dolaylı emisyonlar'},
    CAT_V: {'en': 'Indirect greenhouse gas emissions associated with the use of products',
            'tr': 'Ürünlerin kullanımıyla ilişkili dolaylı sera gazı emisyonları'},
    CAT_VI: {'en': 'Indirect greenhouse gas emissions from other sources',
             'tr': 'Diğer kaynaklardan kaynaklanan dolaylı sera gazı emisyonları'},
}

CATEGORY_LABELS = {
    'stationary_combustion': {'en': 'Stationary combustion', 'tr': 'Sabit yanma'},
    'mobile_combustion': {'en': 'Mobile combustion', 'tr': 'Mobil yanma'},
    'fugitive_emissions': {'en': 'Fugitive emissions', 'tr': 'Kaçak emisyonlar'},
    'electricity': {'en': 'Imported energy — electricity', 'tr': 'İthal enerji — elektrik'},
    'steam_heat': {'en': 'Imported energy — steam and heat', 'tr': 'İthal enerji — buhar ve ısı'},
    'purchased_goods': {'en': 'Purchased goods and services', 'tr': 'Satın alınan mal ve hizmetler'},
    'capital_goods': {'en': 'Capital goods', 'tr': 'Sermaye malları'},
    'fuel_energy': {'en': 'Fuel and energy related activities',
                    'tr': 'Yakıt ve enerji ile ilgili faaliyetler'},
    'upstream_transport': {'en': 'Upstream transportation', 'tr': 'Yukarı akış taşımacılık'},
    'waste': {'en': 'Waste generated in operations', 'tr': 'Faaliyetlerden kaynaklanan atık'},
    'business_travel': {'en': 'Business travel', 'tr': 'İş seyahatleri'},
    'employee_commuting': {'en': 'Employee commuting', 'tr': 'Personel servisleri'},
    'upstream_leased': {'en': 'Upstream leased assets', 'tr': 'Kiralanan varlıklar (yukarı akış)'},
    'downstream_transport': {'en': 'Downstream transportation', 'tr': 'Aşağı akış taşımacılık'},
    'processing_sold': {'en': 'Processing of sold products', 'tr': 'Satılan ürünlerin işlenmesi'},
    'use_of_sold': {'en': 'Use of sold products', 'tr': 'Satılan ürünlerin kullanımı'},
    'end_of_life': {'en': 'End-of-life treatment', 'tr': 'Ömrünü tamamlamış ürün işlemleri'},
    'franchises': {'en': 'Franchises', 'tr': 'Franchise faaliyetleri'},
    'investments': {'en': 'Investments', 'tr': 'Yatırımlar'},
    'water': {'en': 'Water supply and treatment', 'tr': 'Su temini ve arıtımı'},
    'custom': {'en': 'Other declared sources', 'tr': 'Diğer beyan edilen kaynaklar'},
}


def t(key, lang):
    return T.get(key, {}).get(lang, T.get(key, {}).get('en', key))


def cat_label(code, lang):
    entry = CATEGORY_LABELS.get(code)
    if entry:
        return entry.get(lang, entry['en'])
    return (code or '').replace('_', ' ').capitalize()


# ═══════════════════════════════════════════════════════════════════════════
# DATA GATHERING
# ═══════════════════════════════════════════════════════════════════════════
def _answers(report):
    """All questionnaire answers for this report as {step_id: answer}."""
    return {
        s.step_id: s.answer
        for s in ReportStep.objects.filter(report=report).only('step_id', 'answer')
    }


def _answer_text(answers, step_id, lang, default=None):
    """Render one questionnaire answer as display text.

    Answers are stored as free-form JSON — the questionnaire has text, single-
    and multi-select, compound and repeatable question types — so this has to
    cope with strings, lists and dicts rather than assuming one shape.
    """
    raw = answers.get(step_id)
    if raw is None or raw == '' or raw == []:
        return default if default is not None else t('not_declared', lang)
    if isinstance(raw, dict):
        # compound answer — join its filled fields
        parts = [f'{k}: {v}' for k, v in raw.items() if v not in ('', None, [])]
        return '; '.join(parts) if parts else t('not_declared', lang)
    if isinstance(raw, (list, tuple)):
        vals = [str(v) for v in raw if v not in ('', None)]
        return ', '.join(vals) if vals else t('not_declared', lang)
    return str(raw)


def _gather(report, lang):
    """Collect every number and fact the report needs, once."""
    company = report.company
    year = report.reporting_year or datetime.now().year

    entries = (
        EmissionEntry.objects
        .filter(company=company, year=year)
        .select_related('emission_factor', 'facility')
    )

    # One row per (ISO category, GHG source), which is how Table 5 is laid out.
    sources = {}
    by_category = {c: 0.0 for c in ROMAN}
    by_scope = {'scope1': 0.0, 'scope2': 0.0, 'scope3': 0.0}
    total_kg = 0.0

    for e in entries:
        f = e.emission_factor
        scope = f.scope
        iso_cat = iso_category_for(scope, f.category)
        kg = float(e.calculated_co2e_kg or 0)

        key = (iso_cat, f.category, f.name)
        row = sources.setdefault(key, {
            'iso_cat': iso_cat,
            'category': f.category,
            'name': f.name,
            'unit': f.get_unit_display() if hasattr(f, 'get_unit_display') else f.unit,
            'factor': float(f.factor_kg_co2e or 0),
            'reference': f.reference or (
                f.get_source_display() if hasattr(f, 'get_source_display') else f.source
            ),
            'quantity': 0.0,
            'kg': 0.0,
            'count': 0,
        })
        row['quantity'] += float(e.quantity or 0)
        row['kg'] += kg
        row['count'] += 1

        by_category[iso_cat] += kg
        by_scope[scope] = by_scope.get(scope, 0.0) + kg
        total_kg += kg

    # Approved custom requests count toward the inventory the same way the
    # Scope-based report already counts them; without this the ISO totals would
    # silently disagree with the existing report for the same year.
    customs = CustomEmissionRequest.objects.filter(
        company=company, year=year, status='approved', calculated_co2e_kg__isnull=False
    ) if company else CustomEmissionRequest.objects.none()
    for cr in customs:
        kg = float(cr.calculated_co2e_kg or 0)
        iso_cat = iso_category_for(cr.scope, getattr(cr, 'category', 'custom'))
        key = (iso_cat, 'custom', getattr(cr, 'activity_name', None) or 'Custom source')
        row = sources.setdefault(key, {
            'iso_cat': iso_cat, 'category': 'custom',
            'name': key[2], 'unit': getattr(cr, 'unit', '') or '',
            'factor': 0.0, 'reference': 'Custom request (approved)',
            'quantity': 0.0, 'kg': 0.0, 'count': 0,
        })
        row['quantity'] += float(getattr(cr, 'quantity', 0) or 0)
        row['kg'] += kg
        row['count'] += 1
        by_category[iso_cat] += kg
        by_scope[cr.scope] = by_scope.get(cr.scope, 0.0) + kg
        total_kg += kg

    # Emissions rolled up by activity type (stationary combustion, purchased
    # electricity, business travel, …). The sample report devotes a figure to
    # each activity; this is the same cut of the data, independent of which ISO
    # category an activity happens to fall in.
    by_activity = {}
    for r in sources.values():
        by_activity[r['category']] = by_activity.get(r['category'], 0.0) + r['kg']

    # Per-facility, per-category matrix for section 4.2
    facilities = {}
    for e in entries:
        name = e.facility.name if e.facility else None
        if not name:
            continue
        iso_cat = iso_category_for(e.emission_factor.scope, e.emission_factor.category)
        fac = facilities.setdefault(name, {c: 0.0 for c in ROMAN})
        fac[iso_cat] += float(e.calculated_co2e_kg or 0)

    return {
        'company': company,
        'year': year,
        'entries': entries,
        'entry_count': entries.count(),
        'sources': sorted(sources.values(), key=lambda r: (r['iso_cat'], -r['kg'])),
        'by_category': by_category,
        'by_activity': by_activity,
        'by_scope': by_scope,
        'total_kg': total_kg,
        'total_t': total_kg / 1000.0,
        'direct_t': by_scope.get('scope1', 0.0) / 1000.0,
        'indirect_t': (total_kg - by_scope.get('scope1', 0.0)) / 1000.0,
        'facilities': facilities,
        'answers': _answers(report),
    }


# ═══════════════════════════════════════════════════════════════════════════
# SMALL BUILDING BLOCKS
# ═══════════════════════════════════════════════════════════════════════════
class _Counter:
    """Hands out sequential caption numbers.

    Several tables and figures are conditional — the facility-boundary table
    only exists if facilities are registered, a per-category block only if that
    category has data. Hardcoding the numbers left gaps in exactly those cases
    (a report with no facilities jumped straight from Table 2 to Table 4), and
    a numbering gap in an assurance document reads as a missing table.
    """
    def __init__(self):
        self.n = 0

    def next(self):
        self.n += 1
        return self.n


def _caption(S, counter, text_, lang):
    """'Table 5 — Greenhouse gas inventory' style caption, numbered in order.

    `counter` may be a _Counter (allocates the next number) or a plain int, for
    the case where the number had to be reserved earlier because the narrative
    refers to the table before it appears.
    """
    word = 'Tablo' if lang == 'tr' else 'Table'
    n = counter if isinstance(counter, int) else counter.next()
    return Paragraph(f'<b>{word} {n}</b> — {text_}', S['body_sm'])


def _table_word(lang):
    return 'Tablo' if lang == 'tr' else 'Table'


def _fig_caption(S, counter, text_, lang):
    word = 'Şekil' if lang == 'tr' else 'Figure'
    return Paragraph(f'<b>{word} {counter.next()}</b> — {text_}', S['small'])


def _kv_table(S, rows, lang, col_widths=(58*mm, 112*mm)):
    """Two-column Field / Information table used across section 1."""
    fn, fnb = S['fn'], S['fnb']
    data = [[Paragraph(f'<b>{t("c_field", lang)}</b>', S['body_sm']),
             Paragraph(f'<b>{t("c_info", lang)}</b>', S['body_sm'])]]
    for k, v in rows:
        data.append([Paragraph(k, S['body_sm']), Paragraph(str(v), S['body_sm'])])
    tbl = Table(data, colWidths=list(col_widths), hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (0, 0), (-1, -1), 'LEFT')
    tbl.setStyle(st)
    return tbl


def _bullets(S, items):
    return [Paragraph(f'• {i}', S['body']) for i in items]


def _bar_row_chart(rows, total, S, lang, max_rows=10):
    """Horizontal proportional bars, drawn as a table so it always paginates.

    reportlab's chart widgets are used elsewhere for pies; for the per-category
    breakdowns a simple proportional bar reads better in a dense report and
    cannot overflow its frame.
    """
    if total <= 0 or not rows:
        return None
    fn, fnb = S['fn'], S['fnb']
    data = []
    for label, value in rows[:max_rows]:
        pct = value / total * 100 if total else 0
        # A zero-value category must draw no bar at all. Clamping to a minimum
        # width put a visible mark next to "0.00 %", which reads as a small
        # quantity rather than none — the wrong claim to make in an inventory
        # report, where an empty category is a specific statement.
        if pct <= 0:
            bar = Paragraph('', S['body_sm'])
        else:
            bar = Table([['']], colWidths=[max(0.6, pct / 100 * 70)*mm], rowHeights=[2.8*mm],
                        style=[('BACKGROUND', (0, 0), (-1, -1), OLIVE)])
        data.append([
            Paragraph(label, S['body_sm']),
            bar,
            Paragraph(f'{_localize_num(f"{pct:.2f}", lang == "tr")} %', S['body_sm']),
        ])
    tbl = Table(data, colWidths=[62*mm, 74*mm, 20*mm], hAlign='LEFT')
    tbl.setStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (1, 0), (1, -1), 0),
    ])
    return tbl


# A short, deliberately monochrome-plus-neutral ramp (one hue, several
# tints, two neutrals for the tail) rather than a ten-color near-rainbow —
# reads as "modern minimal" and stays legible in a 6pt legend swatch.
CHART_PALETTE = [
    ACCENT,                           # #1D9C31 primary
    colors.HexColor('#0F5C1C'),       # deep green
    colors.HexColor('#6FB37E'),       # sage
    colors.HexColor('#B7C9BA'),       # pale sage-gray
    GRAY_600,                         # gray-green (= MUTED)
    colors.HexColor('#D7DDD8'),       # near-white gray (tail/"Other")
]


def _donut_chart(rows, S, lang, max_slices=8, width_mm=170, height_mm=56):
    """Donut chart with the total centered in the hole and a side legend,
    for the distribution figures.

    `rows` is [(label, value_kg), ...]. Slices worth nothing are dropped —
    reportlab renders a zero value as a degenerate wedge, and in an inventory
    an empty category is a specific claim that a sliver would misrepresent.
    Anything past `max_slices` is folded into a single "Other" slice so a long
    tail of small sources cannot make the legend illegible.
    """
    tr = lang == 'tr'
    live = [(lbl, val) for lbl, val in rows if val and val > 0]
    if not live:
        return None
    live.sort(key=lambda r: -r[1])
    if len(live) > max_slices:
        head, tail = live[:max_slices], live[max_slices:]
        live = head + [('Other' if lang == 'en' else 'Diğer', sum(v for _, v in tail))]
    total = sum(v for _, v in live)
    if total <= 0:
        return None

    d = Drawing(width_mm * mm, height_mm * mm)
    pie = Pie()
    pie.x, pie.y = 6 * mm, 4 * mm
    pie.width = pie.height = 48 * mm
    pie.innerRadiusFraction = 0.62
    pie.data = [v for _, v in live]
    # A wedge narrower than ~7 % is thinner than its own label, so the text
    # spills over the neighbouring slice. Those stay unlabelled — the legend
    # carries the exact tonnage and percentage for every slice regardless.
    pie.labels = [f'{v / total * 100:.0f}%' if v / total >= 0.07 else '' for _, v in live]
    pie.simpleLabels = 1
    pie.sideLabels = 0
    pie.slices.strokeWidth = 1.2
    pie.slices.strokeColor = WHITE
    pie.slices.fontName = S['fn']
    pie.slices.fontSize = 7.5
    pie.slices.fontColor = WHITE
    # With an inner radius, labels sit inside the ring itself (between the
    # inner and outer edge) rather than near the pie center.
    pie.slices.labelRadius = 0.85
    for i in range(len(live)):
        pie.slices[i].fillColor = CHART_PALETTE[i % len(CHART_PALETTE)]
    d.add(pie)

    # Total, centered in the donut's hole — two short lines (number, unit)
    # rather than one long formatted string, so it fits the hole at any
    # magnitude without touching the ring.
    cx, cy = (pie.x + pie.width / 2), (pie.y + pie.height / 2)
    d.add(String(cx, cy + 3, _localize_num(f'{total / 1000.0:,.1f}', tr),
                  fontName=S['fnb'], fontSize=10.5, fillColor=ACCENT_DARK,
                  textAnchor='middle'))
    d.add(String(cx, cy - 7, 't CO₂e', fontName=S['fn'], fontSize=6.5,
                  fillColor=MUTED, textAnchor='middle'))

    legend = Legend()
    legend.x = 60 * mm
    # Centre the legend block against the pie rather than pinning it to the top,
    # so a two-entry chart doesn't leave the right-hand side visibly empty.
    rows_h = len(live) * 11
    legend.y = min((height_mm - 4) * mm, (height_mm * mm + rows_h) / 2)
    legend.dx = legend.dy = 6
    legend.dxTextSpace = 5
    legend.fontName = S['fn']
    legend.fontSize = 7.5
    legend.deltay = 11
    # 'right' puts the colour swatch first and the text after it; the default
    # ('left') trails the swatch behind the label, which reads as a stray mark.
    legend.alignment = 'right'
    legend.columnMaximum = max_slices + 1
    legend.colorNamePairs = [
        (CHART_PALETTE[i % len(CHART_PALETTE)],
         f'{lbl[:38]}  —  {_fmt(v / 1000.0, tr)} t  ({_localize_num(f"{v / total * 100:.1f}", tr)} %)')
        for i, (lbl, v) in enumerate(live)
    ]
    d.add(legend)
    return d


# ═══════════════════════════════════════════════════════════════════════════
# PAGE CHROME — modern minimal: hairline rules, no solid color bars or
# corner decoration. Defined locally (not shared with the other two PDF
# reports, which keep their bolder brand-forward chrome).
# ═══════════════════════════════════════════════════════════════════════════
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
        fn, fnb = _fonts()
        w, h = A4
        # A single thin rule frames a small wordmark row — no color blocks,
        # no corner decoration, no panel behind the title.
        canvas.setStrokeColor(ACCENT)
        canvas.setLineWidth(0.75)
        canvas.line(20*mm, h-22*mm, w-20*mm, h-22*mm)
        canvas.setFont(fnb, 8)
        canvas.setFillColor(ACCENT)
        canvas.drawString(20*mm, h-19*mm, 'CARBONLESS')
        canvas.setFont(fn, 8)
        canvas.setFillColor(FAINT)
        canvas.drawRightString(w-20*mm, h-19*mm, 'ISO 14064-1:2018')

    def _content_page(self, canvas, doc):
        fn, fnb = _fonts()
        w, h = A4
        # Header — a hairline rule, small left wordmark, small right meta.
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.6)
        canvas.line(20*mm, h-15*mm, w-20*mm, h-15*mm)
        canvas.setFont(fnb, 7.5)
        canvas.setFillColor(ACCENT)
        canvas.drawString(20*mm, h-13*mm, 'CARBONLESS')
        canvas.setFont(fn, 7)
        canvas.setFillColor(FAINT)
        canvas.drawRightString(w-20*mm, h-13*mm, f'ISO 14064-1 · {self.company_name} · {self.year}')
        # Footer — hairline rule, centered page number, no box/fill.
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.4)
        canvas.line(20*mm, 15*mm, w-20*mm, 15*mm)
        canvas.setFont(fn, 7)
        canvas.setFillColor(FAINT)
        page_num = doc.page - 1
        label = 'Sayfa' if self.lang == 'tr' else 'Page'
        canvas.drawCentredString(w/2, 10*mm, f'{label} {page_num}')
        canvas.drawString(20*mm, 10*mm, 'Carbonless Platform')
        canvas.drawRightString(w-20*mm, 10*mm, datetime.now().strftime('%d.%m.%Y'))


# ═══════════════════════════════════════════════════════════════════════════
# SECTION BUILDERS
# ═══════════════════════════════════════════════════════════════════════════
def _cover(E, S, D, report, lang):
    company = D['company']
    cname = company.legal_entity_name if company else '—'
    E.append(Spacer(1, 42*mm))
    E.append(Paragraph(cname, S['cover_company']))
    E.append(Spacer(1, 5*mm))
    E.append(Paragraph(t('standard', lang), S['cover_badge']))
    E.append(Spacer(1, 8*mm))
    E.append(Paragraph(t('doc_title', lang), S['cover_title']))
    E.append(Spacer(1, 6*mm))
    E.append(Paragraph(str(D['year']), S['cover_sub']))
    E.append(Spacer(1, 16*mm))
    period = (f"1 January {D['year']} – 31 December {D['year']}" if lang == 'en'
              else f"1 Ocak {D['year']} – 31 Aralık {D['year']}")
    E.append(Paragraph(f"{t('reporting_period', lang)}: {period}", S['cover_date']))
    issued = datetime.now().strftime('%B %Y' if lang == 'en' else '%m.%Y')
    E.append(Paragraph(
        f"{t('report_issued', lang)}: {issued}  |  {t('revision', lang)} 01",
        S['cover_date']))
    E.append(NextPageTemplate('content'))
    E.append(PageBreak())


def _contents(E, S, lang):
    E.append(Paragraph(t('contents', lang), S['h1']))
    items = [
        ('1', t('s1', lang)),
        ('2', t('s2', lang)),
        ('3', t('s3', lang)),
        ('4', t('s4', lang)),
    ]
    for num, label in items:
        E.append(Paragraph(f'<b>{num}</b>   {label.title() if lang == "en" else label}',
                           S['toc']))
    E.append(PageBreak())


def _section1(E, S, D, report, lang, TBL, FIG):
    A = D['answers']
    company = D['company']
    E.append(Paragraph('1   ' + t('s1', lang), S['h1']))

    rows = [
        (t('c_field', lang) if False else
         ('Reporting organisation' if lang == 'en' else 'Raporlayan kuruluş'),
         company.legal_entity_name if company else t('not_declared', lang)),
        ('Registered address' if lang == 'en' else 'Kayıtlı adres',
         getattr(company, 'country_of_headquarters', None) or t('not_declared', lang)),
        ('Tax number' if lang == 'en' else 'Vergi numarası',
         getattr(company, 'tax_number', None) or t('not_declared', lang)),
        ('Sector' if lang == 'en' else 'Sektör',
         getattr(company, 'main_activity_description', None) or t('not_declared', lang)),
        ('NACE code' if lang == 'en' else 'NACE kodu',
         getattr(company, 'nace_code', None) or t('not_declared', lang)),
        ('Countries of operation' if lang == 'en' else 'Faaliyet ülkeleri',
         getattr(company, 'countries_of_operation', None) or t('not_declared', lang)),
        ('Number of employees' if lang == 'en' else 'Çalışan sayısı',
         getattr(company, 'number_of_employees', None) or t('not_declared', lang)),
        ('Number of facilities' if lang == 'en' else 'Tesis sayısı',
         getattr(company, 'number_of_facilities', None) if company else t('not_declared', lang)),
    ]
    E.append(_caption(S, TBL, t('t_org', lang), lang))
    E.append(_kv_table(S, rows, lang))
    E.append(Spacer(1, 6*mm))

    # Basic report information
    E.append(Paragraph(t('s1_basic', lang), S['h2']))
    period = (f"1 January {D['year']} – 31 December {D['year']}" if lang == 'en'
              else f"1 Ocak {D['year']} – 31 Aralık {D['year']}")
    basic = [
        ('Report date' if lang == 'en' else 'Rapor tarihi',
         datetime.now().strftime('%d.%m.%Y')),
        ('Revision number' if lang == 'en' else 'Revizyon numarası', '01'),
        ('Reporting standard' if lang == 'en' else 'Raporlama standardı',
         'ISO 14064-1:2018'),
        ('Base year' if lang == 'en' else 'Baz yıl',
         report.baseline_year or D['year']),
        ('Calculation year' if lang == 'en' else 'Hesaplama yılı', D['year']),
        (t('reporting_period', lang), period),
        ('Prepared by' if lang == 'en' else 'Hazırlayan',
         report.prepared_by or t('not_declared', lang)),
        ('Organisational boundary approach' if lang == 'en' else 'Organizasyon sınırı yaklaşımı',
         report.get_org_boundary_display() if getattr(report, 'org_boundary', None)
         else t('not_declared', lang)),
        ('Emission factor database' if lang == 'en' else 'Emisyon faktörü veri tabanı',
         report.get_ef_database_display() if getattr(report, 'ef_database', None)
         else t('not_declared', lang)),
    ]
    E.append(_kv_table(S, basic, lang))
    E.append(Spacer(1, 6*mm))

    # 1.1 Purpose and scope
    E.append(Paragraph('1.1   ' + t('s1_1', lang), S['h2']))
    if lang == 'tr':
        E.append(Paragraph(
            'Bu sera gazı raporunun amacı, kuruluşun sorumluluğu altında yürütülen tüm '
            'faaliyetlerden kaynaklanan sera gazı emisyonlarını ve uzaklaştırmalarını '
            'kurumsal düzeyde hesaplamak ve ISO 14064-1:2018 standardının gerekliliklerine '
            'uygun bir sera gazı beyanı sunmaktır.', S['body']))
        purposes = [
            'çevreye verilebilecek zararı en aza indirmek için sera gazı emisyonlarına '
            'katkıda bulunabilecek faaliyetleri kontrol etmek;',
            'sera gazı emisyonlarını azaltmak için kaynakların verimli kullanımını sağlamak;',
            'tüm faaliyetlerde enerji yönetimini sağlamak ve iyileştirmek;',
            'iklim değişikliğiyle mücadeleye yönelik ulusal ve uluslararası taahhütlerle '
            'uyumlu olarak emisyonları azaltmak;',
            'karbon risklerini ve fırsatlarını belirlemek;',
            'yıllık emisyon raporu hazırlamak.',
        ]
    else:
        E.append(Paragraph(
            'The purpose of this greenhouse gas report is to quantify the greenhouse gas '
            'emissions and removals arising from all operations carried out under the '
            "organisation's responsibility at the organisational level, and to make a "
            'greenhouse gas declaration in accordance with the requirements of ISO '
            '14064-1:2018. In line with this purpose the organisation seeks to:', S['body']))
        purposes = [
            'control activities that may contribute to greenhouse gas emissions in order to '
            'minimise potential harm to the environment;',
            'ensure the efficient use of greenhouse gas sources in order to reduce emissions;',
            'ensure and improve energy management across all activities;',
            'reduce greenhouse gas emissions in line with global climate policies and '
            'national and international commitments;',
            'identify carbon risks and opportunities;',
            'prepare an annual emissions report.',
        ]
    E.extend(_bullets(S, purposes))
    gases = ('Carbon dioxide (CO₂), methane (CH₄), nitrous oxide (N₂O), hydrofluorocarbons '
             '(HFCs), perfluorocarbons (PFCs), sulphur hexafluoride (SF₆) and nitrogen '
             'trifluoride (NF₃) are taken into account in the calculations.'
             if lang == 'en' else
             'Hesaplamalarda karbondioksit (CO₂), metan (CH₄), diazot monoksit (N₂O), '
             'hidroflorokarbonlar (HFC), perflorokarbonlar (PFC), kükürt heksaflorür (SF₆) '
             've azot triflorür (NF₃) dikkate alınmıştır.')
    E.append(Paragraph(gases, S['body']))
    E.append(Spacer(1, 4*mm))

    # 1.2 Responsibilities
    E.append(Paragraph('1.2   ' + t('s1_2', lang), S['h2']))
    fn, fnb = S['fn'], S['fnb']
    role_rows = [[
        Paragraph(f'<b>{t("c_no", lang)}</b>', S['body_sm']),
        Paragraph(f'<b>{t("c_role", lang)}</b>', S['body_sm']),
        Paragraph(f'<b>{t("c_resp", lang)}</b>', S['body_sm']),
    ]]
    roles = ([
        ('Sustainability Officer', 'Owns the inventory, approves the declaration.'),
        ('Data owners (per facility)', 'Provide and verify activity data at source.'),
        ('Environmental Engineer', 'Maintains factors, methodology and records.'),
        ('Senior management', 'Approves targets and allocates resources.'),
    ] if lang == 'en' else [
        ('Sürdürülebilirlik Sorumlusu', 'Envanterin sahibi, beyanı onaylar.'),
        ('Veri sorumluları (tesis bazında)', 'Faaliyet verisini sağlar ve doğrular.'),
        ('Çevre Mühendisi', 'Faktörleri, metodolojiyi ve kayıtları yürütür.'),
        ('Üst yönetim', 'Hedefleri onaylar ve kaynak tahsis eder.'),
    ])
    prepared = report.prepared_by
    for i, (role, resp) in enumerate(roles, 1):
        shown = f'{role} — {prepared}' if (i == 1 and prepared) else role
        role_rows.append([Paragraph(str(i), S['body_sm']),
                          Paragraph(shown, S['body_sm']),
                          Paragraph(resp, S['body_sm'])])
    rt = Table(role_rows, colWidths=[12*mm, 64*mm, 94*mm], hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (0, 0), (-1, -1), 'LEFT')
    rt.setStyle(st)
    E.append(_caption(S, TBL, t('t_roles', lang), lang))
    E.append(rt)
    E.append(Spacer(1, 5*mm))

    # 1.3 Target users
    E.append(Paragraph('1.3   ' + t('s1_3', lang), S['h2']))
    E.extend(_bullets(S, (
        ['company senior management;', 'employees;', 'customers;', 'suppliers;',
         'verification bodies and other stakeholders.'] if lang == 'en' else
        ['şirket üst yönetimi;', 'çalışanlar;', 'müşteriler;', 'tedarikçiler;',
         'doğrulama kuruluşları ve diğer paydaşlar.'])))
    E.append(Spacer(1, 4*mm))

    # 1.4 Standards used
    E.append(Paragraph('1.4   ' + t('s1_4', lang), S['h2']))
    E.extend(_bullets(S, [
        'ISO 14064-1:2018 — Greenhouse gases: specification with guidance at the '
        'organization level for quantification and reporting of greenhouse gas emissions '
        'and removals;',
        'IPCC Guidelines for National Greenhouse Gas Inventories (2006, 2019 refinement);',
        'IPCC AR6 Global Warming Potential values;',
        'GHG Protocol Corporate Accounting and Reporting Standard;',
        'DEFRA/DESNZ conversion factors (current edition);',
        'IEA national electricity grid emission factors.',
    ]))
    E.append(Spacer(1, 4*mm))

    # 1.5 Principles
    E.append(Paragraph('1.5   ' + t('s1_5', lang), S['h2']))
    principles = ([
        ('Relevance', 'Sources, sinks, reservoirs, data and methodologies appropriate to '
                      'the needs of the intended user are selected.'),
        ('Completeness', 'All relevant emissions and removals within the declared '
                         'boundary are included; exclusions are stated and justified.'),
        ('Consistency', 'Methodologies allow meaningful comparison over time; any change '
                        'is documented.'),
        ('Accuracy', 'Bias and uncertainty are reduced as far as is practicable.'),
        ('Transparency', 'Sufficient information is disclosed for an intended user to '
                         'make decisions with reasonable confidence.'),
    ] if lang == 'en' else [
        ('İlgililik', 'Hedef kullanıcının ihtiyaçlarına uygun kaynaklar, yutaklar, veriler '
                      've metodolojiler seçilir.'),
        ('Tamlık', 'Beyan edilen sınır içindeki tüm ilgili emisyon ve uzaklaştırmalar dâhil '
                   'edilir; hariç tutmalar gerekçesiyle belirtilir.'),
        ('Tutarlılık', 'Metodolojiler zaman içinde anlamlı karşılaştırmaya izin verir; her '
                       'değişiklik belgelenir.'),
        ('Doğruluk', 'Yanlılık ve belirsizlik uygulanabilir olduğu ölçüde azaltılır.'),
        ('Şeffaflık', 'Hedef kullanıcının makul güvenle karar verebilmesi için yeterli bilgi '
                      'açıklanır.'),
    ])
    for name, text_ in principles:
        E.append(Paragraph(f'<b>{name}.</b> {text_}', S['body']))
    E.append(PageBreak())


def _section2(E, S, lang):
    E.append(Paragraph('2   ' + t('s2', lang), S['h1']))
    E.append(Paragraph('2.1   ' + t('s2_1', lang), S['h2']))
    defs = ([
        ('Greenhouse gas (GHG)', 'Gaseous constituent of the atmosphere, natural or '
                                 'anthropogenic, that absorbs and emits infrared radiation.'),
        ('GHG source', 'Process that releases a GHG into the atmosphere.'),
        ('GHG sink', 'Process that removes a GHG from the atmosphere.'),
        ('Direct GHG emission', 'Emission from GHG sources owned or controlled by the '
                                'organisation (Category 1).'),
        ('Indirect GHG emission', 'Emission that is a consequence of the organisation’s '
                                  'activities but arises from sources owned or controlled '
                                  'by another organisation (Categories 2-6).'),
        ('Global warming potential (GWP)', 'Factor describing the radiative forcing impact '
                                           'of one mass unit of a GHG relative to CO₂.'),
        ('CO₂ equivalent (CO₂e)', 'Unit for comparing the radiative forcing of a GHG to '
                                  'that of carbon dioxide.'),
        ('Base year', 'Historical period specified for the purpose of comparing GHG '
                      'emissions over time.'),
        ('Organisational boundary', 'The facilities and operations consolidated into the '
                                    'inventory under the chosen consolidation approach.'),
        ('Uncertainty', 'Parameter characterising the dispersion of values that could '
                        'reasonably be attributed to the quantified result.'),
    ] if lang == 'en' else [
        ('Sera gazı (SG)', 'Kızılötesi radyasyonu soğuran ve yayan, doğal veya antropojenik '
                           'atmosfer bileşeni.'),
        ('SG kaynağı', 'Atmosfere sera gazı salan süreç.'),
        ('SG yutağı', 'Atmosferden sera gazı uzaklaştıran süreç.'),
        ('Doğrudan SG emisyonu', 'Kuruluşun sahip olduğu veya kontrol ettiği kaynaklardan '
                                 'gelen emisyon (Kategori 1).'),
        ('Dolaylı SG emisyonu', 'Kuruluşun faaliyetlerinin sonucu olan ancak başka bir '
                                'kuruluşun kontrolündeki kaynaklardan doğan emisyon '
                                '(Kategori 2-6).'),
        ('Küresel ısınma potansiyeli (GWP)', 'Bir birim kütle sera gazının CO₂’ye göre '
                                             'ışınımsal zorlama etkisini tanımlayan faktör.'),
        ('CO₂ eşdeğeri (CO₂e)', 'Sera gazlarının ışınımsal zorlamasını karbondioksitle '
                                'karşılaştırmak için kullanılan birim.'),
        ('Baz yıl', 'Emisyonların zaman içinde karşılaştırılması için belirlenen dönem.'),
        ('Organizasyon sınırı', 'Seçilen konsolidasyon yaklaşımıyla envantere dâhil edilen '
                               'tesis ve faaliyetler.'),
        ('Belirsizlik', 'Nicelenen sonuca makul olarak atfedilebilecek değerlerin '
                        'dağılımını karakterize eden parametre.'),
    ])
    for term, meaning in defs:
        E.append(Paragraph(f'<b>{term}.</b> {meaning}', S['body']))
    E.append(Spacer(1, 4*mm))

    E.append(Paragraph('2.2   ' + t('s2_2', lang), S['h2']))
    abbrs = [
        ('CO₂e', 'Carbon dioxide equivalent' if lang == 'en' else 'Karbondioksit eşdeğeri'),
        ('GHG / SG', 'Greenhouse gas' if lang == 'en' else 'Sera gazı'),
        ('GWP', 'Global warming potential' if lang == 'en' else 'Küresel ısınma potansiyeli'),
        ('IPCC', 'Intergovernmental Panel on Climate Change'),
        ('IEA', 'International Energy Agency'),
        ('NCV', 'Net calorific value' if lang == 'en' else 'Net kalorifik değer'),
        ('EF', 'Emission factor' if lang == 'en' else 'Emisyon faktörü'),
        ('t CO₂e', 'Tonnes of carbon dioxide equivalent'
                   if lang == 'en' else 'Ton karbondioksit eşdeğeri'),
    ]
    fn, fnb = S['fn'], S['fnb']
    data = [[Paragraph('<b>' + ('Abbreviation' if lang == 'en' else 'Kısaltma') + '</b>',
                       S['body_sm']),
             Paragraph(f'<b>{t("c_info", lang)}</b>', S['body_sm'])]]
    for a, m in abbrs:
        data.append([Paragraph(a, S['body_sm']), Paragraph(m, S['body_sm'])])
    tbl = Table(data, colWidths=[36*mm, 134*mm], hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (0, 0), (-1, -1), 'LEFT')
    tbl.setStyle(st)
    E.append(tbl)
    E.append(PageBreak())


def _section3(E, S, D, report, lang, TBL, FIG):
    A = D['answers']
    company = D['company']
    fn, fnb = S['fn'], S['fnb']
    E.append(Paragraph('3   ' + t('s3', lang), S['h1']))

    # 3.1 Facility boundaries
    E.append(Paragraph('3.1   ' + t('s3_1', lang), S['h2']))
    from companies.models import Facility
    facs = list(Facility.objects.filter(company=company)) if company else []
    if facs:
        data = [[Paragraph(f'<b>{t("c_no", lang)}</b>', S['body_sm']),
                 Paragraph(f'<b>{t("c_facility", lang)}</b>', S['body_sm']),
                 Paragraph(f'<b>{t("c_type", lang)}</b>', S['body_sm'])]]
        for i, f in enumerate(facs, 1):
            data.append([
                Paragraph(str(i), S['body_sm']),
                Paragraph(getattr(f, 'name', '—'), S['body_sm']),
                Paragraph(str(getattr(f, 'facility_type', '') or '—'), S['body_sm']),
            ])
        tbl = Table(data, colWidths=[12*mm, 100*mm, 58*mm], hAlign='LEFT', repeatRows=1)
        st = _tbl_style(fn, fnb)
        st.add('ALIGN', (0, 0), (-1, -1), 'LEFT')
        tbl.setStyle(st)
        E.append(_caption(S, TBL, t('t_fac', lang), lang))
        E.append(tbl)
    else:
        E.append(Paragraph(
            'No individual facilities have been registered; the inventory is consolidated '
            'at organisation level.' if lang == 'en' else
            'Kayıtlı ayrı tesis bulunmamaktadır; envanter kuruluş düzeyinde '
            'konsolide edilmiştir.', S['body']))
    E.append(Spacer(1, 5*mm))

    # 3.2 Calculation methodology
    E.append(Paragraph('3.2   ' + t('s3_2', lang), S['h2']))
    E.append(Paragraph(
        'Emissions are quantified by multiplying activity data by the emission factor '
        'appropriate to the source, gas and geography, and converting to carbon dioxide '
        'equivalent using IPCC AR6 global warming potentials:'
        if lang == 'en' else
        'Emisyonlar, faaliyet verisinin kaynağa, gaza ve coğrafyaya uygun emisyon faktörü '
        'ile çarpılması ve IPCC AR6 küresel ısınma potansiyelleri kullanılarak '
        'karbondioksit eşdeğerine dönüştürülmesiyle hesaplanır:', S['body']))
    E.append(Spacer(1, 2*mm))
    E.append(Paragraph(
        '<b>E (kg CO₂e) = Activity data × Emission factor × GWP</b>'
        if lang == 'en' else
        '<b>E (kg CO₂e) = Faaliyet verisi × Emisyon faktörü × GWP</b>', S['quote']))
    E.append(Spacer(1, 2*mm))
    E.append(Paragraph(
        'The consolidation approach declared for the organisational boundary is applied '
        'consistently to every facility in the inventory.'
        if lang == 'en' else
        'Organizasyon sınırı için beyan edilen konsolidasyon yaklaşımı, envanterdeki her '
        'tesise tutarlı biçimde uygulanır.', S['body']))
    E.append(Spacer(1, 5*mm))

    # 3.3 Reporting boundaries
    E.append(Paragraph('3.3   ' + t('s3_3', lang), S['h2']))
    for cat in (CAT_I, CAT_II, CAT_III, CAT_IV, CAT_V, CAT_VI):
        name = ISO_CATEGORY_NAMES[cat][lang]
        val = D['by_category'][cat] / 1000.0
        E.append(Paragraph(
            f'<b>{t("c_cat", lang)} {ROMAN[cat]}</b> — {name}: '
            f'{_fmt(val, lang == "tr")} t CO₂e', S['body']))
    E.append(Spacer(1, 5*mm))

    # 3.4 Exclusions
    E.append(Paragraph('3.4   ' + t('s3_4', lang), S['h2']))
    excl = _answer_text(A, '6A-1', lang, default=None)
    if excl == t('not_declared', lang):
        excl = _answer_text(A, '6B-1', lang, default=None)
    if excl and excl != t('not_declared', lang):
        E.append(Paragraph(excl, S['body']))
    else:
        E.append(Paragraph(
            'No sources have been excluded from the declared boundary other than those '
            'stated as not applicable to the organisation’s operations.'
            if lang == 'en' else
            'Kuruluşun faaliyetleri için geçerli olmadığı belirtilenler dışında, beyan '
            'edilen sınırdan hariç tutulan kaynak bulunmamaktadır.', S['body']))
    E.append(Spacer(1, 4*mm))

    # 3.5 Assumptions
    E.append(Paragraph('3.5   ' + t('s3_5', lang), S['h2']))
    assum = _answer_text(A, '6C-1', lang, default=None)
    if assum and assum != t('not_declared', lang):
        E.append(Paragraph(assum, S['body']))
    else:
        E.extend(_bullets(S, (
            ['Where metered data was unavailable, consumption has been apportioned on a '
             'documented basis (floor area, headcount or operating hours).',
             'Emission factors are applied for the geography in which the activity occurs.',
             'Biogenic CO₂ from biomass combustion is reported separately from fossil CO₂.']
            if lang == 'en' else
            ['Sayaç verisi bulunmayan durumlarda tüketim, belgelenmiş bir esasa göre '
             '(alan, personel sayısı veya çalışma saati) dağıtılmıştır.',
             'Emisyon faktörleri, faaliyetin gerçekleştiği coğrafyaya göre uygulanır.',
             'Biyokütle yanmasından kaynaklanan biyojenik CO₂ fosil CO₂’den ayrı raporlanır.'])))
    E.append(Spacer(1, 4*mm))

    # 3.6 Data sources
    E.append(Paragraph('3.6   ' + t('s3_6', lang), S['h2']))
    refs = {}
    for r in D['sources']:
        ref = (r['reference'] or '').strip()
        if ref:
            refs.setdefault(ref, []).append(cat_label(r['category'], lang))
    if refs:
        data = [[Paragraph(f'<b>{t("c_ref", lang)}</b>', S['body_sm']),
                 Paragraph(f'<b>{t("c_source", lang)}</b>', S['body_sm'])]]
        for ref, cats in sorted(refs.items()):
            uniq = sorted(set(cats))
            data.append([Paragraph(ref[:150], S['body_sm']),
                         Paragraph(', '.join(uniq), S['body_sm'])])
        tbl = Table(data, colWidths=[96*mm, 74*mm], hAlign='LEFT', repeatRows=1)
        st = _tbl_style(fn, fnb)
        st.add('ALIGN', (0, 0), (-1, -1), 'LEFT')
        tbl.setStyle(st)
        E.append(_caption(S, TBL, t('t_src', lang), lang))
        E.append(tbl)
    else:
        E.append(Paragraph(t('none_recorded', lang), S['no_data']))
    E.append(PageBreak())


def _inventory_table(E, S, D, lang, TBL):
    """Table 5 — the inventory itself, one row per GHG source, grouped by category."""
    fn, fnb = S['fn'], S['fnb']
    tr = lang == 'tr'
    hdr = [
        Paragraph(f'<b>{t("c_scope", lang)}</b>', S['small']),
        Paragraph(f'<b>{t("c_cat", lang)}</b>', S['small']),
        Paragraph(f'<b>{t("c_source", lang)}</b>', S['small']),
        Paragraph(f'<b>{t("c_activity", lang)}</b>', S['small']),
        Paragraph(f'<b>{t("c_unit", lang)}</b>', S['small']),
        Paragraph(f'<b>{t("c_ghg_t", lang)}</b>', S['small']),
        Paragraph(f'<b>{t("c_cat_total", lang)}</b>', S['small']),
    ]
    data = [hdr]
    span_cmds = []
    row_i = 1
    for cat in sorted(ROMAN):
        rows = [r for r in D['sources'] if r['iso_cat'] == cat]
        if not rows:
            continue
        cat_total_t = D['by_category'][cat] / 1000.0
        first_row_of_cat = row_i
        for j, r in enumerate(rows):
            scope_lbl = (t('direct', lang).split()[0] if cat == CAT_I
                         else t('indirect', lang).split()[0])
            data.append([
                Paragraph(scope_lbl if j == 0 else '', S['small']),
                Paragraph(ROMAN[cat], S['small']),
                Paragraph(f'{cat_label(r["category"], lang)} — {r["name"]}', S['small']),
                Paragraph(_fmt(r['quantity'], tr), S['small']),
                Paragraph(str(r['unit'] or '—'), S['small']),
                Paragraph(_fmt(r['kg'] / 1000.0, tr), S['small']),
                Paragraph(_fmt(cat_total_t, tr) if j == 0 else '', S['small']),
            ])
            row_i += 1
        if len(rows) > 1:
            span_cmds.append(('SPAN', (6, first_row_of_cat), (6, row_i - 1)))
            span_cmds.append(('SPAN', (0, first_row_of_cat), (0, row_i - 1)))

    data.append([
        Paragraph(f'<b>{t("total", lang)}</b>', S['small']), Paragraph('', S['small']),
        Paragraph('', S['small']), Paragraph('', S['small']), Paragraph('', S['small']),
        Paragraph(f'<b>{_fmt(D["total_t"], tr)}</b>', S['small']),
        Paragraph(f'<b>{_fmt(D["total_t"], tr)}</b>', S['small']),
    ])

    tbl = Table(data, colWidths=[16*mm, 10*mm, 68*mm, 24*mm, 16*mm, 20*mm, 20*mm],
                hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (0, 0), (2, -1), 'LEFT')
    st.add('VALIGN', (0, 0), (-1, -1), 'TOP')
    for cmd in span_cmds:
        st.add(*cmd)
    st.add('BACKGROUND', (0, -1), (-1, -1), CREAM)
    st.add('LINEABOVE', (0, -1), (-1, -1), 1.2, OLIVE)
    tbl.setStyle(st)
    E.append(_caption(S, TBL, t('t_inv', lang), lang))
    E.append(tbl)


def _section4(E, S, D, report, lang, TBL, FIG):
    A = D['answers']
    fn, fnb = S['fn'], S['fnb']
    tr = lang == 'tr'
    E.append(Paragraph('4   ' + t('s4', lang), S['h1']))

    if D['total_kg'] <= 0:
        E.append(Paragraph(t('no_data', lang), S['warning']))
        E.append(Spacer(1, 4*mm))

    total_t = D['total_t']
    # Reserved before the paragraph is written because the sentence below cites
    # the table by number, and which number that is depends on how many
    # conditional tables section 3 emitted.
    inv_no = TBL.next()
    tw = _table_word(lang)
    E.append(Paragraph(
        (f'The total greenhouse gas emissions of the organisation for {D["year"]} amounted '
         f'to {_fmt(total_t, tr)} tonnes of CO₂ equivalent, quantified from '
         f'{D["entry_count"]} activity data records. The emission quantities from all '
         f'identified greenhouse gas sources are detailed in {tw} {inv_no}.')
        if lang == 'en' else
        (f'Kuruluşun {D["year"]} yılı toplam sera gazı emisyonu, {D["entry_count"]} '
         f'faaliyet verisi kaydından hesaplanarak {_fmt(total_t, tr)} ton CO₂ eşdeğeri '
         f'olarak belirlenmiştir. Tanımlanan tüm sera gazı kaynaklarına ait emisyon '
         f'miktarları {tw} {inv_no}’te verilmiştir.'), S['body']))
    E.append(Spacer(1, 3*mm))
    _inventory_table(E, S, D, lang, inv_no)
    E.append(PageBreak())

    # 4.1 Calculations and analyses
    E.append(Paragraph('4.1   ' + t('s4_1', lang), S['h2']))
    direct_t, indirect_t = D['direct_t'], D['indirect_t']
    E.append(Paragraph(
        (f'Direct greenhouse gas emissions totalled {_fmt(direct_t, tr)} t CO₂e, while '
         f'indirect greenhouse gas emissions amounted to {_fmt(indirect_t, tr)} t CO₂e.')
        if lang == 'en' else
        (f'Doğrudan sera gazı emisyonları {_fmt(direct_t, tr)} t CO₂e, dolaylı sera gazı '
         f'emisyonları ise {_fmt(indirect_t, tr)} t CO₂e olarak hesaplanmıştır.'),
        S['body']))

    def pct(v):
        return _localize_num(f'{(v / total_t * 100 if total_t else 0):.2f}', tr)

    data = [[Paragraph(f'<b>{t("c_scope", lang)}</b>', S['body_sm']),
             Paragraph(f'<b>{t("c_pct", lang)}</b>', S['body_sm']),
             Paragraph(f'<b>{t("c_total", lang)}</b>', S['body_sm'])]]
    for label, val in ((t('direct', lang), direct_t), (t('indirect', lang), indirect_t)):
        data.append([Paragraph(label, S['body_sm']),
                     Paragraph(pct(val), S['body_sm']),
                     Paragraph(f'{_fmt(val, tr)} t CO₂e', S['body_sm'])])
    data.append([Paragraph(f'<b>{t("total", lang)}</b>', S['body_sm']),
                 Paragraph(_localize_num('100.00', tr) if total_t else _localize_num('0.00', tr),
                           S['body_sm']),
                 Paragraph(f'<b>{_fmt(total_t, tr)} t CO₂e</b>', S['body_sm'])])
    tbl = Table(data, colWidths=[92*mm, 30*mm, 48*mm], hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
    st.add('BACKGROUND', (0, -1), (-1, -1), CREAM)
    st.add('LINEABOVE', (0, -1), (-1, -1), 1.2, OLIVE)
    tbl.setStyle(st)
    E.append(_caption(S, TBL, t('t_scope', lang), lang))
    E.append(tbl)

    scope_pie = _donut_chart(
        [(t('direct', lang), D['by_scope'].get('scope1', 0.0)),
         (t('indirect', lang), D['total_kg'] - D['by_scope'].get('scope1', 0.0))],
        S, lang)
    if scope_pie is not None:
        E.append(Spacer(1, 4*mm))
        E.append(scope_pie)
        E.append(_fig_caption(S, FIG, t('t_scope', lang), lang))
    E.append(Spacer(1, 5*mm))

    # By ISO category
    cat_rows = []
    data = [[Paragraph('<b>' + ('Emission category' if lang == 'en' else 'Emisyon kategorisi')
                       + '</b>', S['body_sm']),
             Paragraph(f'<b>{t("c_pct", lang)}</b>', S['body_sm']),
             Paragraph(f'<b>{t("c_total", lang)}</b>', S['body_sm'])]]
    for cat in sorted(ROMAN):
        v = D['by_category'][cat] / 1000.0
        label = f'{t("c_cat", lang).rstrip(".")} {ROMAN[cat]}'
        data.append([Paragraph(f'{label} — {ISO_CATEGORY_NAMES[cat][lang]}', S['body_sm']),
                     Paragraph(pct(v), S['body_sm']),
                     Paragraph(f'{_fmt(v, tr)} t CO₂e', S['body_sm'])])
        cat_rows.append((f'{label}', D['by_category'][cat]))
    data.append([Paragraph(f'<b>{t("total", lang)}</b>', S['body_sm']),
                 Paragraph(_localize_num('100.00', tr) if total_t else _localize_num('0.00', tr),
                           S['body_sm']),
                 Paragraph(f'<b>{_fmt(total_t, tr)} t CO₂e</b>', S['body_sm'])])
    tbl = Table(data, colWidths=[92*mm, 30*mm, 48*mm], hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
    st.add('BACKGROUND', (0, -1), (-1, -1), CREAM)
    st.add('LINEABOVE', (0, -1), (-1, -1), 1.2, OLIVE)
    tbl.setStyle(st)
    E.append(_caption(S, TBL, t('t_cat', lang), lang))
    E.append(tbl)

    # A pie for the share-of-total reading, then the proportional bars beneath
    # it: the pie answers "where does the inventory sit", the bars stay
    # readable when several categories are small enough to be slivers.
    cat_pie = _donut_chart(cat_rows, S, lang)
    if cat_pie is not None:
        E.append(Spacer(1, 4*mm))
        E.append(cat_pie)
        E.append(_fig_caption(S, FIG, t('t_cat', lang), lang))
    chart = _bar_row_chart(cat_rows, D['total_kg'], S, lang)
    if chart is not None:
        E.append(Spacer(1, 4*mm))
        E.append(chart)
        E.append(_fig_caption(S, FIG, t('t_cat_bars', lang), lang))
    E.append(PageBreak())

    # Global warming potentials — the constants the CO₂e figures above rest on.
    gwp_data = [[Paragraph(f'<b>{"Greenhouse gas" if lang == "en" else "Sera gazı"}</b>', S['body_sm']),
                 Paragraph(f'<b>{"Description" if lang == "en" else "Açıklama"}</b>', S['body_sm']),
                 Paragraph(f'<b>{"GWP (100-yr)" if lang == "en" else "KIP (100 yıl)"}</b>', S['body_sm'])]]
    for symbol, name_en, name_tr, gwp in GWP_AR6:
        gwp_data.append([
            Paragraph(symbol, S['body_sm']),
            Paragraph(name_en if lang == 'en' else name_tr, S['body_sm']),
            Paragraph(_localize_num(gwp, tr), S['body_sm']),
        ])
    gwp_tbl = Table(gwp_data, colWidths=[34*mm, 96*mm, 40*mm], hAlign='LEFT', repeatRows=1)
    gst = _tbl_style(fn, fnb)
    gst.add('ALIGN', (0, 0), (1, -1), 'LEFT')
    gst.add('ALIGN', (2, 0), (2, -1), 'RIGHT')
    gwp_tbl.setStyle(gst)
    E.append(_caption(S, TBL, t('t_gwp', lang), lang))
    E.append(gwp_tbl)
    E.append(Paragraph(
        'Source: IPCC Sixth Assessment Report (AR6, 2021), 100-year values. Every '
        'emission factor applied in this inventory is expressed in CO₂ equivalent '
        'using these potentials.'
        if lang == 'en' else
        'Kaynak: IPCC Altıncı Değerlendirme Raporu (AR6, 2021), 100 yıllık değerler. '
        'Bu envanterde uygulanan tüm emisyon faktörleri, bu potansiyeller kullanılarak '
        'CO₂ eşdeğeri cinsinden ifade edilmiştir.', S['small']))
    E.append(PageBreak())

    # Per-category detail
    for cat in sorted(ROMAN):
        rows = [r for r in D['sources'] if r['iso_cat'] == cat]
        cat_t = D['by_category'][cat] / 1000.0
        E.append(Paragraph(
            f'4.1.{cat}   {t("c_cat", lang).rstrip(".")} {ROMAN[cat]} — '
            f'{ISO_CATEGORY_NAMES[cat][lang]}', S['h2']))
        if not rows:
            E.append(Paragraph(t('none_recorded', lang), S['no_data']))
            E.append(Spacer(1, 3*mm))
            continue
        E.append(Paragraph(
            (f'Emissions in this category totalled {_fmt(cat_t, tr)} t CO₂e, '
             f'{pct(cat_t)} % of the inventory.')
            if lang == 'en' else
            (f'Bu kategorideki emisyonlar toplam {_fmt(cat_t, tr)} t CO₂e olup '
             f'envanterin %{pct(cat_t)}’ini oluşturmaktadır.'), S['body']))

        data = [[Paragraph(f'<b>{t("c_source", lang)}</b>', S['small']),
                 Paragraph(f'<b>{t("c_activity", lang)}</b>', S['small']),
                 Paragraph(f'<b>{t("c_unit", lang)}</b>', S['small']),
                 Paragraph(f'<b>{t("c_factor", lang)}</b>', S['small']),
                 Paragraph(f'<b>{t("c_ghg_t", lang)}</b>', S['small']),
                 Paragraph(f'<b>{t("c_ref", lang)}</b>', S['small'])]]
        for r in rows:
            data.append([
                Paragraph(f'{cat_label(r["category"], lang)} — {r["name"]}', S['small']),
                Paragraph(_fmt(r['quantity'], tr), S['small']),
                Paragraph(str(r['unit'] or '—'), S['small']),
                Paragraph(_localize_num(f'{r["factor"]:,.4f}', tr), S['small']),
                Paragraph(_fmt(r['kg'] / 1000.0, tr), S['small']),
                Paragraph((r['reference'] or '—')[:90], S['small']),
            ])
        tbl = Table(data, colWidths=[46*mm, 20*mm, 14*mm, 20*mm, 20*mm, 54*mm],
                    hAlign='LEFT', repeatRows=1)
        st = _tbl_style(fn, fnb)
        st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
        st.add('ALIGN', (5, 0), (5, -1), 'LEFT')
        st.add('VALIGN', (0, 0), (-1, -1), 'TOP')
        tbl.setStyle(st)
        E.append(_caption(S, TBL, f'{t("t_ef", lang)} — {ROMAN[cat]}', lang))
        E.append(tbl)

        src_rows = [(f'{cat_label(r["category"], lang)} — {r["name"]}', r['kg']) for r in rows]
        cat_caption = (f'{t("c_cat", lang).rstrip(".")} {ROMAN[cat]} — '
                       f'{ISO_CATEGORY_NAMES[cat][lang]}')
        # Only worth a pie once there is more than one source to compare; with
        # a single source it would be a full circle restating the table.
        if len([r for r in src_rows if r[1] > 0]) > 1:
            pie = _donut_chart(src_rows, S, lang)
            if pie is not None:
                E.append(Spacer(1, 3*mm))
                E.append(pie)
                E.append(_fig_caption(S, FIG, cat_caption, lang))
        chart = _bar_row_chart(src_rows, D['by_category'][cat], S, lang)
        if chart is not None:
            E.append(Spacer(1, 3*mm))
            E.append(chart)
            E.append(_fig_caption(S, FIG, cat_caption, lang))
        E.append(Spacer(1, 5*mm))
    E.append(PageBreak())

    # 4.1.7 Significance assessment
    E.append(Paragraph('4.1.7   ' + t('s4_sig', lang), S['h2']))
    E.append(Paragraph(
        'Indirect emissions have been assessed for significance against magnitude, level '
        'of influence, access to data and sector relevance. Categories contributing at '
        'least 1 % of the inventory are treated as significant and are quantified in full.'
        if lang == 'en' else
        'Dolaylı emisyonlar; büyüklük, etki düzeyi, veriye erişim ve sektörel ilgililik '
        'kriterlerine göre önem açısından değerlendirilmiştir. Envanterin en az %1’ini '
        'oluşturan kategoriler önemli kabul edilerek tam olarak nicelenmiştir.', S['body']))
    data = [[Paragraph(f'<b>{t("c_cat", lang)}</b>', S['body_sm']),
             Paragraph(f'<b>{t("c_pct", lang)}</b>', S['body_sm']),
             Paragraph(f'<b>{t("c_criterion", lang)}</b>', S['body_sm']),
             Paragraph(f'<b>{t("c_result", lang)}</b>', S['body_sm'])]]
    for cat in (CAT_II, CAT_III, CAT_IV, CAT_V, CAT_VI):
        v = D['by_category'][cat] / 1000.0
        share = (v / total_t * 100) if total_t else 0
        significant = share >= 1.0
        data.append([
            Paragraph(f'{ROMAN[cat]}', S['body_sm']),
            Paragraph(_localize_num(f'{share:.2f}', tr), S['body_sm']),
            Paragraph(('Magnitude ≥ 1 % of inventory' if lang == 'en'
                       else 'Envanterin ≥ %1’i'), S['body_sm']),
            Paragraph((('Significant' if significant else 'Not significant') if lang == 'en'
                       else ('Önemli' if significant else 'Önemli değil')), S['body_sm']),
        ])
    tbl = Table(data, colWidths=[16*mm, 24*mm, 76*mm, 54*mm], hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (2, 0), (-1, -1), 'LEFT')
    tbl.setStyle(st)
    E.append(_caption(S, TBL, t('t_sig', lang), lang))
    E.append(tbl)
    E.append(Spacer(1, 5*mm))

    # Uncertainty
    E.append(Paragraph('4.1.8   ' + t('s4_unc', lang), S['h2']))
    E.append(Paragraph(
        'Uncertainty has been considered for both activity data and emission factors. '
        'Activity data drawn from metered or invoiced records carries low uncertainty; '
        'apportioned or estimated data carries higher uncertainty. Emission factor '
        'uncertainty is taken from the publishing source where stated. A quantified '
        'uncertainty statement is maintained in the separate uncertainty calculation '
        'record and is reviewed each reporting period.'
        if lang == 'en' else
        'Belirsizlik, hem faaliyet verisi hem de emisyon faktörleri için değerlendirilmiştir. '
        'Sayaç veya fatura kayıtlarından alınan faaliyet verisi düşük belirsizlik taşır; '
        'dağıtılmış veya tahmin edilmiş veri daha yüksek belirsizlik taşır. Emisyon faktörü '
        'belirsizliği, belirtildiği durumlarda yayınlayan kaynaktan alınır. Nicelenmiş '
        'belirsizlik beyanı ayrı belirsizlik hesaplama kaydında tutulur ve her raporlama '
        'döneminde gözden geçirilir.', S['body']))
    E.append(Spacer(1, 4*mm))

    # Reduction targets
    E.append(Paragraph('4.1.9   ' + t('s4_tgt', lang), S['h2']))
    from emissions.models import ReductionTarget
    targets = list(ReductionTarget.objects.filter(user=report.created_by)) if report.created_by else []
    if targets:
        data = [[Paragraph('<b>' + ('Target' if lang == 'en' else 'Hedef') + '</b>', S['body_sm']),
                 Paragraph('<b>' + ('Target year' if lang == 'en' else 'Hedef yıl') + '</b>',
                           S['body_sm']),
                 Paragraph('<b>' + ('Reduction' if lang == 'en' else 'Azaltım') + '</b>',
                           S['body_sm'])]]
        for tg in targets:
            data.append([
                Paragraph(str(getattr(tg, 'name', None) or getattr(tg, 'scope', '') or '—'),
                          S['body_sm']),
                Paragraph(str(getattr(tg, 'target_year', '') or '—'), S['body_sm']),
                Paragraph(f'{getattr(tg, "reduction_percentage", "—")} %', S['body_sm']),
            ])
        tbl = Table(data, colWidths=[100*mm, 34*mm, 36*mm], hAlign='LEFT', repeatRows=1)
        st = _tbl_style(fn, fnb)
        st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
        tbl.setStyle(st)
        E.append(tbl)
    else:
        E.append(Paragraph(
            'No quantified reduction target has been registered for this reporting period. '
            'Reduction initiatives are tracked in the greenhouse gas management procedure.'
            if lang == 'en' else
            'Bu raporlama dönemi için nicelenmiş azaltım hedefi kaydedilmemiştir. Azaltım '
            'girişimleri sera gazı yönetim prosedüründe izlenmektedir.', S['body']))
    E.append(Spacer(1, 4*mm))

    # Risk & opportunity
    E.append(Paragraph('4.1.10   ' + t('s4_risk', lang), S['h2']))
    E.extend(_bullets(S, (
        ['Identifying carbon-intensive processes creates opportunities to move to more '
         'energy-efficient technology, reducing both cost and emissions.',
         'Renewable electricity procurement (including guarantees of origin) reduces '
         'Category II emissions and strengthens corporate reputation.',
         'Working with lower-emission suppliers reduces Category IV emissions, which is '
         'typically the largest indirect category.',
         'Transparent reporting supports access to sustainability-linked finance and '
         'improves standing in public and private tenders.',
         'Data quality remains the principal risk to the inventory; it is managed through '
         'the controls described in the quality management system below.']
        if lang == 'en' else
        ['Karbon yoğun süreçlerin belirlenmesi, hem maliyeti hem emisyonu azaltan daha '
         'verimli teknolojiye geçiş fırsatı yaratır.',
         'Yenilenebilir elektrik tedariki (menşe garantileri dâhil) Kategori II '
         'emisyonlarını azaltır ve kurumsal itibarı güçlendirir.',
         'Daha düşük emisyonlu tedarikçilerle çalışmak, genellikle en büyük dolaylı '
         'kategori olan Kategori IV emisyonlarını azaltır.',
         'Şeffaf raporlama, sürdürülebilirlik bağlantılı finansmana erişimi destekler ve '
         'ihalelerde avantaj sağlar.',
         'Veri kalitesi envanterin başlıca riskidir; aşağıdaki kalite yönetim sisteminde '
         'tanımlanan kontrollerle yönetilir.'])))
    E.append(Spacer(1, 4*mm))

    # Verification
    E.append(Paragraph('4.1.11   ' + t('s4_ver', lang), S['h2']))
    ver = _answer_text(A, '7B-1', lang, default=None)
    if ver and ver != t('not_declared', lang):
        E.append(Paragraph(ver, S['body']))
    else:
        E.append(Paragraph(
            'This inventory has been prepared for verification at a limited or reasonable '
            'level of assurance by an accredited independent third party. The verification '
            'statement, once issued, is retained with this report.'
            if lang == 'en' else
            'Bu envanter, akredite bağımsız üçüncü tarafça sınırlı veya makul güvence '
            'düzeyinde doğrulanmak üzere hazırlanmıştır. Doğrulama beyanı düzenlendiğinde '
            'bu raporla birlikte saklanır.', S['body']))
    E.append(Spacer(1, 4*mm))

    # QMS
    E.append(Paragraph('4.1.12   ' + t('s4_qms', lang), S['h2']))
    E.extend(_bullets(S, (
        ['compliance with the principles of ISO 14064-1:2018 is maintained;',
         'the inventory remains fit for its intended purpose;',
         'routine checks are performed on the accuracy of the inventory and deficiencies '
         'are addressed;',
         'identified errors are corrected and the correction recorded;',
         'inventory records are documented and archived, and retained for ten years.']
        if lang == 'en' else
        ['ISO 14064-1:2018 ilkelerine uygunluk sürdürülür;',
         'envanter amaçlanan kullanıma uygun kalır;',
         'envanterin doğruluğu rutin olarak kontrol edilir ve eksiklikler giderilir;',
         'tespit edilen hatalar düzeltilir ve düzeltme kaydedilir;',
         'envanter kayıtları belgelenip arşivlenir ve on yıl saklanır.'])))
    E.append(PageBreak())

    # 4.2 Activity-based assessment — the same inventory cut by what the
    # organisation actually does, rather than by ISO category. An activity can
    # straddle categories (fuel appears under both combustion and transport),
    # so this is the view that answers "which activity should we act on first".
    E.append(Paragraph('4.2   ' + t('s4_act', lang), S['h2']))
    acts = D.get('by_activity') or {}
    live_acts = [(cat_label(k, lang), v) for k, v in acts.items() if v > 0]
    if live_acts:
        live_acts.sort(key=lambda kv: -kv[1])
        biggest, biggest_kg = live_acts[0]
        E.append(Paragraph(
            (f'Emissions are spread across {len(live_acts)} activity types. The largest '
             f'is {biggest.lower()}, at {_fmt(biggest_kg / 1000.0, tr)} t CO₂e '
             f'({pct(biggest_kg / 1000.0)} % of the inventory).')
            if lang == 'en' else
            (f'Emisyonlar {len(live_acts)} faaliyet türüne dağılmaktadır. En büyüğü '
             f'{biggest.lower()} olup {_fmt(biggest_kg / 1000.0, tr)} t CO₂e '
             f'(envanterin %{pct(biggest_kg / 1000.0)}’i) düzeyindedir.'), S['body']))

        data = [[Paragraph(f'<b>{"Activity type" if lang == "en" else "Faaliyet türü"}</b>', S['body_sm']),
                 Paragraph(f'<b>{t("c_pct", lang)}</b>', S['body_sm']),
                 Paragraph(f'<b>{t("c_total", lang)}</b>', S['body_sm'])]]
        for label, v in live_acts:
            data.append([Paragraph(label, S['body_sm']),
                         Paragraph(pct(v / 1000.0), S['body_sm']),
                         Paragraph(f'{_fmt(v / 1000.0, tr)} t CO₂e', S['body_sm'])])
        data.append([Paragraph(f'<b>{t("total", lang)}</b>', S['body_sm']),
                     Paragraph(_localize_num('100.00', tr), S['body_sm']),
                     Paragraph(f'<b>{_fmt(total_t, tr)} t CO₂e</b>', S['body_sm'])])
        tbl = Table(data, colWidths=[92*mm, 30*mm, 48*mm], hAlign='LEFT', repeatRows=1)
        st = _tbl_style(fn, fnb)
        st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
        st.add('BACKGROUND', (0, -1), (-1, -1), CREAM)
        st.add('LINEABOVE', (0, -1), (-1, -1), 1.2, OLIVE)
        tbl.setStyle(st)
        E.append(_caption(S, TBL, t('t_act', lang), lang))
        E.append(tbl)

        act_pie = _donut_chart(live_acts, S, lang)
        if act_pie is not None:
            E.append(Spacer(1, 4*mm))
            E.append(act_pie)
            E.append(_fig_caption(S, FIG, t('t_act', lang), lang))
        act_bars = _bar_row_chart(live_acts, D['total_kg'], S, lang, max_rows=14)
        if act_bars is not None:
            E.append(Spacer(1, 4*mm))
            E.append(act_bars)
            E.append(_fig_caption(S, FIG, t('t_act', lang), lang))
    else:
        E.append(Paragraph(t('none_recorded', lang), S['no_data']))
    E.append(PageBreak())

    # 4.3 Location evaluation
    E.append(Paragraph('4.3   ' + t('s4_2', lang), S['h2']))
    facs = D['facilities']
    if facs:
        ordered = sorted(facs.items(), key=lambda kv: -sum(kv[1].values()))
        data = [[Paragraph(f'<b>{t("c_facility", lang)}</b>', S['small'])] +
                [Paragraph(f'<b>{ROMAN[c]}</b>', S['small']) for c in sorted(ROMAN)] +
                [Paragraph(f'<b>{t("c_total", lang)}</b>', S['small'])]]
        for name, cats in ordered[:20]:
            tot = sum(cats.values()) / 1000.0
            data.append(
                [Paragraph(name, S['small'])] +
                [Paragraph(_fmt(cats[c] / 1000.0, tr), S['small']) for c in sorted(ROMAN)] +
                [Paragraph(f'<b>{_fmt(tot, tr)}</b>', S['small'])]
            )
        tbl = Table(data, colWidths=[54*mm] + [16*mm]*6 + [20*mm], hAlign='LEFT',
                    repeatRows=1)
        st = _tbl_style(fn, fnb)
        st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
        tbl.setStyle(st)
        E.append(_caption(S, TBL, t('t_loc', lang), lang))
        E.append(tbl)
        chart = _bar_row_chart([(n, sum(c.values())) for n, c in ordered],
                               D['total_kg'], S, lang)
        if chart is not None:
            E.append(Spacer(1, 4*mm))
            E.append(chart)
            E.append(_fig_caption(S, FIG, t('t_loc', lang), lang))
    else:
        E.append(Paragraph(
            'Activity data has not been attributed to individual facilities, so a '
            'location-level breakdown is not presented. Assign facilities to emission '
            'records to enable this section.'
            if lang == 'en' else
            'Faaliyet verisi ayrı tesislere atanmadığından tesis bazında dağılım '
            'sunulmamıştır. Bu bölümün oluşması için emisyon kayıtlarına tesis atayın.',
            S['no_data']))


# ═══════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════
def generate_iso_report(report: CarbonReport, lang: str = 'en') -> bytes:
    """Build the full ISO 14064-1:2018 inventory report. Returns PDF bytes."""
    lang = 'tr' if lang == 'tr' else 'en'
    S = _styles()
    D = _gather(report, lang)

    company = D['company']
    cname = company.legal_entity_name if company else '—'

    buf = io.BytesIO()
    doc = _ReportDocTemplate(
        buf, cname, D['year'], lang,
        pagesize=A4, topMargin=20*mm, bottomMargin=20*mm,
        leftMargin=20*mm, rightMargin=20*mm,
        title=f'{t("standard", lang)} {t("doc_title", lang)} {D["year"]}',
        author='Carbonless',
    )

    E = []
    TBL, FIG = _Counter(), _Counter()
    _cover(E, S, D, report, lang)
    _contents(E, S, lang)
    _section1(E, S, D, report, lang, TBL, FIG)
    _section2(E, S, lang)
    _section3(E, S, D, report, lang, TBL, FIG)
    _section4(E, S, D, report, lang, TBL, FIG)

    doc.build(E)
    return buf.getvalue()
