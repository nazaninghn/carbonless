'use client';

import {
  Package, Building2, Flame, Truck, Trash2, Zap, Home, Users, Briefcase,
  Ship, Factory, Lightbulb, Recycle, Store, Landmark,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// ScopeFlowDiagram — animated GHG Protocol Scope 1/2/3 explainer, shown once
// on the dashboard's first-run welcome state. Mirrors the standard five-arrow
// layout (upstream Scope 3 in two groups, Scope 2, Scope 1, downstream
// Scope 3) with drifting gas "smoke" above it, so a brand-new user gets the
// mental model for what they're about to measure before they ever see a form.
// ─────────────────────────────────────────────────────────────────────────────

const GASES = ['CO2', 'CH4', 'N2O', 'HFCs', 'PFCs', 'SF6'];

function GasCloud({ gas, delay }) {
  const label = gas === 'CO2'
    ? <>CO<sub className="text-[8px]">2</sub></>
    : gas === 'N2O'
    ? <>N<sub className="text-[8px]">2</sub>O</>
    : gas;
  return (
    <div
      className="flex h-9 min-w-[52px] items-center justify-center rounded-full bg-[#072C0E] px-3 text-[11px] font-bold italic text-white shadow-sm"
      style={{ animation: 'scopeSmokeDrift 4.5s ease-in-out infinite', animationDelay: `${delay}ms` }}
    >
      {label}
    </div>
  );
}

const TONE_STYLES = {
  light: { bg: '#DEFAE1', text: '#175022' },
  mid: { bg: '#2ABD41', text: '#FFFFFF' },
  dark: { bg: '#175022', text: '#FFFFFF' },
};

function ColumnArrow({ label, sub, tone, items, delay }) {
  const { bg, text } = TONE_STYLES[tone];
  return (
    <div className="dash-fade-up flex flex-col items-center" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-[11px] font-bold text-[#072C0E]">{label}</p>
      <p className="text-[8px] font-bold uppercase tracking-wide text-[#072C0E]/40">{sub}</p>
      <div
        className="relative mt-1.5 flex flex-col-reverse items-center gap-2.5 px-2 pb-3 pt-5"
        style={{
          background: bg,
          clipPath: 'polygon(50% 0%, 100% 14%, 78% 14%, 78% 100%, 22% 100%, 22% 14%, 0% 14%)',
        }}
      >
        {items.map(({ icon: Icon, en, tr: trLabel }, i) => (
          <div key={i} className="flex w-[76px] flex-col items-center gap-1 text-center">
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: text }} />
            <p className="text-[8.5px] font-medium leading-[1.15]" style={{ color: text }}>
              {trLabel ?? en}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScopeFlowDiagram({ tr = false }) {
  const columns = [
    {
      id: 'scope3-up-a',
      label: tr ? 'Kapsam 3' : 'Scope 3',
      sub: tr ? 'DOLAYLI' : 'INDIRECT',
      tone: 'light',
      items: [
        { icon: Package, en: 'Purchased goods & services', tr: 'Satın alınan mal ve hizmetler' },
        { icon: Building2, en: 'Capital goods', tr: 'Sermaye malları' },
        { icon: Flame, en: 'Fuel & energy activities', tr: 'Yakıt ve enerji faaliyetleri' },
        { icon: Truck, en: 'Transport & distribution', tr: 'Taşıma ve dağıtım' },
        { icon: Trash2, en: 'Waste generated', tr: 'Oluşan atık' },
      ],
    },
    {
      id: 'scope2',
      label: 'Scope 2',
      sub: tr ? 'DOLAYLI' : 'INDIRECT',
      tone: 'mid',
      items: [
        { icon: Zap, en: 'Purchased electricity, steam, heating & cooling', tr: 'Satın alınan elektrik, buhar, ısıtma ve soğutma' },
      ],
    },
    {
      id: 'scope3-up-b',
      label: tr ? 'Kapsam 3' : 'Scope 3',
      sub: tr ? 'DOLAYLI' : 'INDIRECT',
      tone: 'light',
      items: [
        { icon: Home, en: 'Leased assets', tr: 'Kiralanan varlıklar' },
        { icon: Users, en: 'Employee commuting', tr: 'Çalışan ulaşımı' },
        { icon: Briefcase, en: 'Business travel', tr: 'İş seyahati' },
      ],
    },
    {
      id: 'scope1',
      label: 'Scope 1',
      sub: tr ? 'DOĞRUDAN' : 'DIRECT',
      tone: 'dark',
      items: [
        { icon: Building2, en: 'Company facilities', tr: 'Şirket tesisleri' },
        { icon: Truck, en: 'Company vehicles', tr: 'Şirket araçları' },
      ],
    },
    {
      id: 'scope3-down',
      label: tr ? 'Kapsam 3' : 'Scope 3',
      sub: tr ? 'DOLAYLI' : 'INDIRECT',
      tone: 'light',
      items: [
        { icon: Ship, en: 'Transport & distribution', tr: 'Taşıma ve dağıtım' },
        { icon: Factory, en: 'Processing of sold products', tr: 'Satılan ürünlerin işlenmesi' },
        { icon: Lightbulb, en: 'Use of sold products', tr: 'Satılan ürünlerin kullanımı' },
        { icon: Recycle, en: 'End-of-life treatment', tr: 'Ömür sonu işleme' },
        { icon: Home, en: 'Leased assets', tr: 'Kiralanan varlıklar' },
        { icon: Store, en: 'Franchises', tr: 'Franchise\'lar' },
        { icon: Landmark, en: 'Investments', tr: 'Yatırımlar' },
      ],
    },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <style>{`
        @keyframes scopeSmokeDrift {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.9; }
          50% { transform: translateY(-7px) scale(1.04); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .scope-diagram-root * { animation: none !important; }
        }
      `}</style>
      <div className="scope-diagram-root mx-auto min-w-[620px] max-w-3xl px-2">
        {/* Gas clouds */}
        <div className="mb-3 flex items-center justify-center gap-2.5">
          {GASES.map((g, i) => <GasCloud key={g} gas={g} delay={i * 220} />)}
        </div>

        {/* Five-column scope flow */}
        <div className="flex items-end justify-center gap-2.5">
          {columns.map((col, i) => <ColumnArrow key={col.id} {...col} delay={60 + i * 60} />)}
        </div>

        {/* Bottom band */}
        <div className="dash-fade-up mt-3 flex overflow-hidden rounded-full text-[10px] font-bold text-white" style={{ animationDelay: '420ms' }}>
          <div className="flex-1 bg-[#8BEA99] py-1.5 text-center text-[#175022]">
            {tr ? 'Yukarı Akış Faaliyetleri' : 'Upstream activities'}
          </div>
          <div className="flex-[0.7] bg-[#175022] py-1.5 text-center">
            {tr ? 'Raporlayan Şirket' : 'Reporting company'}
          </div>
          <div className="flex-1 bg-[#2ABD41] py-1.5 text-center">
            {tr ? 'Aşağı Akış Faaliyetleri' : 'Downstream activities'}
          </div>
        </div>
      </div>
    </div>
  );
}
