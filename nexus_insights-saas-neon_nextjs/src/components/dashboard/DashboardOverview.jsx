'use client';
import { AlertCircle, CheckCircle2, Leaf, Plus, Target, TrendingDown } from 'lucide-react';
import FacilityChart from '@/components/dashboard/FacilityChart';

export default function DashboardOverview({ language, selectedYear, summary, entries, targets, facilityList, questionnaireProfile, setActiveTab, setShowAddForm }) {
  return (
    <div className="space-y-5">
      {/* Questionnaire Banner */}
      {questionnaireProfile && !questionnaireProfile.is_complete && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100"><AlertCircle className="h-4 w-4 text-amber-600" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-900">{language === 'tr' ? 'Karbon envanteri anketini tamamlayın' : 'Complete the carbon inventory questionnaire'}</p>
            <p className="text-xs text-amber-700">{language === 'tr' ? 'AI Carbon sekmesinden anketi tamamlayın.' : 'Complete it from the AI Carbon tab.'}</p>
          </div>
        </div>
      )}

      {questionnaireProfile?.is_complete && questionnaireProfile?.preferred_factor_source && questionnaireProfile.preferred_factor_source !== 'mixed' && questionnaireProfile.preferred_factor_source !== 'unsure' && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100"><Leaf className="h-4 w-4 text-emerald-600" /></div>
          <p className="text-xs text-emerald-800">{language === 'tr' ? 'Emisyon faktörleri tercihinize göre filtreleniyor: ' : 'Emission factors filtered by preference: '}<span className="font-bold">{{ national: language === 'tr' ? 'Ulusal' : 'National', defra: 'DEFRA', ipcc: 'IPCC' }[questionnaireProfile.preferred_factor_source]}</span></p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{language === 'tr' ? 'Emisyon Profili' : 'Emission Profile'}</h1>
          <p className="mt-1 text-sm text-slate-500">{language === 'tr' ? 'Şirketinizin karbon emisyon özetleri' : 'Carbon emission overview for your company'}</p>
        </div>
        <button onClick={() => { setActiveTab('emissions'); setShowAddForm(true); }} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
          <Plus className="h-4 w-4" />{language === 'tr' ? 'Veri Ekle' : 'Add Data'}
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Leaf} title={language === 'tr' ? 'Toplam Emisyon' : 'Total Emissions'} value={`${summary?.total_tonne?.toFixed(2) || '0.00'}`} unit="tCO₂e" subtitle={`${selectedYear}`} featured />
        <MetricCard title="Scope 1" value={`${(summary?.scope1_tonne || 0).toFixed(2)}`} unit="tCO₂e" subtitle={language === 'tr' ? 'Doğrudan' : 'Direct'} />
        <MetricCard title="Scope 2" value={`${(summary?.scope2_tonne || 0).toFixed(2)}`} unit="tCO₂e" subtitle={language === 'tr' ? 'Enerji dolaylı' : 'Energy indirect'} />
        <MetricCard title="Scope 3" value={`${(summary?.scope3_tonne || 0).toFixed(2)}`} unit="tCO₂e" subtitle={language === 'tr' ? 'Diğer dolaylı' : 'Other indirect'} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Scope Distribution */}
        {summary && summary.total_tonne > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Target className="h-5 w-5" /></div>
              <div>
                <h2 className="text-sm font-bold text-slate-950">{language === 'tr' ? 'Kapsam Dağılımı' : 'Scope Distribution'}</h2>
                <p className="text-xs text-slate-500">{language === 'tr' ? 'Scope bazlı emisyon oranları' : 'Emission ratios by scope'}</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Scope 1', val: summary.scope1_tonne, color: 'bg-red-400' },
                { label: 'Scope 2', val: summary.scope2_tonne, color: 'bg-amber-400' },
                { label: 'Scope 3', val: summary.scope3_tonne, color: 'bg-violet-400' },
              ].map(s => {
                const pct = summary.total_tonne > 0 ? (s.val / summary.total_tonne * 100) : 0;
                return (
                  <div key={s.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{s.label}</span>
                      <span className="text-xs font-semibold text-slate-500">{s.val.toFixed(2)} t ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${s.color} transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <EmptyMini icon={Target} title={language === 'tr' ? 'Henüz veri yok' : 'No data yet'} text={language === 'tr' ? 'Emisyon verisi ekleyin' : 'Add emission data'} />
        )}

        {/* Monthly Trend */}
        {summary?.monthly && summary.monthly.some(m => m.total_kg > 0) ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white"><TrendingDown className="h-5 w-5" /></div>
              <div>
                <h2 className="text-sm font-bold text-slate-950">{language === 'tr' ? 'Aylık Trend' : 'Monthly Trend'}</h2>
                <p className="text-xs text-slate-500">{selectedYear}</p>
              </div>
            </div>
            <div className="flex items-end gap-1 h-28">
              {summary.monthly.map((m, i) => {
                const maxKg = Math.max(...summary.monthly.map(x => x.total_kg), 1);
                const pct = (m.total_kg / maxKg) * 100;
                const months = language === 'tr' ? ['O','Ş','M','N','M','H','T','A','E','E','K','A'] : ['J','F','M','A','M','J','J','A','S','O','N','D'];
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-slate-100 relative" style={{ height: '80px' }}>
                      <div className="absolute bottom-0 left-0 right-0 rounded-t bg-emerald-500/70 transition-all duration-500" style={{ height: `${Math.max(pct, m.total_kg > 0 ? 5 : 0)}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{months[i]}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <EmptyMini icon={TrendingDown} title={language === 'tr' ? 'Trend verisi yok' : 'No trend data'} text={language === 'tr' ? 'Aylık veri girin' : 'Enter monthly data'} />
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Getting Started */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm"><CheckCircle2 className="h-5 w-5" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-950">{language === 'tr' ? 'Başlangıç Rehberi' : 'Getting Started'}</h2>
              <p className="text-xs text-slate-500">{language === 'tr' ? 'Platformu kullanmaya başlayın' : 'Start using the platform'}</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { done: !!questionnaireProfile?.is_complete, tr: 'Anketi tamamla', en: 'Complete questionnaire' },
              { done: entries.length > 0, tr: 'İlk emisyon verisini gir', en: 'Enter first emission data' },
              { done: targets.length > 0, tr: 'Azaltma hedefi belirle', en: 'Set reduction target' },
              { done: facilityList.length > 0, tr: 'Tesis ekle', en: 'Add a facility' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.done ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>
                  {step.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`text-sm font-semibold ${step.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {language === 'tr' ? step.tr : step.en}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Facility Comparison */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white"><TrendingDown className="h-5 w-5" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-950">{language === 'tr' ? 'Tesis Karşılaştırması' : 'Facility Comparison'}</h2>
              <p className="text-xs text-slate-500">{language === 'tr' ? 'Tesis bazlı emisyon görünümü' : 'Facility-level emission view'}</p>
            </div>
          </div>
          <FacilityChart language={language} selectedYear={selectedYear} compact />
        </section>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, title, value, unit, subtitle, featured = false }) {
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${featured ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-400">{title}</p>
          <div className="mt-3 flex items-end gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-slate-950">{value}</span>
            <span className="mb-1 text-xs font-bold text-slate-400">{unit}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
        </div>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100"><Icon className="h-5 w-5" /></div>
        )}
      </div>
    </div>
  );
}

function EmptyMini({ icon: Icon, title, text }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-400 ring-1 ring-slate-200"><Icon className="h-5 w-5" /></div>
      <p className="text-sm font-bold text-slate-800">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{text}</p>
    </div>
  );
}
