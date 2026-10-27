import { Zap, Car, ShoppingCart, Factory, Building2, Plane } from 'lucide-react';

/* -- Hero copy (EN / TR) --
   Kept next to the hero components so the landing page file doesn't carry it.
   The metric values below are ILLUSTRATIVE sample figures for the visual only —
   they are not computed by Carbonless and must never be presented as real
   results (hence the visible "Illustrative example" / "Örnek veri" label). */
export const HERO_COPY = {
  en: {
    kicker: 'Carbon Accounting, Made Simple.',
    title: { line1: 'Your Carbon Footprint.', line2: 'Under Control.' },
    desc: "Measure and manage your company's Scope 1, 2 and 3 emissions in one place.",
    ctaPrimary: 'Calculate Your Carbon Footprint',
    ctaPrimaryShort: 'Calculate Your Footprint', // shown below sm so the button stays on one line
    ctaSecondary: 'See How It Works',
    illustrative: 'Illustrative example',
    groupLabel: 'Illustrative example: sample emissions by category',
    earthLabel: 'Interactive Earth illustration. Activate to see it react.',
    openDetails: 'Open details',
    close: 'Close',
    sample: 'Illustrative sample figure, not a real calculation.',
    startCta: 'Calculate Your Footprint',
    learnFeatures: 'See all features',
    learnScopes: 'How the scopes work',
  },
  tr: {
    kicker: 'Karbon Muhasebesi, Basitleştirildi.',
    title: { line1: 'Karbon Ayak İziniz.', line2: 'Kontrol Altında.' },
    desc: 'Şirketinizin Kapsam 1, 2 ve 3 emisyonlarını tek yerden ölçün ve yönetin.',
    ctaPrimary: 'Karbon Ayak İzinizi Hesaplayın',
    ctaPrimaryShort: 'Ayak İzinizi Hesaplayın',
    ctaSecondary: 'Nasıl Çalışır?',
    illustrative: 'Örnek veri',
    groupLabel: 'Örnek veri: kategorilere göre örnek emisyonlar',
    earthLabel: 'Etkileşimli Dünya illüstrasyonu. Tepki vermesi için etkinleştirin.',
    openDetails: 'Ayrıntıları aç',
    close: 'Kapat',
    sample: 'Örnek rakamdır; gerçek bir hesaplama değildir.',
    startCta: 'Ayak İzinizi Hesaplayın',
    learnFeatures: 'Tüm özellikleri gör',
    learnScopes: 'Kapsamlar nasıl çalışır?',
  },
};

/* -- Category accents --
   Brand green for activity data that maps to the product's own green; the
   other four hues only tell the categories apart (as in the design reference)
   and are used on icons/bars/lines, never for body text. */
export const ACCENTS = {
  green:  { tint: '#DEFAE1', ink: '#1A7B2A', bar: '#2ABD41', ring: '#B2F2BB' },
  blue:   { tint: '#DBEAFE', ink: '#1D4ED8', bar: '#3B82F6', ring: '#BFDBFE' },
  orange: { tint: '#FFEDD5', ink: '#C2410C', bar: '#F97316', ring: '#FED7AA' },
  violet: { tint: '#EDE9FE', ink: '#6D28D9', bar: '#8B5CF6', ring: '#DDD6FE' },
  teal:   { tint: '#CCFBF1', ink: '#0F766E', bar: '#14B8A6', ring: '#99F6E4' },
};

/* -- The six categories --
   Desktop (lg+) layout lives in a 1860x678 design stage (83 units of headroom for
   the turbines, then the whole 580-unit Earth, so the complete globe is on screen): `card` positions the
   card, `node` the orbit icon (both in % of the stage) and `link` is the dashed
   connector path in stage units, measured from the top of the sphere area, i.e.
   OrbitPaths shifts them down by the 83-unit headroom. `order` is the clockwise
   position (0 = right-top) that staggers each node's ping / pop. `mobile` is the node position
   (in cqw of the Earth box) for the simplified ring used below lg.
   `detail` is what the card / node opens (see MetricDialog): no per-category
   public page exists, so it is a small dialog; `learn` picks the one real page
   that explains it further ('faq' = the Scope 1/2/3 FAQ entry on this page,
   'features' = the features page).
   The class strings are written out in full so Tailwind can see them. */
export const CATEGORIES = [
  { key: 'electricity', order: 5, icon: Zap, accent: 'green', value: '12.4', bars: [0.3, 0.42, 0.58, 0.78, 1],
    label: { en: 'Electricity', tr: 'Elektrik' }, learn: 'features',
    detail: {
      en: { tag: 'Scope 2 · Purchased electricity', body: 'Emissions from the electricity your company buys. Carbonless multiplies the kWh you enter by a published emission factor (DEFRA, IPCC, IEA or Turkish national factors), so every figure traces back to its source.' },
      tr: { tag: 'Kapsam 2 · Satın alınan elektrik', body: 'Şirketinizin satın aldığı elektrikten kaynaklanan emisyonlar. Carbonless, girdiğiniz kWh değerini yayımlanmış bir emisyon faktörüyle (DEFRA, IPCC, IEA veya Türkiye ulusal faktörleri) çarpar; böylece her rakam kaynağına kadar izlenebilir.' },
    },
    card: 'lg:left-[8.19%] lg:top-[12.24%] lg:w-[17.21%]',
    node: { x: 29.41, y: 24.04 }, mobile: { x: 18.3, y: 23.3 }, link: 'M473 44 C 503 44 510 54 524 70' },
  { key: 'travel', order: 4, icon: Car, accent: 'blue', value: '8.1', bars: [0.38, 0.34, 0.55, 0.7, 0.95],
    label: { en: 'Travel', tr: 'Seyahat' }, learn: 'features',
    detail: {
      en: { tag: 'Scope 3 · Business travel', body: 'Indirect emissions from business travel, such as flights and vehicle trips. They are counted under Scope 3, the emissions outside your own buildings and energy bills.' },
      tr: { tag: 'Kapsam 3 · İş seyahatleri', body: 'Uçuşlar ve araç yolculukları gibi iş seyahatlerinden kaynaklanan dolaylı emisyonlar. Kapsam 3 altında, yani kendi binalarınızın ve enerji faturalarınızın dışında sayılır.' },
    },
    card: 'lg:left-[5.46%] lg:top-[31.42%] lg:w-[16.99%]',
    node: { x: 26.45, y: 41.0 }, mobile: { x: 6.7, y: 43.4 }, link: 'M418 174 C 441 178 447 184 467 190' },
  { key: 'purchases', order: 3, icon: ShoppingCart, accent: 'green', value: '6.3', bars: [0.45, 0.52, 0.6, 0.82, 1],
    label: { en: 'Purchases', tr: 'Satın Alımlar' }, learn: 'features',
    detail: {
      en: { tag: 'Scope 3 · Purchased goods and services', body: 'Indirect emissions from the goods and services your company buys. Where no emission factor exists, Carbonless shows the amount as "not calculated" instead of guessing a number.' },
      tr: { tag: 'Kapsam 3 · Satın alınan mal ve hizmetler', body: 'Şirketinizin satın aldığı mal ve hizmetlerden kaynaklanan dolaylı emisyonlar. Emisyon faktörü bulunmayan tutarlar tahmin edilmez; "hesaplanmadı" olarak gösterilir.' },
    },
    card: 'lg:left-[5.03%] lg:top-[52.51%] lg:w-[17.42%]',
    node: { x: 26.45, y: 59.44 }, mobile: { x: 6.7, y: 66.6 }, link: 'M418 317 L 463 320' },
  { key: 'scope1', order: 0, icon: Factory, accent: 'orange', value: '18.6', bars: [0.3, 0.45, 0.6, 0.8, 1],
    label: { en: 'Scope 1', tr: 'Kapsam 1' }, learn: 'faq',
    detail: {
      en: { tag: 'Scope 1 · Direct emissions', body: 'Direct emissions from sources your company owns or controls, such as fuel burned in its facilities and vehicles.' },
      tr: { tag: 'Kapsam 1 · Doğrudan emisyonlar', body: 'Şirketinizin sahip olduğu veya kontrol ettiği kaynaklardan doğrudan salınan emisyonlar; örneğin tesislerinizde ve araçlarınızda yakılan yakıt.' },
    },
    card: 'lg:left-[74.6%] lg:top-[12.24%] lg:w-[17.21%]',
    node: { x: 70.59, y: 24.04 }, mobile: { x: 81.7, y: 23.3 }, link: 'M1387 44 C 1357 44 1350 54 1336 70' },
  { key: 'scope2', order: 1, icon: Building2, accent: 'violet', value: '14.2', bars: [0.36, 0.4, 0.58, 0.78, 0.96],
    label: { en: 'Scope 2', tr: 'Kapsam 2' }, learn: 'faq',
    detail: {
      en: { tag: 'Scope 2 · Purchased energy', body: 'Indirect emissions from the electricity or heat your company buys and uses.' },
      tr: { tag: 'Kapsam 2 · Satın alınan enerji', body: 'Şirketinizin satın aldığı ve kullandığı elektrik veya ısıdan kaynaklanan dolaylı emisyonlar.' },
    },
    card: 'lg:left-[77.55%] lg:top-[31.42%] lg:w-[16.99%]',
    node: { x: 73.55, y: 41.0 }, mobile: { x: 93.3, y: 43.4 }, link: 'M1442 174 C 1419 178 1413 184 1393 190' },
  { key: 'scope3', order: 2, icon: Plane, accent: 'teal', value: '26.7', bars: [0.32, 0.5, 0.66, 0.82, 1],
    label: { en: 'Scope 3', tr: 'Kapsam 3' }, learn: 'faq',
    detail: {
      en: { tag: 'Scope 3 · Value-chain emissions', body: 'All other indirect emissions across your value chain: your supply chain, business travel and the use of your products.' },
      tr: { tag: 'Kapsam 3 · Değer zinciri emisyonları', body: 'Değer zincirinizdeki diğer tüm dolaylı emisyonlar: tedarik zinciriniz, iş seyahatleri ve ürünlerinizin kullanımı.' },
    },
    card: 'lg:left-[77.55%] lg:top-[52.51%] lg:w-[17.42%]',
    node: { x: 73.55, y: 59.44 }, mobile: { x: 93.3, y: 66.6 }, link: 'M1442 317 L 1397 320' },
];

/* Dashed orbit arcs through each side's three nodes (stage units, 1860x678, 83
   units of headroom removed). The six nodes sit on one circle of radius ~445
   around the Earth's centre, ~64 units clear of the artwork's trees, turbines,
   panels and clouds; each arc is a cubic approximation of that circle. */
export const ORBIT_ARCS = [
  { d: 'M547 80 C 526 116 502 154 492 195', accent: 'green', rev: true },
  { d: 'M492 195 C 482 235 491 278 492 320', accent: 'blue', rev: true },
  { d: 'M1313 80 C 1334 116 1358 154 1368 195', accent: 'orange' },
  { d: 'M1368 195 C 1378 235 1369 278 1368 320', accent: 'violet' },
];
