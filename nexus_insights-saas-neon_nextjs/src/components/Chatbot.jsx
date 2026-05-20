'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  MessageCircle, X, Send, RotateCcw, AlertTriangle,
  CheckCircle2, ChevronDown, Search, Info,
} from 'lucide-react';
import { api } from '@/lib/utils/api';

// ─── Phase meta ───────────────────────────────────────────────────────────────
const PHASE_META = {
  '1A': { label_tr: 'İdari Bilgiler',       label_en: 'Administrative Info',     color: 'bg-blue-500' },
  '1B': { label_tr: 'Faaliyet Profili',     label_en: 'Activity Profile',        color: 'bg-blue-500' },
  '1C': { label_tr: 'Yapısal Bilgiler',     label_en: 'Structural Info',         color: 'bg-blue-500' },
  '1D': { label_tr: 'Raporlama Tercihleri', label_en: 'Reporting Preferences',   color: 'bg-blue-500' },
  '2':  { label_tr: 'Organizasyon Sınırı',  label_en: 'Org. Boundary',           color: 'bg-indigo-500' },
  '3':  { label_tr: 'Kapsam 1',             label_en: 'Scope 1',                 color: 'bg-orange-500' },
  '4':  { label_tr: 'Kapsam 2',             label_en: 'Scope 2',                 color: 'bg-yellow-500' },
  '5':  { label_tr: 'Kapsam 3',             label_en: 'Scope 3',                 color: 'bg-purple-500' },
  '6A': { label_tr: 'Hariç Tutmalar',       label_en: 'Exclusions',              color: 'bg-gray-500' },
  '6B': { label_tr: 'Kabuller',             label_en: 'Assumptions',             color: 'bg-gray-500' },
  '6C': { label_tr: 'İstisnalar',           label_en: 'Exceptions',              color: 'bg-gray-500' },
  '6D': { label_tr: 'Eşik',                 label_en: 'Threshold',               color: 'bg-gray-500' },
  '6E': { label_tr: 'Belirsizlik',          label_en: 'Uncertainty',             color: 'bg-gray-500' },
  '6F': { label_tr: 'Baz Yıl',              label_en: 'Base Year',               color: 'bg-gray-500' },
  '7':  { label_tr: 'Rapor Üretimi',        label_en: 'Report Generation',       color: 'bg-green-500' },
};

const PHASE_ORDER = ['1A','1B','1C','1D','2','3','4','5','6A','6B','6C','6D','6E','6F','7'];
const TOTAL_PHASES = PHASE_ORDER.length;

// ─── Year options ──────────────────────────────────────────────────────────────
const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => 2015 + i);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function phaseIndex(phase) {
  return PHASE_ORDER.indexOf(phase);
}

// ─── Input components ─────────────────────────────────────────────────────────

function TextInput({ question, value, onChange, lang }) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={lang === 'tr' ? question.placeholder_tr : question.placeholder_en}
        maxLength={question.max_length || undefined}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
      />
    </div>
  );
}

function TextareaInput({ question, value, onChange, lang }) {
  const max = question.max_length || 200;
  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={lang === 'tr' ? question.placeholder_tr : question.placeholder_en}
        maxLength={max}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none resize-none"
      />
      <div className={`text-xs mt-1 text-right ${value.length >= max ? 'text-red-500' : 'text-gray-400'}`}>
        {value.length}/{max}
      </div>
    </div>
  );
}

function NumberInput({ question, value, onChange, lang }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={lang === 'tr' ? question.placeholder_tr : question.placeholder_en}
      min={question.min ?? undefined}
      max={question.max ?? undefined}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
    />
  );
}

function YearPicker({ question, value, onChange, lang }) {
  const refYear = question.reference_year;
  const years = YEAR_OPTIONS.filter(y => !refYear || y < refYear);
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none bg-white"
    >
      <option value="">{lang === 'tr' ? 'Yıl seçin...' : 'Select year...'}</option>
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}

function DropdownInput({ question, value, onChange, lang }) {
  const opts = question.options || [];
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none bg-white"
    >
      <option value="">{lang === 'tr' ? 'Seçin...' : 'Select...'}</option>
      {opts.map(o => (
        <option key={o.key} value={o.key}>
          {lang === 'tr' ? o.text_tr || o.text : o.text_en || o.text}
        </option>
      ))}
    </select>
  );
}

function SearchDropdown({ question, value, onChange, lang }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const opts = question.options || [];

  const filtered = useMemo(() =>
    opts.filter(o => {
      const txt = lang === 'tr' ? (o.text_tr || o.text) : (o.text_en || o.text);
      return txt.toLowerCase().includes(query.toLowerCase()) || o.key.toLowerCase().includes(query.toLowerCase());
    }).slice(0, 12),
  [opts, query, lang]);

  const selected = opts.find(o => o.key === value);
  const displayText = selected ? (lang === 'tr' ? selected.text_tr || selected.text : selected.text_en || selected.text) : '';

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer bg-white focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary"
        onClick={() => setOpen(o => !o)}
      >
        <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={open ? query : displayText}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(''); }}
          placeholder={lang === 'tr' ? question.placeholder_tr || 'Arayın...' : question.placeholder_en || 'Search...'}
          className="flex-1 outline-none bg-transparent"
          onFocus={() => setOpen(true)}
        />
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(o => (
            <button
              key={o.key}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 hover:text-primary transition-colors"
              onMouseDown={e => {
                e.preventDefault();
                onChange(o.key);
                setQuery('');
                setOpen(false);
              }}
            >
              {lang === 'tr' ? o.text_tr || o.text : o.text_en || o.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BinaryInput({ question, value, onChange, lang }) {
  const opts = question.options || [
    { key: 'yes', text_tr: 'Evet', text_en: 'Yes' },
    { key: 'no',  text_tr: 'Hayır', text_en: 'No' },
  ];
  return (
    <div className="flex gap-3">
      {opts.map(o => {
        const txt = lang === 'tr' ? o.text_tr || o.text : o.text_en || o.text;
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
              active
                ? 'border-primary bg-primary text-white shadow-md shadow-primary/30'
                : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40'
            }`}
          >
            {txt}
          </button>
        );
      })}
    </div>
  );
}

function SingleChoice({ question, selected, onToggle, inputValues, onInputChange, lang }) {
  const opts = question.options || [];
  return (
    <div className="space-y-2">
      {opts.map(o => {
        const txt = lang === 'tr' ? o.text_tr || o.text : o.text_en || o.text;
        const active = selected === o.key;
        return (
          <div key={o.key}>
            <button
              type="button"
              onClick={() => onToggle(o.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                active
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-primary' : 'border-gray-300'}`}>
                  {active && <div className="w-2 h-2 bg-primary rounded-full" />}
                </div>
                <span>{txt}</span>
                {o.warning && <span className="text-amber-500 text-xs ml-auto">⚠️</span>}
              </div>
            </button>
            {o.has_input && active && (
              <div className="mt-1.5 ml-6">
                <label className="text-xs text-gray-500 mb-1 block">
                  {lang === 'tr' ? o.input_label_tr || o.input_label : o.input_label_en || o.input_label}
                </label>
                <SubInput optKey={o.key} inputType={o.input_type} value={inputValues[o.key] || ''} onChange={v => onInputChange(o.key, v)} lang={lang} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MultiChoice({ question, selected, onToggle, inputValues, onInputChange, lang }) {
  const opts = question.options || [];
  return (
    <div className="space-y-2">
      {opts.map(o => {
        const txt = lang === 'tr' ? o.text_tr || o.text : o.text_en || o.text;
        const active = selected.includes(o.key);
        return (
          <div key={o.key}>
            <button
              type="button"
              onClick={() => onToggle(o.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                active
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                  {active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span>{txt}</span>
                {o.warning && <span className="text-amber-500 text-xs ml-auto">⚠️</span>}
              </div>
            </button>
            {o.has_input && active && (
              <div className="mt-1.5 ml-6">
                <label className="text-xs text-gray-500 mb-1 block">
                  {lang === 'tr' ? o.input_label_tr || o.input_label : o.input_label_en || o.input_label}
                </label>
                <SubInput optKey={o.key} inputType={o.input_type} value={inputValues[o.key] || ''} onChange={v => onInputChange(o.key, v)} lang={lang} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubInput({ optKey, inputType, value, onChange, lang }) {
  if (inputType === 'year') return (
    <input type="number" min="2010" max="2030" placeholder="2024"
      value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" />
  );
  if (inputType === 'date') return (
    <input type="date" value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" />
  );
  if (inputType === 'date_range') return (
    <div className="flex gap-2">
      <input type="date" value={value.split('|')[0] || ''} onChange={e => onChange(`${e.target.value}|${value.split('|')[1] || ''}`)}
        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" />
      <input type="date" value={value.split('|')[1] || ''} onChange={e => onChange(`${value.split('|')[0] || ''}|${e.target.value}`)}
        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" />
    </div>
  );
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" />
  );
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────
function PhaseBar({ currentPhase, lang }) {
  const idx = phaseIndex(currentPhase);
  const pct = idx < 0 ? 100 : Math.round(((idx + 1) / TOTAL_PHASES) * 100);
  const meta = PHASE_META[currentPhase];
  const label = meta ? (lang === 'tr' ? meta.label_tr : meta.label_en) : '';
  return (
    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 font-medium">
          {label || (lang === 'tr' ? 'Tamamlandı' : 'Complete')}
        </span>
        <span className="text-xs text-gray-400">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Chatbot ──────────────────────────────────────────────────────────────
export default function Chatbot({ language = 'tr', onComplete }) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentPhase, setCurrentPhase] = useState('1A');

  // For choice-type questions
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [inputValues, setInputValues] = useState({});   // for sub-inputs inside options

  // For direct-input questions (text, number, dropdown, etc.)
  const [directValue, setDirectValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [allWarnings, setAllWarnings] = useState([]);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  // Stable ID counter — gives each message a unique key so React never reorders
  // on list updates (array-index keys flip when earlier messages are removed).
  const msgIdRef = useRef(0);

  const lang = language;

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const isDirectType = (q) => q && ['text_input', 'textarea', 'number', 'year_picker', 'dropdown', 'search_dropdown', 'binary'].includes(q.type);
  const isChoiceType = (q) => q && ['single', 'multi'].includes(q.type);

  // ── Start / Resume ──────────────────────────────────────────────────────────
  const startChat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.startQuestionnaire(lang);
      if (res?.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        setComplete(false);
        setAllWarnings(data.warnings || []);

        if (data.resumed && Object.keys(data.answers || {}).length > 0) {
          const answeredCount = Object.keys(data.answers).length;
          addBotMessage(lang === 'tr'
            ? `👋 Kaldığınız yerden devam ediyoruz... (${answeredCount} soru tamamlandı)`
            : `👋 Resuming where you left off... (${answeredCount} questions completed)`);
        } else {
          addBotMessage(lang === 'tr'
            ? '👋 Merhaba! CarbonIQ envanter sihirbazına hoş geldiniz. ISO 14064-1 standardına uygun raporunuzu birlikte hazırlayacağız.'
            : '👋 Welcome to the CarbonIQ inventory wizard. We will prepare your ISO 14064-1 report together.');
        }

        if (data.question) {
          setTimeout(() => showQuestion(data.question), 500);
        }
      }
    } catch (err) {
      setError(lang === 'tr' ? 'Bağlantı hatası.' : 'Connection error.');
    } finally {
      setLoading(false);
    }
  }, [lang, addBotMessage, showQuestion]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    if (!sessionId) startChat();
  }, [sessionId, startChat]);

  // ── Message helpers ─────────────────────────────────────────────────────────
  const addBotMessage = useCallback((text) => {
    const id = ++msgIdRef.current;
    setMessages(prev => [...prev, { id, type: 'bot', text }]);
  }, []);

  const showQuestion = useCallback((q) => {
    const id = ++msgIdRef.current;
    setMessages(prev => [...prev, { id, type: 'question', data: q }]);
    setCurrentQuestion(q);
    setCurrentPhase(q.phase || '1A');
    setSelectedOptions([]);
    setInputValues({});
    setDirectValue('');
    setError('');
  }, []);

  // ── Option toggle ────────────────────────────────────────────────────────────
  const toggleOption = useCallback((key) => {
    if (!currentQuestion) return;
    if (currentQuestion.type === 'single') {
      setSelectedOptions([key]);
    } else {
      setSelectedOptions(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }
  }, [currentQuestion]);

  // ── Validation ───────────────────────────────────────────────────────────────
  const canSubmit = useMemo(() => {
    if (!currentQuestion || loading || complete) return false;
    const q = currentQuestion;
    if (isDirectType(q)) {
      if (q.type === 'binary') return !!directValue;
      if (!q.required) return true;   // optional direct fields can submit empty
      return directValue.trim().length > 0;
    }
    if (isChoiceType(q)) {
      if (selectedOptions.length === 0) return false;
      const needsInput = (q.options || []).filter(o => selectedOptions.includes(o.key) && o.has_input);
      return needsInput.every(o => {
        const v = inputValues[o.key];
        return v !== undefined && String(v).trim().length > 0;
      });
    }
    return false;
  }, [currentQuestion, directValue, selectedOptions, inputValues, loading, complete]);

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmitAnswer = useCallback(async () => {
    if (!canSubmit || !currentQuestion) return;
    setLoading(true);
    setError('');

    const q = currentQuestion;
    let answerData = {};
    let userText = '';

    if (isDirectType(q)) {
      const val = directValue.trim();
      answerData = { value: val };
      if (q.type === 'binary') {
        // Find option label for display
        const opt = (q.options || []).find(o => o.key === val);
        userText = opt ? (lang === 'tr' ? opt.text_tr || opt.text : opt.text_en || opt.text) : val;
      } else if (q.type === 'dropdown' || q.type === 'search_dropdown') {
        const opt = (q.options || []).find(o => o.key === val);
        userText = opt ? (lang === 'tr' ? opt.text_tr || opt.text : opt.text_en || opt.text) : val;
      } else {
        userText = val;
      }
    } else {
      // choice types
      const selectedOpts = (q.options || []).filter(o => selectedOptions.includes(o.key));
      answerData = {
        selected: q.type === 'single' ? selectedOptions[0] : selectedOptions,
      };
      for (const opt of selectedOpts.filter(o => o.has_input)) {
        answerData[`input_${opt.key}`] = inputValues[opt.key];
      }
      userText = selectedOpts.map(o => {
        const txt = lang === 'tr' ? o.text_tr || o.text : o.text_en || o.text;
        return o.has_input && inputValues[o.key] ? `${txt}: ${inputValues[o.key]}` : txt;
      }).join(', ');
    }

    const userId = ++msgIdRef.current;
    setMessages(prev => [...prev, { id: userId, type: 'user', text: userText }]);

    try {
      const res = await api.answerQuestion({
        session_id: sessionId,
        question_id: q.id,
        answer: answerData,
        lang,
      });

      if (res?.ok) {
        const data = await res.json();

        // Show warnings as amber messages
        for (const w of (data.warnings || [])) {
          const wId = ++msgIdRef.current;
          setMessages(prev => [...prev, {
            id: wId,
            type: 'warning',
            text: lang === 'tr' ? w.text_tr : w.text_en,
          }]);
        }
        setAllWarnings(data.all_warnings || []);

        if (data.is_complete) {
          setComplete(true);
          setCurrentQuestion(null);
          setCurrentPhase('done');
          const successId = ++msgIdRef.current;
          setMessages(prev => [...prev, {
            id: successId,
            type: 'success',
            text: lang === 'tr'
              ? '✅ Harika! Tüm sorular tamamlandı. Verileriniz kaydedildi. Artık emisyon verisi girişine başlayabilirsiniz.'
              : '✅ All done! Your answers are saved. You can now start entering emission data.',
          }]);
          if (onComplete) onComplete();
        } else if (data.question) {
          setTimeout(() => showQuestion(data.question), 400);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || (lang === 'tr' ? 'Bir hata oluştu.' : 'An error occurred.'));
      }
    } catch (err) {
      setError(lang === 'tr' ? 'Bağlantı hatası.' : 'Connection error.');
    } finally {
      setLoading(false);
    }
  }, [canSubmit, currentQuestion, directValue, selectedOptions, inputValues, sessionId, lang, onComplete, showQuestion]);

  const handleReset = useCallback(async () => {
    await api.resetQuestionnaire().catch(() => {});
    setSessionId(null);
    setMessages([]);
    setCurrentQuestion(null);
    setSelectedOptions([]);
    setInputValues({});
    setDirectValue('');
    setComplete(false);
    setAllWarnings([]);
    setCurrentPhase('1A');
    setError('');
    startChat();
  }, [startChat]);

  // ── Skip (optional questions) ─────────────────────────────────────────────────
  const handleSkip = useCallback(async () => {
    if (!currentQuestion) return;
    setLoading(true);
    try {
      const res = await api.answerQuestion({
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer: { skipped: true },
        lang,
      });
      if (res?.ok) {
        const data = await res.json();
        const skipId = ++msgIdRef.current;
        setMessages(prev => [...prev, { id: skipId, type: 'skip', text: lang === 'tr' ? '— Atlandı' : '— Skipped' }]);
        if (data.is_complete) {
          setComplete(true);
          setCurrentQuestion(null);
          if (onComplete) onComplete();
        } else if (data.question) {
          setTimeout(() => showQuestion(data.question), 300);
        }
      }
    } catch {}
    finally { setLoading(false); }
  }, [currentQuestion, sessionId, lang, onComplete, showQuestion]);

  // ─── Render input area based on type ─────────────────────────────────────────
  const renderInput = () => {
    if (!currentQuestion || loading || complete) return null;
    const q = currentQuestion;
    const helper = lang === 'tr' ? q.helper_tr || q.helper : q.helper_en || q.helper;

    return (
      <div className="border-t border-gray-200 p-3 flex-shrink-0 max-h-[55%] overflow-y-auto">
        {/* Helper text */}
        {helper && (
          <div className="flex gap-1.5 mb-3 p-2 bg-blue-50 rounded-lg">
            <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">{helper}</p>
          </div>
        )}

        {/* Input area */}
        <div className="mb-3">
          {q.type === 'text_input' && (
            <TextInput question={q} value={directValue} onChange={setDirectValue} lang={lang} />
          )}
          {q.type === 'textarea' && (
            <TextareaInput question={q} value={directValue} onChange={setDirectValue} lang={lang} />
          )}
          {q.type === 'number' && (
            <NumberInput question={q} value={directValue} onChange={setDirectValue} lang={lang} />
          )}
          {q.type === 'year_picker' && (
            <YearPicker question={q} value={directValue} onChange={setDirectValue} lang={lang} />
          )}
          {q.type === 'dropdown' && (
            <DropdownInput question={q} value={directValue} onChange={setDirectValue} lang={lang} />
          )}
          {q.type === 'search_dropdown' && (
            <SearchDropdown question={q} value={directValue} onChange={setDirectValue} lang={lang} />
          )}
          {q.type === 'binary' && (
            <BinaryInput question={q} value={directValue} onChange={setDirectValue} lang={lang} />
          )}
          {q.type === 'single' && (
            <SingleChoice
              question={q}
              selected={selectedOptions[0] || ''}
              onToggle={toggleOption}
              inputValues={inputValues}
              onInputChange={(k, v) => setInputValues(prev => ({ ...prev, [k]: v }))}
              lang={lang}
            />
          )}
          {q.type === 'multi' && (
            <MultiChoice
              question={q}
              selected={selectedOptions}
              onToggle={toggleOption}
              inputValues={inputValues}
              onInputChange={(k, v) => setInputValues(prev => ({ ...prev, [k]: v }))}
              lang={lang}
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {error}
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          {!q.required && q.required !== true && (
            <button
              type="button"
              onClick={handleSkip}
              className="px-3 py-2.5 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              {lang === 'tr' ? 'Atla' : 'Skip'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmitAnswer}
            disabled={!canSubmit}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              canSubmit
                ? 'bg-primary text-white hover:bg-secondary cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
            {lang === 'tr' ? 'Gönder' : 'Submit'}
          </button>
        </div>
      </div>
    );
  };

  // ─── Message renderer ─────────────────────────────────────────────────────────
  // Uses msg.id (stable counter) as key — not array index, which flips on removes.
  const renderMessage = (msg) => {
    if (msg.type === 'bot') return (
      <div key={msg.id} className="flex gap-2">
        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <MessageCircle className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
          <p className="text-sm text-gray-800">{msg.text}</p>
        </div>
      </div>
    );

    if (msg.type === 'user') return (
      <div key={msg.id} className="flex justify-end">
        <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
          <p className="text-sm">{msg.text}</p>
        </div>
      </div>
    );

    if (msg.type === 'skip') return (
      <div key={msg.id} className="flex justify-end">
        <div className="bg-gray-200 text-gray-500 rounded-2xl rounded-tr-sm px-4 py-2 max-w-[60%]">
          <p className="text-xs italic">{msg.text}</p>
        </div>
      </div>
    );

    if (msg.type === 'warning') return (
      <div key={msg.id} className="flex gap-2">
        <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
          <p className="text-sm text-amber-800">{msg.text}</p>
        </div>
      </div>
    );

    if (msg.type === 'success') return (
      <div key={msg.id} className="flex gap-2">
        <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
          <p className="text-sm text-green-800 font-medium">{msg.text}</p>
          {allWarnings.length > 0 && (
            <p className="text-xs text-amber-700 mt-1">
              ⚠️ {allWarnings.length} {lang === 'tr' ? 'uyarı kaydedildi' : 'warning(s) recorded'}
            </p>
          )}
        </div>
      </div>
    );

    if (msg.type === 'question') {
      const q = msg.data;
      const qText = lang === 'tr' ? q.text_tr || q.text : q.text_en || q.text;
      const phaseLabel = q.phase && PHASE_META[q.phase]
        ? (lang === 'tr' ? PHASE_META[q.phase].label_tr : PHASE_META[q.phase].label_en)
        : '';
      return (
        <div key={msg.id} className="flex gap-2">
          <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <MessageCircle className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
            {phaseLabel && (
              <span className="text-xs text-primary/70 font-medium block mb-1">{phaseLabel} · {q.id}</span>
            )}
            <p className="text-sm font-medium text-gray-900">{qText}</p>
            {q.type === 'multi' && (
              <p className="text-xs text-gray-500 mt-0.5">
                {lang === 'tr' ? '(Birden fazla seçebilirsiniz)' : '(Multiple selection allowed)'}
              </p>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  // ─── UI ───────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center text-white hover:scale-110 transition-transform"
          aria-label="Open CarbonIQ wizard"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[400px] h-full sm:h-[620px] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-secondary px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">CarbonIQ Sihirbazı</h3>
                <p className="text-white/70 text-xs">ISO 14064-1 · 133 Soru</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {sessionId && (
                <button onClick={handleReset} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title={lang === 'tr' ? 'Yeniden başla' : 'Restart'}>
                  <RotateCcw className="w-4 h-4 text-white" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Phase progress bar */}
          <PhaseBar currentPhase={complete ? 'done' : currentPhase} lang={lang} />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(renderMessage)}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-3.5 h-3.5 text-primary" />
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

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {renderInput()}
        </div>
      )}
    </>
  );
}
