'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/lib/utils/api';

// ── Step definitions for the new CarbonIQ wizard ──────────────────────────
const STEP_CONFIG = {
  A1: { type: 'text', field: 'legal_name', placeholder: 'e.g. ABC Technology Ltd.' },
  A2: { type: 'text', field: 'tax_id', placeholder: '0000000000' },
  A3: { type: 'dual', fields: ['country', 'city'], placeholders: ['Turkey', 'Istanbul'] },
  A4: { type: 'number', field: 'reporting_year', placeholder: '2025', min: 2015, max: 2026 },
  A5: { type: 'text', field: 'prepared_by', placeholder: 'e.g. John Doe — Sustainability Dept.' },
  A6: {
    type: 'multi_choice',
    field: 'purposes',
    options: [
      { key: 'internal', tr: 'İç yönetim', en: 'Internal management' },
      { key: 'legal', tr: 'Yasal zorunluluk', en: 'Legal requirement' },
      { key: 'voluntary', tr: 'Gönüllü açıklama', en: 'Voluntary disclosure' },
      { key: 'client', tr: 'Müşteri talebi', en: 'Client requirement' },
      { key: 'skip', tr: 'Atla', en: 'Skip' },
    ]
  },
  A7: {
    type: 'choice',
    field: 'has_previous_report',
    options: [
      { key: true, tr: 'Evet', en: 'Yes' },
      { key: false, tr: 'Hayır', en: 'No' },
    ]
  },
  A7a: { type: 'number', field: 'baseline_year', placeholder: '2020', min: 2010, max: 2024 },
  B1: { type: 'text', field: 'nace_code', placeholder: 'e.g. C26 or Manufacturing' },
  B2: { type: 'textarea', field: 'activity_description', placeholder: 'Briefly describe your main business activity...' },
  B3: {
    type: 'choice',
    field: 'employee_band',
    options: [
      { key: '1-50', tr: '1–50', en: '1–50' },
      { key: '51-250', tr: '51–250', en: '51–250' },
      { key: '251-1000', tr: '251–1.000', en: '251–1,000' },
      { key: '1001-5000', tr: '1.001–5.000', en: '1,001–5,000' },
      { key: '5000+', tr: '5.000+', en: '5,000+' },
    ]
  },
  B4: { type: 'number', field: 'number_of_facilities', placeholder: '1', min: 1 },
  B5: {
    type: 'multi_choice',
    field: 'facility_types',
    options: [
      { key: 'office', tr: 'Ofis', en: 'Office' },
      { key: 'factory', tr: 'Fabrika', en: 'Factory' },
      { key: 'warehouse', tr: 'Depo', en: 'Warehouse' },
      { key: 'field', tr: 'Saha', en: 'Field site' },
      { key: 'datacenter', tr: 'Veri Merkezi', en: 'Data Center' },
      { key: 'retail', tr: 'Perakende', en: 'Retail' },
      { key: 'other', tr: 'Diğer', en: 'Other' },
    ]
  },
  B6: {
    type: 'choice',
    field: 'revenue_band',
    options: [
      { key: '<1M', tr: '< 500 Bin ₺', en: '< 500K ₺' },
      { key: '1-10M', tr: '500 Bin – 2 Milyon ₺', en: '500K – 2M ₺' },
      { key: '10-100M', tr: '2 – 10 Milyon ₺', en: '2M – 10M ₺' },
      { key: '100M-1B', tr: '10 – 50 Milyon ₺', en: '10M – 50M ₺' },
      { key: '1B+', tr: '50 Milyon ₺ üzeri', en: '50M+ ₺' },
      { key: 'skip', tr: 'Atla', en: 'Skip' },
    ]
  },
  C1: {
    type: 'choice',
    field: 'has_subsidiaries',
    options: [
      { key: true, tr: 'Evet', en: 'Yes' },
      { key: false, tr: 'Hayır', en: 'No' },
    ]
  },
  C2: {
    type: 'choice',
    field: 'has_international',
    options: [
      { key: true, tr: 'Evet', en: 'Yes' },
      { key: false, tr: 'Hayır', en: 'No' },
    ]
  },
  C3: {
    type: 'choice',
    field: 'has_jv_franchise',
    options: [
      { key: true, tr: 'Evet', en: 'Yes' },
      { key: false, tr: 'Hayır', en: 'No' },
    ]
  },
  D1: {
    type: 'choice',
    field: 'ef_database',
    options: [
      { key: 'DEFRA_TUIK', tr: 'DEFRA + TÜİK (Türkiye)', en: 'DEFRA + TÜİK (Turkey)' },
      { key: 'DEFRA', tr: 'DEFRA 2023', en: 'DEFRA 2023' },
      { key: 'IPCC_AR6', tr: 'IPCC AR6 2021', en: 'IPCC AR6 2021' },
      { key: 'EPA', tr: 'EPA (ABD)', en: 'EPA (US)' },
      { key: 'custom', tr: 'Özel', en: 'Custom' },
    ]
  },
  D3: {
    type: 'choice',
    field: 'boundary_approach',
    options: [
      { key: 'operational_control', tr: 'Operasyonel Kontrol (Önerilen)', en: 'Operational Control (Recommended)' },
      { key: 'financial_control', tr: 'Finansal Kontrol', en: 'Financial Control' },
      { key: 'equity_share', tr: 'Hisse Payı', en: 'Equity Share' },
    ]
  },
  D4: {
    type: 'choice',
    field: 'scope3_approach',
    options: [
      { key: 'materiality', tr: 'Materyalite Bazlı (Önerilen)', en: 'Materiality Based (Recommended)' },
      { key: 'full', tr: 'Tam 15 Kategori', en: 'Full 15 Categories' },
    ]
  },
};

const STEP_LABELS = {
  A1: 'Company Name', A2: 'Tax ID', A3: 'Location', A4: 'Reporting Year',
  A5: 'Prepared By', A6: 'Purpose', A7: 'Previous Report', A7a: 'Baseline Year',
  B1: 'NACE Sector', B2: 'Activity', B3: 'Employees', B4: 'Facilities',
  B5: 'Facility Types', B6: 'Revenue', C1: 'Subsidiaries', C2: 'International',
  C3: 'JV/Franchise', D1: 'EF Database', D3: 'Boundary', D4: 'Scope 3',
};

const PHASE1_STEPS = ['A1','A2','A3','A4','A5','A6','A7','A7a','B1','B2','B3','B4','B5','B6','C1','C2','C3','D1','D3','D4'];

export default function Chatbot({ language = 'tr', onComplete, embedded = false }) {
  const [open, setOpen] = useState(embedded ? true : false);
  const [reportId, setReportId] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [dualValues, setDualValues] = useState({ country: '', city: '' });
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [phaseComplete, setPhaseComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const messagesEndRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addBotMessages = (msgs) => {
    const arr = Array.isArray(msgs) ? msgs : [msgs];
    setMessages(prev => [
      ...prev,
      ...arr.filter(Boolean).map(text => ({ type: 'bot', text }))
    ]);
  };

  const addUserMessage = (text) => {
    setMessages(prev => [...prev, { type: 'user', text }]);
  };

  const startReport = async () => {
    if (startedRef.current || reportId) return;
    startedRef.current = true;
    setLoading(true);
    try {
      const res = await api.startCarbonReport();
      if (res.ok) {
        const data = await res.json();
        setReportId(data.report_id);
        setCurrentStep(data.current_step);
        addBotMessages(data.bot_messages);
        if (data.resumed) {
          const idx = PHASE1_STEPS.indexOf(data.current_step);
          setProgress(idx > 0 ? Math.round(idx / PHASE1_STEPS.length * 100) : 0);
        }
      } else {
        addBotMessages(['❌ Could not start report. Please try again.']);
      }
    } catch {
      addBotMessages(['❌ Connection error. Please check your connection.']);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!reportId) {
      setMessages([{
        type: 'bot',
        text: language === 'tr'
          ? '👋 Merhaba! ISO 14064-1 karbon envanteri sihirbazına hoş geldiniz.'
          : '👋 Hello! Welcome to the ISO 14064-1 carbon inventory wizard.'
      }]);
      startReport();
    }
  };

  // Auto-start in embedded mode
  useEffect(() => {
    if (embedded && !reportId && messages.length === 0) {
      setMessages([{
        type: 'bot',
        text: language === 'tr'
          ? '👋 Merhaba! ISO 14064-1 karbon envanteri sihirbazına hoş geldiniz. Şirketinizin karbon raporunu birlikte hazırlayalım.'
          : '👋 Hello! Welcome to the ISO 14064-1 carbon inventory wizard. Let\'s prepare your company\'s carbon report together.'
      }]);
      startReport();
    }
  }, [embedded]); // eslint-disable-line

  const handleReset = async () => {
    startedRef.current = false;
    setReportId(null);
    setCurrentStep(null);
    setMessages([]);
    setInputValue('');
    setDualValues({ country: '', city: '' });
    setSelectedOptions([]);
    setPhaseComplete(false);
    setProgress(0);
    setTimeout(() => startReport(), 100);
  };

  const buildData = () => {
    const cfg = STEP_CONFIG[currentStep];
    if (!cfg) return {};
    if (cfg.type === 'text' || cfg.type === 'textarea') {
      return { [cfg.field]: inputValue.trim() };
    }
    if (cfg.type === 'number') {
      return { [cfg.field]: parseInt(inputValue) || 0 };
    }
    if (cfg.type === 'dual') {
      return { country: dualValues.country.trim(), city: dualValues.city.trim() };
    }
    if (cfg.type === 'choice') {
      return { [cfg.field]: selectedOptions[0] };
    }
    if (cfg.type === 'multi_choice') {
      return { [cfg.field]: selectedOptions };
    }
    return {};
  };

  const getUserDisplayText = () => {
    const cfg = STEP_CONFIG[currentStep];
    if (!cfg) return inputValue;
    if (cfg.type === 'dual') return `${dualValues.country}, ${dualValues.city}`;
    if (cfg.type === 'choice' || cfg.type === 'multi_choice') {
      const opts = cfg.options.filter(o => selectedOptions.includes(o.key));
      return opts.map(o => language === 'tr' ? o.tr : o.en).join(', ');
    }
    return inputValue;
  };

  const canSubmit = () => {
    const cfg = STEP_CONFIG[currentStep];
    if (!cfg) return false;
    if (cfg.type === 'text' || cfg.type === 'textarea') return inputValue.trim().length > 0;
    if (cfg.type === 'number') return inputValue.trim().length > 0;
    if (cfg.type === 'dual') return dualValues.country.trim().length > 0;
    if (cfg.type === 'choice') return selectedOptions.length === 1;
    if (cfg.type === 'multi_choice') return selectedOptions.length > 0;
    return false;
  };

  const handleSubmit = async () => {
    if (!canSubmit() || loading || !reportId) return;

    const data = buildData();
    const displayText = getUserDisplayText();
    addUserMessage(displayText);
    setInputValue('');
    setDualValues({ country: '', city: '' });
    setSelectedOptions([]);
    setLoading(true);

    try {
      const res = await api.submitReportStep(reportId, currentStep, data);
      const result = await res.json();

      if (result.success) {
        addBotMessages(result.bot_messages);
        const nextStep = result.next_step;
        setCurrentStep(nextStep === 'PHASE2' ? null : nextStep);

        const idx = PHASE1_STEPS.indexOf(nextStep);
        setProgress(idx >= 0 ? Math.round((idx + 1) / PHASE1_STEPS.length * 100) : 100);

        if (result.phase_complete) {
          setPhaseComplete(true);
          if (onComplete) onComplete();
        }
      } else {
        addBotMessages(result.bot_messages || ['❌ Please check your input and try again.']);
        // Stay on same step
      }
    } catch {
      addBotMessages(['❌ Connection error. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  const toggleOption = (key) => {
    const cfg = STEP_CONFIG[currentStep];
    if (!cfg) return;
    if (cfg.type === 'choice') {
      setSelectedOptions([key]);
    } else {
      setSelectedOptions(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
    }
  };

  const cfg = currentStep ? STEP_CONFIG[currentStep] : null;

  return (
    <>
      {/* Floating Button — only in non-embedded mode */}
      {!embedded && !open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center text-white hover:scale-110 transition-transform"
          aria-label="Open CarbonIQ wizard"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window — popup or embedded */}
      {open && (
        <div className={embedded
          ? "w-full h-full bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden"
          : "fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[420px] h-full sm:h-[640px] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        }>

          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-secondary px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">CarbonIQ Wizard</h3>
                <p className="text-white/70 text-xs">ISO 14064-1 — Phase 1</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {reportId && (
                <button onClick={handleReset} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Restart">
                  <RotateCcw className="w-4 h-4 text-white" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className={`p-1.5 hover:bg-white/20 rounded-lg transition-colors ${embedded ? 'hidden' : ''}`}>
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {progress > 0 && (
            <div className="h-1 bg-gray-100 flex-shrink-0">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Step indicator */}
          {currentStep && (
            <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100 flex-shrink-0">
              <span className="text-xs text-gray-500">
                Step <span className="font-semibold text-primary">{currentStep}</span>
                {STEP_LABELS[currentStep] && ` — ${STEP_LABELS[currentStep]}`}
                {progress > 0 && <span className="ml-2 text-gray-400">({progress}%)</span>}
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.type === 'bot' && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MessageCircle className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                      <p className="text-sm text-gray-800 whitespace-pre-line">{msg.text}</p>
                    </div>
                  </div>
                )}
                {msg.type === 'user' && (
                  <div className="flex justify-end">
                    <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {phaseComplete && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div className="bg-green-50 border border-green-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-green-800 font-medium">
                    {language === 'tr' ? '✅ Aşama 1 tamamlandı!' : '✅ Phase 1 complete!'}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {language === 'tr'
                      ? 'Şirket bilgileri kaydedildi. Emisyon verisi girişine başlayabilirsiniz.'
                      : 'Company information saved. You can now start entering emission data.'}
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {cfg && !loading && !phaseComplete && (
            <div className="border-t border-gray-200 p-3 flex-shrink-0 max-h-[45%] overflow-y-auto">

              {/* Choice / Multi-choice */}
              {(cfg.type === 'choice' || cfg.type === 'multi_choice') && (
                <div className="space-y-1.5 mb-3">
                  {cfg.type === 'multi_choice' && (
                    <p className="text-xs text-gray-500 mb-1">
                      {language === 'tr' ? '(Birden fazla seçebilirsiniz)' : '(Select all that apply)'}
                    </p>
                  )}
                  {cfg.options.map(opt => (
                    <button
                      key={String(opt.key)}
                      onClick={() => toggleOption(opt.key)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                        selectedOptions.includes(opt.key)
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedOptions.includes(opt.key) ? 'border-primary' : 'border-gray-300'
                        }`}>
                          {selectedOptions.includes(opt.key) && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                        </div>
                        <span>{language === 'tr' ? opt.tr : opt.en}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Text input */}
              {(cfg.type === 'text') && (
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canSubmit() && handleSubmit()}
                  placeholder={cfg.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent mb-3"
                  autoFocus
                />
              )}

              {/* Textarea */}
              {cfg.type === 'textarea' && (
                <textarea
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder={cfg.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent mb-3 resize-none"
                  autoFocus
                />
              )}

              {/* Number input */}
              {cfg.type === 'number' && (
                <input
                  type="number"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canSubmit() && handleSubmit()}
                  placeholder={cfg.placeholder}
                  min={cfg.min}
                  max={cfg.max}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent mb-3"
                  autoFocus
                />
              )}

              {/* Dual input (country + city) */}
              {cfg.type === 'dual' && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={dualValues.country}
                    onChange={e => setDualValues(p => ({ ...p, country: e.target.value }))}
                    placeholder={cfg.placeholders[0]}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={dualValues.city}
                    onChange={e => setDualValues(p => ({ ...p, city: e.target.value }))}
                    placeholder={cfg.placeholders[1]}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit()}
                className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  canSubmit()
                    ? 'bg-primary text-white hover:bg-secondary cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                {language === 'tr' ? 'Gönder' : 'Submit'}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
