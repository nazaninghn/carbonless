'use client';

import {
  LayoutDashboard, ClipboardList, Bot, Leaf, TrendingDown, FileText, BarChart2,
  ClipboardCheck, Settings, Factory, Zap, Truck, ArrowRight, MessageCircle,
} from 'lucide-react';

// Mirrors DashboardSidebar's NAV_ITEMS keys so "Go to" buttons land on the
// right tab, but carries a longer description — a field the sidebar has no
// use for and shouldn't be bloated with.
const SECTIONS = [
  {
    key: 'dashboard', icon: LayoutDashboard,
    title: { tr: 'Kontrol Paneli', en: 'Dashboard' },
    desc: {
      tr: 'Toplam emisyonlarınızı, yıllık trendi ve hedeflere ilerlemenizi tek bakışta görün.',
      en: 'See your total emissions, yearly trend, and progress toward targets at a glance.',
    },
  },
  {
    key: 'questionnaire', icon: ClipboardList,
    title: { tr: 'Karbon Envanteri', en: 'Carbon Inventory' },
    desc: {
      tr: 'Adım adım anketi tamamlayarak Kapsam 1, 2 ve 3 emisyonlarınızı ISO 14064-1 standardına göre kaydedin.',
      en: 'Complete the step-by-step questionnaire to record your Scope 1, 2 & 3 emissions to the ISO 14064-1 standard.',
    },
  },
  {
    key: 'ai_carbon', icon: Bot,
    title: { tr: 'AI Sohbet', en: 'AI Chat' },
    desc: {
      tr: 'Verilerinizi kendi cümlelerinizle anlatın — CarbonIQ anketi sizin yerinize doldurur ve sorularınızı yanıtlar.',
      en: 'Describe your data in plain language — CarbonIQ fills out the questionnaire for you and answers your questions.',
    },
  },
  {
    key: 'emissions', icon: Leaf,
    title: { tr: 'Emisyon Yönetimi', en: 'Emissions' },
    desc: {
      tr: 'Tüm emisyon kayıtlarınızı görüntüleyin, düzenleyin ve yeni veri girişleri ekleyin.',
      en: 'View, edit, and add new entries to all of your recorded emissions data.',
    },
  },
  {
    key: 'reduction', icon: TrendingDown,
    title: { tr: 'Azaltma Hedefleri', en: 'Targets' },
    desc: {
      tr: 'Azaltma hedefleri belirleyin ve gerçek verilerinize göre ilerlemenizi takip edin.',
      en: 'Set reduction targets and track your progress against them using real data.',
    },
  },
  {
    key: 'reporting', icon: FileText,
    title: { tr: 'Raporlama', en: 'Reports' },
    desc: {
      tr: 'Denetime hazır, ISO 14064-1 uyumlu PDF raporunuzu saniyeler içinde oluşturun.',
      en: 'Generate your audit-ready, ISO 14064-1 compliant PDF report in seconds.',
    },
  },
  {
    key: 'benchmark', icon: BarChart2,
    title: { tr: 'Benchmark', en: 'Benchmark' },
    desc: {
      tr: 'Emisyonlarınızı, anonim ve GDPR uyumlu verilerle aynı sektördeki şirketlerle karşılaştırın.',
      en: 'Compare your emissions against companies in your sector using anonymous, GDPR-compliant data.',
    },
  },
  {
    key: 'review', icon: ClipboardCheck,
    title: { tr: 'Onay Bekleyenler', en: 'Review' },
    desc: {
      tr: 'Ekip üyelerinin gönderdiği özel talepleri ve veri girişlerini onaylayın veya reddedin.',
      en: 'Approve or reject custom requests and data entries submitted by your team.',
    },
  },
  {
    key: 'settings', icon: Settings,
    title: { tr: 'Ayarlar', en: 'Settings' },
    desc: {
      tr: 'Şirket bilgilerinizi, kullanıcı rollerini ve bildirim tercihlerinizi yönetin.',
      en: 'Manage your company details, user roles, and notification preferences.',
    },
  },
];

const STEPS = [
  {
    num: '1',
    title: { tr: 'Verinizi anlatın', en: 'Tell the AI' },
    desc: {
      tr: 'Enerji, seyahat ya da satın alımlarınızı sade bir dille anlatın — tablo yok.',
      en: 'Describe your energy use, travel, or purchases in plain language — no spreadsheets.',
    },
  },
  {
    num: '2',
    title: { tr: 'AI hesaplar', en: 'AI calculates' },
    desc: {
      tr: 'CarbonIQ, verinizi 188+ emisyon faktörüyle anında eşleştirir.',
      en: 'CarbonIQ matches your data against 188+ emission factors instantly.',
    },
  },
  {
    num: '3',
    title: { tr: 'Raporunuzu alın', en: 'Get your report' },
    desc: {
      tr: 'Saniyeler içinde ISO 14064-1 uyumlu, denetime hazır PDF raporu.',
      en: 'An ISO 14064-1 compliant, audit-ready PDF report in seconds.',
    },
  },
  {
    num: '4',
    title: { tr: 'Hedef belirleyin', en: 'Track & reduce' },
    desc: {
      tr: 'Hedefler koyun, ilerlemenizi izleyin, ayak izinizi zamanla küçültün.',
      en: 'Set targets, track progress, and watch your footprint shrink over time.',
    },
  },
];

const SCOPES = [
  {
    icon: Factory, num: '1',
    title: { tr: 'Doğrudan emisyonlar', en: 'Direct emissions' },
    desc: { tr: 'Kendi tesisleriniz ve araçlarınızdan kaynaklanan emisyonlar.', en: 'From facilities and vehicles you own or control.' },
  },
  {
    icon: Zap, num: '2',
    title: { tr: 'Satın alınan enerji', en: 'Purchased energy' },
    desc: { tr: 'Satın aldığınız elektrik, ısı veya buhardan kaynaklanan emisyonlar.', en: 'From the electricity, heat, or steam you buy.' },
  },
  {
    icon: Truck, num: '3',
    title: { tr: 'Tedarik zinciri', en: 'Supply chain & travel' },
    desc: { tr: 'Tedarik zinciriniz, iş seyahatleri ve ürün kullanımından kaynaklanan dolaylı emisyonlar.', en: 'Indirect emissions across your supply chain, business travel, and product use.' },
  },
];

const FAQS = [
  {
    q: { tr: 'Hangi bölümden başlamalıyım?', en: 'Which section should I start with?' },
    a: {
      tr: '"Karbon Envanteri" veya "AI Sohbet" ile başlayın. İkisi de aynı anketi doldurur — Envanter formlarla, AI Sohbet ise doğal dille çalışır.',
      en: 'Start with "Carbon Inventory" or "AI Chat" — both fill out the same questionnaire, just with forms vs. plain-language conversation.',
    },
  },
  {
    q: { tr: 'Tam verim yoksa ne olur?', en: "What if I don't have exact data yet?" },
    a: {
      tr: 'Tahmini değer girebilirsiniz; anket ilerledikçe kayıtlarınızı düzenleyebilir ve tekrar hesaplayabilirsiniz.',
      en: 'You can enter an estimate — you can edit any answer later and the numbers recalculate automatically.',
    },
  },
  {
    q: { tr: 'Cevaplarımı sonra değiştirebilir miyim?', en: 'Can I change my answers later?' },
    a: {
      tr: 'Evet. "Onay Bekleyenler" veya doğrudan Envanter üzerinden herhangi bir cevabı düzenleyebilirsiniz.',
      en: 'Yes — you can edit any answer directly from the Inventory or via the Review tab.',
    },
  },
  {
    q: { tr: 'Raporum ne zaman hazır olur?', en: 'When is my report ready?' },
    a: {
      tr: 'Kapsam 1, 2 ve 3 anketini tamamladığınızda "Raporlama" sekmesinden PDF raporunuzu hemen indirebilirsiniz.',
      en: 'As soon as you finish the Scope 1, 2 & 3 questionnaire, download your PDF from the "Reports" tab immediately.',
    },
  },
];

export default function HowItWorksTab({ language, setActiveTab }) {
  const tr = language === 'tr';

  return (
    <div className="space-y-8 sm:space-y-10">

      {/* Header */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#072C0E]/35">
          {tr ? 'Rehber' : 'Guide'}
        </p>
        <h1 className="mt-0.5 text-[20px] font-bold text-[#072C0E] sm:text-[24px]">
          {tr ? 'Carbonless Nasıl Çalışır?' : 'How Carbonless Works'}
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-[1.7] text-[#072C0E]/55">
          {tr
            ? 'Carbonless, karbon ayak izinizi AI ile hesaplayan ve ISO 14064-1 uyumlu raporlar oluşturan bir platformdur. Aşağıda dört adımda nasıl çalıştığını ve her bölümün ne işe yaradığını bulabilirsiniz.'
            : "Carbonless calculates your carbon footprint with AI and generates ISO 14064-1 compliant reports. Here's how it works in four steps, and what each section of the dashboard does."}
        </p>
      </div>

      {/* 4-step flow */}
      <div className="rounded-2xl border border-[#DEFAE1] bg-white p-5 sm:p-7">
        <h2 className="text-[13px] font-bold text-[#072C0E] sm:text-sm">
          {tr ? 'Dört adımda nasıl çalışır' : 'How it works, in four steps'}
        </h2>
        <div className="relative mt-6 grid gap-8 sm:grid-cols-4 sm:gap-4">
          <div aria-hidden className="hidden sm:block absolute left-[12.5%] right-[12.5%] top-6 h-px bg-[#DEFAE1]" />
          {STEPS.map((step) => (
            <div key={step.num} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-[#2ABD41] text-[15px] font-bold text-[#2ABD41] shadow-sm">
                {step.num}
              </div>
              <h3 className="mt-3 text-[13px] font-bold text-[#072C0E]">{step.title[language] || step.title.en}</h3>
              <p className="mt-1.5 text-[12px] leading-[1.6] text-[#072C0E]/55 max-w-[200px]">
                {step.desc[language] || step.desc.en}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Scope 1/2/3 explainer */}
      <div className="rounded-2xl border border-[#DEFAE1] bg-white p-5 sm:p-7">
        <h2 className="text-[13px] font-bold text-[#072C0E] sm:text-sm">
          {tr ? 'Kapsam 1, 2 ve 3 nedir?' : 'What are Scope 1, 2 & 3?'}
        </h2>
        <p className="mt-1.5 text-[12px] leading-[1.6] text-[#072C0E]/50">
          {tr
            ? 'Anket, GHG Protokolü\'nün üç kapsamına göre yapılandırılmıştır.'
            : "The questionnaire is structured around the GHG Protocol's three scopes."}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {SCOPES.map((scope) => (
            <div key={scope.num} className="rounded-xl border border-[#F1FCF2] bg-[#F9FFF4] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#2ABD41]/20 shadow-sm">
                <scope.icon className="h-[18px] w-[18px] text-[#2ABD41]" strokeWidth={1.8} />
              </div>
              <span className="mt-3 inline-flex h-6 items-center rounded-full bg-[#2ABD41]/10 px-2.5 text-[11px] font-bold text-[#2ABD41]">
                {tr ? `Kapsam ${scope.num}` : `Scope ${scope.num}`}
              </span>
              <h3 className="mt-2 text-[13px] font-bold text-[#072C0E]">{scope.title[language] || scope.title.en}</h3>
              <p className="mt-1 text-[12px] leading-[1.6] text-[#072C0E]/55">{scope.desc[language] || scope.desc.en}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section-by-section guide — doubles as quick navigation */}
      <div>
        <h2 className="px-1 text-[13px] font-bold text-[#072C0E] sm:text-sm">
          {tr ? 'Panelde neler var?' : "What's in the dashboard"}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveTab?.(section.key)}
              className="group flex flex-col items-start rounded-2xl border border-[#DEFAE1] bg-white p-4 text-left transition hover:border-[#2ABD41]/40 hover:shadow-md hover:shadow-[#2ABD41]/5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1FCF2]">
                <section.icon className="h-[16px] w-[16px] text-[#175022]" />
              </div>
              <h3 className="mt-3 text-[13px] font-bold text-[#072C0E]">
                {section.title[language] || section.title.en}
              </h3>
              <p className="mt-1 text-[12px] leading-[1.6] text-[#072C0E]/55">
                {section.desc[language] || section.desc.en}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#2ABD41] opacity-0 transition group-hover:opacity-100">
                {tr ? 'Git' : 'Go to section'}
                <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-2xl border border-[#DEFAE1] bg-white p-5 sm:p-7">
        <h2 className="text-[13px] font-bold text-[#072C0E] sm:text-sm">
          {tr ? 'Sık sorulan sorular' : 'Frequently asked questions'}
        </h2>
        <div className="mt-4 space-y-2.5">
          {FAQS.map((item, i) => (
            <details key={i} className="group rounded-xl border border-[#DEFAE1] bg-[#F9FFF4] px-4 open:bg-white open:shadow-sm transition-colors">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-[13px] font-bold text-[#072C0E] [&::-webkit-details-marker]:hidden">
                {item.q[language] || item.q.en}
                <svg className="h-3.5 w-3.5 shrink-0 text-[#2ABD41] transition-transform duration-300 group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </summary>
              <p className="pb-3.5 text-[12px] leading-[1.7] text-[#072C0E]/60">
                {item.a[language] || item.a.en}
              </p>
            </details>
          ))}
        </div>
      </div>

      {/* Bottom CTA — nudge toward the actual next action */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#2ABD41]/20 bg-[#2ABD41]/5 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h3 className="text-[14px] font-bold text-[#072C0E]">
            {tr ? 'Başlamaya hazır mısınız?' : 'Ready to get started?'}
          </h3>
          <p className="mt-1 text-[12px] text-[#072C0E]/55">
            {tr ? 'AI ile konuşarak veya formu doldurarak envanterinize başlayın.' : 'Start your inventory by chatting with the AI or filling out the form.'}
          </p>
        </div>
        <button
          onClick={() => setActiveTab?.('ai_carbon')}
          className="flex shrink-0 items-center gap-2 rounded-full bg-[#2ABD41] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#1D9C31]"
        >
          <MessageCircle className="h-4 w-4" />
          {tr ? "AI ile Başla" : 'Start with AI'}
        </button>
      </div>
    </div>
  );
}
