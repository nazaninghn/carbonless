'use client';
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Leaf,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
} from 'lucide-react';
import FacilityChart from '@/components/dashboard/FacilityChart';

export default function DashboardOverview({
  language,
  selectedYear,
  summary,
  entries,
  targets,
  facilityList,
  questionnaireProfile,
  setActiveTab,
  setShowAddForm,
}) {
  const tr = language === 'tr';
  const totalTonne = summary?.total_tonne || 0;
  const s1 = summary?.scope1_tonne || 0;
  const s2 = summary?.scope2_tonne || 0;
  const s3 = summary?.scope3_tonne || 0;

  return (
    <div className="space-y-4">
      {/* ─── HERO ─── */}
      <div className="relative overflow-hidden rounded-[1.5rem] border border-[#302817]/10 bg-gradient-to-br from-[#F9EFE5] via-white to-[#B4BE6A]/10 p-5 shadow-[0_6px_24px_rgba(48,40,23,0.06)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#95A847]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[#B4BE6A]/8 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#95A847]">
              {tr ? 'Karbon çalışma alanı' : 'Carbon workspace'}
            </p>
            <h1 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-[#302817] sm:text-2xl">
              {tr ? 'Emisyon Profili' : 'Emission Profile'} · {selectedYear}
            </h1>
            <p className="mt-1 text-sm text-[#302817]/55">
              {tr ? 'Şirketinizin karbon emisyon özetleri' : 'Carbon emission overview for your company'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setActiveTab('emissions'); setShowAddForm(true); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr ? 'Veri Ekle' : 'Add Data'}
            </button>
            <button
              onClick={() => setActiveTab('ai_carbon')}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#95A847]/40 bg-[#95A847]/10 px-4 py-2.5 text-xs font-bold text-[#75863B] transition hover:bg-[#95A847]/18"
            >
              <Bot className="h-3.5 w-3.5" />
              CarbonIQ
            </button>
            <button
              onClick={() => setActiveTab('reporting')}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#302817]/10 bg-white/70 px-4 py-2.5 text-xs font-bold text-[#302817]/70 transition hover:bg-white"
            >
              {tr ? 'Rapor' : 'Report'}
            </button>
          </div>
        </div>

        {/* AI Insight */}
        {totalTonne > 0 && (
          <div className="relative mt-4 flex items-start gap-3 rounded-xl border border-[#95A847]/20 bg-white/60 px-4 py-3 backdrop-blur-sm">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#95A847]" />
            <p className="text-xs font-semibold leading-5 text-[#302817]/70">
              {tr
                ? `Toplam ${totalTonne.toFixed(1)} tCO₂e emisyon kaydedildi. Scope 1 toplam emisyonun %${s1 > 0 ? ((s1 / totalTonne) * 100).toFixed(0) : 0}'ini oluşturuyor.`
                : `Total ${totalTonne.toFixed(1)} tCO₂e recorded. Scope 1 accounts for ${s1 > 0 ? ((s1 / totalTonne) * 100).toFixed(0) : 0}% of total emissions.`}
            </p>
          </div>
        )}
      </div>

      {/* Questionnaire Banner */}
      {questionnaireProfile && !questionnaireProfile.is_complete && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs font-semibold text-amber-800">
            {tr ? 'Karbon envanteri anketini AI Carbon sekmesinden tamamlayın.' : 'Complete the carbon inventory questionnaire from the AI Carbon tab.'}
          </p>
        </div>
      )}

      {/* ─── KPI CARDS ─── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KPICard
          title={tr ? 'Toplam' : 'Total'}
          value={totalTonne.toFixed(2)}
          unit="tCO₂e"
          accent
          icon={Leaf}
        />
        <KPICard
          title="Scope 1"
          value={s1.toFixed(2)}
          unit="tCO₂e"
          subtitle={tr ? 'Doğrudan' : 'Direct'}
          color="#95A847"
        />
        <KPICard
          title="Scope 2"
          value={s2.toFixed(2)}
          unit="tCO₂e"
          subtitle={tr ? 'Enerji' : 'Energy'}
          color="#B4BE6A"
        />
        <KPICard
          title="Scope 3"
          value={s3.toFixed(2)}
          unit="tCO₂e"
          subtitle={tr ? 'Dolaylı' : 'Indirect'}
          color="#302817"
        />
      </div>

      {/* ─── ANALYTICS ─── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_340px]">
        {/* Monthly Trend - Large */}
        <section className="rounded-[1.5rem] border border-[#302817]/10 bg-white/80 p-4 shadow-[0_6px_20px_rgba(48,40,23,0.04)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#95A847] text-white">
                <TrendingDown className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#302817]">{tr ? 'Aylık Trend' : 'Monthly Trend'}</h2>
                <p className="text-[11px] text-[#302817]/45">{selectedYear}</p>
              </div>
            </div>
          </div>
          {summary?.monthly && summary.monthly.some((m) => m.total_kg > 0) ? (
            <div className="flex h-36 items-end gap-1.5">
              {summary.monthly.map((m, i) => {
                const maxKg = Math.max(...summary.monthly.map((x) => x.total_kg), 1);
                const pct = (m.total_kg / maxKg) * 100;
                const months = tr
                  ? ['O','Ş','M','N','M','H','T','A','E','E','K','A']
                  : ['J','F','M','A','M','J','J','A','S','O','N','D'];
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative h-28 w-full overflow-hidden rounded-lg bg-[#95A847]/8">
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-lg bg-gradient-to-t from-[#75863B] to-[#95A847] transition-all duration-500"
                        style={{ height: `${Math.max(pct, m.total_kg > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[#302817]/35">{months[i]}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center text-xs font-semibold text-[#302817]/35">
              {tr ? 'Henüz veri yok' : 'No data yet'}
            </div>
          )}
        </section>

        {/* Scope Distribution */}
        <section className="rounded-[1.5rem] border border-[#302817]/10 bg-white/80 p-4 shadow-[0_6px_20px_rgba(48,40,23,0.04)] backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B4BE6A]/20 text-[#95A847] ring-1 ring-[#95A847]/20">
              <Target className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-[#302817]">{tr ? 'Kapsam Dağılımı' : 'Scope Distribution'}</h2>
          </div>
          {totalTonne > 0 ? (
            <div className="space-y-4">
              {[
                { label: 'Scope 1', val: s1, color: 'from-[#75863B] to-[#95A847]' },
                { label: 'Scope 2', val: s2, color: 'from-[#95A847] to-[#B4BE6A]' },
                { label: 'Scope 3', val: s3, color: 'from-[#302817] to-[#302817]/70' },
              ].map((s) => {
                const pct = totalTonne > 0 ? (s.val / totalTonne) * 100 : 0;
                return (
                  <div key={s.label}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#302817]">{s.label}</span>
                      <span className="text-[11px] font-bold text-[#302817]/45">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#302817]/6">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${s.color} transition-all duration-500`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] font-semibold text-[#302817]/40">{s.val.toFixed(2)} tCO₂e</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-xs font-semibold text-[#302817]/35">
              {tr ? 'Veri ekleyin' : 'Add data'}
            </div>
          )}
        </section>
      </div>

      {/* ─── BOTTOM ROW ─── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {/* Getting Started */}
        <section className="rounded-[1.5rem] border border-[#302817]/10 bg-white/80 p-4 shadow-[0_6px_20px_rgba(48,40,23,0.04)] backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#302817] text-white">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-[#302817]">{tr ? 'Başlangıç' : 'Getting Started'}</h2>
          </div>
          <div className="space-y-1.5">
            {[
              { done: !!questionnaireProfile?.is_complete, tr: 'Anketi tamamla', en: 'Complete questionnaire' },
              { done: entries.length > 0, tr: 'Emisyon verisi gir', en: 'Enter emission data' },
              { done: targets.length > 0, tr: 'Hedef belirle', en: 'Set target' },
              { done: facilityList.length > 0, tr: 'Tesis ekle', en: 'Add facility' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
                <span className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${step.done ? 'bg-[#95A847] text-white' : 'bg-[#302817]/8 text-[#302817]/35'}`}>
                  {step.done ? '✓' : i + 1}
                </span>
                <span className={`text-xs font-semibold ${step.done ? 'text-[#302817]/35 line-through' : 'text-[#302817]/70'}`}>
                  {tr ? step.tr : step.en}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Facility Comparison */}
        <section className="rounded-[1.5rem] border border-[#302817]/10 bg-white/80 p-4 shadow-[0_6px_20px_rgba(48,40,23,0.04)] backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#95A847]/15 text-[#95A847]">
              <TrendingDown className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-[#302817]">{tr ? 'Tesisler' : 'Facilities'}</h2>
          </div>
          <FacilityChart language={language} selectedYear={selectedYear} compact />
        </section>

        {/* Reduction Targets */}
        <section className="rounded-[1.5rem] border border-[#302817]/10 bg-white/80 p-4 shadow-[0_6px_20px_rgba(48,40,23,0.04)] backdrop-blur-xl">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B4BE6A]/20 text-[#75863B]">
              <Target className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-[#302817]">{tr ? 'Hedefler' : 'Targets'}</h2>
          </div>
          {targets.length === 0 ? (
            <div className="flex h-24 items-center justify-center">
              <p className="text-xs font-semibold text-[#302817]/35">{tr ? 'Henüz hedef yok' : 'No targets yet'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {targets.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-[#F8F8F8] px-3 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-[#302817]">{t.title}</p>
                    <p className="text-[10px] text-[#302817]/45">{t.base_year} → {t.target_year}</p>
                  </div>
                  <span className="rounded-full bg-[#95A847]/15 px-2 py-1 text-[10px] font-bold text-[#75863B]">
                    -{t.target_reduction_percent}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function KPICard({ title, value, unit, subtitle, accent, icon: Icon, color }) {
  return (
    <div className={`group relative overflow-hidden rounded-[1.25rem] border p-3.5 transition hover:-translate-y-0.5 hover:shadow-lg ${accent ? 'border-[#95A847]/40 bg-gradient-to-br from-[#95A847]/12 to-[#B4BE6A]/8' : 'border-[#302817]/8 bg-white/80'}`}>
      {/* Top accent line */}
      {color && (
        <div className="absolute left-3.5 right-3.5 top-0 h-[3px] rounded-b-full" style={{ backgroundColor: color }} />
      )}
      {accent && (
        <div className="absolute left-3.5 right-3.5 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-[#75863B] to-[#95A847]" />
      )}

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#302817]/40">{title}</p>
          <div className="mt-1.5 flex items-end gap-1">
            <span className="text-xl font-bold tracking-[-0.03em] text-[#302817] sm:text-2xl">{value}</span>
            <span className="mb-0.5 text-[10px] font-bold text-[#302817]/35">{unit}</span>
          </div>
          {subtitle && <p className="mt-0.5 text-[10px] font-semibold text-[#302817]/40">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#95A847]/15 text-[#95A847]">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
