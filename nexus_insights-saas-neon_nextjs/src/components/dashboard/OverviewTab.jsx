'use client';
import { Leaf, Target, Plus, AlertCircle } from 'lucide-react';

export default function OverviewTab({ language, summary, entries, targets, questionnaireProfile, facilityList, selectedYear, onAddData, months }) {
  return (
    <div className="space-y-6">
      {/* Questionnaire Status */}
      {questionnaireProfile && !questionnaireProfile.is_complete && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">{language === 'tr' ? 'Karbon envanteri prsşnamesini tamamlayın' : 'Complete the carbon inventory questionnaire'}</p>
            <p className="text-xs text-amber-700">{language === 'tr' ? 'Sağ alttaki chatbot ile prsşnameyi tamamlayarak raporlama yapılandırmanızı belirleyin.' : 'Use the chatbot (bottom right) to configure your reporting setup.'}</p>
          </div>
        </div>
      )}

      {questionnaireProfile?.is_complete && questionnaireProfile?.preferred_factor_source && questionnaireProfile.preferred_factor_source !== 'mixed' && questionnaireProfile.preferred_factor_source !== 'unsure' && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Leaf className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-xs text-green-800">
            {language === 'tr' ? 'Emisyon faktörleri tercihinize göre filtreleniyor: ' : 'Emission factors filtered by your preference: '}
            <span className="font-semibold">{{ national: language === 'tr' ? 'Ulusal Kaynaklar' : 'National Sources', defra: 'DEFRA', ipcc: 'IPCC' }[questionnaireProfile.preferred_factor_source]}</span>
          </p>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{language === 'tr' ? 'Emisyon Profili' : 'Emission Profile'}</h1>
        <p className="text-gray-600 mt-1">{language === 'tr' ? 'Şirketinizin karbon emisyon verilerine genel bakış' : 'Overview of your company carbon emission data'}</p>
      </div>

      {/* Total */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-600">{language === 'tr' ? 'TOPLAM EMİSYONLAR (tCO2e)' : 'TOTAL EMISSIONS (tCO2e)'}</h2>
          <button onClick={onAddData} className="text-sm text-primary hover:text-secondary">{language === 'tr' ? 'Veri Ekle' : 'Add Data'}</button>
        </div>
        <div className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">{summary?.total_tonne?.toFixed(2) || '0.00'}</div>
        <p className="text-sm text-gray-500">{language === 'tr' ? `${selectedYear} yılı toplam şirket emisyonları` : `Total company emissions for ${selectedYear}`}</p>
      </div>

      {/* Scope Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'SCOPE 1', val: summary?.scope1_tonne, sub: language === 'tr' ? 'Doğrudan emisyonlar' : 'Direct emissions' },
          { label: 'SCOPE 2', val: summary?.scope2_tonne, sub: language === 'tr' ? 'Enerji dolaylı emisyonlar' : 'Energy indirect emissions' },
          { label: 'SCOPE 3', val: summary?.scope3_tonne, sub: language === 'tr' ? 'Diğer dolaylı emisyonlar' : 'Other indirect emissions' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">{s.label} (tCO2e)</div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{(s.val || 0).toFixed(2)}</div>
            <div className="text-xs text-gray-500">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Scope Bars */}
      {summary && summary.total_tonne > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'KAPSAM DAĞILIMI' : 'SCOPE DISTRIBUTION'}</h3>
          <div className="space-y-3">
            {[
              { label: 'Scope 1', val: summary.scope1_tonne, color: 'bg-red-500' },
              { label: 'Scope 2', val: summary.scope2_tonne, color: 'bg-yellow-500' },
              { label: 'Scope 3', val: summary.scope3_tonne, color: 'bg-blue-500' },
            ].map(s => {
              const pct = summary.total_tonne > 0 ? (s.val / summary.total_tonne * 100) : 0;
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{s.label}</span>
                    <span className="text-sm text-gray-600">{s.val.toFixed(2)} tCO2e ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className={`h-3 rounded-full ${s.color} transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Trend */}
      {summary?.monthly && summary.monthly.some(m => m.total_kg > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'AYLIK TREND' : 'MONTHLY TREND'}</h3>
          <div className="flex items-end gap-1 h-40">
            {summary.monthly.map((m, i) => {
              const maxKg = Math.max(...summary.monthly.map(x => x.total_kg), 1);
              const pct = (m.total_kg / maxKg) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{m.total_kg > 0 ? (m.total_kg / 1000).toFixed(2) : ''}</span>
                  <div className="w-full bg-gray-100 rounded-t flex-1 relative" style={{ minHeight: '4px' }}>
                    <div className="absolute bottom-0 left-0 right-0 bg-primary/70 rounded-t transition-all duration-500" style={{ height: `${Math.max(pct, m.total_kg > 0 ? 5 : 0)}%` }}></div>
                  </div>
                  <span className="text-xs text-gray-400">{months[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {summary?.by_category?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'KATEGORİ DAĞILIMI' : 'CATEGORY BREAKDOWN'}</h3>
          <div className="space-y-3">
            {summary.by_category.map(c => (
              <div key={c.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">{c.category}</span>
                <span className="text-sm font-semibold">{(c.total_kg / 1000).toFixed(2)} tCO2e</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onboarding */}
      <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-xl border border-primary/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">{language === 'tr' ? 'Başlangıç Rehberi' : 'Getting Started'}</h3>
            <div className="space-y-2 mb-4">
              {[
                { done: !!questionnaireProfile?.is_complete, tr: 'Prsşnameyi tamamla', en: 'Complete questionnaire' },
                { done: entries.length > 0, tr: 'İlk emisyon verisini gir', en: 'Enter first emission data' },
                { done: targets.length > 0, tr: 'Azaltma hedefi belirle', en: 'Set reduction target' },
                { done: facilityList.length > 0, tr: 'Tesis ekle', en: 'Add a facility' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step.done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {step.done ? '✓' : (i + 1)}
                  </span>
                  <span className={step.done ? 'text-gray-500 line-through' : 'text-gray-700'}>{language === 'tr' ? step.tr : step.en}</span>
                </div>
              ))}
            </div>
            <button onClick={onAddData} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" />{language === 'tr' ? 'Veri Ekle' : 'Add Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
