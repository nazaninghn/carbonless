'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Bot, Check, CheckCircle2, ChevronDown,
  ClipboardList, FileText, HelpCircle, Leaf, Loader2, Maximize2, MessageCircle,
  Minimize2, RotateCcw, Save, Send, ShieldCheck, Sparkles, X,
} from 'lucide-react';

const STORAGE_KEY = 'carboniq_chatbot_state_v1';

const STAGES = [
  { id: 1, title: { tr: 'Şirketi Tanıma', en: 'Company Profile' }, iso: '§7.5 / §5.1' },
  { id: 2, title: { tr: 'Organizasyon Sınırı', en: 'Organizational Boundary' }, iso: '§5.1' },
  { id: 3, title: { tr: 'Kapsam 1', en: 'Scope 1' }, iso: '§5.2' },
  { id: 4, title: { tr: 'Kapsam 2', en: 'Scope 2' }, iso: '§5.3' },
  { id: 5, title: { tr: 'Kapsam 3', en: 'Scope 3' }, iso: '§5.4' },
  { id: 6, title: { tr: 'Kabuller ve Kapatış', en: 'Assumptions & Close-out' }, iso: '§7.3 / §7.4' },
  { id: 7, title: { tr: 'Rapor Üretimi', en: 'Report Generation' }, iso: '§7.5' },
];

function yesNoOptions() {
  return [
    { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
    { value: 'no', label: { tr: 'Hayır', en: 'No' } },
  ];
}

const QUESTIONS = [
  { id: 'A1', order: 1, stage: 1, block: { tr: 'İdari Bilgiler', en: 'Administrative Information' }, type: 'text', field: 'company_name', required: true, maxLength: 200, question: { tr: 'Şirketinizin tam ticari unvanı nedir?', en: 'What is the full legal name of your company?' }, placeholder: { tr: 'Örn: ABC Teknoloji Danışmanlık A.Ş.', en: 'Example: ABC Technology Consulting Inc.' }, help: { tr: 'Ticaret sicilinde kayıtlı tam unvanınızı girin.', en: 'Enter the full legal name registered in trade records.' }, validation: { kind: 'text', min: 1, max: 200 }, next: 'A2' },
  { id: 'A2', order: 2, stage: 1, block: { tr: 'İdari Bilgiler', en: 'Administrative Information' }, type: 'text', inputMode: 'numeric', field: 'tax_id', required: true, maxLength: 10, question: { tr: 'Vergi kimlik numaranız nedir?', en: 'What is your tax identification number?' }, placeholder: { tr: '0000000000', en: '0000000000' }, help: { tr: '10 haneli VKN / TCKN.', en: '10-digit tax ID.' }, validation: { kind: 'digits', length: 10 }, transform: 'digitsOnly', next: 'A3' },
  { id: 'A3', order: 3, stage: 1, block: { tr: 'İdari Bilgiler', en: 'Administrative Information' }, type: 'group', field: 'registered_location', required: true, question: { tr: 'Şirketinizin kayıtlı olduğu ülke ve şehir nedir?', en: 'In which country and city is your company registered?' }, help: { tr: 'Ana merkezi yazın.', en: 'Enter the headquarters.' }, fields: [{ key: 'country', type: 'select', label: { tr: 'Ülke', en: 'Country' }, required: true, options: [{ value: 'TR', label: { tr: 'Türkiye', en: 'Turkey' } }, { value: 'GB', label: { tr: 'İngiltere', en: 'United Kingdom' } }, { value: 'DE', label: { tr: 'Almanya', en: 'Germany' } }, { value: 'US', label: { tr: 'ABD', en: 'United States' } }, { value: 'OTHER', label: { tr: 'Diğer', en: 'Other' } }] }, { key: 'city', type: 'text', label: { tr: 'Şehir', en: 'City' }, required: true, placeholder: { tr: 'İstanbul', en: 'Istanbul' } }], effects: [{ when: { field: 'country', equals: 'TR' }, message: { type: 'info', tr: 'Türkiye seçiminize göre DEFRA + TÜİK önerilecek.', en: 'Based on Turkey, DEFRA + TÜİK will be recommended.' }, set: { recommended_ef_database: 'DEFRA_TUIK' } }], next: 'A4' },
  { id: 'A4', order: 4, stage: 1, block: { tr: 'İdari Bilgiler', en: 'Administrative Information' }, type: 'select', field: 'reporting_year', required: true, question: { tr: 'Hangi yıla ait rapor hazırlıyoruz?', en: 'Which reporting year are we preparing this report for?' }, help: { tr: 'Tüm veri girişleriniz bu yıl için geçerli olacak.', en: 'All data entries will apply to this year.' }, options: [2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => ({ value: String(y), label: { tr: String(y), en: String(y) } })), effects: [{ when: { equals: '2026' }, assumption: { type: 'A', trigger: 'current_year_selected', text: { tr: 'Cari yıl seçildi, bazı veriler tahmini olabilir.', en: 'Current year selected, some data may be estimated.' }, impact: 'May affect completeness.' }, message: { type: 'warning', tr: '2026 henüz tamamlanmadı.', en: '2026 is not complete yet.' } }], next: 'A5' },
  { id: 'A5', order: 5, stage: 1, block: { tr: 'İdari Bilgiler', en: 'Administrative Information' }, type: 'text', field: 'prepared_by', required: true, maxLength: 100, question: { tr: 'Raporu hazırlayan kişi veya birimin adı nedir?', en: 'Who is preparing this report?' }, placeholder: { tr: 'Örn: Ahmet Yılmaz — Sürdürülebilirlik Birimi', en: 'Example: Alex Green — Sustainability Department' }, help: { tr: "Raporda 'Hazırlayan' alanında görünecek.", en: "This will appear in the report's 'Prepared by' field." }, validation: { kind: 'text', min: 1, max: 100 }, next: 'A6' },
  { id: 'A6', order: 6, stage: 1, block: { tr: 'İdari Bilgiler', en: 'Administrative Information' }, type: 'multi', field: 'report_purpose', required: false, question: { tr: 'Bu raporun kullanım amacı nedir?', en: 'What is the intended use of this report?' }, help: { tr: 'Birden fazla seçebilirsiniz.', en: 'You can select more than one.' }, options: [{ value: 'internal', label: { tr: 'İç yönetim ve strateji', en: 'Internal management' } }, { value: 'legal', label: { tr: 'Yasal zorunluluk', en: 'Legal requirement' } }, { value: 'voluntary', label: { tr: 'Gönüllü açıklama', en: 'Voluntary disclosure' } }, { value: 'customer', label: { tr: 'Müşteri talebi', en: 'Customer request' } }, { value: 'skip', label: { tr: 'Atlamak istiyorum', en: 'I want to skip' } }], next: 'A7' },
  { id: 'A7', order: 7, stage: 1, block: { tr: 'İdari Bilgiler', en: 'Administrative Information' }, type: 'choice', field: 'has_previous_report', required: false, question: { tr: 'Daha önce karbon raporu hazırladınız mı?', en: 'Have you prepared a carbon report before?' }, help: { tr: 'Daha önce hazırladıysanız baz yıl karşılaştırması eklenecek.', en: 'If yes, baseline comparison can be added.' }, options: [{ value: 'yes', label: { tr: 'Evet', en: 'Yes' } }, { value: 'no', label: { tr: 'Hayır — ilk raporumuz', en: 'No — first report' } }, { value: 'skip', label: { tr: 'Atla', en: 'Skip' } }], conditionalNext: [{ when: { equals: 'yes' }, next: 'A7a' }, { when: { equals: 'no' }, next: 'B1' }, { when: { equals: 'skip' }, next: 'B1' }] },
  { id: 'A7a', order: 8, stage: 1, block: { tr: 'İdari Bilgiler', en: 'Administrative Information' }, type: 'select', field: 'baseline_year', required: false, question: { tr: 'Baz yılınız hangi yıl?', en: 'What is your baseline year?' }, help: { tr: 'Baz yıl referans yıldır.', en: 'The baseline year is the reference year.' }, options: Array.from({ length: 12 }, (_, i) => 2014 + i).map(y => ({ value: String(y), label: { tr: String(y), en: String(y) } })), customValidate: 'baselineBeforeReportingYear', next: 'B1' },
  { id: 'B1', order: 9, stage: 1, block: { tr: 'Faaliyet Profili', en: 'Activity Profile' }, type: 'select', field: 'primary_sector', required: true, question: { tr: 'Şirketinizin ana sektörü nedir?', en: 'What is the primary sector?' }, help: { tr: 'Bu seçim sonraki soruları belirler.', en: 'This shapes later questions.' }, options: [{ value: 'A', label: { tr: 'NACE A — Tarım', en: 'NACE A — Agriculture' } }, { value: 'B', label: { tr: 'NACE B — Madencilik', en: 'NACE B — Mining' } }, { value: 'C', label: { tr: 'NACE C — İmalat', en: 'NACE C — Manufacturing' } }, { value: 'D', label: { tr: 'NACE D — Enerji', en: 'NACE D — Energy' } }, { value: 'F', label: { tr: 'NACE F — İnşaat', en: 'NACE F — Construction' } }, { value: 'G-N', label: { tr: 'NACE G–N — Hizmetler', en: 'NACE G–N — Services' } }, { value: 'K', label: { tr: 'NACE K — Finans', en: 'NACE K — Finance' } }, { value: 'O-U', label: { tr: 'NACE O–U — Kamu', en: 'NACE O–U — Public' } }], next: 'B2' },
  { id: 'B2', order: 10, stage: 1, block: { tr: 'Faaliyet Profili', en: 'Activity Profile' }, type: 'textarea', field: 'activity_description', required: true, maxLength: 200, question: { tr: 'Şirketinizin faaliyetini kısaca tanımlayın.', en: "Briefly describe your company's main activity." }, placeholder: { tr: 'Örn: Kurumsal eğitim ve danışmanlık', en: 'Example: Corporate training and consulting' }, validation: { kind: 'text', min: 1, max: 200 }, next: 'B3' },
  { id: 'B3', order: 11, stage: 1, block: { tr: 'Faaliyet Profili', en: 'Activity Profile' }, type: 'select', field: 'employee_band', required: true, question: { tr: 'Toplam çalışan sayınız nedir?', en: 'Total number of employees?' }, options: [{ value: '1-50', label: { tr: '1–50', en: '1–50' } }, { value: '51-250', label: { tr: '51–250', en: '51–250' } }, { value: '251-1000', label: { tr: '251–1.000', en: '251–1,000' } }, { value: '1001-5000', label: { tr: '1.001–5.000', en: '1,001–5,000' } }, { value: '5000+', label: { tr: '5.000+', en: '5,000+' } }], next: 'B4' },
  { id: 'B4', order: 12, stage: 1, block: { tr: 'Faaliyet Profili', en: 'Activity Profile' }, type: 'number', field: 'location_count', required: true, min: 1, max: 999, question: { tr: 'Kaç farklı lokasyonda faaliyet gösteriyorsunuz?', en: 'How many physical locations?' }, placeholder: { tr: '3', en: '3' }, next: 'B5' },
  { id: 'B5', order: 13, stage: 1, block: { tr: 'Faaliyet Profili', en: 'Activity Profile' }, type: 'multi', field: 'location_types', required: true, question: { tr: 'Lokasyon türleri neler?', en: 'What types of locations?' }, options: [{ value: 'office', label: { tr: 'Ofis', en: 'Office' } }, { value: 'factory', label: { tr: 'Fabrika', en: 'Factory' } }, { value: 'warehouse', label: { tr: 'Depo', en: 'Warehouse' } }, { value: 'field', label: { tr: 'Saha', en: 'Field' } }, { value: 'data_center', label: { tr: 'Veri Merkezi', en: 'Data Center' } }, { value: 'retail', label: { tr: 'Mağaza', en: 'Retail' } }, { value: 'other', label: { tr: 'Diğer', en: 'Other' } }], next: 'B6' },
  { id: 'B6', order: 14, stage: 1, block: { tr: 'Faaliyet Profili', en: 'Activity Profile' }, type: 'select', field: 'revenue_band', required: false, question: { tr: 'Yıllık ciro aralığınız? (Opsiyonel)', en: 'Annual revenue range? (Optional)' }, options: [{ value: 'micro', label: { tr: '<1M TL', en: '<1M TRY' } }, { value: 'small', label: { tr: '1–10M TL', en: '1–10M TRY' } }, { value: 'medium', label: { tr: '10–100M TL', en: '10–100M TRY' } }, { value: 'large', label: { tr: '100M–1B TL', en: '100M–1B TRY' } }, { value: 'enterprise', label: { tr: '1B+ TL', en: '1B+ TRY' } }, { value: 'skip', label: { tr: 'Atla', en: 'Skip' } }], next: 'C1' },
  { id: 'C1', order: 15, stage: 1, block: { tr: 'Yapısal Bilgiler', en: 'Structural Information' }, type: 'choice', field: 'has_subsidiaries', required: true, question: { tr: 'Bağlı şirket var mı?', en: 'Any subsidiaries?' }, options: yesNoOptions(), next: 'C2' },
  { id: 'C2', order: 16, stage: 1, block: { tr: 'Yapısal Bilgiler', en: 'Structural Information' }, type: 'choice', field: 'has_international_operations', required: true, question: { tr: 'Yurt dışında operasyonunuz var mı?', en: 'International operations?' }, options: yesNoOptions(), next: 'C3' },
  { id: 'C3', order: 17, stage: 1, block: { tr: 'Yapısal Bilgiler', en: 'Structural Information' }, type: 'choice', field: 'has_jv_franchise', required: true, question: { tr: 'Franchise veya JV var mı?', en: 'Any franchise or JV?' }, options: yesNoOptions(), next: 'D1' },
  { id: 'D1', order: 18, stage: 1, block: { tr: 'Raporlama Tercihleri', en: 'Reporting Preferences' }, type: 'select', field: 'ef_database', required: true, question: { tr: 'Emisyon faktörü veritabanı tercihiniz?', en: 'Emission factor database preference?' }, options: [{ value: 'DEFRA', label: { tr: 'DEFRA 2023', en: 'DEFRA 2023' } }, { value: 'DEFRA_TUIK', label: { tr: 'DEFRA + TÜİK', en: 'DEFRA + TÜİK' } }, { value: 'IPCC_AR6', label: { tr: 'IPCC AR6', en: 'IPCC AR6' } }, { value: 'EPA', label: { tr: 'EPA', en: 'EPA' } }, { value: 'custom', label: { tr: 'Özel faktör', en: 'Custom factors' } }], next: 'D2' },
  { id: 'D2', order: 19, stage: 1, block: { tr: 'Raporlama Tercihleri', en: 'Reporting Preferences' }, type: 'info', field: 'scope2_method_acknowledged', required: true, question: { tr: 'Kapsam 2 metodolojisi hakkında bilgi', en: 'Scope 2 methodology information' }, help: { tr: 'Bu versiyon location-based metodolojisini destekler.', en: 'This version supports location-based methodology.' }, buttonLabel: { tr: 'Anladım, devam', en: 'I understand, continue' }, effects: [{ when: { equals: true }, assumption: { type: 'B', trigger: 'location_based_scope2', text: { tr: 'Location-based metodoloji kabul edildi.', en: 'Location-based methodology acknowledged.' }, impact: 'Scope 2 uses grid average factors.' }, set: { scope2_method: 'location_based' } }], next: 'D3' },
  { id: 'D3', order: 20, stage: 1, block: { tr: 'Raporlama Tercihleri', en: 'Reporting Preferences' }, type: 'choice', field: 'boundary_approach', required: true, question: { tr: 'Organizasyon sınırı yaklaşımı?', en: 'Organizational boundary approach?' }, help: { tr: "Emin değilseniz 'Operasyonel Kontrol' seçin.", en: "If unsure, select 'Operational Control'." }, options: [{ value: 'operational_control', label: { tr: 'Operasyonel Kontrol (Önerilen)', en: 'Operational Control (Recommended)' }, description: { tr: 'Operasyonel politikaları belirlediğiniz tesisler dahil.', en: 'Includes sites where you set operational policies.' } }, { value: 'financial_control', label: { tr: 'Finansal Kontrol', en: 'Financial Control' } }, { value: 'equity_share', label: { tr: 'Hisse Payı', en: 'Equity Share' } }], next: 'D4' },
  { id: 'D4', order: 21, stage: 1, block: { tr: 'Raporlama Tercihleri', en: 'Reporting Preferences' }, type: 'choice', field: 'scope3_approach', required: true, question: { tr: 'Kapsam 3 kapsamını nasıl belirlemek istersiniz?', en: 'How to determine Scope 3 scope?' }, options: [{ value: 'materiality', label: { tr: 'Materyalite Bazlı (Önerilen)', en: 'Materiality-Based (Recommended)' }, description: { tr: 'Önemli kategoriler öne çıkar.', en: 'Prioritizes important categories.' } }, { value: 'full', label: { tr: 'Tam 15 Kategori', en: 'Full 15 Categories' } }], next: '2A-0', completionMessage: { tr: 'Aşama 1 tamamlandı!', en: 'Stage 1 complete!' } },
  { id: '2A-0', order: 22, stage: 2, block: { tr: 'Organizasyon Sınırı', en: 'Organizational Boundary' }, type: 'info', field: 'stage2_intro_acknowledged', required: true, question: { tr: 'Aşama 2 — Organizasyon sınırınızı belirleyelim.', en: "Stage 2 — Let's define your organizational boundary." }, help: { tr: 'Hangi tesislerin rapora dahil edileceğini belirleyeceğiz.', en: 'We determine which sites are included in the report.' }, buttonLabel: { tr: 'Başlayalım', en: "Let's start" }, next: 'END' },
];

export default function Chatbot({ language = 'en', user, questionnaireProfile, onComplete }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentId, setCurrentId] = useState('A1');
  const [answers, setAnswers] = useState({});
  const [history, setHistory] = useState([]);
  const [assumptions, setAssumptions] = useState([]);
  const [systemMessages, setSystemMessages] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  const lang = language === 'tr' ? 'tr' : 'en';
  const currentQuestion = useMemo(() => QUESTIONS.find(q => q.id === currentId) || QUESTIONS[0], [currentId]);
  const currentIndex = QUESTIONS.findIndex(q => q.id === currentQuestion.id);
  const progress = Math.round(((currentIndex + 1) / QUESTIONS.length) * 100);
  const currentStage = STAGES.find(s => s.id === currentQuestion.stage) || STAGES[0];
  const stageQuestions = QUESTIONS.filter(q => q.stage === currentQuestion.stage);
  const stageIndex = stageQuestions.findIndex(q => q.id === currentQuestion.id);
  const answer = answers[currentQuestion.field];

  useEffect(() => { try { const saved = localStorage.getItem(STORAGE_KEY); if (!saved) return; const parsed = JSON.parse(saved); setCurrentId(parsed.currentId || 'A1'); setAnswers(parsed.answers || {}); setHistory(parsed.history || []); setAssumptions(parsed.assumptions || []); setSystemMessages(parsed.systemMessages || []); setCompleted(Boolean(parsed.completed)); } catch {} }, []);
  useEffect(() => { persistState({ currentId, answers, history, assumptions, systemMessages, completed }); }, [currentId, answers, history, assumptions, systemMessages, completed]);

  const setAnswer = (value) => { setError(''); setAnswers(prev => ({ ...prev, [currentQuestion.field]: value })); };
  const goBack = () => { setError(''); setSystemMessages([]); setHistory(prev => { if (prev.length === 0) return prev; const next = [...prev]; const previousId = next.pop(); setCurrentId(previousId); return next; }); };
  const reset = () => { const ok = window.confirm(lang === 'tr' ? 'Tüm ilerlemesini sıfırlamak istiyor musunuz?' : 'Reset all progress?'); if (!ok) return; localStorage.removeItem(STORAGE_KEY); setCurrentId('A1'); setAnswers({}); setHistory([]); setAssumptions([]); setSystemMessages([]); setError(''); setCompleted(false); };

  const handleNext = async () => {
    setError(''); setSystemMessages([]);
    const normalized = normalizeValue(currentQuestion, answer);
    const validation = validateAnswer(currentQuestion, normalized, answers, lang);
    if (!validation.ok) { setError(validation.message); return; }
    const effectResult = applyEffects(currentQuestion, normalized, answers, lang);
    if (effectResult.nextAnswers) { setAnswers(prev => ({ ...prev, ...effectResult.nextAnswers, [currentQuestion.field]: normalized })); } else { setAnswers(prev => ({ ...prev, [currentQuestion.field]: normalized })); }
    if (effectResult.messages.length > 0) setSystemMessages(effectResult.messages);
    if (effectResult.assumptions.length > 0) setAssumptions(prev => mergeAssumptions(prev, effectResult.assumptions, currentQuestion.id));
    setSaving(true);
    await saveAnswerToApi({ question: currentQuestion, value: normalized, answers: { ...answers, [currentQuestion.field]: normalized, ...effectResult.nextAnswers }, assumptions: effectResult.assumptions });
    setSaving(false);
    const nextId = getNextQuestionId(currentQuestion, normalized, answers);
    if (currentQuestion.completionMessage) setSystemMessages(prev => [...prev, { type: 'success', text: currentQuestion.completionMessage[lang] }]);
    if (nextId === 'END') { setCompleted(true); if (onComplete) onComplete({ answers, assumptions }); return; }
    setHistory(prev => [...prev, currentQuestion.id]);
    setCurrentId(nextId || QUESTIONS[Math.min(currentIndex + 1, QUESTIONS.length - 1)]?.id || 'END');
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-full bg-emerald-600 px-5 py-4 text-sm font-bold text-white shadow-2xl shadow-emerald-600/30 transition hover:-translate-y-0.5 hover:bg-emerald-700">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><Bot className="h-5 w-5" />{!completed && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-lime-300 ring-2 ring-emerald-600" />}</span>
          <span className="hidden sm:inline">CarbonIQ</span>
        </button>
      )}
      {open && (
        <div className={`fixed z-50 overflow-hidden border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 transition-all duration-300 ${expanded ? 'inset-3 rounded-[2rem] sm:inset-6' : 'bottom-4 right-4 h-[min(760px,calc(100vh-2rem))] w-[calc(100vw-2rem)] rounded-[2rem] sm:w-[460px]'}`}>
          <div className="flex h-full flex-col bg-[#fbfdf9]">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><Bot className="h-6 w-6" /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><h2 className="truncate text-lg font-bold tracking-tight text-slate-950">CarbonIQ Assistant</h2><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">ISO</span></div>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{lang === 'tr' ? 'Karbon envanteri soru akışı' : 'Carbon inventory questionnaire'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setExpanded(v => !v)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Toggle size">{expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}</button>
                  <button onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Close"><X className="h-5 w-5" /></button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500"><span>{currentStage.title[lang]}</span><span>{progress}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{lang === 'tr' ? 'Aşama' : 'Stage'} {currentQuestion.stage}/7 · {currentStage.iso}</div>
              </div>
            </header>

            {/* Main */}
            <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {completed ? <CompletionView lang={lang} answers={answers} assumptions={assumptions} reset={reset} /> : (
                <div className="mx-auto max-w-3xl space-y-4">
                  <AssistantIntro lang={lang} question={currentQuestion} stageIndex={stageIndex} stageTotal={stageQuestions.length} />
                  {systemMessages.length > 0 && <div className="space-y-2">{systemMessages.map((m, i) => <SystemMessage key={i} type={m.type} text={m.text} />)}</div>}
                  {error && <SystemMessage type="error" text={error} />}
                  <QuestionCard lang={lang} question={currentQuestion} value={answer} answers={answers} onChange={setAnswer} />
                  {assumptions.length > 0 && <AssumptionsPanel lang={lang} assumptions={assumptions} />}
                </div>
              )}
            </main>

            {/* Footer */}
            {!completed && (
              <footer className="border-t border-slate-200 bg-white p-4 sm:p-5">
                <div className="mx-auto flex max-w-3xl flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={goBack} disabled={history.length === 0 || saving} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-40"><ArrowLeft className="h-4 w-4" />{lang === 'tr' ? 'Geri' : 'Back'}</button>
                    <button onClick={reset} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-500 shadow-sm transition hover:border-red-200 hover:text-red-600 disabled:opacity-40"><RotateCcw className="h-4 w-4" />{lang === 'tr' ? 'Sıfırla' : 'Reset'}</button>
                  </div>
                  <button onClick={handleNext} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : currentQuestion.type === 'info' ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {saving ? (lang === 'tr' ? 'Kaydediliyor...' : 'Saving...') : currentQuestion.type === 'info' ? (currentQuestion.buttonLabel?.[lang] || (lang === 'tr' ? 'Devam et' : 'Continue')) : (lang === 'tr' ? 'Kaydet ve devam et' : 'Save & continue')}
                    {!saving && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ═══ Sub-components ═══ */
function AssistantIntro({ lang, question, stageIndex, stageTotal }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><MessageCircle className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{question.id}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">{question.block?.[lang]}</span><span className="text-xs font-medium text-slate-400">{stageIndex + 1}/{stageTotal}</span></div>
          <p className="text-sm leading-6 text-slate-600">{lang === 'tr' ? 'Bu adımda verdiğiniz cevap rapor yapısını etkileyebilir.' : 'Your answer may affect the report structure.'}</p>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({ lang, question, value, answers, onChange }) {
  const title = question.question?.[lang] || question.question?.en || question.id;
  const help = question.help?.[lang] || question.help?.en;
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700"><ClipboardList className="h-4 w-4" />{question.required ? (lang === 'tr' ? 'Zorunlu soru' : 'Required') : (lang === 'tr' ? 'Opsiyonel' : 'Optional')}</div>
        <h3 className="text-2xl font-bold tracking-[-0.03em] text-slate-950">{title}</h3>
        {help && <div className="mt-4 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600"><HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><p>{help}</p></div>}
      </div>
      <QuestionInput lang={lang} question={question} value={value} answers={answers} onChange={onChange} />
    </section>
  );
}

function QuestionInput({ lang, question, value, onChange }) {
  if (question.type === 'info') return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-7 text-emerald-900">
      <div className="mb-3 flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5" />{lang === 'tr' ? 'Metodoloji bilgisi' : 'Methodology note'}</div>
      <p>{question.help?.[lang]}</p>
      <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-4 text-sm font-bold text-slate-800 ring-1 ring-emerald-200"><input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} className="h-5 w-5 accent-emerald-600" />{question.buttonLabel?.[lang] || (lang === 'tr' ? 'Anladım' : 'I understand')}</label>
    </div>
  );
  if (question.type === 'text' || question.type === 'number') return (
    <div><input type={question.type === 'number' ? 'number' : 'text'} inputMode={question.inputMode} min={question.min} max={question.max} maxLength={question.maxLength} value={value || ''} onChange={e => { let v = e.target.value; if (question.transform === 'digitsOnly') v = v.replace(/\D/g, '').slice(0, question.maxLength || 99); onChange(v); }} placeholder={question.placeholder?.[lang] || ''} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100" />{question.maxLength && <p className="mt-2 text-right text-xs font-medium text-slate-400">{(value || '').length}/{question.maxLength}</p>}</div>
  );
  if (question.type === 'textarea') return (
    <div><textarea value={value || ''} maxLength={question.maxLength} onChange={e => onChange(e.target.value)} rows={5} placeholder={question.placeholder?.[lang] || ''} className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100" />{question.maxLength && <p className="mt-2 text-right text-xs font-medium text-slate-400">{(value || '').length}/{question.maxLength}</p>}</div>
  );
  if (question.type === 'select') return (
    <div className="relative"><select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 pr-11 text-base font-bold text-slate-950 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"><option value="">{lang === 'tr' ? 'Seçiniz' : 'Select'}</option>{question.options?.map(o => <option key={o.value} value={o.value}>{o.label?.[lang] || o.value}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /></div>
  );
  if (question.type === 'choice') return (
    <div className="grid gap-3">{question.options?.map(o => { const active = value === o.value; return (<button key={o.value} type="button" onClick={() => onChange(o.value)} className={`rounded-3xl border p-4 text-left transition ${active ? 'border-emerald-300 bg-emerald-50 ring-4 ring-emerald-100' : 'border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-white'}`}><div className="flex items-start gap-3"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}><Check className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-slate-950">{o.label?.[lang] || o.value}</span>{o.description?.[lang] && <span className="mt-1 block text-xs leading-5 text-slate-500">{o.description[lang]}</span>}</span></div></button>); })}</div>
  );
  if (question.type === 'multi') { const selected = Array.isArray(value) ? value : []; return (
    <div className="grid gap-3">{question.options?.map(o => { const active = selected.includes(o.value); return (<button key={o.value} type="button" onClick={() => { if (o.value === 'skip') return onChange(['skip']); const next = active ? selected.filter(i => i !== o.value) : [...selected.filter(i => i !== 'skip'), o.value]; onChange(next); }} className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-4 ring-emerald-100' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200 hover:bg-white'}`}><span className="flex items-center gap-3"><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}><Check className="h-3.5 w-3.5" /></span>{o.label?.[lang] || o.value}</span></button>); })}</div>
  ); }
  if (question.type === 'group') { const gv = value || {}; return (
    <div className="grid gap-4 sm:grid-cols-2">{question.fields?.map(f => (<div key={f.key}><label className="mb-2 block text-sm font-bold text-slate-700">{f.label?.[lang]} {f.required && <span className="text-emerald-600">*</span>}</label>{f.type === 'select' ? (<select value={gv[f.key] || ''} onChange={e => onChange({ ...gv, [f.key]: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-950 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"><option value="">{lang === 'tr' ? 'Seçiniz' : 'Select'}</option>{f.options?.map(o => <option key={o.value} value={o.value}>{o.label?.[lang] || o.value}</option>)}</select>) : (<input value={gv[f.key] || ''} onChange={e => onChange({ ...gv, [f.key]: e.target.value })} placeholder={f.placeholder?.[lang] || ''} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-950 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100" />)}</div>))}</div>
  ); }
  return null;
}

function SystemMessage({ type, text }) {
  const styles = { error: 'border-red-200 bg-red-50 text-red-700', warning: 'border-amber-200 bg-amber-50 text-amber-800', info: 'border-blue-200 bg-blue-50 text-blue-800', success: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  const Icon = type === 'error' ? AlertCircle : type === 'success' ? CheckCircle2 : type === 'warning' ? AlertCircle : Sparkles;
  return <div className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 ${styles[type] || styles.info}`}><Icon className="mt-0.5 h-5 w-5 shrink-0" /><p>{text}</p></div>;
}

function AssumptionsPanel({ lang, assumptions }) {
  return (
    <details className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 open:shadow-sm">
      <summary className="cursor-pointer font-bold">{lang === 'tr' ? 'Kayıtlı kabuller' : 'Recorded assumptions'} · {assumptions.length}</summary>
      <div className="mt-4 space-y-3">{assumptions.map(a => (<div key={`${a.questionId}-${a.trigger}`} className="rounded-2xl bg-white p-4 ring-1 ring-amber-200"><div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">Tip {a.type}</span><span className="text-xs font-bold text-slate-400">{a.questionId}</span></div><p className="font-semibold text-slate-800">{a.text?.[lang] || a.text?.en}</p>{a.impact && <p className="mt-1 text-xs leading-5 text-slate-500">{a.impact}</p>}</div>))}</div>
    </details>
  );
}

function CompletionView({ lang, answers, assumptions, reset }) {
  return (
    <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-600 text-white shadow-xl shadow-emerald-600/20"><CheckCircle2 className="h-8 w-8" /></div>
      <h3 className="text-3xl font-bold tracking-tight text-slate-950">{lang === 'tr' ? 'Chatbot akışı tamamlandı' : 'Chatbot flow completed'}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">{lang === 'tr' ? 'Cevaplarınız kaydedildi.' : 'Your answers have been saved.'}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-3xl font-bold text-slate-950">{Object.keys(answers).length}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{lang === 'tr' ? 'Cevap' : 'Answers'}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-3xl font-bold text-amber-800">{assumptions.length}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-600">{lang === 'tr' ? 'Kabul' : 'Assumptions'}</p></div>
      </div>
      <button onClick={reset} className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:text-red-600"><RotateCcw className="h-4 w-4" />{lang === 'tr' ? 'Baştan başlat' : 'Start over'}</button>
    </div>
  );
}

/* ═══ Utility functions ═══ */
function normalizeValue(q, v) { if (q.type === 'number') return v === '' || v == null ? '' : Number(v); if (q.type === 'info') return Boolean(v); if (q.type === 'multi') return Array.isArray(v) ? v : []; return v; }

function validateAnswer(q, v, answers, lang) {
  if (q.required) {
    if (q.type === 'multi' && (!Array.isArray(v) || v.length === 0)) return { ok: false, message: lang === 'tr' ? 'En az bir seçenek seçin.' : 'Select at least one option.' };
    if (q.type === 'group') { const missing = q.fields?.some(f => f.required && !String(v?.[f.key] || '').trim()); if (missing) return { ok: false, message: lang === 'tr' ? 'Zorunlu alanları doldurun.' : 'Fill required fields.' }; }
    if (q.type === 'info' && !v) return { ok: false, message: lang === 'tr' ? 'Onay kutusunu işaretleyin.' : 'Check the confirmation box.' };
    if (!['multi', 'group', 'info'].includes(q.type) && (v === undefined || v === null || String(v).trim() === '')) return { ok: false, message: lang === 'tr' ? 'Bu alan zorunludur.' : 'This field is required.' };
  }
  if (q.validation?.kind === 'digits') { const t = String(v || ''); if (!/^\d+$/.test(t) || t.length !== q.validation.length) return { ok: false, message: lang === 'tr' ? `${q.validation.length} haneli rakam girin.` : `Enter exactly ${q.validation.length} digits.` }; }
  if (q.validation?.kind === 'text') { const t = String(v || ''); if (q.validation.min && t.trim().length < q.validation.min) return { ok: false, message: lang === 'tr' ? 'Boş bırakılamaz.' : 'Cannot be empty.' }; if (q.validation.max && t.length > q.validation.max) return { ok: false, message: lang === 'tr' ? `En fazla ${q.validation.max} karakter.` : `Max ${q.validation.max} characters.` }; }
  if (q.type === 'number') { if (q.min != null && Number(v) < q.min) return { ok: false, message: lang === 'tr' ? `En az ${q.min}.` : `Min ${q.min}.` }; if (q.max != null && Number(v) > q.max) return { ok: false, message: lang === 'tr' ? `En fazla ${q.max}.` : `Max ${q.max}.` }; }
  if (q.customValidate === 'baselineBeforeReportingYear') { const ry = Number(answers.reporting_year); const by = Number(v); if (by && ry && by >= ry) return { ok: false, message: lang === 'tr' ? 'Baz yıl raporlama yılından önce olmalı.' : 'Baseline must be before reporting year.' }; }
  return { ok: true };
}

function getNextQuestionId(q, v, answers) { if (q.conditionalNext) { const m = q.conditionalNext.find(r => matchesRule(r.when, v, answers)); if (m) return m.next; } return q.next; }

function applyEffects(q, v, answers, lang) {
  const messages = [], assumptions = [], nextAnswers = {};
  q.effects?.forEach(e => { if (!matchesRule(e.when, v, answers)) return; if (e.message) messages.push({ type: e.message.type || 'info', text: e.message[lang] || e.message.en }); if (e.assumption) assumptions.push({ ...e.assumption, questionId: q.id }); if (e.set) Object.assign(nextAnswers, e.set); });
  return { messages, assumptions, nextAnswers: Object.keys(nextAnswers).length > 0 ? nextAnswers : null };
}

function matchesRule(rule, v, answers) { if (!rule) return false; const t = rule.field ? v?.[rule.field] : v; if (rule.equals !== undefined) return t === rule.equals; if (rule.includes !== undefined) return Array.isArray(t) && t.includes(rule.includes); if (rule.numericGte !== undefined) return Number(t) >= rule.numericGte; return false; }

function mergeAssumptions(prev, next, qId) { const key = i => `${i.questionId || qId}-${i.trigger}`; const map = new Map(prev.map(i => [key(i), i])); next.forEach(i => map.set(key(i), { ...i, questionId: i.questionId || qId })); return Array.from(map.values()); }

function persistState(state) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }

async function saveAnswerToApi(payload) {
  try {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const token = typeof window !== 'undefined' ? localStorage.getItem('_dev_access_token') : null;
    await fetch(`${API}/questionnaire/carboniq/answer/`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: 'include', body: JSON.stringify({ question_id: payload.question.id, field: payload.question.field, value: payload.value, stage: payload.question.stage, assumptions: payload.assumptions || [] }) });
  } catch {}
}
