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
import os
from datetime import datetime

from django.db.models import Sum
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, TableStyle,
    Paragraph, Spacer, Table, PageBreak, KeepTogether, NextPageTemplate,
)
from reportlab.graphics.shapes import Drawing, String, Rect, Line, Polygon
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.legends import Legend

# The brand mark — same PNG served as the site favicon (nexus_insights.../
# public/carbonless.png references this file by content, not by path; this
# copy lives alongside the Django static files). Referenced by absolute path
# so report generation doesn't depend on collectstatic having run.
LOGO_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static', 'img', 'carbonless.png')

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
        # Numeric cells in the six-gas inventory tables: a step smaller and
        # right-aligned, so a figure like 2,552.70 sits on one line in a 12 mm
        # column and the decimal points line up down the column.
        'num': ParagraphStyle('num', fontName=fn, fontSize=6.8, textColor=MUTED,
                               alignment=TA_RIGHT, spaceAfter=2, leading=9),
        'num_hdr': ParagraphStyle('num_hdr', fontName=fnb, fontSize=6.8, textColor=INK,
                                   alignment=TA_RIGHT, spaceAfter=2, leading=9),
        'toc': ParagraphStyle('toc', fontName=fnb, fontSize=10.5, textColor=INK,
                               spaceBefore=7, spaceAfter=3, leading=15),
        'toc_sub': ParagraphStyle('toc_sub', fontName=fn, fontSize=9, textColor=MUTED,
                                   leftIndent=10, spaceBefore=0, spaceAfter=2, leading=13),
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


# ═══════════════════════════════════════════════════════════════════════════
# METHODOLOGY REFERENCE CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════
# A full inventory report discloses not only the factors applied but the
# constants those published factors rest on, so a verifier can retrace the
# chain from a metered litre of diesel to a kilogram of CO₂e.
#
# The platform applies factors already expressed in kg CO₂e per activity unit
# (see EmissionFactor.factor_kg_co2e), so it performs no density or net
# calorific value conversion of its own. These tables are therefore published
# as *references* for the constants underlying combustion factors of this
# type — section 4.1.1.1 says so explicitly rather than implying the platform
# ran the IPCC TJ route itself.
FUEL_DENSITY_REF = [
    ('Natural gas', 'Doğal gaz', '0.796', 'kg/m³',
     'DEFRA 2024 — fuel properties — natural gas'),
    ('Diesel', 'Motorin', '830.565', 'kg/m³',
     'DEFRA 2024 — fuel properties — diesel (100 % mineral diesel)'),
    ('Petrol', 'Benzin', '746.269', 'kg/m³',
     'DEFRA 2024 — fuel properties — petrol (100 % mineral petrol)'),
    ('LPG', 'LPG', '540.000', 'kg/m³', 'DEFRA 2024 — fuel properties — LPG'),
    ('Fuel oil', 'Fuel oil', '980.000', 'kg/m³',
     'DEFRA 2024 — fuel properties — fuel oil'),
]

FUEL_NCV_REF = [
    ('Natural gas', 'Doğal gaz', '48.0', 'IPCC 2006, Vol. 2, Ch. 1, Table 1.2'),
    ('Diesel', 'Motorin', '43.0', 'IPCC 2006, Vol. 2, Ch. 1, Table 1.2'),
    ('Petrol', 'Benzin', '44.3', 'IPCC 2006, Vol. 2, Ch. 1, Table 1.2'),
    ('LPG', 'LPG', '47.3', 'IPCC 2006, Vol. 2, Ch. 1, Table 1.2'),
    ('Fuel oil', 'Fuel oil', '40.4', 'IPCC 2006, Vol. 2, Ch. 1, Table 1.2'),
    ('Coal (other bituminous)', 'Kömür (bitümlü)', '25.8',
     'IPCC 2006, Vol. 2, Ch. 1, Table 1.2'),
]

FUEL_EF_REF = [
    ('Natural gas', 'Doğal gaz', 'Stationary', 'Sabit', '56,100', '5', '0.1',
     'IPCC 2006, Vol. 2, Ch. 2, Table 2.3'),
    ('Diesel — ON ROAD', 'Motorin — ON ROAD', 'Mobile', 'Hareketli',
     '74,100', '3.9', '3.9', 'IPCC 2006, Vol. 2, Ch. 3, Tables 3.2.1 / 3.2.2'),
    ('Petrol — ON ROAD', 'Benzin — ON ROAD', 'Mobile', 'Hareketli',
     '69,300', '3.8', '5.7',
     'IPCC 2006, Vol. 2, Ch. 3, Tables 3.2.1 / 3.2.2 — low mileage'),
    ('Diesel — stationary', 'Motorin — sabit', 'Stationary', 'Sabit',
     '74,100', '3', '0.6', 'IPCC 2006, Vol. 2, Ch. 2, Table 2.3'),
    ('LPG', 'LPG', 'Stationary', 'Sabit', '63,100', '5', '0.1',
     'IPCC 2006, Vol. 2, Ch. 2, Table 2.3'),
]

LEAKAGE_RATE_REF = [
    ('Refrigerators / water coolers', 'Buzdolabı / su sebili', '0',
     'IPCC 2006, Vol. 3, Ch. 7, Table 7.9'),
    ('Air conditioners', 'Klimalar', '1', 'IPCC 2006, Vol. 3, Ch. 7, Table 7.9'),
    ('Commercial refrigeration', 'Ticari soğutma', '15',
     'IPCC 2006, Vol. 3, Ch. 7, Table 7.9'),
    ('Fire extinguishers', 'Yangın söndürücüler', '4',
     'IPCC 2005, Ch. 9 (fire protection), Table 9.2'),
]

# The six gas columns the inventory and per-category data tables carry, in the
# order ISO 14064-1 reports them.
GAS_COLS = ('CO₂', 'CH₄', 'N₂O', 'HFC', 'PFC', 'SF₆')

# Fugitive sources release one identifiable gas, so their CO₂e belongs in that
# gas's column. Matched on the factor name, lowercased.
_PFC_MARKERS = ('pfc', 'cf4', 'c2f6', 'perfluoro', 'perflor')
_SF6_MARKERS = ('sf6', 'sf₆', 'sulphur hexafluoride', 'sulfur hexafluoride',
                'kükürt heksaflorür')
_NF3_MARKERS = ('nf3', 'nf₃', 'nitrogen trifluoride', 'azot triflorür')


# EmissionFactor names its gas columns in ASCII; this report prints them with
# subscripts. Same six columns, same order.
GAS_KEY_TO_COL = {'CO2': 'CO₂', 'CH4': 'CH₄', 'N2O': 'N₂O',
                  'HFC': 'HFC', 'PFC': 'PFC', 'SF6': 'SF₆'}


def gas_column_for(row):
    """Fallback column for a source whose factor publishes no per-gas split.

    Most factors now carry one (see EmissionFactor.gas_split), and this is not
    consulted for those. It remains for the rest — grid electricity, purchased
    goods, waste, water, distance-based composite factors — where the publisher
    issues a single CO₂e figure. Those go in the CO₂ column, and the table
    footnote says which rows were reported that way rather than letting a
    reader assume every gas was quantified separately.

    A fugitive release with no seeded split is still a single named gas, so it
    is placed by gas identity, which is accurate without inferring anything.
    """
    if row.get('category') != 'fugitive_emissions':
        return 'CO₂'
    name = (row.get('name') or '').lower()
    if any(m in name for m in _SF6_MARKERS):
        return 'SF₆'
    if any(m in name for m in _PFC_MARKERS):
        return 'PFC'
    if any(m in name for m in _NF3_MARKERS):
        # NF₃ has no column of its own in the ISO layout; it is reported with
        # the other fluorinated gases rather than dropped.
        return 'PFC'
    return 'HFC'


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
    'intro': {'en': 'Introduction', 'tr': 'Giriş'},
    't_flow': {'en': 'Greenhouse gas accounting and reporting workflow',
               'tr': 'Sera gazı hesaplama ve raporlama iş akışı'},

    # Section titles
    's1': {'en': 'ORGANISATIONAL INFORMATION AND INTRODUCTION',
           'tr': 'KURUMSAL BİLGİLER VE GİRİŞ'},
    's1_basic': {'en': 'Basic report information', 'tr': 'Temel rapor bilgileri'},
    's1_1': {'en': 'Purpose and Scope', 'tr': 'Amaç ve Kapsam'},
    's1_2': {'en': 'Responsibilities', 'tr': 'Görev ve Sorumluluklar'},
    's1_3': {'en': 'Target Users', 'tr': 'Hedef Kullanıcılar'},
    's1_4': {'en': 'Standards and Documents Used',
             'tr': 'Kullanılan Standartlar ve Dokümanlar'},
    's1_4_1': {'en': 'The ISO 14064 Family of Standards',
               'tr': 'ISO 14064 Standart Ailesi'},
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
    's4_trend': {'en': 'Year-on-Year Comparison', 'tr': 'Yıllar Arası Karşılaştırma'},
    't_trend': {'en': 'Total greenhouse gas emissions by year',
                'tr': 'Yıllara göre toplam sera gazı emisyonları'},
    't_cov': {'en': 'Coverage of activity data across facilities',
              'tr': 'Faaliyet verisinin tesisler arasındaki kapsamı'},

    # ── Section 4 headings, numbered as the ISO inventory report does ──
    's4_direct': {'en': 'Direct Greenhouse Gas Emissions — Calculation and Analysis',
                  'tr': 'Doğrudan Sera Gazı Emisyonları — Hesaplama ve Analiz'},
    's4_dir_comb': {'en': 'Calculation of Direct Emissions from Stationary and Mobile '
                          'Combustion Sources',
                    'tr': 'Sabit ve Hareketli Yanma Kaynaklarından Doğrudan Emisyonların '
                          'Hesaplanması'},
    's4_dir_leak': {'en': 'Direct Emissions from Anthropogenic System Leaks',
                    'tr': 'Antropojenik Sistem Sızıntılarından Doğrudan Emisyonlar'},
    's4_dir_an': {'en': 'Direct Greenhouse Gas Emissions Analysis',
                  'tr': 'Doğrudan Sera Gazı Emisyonları Analizi'},
    's4_indirect': {'en': 'Indirect Greenhouse Gas Emissions — Calculation and Analysis',
                    'tr': 'Dolaylı Sera Gazı Emisyonları — Hesaplama ve Analiz'},
    's4_loc': {'en': 'Location-Based Evaluation', 'tr': 'Tesis Bazında Değerlendirme'},
    's4_actsub': {'en': 'Activity-Based Assessment', 'tr': 'Faaliyet Bazında Değerlendirme'},

    # ── Methodology reference tables ──
    't_density': {'en': 'Fuel density references', 'tr': 'Yakıt yoğunluğu referansları'},
    't_ncv': {'en': 'Fuel net calorific value references',
              'tr': 'Yakıt net kalorifik değer referansları'},
    't_fuel_ef': {'en': 'Fuel emission factor references',
                  'tr': 'Yakıt emisyon faktörü referansları'},
    't_leak': {'en': 'Anthropogenic system leakage rate references',
               'tr': 'Antropojenik sistem sızıntı oranı referansları'},
    't_cat_data': {'en': 'greenhouse gas emissions, Category {cat} data',
                   'tr': 'sera gazı emisyonları, Kategori {cat} verileri'},

    # ── Column headers for the per-gas inventory tables ──
    'c_density': {'en': 'Density', 'tr': 'Yoğunluk'},
    'c_ncv': {'en': 'NCV (TJ/Gg)', 'tr': 'NKD (TJ/Gg)'},
    'c_comb_type': {'en': 'Combustion type', 'tr': 'Yanma türü'},
    'c_leak_rate': {'en': 'Leakage rate (%)', 'tr': 'Sızıntı oranı (%)'},
    'c_device': {'en': 'Device type', 'tr': 'Cihaz türü'},
    'c_fuel': {'en': 'Fuel', 'tr': 'Yakıt'},
    'c_cat_n_total': {'en': 'CATEGORY {cat} TOTAL', 'tr': 'KATEGORİ {cat} TOPLAMI'},

    # Table captions
    't_org': {'en': 'Organisational information', 'tr': 'Kurumsal bilgiler'},
    't_roles': {'en': 'Greenhouse gas inventory report contact roles',
                'tr': 'Sera gazı envanter raporu iletişim rolleri'},
    't_orgchart': {'en': 'Greenhouse gas reporting structure',
                   'tr': 'Sera gazı raporlama yapısı'},
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


# Option labels for the section-6 single-select questions (questionnaire
# `6A-*`/`6C-*` steps). The questionnaire only stores the selected option's
# code (e.g. 'not_controlled'), not display text, so the report has to carry
# its own copy of the same labels the intake UI uses
# (nexus_insights.../src/lib/carboniq/questions.js) to render prose instead
# of raw codes.
EXCLUSION_REASON_LABELS = {
    'not_controlled': {'en': 'outside operational control', 'tr': 'operasyonel kontrol dışında'},
    'no_data': {'en': 'data inaccessible', 'tr': 'veri erişilemez'},
    'materiality': {'en': 'below the materiality threshold (<5 %)',
                    'tr': 'materyalite eşiğinin altında (<%5)'},
    'legal': {'en': 'a legal or regulatory barrier', 'tr': 'yasal veya idari bir engel'},
    'technical': {'en': 'a technical limitation', 'tr': 'teknik bir sınırlama'},
    'other': {'en': 'other', 'tr': 'diğer'},
}
EXCLUSION_BAND_LABELS = {
    'lt1': {'en': '<1 % of the inventory (negligible)', 'tr': "envanterin <%1'i (ihmal edilebilir)"},
    '1_5': {'en': '1-5 % of the inventory (low impact)', 'tr': "envanterin %1-5'i (düşük etki)"},
    '5_10': {'en': '5-10 % of the inventory (medium impact)',
              'tr': "envanterin %5-10'u (orta etki)"},
    '10_20': {'en': '10-20 % of the inventory (high impact)',
               'tr': "envanterin %10-20'si (yüksek etki)"},
    'gt20': {'en': '>20 % of the inventory (critical)', 'tr': "envanterin >%20'si (kritik)"},
}
EXCEPTION_TYPE_LABELS = {
    'ef_deviation': {'en': 'a different emission factor was used than the declared database',
                     'tr': 'beyan edilen veri tabanından farklı bir emisyon faktörü kullanılmıştır'},
    'boundary_deviation': {'en': 'a deviation from the declared organisational boundary',
                           'tr': 'beyan edilen organizasyon sınırından bir sapma vardır'},
    'methodology_deviation': {'en': 'a deviation from the declared calculation methodology',
                              'tr': 'beyan edilen hesaplama metodolojisinden bir sapma vardır'},
    'multiple': {'en': 'multiple exceptions to the declared methodology apply',
                'tr': 'beyan edilen metodolojiye ilişkin birden fazla istisna geçerlidir'},
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


def _raw_answer(answers, step_id):
    """The stored value for one questionnaire step, wrapper stripped.

    Single-value question types (single_select, text, …) are persisted as
    ``{'answer': <value>}`` — a single-key envelope, not a compound answer
    with several named fields — so it has to be unwrapped before the value
    underneath (a plain code like ``'none_flagged'`` or a nested dict for a
    per-item text question) can be used. Only that one wrapper shape is
    unwrapped; genuine compound answers (several distinct field ids) are
    left as a dict for `_answer_text` to join.
    """
    raw = answers.get(step_id)
    if isinstance(raw, dict) and set(raw.keys()) == {'answer'}:
        return raw['answer']
    return raw


def _answer_text(answers, step_id, lang, default=None):
    """Render one questionnaire answer as display text.

    Answers are stored as free-form JSON — the questionnaire has text, single-
    and multi-select, compound and repeatable question types — so this has to
    cope with strings, lists and dicts rather than assuming one shape.
    """
    raw = _raw_answer(answers, step_id)
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
            # Per-gas breakdown, filled below. `split_basis` is None when the
            # factor publishes no split; the tables then fall back to a single
            # column and the footnote says which rows those were.
            'gas_kg': {g: 0.0 for g in GAS_COLS},
            'split_basis': f.gas_split_basis or None,
            'split_reference': f.gas_split_reference or '',
        })
        row['quantity'] += float(e.quantity or 0)
        row['kg'] += kg
        row['count'] += 1
        # Shares rather than the per-gas factors themselves: the stored CO₂e is
        # authoritative (it may have been calculated against an older factor
        # value), so apportioning it keeps the gas columns adding up to exactly
        # the emission this inventory reports.
        shares = f.gas_split_shares()
        if shares:
            for gas_key, share in shares.items():
                row['gas_kg'][GAS_KEY_TO_COL[gas_key]] += kg * float(share)
        else:
            row['gas_kg'][gas_column_for(row)] += kg

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
            # An approved custom request carries a CO₂e figure and no factor
            # record, so there is no split to read — it reports as combined.
            'gas_kg': {g: 0.0 for g in GAS_COLS},
            'split_basis': None, 'split_reference': '',
        })
        row['quantity'] += float(getattr(cr, 'quantity', 0) or 0)
        row['kg'] += kg
        row['count'] += 1
        row['gas_kg'][gas_column_for(row)] += kg
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

    # Per-facility, per-category matrix for section 4.2, and per-facility,
    # per-activity-type for the activity-level location breakdowns in 4.3
    # (the same cut the sample report devotes a figure to for each activity —
    # "which facility drives this activity's emissions" rather than "which
    # category is this facility's biggest").
    facilities = {}
    facility_activity = {}
    for e in entries:
        name = e.facility.name if e.facility else None
        if not name:
            continue
        iso_cat = iso_category_for(e.emission_factor.scope, e.emission_factor.category)
        kg = float(e.calculated_co2e_kg or 0)
        fac = facilities.setdefault(name, {c: 0.0 for c in ROMAN})
        fac[iso_cat] += kg
        act_key = e.emission_factor.category
        fa = facility_activity.setdefault(act_key, {})
        fa[name] = fa.get(name, 0.0) + kg

    # Totals by year, across every year the company has activity data for —
    # not just the reporting year — so the base-year comparison the
    # methodology section already describes (clause 3.2) can actually be
    # shown rather than just asserted.
    year_totals = {}
    if company:
        for row in (EmissionEntry.objects.filter(company=company)
                    .values('year').annotate(total=Sum('calculated_co2e_kg'))):
            year_totals[row['year']] = year_totals.get(row['year'], 0.0) + float(row['total'] or 0)
        for cr in CustomEmissionRequest.objects.filter(
                company=company, status='approved', calculated_co2e_kg__isnull=False):
            year_totals[cr.year] = year_totals.get(cr.year, 0.0) + float(cr.calculated_co2e_kg or 0)

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
        'facility_activity': facility_activity,
        'year_totals': year_totals,
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


def _ref_table(E, S, lang, TBL, caption, headers, rows, col_widths):
    """A plain reference table — headers and already-formatted string cells.

    Used for the methodology constants (densities, net calorific values, IPCC
    default factors, leakage rates), which are fixed published values rather
    than anything derived from this organisation's data.
    """
    fn, fnb = S['fn'], S['fnb']
    data = [[Paragraph(f'<b>{h}</b>', S['small']) for h in headers]]
    for r in rows:
        data.append([Paragraph(str(c), S['small']) for c in r])
    tbl = Table(data, colWidths=col_widths, hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
    st.add('ALIGN', (-1, 0), (-1, -1), 'LEFT')
    st.add('VALIGN', (0, 0), (-1, -1), 'TOP')
    tbl.setStyle(st)
    E.append(_caption(S, TBL, caption, lang))
    E.append(tbl)
    E.append(Spacer(1, 4*mm))


def _bullets(S, items):
    return [Paragraph(f'• {i}', S['body']) for i in items]


def _ellipsize(text_, limit):
    """Hard-truncate long reference/source strings for a fixed-width table
    cell, marking the cut with an ellipsis rather than silently dropping the
    tail — a bare slice can chop a value mid-number (e.g. a factor
    "N2O=0.0015)" reading as "N2O=0.00"), which looks like a rendering bug
    rather than a deliberate summary."""
    text_ = (text_ or '—')
    if len(text_) <= limit:
        return text_
    return text_[:max(0, limit - 1)].rstrip() + '…'


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


def _org_chart(roles, prepared, S, width_mm=170, height_mm=54):
    """A minimal three-tier reporting-line diagram — senior management,
    then the sustainability officer, then environmental engineer / data
    owners side by side — mirroring the same four roles already declared
    in Table 2 (`roles`, in fixed order: officer, data owners, engineer,
    senior management). No data beyond what that table already states."""
    fn, fnb = S['fn'], S['fnb']
    d = Drawing(width_mm * mm, height_mm * mm)
    sust, data_owners, env_eng, senior = (r[0] for r in roles)

    def box(cx, cy, w, h, lines):
        d.add(Rect(cx - w/2, cy - h/2, w, h, rx=2*mm, ry=2*mm,
                    fillColor=ACCENT_SOFT, strokeColor=ACCENT, strokeWidth=0.8))
        line_h = 8
        start_y = cy + line_h * (len(lines) - 1) / 2 - 2.6
        for i, (text, bold, size, color) in enumerate(lines):
            d.add(String(cx, start_y - i * line_h, text,
                          fontName=(fnb if bold else fn), fontSize=size,
                          fillColor=color, textAnchor='middle'))

    cx_mid = width_mm / 2 * mm
    top_y = height_mm * mm - 7 * mm
    mid_y = height_mm * mm - 25 * mm
    bot_y = 7 * mm
    left_x, right_x = 40 * mm, (width_mm - 40) * mm

    d.add(Line(cx_mid, top_y - 5.5*mm, cx_mid, mid_y + 6.5*mm, strokeColor=LINE, strokeWidth=1))
    branch_y = mid_y - 6.5*mm
    d.add(Line(cx_mid, mid_y - 6.5*mm, cx_mid, branch_y, strokeColor=LINE, strokeWidth=1))
    d.add(Line(left_x, branch_y, right_x, branch_y, strokeColor=LINE, strokeWidth=1))
    d.add(Line(left_x, branch_y, left_x, bot_y + 5.5*mm, strokeColor=LINE, strokeWidth=1))
    d.add(Line(right_x, branch_y, right_x, bot_y + 5.5*mm, strokeColor=LINE, strokeWidth=1))

    box(cx_mid, top_y, 62*mm, 11*mm, [(senior, True, 7.5, INK)])
    mid_lines = [(sust, True, 7.5, INK)]
    if prepared:
        mid_lines.append((prepared, False, 6.5, MUTED))
    box(cx_mid, mid_y, 78*mm, 13*mm, mid_lines)
    box(left_x, bot_y, 66*mm, 11*mm, [(env_eng, True, 7, INK)])
    box(right_x, bot_y, 66*mm, 11*mm, [(data_owners, True, 7, INK)])
    return d


def _flow_diagram(steps, S, width_mm=170, height_mm=32):
    """A left-to-right process diagram: N boxes joined by arrows.

    Used for the GHG accounting workflow figure in section 1 — the
    organisation-agnostic equivalent of the sector-specific "activities
    workflow diagram" a single-sector report would draw, since this platform
    serves organisations across sectors and has no one process to depict.
    `steps` is a list of short label strings, rendered in order left to right.
    """
    fn, fnb = S['fn'], S['fnb']
    n = len(steps)
    d = Drawing(width_mm * mm, height_mm * mm)
    cy = height_mm / 2 * mm
    box_w = (width_mm - 8) / n - 6
    gap = 6
    x = 0
    centers = []
    for i, label in enumerate(steps):
        cx = (x + box_w / 2) * mm
        centers.append((x, box_w))
        d.add(Rect(x * mm, cy - 8*mm, box_w * mm, 16*mm, rx=2*mm, ry=2*mm,
                    fillColor=ACCENT_SOFT, strokeColor=ACCENT, strokeWidth=0.9))
        words = label.split(' ')
        # Wrap onto two lines around the midpoint so labels of 3-5 words fit
        # the fixed-width box without the renderer's own line breaking.
        mid = len(words) // 2 + (1 if len(words) % 2 else 0)
        lines = [' '.join(words[:mid]), ' '.join(words[mid:])] if len(words) > 2 else [label]
        line_h = 8.5
        start_y = cy + line_h * (len(lines) - 1) / 2 - 2.6
        for j, line in enumerate(lines):
            d.add(String(cx, start_y - j * line_h, line, fontName=fnb, fontSize=6.8,
                          fillColor=INK, textAnchor='middle'))
        x += box_w + gap
    # Arrows between consecutive boxes: a line plus a small filled triangle.
    for i in range(n - 1):
        x0 = (centers[i][0] + centers[i][1]) * mm
        x1 = centers[i + 1][0] * mm
        tip = x1 - 0.3*mm
        base = tip - 2.2*mm
        d.add(Line(x0, cy, base, cy, strokeColor=MUTED, strokeWidth=1))
        d.add(Polygon(points=[base, cy - 1.6*mm, base, cy + 1.6*mm, tip, cy],
                       fillColor=MUTED, strokeColor=None))
    return d


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
         f'{_ellipsize(lbl, 38)}  —  {_fmt(v / 1000.0, tr)} t  ({_localize_num(f"{v / total * 100:.1f}", tr)} %)')
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
    def __init__(self, buf, company_name, year, lang, page_offset=0, **kw):
        super().__init__(buf, **kw)
        self.company_name = company_name
        self.year = year
        self.lang = lang
        # See emissions.report_pdf._ReportDocTemplate — pages printed ahead of
        # this one, so the combined pack numbers straight through.
        self.page_offset = page_offset

        frame_cover = Frame(20*mm, 20*mm, A4[0]-40*mm, A4[1]-40*mm, id='cover')
        frame_body = Frame(20*mm, 20*mm, A4[0]-40*mm, A4[1]-48*mm, id='body')

        self.addPageTemplates([
            PageTemplate(id='cover', frames=[frame_cover], onPage=self._cover_page),
            PageTemplate(id='content', frames=[frame_body], onPage=self._content_page),
        ])

    @staticmethod
    def _draw_logo(canvas, x, y, size):
        """Draw the brand mark at (x, y)-bottom-left, `size` square. Silently
        skipped if the asset can't be read — a missing decorative logo must
        never break report generation."""
        try:
            canvas.drawImage(LOGO_PATH, x, y, width=size, height=size,
                              mask='auto', preserveAspectRatio=True)
        except Exception:
            pass

    def _cover_page(self, canvas, doc):
        fn, fnb = _fonts()
        w, h = A4
        # A single thin rule frames a small wordmark row — no color blocks,
        # no corner decoration, no panel behind the title.
        canvas.setStrokeColor(ACCENT)
        canvas.setLineWidth(0.75)
        canvas.line(20*mm, h-22*mm, w-20*mm, h-22*mm)
        self._draw_logo(canvas, 20*mm, h-20.5*mm, 5*mm)
        canvas.setFont(fnb, 8)
        canvas.setFillColor(ACCENT)
        canvas.drawString(27*mm, h-19*mm, 'CARBONLESS')
        canvas.setFont(fn, 8)
        canvas.setFillColor(FAINT)
        canvas.drawRightString(w-20*mm, h-19*mm, 'ISO 14064-1:2018')
        # A larger mark above the title block, on the content frame's own
        # left margin — the one clearly "branded" element on an otherwise
        # unadorned cover. Sits in the whitespace between the header rule
        # and where the flowable content (company name, title) starts.
        self._draw_logo(canvas, 20*mm, h-46*mm, 16*mm)

    def _content_page(self, canvas, doc):
        fn, fnb = _fonts()
        w, h = A4
        # Header — a hairline rule, small left wordmark, small right meta.
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.6)
        canvas.line(20*mm, h-15*mm, w-20*mm, h-15*mm)
        self._draw_logo(canvas, 20*mm, h-13.8*mm, 3.6*mm)
        # The running head names the document and the reporting year, and the
        # page number sits opposite it — the chrome a printed inventory report
        # carries, so any loose page can be placed back in the document.
        canvas.setFont(fnb, 7.5)
        canvas.setFillColor(ACCENT)
        canvas.drawString(25*mm, h-13*mm,
                          f'{t("standard", self.lang)} {t("doc_title", self.lang)} — {self.year}')
        canvas.setFont(fn, 7)
        canvas.setFillColor(FAINT)
        page_num = doc.page - 1 + self.page_offset
        label = 'Sayfa' if self.lang == 'tr' else 'Page'
        canvas.drawRightString(w-20*mm, h-13*mm, f'{label} {page_num}')
        # Footer — hairline rule, organisation and issue date, no box/fill.
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.4)
        canvas.line(20*mm, 15*mm, w-20*mm, 15*mm)
        canvas.setFont(fn, 7)
        canvas.setFillColor(FAINT)
        canvas.drawString(20*mm, 10*mm, self.company_name)
        canvas.drawCentredString(w/2, 10*mm, 'Carbonless')
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
    """Two-level contents. A 30-plus page inventory report is consulted rather
    than read start to finish, so the sub-sections a verifier looks up by name
    (exclusions, assumptions, significance, uncertainty) are listed too."""
    E.append(Paragraph(t('contents', lang), S['h1']))
    top = [
        ('', t('intro', lang), []),
        ('1', t('s1', lang), [
            ('1.1', t('s1_1', lang)), ('1.2', t('s1_2', lang)),
            ('1.3', t('s1_3', lang)), ('1.4', t('s1_4', lang)),
            ('1.5', t('s1_5', lang)),
        ]),
        ('2', t('s2', lang), [
            ('2.1', t('s2_1', lang)), ('2.2', t('s2_2', lang)),
        ]),
        ('3', t('s3', lang), [
            ('3.1', t('s3_1', lang)), ('3.2', t('s3_2', lang)),
            ('3.3', t('s3_3', lang)), ('3.4', t('s3_4', lang)),
            ('3.5', t('s3_5', lang)), ('3.6', t('s3_6', lang)),
        ]),
        ('4', t('s4', lang), [
            ('4.1', t('s4_1', lang)),
            ('4.1.1', t('s4_direct', lang)),
            ('4.1.2', t('s4_indirect', lang)),
            ('4.1.3', t('s4_sig', lang)),
            ('4.1.4', t('s4_unc', lang)),
            ('4.1.5', t('s4_tgt', lang)),
            ('4.1.6', t('s4_risk', lang)),
            ('4.1.7', t('s4_ver', lang)),
            ('4.1.8', t('s4_qms', lang)),
            ('4.2', t('s4_2', lang)),
            ('4.3', t('s4_trend', lang)),
        ]),
    ]
    for num, label, subs in top:
        text_ = label.title() if lang == 'en' else label
        E.append(Paragraph(f'{num}   {text_}' if num else text_, S['toc']))
        for sub_num, sub_label in subs:
            E.append(Paragraph(f'{sub_num}   {sub_label}', S['toc_sub']))
    E.append(PageBreak())


def _introduction(E, S, lang):
    """Narrative framing before the organisational disclosures start —
    why an organisation quantifies its GHG emissions at all. Present in
    every full corporate GHG inventory report of this kind; kept short and
    generic (not sector-specific) since the platform serves any sector."""
    E.append(Paragraph(t('intro', lang), S['h1']))
    if lang == 'tr':
        paras = [
            'Günümüzde şirketlerin başarısı yalnızca mal ve hizmet üretimi ile finansal '
            'performansla sınırlı değildir; şirketlerin çevresel ve sosyal sorumluluklarını '
            'yerine getirmesi ve iyi bir kurumsal vatandaş olarak hareket etmesi de '
            'beklenmektedir. Bu dönüşüm sürecinde sürdürülebilirlik, şirketler ve yatırımcılar '
            'için öncelikli bir konu hâline gelmiştir.',
            'Karbondioksit (CO₂), metan (CH₄), diazot monoksit (N₂O), hidroflorokarbonlar '
            '(HFC), perflorokarbonlar (PFC) ve kükürt heksaflorür (SF₆) gibi sera gazları, '
            'kurumsal faaliyetler sonucunda atmosfere salınır ve küresel ısınmaya yol açar. '
            'Sera gazı emisyonlarının küresel ısınma üzerindeki etkisi, karbondioksit '
            'eşdeğeri (CO₂e) cinsinden ifade edildiğinde karbon ayak izi olarak adlandırılır.',
            'Bu farkındalıkla birlikte, kurumsal düzeyde karbon ayak izinin ölçülmesine olan '
            'ilgi artmaktadır. Bu rapor, kuruluşun ISO 14064-1:2018 standardı kapsamındaki '
            'sera gazı performansını raporlamak amacıyla hazırlanmıştır.',
        ]
    else:
        paras = [
            'The success of an organisation is no longer measured by the production of goods '
            'and services and financial performance alone; organisations are also expected to '
            'meet their environmental and social responsibilities and act as good corporate '
            'citizens. In this shift, sustainability has become a priority for organisations '
            'and investors alike.',
            'Greenhouse gases such as carbon dioxide (CO₂), methane (CH₄), nitrous oxide '
            '(N₂O), hydrofluorocarbons (HFCs), perfluorocarbons (PFCs) and sulphur '
            'hexafluoride (SF₆) are released into the atmosphere as a result of organisational '
            'activity and contribute to global warming. The impact of these emissions on '
            'global warming, expressed in carbon dioxide equivalent (CO₂e), is referred to as '
            'the carbon footprint.',
            'With this awareness, interest in quantifying the corporate carbon footprint '
            'continues to grow. This report has been prepared to document the organisation’s '
            'greenhouse gas performance under ISO 14064-1:2018 for the stated reporting '
            'period.',
        ]
    for p in paras:
        E.append(Paragraph(p, S['body']))
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
        ('Annual turnover' if lang == 'en' else 'Yıllık ciro',
         getattr(company, 'annual_turnover_range', None) or t('not_declared', lang)),
        ('Overseas operations' if lang == 'en' else 'Yurt dışı faaliyetler',
         (('Yes' if lang == 'en' else 'Var') if getattr(company, 'has_overseas_operations', False)
          else ('No' if lang == 'en' else 'Yok')) if company else t('not_declared', lang)),
        ('Subsidiaries' if lang == 'en' else 'Bağlı ortaklıklar',
         (getattr(company, 'number_of_subsidiaries', 0) or 0) if company else t('not_declared', lang)),
        ('Certificates and management systems held'
         if lang == 'en' else 'Sahip olunan sertifikalar ve yönetim sistemleri',
         (', '.join(
             ([('ISO 14001 Environmental Management System' if lang == 'en'
                else 'ISO 14001 Çevre Yönetim Sistemi')] if getattr(company, 'has_iso_14001', False) else [])
             + ([('ISO 50001 Energy Management System' if lang == 'en'
                  else 'ISO 50001 Enerji Yönetim Sistemi')] if getattr(company, 'has_iso_50001', False) else [])
             + ([('Prior ISO 14064 work' if lang == 'en'
                  else 'Önceki ISO 14064 çalışması')] if getattr(company, 'has_iso_14064_work', False) else [])
         ) or t('not_declared', lang)) if company else t('not_declared', lang)),
        ('Target ISO 14064-1 verification' if lang == 'en' else 'Hedeflenen ISO 14064-1 doğrulaması',
         (('Yes' if lang == 'en' else 'Evet') if getattr(company, 'target_iso_14064_verification', False)
          else ('No' if lang == 'en' else 'Hayır')) if company else t('not_declared', lang)),
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
         report.get_boundary_approach_display() if getattr(report, 'boundary_approach', None)
         else t('not_declared', lang)),
        ('Emission factor database' if lang == 'en' else 'Emisyon faktörü veri tabanı',
         report.get_ef_database_display() if getattr(report, 'ef_database', None)
         else t('not_declared', lang)),
    ]
    E.append(_kv_table(S, basic, lang))
    E.append(Spacer(1, 6*mm))

    # The organisation-agnostic GHG accounting workflow — every inventory of
    # this kind runs through these steps regardless of sector, so this stands
    # in for the sector-specific "activities workflow diagram" a single-sector
    # report would draw at this point.
    flow_steps = (
        ['Toplama: Faaliyet verisi', 'Eşleştirme: Emisyon faktörü',
         'Hesaplama: kg CO₂e', 'Kategorilendirme: I-VI', 'İç kontrol ve KYS',
         'Doğrulama ve raporlama']
        if lang == 'tr' else
        ['Collect activity data', 'Match emission factor',
         'Calculate CO₂e', 'Categorise I-VI', 'Internal QMS review',
         'Verify and report'])
    E.append(_flow_diagram(flow_steps, S))
    E.append(_fig_caption(S, FIG, t('t_flow', lang), lang))
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
    E.append(_org_chart(roles, prepared, S))
    E.append(_fig_caption(S, FIG, t('t_orgchart', lang), lang))
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

    # 1.4.1 The ISO 14064 family — narrative context for why this report takes
    # the shape it does, and how it relates to the -2 (projects) and -3
    # (verification) parts of the same standard family.
    E.append(Paragraph('1.4.1   ' + t('s1_4_1', lang), S['h3']))
    if lang == 'tr':
        E.append(Paragraph(
            'ISO 14060 sera gazı standartları ailesi, sera gazı emisyon ve uzaklaştırmalarının '
            'ölçülmesi, izlenmesi, raporlanması ve doğrulanması veya geçerli kılınması için '
            'açıklık ve tutarlılık sağlar.', S['body']))
        E.append(Paragraph(
            '<b>ISO 14064-1:2018</b>, kuruluş düzeyinde sera gazı emisyon ve uzaklaştırma '
            'sınırlarının belirlenmesine, kuruluşun sera gazı emisyon ve azaltımlarının '
            'hesaplanmasına ve sera gazı yönetimini iyileştirmeye yönelik faaliyetlerin '
            'tanımlanmasına ilişkin gereklilikleri içerir. Ayrıca envanter kalite yönetimi, '
            'raporlama, iç denetim ve doğrulama faaliyetlerine ilişkin sorumluluklarla ilgili '
            'gereklilik ve rehberlik de sunar.', S['body']))
        E.append(Paragraph(
            '<b>ISO 14064-2:2019</b>, baz senaryoların belirlenmesi ile sera gazı azaltımına '
            'yönelik proje faaliyetlerinin izlenmesi, nicelenmesi ve raporlanmasına ilişkin '
            'ilke ve gereklilikleri ayrıntılandırır.', S['body']))
        E.append(Paragraph(
            '<b>ISO 14064-3:2019</b>, sera gazı envanterlerinin, projelerinin ve ürün karbon '
            'ayak izi beyanlarının doğrulanmasına ilişkin gereklilikleri açıklar; planlama, '
            'değerlendirme prosedürleri ile kurumsal, proje ve ürün beyanlarının '
            'değerlendirilmesini kapsar.', S['body']))
    else:
        E.append(Paragraph(
            'The ISO 14060 family of greenhouse gas standards provides clarity and '
            'consistency for measuring, monitoring, reporting and verifying or validating '
            'greenhouse gas emissions and removals.', S['body']))
        E.append(Paragraph(
            '<b>ISO 14064-1:2018</b> includes requirements for determining greenhouse gas '
            'emission and removal boundaries at the organisational level, calculating an '
            'organisation’s greenhouse gas emissions and removals, and identifying specific '
            'actions or activities aimed at improving GHG management. It also includes '
            'requirements and guidance related to inventory quality management, reporting, '
            'internal auditing and verification responsibilities. This report is prepared '
            'against this part of the standard.', S['body']))
        E.append(Paragraph(
            '<b>ISO 14064-2:2019</b> details the principles and requirements for determining '
            'baselines and for monitoring, quantifying and reporting project emissions. It '
            'focuses on greenhouse gas projects or project-based activities specifically '
            'designed to reduce greenhouse gas emissions.', S['body']))
        E.append(Paragraph(
            '<b>ISO 14064-3:2019</b> details the requirements for the verification of '
            'greenhouse gas inventories, greenhouse gas projects and greenhouse gas claims '
            'related to the carbon footprint of products, including planning, assessment '
            'procedures and the assessment of organisational, project and product '
            'statements.', S['body']))
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
        ('Anthropogenic biogenic GHG emission', 'Greenhouse gas emission resulting from '
         'human activities that originates from biogenic material.'),
        ('Non-anthropogenic biogenic GHG emission', 'Greenhouse gas emission from biogenic '
         'material caused by natural disasters or natural processes such as decomposition.'),
        ('Land use', 'Human use or management of land within the reporting boundary.'),
        ('Primary data', 'A quantified value of a process obtained from direct measurement '
         'or a calculation based on direct measurement.'),
        ('Secondary data', 'Data obtained from a source other than primary data, such as a '
         'published database or literature accepted by a competent authority.'),
        ('Biogenic carbon', 'Carbon originating from biomass.'),
        ('Biomass', 'Material of biological origin, living or dead, excluding material '
         'embedded in geological formations or fossilised.'),
        ('Direct land use change', 'A change in human use or management of land within the '
         'reporting boundary.'),
        ('Greenhouse gas (GHG)', 'Gaseous constituent of the atmosphere, natural or '
         'anthropogenic, that absorbs and emits infrared radiation.'),
        ('GHG source', 'Process that releases a GHG into the atmosphere.'),
        ('GHG sink', 'Process that removes a GHG from the atmosphere.'),
        ('GHG reservoir', 'A component of the Earth other than the atmosphere itself (e.g. '
         'oceans, forests, soil) with the capacity to accumulate, store and release GHGs.'),
        ('GHG activity data', 'A quantitative measure of an activity that results in a GHG '
         'emission or removal, such as fuel, energy or electricity consumed.'),
        ('GHG emission or removal factor', 'A factor relating GHG activity data to a GHG '
         'emission or removal.'),
        ('GHG emission', 'The total mass of a GHG released into the atmosphere over a '
         'specified period of time.'),
        ('GHG removal', 'The total mass of a GHG removed from the atmosphere over a '
         'specified period of time.'),
        ('GHG inventory', 'A quantified list of an organisation’s GHG emissions and '
         'removals, reported by source or sink.'),
        ('GHG project', 'An activity, or set of activities, that changes the conditions '
         'identified in a baseline scenario to reduce GHG emissions or increase removals.'),
        ('GHG programme', 'A voluntary or mandatory international, national or regional '
         'system that registers, tracks or manages GHG emissions, removals or reductions '
         'outside the organisation.'),
        ('GHG statement', 'A factual and objective presentation of GHG-related information '
         'that is the subject of a verification or validation engagement.'),
        ('GHG reduction initiative', 'An activity or initiative that reduces GHG emissions '
         'or increases removals, that is not organised as a GHG project.'),
        ('Direct GHG emission', 'Emission from GHG sources owned or controlled by the '
         'organisation (Category I).'),
        ('Indirect GHG emission', 'Emission that is a consequence of the organisation’s '
         'activities but arises from sources owned or controlled by another organisation '
         '(Categories II-VI).'),
        ('Global warming potential (GWP)', 'Factor describing the radiative forcing impact '
         'of one mass unit of a GHG relative to CO₂ over a given time horizon.'),
        ('CO₂ equivalent (CO₂e)', 'Unit for comparing the radiative forcing of a GHG to '
         'that of carbon dioxide.'),
        ('Base year', 'Historical period specified for the purpose of comparing GHG '
         'emissions or removals over time.'),
        ('Organisation', 'A person or group of people with its own functions, '
         'responsibilities, authorities and relationships to achieve its objectives.'),
        ('Organisational boundary', 'The facilities and operations consolidated into the '
         'inventory under the chosen consolidation approach.'),
        ('Reporting boundary', 'The direct and significant indirect GHG emissions and '
         'removals determined for the organisational boundary.'),
        ('Facility', 'A single installation, or a group of installations, that can be '
         'defined within a single geographical boundary, organisational unit or process.'),
        ('Site-specific data', 'Primary data obtained from within the organisational '
         'boundary, e.g. fuel volume consumed, kWh of electricity purchased, km travelled.'),
        ('Monitoring', 'The continuous or periodic assessment of GHG emissions, removals or '
         'other GHG-related data.'),
        ('Uncertainty', 'A parameter characterising the dispersion of the values that could '
         'reasonably be attributed to a quantified result.'),
        ('Confidence level', 'The level of assurance associated with a GHG statement.'),
        ('Target user', 'An individual or organisation identified as relying on GHG-related '
         'information for decision-making.'),
        ('Carbon footprint', 'The GHG emissions associated with the production, transport, '
         'use or disposal of a product, expressed as CO₂e.'),
        ('Verification', 'A systematic, independent and documented process for evaluating a '
         'GHG statement against agreed verification criteria.'),
        ('Verifier', 'A competent and independent person, or group of people, who conducts '
         'and reports on a verification.'),
        ('Client', 'The organisation or person requesting a verification or validation.'),
        ('Responsible party', 'The person or persons accountable for the GHG statement and '
         'able to authorise another party to act on their behalf.'),
        ('Sustainability officer', 'The person or persons responsible for submitting the GHG '
         'declaration and providing GHG information.'),
    ] if lang == 'en' else [
        ('Antropojenik biyojenik SG emisyonu', 'İnsan faaliyetlerinden kaynaklanan ve '
         'biyojenik materyalden köken alan sera gazı emisyonu.'),
        ('Antropojenik olmayan biyojenik SG emisyonu', 'Doğal afetler veya ayrışma gibi '
         'doğal süreçlerin neden olduğu, biyojenik materyalden kaynaklanan sera gazı '
         'emisyonu.'),
        ('Arazi kullanımı', 'Raporlama sınırı içinde arazinin insan tarafından kullanımı '
         'veya yönetimi.'),
        ('Birincil veri', 'Doğrudan ölçümden veya doğrudan ölçüme dayalı bir hesaplamadan '
         'elde edilen nicel değer.'),
        ('İkincil veri', 'Birincil veri dışındaki bir kaynaktan, örneğin yetkili bir '
         'makamca kabul edilen yayımlanmış bir veri tabanından elde edilen veri.'),
        ('Biyojenik karbon', 'Biyokütleden köken alan karbon.'),
        ('Biyokütle', 'Jeolojik oluşumlara gömülü veya fosilleşmiş materyal hariç, canlı '
         'veya cansız biyolojik kökenli materyal.'),
        ('Doğrudan arazi kullanım değişikliği', 'Raporlama sınırı içinde arazinin insan '
         'tarafından kullanımında veya yönetiminde meydana gelen değişiklik.'),
        ('Sera gazı (SG)', 'Kızılötesi radyasyonu soğuran ve yayan, doğal veya antropojenik '
         'atmosfer bileşeni.'),
        ('SG kaynağı', 'Atmosfere sera gazı salan süreç.'),
        ('SG yutağı', 'Atmosferden sera gazı uzaklaştıran süreç.'),
        ('SG rezervuarı', 'Atmosfer dışında, sera gazlarını biriktirme, depolama ve salma '
         'kapasitesine sahip Dünya bileşeni (örn. okyanuslar, ormanlar, toprak).'),
        ('SG faaliyet verisi', 'Bir sera gazı emisyonu veya uzaklaştırmasıyla sonuçlanan '
         'faaliyetin nicel ölçüsü; örn. tüketilen yakıt, enerji veya elektrik miktarı.'),
        ('SG emisyon veya uzaklaştırma faktörü', 'SG faaliyet verisini bir SG emisyonu veya '
         'uzaklaştırmasıyla ilişkilendiren faktör.'),
        ('SG emisyonu', 'Belirli bir süre içinde atmosfere salınan sera gazının toplam '
         'kütlesi.'),
        ('SG uzaklaştırması', 'Belirli bir süre içinde atmosferden uzaklaştırılan sera '
         'gazının toplam kütlesi.'),
        ('SG envanteri', 'Bir kuruluşun kaynak veya yutağa göre raporlanan, nicelenmiş sera '
         'gazı emisyon ve uzaklaştırma listesi.'),
        ('SG projesi', 'Bir baz senaryoda tanımlanan koşulları değiştirerek sera gazı '
         'emisyonlarını azaltan veya uzaklaştırmalarını artıran faaliyet veya faaliyetler '
         'bütünü.'),
        ('SG programı', 'Kuruluş dışında sera gazı emisyonlarını, uzaklaştırmalarını veya '
         'azaltımlarını kaydeden, izleyen veya yöneten gönüllü ya da zorunlu sistem.'),
        ('SG beyanı', 'Doğrulama veya geçerli kılma faaliyetine konu olan, gerçeğe dayalı ve '
         'nesnel sera gazı bilgisi sunumu.'),
        ('SG azaltım girişimi', 'Bir SG projesi olarak organize edilmeyen, emisyonları '
         'azaltan veya uzaklaştırmaları artıran faaliyet veya girişim.'),
        ('Doğrudan SG emisyonu', 'Kuruluşun sahip olduğu veya kontrol ettiği kaynaklardan '
         'gelen emisyon (Kategori I).'),
        ('Dolaylı SG emisyonu', 'Kuruluşun faaliyetlerinin sonucu olan ancak başka bir '
         'kuruluşun kontrolündeki kaynaklardan doğan emisyon (Kategori II-VI).'),
        ('Küresel ısınma potansiyeli (GWP)', 'Bir birim kütle sera gazının, belirli bir '
         'zaman ufkunda CO₂’ye göre ışınımsal zorlama etkisini tanımlayan faktör.'),
        ('CO₂ eşdeğeri (CO₂e)', 'Sera gazlarının ışınımsal zorlamasını karbondioksitle '
         'karşılaştırmak için kullanılan birim.'),
        ('Baz yıl', 'Emisyonların veya uzaklaştırmaların zaman içinde karşılaştırılması '
         'için belirlenen geçmiş dönem.'),
        ('Kuruluş', 'Kendi hedeflerine ulaşmak için işlevleri, sorumlulukları, yetkileri ve '
         'ilişkileri olan kişi veya kişi grubu.'),
        ('Organizasyon sınırı', 'Seçilen konsolidasyon yaklaşımıyla envantere dâhil edilen '
         'tesis ve faaliyetler.'),
        ('Raporlama sınırı', 'Organizasyon sınırı için belirlenen doğrudan ve önemli '
         'dolaylı sera gazı emisyonları ve uzaklaştırmaları.'),
        ('Tesis', 'Tek bir coğrafi sınır, organizasyonel birim veya süreç içinde '
         'tanımlanabilen tek bir tesis veya tesis grubu.'),
        ('Tesise özgü veri', 'Organizasyon sınırı içinden elde edilen birincil veri; örn. '
         'tüketilen yakıt hacmi, satın alınan elektrik (kWh), kat edilen mesafe (km).'),
        ('İzleme', 'Sera gazı emisyonlarının, uzaklaştırmalarının veya diğer sera gazı '
         'ile ilgili verilerin sürekli veya periyodik olarak değerlendirilmesi.'),
        ('Belirsizlik', 'Nicelenen sonuca makul olarak atfedilebilecek değerlerin '
         'dağılımını karakterize eden parametre.'),
        ('Güven düzeyi', 'Bir sera gazı beyanıyla ilişkili güvence düzeyi.'),
        ('Hedef kullanıcı', 'Karar verme sürecinde sera gazı bilgisine dayandığı belirlenen '
         'kişi veya kuruluş.'),
        ('Karbon ayak izi', 'Bir ürünün üretimi, taşınması, kullanımı veya bertarafıyla '
         'ilişkili, CO₂e cinsinden ifade edilen sera gazı emisyonları.'),
        ('Doğrulama', 'Bir sera gazı beyanının üzerinde anlaşılan doğrulama kriterlerine '
         'göre değerlendirildiği sistematik, bağımsız ve belgelenmiş süreç.'),
        ('Doğrulayıcı', 'Doğrulamayı yürüten ve raporlayan yetkin ve bağımsız kişi veya '
         'kişi grubu.'),
        ('Müşteri', 'Doğrulama veya geçerli kılma talep eden kuruluş veya kişi.'),
        ('Sorumlu taraf', 'Sera gazı beyanından sorumlu olan ve başka bir tarafı kendi '
         'adına hareket etmeye yetkilendirebilen kişi veya kişiler.'),
        ('Sürdürülebilirlik sorumlusu', 'Sera gazı beyanını sunmaktan ve sera gazı '
         'bilgisini sağlamaktan sorumlu kişi veya kişiler.'),
    ])
    for term, meaning in defs:
        E.append(Paragraph(f'<b>{term}.</b> {meaning}', S['body']))
    E.append(Spacer(1, 4*mm))

    E.append(Paragraph('2.2   ' + t('s2_2', lang), S['h2']))
    abbrs = [
        ('CH₄', 'Methane' if lang == 'en' else 'Metan'),
        ('CO₂', 'Carbon dioxide' if lang == 'en' else 'Karbondioksit'),
        ('CO₂e', 'Carbon dioxide equivalent' if lang == 'en' else 'Karbondioksit eşdeğeri'),
        ('EF', 'Emission factor' if lang == 'en' else 'Emisyon faktörü'),
        ('GHG / SG', 'Greenhouse gas' if lang == 'en' else 'Sera gazı'),
        ('GWP', 'Global warming potential' if lang == 'en' else 'Küresel ısınma potansiyeli'),
        ('HFC', 'Hydrofluorocarbon' if lang == 'en' else 'Hidroflorokarbon'),
        ('IPCC', 'Intergovernmental Panel on Climate Change'),
        ('IEA', 'International Energy Agency'),
        ('N₂O', 'Nitrous oxide' if lang == 'en' else 'Diazot monoksit'),
        ('NCV', 'Net calorific value' if lang == 'en' else 'Net kalorifik değer'),
        ('PFC', 'Perfluorocarbon' if lang == 'en' else 'Perflorokarbon'),
        ('SF₆', 'Sulphur hexafluoride' if lang == 'en' else 'Kükürt heksaflorür'),
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
        E.append(Paragraph(
            'The locations that make up the facility boundary are listed in the table '
            'below. All activities at these locations are included in the calculation.'
            if lang == 'en' else
            'Tesis sınırını oluşturan lokasyonlar aşağıdaki tabloda listelenmiştir. Bu '
            'lokasyonlardaki tüm faaliyetler hesaplamaya dâhil edilmiştir.', S['body']))
        data = [[Paragraph(f'<b>{t("c_no", lang)}</b>', S['body_sm']),
                 Paragraph(f'<b>{t("c_facility", lang)}</b>', S['body_sm']),
                 Paragraph(f'<b>{t("c_type", lang)}</b>', S['body_sm']),
                 Paragraph('<b>' + ('Address' if lang == 'en' else 'Adres') + '</b>',
                           S['body_sm'])]]
        for i, f in enumerate(facs, 1):
            # City/country stand in when no street address was entered — a
            # location's line should say where it is, not read as blank.
            where = ', '.join(x for x in (getattr(f, 'address', '') or '',
                                          getattr(f, 'city', '') or '',
                                          getattr(f, 'country', '') or '') if x)
            data.append([
                Paragraph(str(i), S['body_sm']),
                Paragraph(getattr(f, 'name', '—'), S['body_sm']),
                Paragraph(str(getattr(f, 'facility_type', '') or '—'), S['body_sm']),
                Paragraph(_ellipsize(where, 70) if where else t('not_declared', lang),
                          S['body_sm']),
            ])
        tbl = Table(data, colWidths=[13*mm, 53*mm, 36*mm, 68*mm], hAlign='LEFT',
                    repeatRows=1)
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

    # Coverage of activity data across facilities — only meaningful once there
    # is more than one facility to compare; for a single consolidated
    # inventory every declared activity trivially has 100 % coverage. Uses
    # D['facility_activity'], already gathered for the 4.3 location-level
    # breakdowns, so this costs no extra query.
    if len(facs) > 1:
        fac_act = D.get('facility_activity') or {}
        total_facs = len(facs)
        cov_items = sorted(
            ((cat_label(k, lang), len(v)) for k, v in fac_act.items() if v),
            key=lambda kv: -kv[1])
        if cov_items:
            E.append(Paragraph(
                'Activity data could not be declared for every activity type at every '
                'facility. The proportion of facilities reporting data for each activity '
                'type is summarised below.'
                if lang == 'en' else
                'Faaliyet verisi, her tesiste her faaliyet türü için beyan edilememiştir. '
                'Her faaliyet türü için veri bildiren tesislerin oranı aşağıda '
                'özetlenmiştir.', S['body']))
            data = [[
                Paragraph(f'<b>{"Activity type" if lang == "en" else "Faaliyet türü"}</b>',
                          S['body_sm']),
                Paragraph('<b>' + ('Facilities declaring data' if lang == 'en'
                                    else 'Veri bildiren tesisler') + '</b>', S['body_sm']),
            ]]
            for label, n in cov_items:
                cov_pct = n / total_facs * 100
                data.append([
                    Paragraph(label, S['body_sm']),
                    Paragraph(f'{n}/{total_facs}  '
                              f'({_localize_num(f"{cov_pct:.0f}", lang == "tr")} %)',
                              S['body_sm']),
                ])
            tbl = Table(data, colWidths=[110*mm, 60*mm], hAlign='LEFT', repeatRows=1)
            st = _tbl_style(fn, fnb)
            st.add('ALIGN', (0, 0), (-1, -1), 'LEFT')
            tbl.setStyle(st)
            E.append(_caption(S, TBL, t('t_cov', lang), lang))
            E.append(tbl)
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
    E.append(Spacer(1, 4*mm))

    # 3.2.1 Calculation approach — which consolidation basis (control/equity)
    # was declared for the organisational boundary.
    E.append(Paragraph('3.2.1   ' + ('Calculation Approach' if lang == 'en'
                                      else 'Hesaplama Yaklaşımı'), S['h3']))
    boundary_code = getattr(report, 'boundary_approach', '') or ''
    boundary_label = report.get_boundary_approach_display() if boundary_code else None
    if boundary_code == 'equity_share':
        approach_sentence = (
            'The organisation holds an equity share in one or more of its operations, so '
            'the equity share approach has been selected: emissions are included in '
            'proportion to the organisation’s share of equity in each operation.'
            if lang == 'en' else
            'Kuruluş, faaliyetlerinden bir veya birden fazlasında öz sermaye payına sahip '
            'olduğundan öz sermaye payı yaklaşımı seçilmiştir: emisyonlar, kuruluşun her '
            'faaliyetteki öz sermaye payı oranında dâhil edilmiştir.')
    elif boundary_label:
        approach_sentence = (
            f'The “{boundary_label.lower()}” approach has been selected for consolidating '
            'greenhouse gas emissions and removals: all emissions from activities within the '
            'organisation’s boundary under that basis have been included in the calculation.'
            if lang == 'en' else
            f'“{boundary_label}” yaklaşımı, sera gazı emisyon ve uzaklaştırmalarının '
            'konsolide edilmesi için seçilmiştir: bu esasa göre kuruluşun sınırları içindeki '
            'faaliyetlerden kaynaklanan tüm emisyonlar hesaplamaya dâhil edilmiştir.')
    else:
        approach_sentence = (
            'The consolidation approach (operational control, financial control or equity '
            'share) has not been declared for this reporting period.'
            if lang == 'en' else
            'Bu raporlama dönemi için konsolidasyon yaklaşımı (operasyonel kontrol, mali '
            'kontrol veya öz sermaye payı) beyan edilmemiştir.')
    E.append(Paragraph(approach_sentence, S['body']))
    E.append(Spacer(1, 4*mm))

    # 3.2.2 Calculation method — the platform always applies the standard
    # (activity-data × factor) method shown above; it does not implement
    # mass-balance or continuous-measurement methods, so this states that
    # fact rather than implying a choice was made per source.
    E.append(Paragraph('3.2.2   ' + ('Calculation Method' if lang == 'en'
                                      else 'Hesaplama Yöntemi'), S['h3']))
    E.append(Paragraph(
        'The “standard method”, based on multiplying activity data by an emission factor, '
        'has been used for every source in this inventory. Mass-balance and continuous '
        'measurement-based methods have not been applied.'
        if lang == 'en' else
        'Bu envanterdeki her kaynak için, faaliyet verisinin bir emisyon faktörüyle '
        'çarpılmasına dayanan “standart yöntem” kullanılmıştır. Kütle dengesi ve sürekli '
        'ölçüme dayalı yöntemler uygulanmamıştır.', S['body']))
    E.append(Spacer(1, 5*mm))

    # 3.3 Reporting boundaries
    E.append(Paragraph('3.3   ' + t('s3_3', lang), S['h2']))
    for cat in (CAT_I, CAT_II, CAT_III, CAT_IV, CAT_V, CAT_VI):
        name = ISO_CATEGORY_NAMES[cat][lang]
        val = D['by_category'][cat] / 1000.0
        E.append(Paragraph(
            f'<b>{t("c_cat", lang)} {ROMAN[cat]}</b> — {name}: '
            f'{_fmt(val, lang == "tr")} t CO₂e', S['body']))
    E.append(Spacer(1, 3*mm))

    # 3.3.1 / 3.3.2 — the actual GHG sources found in category I (direct) vs
    # II-VI (indirect), listed by name rather than restated as a definition,
    # since D['sources'] already knows exactly what this organisation
    # declared.
    direct_names = sorted({cat_label(r['category'], lang) for r in D['sources']
                           if r['iso_cat'] == CAT_I})
    indirect_names = sorted({cat_label(r['category'], lang) for r in D['sources']
                             if r['iso_cat'] != CAT_I})
    E.append(Paragraph('3.3.1   ' + ('Direct Greenhouse Gas Emissions' if lang == 'en'
                                      else 'Doğrudan Sera Gazı Emisyonları'), S['h3']))
    if direct_names:
        E.extend(_bullets(S, direct_names))
    else:
        E.append(Paragraph(t('none_recorded', lang), S['no_data']))
    E.append(Spacer(1, 3*mm))
    E.append(Paragraph('3.3.2   ' + ('Indirect Greenhouse Gas Emissions' if lang == 'en'
                                      else 'Dolaylı Sera Gazı Emisyonları'), S['h3']))
    if indirect_names:
        E.extend(_bullets(S, indirect_names))
    else:
        E.append(Paragraph(t('none_recorded', lang), S['no_data']))
    E.append(Spacer(1, 5*mm))

    # 3.4 Exclusions — 6A-1 (flagged?) / 6A-2 (reason code) / 6A-3 (business
    # justification, free text) / 6A-4 (estimated emission band) / 6A-5
    # (future inclusion plan, optional free text). Rendered as prose rather
    # than the raw option codes those steps store.
    E.append(Paragraph('3.4   ' + t('s3_4', lang), S['h2']))
    flagged = _raw_answer(A, '6A-1')
    if flagged == 'yes':
        reason_code = _raw_answer(A, '6A-2')
        reason = (EXCLUSION_REASON_LABELS.get(reason_code, {}).get(lang)
                  if reason_code else None)
        justification = _answer_text(A, '6A-3', lang, default=None)
        band_code = _raw_answer(A, '6A-4')
        band = EXCLUSION_BAND_LABELS.get(band_code, {}).get(lang) if band_code else None
        future_plan = _answer_text(A, '6A-5', lang, default=None)

        if lang == 'en':
            sentence = 'One or more sources have been excluded from the declared boundary'
            if reason:
                sentence += f', because {reason}'
            sentence += '.'
        else:
            sentence = 'Beyan edilen sınırdan bir veya daha fazla kaynak hariç tutulmuştur'
            if reason:
                sentence += f' ({reason} gerekçesiyle)'
            sentence += '.'
        E.append(Paragraph(sentence, S['body']))
        if justification and justification != t('not_declared', lang):
            E.append(Paragraph(
                (f'<b>{"Justification" if lang == "en" else "Gerekçe"}:</b> {justification}'),
                S['body']))
        if band:
            E.append(Paragraph(
                (f'<b>{"Estimated impact" if lang == "en" else "Tahmini etki"}:</b> {band}'),
                S['body']))
        if future_plan and future_plan != t('not_declared', lang):
            E.append(Paragraph(
                (f'<b>{"Future inclusion plan" if lang == "en" else "Gelecekte dahil etme planı"}'
                 f':</b> {future_plan}'), S['body']))
    else:
        E.append(Paragraph(
            'No sources have been excluded from the declared boundary other than those '
            'stated as not applicable to the organisation’s operations.'
            if lang == 'en' else
            'Kuruluşun faaliyetleri için geçerli olmadığı belirtilenler dışında, beyan '
            'edilen sınırdan hariç tutulan kaynak bulunmamaktadır.', S['body']))
    E.append(Spacer(1, 4*mm))

    # 3.5 Assumptions — 6C-1 (exception type code) / 6C-2 (compound: which
    # source, alternative approach, materiality %) / 6C-3 (improvement
    # commitment, optional free text).
    E.append(Paragraph('3.5   ' + t('s3_5', lang), S['h2']))
    exc_type = _raw_answer(A, '6C-1')
    if exc_type and exc_type != 'none':
        type_label = EXCEPTION_TYPE_LABELS.get(exc_type, {}).get(lang)
        if type_label:
            sentence = (f'An exception to the standard methodology applies: {type_label}.'
                        if lang == 'en' else
                        f'Standart metodolojiye ilişkin bir istisna geçerlidir: {type_label}.')
            E.append(Paragraph(sentence, S['body']))
        detail = _raw_answer(A, '6C-2')
        if isinstance(detail, dict):
            desc = detail.get('exception_description')
            pct = detail.get('materiality_pct')
            just = detail.get('justification')
            if desc:
                E.append(Paragraph(
                    f'<b>{"Description" if lang == "en" else "Açıklama"}:</b> {desc}', S['body']))
            if just:
                E.append(Paragraph(
                    f'<b>{"Justification" if lang == "en" else "Gerekçe"}:</b> {just}', S['body']))
            if pct not in (None, ''):
                E.append(Paragraph(
                    (f'<b>{"Estimated impact on total emissions" if lang == "en" else "Toplam emisyonlara tahmini etki"}'
                     f':</b> {pct} %'), S['body']))
        commitment = _answer_text(A, '6C-3', lang, default=None)
        if commitment and commitment != t('not_declared', lang):
            E.append(Paragraph(
                (f'<b>{"Improvement commitment" if lang == "en" else "İyileştirme taahhüdü"}'
                 f':</b> {commitment}'), S['body']))
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
            data.append([Paragraph(_ellipsize(ref, 150), S['body_sm']),
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


def _gas_cells(row, S, tr):
    """One inventory row rendered across the six GHG columns.

    A gas with no contribution prints blank rather than 0.00, so the eye can
    pick a row's gases out of eleven columns at a glance — the same way the
    reference inventory table reads.
    """
    return [Paragraph(_fmt(row['gas_kg'][g] / 1000.0, tr) if row['gas_kg'][g] else '',
                      S['num'])
            for g in GAS_COLS]


def _gas_totals(rows):
    """Per-gas column totals (tonnes) for a set of inventory rows."""
    totals = {g: 0.0 for g in GAS_COLS}
    for r in rows:
        for g in GAS_COLS:
            totals[g] += r['gas_kg'][g] / 1000.0
    return totals


def _gas_footnote(E, S, lang, rows):
    """Say how each gas column was arrived at, for the rows actually shown.

    ISO 14064-1 asks for emissions gas by gas, and a reader is entitled to know
    which figures are a publisher's own split, which are an apportionment on a
    published ratio, and which are a single combined CO₂e figure that could not
    be divided at all. The sentence is assembled from what this table contains
    rather than asserted in full every time.
    """
    bases = {r.get('split_basis') for r in rows}
    parts = []
    if 'single_gas' in bases:
        parts.append(
            'Fugitive releases are single-gas sources: the whole quantity is that gas, '
            'weighted by its own 100-year global warming potential.'
            if lang == 'en' else
            'Kaçak salımlar tek gazlı kaynaklardır: miktarın tamamı, kendi 100 yıllık '
            'küresel ısınma potansiyeli ile ağırlıklandırılmış olarak o gaza aittir.')
    if 'apportioned' in bases:
        parts.append(
            'For fuel combustion the CO₂ / CH₄ / N₂O division follows the IPCC default '
            'emission factors for that fuel and combustion type, weighted by AR6 100-year '
            'global warming potentials and applied to the factor’s own published CO₂e '
            'total, which is unchanged. The table each ratio comes from is recorded '
            'against the factor.'
            if lang == 'en' else
            'Yakıt yanması için CO₂ / CH₄ / N₂O ayrımı, ilgili yakıt ve yanma türüne ait '
            'IPCC varsayılan emisyon faktörlerine dayanır; bu oranlar AR6 100 yıllık '
            'küresel ısınma potansiyelleri ile ağırlıklandırılarak faktörün yayımlanmış '
            'CO₂e toplamına uygulanmıştır ve bu toplam değişmemiştir. Her oranın alındığı '
            'tablo faktör kaydında saklanmaktadır.')
    if 'published' in bases:
        parts.append(
            'Where the factor’s publisher issues the split itself, that split is used as '
            'published.'
            if lang == 'en' else
            'Faktörü yayımlayan kuruluşun ayrımı doğrudan verdiği durumlarda, bu ayrım '
            'yayımlandığı şekliyle kullanılmıştır.')
    if None in bases:
        parts.append(
            'Some sources — grid electricity, purchased goods and services, waste, water '
            'and distance-based composite factors — are published as a single CO₂e figure '
            'with no gas split available. These are reported in the CO₂ column and their '
            'gases are not separately quantified.'
            if lang == 'en' else
            'Bazı kaynaklar — şebeke elektriği, satın alınan mal ve hizmetler, atık, su ve '
            'mesafe tabanlı bileşik faktörler — gaz ayrımı bulunmayan tek bir CO₂e değeri '
            'olarak yayımlanmıştır. Bunlar CO₂ sütununda raporlanır ve gazları ayrıca '
            'nicelenmemiştir.')
    if parts:
        E.append(Paragraph(' '.join(parts), S['small']))


def _inventory_table(E, S, D, lang, TBL):
    """Table 5 — the inventory itself, one row per GHG source, grouped by
    category, laid out across the six GHG columns the standard reports."""
    fn, fnb = S['fn'], S['fnb']
    tr = lang == 'tr'
    hdr = [
        Paragraph(f'<b>{t("c_scope", lang)}</b>', S['small']),
        Paragraph(f'<b>{t("c_cat", lang)}</b>', S['small']),
        Paragraph(f'<b>{t("c_source", lang)}</b>', S['small']),
    ] + [Paragraph(g, S['num_hdr']) for g in GAS_COLS] + [
        Paragraph(t('c_ghg_t', lang), S['num_hdr']),
        Paragraph(t('c_cat_total', lang), S['num_hdr']),
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
            ] + _gas_cells(r, S, tr) + [
                Paragraph(_fmt(r['kg'] / 1000.0, tr), S['num']),
                Paragraph(_fmt(cat_total_t, tr) if j == 0 else '', S['num']),
            ])
            row_i += 1
        if len(rows) > 1:
            span_cmds.append(('SPAN', (10, first_row_of_cat), (10, row_i - 1)))
            span_cmds.append(('SPAN', (0, first_row_of_cat), (0, row_i - 1)))

    totals = _gas_totals(D['sources'])
    data.append([
        Paragraph(f'<b>{t("total", lang)}</b>', S['small']),
        Paragraph('', S['small']), Paragraph('', S['small']),
    ] + [Paragraph(f'<b>{_fmt(totals[g], tr)}</b>' if totals[g] else '', S['num'])
         for g in GAS_COLS] + [
        Paragraph(f'<b>{_fmt(D["total_t"], tr)}</b>', S['num']),
        Paragraph(f'<b>{_fmt(D["total_t"], tr)}</b>', S['num']),
    ])

    tbl = Table(data,
                colWidths=[16*mm, 10*mm, 32*mm] + [13*mm]*6 + [17*mm, 17*mm],
                hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (0, 0), (2, -1), 'LEFT')
    st.add('VALIGN', (0, 0), (-1, -1), 'TOP')
    # Eleven columns across an A4 text block: the default 8pt side padding
    # would wrap "Cat." and the eight-character figures onto second lines.
    st.add('LEFTPADDING', (0, 0), (-1, -1), 3)
    st.add('RIGHTPADDING', (0, 0), (-1, -1), 3)
    for cmd in span_cmds:
        st.add(*cmd)
    st.add('BACKGROUND', (0, -1), (-1, -1), CREAM)
    st.add('LINEABOVE', (0, -1), (-1, -1), 1.2, OLIVE)
    tbl.setStyle(st)
    E.append(_caption(S, TBL, t('t_inv', lang), lang))
    E.append(tbl)
    E.append(Spacer(1, 2*mm))
    _gas_footnote(E, S, lang, D['sources'])


def _category_data_table(E, S, D, cat, lang, TBL):
    """One category's emissions laid out per gas, closing on a CATEGORY N
    TOTAL row — the per-category counterpart of the inventory table."""
    fn, fnb = S['fn'], S['fnb']
    tr = lang == 'tr'
    rows = [r for r in D['sources'] if r['iso_cat'] == cat]
    if not rows:
        return
    data = [[Paragraph('<b>' + ('Emission source' if lang == 'en' else 'Emisyon kaynağı')
                       + '</b>', S['small'])]
            + [Paragraph(g, S['num_hdr']) for g in GAS_COLS]
            + [Paragraph(t('c_ghg_t', lang), S['num_hdr'])]]
    for r in rows:
        data.append(
            [Paragraph(f'{cat_label(r["category"], lang)} — {r["name"]}', S['small'])]
            + _gas_cells(r, S, tr)
            + [Paragraph(_fmt(r['kg'] / 1000.0, tr), S['num'])])
    cat_total_t = D['by_category'][cat] / 1000.0
    data.append([Paragraph('<b>' + t('c_cat_n_total', lang).format(cat=ROMAN[cat])
                           + '</b>', S['small'])]
                + [Paragraph('', S['num'])] * 6
                + [Paragraph(f'<b>{_fmt(cat_total_t, tr)}</b>', S['num'])])
    tbl = Table(data, colWidths=[74*mm] + [13*mm]*6 + [18*mm],
                hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
    st.add('VALIGN', (0, 0), (-1, -1), 'TOP')
    st.add('LEFTPADDING', (1, 0), (-1, -1), 2)
    st.add('RIGHTPADDING', (1, 0), (-1, -1), 2)
    st.add('BACKGROUND', (0, -1), (-1, -1), CREAM)
    st.add('LINEABOVE', (0, -1), (-1, -1), 1.2, OLIVE)
    tbl.setStyle(st)
    # "Direct"/"Indirect" only — the caption template already carries the rest
    # of the phrase, so taking the whole `direct`/`indirect` string here would
    # repeat "greenhouse gas emissions".
    adjective = (t('direct', lang) if cat == CAT_I else t('indirect', lang)).split()[0]
    cap = f'{adjective} ' + t('t_cat_data', lang).format(cat=ROMAN[cat])
    E.append(_caption(S, TBL, cap, lang))
    E.append(tbl)
    E.append(Spacer(1, 2*mm))
    _gas_footnote(E, S, lang, rows)


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

    # ═══════════════════════════════════════════════════════════════════════
    # 4.1.1 — DIRECT EMISSIONS
    # Split the way the standard's own report structure splits it: first how
    # the figures are arrived at (combustion, then fugitive releases), then
    # what the figures actually are. The two "calculation" sub-sections carry
    # the published constants a verifier retraces the arithmetic against.
    # ═══════════════════════════════════════════════════════════════════════
    # Per-category renderers, shared by 4.1.1.3 and by every 4.1.2.x pair.
    # Kept as closures because both need `pct`, TBL/FIG and the same styles;
    # lifting them to module level would mean threading six arguments through.
    def _cat_factors(cat):
        """The activity data and emission factors behind one category."""
        rows = [r for r in D['sources'] if r['iso_cat'] == cat]
        if not rows:
            E.append(Paragraph(t('none_recorded', lang), S['no_data']))
            E.append(Spacer(1, 3*mm))
            return
        E.append(Paragraph(
            'The activity data included in this category, the unit each quantity is '
            'recorded in, the emission factor applied and its published source are set '
            'out below.'
            if lang == 'en' else
            'Bu kategoriye dâhil edilen faaliyet verileri, her miktarın kaydedildiği '
            'birim, uygulanan emisyon faktörü ve faktörün yayımlandığı kaynak aşağıda '
            'verilmiştir.', S['body']))
        E.append(Spacer(1, 2*mm))
        data = [[Paragraph(f'<b>{t("c_source", lang)}</b>', S['small']),
                 Paragraph(t('c_activity', lang), S['num_hdr']),
                 Paragraph(f'<b>{t("c_unit", lang)}</b>', S['small']),
                 Paragraph(t('c_factor', lang), S['num_hdr']),
                 Paragraph(t('c_ghg_t', lang), S['num_hdr']),
                 Paragraph(f'<b>{t("c_ref", lang)}</b>', S['small'])]]
        for r in rows:
            data.append([
                Paragraph(f'{cat_label(r["category"], lang)} — {r["name"]}', S['small']),
                Paragraph(_fmt(r['quantity'], tr), S['num']),
                Paragraph(str(r['unit'] or '—'), S['small']),
                Paragraph(_localize_num(f'{r["factor"]:,.4f}', tr), S['num']),
                Paragraph(_fmt(r['kg'] / 1000.0, tr), S['num']),
                Paragraph(_ellipsize(r['reference'], 90), S['small']),
            ])
        tbl = Table(data, colWidths=[44*mm, 18*mm, 18*mm, 18*mm, 18*mm, 54*mm],
                    hAlign='LEFT', repeatRows=1)
        st = _tbl_style(fn, fnb)
        st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
        st.add('ALIGN', (5, 0), (5, -1), 'LEFT')
        st.add('VALIGN', (0, 0), (-1, -1), 'TOP')
        st.add('LEFTPADDING', (1, 0), (4, -1), 3)
        st.add('RIGHTPADDING', (1, 0), (4, -1), 3)
        tbl.setStyle(st)
        E.append(_caption(S, TBL, f'{t("t_ef", lang)} — {ROMAN[cat]}', lang))
        E.append(tbl)
        E.append(Spacer(1, 4*mm))

    def _cat_analysis(cat):
        """One category's result: narrative, per-gas data table, figures."""
        rows = [r for r in D['sources'] if r['iso_cat'] == cat]
        cat_t = D['by_category'][cat] / 1000.0
        if not rows:
            E.append(Paragraph(t('none_recorded', lang), S['no_data']))
            E.append(Spacer(1, 3*mm))
            return
        top = max(rows, key=lambda r: r['kg'])
        top_t = top['kg'] / 1000.0
        # Only the category label is lower-cased for the sentence; the source
        # name keeps its own casing, or "SF6" would read as "sf6".
        top_name = f'{cat_label(top["category"], lang).lower()} — {top["name"]}'
        in_cat = (top_t / cat_t * 100) if cat_t else 0
        E.append(Paragraph(
            (f'Emissions in this category totalled {_fmt(cat_t, tr)} t CO₂e, '
             f'{pct(cat_t)} % of the inventory. The largest share is '
             f'{top_name} at {_fmt(top_t, tr)} t CO₂e, which represents '
             f'{_localize_num(f"{in_cat:.2f}", tr)} % of the category.')
            if lang == 'en' else
            (f'Bu kategorideki emisyonlar toplam {_fmt(cat_t, tr)} t CO₂e olup envanterin '
             f'%{pct(cat_t)}’ini oluşturmaktadır. En büyük pay {_fmt(top_t, tr)} t CO₂e ile '
             f'{top_name} kaynağına aittir; bu, kategorinin '
             f'%{_localize_num(f"{in_cat:.2f}", tr)}’ine karşılık gelmektedir.'), S['body']))
        E.append(Spacer(1, 3*mm))
        _category_data_table(E, S, D, cat, lang, TBL)

        src_rows = [(f'{cat_label(r["category"], lang)} — {r["name"]}', r['kg'])
                    for r in rows]
        name = ISO_CATEGORY_NAMES[cat][lang]
        cat_ref = (f'Category {ROMAN[cat]}: {name[0].lower()}{name[1:]}' if lang == 'en'
                   else f'Kategori {ROMAN[cat]}: {name}')
        # The pie and the bars answer different questions, so they get distinct
        # captions rather than the same line twice: the pie is the share split,
        # the bars rank the sources against each other.
        if len([r for r in src_rows if r[1] > 0]) > 1:
            pie = _donut_chart(src_rows, S, lang)
            if pie is not None:
                E.append(Spacer(1, 3*mm))
                E.append(pie)
                E.append(_fig_caption(
                    S, FIG,
                    f'{cat_ref} — ' + ('distribution' if lang == 'en' else 'dağılım'),
                    lang))
        chart = _bar_row_chart(src_rows, D['by_category'][cat], S, lang)
        if chart is not None:
            E.append(Spacer(1, 3*mm))
            E.append(chart)
            E.append(_fig_caption(
                S, FIG,
                f'{cat_ref} — ' + ('emissions by source' if lang == 'en'
                                   else 'kaynak bazında emisyonlar'), lang))
        E.append(Spacer(1, 5*mm))

    E.append(Paragraph('4.1.1   ' + t('s4_direct', lang), S['h2']))
    E.append(Paragraph(
        'Direct greenhouse gas emissions are those from fuel combustion in stationary and '
        'mobile sources within the organisation’s boundary, together with fugitive or '
        'leakage emissions from gases used in anthropogenic systems.'
        if lang == 'en' else
        'Doğrudan sera gazı emisyonları, kuruluşun sınırları içindeki sabit ve hareketli '
        'kaynaklarda yakıt yanmasından ve antropojenik sistemlerde kullanılan gazların '
        'kaçak veya sızıntı salımlarından kaynaklanan emisyonlardır.', S['body']))
    E.append(Spacer(1, 3*mm))

    # 4.1.1.1 — stationary and mobile combustion.
    E.append(Paragraph('4.1.1.1   ' + t('s4_dir_comb', lang), S['h3']))
    E.append(Paragraph(
        'Activity data for stationary and mobile combustion sources is recorded in the unit '
        'in which it is metered or invoiced — litres, cubic metres or kilowatt-hours — and '
        'the emission factor applied to it is published in kilograms of CO₂ equivalent per '
        'that unit. No density or net calorific value conversion is therefore performed '
        'within this inventory. The published constants on which combustion factors of this '
        'type rest are reproduced below so that the calculation chain from metered quantity '
        'to reported emission can be retraced.'
        if lang == 'en' else
        'Sabit ve hareketli yanma kaynaklarına ait faaliyet verisi, ölçüldüğü veya '
        'faturalandığı birimde — litre, metreküp veya kilovatsaat — kaydedilir ve uygulanan '
        'emisyon faktörü bu birim başına kilogram CO₂ eşdeğeri olarak yayımlanmıştır. Bu '
        'nedenle envanter içinde ayrıca yoğunluk veya net kalorifik değer dönüşümü '
        'yapılmamaktadır. Bu türdeki yanma faktörlerinin dayandığı yayımlanmış sabitler, '
        'ölçülen miktardan raporlanan emisyona uzanan hesap zincirinin izlenebilmesi için '
        'aşağıda verilmiştir.', S['body']))
    E.append(Spacer(1, 3*mm))
    E.append(Paragraph(
        '<b>Activity data (fuel, mass) = activity data (fuel, volume) × density</b>'
        if lang == 'en' else
        '<b>Faaliyet verisi (yakıt, kütle) = faaliyet verisi (yakıt, hacim) × yoğunluk</b>',
        S['quote']))
    _ref_table(E, S, lang, TBL, t('t_density', lang),
               [t('c_fuel', lang), t('c_density', lang), t('c_unit', lang), t('c_ref', lang)],
               [[(en if lang == 'en' else tr_), _localize_num(d, tr), unit, ref]
                for en, tr_, d, unit, ref in FUEL_DENSITY_REF],
               [44*mm, 24*mm, 18*mm, 84*mm])
    E.append(Paragraph(
        '<b>Activity data (fuel, TJ) = activity data (fuel, Gg) × NCV (fuel)</b>'
        if lang == 'en' else
        '<b>Faaliyet verisi (yakıt, TJ) = faaliyet verisi (yakıt, Gg) × NKD (yakıt)</b>',
        S['quote']))
    _ref_table(E, S, lang, TBL, t('t_ncv', lang),
               [t('c_fuel', lang), t('c_ncv', lang), t('c_ref', lang)],
               [[(en if lang == 'en' else tr_), _localize_num(v, tr), ref]
                for en, tr_, v, ref in FUEL_NCV_REF],
               [52*mm, 28*mm, 90*mm])
    E.append(Paragraph(
        '<b>GHG emission (gas) = activity data (fuel, TJ) × emission factor (gas)</b>'
        if lang == 'en' else
        '<b>SG emisyonu (gaz) = faaliyet verisi (yakıt, TJ) × emisyon faktörü (gaz)</b>',
        S['quote']))
    _ref_table(E, S, lang, TBL, t('t_fuel_ef', lang),
               [t('c_activity', lang), t('c_comb_type', lang),
                'EF CO₂ (kg/TJ)', 'EF CH₄ (kg/TJ)', 'EF N₂O (kg/TJ)', t('c_ref', lang)],
               [[(en if lang == 'en' else tr_), (ct_en if lang == 'en' else ct_tr),
                 _localize_num(co2, tr), _localize_num(ch4, tr), _localize_num(n2o, tr), ref]
                for en, tr_, ct_en, ct_tr, co2, ch4, n2o, ref in FUEL_EF_REF],
               [30*mm, 24*mm, 19*mm, 19*mm, 19*mm, 59*mm])
    E.append(PageBreak())

    # 4.1.1.2 — fugitive releases from anthropogenic systems.
    E.append(Paragraph('4.1.1.2   ' + t('s4_dir_leak', lang), S['h3']))
    E.append(Paragraph(
        'Leakage rates published by the IPCC are used to determine the quantity of gas '
        'released from anthropogenic systems, by device type. The released quantity of each '
        'identified gas is expressed in kilograms and then converted to CO₂ equivalent '
        'using that gas’s own 100-year global warming potential.'
        if lang == 'en' else
        'Antropojenik sistemlerden salınan gaz miktarının cihaz türüne göre belirlenmesinde '
        'IPCC tarafından yayımlanan sızıntı oranları kullanılır. Tanımlanan her gazın '
        'salınan miktarı kilogram cinsinden ifade edilir ve ardından gazın kendi 100 yıllık '
        'küresel ısınma potansiyeli kullanılarak CO₂ eşdeğerine dönüştürülür.', S['body']))
    E.append(Spacer(1, 3*mm))
    _ref_table(E, S, lang, TBL, t('t_leak', lang),
               [t('c_device', lang), t('c_leak_rate', lang), t('c_ref', lang)],
               [[(en if lang == 'en' else tr_), _localize_num(v, tr), ref]
                for en, tr_, v, ref in LEAKAGE_RATE_REF],
               [56*mm, 28*mm, 86*mm])
    E.append(Paragraph(
        'In the final stage each greenhouse gas is multiplied by its 100-year global warming '
        'potential and converted to kg CO₂e; all values in kg CO₂e are then summed and '
        'reported in tonnes CO₂e.'
        if lang == 'en' else
        'Son aşamada her sera gazı, 100 yıllık küresel ısınma potansiyeli ile çarpılarak '
        'kg CO₂e’ye dönüştürülür; kg CO₂e cinsinden hesaplanan tüm değerler toplanarak ton '
        'CO₂e olarak raporlanır.', S['body']))
    E.append(Spacer(1, 3*mm))

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

    # 4.1.1.3 — what the direct emissions actually are.
    E.append(Paragraph('4.1.1.3   ' + t('s4_dir_an', lang), S['h3']))
    _cat_factors(CAT_I)
    _cat_analysis(CAT_I)

    # ═══════════════════════════════════════════════════════════════════════
    # 4.1.2 — INDIRECT EMISSIONS
    # One calculation/analysis pair per category, numbered straight through,
    # so each category states the factors it rests on before it states its
    # result — the order a verifier reads them in.
    # ═══════════════════════════════════════════════════════════════════════
    E.append(PageBreak())
    E.append(Paragraph('4.1.2   ' + t('s4_indirect', lang), S['h2']))
    E.append(Paragraph(
        'Indirect greenhouse gas emissions arise outside the organisation’s boundary but '
        'are a consequence of its activities. They are assessed under Categories II to VI. '
        'For each category the emission factors applied are stated first, followed by the '
        'quantified result.'
        if lang == 'en' else
        'Dolaylı sera gazı emisyonları, kuruluşun sınırları dışında oluşmakla birlikte onun '
        'faaliyetlerinin bir sonucudur. Bu emisyonlar Kategori II–VI kapsamında '
        'değerlendirilir. Her kategori için önce uygulanan emisyon faktörleri, ardından '
        'nicelenmiş sonuç verilmiştir.', S['body']))
    E.append(Spacer(1, 3*mm))

    sub = 0
    for cat in (CAT_II, CAT_III, CAT_IV, CAT_V, CAT_VI):
        name = ISO_CATEGORY_NAMES[cat][lang]
        name_lc = name[0].lower() + name[1:]
        sub += 1
        E.append(Paragraph(
            f'4.1.2.{sub}   ' + (f'Calculation of {name_lc}' if lang == 'en'
                                 else f'{name} hesaplaması'), S['h3']))
        _cat_factors(cat)
        sub += 1
        E.append(Paragraph(
            f'4.1.2.{sub}   ' + (f'Analysis of {name_lc}' if lang == 'en'
                                 else f'{name} analizi'), S['h3']))
        _cat_analysis(cat)
    E.append(PageBreak())

    # 4.1.3 Significance assessment — per individual indirect source, ranked
    # by magnitude, with a running cumulative share. Sources are classified
    # "significant" while the cumulative total up to (and including) that
    # source has not yet reached 95 % of indirect emissions — the same
    # cumulative-contribution test the standard's significance clause
    # describes, applied at source level rather than flattened to a per-
    # category ≥1 % cutoff.
    E.append(Paragraph('4.1.3   ' + t('s4_sig', lang), S['h2']))
    E.append(Paragraph(
        'Indirect emissions contributing at least 95 % of total indirect emissions '
        'cumulatively are classified as significant and are quantified in full below.'
        if lang == 'en' else
        'Toplam dolaylı emisyonların kümülatif olarak en az %95’ini oluşturan dolaylı '
        'emisyonlar önemli kabul edilerek aşağıda tam olarak nicelenmiştir.', S['body']))
    indirect_sources = sorted(
        (r for r in D['sources'] if r['iso_cat'] != CAT_I and r['kg'] > 0),
        key=lambda r: -r['kg'])
    indirect_total_t = D['indirect_t']
    data = [[Paragraph(f'<b>{t("c_cat", lang)}</b>', S['small']),
             Paragraph(f'<b>{t("c_source", lang)}</b>', S['small']),
             Paragraph(t('c_ghg_t', lang), S['num_hdr']),
             Paragraph(t('c_pct', lang), S['num_hdr']),
             Paragraph('Cumulative %' if lang == 'en' else 'Kümülatif %', S['num_hdr']),
             Paragraph(f'<b>{t("c_result", lang)}</b>', S['small'])]]
    prev_cum = 0.0
    for r in indirect_sources:
        v_t = r['kg'] / 1000.0
        share_pct = (v_t / indirect_total_t * 100) if indirect_total_t else 0
        cum = prev_cum + share_pct
        significant = prev_cum < 95.0
        prev_cum = cum
        data.append([
            Paragraph(ROMAN[r['iso_cat']], S['small']),
            Paragraph(f'{cat_label(r["category"], lang)} — {r["name"]}', S['small']),
            Paragraph(_fmt(v_t, tr), S['num']),
            Paragraph(_localize_num(f'{share_pct:.2f}', tr), S['num']),
            Paragraph(_localize_num(f'{cum:.2f}', tr), S['num']),
            Paragraph((('Significant' if significant else 'Not significant') if lang == 'en'
                       else ('Önemli' if significant else 'Önemli değil')), S['small']),
        ])
    if indirect_sources:
        tbl = Table(data, colWidths=[13*mm, 63*mm, 20*mm, 18*mm, 22*mm, 34*mm],
                    hAlign='LEFT', repeatRows=1)
        st = _tbl_style(fn, fnb)
        st.add('ALIGN', (0, 0), (1, -1), 'LEFT')
        st.add('ALIGN', (5, 0), (5, -1), 'LEFT')
        st.add('LEFTPADDING', (2, 0), (4, -1), 3)
        st.add('RIGHTPADDING', (2, 0), (4, -1), 3)
        st.add('VALIGN', (0, 0), (-1, -1), 'TOP')
        tbl.setStyle(st)
        E.append(_caption(S, TBL, t('t_sig', lang), lang))
        E.append(tbl)
    else:
        E.append(Paragraph(t('none_recorded', lang), S['no_data']))
    E.append(Spacer(1, 5*mm))

    # Uncertainty
    E.append(Paragraph('4.1.4   ' + t('s4_unc', lang), S['h2']))
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
    E.append(Paragraph('4.1.5   ' + t('s4_tgt', lang), S['h2']))
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
    E.append(Spacer(1, 3*mm))

    # Generic, sector-agnostic reduction levers — the platform serves
    # organisations across sectors, so this is the same role a sector-specific
    # report's "typical reduction levers for this industry" paragraph plays,
    # written broadly enough to apply regardless of which categories this
    # organisation's inventory actually contains.
    E.append(Paragraph(
        'Reduction levers organisations in most sectors typically evaluate include:'
        if lang == 'en' else
        'Çoğu sektördeki kuruluşların tipik olarak değerlendirdiği azaltım '
        'seçenekleri şunlardır:', S['body']))
    E.extend(_bullets(S, (
        ['Energy efficiency: LED lighting, efficient HVAC and equipment upgrades to '
         'reduce Category I and II consumption.',
         'Renewable and low-carbon energy: on-site generation or certified renewable '
         'electricity procurement to reduce Category II emissions.',
         'Fleet transition: replacing fossil-fuel vehicles with electric or hybrid '
         'alternatives, and optimising routes and load factors.',
         'Fugitive-emission control: leak detection and repair programmes, and lower-GWP '
         'refrigerants where equipment is replaced.',
         'Supply chain engagement: working with lower-emission suppliers and favouring '
         'recyclable or lower-carbon materials, which typically reduces Category IV.',
         'Waste reduction and diversion: minimising waste generation and increasing reuse '
         'or recycling ahead of disposal.',
         'Business travel policy: substituting travel with virtual meetings where '
         'practicable, and favouring lower-carbon transport modes.']
        if lang == 'en' else
        ['Enerji verimliliği: Kategori I ve II tüketimini azaltmak için LED aydınlatma, '
         'verimli HVAC ve ekipman yenilemeleri.',
         'Yenilenebilir ve düşük karbonlu enerji: Kategori II emisyonlarını azaltmak için '
         'sahada üretim veya sertifikalı yenilenebilir elektrik tedariki.',
         'Filo dönüşümü: fosil yakıtlı araçların elektrikli veya hibrit alternatiflerle '
         'değiştirilmesi, rota ve doluluk oranı optimizasyonu.',
         'Kaçak emisyon kontrolü: sızıntı tespit ve onarım programları, ekipman '
         'yenilendiğinde daha düşük KIP\'li soğutucu akışkanlar.',
         'Tedarik zinciri katılımı: daha düşük emisyonlu tedarikçilerle çalışmak ve geri '
         'dönüştürülebilir veya düşük karbonlu malzemeleri tercih etmek — genellikle '
         'Kategori IV\'ü azaltır.',
         'Atık azaltımı ve yönlendirme: atık oluşumunu en aza indirmek, bertaraf '
         'öncesinde yeniden kullanım veya geri dönüşümü artırmak.',
         'İş seyahati politikası: mümkün olduğunda seyahat yerine sanal toplantılar, '
         'daha düşük karbonlu ulaşım modlarının tercih edilmesi.'])))
    E.append(Spacer(1, 4*mm))

    # Risk & opportunity
    E.append(Paragraph('4.1.6   ' + t('s4_risk', lang), S['h2']))
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

    # Verification — the questionnaire has no dedicated verification-statement
    # free-text step, so this is always the standard declaration.
    E.append(Paragraph('4.1.7   ' + t('s4_ver', lang), S['h2']))
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
    E.append(Paragraph('4.1.8   ' + t('s4_qms', lang), S['h2']))
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

    # 4.2 Evaluation by location and by activity — the two cuts of the same
    # inventory that answer "where" and "on what". Presented in that order.
    E.append(Paragraph('4.2   ' + t('s4_2', lang), S['h2']))

    # 4.2.1 Location-based evaluation
    E.append(Paragraph('4.2.1   ' + t('s4_loc', lang), S['h3']))
    facs = D['facilities']
    if facs:
        ordered = sorted(facs.items(), key=lambda kv: -sum(kv[1].values()))
        E.append(Paragraph(
            'Emissions at each reporting location are shown by category below. The '
            'highlighted cell in each row is that location’s dominant category.'
            if lang == 'en' else
            'Her raporlama lokasyonuna ait emisyonlar aşağıda kategori bazında '
            'gösterilmiştir. Her satırdaki vurgulu hücre, o lokasyonun baskın '
            'kategorisidir.', S['body']))
        E.append(Spacer(1, 2*mm))
        data = [[Paragraph(f'<b>{t("c_facility", lang)}</b>', S['small'])] +
                [Paragraph(ROMAN[c], S['num_hdr']) for c in sorted(ROMAN)] +
                [Paragraph(t('c_total', lang), S['num_hdr'])]]
        dominant_cells = []  # (row, col) of each facility's largest category
        for row_i, (name, cats) in enumerate(ordered[:20], start=1):
            tot = sum(cats.values()) / 1000.0
            data.append(
                [Paragraph(name, S['small'])] +
                [Paragraph(_fmt(cats[c] / 1000.0, tr), S['num']) for c in sorted(ROMAN)] +
                [Paragraph(f'<b>{_fmt(tot, tr)}</b>', S['num'])]
            )
            dominant_cat = max(sorted(ROMAN), key=lambda c: cats[c])
            if cats[dominant_cat] > 0:
                dominant_cells.append((row_i, sorted(ROMAN).index(dominant_cat) + 1))
        tbl = Table(data, colWidths=[54*mm] + [16*mm]*6 + [20*mm], hAlign='LEFT',
                    repeatRows=1)
        st = _tbl_style(fn, fnb)
        st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
        st.add('LEFTPADDING', (1, 0), (-1, -1), 3)
        st.add('RIGHTPADDING', (1, 0), (-1, -1), 3)
        # Highlight each facility's dominant emission category — the same
        # visual cue the sample report uses to show at a glance which
        # category (imported energy, purchased transport, personnel
        # services, …) drives each location's emissions.
        for row, col in dominant_cells:
            st.add('BACKGROUND', (col, row), (col, row), ACCENT_SOFT)
        tbl.setStyle(st)
        E.append(_caption(S, TBL, t('t_loc', lang), lang))
        E.append(tbl)

        # The inter-location reading the table supports but does not state:
        # which locations carry the inventory, and by how much.
        tops = [(n, sum(c.values())) for n, c in ordered[:3] if sum(c.values()) > 0]
        if tops and D['total_kg']:
            def _share(v):
                return _localize_num(f'{v / D["total_kg"] * 100:.0f}', tr)
            lead_n, lead_v = tops[0]
            sentence = (
                f'In the inter-location comparison the largest share of emissions belongs '
                f'to {lead_n} with {_share(lead_v)} %.'
                if lang == 'en' else
                f'Lokasyonlar arası karşılaştırmada en büyük emisyon payı %{_share(lead_v)} '
                f'ile {lead_n} lokasyonuna aittir.')
            if len(tops) > 1:
                rest = ', '.join(f'{n} ({_share(v)} %)' for n, v in tops[1:])
                sentence += (f' The next largest are {rest}.' if lang == 'en'
                             else f' Bunu {rest} izlemektedir.')
            E.append(Spacer(1, 3*mm))
            E.append(Paragraph(sentence, S['body']))

        chart = _bar_row_chart([(n, sum(c.values())) for n, c in ordered],
                               D['total_kg'], S, lang)
        if chart is not None:
            E.append(Spacer(1, 4*mm))
            E.append(chart)
            E.append(_fig_caption(S, FIG, t('t_loc', lang), lang))
        E.append(PageBreak())

        # Per-activity location breakdown — for each of the largest activity
        # types, which facility is driving it. This is the same cut the
        # sample ISO report devotes a dedicated figure to for every activity
        # (stationary combustion, mobile combustion, electricity, business
        # travel, …); it answers "where should this specific activity be
        # acted on", which the single combined table above cannot.
        # Every activity type that is actually spread across facilities gets
        # its own figure, the way the reference inventory report does — the
        # section is what a reader consults to find where one specific activity
        # should be acted on, so truncating it to the largest few would leave
        # the smaller activities with nowhere to be looked up. Activities
        # recorded at a single facility are left out: a one-bar chart says
        # nothing the activity table above has not already said.
        act_by_facility = D.get('facility_activity') or {}
        top_activities = sorted(
            ((k, v) for k, v in act_by_facility.items() if sum(v.values()) > 0 and len(v) > 1),
            key=lambda kv: -sum(kv[1].values()))
        if top_activities:
            E.append(Paragraph(
                'Emissions from the activity types with the largest spread across '
                'facilities are broken down below.'
                if lang == 'en' else
                'Tesisler arasında en geniş dağılıma sahip faaliyet türlerine ait '
                'emisyonların dökümü aşağıda verilmiştir.', S['body']))
            for act_key, per_fac in top_activities:
                rows = sorted(per_fac.items(), key=lambda kv: -kv[1])
                chart = _bar_row_chart(rows, sum(per_fac.values()), S, lang)
                if chart is None:
                    continue
                E.append(Spacer(1, 4*mm))
                E.append(chart)
                act_name = cat_label(act_key, lang).lower()
                cap = (f'Location-level evaluation of emissions from {act_name}'
                       if lang == 'en' else
                       f'Faaliyet bazında tesis düzeyinde emisyon değerlendirmesi — {act_name}')
                E.append(_fig_caption(S, FIG, cap, lang))
    else:
        E.append(Paragraph(
            'Activity data has not been attributed to individual facilities, so a '
            'location-level breakdown is not presented. Assign facilities to emission '
            'records to enable this section.'
            if lang == 'en' else
            'Faaliyet verisi ayrı tesislere atanmadığından tesis bazında dağılım '
            'sunulmamıştır. Bu bölümün oluşması için emisyon kayıtlarına tesis atayın.',
            S['no_data']))
    E.append(PageBreak())

    # 4.2.2 Activity-based assessment — the same inventory cut by what the
    # organisation actually does, rather than by ISO category. An activity can
    # straddle categories (fuel appears under both combustion and transport),
    # so this is the view that answers "which activity should we act on first".
    E.append(Paragraph('4.2.2   ' + t('s4_actsub', lang), S['h3']))
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
            E.append(_fig_caption(
                S, FIG,
                t('t_act', lang) + (' — ranked' if lang == 'en' else ' — sıralı'),
                lang))
    else:
        E.append(Paragraph(t('none_recorded', lang), S['no_data']))
    E.append(PageBreak())

    # 4.3 Year-on-year comparison — every year the company has any activity
    # data for, not just the reporting year, so the base-year comparison the
    # methodology section (3.2) already describes can actually be shown
    # rather than just asserted.
    year_totals = D.get('year_totals') or {}
    if len(year_totals) > 1:
        E.append(PageBreak())
        E.append(Paragraph('4.3   ' + t('s4_trend', lang), S['h2']))
        base_year = report.baseline_year or min(year_totals)
        base_t = year_totals.get(base_year, 0.0) / 1000.0
        E.append(Paragraph(
            (f'Total greenhouse gas emissions for every year with recorded activity '
             f'data are compared against the {base_year} base year below.')
            if lang == 'en' else
            (f'Kayıtlı faaliyet verisi bulunan her yıla ait toplam sera gazı emisyonları '
             f'aşağıda {base_year} baz yılı ile karşılaştırılmıştır.'), S['body']))
        data = [[Paragraph(f'<b>{"Year" if lang == "en" else "Yıl"}</b>', S['body_sm']),
                 Paragraph(f'<b>{t("c_total", lang)}</b>', S['body_sm']),
                 Paragraph('<b>' + ('Change vs base year' if lang == 'en'
                                     else 'Baz yıla göre değişim') + '</b>', S['body_sm'])]]
        for yr in sorted(year_totals):
            v_t = year_totals[yr] / 1000.0
            if base_t:
                change = (v_t - base_t) / base_t * 100
                change_txt = f'{"+" if change >= 0 else ""}{_localize_num(f"{change:.1f}", tr)} %'
            else:
                change_txt = '—'
            is_base = (yr == base_year)
            label = f'{yr}' + ((' (base year)' if lang == 'en' else ' (baz yıl)') if is_base else '')
            data.append([
                Paragraph(label, S['body_sm']),
                Paragraph(f'{_fmt(v_t, tr)} t CO₂e', S['body_sm']),
                Paragraph(change_txt if not is_base else '—', S['body_sm']),
            ])
        tbl = Table(data, colWidths=[50*mm, 60*mm, 60*mm], hAlign='LEFT', repeatRows=1)
        st = _tbl_style(fn, fnb)
        st.add('ALIGN', (0, 0), (0, -1), 'LEFT')
        tbl.setStyle(st)
        E.append(_caption(S, TBL, t('t_trend', lang), lang))
        E.append(tbl)


# ═══════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════
def generate_iso_report(report: CarbonReport, lang: str = 'en', page_offset: int = 0) -> bytes:
    """Build the full ISO 14064-1:2018 inventory report. Returns PDF bytes.

    `page_offset` shifts the printed page number so the report numbers on
    from the part before it in the combined pack.
    """
    lang = 'tr' if lang == 'tr' else 'en'
    S = _styles()
    D = _gather(report, lang)

    company = D['company']
    cname = company.legal_entity_name if company else '—'

    buf = io.BytesIO()
    doc = _ReportDocTemplate(
        buf, cname, D['year'], lang, page_offset=page_offset,
        pagesize=A4, topMargin=20*mm, bottomMargin=20*mm,
        leftMargin=20*mm, rightMargin=20*mm,
        title=f'{t("standard", lang)} {t("doc_title", lang)} {D["year"]}',
        author='Carbonless',
    )

    E = []
    TBL, FIG = _Counter(), _Counter()
    _cover(E, S, D, report, lang)
    _contents(E, S, lang)
    _introduction(E, S, lang)
    _section1(E, S, D, report, lang, TBL, FIG)
    _section2(E, S, lang)
    _section3(E, S, D, report, lang, TBL, FIG)
    _section4(E, S, D, report, lang, TBL, FIG)

    doc.build(E)
    return buf.getvalue()
