'use client';

import { useMemo } from 'react';
import { BarChart2, Users, TrendingDown, Info, Lock } from 'lucide-react';

// ─── Static sector benchmark data (NACE-based, anonymized) ────────────────────
// In production this would come from an API endpoint with real anonymized data.
const SECTOR_BENCHMARKS = {
  default: { avg: 510, p25: 280, p75: 820, label: { tr: 'Genel Sektör', en: 'General Sector' }, count: 43 },
  A: { avg: 680, p25: 340, p75: 1200, label: { tr: 'Tarım', en: 'Agriculture' }, count: 18 },
  C: { avg: 920, p25: 450, p75: 1800, label: { tr: 'İmalat', en: 'Manufacturing' }, count: 67 },
  D: { avg: 1450, p25: 700, p75: 2800, label: { tr: 'Enerji', en: 'Energy' }, count: 12 },
  F: { avg: 380, p25: 180, p75: 720, label: { tr: 'İnşaat', en: 'Construction' }, count: 34 },
  G: { avg: 290, p25: 140, p75: 580, label: { tr: 'Ticaret', en: 'Trade' }, count: 89 },
  H: { avg: 740, p25: 360, p75: 1480, label: { tr: 'Ulaştırma', en: 'Transport' }, count: 28 },
  I: { avg: 210, p25: 90, p75: 420, label: { tr: 'Konaklama', en: 'Hospitality' }, count: 45 },
  J: { avg: 160, p25: 70, p75: 320, label: { tr: 'Bilgi/İletişim', en: 'IT & Telecom' }, count: 56 },
  K: { avg: 130, p25: 55, p75: 260, label: { tr: 'Finans', en: 'Finance' }, count: 71 },
  M: { avg: 120, p25: 50, p75: 240, label: { tr: 'Profesyonel', en: 'Professional' }, count: 63 },
  N: { avg: 200, p25: 85, p75: 400, label: { tr: 'Yönetim', en: 'Administration' }, count: 37 },
  P: { avg: 180, p25: 75, p75: 360, label: { tr: 'Eğitim', en: 'Education' }, count: 29 },
  Q: { avg: 240, p25: 100, p75: 480, label: { tr: 'Sağlık', en: 'Healthcare' }, count: 42 },
};

const EMPLOYEE_BANDS = [
  { key: '1-50',      tr: '1–50 çalışan',    en: '1–50 employees'  },
  { key: '51-250',    tr: '51–250 çalışan',   en: '51–250 employees'},
  { key: '251-1000',  tr: '251–1000 çalışan', en: '251–1000 employees'},
  { key: '1001-5000', tr: '1000+ çalışan',    en: '1000+ employees' },
];

// ─── Benchmark bar (industry position visualization) ───────────────────────────
function BenchmarkBar({ yourValue, avg, p25, p75, tr }) {
  if (!yourValue || yourValue === 0) return (
    <div className="flex h-10 items-center justify-center rounded-xl bg-[#072C0E]/4">
      <p className="text-[11px] text-[#072C0E]/40">{tr ? 'Emisyon verisi girilmesi gerekiyor' : 'Enter emission data first'}</p>
    </div>
  );

  const max = Math.max(avg * 2, yourValue * 1.2, p75 * 1.1);
  const yourPct  = Math.min((yourValue / max) * 100, 98);
  const p25Pct   = (p25 / max) * 100;
  const avgPct   = (avg  / max) * 100;
  const p75Pct   = (p75  / max) * 100;

  const position =
    yourValue < p25 ? (tr ? 'Çok iyi' : 'Excellent')    :
    yourValue < avg ? (tr ? 'Ortalamanın altında' : 'Below average') :
    yourValue < p75 ? (tr ? 'Ortalamanın üstünde' : 'Above average') :
                      (tr ? 'Yüksek emisyon' : 'High emissions');

  const posColor =
    yourValue < p25 ? 'text-[#175022]' :
    yourValue < avg ? 'text-[#2ABD41]' :
    yourValue < p75 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="space-y-3">
      {/* Bar track */}
      <div className="relative h-6 rounded-full bg-[#072C0E]/6">
        {/* Low zone */}
        <div className="absolute left-0 top-0 h-full rounded-l-full bg-[#DEFAE1]" style={{ width: `${p25Pct}%` }} />
        {/* Mid zone */}
        <div className="absolute top-0 h-full bg-[#8BEA99]/35" style={{ left: `${p25Pct}%`, width: `${avgPct - p25Pct}%` }} />
        {/* High zone */}
        <div className="absolute top-0 h-full bg-amber-100" style={{ left: `${avgPct}%`, width: `${p75Pct - avgPct}%` }} />
        {/* Very high zone */}
        <div className="absolute top-0 h-full rounded-r-full bg-red-50" style={{ left: `${p75Pct}%`, right: '0' }} />

        {/* Sector average marker */}
        <div className="absolute top-0 h-full w-0.5 bg-amber-500/70" style={{ left: `${avgPct}%` }}>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-amber-600">
            {tr ? 'Ort.' : 'Avg'}·{avg}
          </span>
        </div>

        {/* Your position */}
        <div
          className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[#072C0E]"
          style={{ left: `${yourPct}%` }}
        >
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-[#072C0E]">
            {tr ? 'Siz' : 'You'}·{Math.round(yourValue)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-[#072C0E]/40">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#DEFAE1] ring-1 ring-[#072C0E]/10" />{tr ? 'İyi' : 'Good'}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#8BEA99]/35 ring-1 ring-[#072C0E]/10" />{tr ? 'Orta' : 'Medium'}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-100 ring-1 ring-[#072C0E]/10" />{tr ? 'Yüksek' : 'High'}</span>
        <span className={`ml-auto font-bold ${posColor}`}>{position}</span>
      </div>
    </div>
  );
}

// ─── Opportunity row ──────────────────────────────────────────────────────────
function OpportunityRow({ rank, title, desc, saving, locked, tr }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${locked ? 'border-[#072C0E]/6 bg-[#072C0E]/2 opacity-60' : 'border-[#072C0E]/10 bg-white'}`}>
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        rank === 1 ? 'bg-[#2ABD41] text-white' :
        rank === 2 ? 'bg-[#8BEA99] text-white' :
        'bg-[#072C0E]/8 text-[#072C0E]/50'
      }`}>
        {locked ? <Lock className="h-3 w-3" /> : rank}
      </div>
      <div className="flex-1">
        <p className={`text-[12px] font-semibold ${locked ? 'text-[#072C0E]/40' : 'text-[#072C0E]'}`}>{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[#072C0E]/45">{desc}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-[12px] font-bold ${locked ? 'text-[#072C0E]/30' : 'text-[#175022]'}`}>{saving}</p>
        <p className="text-[10px] text-[#072C0E]/35">{tr ? 'tCO₂e tasarruf' : 'tCO₂e saving'}</p>
      </div>
    </div>
  );
}

// ─── Main BenchmarkTab component ──────────────────────────────────────────────
export default function BenchmarkTab({ language, summary, questionnaireProfile }) {
  const tr = language === 'tr';
  const totalTonne = summary?.total_tonne || 0;

  // Derive sector from questionnaire profile nace_code
  const naceCode   = questionnaireProfile?.nace_code || '';
  const naceSector = naceCode ? naceCode[0] : '';
  const benchmark  = SECTOR_BENCHMARKS[naceSector] || SECTOR_BENCHMARKS.default;
  const empBand    = EMPLOYEE_BANDS.find(b => b.key === (questionnaireProfile?.employee_band || '1-50')) || EMPLOYEE_BANDS[0];

  const pctVsAvg = benchmark.avg > 0
    ? Math.round(((benchmark.avg - totalTonne) / benchmark.avg) * 100)
    : 0;

  // Opportunity list (always 3, last one locked for free users)
  const opportunities = useMemo(() => [
    {
      rank: 1,
      title: tr ? 'Elektrik verimliliği' : 'Electricity efficiency',
      desc:  tr ? 'LED aydınlatma + akıllı sensörler' : 'LED lighting + smart sensors',
      saving: `−${Math.round(totalTonne * 0.08)} `,
      locked: false,
    },
    {
      rank: 2,
      title: tr ? 'Araç filosu elektrifikasyonu' : 'Fleet electrification',
      desc:  tr ? 'Dizel araçları EV ile değiştirin' : 'Replace diesel vehicles with EVs',
      saving: `−${Math.round(totalTonne * 0.15)} `,
      locked: false,
    },
    {
      rank: 3,
      title: tr ? 'Yenilenebilir enerji sözleşmesi' : 'Renewable energy contract',
      desc:  tr ? 'PPA veya yeşil tarife geçişi' : 'PPA or green tariff switch',
      saving: `−${Math.round(totalTonne * 0.22)} `,
      locked: true,
    },
  ], [totalTonne, tr]);

  return (
    <div className="space-y-3 sm:space-y-4">

      {/* Section header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#072C0E]/35">
            {tr ? 'Sektör Karşılaştırması' : 'Sector Comparison'}
          </p>
          <h1 className="mt-0.5 text-base font-bold text-[#072C0E] sm:text-[17px]">
            {tr ? 'Benchmark' : 'Benchmark'}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#072C0E]/45">
          <Users className="h-3.5 w-3.5" />
          <span>{benchmark.count} {tr ? 'şirket · GDPR uyumlu anonim veri' : 'companies · GDPR-compliant anonymous data'}</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {[
          {
            label: tr ? 'Sizin Emisyonunuz' : 'Your Emissions',
            value: totalTonne > 0 ? `${totalTonne.toFixed(1)} tCO₂e` : '—',
            sub:   tr ? 'Bu yıl' : 'This year',
            color: 'text-[#072C0E]',
          },
          {
            label: tr ? 'Sektör Ortalaması' : 'Sector Average',
            value: `${benchmark.avg} tCO₂e`,
            sub:   benchmark.label[language] || benchmark.label.en,
            color: 'text-amber-600',
          },
          {
            label: tr ? 'Ortalamanın Altında' : 'Below Average',
            value: totalTonne > 0 ? `%${Math.abs(pctVsAvg)}` : '—',
            sub:   pctVsAvg > 0 ? (tr ? 'Daha az emisyon ✓' : 'Less emissions ✓') : (tr ? 'Daha fazla emisyon' : 'More emissions'),
            color: pctVsAvg > 0 ? 'text-[#175022]' : 'text-red-500',
          },
          {
            label: tr ? 'Çalışan Grubu' : 'Employee Band',
            value: empBand.key,
            sub:   tr ? empBand.tr : empBand.en,
            color: 'text-[#072C0E]',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-[#072C0E]/8 bg-white p-3">
            <p className="text-[10px] font-semibold text-[#072C0E]/45">{card.label}</p>
            <p className={`mt-1 text-lg font-bold leading-none ${card.color}`}>{card.value}</p>
            <p className="mt-0.5 text-[10px] text-[#072C0E]/40">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Main 2-col: Position bar + Opportunities */}
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-[1fr_300px]">

        {/* Sector position */}
        <div className="rounded-[1.5rem] border border-[#072C0E]/8 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2ABD41]/15 sm:h-9 sm:w-9">
              <BarChart2 className="h-4 w-4 text-[#2ABD41]" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-[#072C0E] sm:text-sm">
                {tr ? 'Sektör Konumunuz' : 'Your Sector Position'}
              </h2>
              <p className="text-[10px] text-[#072C0E]/40">
                {benchmark.label[language] || benchmark.label.en} · {empBand[language] || empBand.en}
              </p>
            </div>
          </div>
          <div className="space-y-4 pt-6">
            <BenchmarkBar
              yourValue={totalTonne}
              avg={benchmark.avg}
              p25={benchmark.p25}
              p75={benchmark.p75}
              tr={tr}
            />
          </div>
          {/* NACE info note */}
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#072C0E]/3 p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#072C0E]/35" />
            <p className="text-[11px] text-[#072C0E]/45 leading-relaxed">
              {naceCode
                ? (tr ? `NACE ${naceCode} sektörü · ${empBand.tr} · ${benchmark.count} anonim şirket verisi` : `NACE ${naceCode} sector · ${empBand.en} · ${benchmark.count} anonymous companies`)
                : (tr ? 'Anket tamamlandığında sektörünüze özgü veriler gösterilir.' : 'Complete the questionnaire to see sector-specific data.')}
            </p>
          </div>
        </div>

        {/* Year-over-year trend placeholder */}
        <div className="rounded-[1.5rem] border border-[#072C0E]/8 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#175022]/15 sm:h-9 sm:w-9">
              <TrendingDown className="h-4 w-4 text-[#175022]" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-[#072C0E] sm:text-sm">
                {tr ? 'Yıllık Karşılaştırma' : 'Year-over-year'}
              </h2>
              <p className="text-[10px] text-[#072C0E]/40">{tr ? 'Trend analizi' : 'Trend analysis'}</p>
            </div>
          </div>
          {totalTonne > 0 ? (
            <div className="space-y-2.5">
              {[
                { label: tr ? 'Sektör ortalaması' : 'Sector average', value: benchmark.avg, color: 'bg-amber-200' },
                { label: tr ? 'P75 (üst çeyrek)' : 'P75 (upper quartile)', value: benchmark.p75, color: 'bg-red-100' },
                { label: tr ? 'Sizin performansınız' : 'Your performance', value: Math.round(totalTonne), color: 'bg-[#2ABD41]' },
                { label: tr ? 'P25 (alt çeyrek)' : 'P25 (lower quartile)', value: benchmark.p25, color: 'bg-[#DEFAE1]' },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="text-[#072C0E]/55">{row.label}</span>
                    <span className="font-bold text-[#072C0E]">{row.value} tCO₂e</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#072C0E]/6">
                    <div
                      className={`h-full rounded-full ${row.color} transition-all duration-700`}
                      style={{ width: `${Math.min((row.value / (benchmark.p75 * 1.2)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-28 flex-col items-center justify-center gap-2">
              <p className="text-[11px] text-[#072C0E]/35">{tr ? 'Veri bekleniyor' : 'Awaiting data'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Reduction Opportunities */}
      <div className="rounded-[1.5rem] border border-[#072C0E]/8 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#072C0E]/8 sm:h-9 sm:w-9">
              <TrendingDown className="h-4 w-4 text-[#072C0E]/60" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-[#072C0E] sm:text-sm">
                {tr ? 'Azaltım Fırsatları' : 'Reduction Opportunities'}
              </h2>
              <p className="text-[10px] text-[#072C0E]/40">{tr ? 'Sektörünüze özgü öneriler' : 'Sector-specific recommendations'}</p>
            </div>
          </div>
          <span className="rounded-full bg-[#DEFAE1] px-2 py-0.5 text-[10px] font-bold text-[#175022]">
            {tr ? 'Ücretsiz' : 'Free'}
          </span>
        </div>
        <div className="space-y-2">
          {opportunities.map(opp => (
            <OpportunityRow key={opp.rank} {...opp} tr={tr} />
          ))}
        </div>
        {/* Pro unlock banner */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[#2ABD41]/25 bg-gradient-to-r from-[#072C0E] to-[#1A6126] px-4 py-3">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-[#8BEA99]" />
            <p className="text-[12px] font-semibold text-white/80">
              {tr ? 'Tüm fırsatları görmek için Pro plana geçin' : 'Upgrade to Pro to see all opportunities'}
            </p>
          </div>
          <button className="rounded-lg bg-[#2ABD41] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#8BEA99]">
            Pro →
          </button>
        </div>
      </div>

    </div>
  );
}
