'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Info,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  CARBONIQ_STAGES,
  getInitialQuestionId,
  getNextQuestionId,
  getQuestionById,
  getQuestionWarning,
  getTriggeredAssumptions,
  validateCarbonIQAnswer,
} from '@/lib/carboniq/questions';

export default function CarbonAIPage({ language = 'en' }) {
  const lang = language === 'tr' ? 'tr' : 'en';

  const [started, setStarted] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [currentId, setCurrentId] = useState(getInitialQuestionId());
  const [answers, setAnswers] = useState({});
  const [answerValue, setAnswerValue] = useState('');
  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      type: 'welcome',
      content:
        lang === 'tr'
          ? 'Merhaba, ben CarbonIQ \ud83d\udc4b ISO 14064-1 uyumlu karbon envanterinizi ad\u0131m ad\u0131m birlikte olu\u015fturaca\u011f\u0131z.'
          : "Hi, I\u2019m CarbonIQ \ud83d\udc4b I\u2019ll help you build your carbon inventory step by step.",
    },
  ]);
  const [error, setError] = useState('');
  const [assumptions, setAssumptions] = useState([]);
  const [completed, setCompleted] = useState(false);
  const scrollRef = useRef(null);

  const question = getQuestionById(currentId);
  const stage = CARBONIQ_STAGES.find((item) => item.id === question?.stage);
  const answeredCount = Object.keys(answers).length;
  const progress = Math.min(Math.round((answeredCount / 133) * 100), 100);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, error, currentId]);

  const currentQuestionMessage = useMemo(() => {
    if (!question || completed) return null;
    return {
      role: 'assistant',
      type: 'question',
      question,
      content: question.text?.[lang],
      helper: question.helper?.[lang],
    };
  }, [question, completed, lang]);

  const submitAnswer = () => {
    if (!question) return;
    const normalizedValue = normalizeAnswerValue(question, answerValue);
    const validation = validateCarbonIQAnswer(question, normalizedValue, answers, lang);

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    const userLabel = getDisplayValue(question, normalizedValue, lang);
    const nextWarning = getQuestionWarning(question, normalizedValue, lang);
    const triggeredAssumptions = getTriggeredAssumptions(question, normalizedValue, lang);
    const nextAnswers = { ...answers, [question.id]: normalizedValue };
    const nextId = getNextQuestionId(question, normalizedValue);

    setAnswers(nextAnswers);
    setHistory((prev) => [...prev, question.id]);
    setError('');

    const nextMessages = [{ role: 'user', type: 'answer', content: userLabel }];

    if (nextWarning) {
      nextMessages.push({ role: 'assistant', type: 'warning', content: nextWarning });
    }

    if (triggeredAssumptions.length > 0) {
      setAssumptions((prev) => [...prev, ...triggeredAssumptions]);
      nextMessages.push({
        role: 'assistant',
        type: 'info',
        content:
          lang === 'tr'
            ? '\ud83d\udca1 Bu yan\u0131t i\u00e7in bir kabul kayd\u0131 olu\u015fturdum. A\u015fama 6B\u2019de birlikte g\u00f6zden ge\u00e7irece\u011fiz.'
            : "\ud83d\udca1 I created an assumption record for this answer. We\u2019ll review it together in Stage 6B.",
      });
    }

    if (!nextId || !getQuestionById(nextId)) {
      nextMessages.push({
        role: 'assistant',
        type: 'success',
        content:
          lang === 'tr'
            ? '\u2705 Bu b\u00f6l\u00fcm tamamland\u0131. Yan\u0131tlar\u0131n\u0131z\u0131 kaydettim.'
            : '\u2705 This section is complete. I saved your answers.',
      });
      setMessages((prev) => [...prev, ...nextMessages]);
      setCompleted(true);
      setAnswerValue('');
      return;
    }

    setMessages((prev) => [...prev, ...nextMessages]);
    setCurrentId(nextId);
    setAnswerValue(getInitialValue(getQuestionById(nextId)));
  };

  const goBack = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((prev) => prev.slice(0, -1));
    setCurrentId(previous);
    setAnswerValue(answers[previous] || getInitialValue(getQuestionById(previous)));
    setError('');
    setCompleted(false);
  };

  const resetFlow = () => {
    setCurrentId(getInitialQuestionId());
    setAnswers({});
    setAnswerValue('');
    setHistory([]);
    setError('');
    setAssumptions([]);
    setCompleted(false);
    setMessages([
      {
        role: 'assistant',
        type: 'welcome',
        content:
          lang === 'tr'
            ? 'Merhaba, ben CarbonIQ \ud83d\udc4b ISO 14064-1 uyumlu karbon envanterinizi ad\u0131m ad\u0131m birlikte olu\u015fturaca\u011f\u0131z.'
            : "Hi, I\u2019m CarbonIQ \ud83d\udc4b I\u2019ll help you build your carbon inventory step by step.",
      },
    ]);
  };

  // ─── Welcome Screen ───
  if (!started) {
    return (
      <section className="relative mx-auto flex h-[calc(100vh-120px)] max-w-[1280px] flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#F9EFE5] via-[#FDFCFA] to-[#EEF2D3]/40 px-4 text-center sm:px-6 lg:px-10">
        {/* Glows */}
        <div className="pointer-events-none absolute left-[5%] top-[10%] h-[220px] w-[220px] rounded-full bg-[#95A847]/15 blur-[90px]" />
        <div className="pointer-events-none absolute bottom-[10%] right-[8%] h-[180px] w-[180px] rounded-full bg-[#B4BE6A]/12 blur-[70px]" />

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#95A847]/25 bg-white/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#75863B] shadow-sm backdrop-blur-xl">
          <Sparkles className="h-3 w-3 text-[#95A847]" />
          {lang === 'tr' ? 'AI destekli karbon raporlama' : 'AI-powered carbon reporting'}
        </div>

        {/* Hero Image */}
        <div className="relative mt-2 h-[200px] w-[200px] sm:h-[220px] sm:w-[220px] lg:h-[240px] lg:w-[240px]">
          <div className="absolute inset-[-70px] rounded-full bg-[#95A847]/18 blur-[90px]" />
          <img
            src="/chatbot.png"
            alt="CarbonIQ"
            className="relative h-full w-full object-contain drop-shadow-[0_20px_60px_rgba(48,40,23,0.08)] transition-transform duration-500 ease-out hover:scale-110 hover:rotate-[4deg] cursor-pointer"
            style={{ animation: 'float 5s ease-in-out infinite' }}
          />
        </div>

        {/* Title */}
        <h1 className="mt-6 max-w-[580px] text-[26px] font-bold leading-[1.08] tracking-[-0.04em] text-[#302817] sm:text-[34px] lg:text-[40px]">
          {lang === 'tr'
            ? 'Karbon envanterinizi AI ile oluşturun'
            : 'Build your carbon inventory with AI'}
        </h1>

        {/* Subtitle */}
        <p className="mt-4 max-w-[440px] text-[13px] leading-5 text-[#302817]/50">
          {lang === 'tr'
            ? 'CarbonIQ, ISO 14064-1 raporlama sürecinizi akıllı iş akışları ile adım adım tamamlar.'
            : 'CarbonIQ helps you complete ISO 14064 reporting step by step with intelligent workflows.'}
        </p>

        {/* CTA */}
        <div className="mt-6 flex items-center gap-2.5">
          <button
            onClick={() => setStarted(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#302817] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(48,40,23,0.2)] transition hover:-translate-y-0.5 hover:bg-black"
          >
            {lang === 'tr' ? 'Envanteri Başlat' : 'Start Inventory'}
            <Send className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#95A847]/30 bg-white/60 px-4 py-3 text-sm font-bold text-[#75863B] backdrop-blur-sm transition hover:bg-[#95A847]/10"
          >
            <Bot className="h-3.5 w-3.5" />
            {lang === 'tr' ? 'Nasıl çalışır?' : 'How it works'}
          </button>
        </div>

        {/* Functional Cards */}
        <div className="mt-6 grid w-full max-w-[640px] grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { icon: '📋', tr: 'Ankete Devam', en: 'Continue Survey', sub: { tr: '3/133 tamamlandı', en: '3/133 completed' } },
            { icon: '📎', tr: 'Kanıt Yükle', en: 'Upload Evidence', sub: { tr: 'Fatura & belgeler', en: 'Invoices & docs' } },
            { icon: '📄', tr: 'Rapor Oluştur', en: 'Generate Report', sub: { tr: 'ISO 14064-1 PDF', en: 'ISO 14064-1 PDF' } },
            { icon: '💡', tr: 'AI Önerileri', en: 'AI Suggestions', sub: { tr: 'Azaltma fırsatları', en: 'Reduction tips' } },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => setStarted(true)}
              className="group flex flex-col items-center gap-1.5 rounded-2xl border border-[#95A847]/14 bg-white/72 px-3 py-3.5 shadow-[0_10px_30px_rgba(48,40,23,0.06)] backdrop-blur-2xl transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_14px_40px_rgba(48,40,23,0.1)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/12 to-[#B4BE6A]/8 text-lg">{item.icon}</span>
              <span className="text-[11px] font-bold text-[#302817]/70 group-hover:text-[#302817]">
                {lang === 'tr' ? item.tr : item.en}
              </span>
              <span className="text-[9px] font-medium text-[#302817]/35">
                {lang === 'tr' ? item.sub.tr : item.sub.en}
              </span>
            </button>
          ))}
        </div>

        {/* How it works modal */}
        {showHowItWorks && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/12 p-4 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-[1.25rem] border border-[#302817]/10 bg-white/95 p-5 shadow-[0_20px_60px_rgba(48,40,23,0.15)] backdrop-blur-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#302817]">{lang === 'tr' ? 'Nasıl çalışır?' : 'How it works'}</h3>
                <button onClick={() => setShowHowItWorks(false)} className="flex h-6 w-6 items-center justify-center rounded-lg text-[#302817]/35 hover:bg-[#302817]/5">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { num: '1', tr: 'AI anketini tamamlayın', en: 'Complete AI questionnaire', sub: { tr: 'Adım adım sorular', en: 'Step-by-step questions' } },
                  { num: '2', tr: 'Aktivite ve kanıt yükleyin', en: 'Upload activity & evidence', sub: { tr: 'Fatura ve belgeler', en: 'Invoices and documents' } },
                  { num: '3', tr: 'ISO-hazır rapor oluşturun', en: 'Generate ISO-ready reports', sub: { tr: 'Otomatik PDF', en: 'Automatic PDF' } },
                ].map((s) => (
                  <div key={s.num} className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#95A847]/12 text-[11px] font-bold text-[#75863B]">{s.num}</span>
                    <div className="text-left">
                      <p className="text-xs font-bold text-[#302817]">{lang === 'tr' ? s.tr : s.en}</p>
                      <p className="text-[10px] text-[#302817]/40">{lang === 'tr' ? s.sub.tr : s.sub.en}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setShowHowItWorks(false); setStarted(true); }}
                className="mt-5 w-full rounded-full bg-[#302817] py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:bg-black"
              >
                {lang === 'tr' ? 'Başla' : 'Start'}
              </button>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }
        `}</style>
      </section>
    );
  }

  // ─── Chat Interface ───
  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[600px] flex-col rounded-[32px] border border-[#302817]/8 bg-white/80 shadow-[0_10px_40px_rgba(48,40,23,0.06)] backdrop-blur-2xl">
      {/* Chat Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#302817]/6 px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setStarted(false); resetFlow(); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#302817]/40 transition hover:bg-[#302817]/5 hover:text-[#302817]"
            title={lang === 'tr' ? 'Geri' : 'Back'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <img src="/carbon-hero.png" alt="CarbonIQ" className="h-10 w-10 rounded-xl object-cover" />
          <div>
            <h1 className="text-base font-bold tracking-[-0.02em]">CarbonIQ</h1>
            <p className="text-[11px] font-semibold text-[#302817]/45">
              {stage?.title?.[lang]} · {progress}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress mini */}
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#302817]/8">
              <div
                className="h-full rounded-full bg-[#B4BE6A] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-[#302817]/40">{answeredCount}/133</span>
          </div>
          <button
            type="button"
            onClick={resetFlow}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#302817]/40 transition hover:bg-[#302817]/6 hover:text-[#302817]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.map((msg, i) => (
            <ChatBubble key={i} message={msg} lang={lang} answers={answers} />
          ))}
          {currentQuestionMessage && !completed && (
            <ChatBubble message={currentQuestionMessage} lang={lang} answers={answers} />
          )}
          {error && (
            <ChatBubble
              message={{ role: 'assistant', type: 'error', content: error }}
              lang={lang}
              answers={answers}
            />
          )}
        </div>
      </div>

      {/* Input Area */}
      {!completed ? (
        <div className="shrink-0 border-t border-[#302817]/6 px-4 py-3 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <AnswerInput
              question={question}
              value={answerValue}
              setValue={setAnswerValue}
              lang={lang}
              onSubmit={submitAnswer}
            />
            <div className="mt-2.5 flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={history.length === 0}
                className="text-xs font-bold text-[#302817]/35 transition hover:text-[#302817] disabled:opacity-30"
              >
                {lang === 'tr' ? '\u2190 Geri' : '\u2190 Back'}
              </button>
              <button
                type="button"
                onClick={submitAnswer}
                className="inline-flex items-center gap-2 rounded-full bg-[#302817] px-5 py-2.5 text-xs font-bold text-white shadow-[0_8px_30px_rgba(48,40,23,0.12)] transition hover:-translate-y-0.5 hover:bg-black"
              >
                {lang === 'tr' ? 'G\u00f6nder' : 'Send'}
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-[#302817]/6 px-4 py-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between rounded-2xl bg-[#B4BE6A]/8 px-5 py-3">
            <p className="text-sm font-bold text-[#302817]">
              {lang === 'tr' ? 'B\u00f6l\u00fcm tamamland\u0131' : 'Section complete'}{' '}
              <span className="font-normal text-[#302817]/50">
                · {answeredCount} {lang === 'tr' ? 'yan\u0131t' : 'answers'}
              </span>
            </p>
            <button
              type="button"
              onClick={resetFlow}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2 text-xs font-bold text-white transition hover:bg-black"
            >
              <RotateCcw className="h-3 w-3" />
              {lang === 'tr' ? 'Ba\u015ftan' : 'Restart'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chat Bubble ───
function ChatBubble({ message, lang, answers }) {
  const isUser = message.role === 'user';
  const isWarning = message.type === 'warning';
  const isError = message.type === 'error';
  const isInfo = message.type === 'info';
  const isSuccess = message.type === 'success';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-[22px] px-5 py-3.5 text-[14px] leading-6 sm:max-w-[72%] ${
          isUser
            ? 'bg-[#302817] text-white'
            : isWarning
            ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
            : isError
            ? 'bg-red-50 text-red-600 border border-red-200/60'
            : isInfo || isSuccess
            ? 'bg-[#B4BE6A]/8 text-[#302817]'
            : 'bg-white text-[#302817] shadow-[0_2px_12px_rgba(48,40,23,0.06)] border border-[#302817]/6'
        }`}
      >
        {message.type === 'question' && (
          <div className="mb-2.5 inline-flex rounded-full bg-[#B4BE6A]/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#B4BE6A]">
            {message.question.id} ·{' '}
            {message.question.required || isConditionalRequired(message.question, answers)
              ? lang === 'tr' ? 'Zorunlu' : 'Required'
              : lang === 'tr' ? 'Opsiyonel' : 'Optional'}
          </div>
        )}
        <p className={`font-semibold ${message.type === 'question' ? 'text-[18px] leading-7 tracking-[-0.02em] sm:text-[20px]' : ''}`}>
          {message.content}
        </p>
        {message.helper && (
          <p className="mt-2.5 text-[12px] leading-5 text-[#302817]/45">
            <span className="font-bold text-[#B4BE6A]">{lang === 'tr' ? '\u0130pucu:' : 'Hint:'}</span>{' '}
            {message.helper}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Answer Input ───
function AnswerInput({ question, value, setValue, lang, onSubmit }) {
  if (!question) return null;

  if (question.type === 'text') {
    return (
      <div className="flex items-center gap-2 rounded-[22px] border border-[#302817]/10 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(48,40,23,0.05)]">
        <input
          type="text"
          inputMode={question.subtype === 'numeric' ? 'numeric' : 'text'}
          maxLength={question.maxLength || question.exactLength || undefined}
          value={value || ''}
          onChange={(e) => {
            setValue(question.numericOnly ? e.target.value.replace(/\D/g, '') : e.target.value);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
          placeholder={question.placeholder?.[lang] || ''}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#302817] outline-none placeholder:text-[#302817]/30"
        />
        {question.maxLength && (
          <span className="text-[11px] font-bold text-[#302817]/25">
            {(value || '').length}/{question.maxLength}
          </span>
        )}
      </div>
    );
  }

  if (question.type === 'country_city') {
    const current = value || { country: '', city: '' };
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={current.country || ''}
          onChange={(e) => setValue({ ...current, country: e.target.value })}
          className="rounded-2xl border border-[#302817]/10 bg-white px-4 py-3 text-sm font-medium text-[#302817] outline-none shadow-sm"
        >
          <option value="">{lang === 'tr' ? '\u00dclke se\u00e7in' : 'Select country'}</option>
          {question.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label[lang]}</option>
          ))}
        </select>
        <input
          value={current.city || ''}
          onChange={(e) => setValue({ ...current, city: e.target.value })}
          placeholder={lang === 'tr' ? '\u015eehir' : 'City'}
          className="rounded-2xl border border-[#302817]/10 bg-white px-4 py-3 text-sm font-medium text-[#302817] outline-none shadow-sm placeholder:text-[#302817]/30"
        />
      </div>
    );
  }

  if (question.type === 'year_select' || question.type === 'single_select') {
    return (
      <div className="flex flex-wrap gap-2">
        {question.options.map((opt) => (
          <Chip key={opt.value} active={value === opt.value} onClick={() => setValue(opt.value)}>
            {opt.label?.[lang] || opt.value}
          </Chip>
        ))}
      </div>
    );
  }

  if (question.type === 'multi_select') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-2">
        {question.options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <Chip
              key={opt.value}
              active={active}
              onClick={() => {
                if (opt.value === 'skip') { setValue(active ? [] : ['skip']); return; }
                const cleaned = selected.filter((v) => v !== 'skip');
                setValue(active ? cleaned.filter((v) => v !== opt.value) : [...cleaned, opt.value]);
              }}
            >
              {opt.label[lang]}
            </Chip>
          );
        })}
      </div>
    );
  }

  return null;
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-[13px] font-bold transition ${
        active
          ? 'border-[#B4BE6A]/50 bg-[#B4BE6A]/14 text-[#302817]'
          : 'border-[#302817]/8 bg-white text-[#302817]/60 hover:border-[#B4BE6A]/40 hover:bg-[#B4BE6A]/6'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Helpers ───
function normalizeAnswerValue(question, value) {
  if (question.type === 'country_city') return value || { country: '', city: '' };
  if (question.type === 'multi_select') return Array.isArray(value) ? value : [];
  return value;
}

function getInitialValue(question) {
  if (!question) return '';
  if (question.type === 'country_city') return { country: '', city: '' };
  if (question.type === 'multi_select') return [];
  return '';
}

function getDisplayValue(question, value, lang) {
  if (!question) return '';
  if (question.type === 'country_city') {
    const country = question.options?.find((o) => o.value === value?.country)?.label?.[lang] || value?.country || '';
    return `${country}${value?.city ? `, ${value.city}` : ''}`;
  }
  if (question.type === 'single_select' || question.type === 'year_select') {
    return question.options?.find((o) => o.value === value)?.label?.[lang] || value;
  }
  if (question.type === 'multi_select') {
    return value.map((v) => question.options?.find((o) => o.value === v)?.label?.[lang] || v).join(', ');
  }
  return String(value || '');
}

function isConditionalRequired(question, answers) {
  return Boolean(
    question?.conditionalRequired &&
      answers[question.conditionalRequired.questionId] === question.conditionalRequired.equals
  );
}
