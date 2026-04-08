"""
ISO 14064-1 Carbon Inventory PDF Report Generator
Generates professional PDF reports with scope breakdown, category details, and methodology.
Supports Turkish characters (İ, ş, ğ, ü, ö, ç) via DejaVuSans font.
"""
import io
import os
from datetime import datetime
from decimal import Decimal
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from django.db.models import Sum
from .models import EmissionFactor, EmissionEntry, CustomEmissionRequest

# Register Unicode font for Turkish characters
_font_registered = False
def _register_fonts():
    global _font_registered
    if _font_registered:
        return
    # Try DejaVuSans (commonly available)
    font_paths = [
        # Linux
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        # Windows
        os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'arial.ttf'),
        os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'arialbd.ttf'),
    ]
    # Try Arial first (Windows), then DejaVu (Linux/Render)
    try:
        arial = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'arial.ttf')
        arialb = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'arialbd.ttf')
        if os.path.exists(arial):
            pdfmetrics.registerFont(TTFont('CustomFont', arial))
            pdfmetrics.registerFont(TTFont('CustomFont-Bold', arialb if os.path.exists(arialb) else arial))
            _font_registered = True
            return
    except Exception:
        pass
    try:
        dejavu = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
        dejavub = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
        if os.path.exists(dejavu):
            pdfmetrics.registerFont(TTFont('CustomFont', dejavu))
            pdfmetrics.registerFont(TTFont('CustomFont-Bold', dejavub if os.path.exists(dejavub) else dejavu))
            _font_registered = True
            return
    except Exception:
        pass
    # Fallback: use Helvetica (no Turkish support)
    _font_registered = True


def generate_report(user, year, lang='tr'):
    """Generate ISO 14064-1 PDF report for a user/year. Returns bytes."""
    _register_fonts()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=25*mm, bottomMargin=20*mm)

    # Determine font name
    fn = 'CustomFont' if _font_registered else 'Helvetica'
    fnb = 'CustomFont-Bold' if _font_registered else 'Helvetica-Bold'

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Title2', fontName=fnb, fontSize=22, spaceAfter=6))
    styles.add(ParagraphStyle(name='H2', fontName=fnb, fontSize=14, spaceAfter=4))
    styles.add(ParagraphStyle(name='H3', fontName=fnb, fontSize=11, spaceAfter=3))
    styles.add(ParagraphStyle(name='Body', fontName=fn, fontSize=10, spaceAfter=4))
    styles.add(ParagraphStyle(name='Small', fontName=fn, fontSize=8, textColor=colors.grey))

    elements = []
    tr = lang == 'tr'

    # --- Data ---
    entries = EmissionEntry.objects.filter(user=user, year=year)
    total_kg = entries.aggregate(t=Sum('calculated_co2e_kg'))['t'] or Decimal('0')
    s1 = entries.filter(emission_factor__scope='scope1').aggregate(t=Sum('calculated_co2e_kg'))['t'] or Decimal('0')
    s2 = entries.filter(emission_factor__scope='scope2').aggregate(t=Sum('calculated_co2e_kg'))['t'] or Decimal('0')
    s3 = entries.filter(emission_factor__scope='scope3').aggregate(t=Sum('calculated_co2e_kg'))['t'] or Decimal('0')

    custom_approved = CustomEmissionRequest.objects.filter(
        user=user, year=year, status='approved', calculated_co2e_kg__isnull=False
    )
    custom_total = custom_approved.aggregate(t=Sum('calculated_co2e_kg'))['t'] or Decimal('0')
    for cr in custom_approved:
        if cr.scope == 'scope1': s1 += cr.calculated_co2e_kg
        elif cr.scope == 'scope2': s2 += cr.calculated_co2e_kg
        else: s3 += cr.calculated_co2e_kg
    total_kg += custom_total

    company_name = ''
    try:
        company_name = user.company.legal_entity_name
    except Exception:
        company_name = user.username

    # ===== COVER =====
    elements.append(Spacer(1, 40*mm))
    elements.append(Paragraph('CARBONLESS', styles['Title2']))
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph(
        'Karbon Envanteri Raporu' if tr else 'Carbon Inventory Report',
        styles['H2']
    ))
    elements.append(Paragraph(f'ISO 14064-1 | {year}', styles['H3']))
    elements.append(Spacer(1, 10*mm))
    elements.append(Paragraph(company_name, styles['H2']))
    elements.append(Spacer(1, 5*mm))
    elements.append(Paragraph(
        f"{'Oluşturulma Tarihi' if tr else 'Generated'}: {datetime.now().strftime('%d.%m.%Y')}",
        styles['Body']
    ))
    elements.append(PageBreak())

    # ===== EXECUTIVE SUMMARY =====
    elements.append(Paragraph(
        'Yönetici Özeti' if tr else 'Executive Summary', styles['H2']
    ))
    elements.append(Paragraph(
        f"{'Bu rapor' if tr else 'This report covers'} {company_name} "
        f"{'şirketinin' if tr else 'company'} {year} {'yılı sera gazı emisyonlarını ISO 14064-1 standardına uygun olarak özetlemektedir.' if tr else 'greenhouse gas emissions in accordance with ISO 14064-1.'}",
        styles['Body']
    ))
    elements.append(Spacer(1, 5*mm))

    # Total emissions box
    summary_data = [
        [
            'Scope',
            'kg CO2e' if not tr else 'kg CO2e',
            'tCO2e',
            '%'
        ],
        [
            'Scope 1 – ' + ('Doğrudan' if tr else 'Direct'),
            f'{float(s1):,.2f}',
            f'{float(s1)/1000:,.4f}',
            f'{float(s1)/float(total_kg)*100:.1f}' if total_kg else '0'
        ],
        [
            'Scope 2 – ' + ('Enerji Dolaylı' if tr else 'Energy Indirect'),
            f'{float(s2):,.2f}',
            f'{float(s2)/1000:,.4f}',
            f'{float(s2)/float(total_kg)*100:.1f}' if total_kg else '0'
        ],
        [
            'Scope 3 – ' + ('Diğer Dolaylı' if tr else 'Other Indirect'),
            f'{float(s3):,.2f}',
            f'{float(s3)/1000:,.4f}',
            f'{float(s3)/float(total_kg)*100:.1f}' if total_kg else '0'
        ],
        [
            'TOPLAM' if tr else 'TOTAL',
            f'{float(total_kg):,.2f}',
            f'{float(total_kg)/1000:,.4f}',
            '100'
        ],
    ]
    t = Table(summary_data, colWidths=[55*mm, 35*mm, 35*mm, 20*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), fn),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0fdf4')),
        ('FONTNAME', (0, -1), (-1, -1), fnb),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f9fafb')]),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 8*mm))

    # ===== CATEGORY BREAKDOWN =====
    elements.append(Paragraph(
        'Kategori Dağılımı' if tr else 'Category Breakdown', styles['H2']
    ))
    cats = entries.values('emission_factor__scope', 'emission_factor__category').annotate(
        total=Sum('calculated_co2e_kg')
    ).order_by('emission_factor__scope', '-total')

    cat_labels = {
        'stationary_combustion': 'Sabit Yanma' if tr else 'Stationary Combustion',
        'mobile_combustion': 'Mobil Yanma' if tr else 'Mobile Combustion',
        'fugitive_emissions': 'Kaçak Emisyonlar' if tr else 'Fugitive Emissions',
        'electricity': 'Elektrik' if tr else 'Electricity',
        'steam_heat': 'Buhar ve Isı' if tr else 'Steam & Heat',
        'purchased_goods': 'Satın Alınan Mallar' if tr else 'Purchased Goods',
        'capital_goods': 'Sermaye Malları' if tr else 'Capital Goods',
        'fuel_energy': 'Yakıt ve Enerji' if tr else 'Fuel & Energy',
        'upstream_transport': 'Yukarı Akış Taşıma' if tr else 'Upstream Transport',
        'waste': 'Atık' if tr else 'Waste',
        'business_travel': 'İş Seyahati' if tr else 'Business Travel',
        'employee_commuting': 'Çalışan Ulaşımı' if tr else 'Employee Commuting',
        'water': 'Su' if tr else 'Water',
    }

    if cats:
        cat_data = [['Scope', 'Kategori' if tr else 'Category', 'kg CO2e', 'tCO2e']]
        for c in cats:
            scope = c['emission_factor__scope'].replace('scope', 'Scope ')
            cat_name = cat_labels.get(c['emission_factor__category'], c['emission_factor__category'])
            cat_data.append([
                scope, cat_name,
                f"{float(c['total']):,.2f}",
                f"{float(c['total'])/1000:,.4f}"
            ])
        ct = Table(cat_data, colWidths=[25*mm, 55*mm, 35*mm, 30*mm])
        ct.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), fn),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ]))
        elements.append(ct)
    elements.append(Spacer(1, 8*mm))

    # ===== DETAILED ENTRIES =====
    elements.append(Paragraph(
        'Detaylı Emisyon Kayıtları' if tr else 'Detailed Emission Entries', styles['H2']
    ))
    if entries.exists():
        detail_data = [[
            'Kaynak' if tr else 'Source',
            'Scope',
            'Miktar' if tr else 'Qty',
            'Birim' if tr else 'Unit',
            'Faktör' if tr else 'Factor',
            'kg CO2e',
        ]]
        for e in entries.select_related('emission_factor')[:100]:
            ef = e.emission_factor
            detail_data.append([
                (ef.name_tr if tr and ef.name_tr else ef.name)[:30],
                ef.scope.replace('scope', 'S'),
                f'{float(e.quantity):,.1f}',
                ef.unit,
                f'{float(ef.factor_kg_co2e):.4f}',
                f'{float(e.calculated_co2e_kg):,.2f}',
            ])
        dt = Table(detail_data, colWidths=[45*mm, 12*mm, 22*mm, 15*mm, 22*mm, 28*mm])
        dt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), fn),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.lightgrey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
        ]))
        elements.append(dt)
    else:
        elements.append(Paragraph(
            'Bu dönem için kayıt bulunmamaktadır.' if tr else 'No entries for this period.',
            styles['Body']
        ))
    elements.append(Spacer(1, 8*mm))

    # ===== CUSTOM REQUESTS =====
    if custom_approved.exists():
        elements.append(Paragraph(
            'Özel Emisyon Kayıtları (Admin Onaylı)' if tr else 'Custom Emission Entries (Admin Approved)',
            styles['H2']
        ))
        cr_data = [['Kaynak' if tr else 'Source', 'Scope', 'Miktar' if tr else 'Qty', 'Birim' if tr else 'Unit', 'kg CO2e']]
        for cr in custom_approved:
            cr_data.append([
                cr.source_name[:35], cr.scope.replace('scope', 'S'),
                f'{float(cr.quantity):,.1f}', cr.unit,
                f'{float(cr.calculated_co2e_kg):,.2f}'
            ])
        crt = Table(cr_data, colWidths=[50*mm, 15*mm, 25*mm, 20*mm, 30*mm])
        crt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), fn),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.lightgrey),
        ]))
        elements.append(crt)
        elements.append(Spacer(1, 8*mm))

    # ===== METHODOLOGY =====
    elements.append(PageBreak())
    elements.append(Paragraph(
        'Metodoloji' if tr else 'Methodology', styles['H2']
    ))
    methodology = [
        ('Standart' if tr else 'Standard', 'ISO 14064-1:2018, GHG Protocol Corporate Standard'),
        ('Kapsam' if tr else 'Boundary', ('Operasyonel kontrol yaklaşımı' if tr else 'Operational control approach')),
        ('Gazlar' if tr else 'Gases', 'CO2, CH4, N2O (CO2e)'),
        ('GWP', 'IPCC AR6 (100-year)'),
    ]
    # Collect unique sources used
    sources_used = set()
    for e in entries.select_related('emission_factor'):
        src = e.emission_factor.source
        ref = e.emission_factor.reference
        if src and ref:
            sources_used.add(f"{e.emission_factor.get_source_display()}: {ref[:80]}")

    for label, val in methodology:
        elements.append(Paragraph(f"<b>{label}:</b> {val}", styles['Body']))
    elements.append(Spacer(1, 5*mm))

    # Sources
    elements.append(Paragraph(
        'Kullanılan Emisyon Faktör Kaynakları' if tr else 'Emission Factor Sources Used',
        styles['H3']
    ))
    if sources_used:
        for s in sorted(sources_used):
            elements.append(Paragraph(f"• {s}", styles['Small']))
    else:
        elements.append(Paragraph(
            'Henüz kaynak bilgisi yok.' if tr else 'No source information yet.',
            styles['Small']
        ))

    elements.append(Spacer(1, 15*mm))
    elements.append(Paragraph(
        f"{'Bu rapor Carbonless platformu tarafından otomatik olarak oluşturulmuştur.' if tr else 'This report was automatically generated by the Carbonless platform.'} | {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        styles['Small']
    ))

    # Build
    doc.build(elements)
    buf.seek(0)
    return buf.getvalue()
