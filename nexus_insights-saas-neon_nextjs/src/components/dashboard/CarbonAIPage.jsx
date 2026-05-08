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
import { api } from '@/lib/utils/api';

// ─── Map frontend answer → backend payload ────────────────────────────────────
// Steps A1-A7a have strict backend serializers; everything else is stored as-is.
function mapAnswerForBackend(questionId, value) {
  switch (questionId) {
    case 'A1': return { legal_name: value };
    case 'A2': return { tax_id: value };
    case 'A3': return { country: value?.country || '', city: value?.city || '' };
    case 'A4': return { reporting_year: parseInt(value, 10) };
    case 'A5': return { prepared_by: value };
    case 'A6': return { purposes: Array.isArray(value) ? value.filter(v => v !== 'skip') : [] };
    case 'A7': return { has_previous_report: value === 'yes' };
    case 'A7a': return { baseline_year: parseInt(value, 10) };
    default:
      // Generic: wrap in {answer:...} for non-primitive types, pass string/number directly
      return { answer: value };
  }
}

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
  const [reportId, setReportId] = useState(null);
  const [saveError, setSaveError] = useState(null); // non-blocking backend save error
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

  // ─── Save step to backend (fire-and-forget, never blocks the user) ──────────
  const saveStepToBackend = async (questionId, value, currentReportId) => {
    const rid = currentReportId || reportId;
    if (!rid) return;
    try {
      const payload = mapAnswerForBackend(questionId, value);
      await api.submitReportStep(rid, questionId, payload);
      setSaveError(null);
    } catch {
      setSaveError('sync'); // silent — just show a small indicator
    }
  };

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

    // 🔵 Persist to backend (non-blocking)
    saveStepToBackend(question.id, normalizedValue, reportId);

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

  // ─── Start chatbot + create/resume a backend report ─────────────────────────
  const handleStart = async () => {
    setStarted(true);
    try {
      const res = await api.startCarbonReport();
      if (res.ok) {
        const data = await res.json();
        if (data.report_id) {
          setReportId(data.report_id);
          // If resuming, restore progress indicator but don't change the chat flow
          // (frontend always starts fresh; backend holds the persistent record)
        }
      }
    } catch {
      // Non-blocking — chatbot still works without backend connectivity
    }
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
            onClick={handleStart}
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
              onClick={handleStart}
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
                onClick={() => { setShowHowItWorks(false); handleStart(); }}
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
          <img src="/carbon-hero.png" alt="CarbonIQ" className="h-14 w-14 rounded-xl object-cover" />
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
            {saveError && (
              <span
                title={lang === 'tr' ? 'Sunucuya kaydedilemedi' : 'Could not sync to server'}
                className="text-[11px] text-amber-500 cursor-default select-none"
              >
                ⚠
              </span>
            )}
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

// ─── City data per country ────────────────────────────────────────────────────
const CITIES_BY_COUNTRY = {
  TR: [
    'Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya',
    'Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik',
    'Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum',
    'Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir',
    'Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul',
    'İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kilis',
    'Kırıkkale','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa',
    'Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize',
    'Sakarya','Samsun','Siirt','Sinop','Sivas','Şanlıurfa','Şırnak','Tekirdağ',
    'Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak',
  ],
  GB: [
    'London','Manchester','Birmingham','Leeds','Glasgow','Liverpool','Edinburgh',
    'Bristol','Sheffield','Cardiff','Belfast','Leicester','Bradford','Nottingham',
    'Newcastle upon Tyne','Southampton','Portsmouth','Oxford','Cambridge','York',
    'Brighton','Coventry','Derby','Plymouth','Stoke-on-Trent','Wolverhampton',
    'Aberdeen','Dundee','Inverness','Swansea','Newport',
  ],
  DE: [
    'Berlin','Hamburg','Munich','Cologne','Frankfurt','Stuttgart','Düsseldorf',
    'Dortmund','Essen','Leipzig','Bremen','Dresden','Hanover','Nuremberg',
    'Duisburg','Bochum','Wuppertal','Bielefeld','Bonn','Münster','Karlsruhe',
    'Mannheim','Augsburg','Wiesbaden','Gelsenkirchen','Mönchengladbach','Braunschweig',
    'Kiel','Chemnitz','Aachen','Halle','Magdeburg','Freiburg','Krefeld','Lübeck',
    'Mainz','Erfurt','Oberhausen','Rostock','Kassel',
  ],
  US: [
    'New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio',
    'San Diego','Dallas','San Jose','Austin','Jacksonville','Fort Worth','Columbus',
    'Charlotte','Indianapolis','San Francisco','Seattle','Denver','Nashville',
    'Oklahoma City','El Paso','Washington DC','Boston','Portland','Las Vegas',
    'Louisville','Memphis','Baltimore','Milwaukee','Albuquerque','Tucson','Fresno',
    'Sacramento','Atlanta','Kansas City','Miami','Minneapolis','New Orleans','Detroit',
  ],
  OTHER: [],
};

// ─── Country + City autocomplete ─────────────────────────────────────────────
function CountryCityInput({ question, value, setValue, lang }) {
  const current = value || { country: '', city: '' };
  const [cityInput, setCityInput] = useState(current.city || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Keep cityInput in sync with external value (e.g. when user goes back)
  useEffect(() => {
    setCityInput(current.city || '');
  }, [current.city]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allCities = CITIES_BY_COUNTRY[current.country] || [];
  const filtered = cityInput.length === 0
    ? allCities.slice(0, 8)   // show top-8 on empty
    : allCities.filter((c) =>
        c.toLowerCase().startsWith(cityInput.toLowerCase())
      ).slice(0, 8);

  function handleCountryChange(e) {
    const newCountry = e.target.value;
    setCityInput('');
    setValue({ country: newCountry, city: '' });
    setShowSuggestions(newCountry !== '' && newCountry !== 'OTHER');
  }

  function handleCityChange(e) {
    const v = e.target.value;
    setCityInput(v);
    setValue({ ...current, city: v });
    setShowSuggestions(true);
  }

  function selectSuggestion(city) {
    setCityInput(city);
    setValue({ ...current, city });
    setShowSuggestions(false);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {/* Country selector */}
      <select
        value={current.country || ''}
        onChange={handleCountryChange}
        className="rounded-2xl border border-[#302817]/10 bg-white px-4 py-3 text-sm font-medium text-[#302817] outline-none shadow-sm"
      >
        <option value="">{lang === 'tr' ? 'Ülke seçin' : 'Select country'}</option>
        {question.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label[lang]}</option>
        ))}
      </select>

      {/* City input with autocomplete */}
      <div ref={wrapperRef} className="relative">
        <input
          value={cityInput}
          onChange={handleCityChange}
          onFocus={() => current.country && current.country !== 'OTHER' && setShowSuggestions(true)}
          placeholder={lang === 'tr' ? 'Şehir girin veya seçin' : 'Type or select city'}
          autoComplete="off"
          className="w-full rounded-2xl border border-[#302817]/10 bg-white px-4 py-3 text-sm font-medium text-[#302817] outline-none shadow-sm placeholder:text-[#302817]/30"
        />
        {showSuggestions && filtered.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-[#302817]/10 bg-white shadow-[0_8px_24px_rgba(48,40,23,0.1)]">
            {filtered.map((city) => (
              <li key={city}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(city); }}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-[#302817] hover:bg-[#B4BE6A]/10 transition-colors"
                >
                  {city}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Answer Input ───
function AnswerInput({ question, value, setValue, lang, onSubmit }) {
  if (!question) return null;

  if (question.type === 'info') {
    return (
      <div className="rounded-2xl border border-[#B4BE6A]/30 bg-[#B4BE6A]/8 px-4 py-3 text-sm text-[#302817]/70">
        {lang === 'tr'
          ? 'Bilgi alındı. Devam etmek için "Gönder" butonuna tıklayın.'
          : 'Information noted. Click "Send" to continue.'}
      </div>
    );
  }

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
    return (
      <CountryCityInput
        question={question}
        value={value}
        setValue={setValue}
        lang={lang}
      />
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
  if (question.type === 'info') return lang === 'tr' ? 'Anladım, devam edelim.' : 'Got it, let\'s continue.';
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
