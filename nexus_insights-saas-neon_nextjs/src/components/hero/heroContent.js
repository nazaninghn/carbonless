import { Factory, Zap, Truck } from 'lucide-react';

/* -- Hero copy (EN / TR) --
   Kept next to the hero components so the landing page file doesn't carry it.
   A language never shows text of the other. */
export const HERO_COPY = {
  en: {
    eyebrow: 'MEASURE TODAY. A CLEANER TOMORROW.',
    title: { line1: 'Your Carbon Footprint.', line2: 'Under Control.' },
    desc: ['AI-powered carbon accounting for factories and industrial businesses.', 'Turn complex data into clear insights and take real action.'],
    ctaPrimary: 'Calculate Your Carbon Footprint',
    ctaPrimaryShort: 'Calculate Your Footprint', // shown below sm so the button stays on one line
    ctaSecondary: 'See How It Works',
    scroll: 'Scroll to explore',
    scopesLabel: 'Emission scopes',
    ui: {
      close: 'Close', opens: 'Opens details', earthOpen: 'Enlarge the Earth illustration', earthDialog: 'Earth illustration',
      meaning: 'What it means', includes: 'What is included', examples: 'Examples in a factory', why: 'Why it matters',
    },
    scopes: {
      s1: { title: 'Scope 1', sub: 'Direct Emissions from Operations' },
      s2: { title: 'Scope 2', sub: 'Indirect Emissions from Purchased Energy' },
      s3: { title: 'Scope 3', sub: 'Value Chain Emissions' },
    },
  },
  tr: {
    eyebrow: 'BUGÜN ÖLÇÜN. YARIN DAHA TEMİZ.',
    title: { line1: 'Karbon Ayak İziniz.', line2: 'Kontrol Altında.' },
    desc: ['Fabrikalar ve sanayi işletmeleri için yapay zekâ destekli karbon muhasebesi.', 'Karmaşık verileri net içgörülere dönüştürün ve gerçek aksiyon alın.'],
    ctaPrimary: 'Karbon Ayak İzinizi Hesaplayın',
    ctaPrimaryShort: 'Ayak İzinizi Hesaplayın',
    ctaSecondary: 'Nasıl Çalışır?',
    scroll: 'Keşfetmek için kaydırın',
    scopesLabel: 'Emisyon kapsamları',
    ui: {
      close: 'Kapat', opens: 'Ayrıntıları açar', earthOpen: 'Dünya görselini büyüt', earthDialog: 'Dünya görseli',
      meaning: 'Ne anlama gelir?', includes: 'Neler dahildir?', examples: 'Fabrikadan örnekler', why: 'Neden önemli?',
    },
    scopes: {
      s1: { title: 'Kapsam 1', sub: 'Operasyonlardan Doğrudan Emisyonlar' },
      s2: { title: 'Kapsam 2', sub: 'Satın Alınan Enerjiden Dolaylı Emisyonlar' },
      s3: { title: 'Kapsam 3', sub: 'Değer Zinciri Emisyonları' },
    },
  },
};

/* The three Scope cards, top to bottom on the left then the right one. Positions live in hero.css. */
export const SCOPES = [
  { key: 's1', icon: Factory },
  { key: 's2', icon: Zap },
  { key: 's3', icon: Truck },
];

/* -- The stage --
   One SVG coordinate system, 1200 x 640 units, centred on the Earth at (600, 320). hero.css sizes the stage
   from the same numbers (--u = one unit in px), so the rings, the cards and the Earth line up at every size. */
export const STAGE = { w: 1200, h: 640, cx: 600, cy: 320 };

/* globalnew-hero.webp is public/globalnew.png (1254 x 1254, opaque, with a transparency checkerboard painted into its
   pixels) with that checkerboard cut away to real transparency, saved as WebP (quality 92, lossless alpha; 603 KB, from a
   4.4 MB PNG; next.config serves images unoptimized, so this is the file visitors download). Its round body (the ring of
   trees) is centred on (629.5, 640.5) with radius 604.5; smoke, chimneys and turbine tips stand above it.
   The art is drawn at k = 0.38 units per pixel and the body's centre is put on the stage centre, so the rings circle the
   globe itself rather than the smoke. The Earth turns about that centre, so the farthest opaque pixel from it matters:
   626 art-px for 99.9% of the art, 656 at most (smoke and turbine tips) = 238 / 249 units, inside the tick scale
   (r 258, spanning 253-263). The body is 459 units across. */
export const EARTH = { w: 1254, h: 1254, artCx: 629.5, artCy: 640.5, bodyR: 604.5, k: 0.38 };

/* -- Orbital rings (all circles about the stage centre) --
   r radius in units, T seconds for one lap (negative = anticlockwise), nodes = [angle in degrees, size]. */
export const RINGS = [
  { id: 'a', r: 272, T: 110, nodes: [[-98, 1], [112, 0.6]] },
  { id: 'b', r: 292, T: -85, nodes: [[24, 1]] },
  { id: 'c', r: 308, T: 150, nodes: [[-52, 0.75], [140, 0.55]] },
];
export const TICK_R = 258;

/* Fixed anchor nodes where the Scope cards are tied to the rings (angle from +x, y down). */
export const ANCHORS = {
  s1: { angle: 217, r: 272 },
  s2: { angle: -9, r: 272 },
  s3: { angle: 151, r: 272 },
};

/* A few restrained leaves, in units of the stage; x/y are the leaf's centre, s its size, d/t its float cycle. */
export const LEAVES = [
  { x: 262, y: 338, s: 34, rot: 18, d: 9, t: 0 },
  { x: 905, y: 520, s: 30, rot: -32, d: 11, t: 2.5 },
  { x: 236, y: 590, s: 26, rot: 40, d: 10, t: 4.5 },
  { x: 930, y: 118, s: 18, rot: -12, d: 12, t: 1.2 },
];
