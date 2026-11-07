import { Factory, Zap, Truck } from 'lucide-react';

/* -- Hero copy (EN / TR) --
   Kept next to the hero components so the landing page file doesn't carry it.
   A language never shows text of the other. */
export const HERO_COPY = {
  en: {
    eyebrow: 'AI-POWERED CARBON ACCOUNTING',
    title: { line1: 'Measure. Report.', line2: 'Reduce.' },
    desc: 'Turn your emissions data into actionable insights and real reduction.',
    ctaPrimary: 'Start Your Assessment',
    ctaSecondary: 'Explore Platform',
    scroll: 'Scroll to explore',
    scopesLabel: 'Emission scopes',
    report: {
      label: 'Sample carbon emission report with illustrative values',
      title: 'Carbon Emission Report', period: 'Reporting Period', periodValue: 'Jan – Dec 2025',
      standard: 'ISO 14064-1', total: 'Total Emissions', delta: 'vs. previous year',
      scopes: ['Scope 1', 'Scope 2', 'Scope 3'], trend: 'Monthly Emissions (tCO₂e)',
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      sample: 'Sample report: illustrative values',
    },
    ui: {
      close: 'Close', opens: 'Opens details', earthOpen: 'Enlarge the Earth illustration', earthDialog: 'Earth illustration',
      meaning: 'What it means', includes: 'What is included', examples: 'Examples in a factory', why: 'Why it matters',
    },
    scopes: {
      s1: { title: 'Scope 1', sub: 'Direct Emissions' },
      s2: { title: 'Scope 2', sub: 'Purchased Energy' },
      s3: { title: 'Scope 3', sub: 'Value Chain' },
    },
  },
  tr: {
    eyebrow: 'YAPAY ZEKÂ DESTEKLİ KARBON MUHASEBESİ',
    title: { line1: 'Ölçün. Raporlayın.', line2: 'Azaltın.' },
    desc: 'Emisyon verilerinizi uygulanabilir içgörülere ve gerçek azaltıma dönüştürün.',
    ctaPrimary: 'Değerlendirmenizi Başlatın',
    ctaSecondary: 'Platformu Keşfedin',
    scroll: 'Keşfetmek için kaydırın',
    scopesLabel: 'Emisyon kapsamları',
    report: {
      label: 'Örnek değerlerle hazırlanmış karbon emisyon raporu örneği',
      title: 'Karbon Emisyon Raporu', period: 'Raporlama Dönemi', periodValue: 'Oca – Ara 2025',
      standard: 'ISO 14064-1', total: 'Toplam Emisyon', delta: 'önceki yıla göre',
      scopes: ['Kapsam 1', 'Kapsam 2', 'Kapsam 3'], trend: 'Aylık Emisyon (tCO₂e)',
      months: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
      sample: 'Örnek rapor: temsili değerler',
    },
    ui: {
      close: 'Kapat', opens: 'Ayrıntıları açar', earthOpen: 'Dünya görselini büyüt', earthDialog: 'Dünya görseli',
      meaning: 'Ne anlama gelir?', includes: 'Neler dahildir?', examples: 'Fabrikadan örnekler', why: 'Neden önemli?',
    },
    scopes: {
      s1: { title: 'Kapsam 1', sub: 'Doğrudan Emisyonlar' },
      s2: { title: 'Kapsam 2', sub: 'Satın Alınan Enerji' },
      s3: { title: 'Kapsam 3', sub: 'Değer Zinciri' },
    },
  },
};

/* The report preview's SAMPLE numbers: illustrative only, never customer data.
   The scopes sum to the total (22,194 + 11,942 + 8,544 = 42,680 tCO2e). */
export const SAMPLE_REPORT = {
  total: '42,680', deltaPct: '12.4',
  scopes: [{ pct: 52, t: '22,194' }, { pct: 28, t: '11,942' }, { pct: 20, t: '8,544' }],
  monthly: [62, 58, 64, 60, 57, 59, 55, 56, 52, 50, 53, 48],
};

/* The three Scope cards, top to bottom on the left then the right one. Positions live in hero.css. */
export const SCOPES = [
  { key: 's1', icon: Factory },
  { key: 's2', icon: Zap },
  { key: 's3', icon: Truck },
];

/* -- The stage --
   One SVG coordinate system, 860 x 580 units, centred on the Earth at (399, 290): the three Scope cards stand in the left
   ~175 units, the Earth and its rings in the middle, the tilted report preview in the right 224 units (x 635-859).
   hero.css sizes the stage from the same numbers (--u = one unit in px), so everything lines up at every size. */
export const STAGE = { w: 860, h: 580, cx: 399, cy: 290 };

/* globalnew-hero.webp is public/globalnew.png (1254 x 1254, opaque, with a transparency checkerboard painted into its
   pixels) with that checkerboard cut away to real transparency, saved as WebP (quality 92, lossless alpha; 603 KB, from a
   4.4 MB PNG; next.config serves images unoptimized, so this is the file visitors download). Its round body (the ring of
   trees) is centred on (629.5, 640.5) with radius 604.5; smoke, chimneys and turbine tips stand above it.
   The art is drawn at k = 0.3375 units per pixel and the body's centre is put on the stage centre: the body is 408 units
   across, the image 423.2 units wide (left 186.55, top 73.83): 25% larger than the first version (k = 0.27). The farthest
   opaque pixel from the centre is 656 art-px = 221 units, inside the tick scale (r 232). The Earth floats a few pixels;
   it does not turn. */
export const EARTH = { w: 1254, h: 1254, artCx: 629.5, artCy: 640.5, bodyR: 604.5, k: 0.3375 };

/* -- Orbital rings (all circles about the stage centre) --
   r radius in units, T seconds for one lap (negative = anticlockwise), nodes = [angle in degrees, size]. */
export const RINGS = [
  { id: 'a', r: 244, T: 120, nodes: [[-98, 0.8], [112, 0.5]] },
  { id: 'b', r: 257, T: -95, nodes: [[24, 0.8]] },
  { id: 'c', r: 270, T: 160, nodes: [[-52, 0.6], [140, 0.45]] },
];
export const TICK_R = 232;

/* Fixed anchor nodes where the Scope cards are tied to the ring (angle from +x, y down): all three on the left, in an arc. */
export const ANCHORS = {
  s1: { angle: 217, r: 244 },
  s2: { angle: 180, r: 244 },
  s3: { angle: 143, r: 244 },
};
