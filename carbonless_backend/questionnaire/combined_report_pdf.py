"""The combined report pack — all three Carbonless PDFs bound into one file.

The platform produces three reports that answer different questions about the
same reporting year, and a company sending its inventory to a verifier, a
customer or a board normally wants all three together:

  Part I   Full ISO 14064-1:2018 inventory report — the main deliverable
  Part II  Carbon Inventory Profile — the qualitative questionnaire answers
           behind the inventory (boundaries, framework, coverage)
  Part III Quantified emissions summary — the Scope 1/2/3 figures the
           inventory was calculated from

They stay three separate documents, each still downloadable on its own; this
module binds them without rewriting them. Two things make the result read as
one document rather than three files stapled together:

  * **Continuous page numbers.** Each generator takes a `page_offset`, so
    Part II starts where Part I stopped. Nothing else about the parts changes,
    and none of them has an internal table of contents that cites page
    numbers, so nothing can fall out of step with the stamped ones.

  * **Front matter that knows where the parts are.** A cover and a contents
    page list each part with the page it starts on, and the same structure is
    written into the PDF outline so a reader can jump between parts in any
    viewer.

The front matter has to state page numbers that depend on how long the parts
are, and the parts need an offset that depends on how long the front matter
is. `_build_front_matter` resolves that by building the cheap front matter
twice — see `generate_combined_report`.
"""
import io
import logging
from datetime import datetime

from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table,
    NextPageTemplate, PageBreak,
)

from emissions.report_pdf import generate_report
from .iso_report_pdf import (
    ACCENT, FAINT, LINE, LOGO_PATH, _fonts, _styles, _tbl_style,
    generate_iso_report,
)
from .models import CarbonReport
from .report_pdf import generate_questionnaire_report

logger = logging.getLogger(__name__)


# ── Wording ─────────────────────────────────────────────────────────────────
TEXT = {
    'en': {
        'pack_title': 'Greenhouse Gas Reporting Pack',
        'standard': 'ISO 14064-1:2018',
        'reporting_year': 'Reporting Year',
        'prepared_by': 'Prepared By',
        'issued': 'Issue Date',
        'contents': 'Contents of this Pack',
        'report': 'Report',
        'part': 'Part',
        'page': 'Page',
        'confidential': 'CONFIDENTIAL — This pack is for authorized personnel only.',
        'intro': (
            'This pack brings together the three reports Carbonless produces for the '
            'reporting year shown above. Each part is a complete document in its own '
            'right and is also available as a separate download; they are bound here so '
            'that the inventory, the basis on which it was prepared, and the underlying '
            'quantified data can be read together. Page numbering runs continuously '
            'through the pack.'),
        'p1_title': 'Greenhouse Gas Emissions Inventory Report',
        'p1_desc': (
            'The full ISO 14064-1:2018 inventory: organisational and reporting '
            'boundaries, quantification methodology, exclusions and assumptions, the '
            'inventory itself reported gas by gas, and the analysis of each of the six '
            'categories.'),
        'p2_title': 'Carbon Inventory Profile',
        'p2_desc': (
            'The qualitative profile behind the inventory, taken from the completed '
            'questionnaire: company and facility details, the reporting framework and '
            'boundary approach chosen, and which sections of the inventory were '
            'answered.'),
        'p3_title': 'Quantified Emissions Summary',
        'p3_desc': (
            'The Scope 1, 2 and 3 figures the inventory was calculated from, with the '
            'activity data, emission factors and per-category totals recorded for the '
            'year.'),
    },
    'tr': {
        'pack_title': 'Sera Gazı Raporlama Paketi',
        'standard': 'ISO 14064-1:2018',
        'reporting_year': 'Raporlama Yılı',
        'prepared_by': 'Hazırlayan',
        'issued': 'Rapor Tarihi',
        'contents': 'Paket İçeriği',
        'report': 'Rapor',
        'part': 'Bölüm',
        'page': 'Sayfa',
        'confidential': 'GİZLİ — Bu paket yalnızca yetkili kişiler içindir.',
        'intro': (
            'Bu paket, yukarıda belirtilen raporlama yılı için Carbonless tarafından '
            'üretilen üç raporu bir araya getirir. Her bölüm kendi başına eksiksiz bir '
            'belgedir ve ayrı olarak da indirilebilir; envanterin, hangi esasa göre '
            'hazırlandığının ve dayandığı nicel verinin birlikte okunabilmesi için burada '
            'birleştirilmiştir. Sayfa numaraları paket boyunca kesintisiz ilerler.'),
        'p1_title': 'Sera Gazı Emisyon Envanter Raporu',
        'p1_desc': (
            'Tam ISO 14064-1:2018 envanteri: kurumsal ve raporlama sınırları, nicelendirme '
            'metodolojisi, hariç tutmalar ve varsayımlar, gaz bazında raporlanan envanterin '
            'kendisi ve altı kategorinin her birinin analizi.'),
        'p2_title': 'Karbon Envanteri Profil Raporu',
        'p2_desc': (
            'Envanterin arkasındaki niteliksel profil, tamamlanan anketten alınmıştır: '
            'şirket ve tesis bilgileri, seçilen raporlama çerçevesi ve sınır yaklaşımı ile '
            'envanterin hangi bölümlerinin yanıtlandığı.'),
        'p3_title': 'Nicel Emisyon Özeti',
        'p3_desc': (
            'Envanterin hesaplandığı Kapsam 1, 2 ve 3 değerleri; yıl için kaydedilen '
            'faaliyet verileri, emisyon faktörleri ve kategori bazında toplamlarla '
            'birlikte.'),
    },
}


def _t(key, lang):
    return TEXT.get(lang, TEXT['en'])[key]


class _PackDocTemplate(BaseDocTemplate):
    """Front matter only. Deliberately unnumbered — the cover and contents sit
    ahead of Part I, and numbering starts with the first part, the way a bound
    report's front matter does."""

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

    @staticmethod
    def _logo(canvas, x, y, size):
        # A missing decorative asset must never break report generation.
        try:
            canvas.drawImage(LOGO_PATH, x, y, width=size, height=size,
                             mask='auto', preserveAspectRatio=True)
        except Exception:
            pass

    def _cover_page(self, canvas, doc):
        """Matches the ISO report's cover chrome, so the pack and the part it
        opens with read as the same family of document."""
        fn, fnb = _fonts()
        w, h = A4
        canvas.setStrokeColor(ACCENT)
        canvas.setLineWidth(0.75)
        canvas.line(20*mm, h-22*mm, w-20*mm, h-22*mm)
        self._logo(canvas, 20*mm, h-20.5*mm, 5*mm)
        canvas.setFont(fnb, 8)
        canvas.setFillColor(ACCENT)
        canvas.drawString(27*mm, h-19*mm, 'CARBONLESS')
        canvas.setFont(fn, 8)
        canvas.setFillColor(FAINT)
        canvas.drawRightString(w-20*mm, h-19*mm, _t('standard', self.lang))
        self._logo(canvas, 20*mm, h-46*mm, 16*mm)

    def _content_page(self, canvas, doc):
        fn, fnb = _fonts()
        w, h = A4
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.6)
        canvas.line(20*mm, h-15*mm, w-20*mm, h-15*mm)
        self._logo(canvas, 20*mm, h-13.8*mm, 3.6*mm)
        canvas.setFont(fnb, 7.5)
        canvas.setFillColor(ACCENT)
        canvas.drawString(25*mm, h-13*mm, f'{_t("pack_title", self.lang)} — {self.year}')
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.4)
        canvas.line(20*mm, 15*mm, w-20*mm, 15*mm)
        canvas.setFont(fn, 7)
        canvas.setFillColor(FAINT)
        canvas.drawString(20*mm, 10*mm, self.company_name)
        canvas.drawCentredString(w/2, 10*mm, 'Carbonless')
        canvas.drawRightString(w-20*mm, 10*mm, datetime.now().strftime('%d.%m.%Y'))


def _build_front_matter(company_name, year, prepared_by, lang, parts):
    """Cover + contents for the pack. `parts` is the list of
    (roman, title, description, start_page) rows the contents page lists;
    start_page may be None on the sizing pass, when the page count is what is
    being measured and the numbers are not yet known.
    """
    S = _styles()
    fn, fnb = _fonts()
    buf = io.BytesIO()
    doc = _PackDocTemplate(
        buf, company_name, year, lang, pagesize=A4,
        topMargin=20*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm,
        title=f'{_t("pack_title", lang)} {year}', author='Carbonless')

    E = []
    # ── Cover ──
    E.append(Spacer(1, 62*mm))
    E.append(Paragraph(company_name, S['cover_company']))
    E.append(Spacer(1, 6*mm))
    E.append(Paragraph(_t('pack_title', lang), S['cover_title']))
    E.append(Spacer(1, 3*mm))
    E.append(Paragraph(_t('standard', lang), S['cover_date']))
    E.append(Spacer(1, 16*mm))
    meta = [(_t('reporting_year', lang), str(year))]
    if prepared_by:
        meta.append((_t('prepared_by', lang), prepared_by))
    meta.append((_t('issued', lang), datetime.now().strftime('%d.%m.%Y')))
    for label, value in meta:
        E.append(Paragraph(f'{label}: {value}', S['cover_date']))
    E.append(Spacer(1, 20*mm))
    E.append(Paragraph(_t('confidential', lang), S['small']))
    E.append(NextPageTemplate('content'))
    E.append(PageBreak())

    # ── Contents ──
    E.append(Paragraph(_t('contents', lang), S['h1']))
    E.append(Paragraph(_t('intro', lang), S['body']))
    E.append(Spacer(1, 6*mm))

    rows = [[
        Paragraph(f'<b>{_t("part", lang)}</b>', S['body_sm']),
        Paragraph(f'<b>{_t("report", lang)}</b>', S['body_sm']),
        Paragraph(f'<b>{_t("page", lang)}</b>', S['body_sm']),
    ]]
    for roman, title, description, start in parts:
        rows.append([
            Paragraph(roman, S['body_sm']),
            Paragraph(f'<b>{title}</b><br/>{description}', S['body_sm']),
            Paragraph(str(start) if start is not None else '—', S['body_sm']),
        ])
    # Column 1 holds the word 'Part'/'Bölüm' in bold — 16mm wrapped the
    # Turkish header onto two lines.
    table = Table(rows, colWidths=[22*mm, 131*mm, 17*mm], hAlign='LEFT', repeatRows=1)
    st = _tbl_style(fn, fnb)
    st.add('ALIGN', (0, 0), (1, -1), 'LEFT')
    st.add('ALIGN', (2, 0), (2, -1), 'RIGHT')
    st.add('VALIGN', (0, 0), (-1, -1), 'TOP')
    table.setStyle(st)
    E.append(table)

    doc.build(E)
    return buf.getvalue()


def _page_count(pdf_bytes):
    return len(PdfReader(io.BytesIO(pdf_bytes)).pages)


def generate_combined_report(report: CarbonReport, lang='en', year=None) -> bytes:
    """Build the three-part pack for `report`. Returns PDF bytes.

    `year` defaults to the report's own reporting year so that every part
    covers the same period — the pack would be misleading otherwise, since the
    emissions summary is keyed on a year rather than on the report.
    """
    lang = 'tr' if lang == 'tr' else 'en'
    company = report.company
    company_name = company.legal_entity_name if company else '—'
    year = year or report.reporting_year or datetime.now().year

    part_meta = [
        ('I', _t('p1_title', lang), _t('p1_desc', lang)),
        ('II', _t('p2_title', lang), _t('p2_desc', lang)),
        ('III', _t('p3_title', lang), _t('p3_desc', lang)),
    ]

    # The front matter's length decides where Part I starts, and the parts'
    # lengths decide what the contents page prints. Build the front matter once
    # with the numbers unknown purely to measure it, then once more for real:
    # only the digits change between the two, so the length does not move. The
    # parts are built once, after the offset is known, because they are the
    # expensive half.
    sizing = _build_front_matter(company_name, year, report.prepared_by, lang,
                                 [(r, t_, d, None) for r, t_, d in part_meta])
    front_pages = _page_count(sizing)

    parts, offset = [], front_pages
    starts = []
    for roman, _title, _desc in part_meta:
        if roman == 'I':
            pdf = generate_iso_report(report, lang, page_offset=offset)
        elif roman == 'II':
            pdf = generate_questionnaire_report(report, lang, page_offset=offset)
        else:
            pdf = generate_report(report.created_by, year, lang, page_offset=offset)
        # Each part opens on an unnumbered cover that acts as its divider, so
        # the first *numbered* page is the one after it — which is the page the
        # contents should send a reader to.
        starts.append(offset + 1)
        parts.append(pdf)
        offset += _page_count(pdf)

    front = _build_front_matter(
        company_name, year, report.prepared_by, lang,
        [(r, t_, d, s) for (r, t_, d), s in zip(part_meta, starts)])
    if _page_count(front) != front_pages:
        # Filling the page numbers in changed the front matter's length, so the
        # offsets the parts were stamped with are now wrong. Rather than ship a
        # pack whose contents page lies, say so and let the caller fall back.
        raise RuntimeError(
            f'Combined report front matter changed length when paginated '
            f'({front_pages} -> {_page_count(front)} pages); page numbers would be wrong.')

    writer = PdfWriter()
    for page in PdfReader(io.BytesIO(front)).pages:
        writer.add_page(page)
    # Outline entries let a reader move between parts in any PDF viewer, which
    # matters more here than in any single report — the pack is ~40 pages.
    for (roman, title, _desc), pdf in zip(part_meta, parts):
        first = len(writer.pages)
        for page in PdfReader(io.BytesIO(pdf)).pages:
            writer.add_page(page)
        writer.add_outline_item(f'{_t("part", lang)} {roman} — {title}', first)

    writer.add_metadata({
        '/Title': f'{company_name} — {_t("pack_title", lang)} {year}',
        '/Author': 'Carbonless',
        '/Subject': _t('standard', lang),
        '/Creator': 'Carbonless',
    })
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
