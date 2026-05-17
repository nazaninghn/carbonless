'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, Send, Plus, Trash2, MessageSquare, Sparkles, Loader2, ChevronLeft,
  ChevronRight, ClipboardList, AlertTriangle, Info, RotateCcw, X,
  HelpCircle, CheckCircle2, ChevronDown, ChevronUp, Menu,
} from 'lucide-react';
import { api } from '@/lib/utils/api';
import {
  CARBONIQ_STAGES,
  getInitialQuestionId,
  getNextQuestionId,
  getQuestionById,
  getQuestionWarning,
  getTriggeredAssumptions,
  validateCarbonIQAnswer,
} from '@/lib/carboniq/questions';

// ─────────────────────────────────────────────────────────────────────────────
// City data
// ─────────────────────────────────────────────────────────────────────────────
const CITIES_BY_COUNTRY = {
  TR: ['Adana','Ankara','Antalya','Bursa','Diyarbakır','Erzurum','Eskişehir','Gaziantep','İstanbul','İzmir','Kayseri','Konya','Malatya','Mersin','Samsun','Trabzon','Şanlıurfa'],
  GB: ['Birmingham','Bristol','Edinburgh','Glasgow','Leeds','Liverpool','London','Manchester','Newcastle','Sheffield'],
  DE: ['Berlin','Bremen','Cologne','Dortmund','Dresden','Düsseldorf','Frankfurt','Hamburg','Hanover','Leipzig','Munich','Nuremberg','Stuttgart'],
  US: ['Atlanta','Austin','Boston','Charlotte','Chicago','Dallas','Denver','Houston','Los Angeles','Miami','Minneapolis','New York','Philadelphia','Phoenix','Portland','San Francisco','Seattle','Washington DC'],
  FR: ['Bordeaux','Grenoble','Lille','Lyon','Marseille','Nantes','Nice','Paris','Rennes','Strasbourg','Toulouse'],
  IT: ['Bologna','Florence','Genoa','Milan','Naples','Palermo','Rome','Turin','Venice'],
  ES: ['Barcelona','Bilbao','Madrid','Málaga','Seville','Valencia','Zaragoza'],
  NL: ['Amsterdam','Eindhoven','Rotterdam','The Hague','Utrecht'],
  BE: ['Antwerp','Brussels','Ghent','Liège'],
  AT: ['Graz','Innsbruck','Linz','Salzburg','Vienna'],
  CH: ['Basel','Bern','Geneva','Lausanne','Zurich'],
  SE: ['Gothenburg','Malmö','Stockholm','Uppsala'],
  NO: ['Bergen','Oslo','Stavanger','Trondheim'],
  DK: ['Aarhus','Copenhagen','Odense'],
  FI: ['Espoo','Helsinki','Tampere','Turku'],
  PL: ['Gdańsk','Kraków','Łódź','Poznań','Warsaw','Wrocław'],
  PT: ['Braga','Coimbra','Lisbon','Porto'],
  GR: ['Athens','Heraklion','Patras','Thessaloniki'],
  RU: ['Chelyabinsk','Ekaterinburg','Kazan','Moscow','Nizhny Novgorod','Novosibirsk','Omsk','Rostov-on-Don','Saint Petersburg','Samara','Ufa','Volgograd'],
  UA: ['Dnipro','Donetsk','Kharkiv','Kyiv','Lviv','Odessa','Zaporizhzhia'],
  CN: ['Beijing','Chengdu','Chongqing','Guangzhou','Hangzhou','Nanjing','Shanghai','Shenzhen','Tianjin','Wuhan','Xi\'an'],
  JP: ['Fukuoka','Kobe','Kyoto','Nagoya','Osaka','Sapporo','Tokyo','Yokohama'],
  KR: ['Busan','Daegu','Daejeon','Gwangju','Incheon','Seoul'],
  IN: ['Ahmedabad','Bangalore','Chennai','Hyderabad','Kolkata','Mumbai','New Delhi','Pune','Surat'],
  SA: ['Dammam','Jeddah','Mecca','Medina','Riyadh'],
  AE: ['Abu Dhabi','Dubai','Sharjah'],
  QA: ['Doha'],
  IL: ['Haifa','Jerusalem','Tel Aviv'],
  EG: ['Alexandria','Cairo','Giza'],
  MA: ['Casablanca','Marrakech','Rabat'],
  BR: ['Belo Horizonte','Brasília','Curitiba','Fortaleza','Manaus','Porto Alegre','Recife','Rio de Janeiro','Salvador','São Paulo'],
  MX: ['Guadalajara','Juárez','Monterrey','Mexico City','Puebla','Tijuana'],
  AR: ['Buenos Aires','Córdoba','Mendoza','Rosario'],
  CA: ['Calgary','Edmonton','Montreal','Ottawa','Quebec City','Toronto','Vancouver','Winnipeg'],
  AU: ['Adelaide','Brisbane','Canberra','Melbourne','Perth','Sydney'],
  NZ: ['Auckland','Christchurch','Wellington'],
  SG: ['Singapore'],
  MY: ['George Town','Johor Bahru','Kuala Lumpur'],
  TH: ['Bangkok','Chiang Mai','Pattaya','Phuket'],
  ID: ['Bandung','Jakarta','Medan','Surabaya'],
  VN: ['Da Nang','Hanoi','Ho Chi Minh City'],
  GE: ['Batumi','Kutaisi','Tbilisi'],
  AZ: ['Baku','Ganja'],
  KZ: ['Almaty','Nur-Sultan'],
  OTHER: [],
};

const COUNTRY_NAMES = {
  TR:'Turkey',GB:'United Kingdom',DE:'Germany',US:'United States',FR:'France',IT:'Italy',
  ES:'Spain',NL:'Netherlands',BE:'Belgium',AT:'Austria',CH:'Switzerland',SE:'Sweden',
  NO:'Norway',DK:'Denmark',FI:'Finland',PL:'Poland',PT:'Portugal',GR:'Greece',
  RU:'Russia',UA:'Ukraine',CN:'China',JP:'Japan',KR:'South Korea',IN:'India',
  SA:'Saudi Arabia',AE:'UAE',QA:'Qatar',IL:'Israel',EG:'Egypt',MA:'Morocco',
  BR:'Brazil',MX:'Mexico',AR:'Argentina',CA:'Canada',AU:'Australia',NZ:'New Zealand',
  SG:'Singapore',MY:'Malaysia',TH:'Thailand',ID:'Indonesia',VN:'Vietnam',
  GE:'Georgia',AZ:'Azerbaijan',KZ:'Kazakhstan',OTHER:'Other',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: map answer for backend
// ─────────────────────────────────────────────────────────────────────────────
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
    default: return { answer: value };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire helpers
// ─────────────────────────────────────────────────────────────────────────────
function normalizeAnswerValue(q, raw) {
  if (!q) return raw;
  if (q.type === 'multi_select') return Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return raw ?? '';
}

function getInitialValue(q) {
  if (!q) return '';
  if (q.type === 'multi_select') return [];
  if (q.type === 'country_city') return { country: '', city: '' };
  return '';
}

function getDisplayValue(q, value, lang = 'en') {
  if (!q || value === undefined || value === null || value === '') return '—';
  if (q.type === 'country_city') {
    const v = value;
    if (!v?.country) return '—';
    return `${COUNTRY_NAMES[v.country] || v.country}${v.city ? ', ' + v.city : ''}`;
  }
  if (q.type === 'multi_select') {
    if (!Array.isArray(value) || value.length === 0) return '—';
    return value.map(v => {
      const opt = q.options?.find(o => o.value === v);
      return opt ? (opt.label?.[lang] || opt.label?.en || v) : v;
    }).join(', ');
  }
  if (q.type === 'single_select') {
    const opt = q.options?.find(o => o.value === value);
    return opt ? (opt.label?.[lang] || opt.label?.en || value) : value;
  }
  return String(value);
}

function isConditionalRequired(q, answers) {
  if (!q?.conditionalRequired) return q?.required ?? true;
  const { dependsOn, value } = q.conditionalRequired;
  return answers[dependsOn] === value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: Markdown renderer
// ─────────────────────────────────────────────────────────────────────────────
function Markdown({ text }) {
  const html = (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-black/10 px-1 py-0.5 text-[12px] font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<p class="mt-3 mb-1 font-bold text-[#302817]">$1</p>')
    .replace(/^## (.+)$/gm, '<p class="mt-4 mb-1 text-base font-bold text-[#302817]">$1</p>')
    .replace(/^# (.+)$/gm, '<p class="mt-4 mb-1 text-lg font-bold text-[#302817]">$1</p>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: Typing dots
// ─────────────────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[#B4BE6A]"
          style={{ animation: `dot 1.2s ${i * 0.2}s ease-in-out infinite` }}
        />
      ))}
      <style>{`@keyframes dot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Free-chat: Bubble
// ─────────────────────────────────────────────────────────────────────────────
function Bubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10 text-[#75863B]">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-[20px] px-4 py-3 text-[13.5px] leading-[1.65] sm:max-w-[72%] ${
          isUser
            ? 'rounded-tr-sm bg-[#302817] text-white'
            : 'rounded-tl-sm border border-[#302817]/6 bg-white text-[#302817] shadow-[0_2px_12px_rgba(48,40,23,0.05)]'
        }`}
      >
        {isUser ? content : <Markdown text={content} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Free-chat: Session list item
// ─────────────────────────────────────────────────────────────────────────────
function SessionItem({ session, active, onClick, onDelete, tr }) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full rounded-xl px-3 py-2.5 text-left transition ${
        active
          ? 'bg-[#302817]/8 text-[#302817]'
          : 'text-[#302817]/60 hover:bg-[#302817]/5 hover:text-[#302817]'
      }`}
    >
      <p className="truncate text-xs font-bold leading-tight pr-6">{session.title}</p>
      <p className="mt-0.5 text-[10px] font-medium text-[#302817]/35">
        {session.message_count} {tr ? 'mesaj' : 'msgs'} · {new Date(session.updated_at).toLocaleDateString()}
      </p>
      <button
        onClick={e => { e.stopPropagation(); onDelete(session.id); }}
        className="absolute right-2 top-2.5 hidden rounded-md p-1 text-[#302817]/30 transition hover:bg-red-50 hover:text-red-400 group-hover:flex"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Free-chat: Empty state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ onNew, tr }) {
  const prompts = tr
    ? ['Scope 1, 2, 3 emisyonları nasıl hesaplarım?', 'ISO 14064-1 sınır belirleme nasıl yapılır?', 'Karbon azaltma hedefi nasıl oluştururum?', 'Emisyon faktörü nedir?']
    : ['How do I calculate Scope 1, 2 & 3 emissions?', 'What is the ISO 14064-1 boundary approach?', 'How do I set a science-based reduction target?', 'What are common emission factors?'];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#95A847]/15 to-[#B4BE6A]/10">
        <Sparkles className="h-7 w-7 text-[#95A847]" />
      </div>
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[#302817]">
          {tr ? 'CarbonIQ Asistanı' : 'CarbonIQ Assistant'}
        </h2>
        <p className="mt-1.5 text-sm text-[#302817]/50">
          {tr
            ? 'ISO 14064-1 ve karbon muhasebesi konusunda uzman AI asistanı.'
            : 'Expert AI for carbon accounting & ISO 14064-1 reporting.'}
        </p>
      </div>
      <div className="grid w-full max-w-sm gap-2">
        {prompts.map(p => (
          <button
            key={p}
            onClick={() => onNew(p)}
            className="rounded-2xl border border-[#302817]/8 bg-white px-4 py-3 text-left text-xs font-semibold text-[#302817]/65 shadow-sm transition hover:border-[#B4BE6A]/40 hover:bg-[#B4BE6A]/5 hover:text-[#302817]"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: ChatBubble
// ─────────────────────────────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  const base = 'rounded-[22px] px-4 py-3 text-[13.5px] leading-[1.65] max-w-[85%] sm:max-w-[75%]';
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className={`${base} rounded-tr-sm bg-[#302817] text-white`}>{msg.content}</div>
      </div>
    );
  }
  if (msg.type === 'warning') {
    return (
      <div className="flex gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className={`${base} rounded-tl-sm border border-amber-200 bg-amber-50 text-amber-800`}>
          <Markdown text={msg.content} />
        </div>
      </div>
    );
  }
  if (msg.type === 'error') {
    return (
      <div className="flex gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-500">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className={`${base} rounded-tl-sm border border-red-200 bg-red-50 text-red-700`}>
          {msg.content}
        </div>
      </div>
    );
  }
  if (msg.type === 'info') {
    return (
      <div className="flex gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#B4BE6A]/20 text-[#75863B]">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className={`${base} rounded-tl-sm border border-[#B4BE6A]/30 bg-[#B4BE6A]/10 text-[#302817]`}>
          <Markdown text={msg.content} />
        </div>
      </div>
    );
  }
  // assistant (default)
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10 text-[#75863B]">
        <Bot className="h-4 w-4" />
      </div>
      <div className={`${base} rounded-tl-sm border border-[#302817]/6 bg-white text-[#302817] shadow-[0_2px_12px_rgba(48,40,23,0.05)]`}>
        <Markdown text={msg.content} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Chip
// ─────────────────────────────────────────────────────────────────────────────
function Chip({ label, selected, onClick, multi }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        selected
          ? 'border-[#95A847] bg-[#95A847] text-white shadow-sm'
          : 'border-[#302817]/12 bg-white text-[#302817]/70 hover:border-[#B4BE6A]/50 hover:bg-[#B4BE6A]/8 hover:text-[#302817]'
      }`}
    >
      {multi && selected && <span className="mr-1">✓</span>}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: CountryCityInput
// ─────────────────────────────────────────────────────────────────────────────
function CountryCityInput({ value, onChange, lang }) {
  const val = value || { country: '', city: '' };
  const cities = val.country ? (CITIES_BY_COUNTRY[val.country] || []) : [];
  const tr = lang === 'tr';
  return (
    <div className="flex flex-col gap-2 w-full">
      <select
        className="rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20"
        value={val.country}
        onChange={e => onChange({ country: e.target.value, city: '' })}
      >
        <option value="">{tr ? '— Ülke seçin —' : '— Select country —'}</option>
        {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>
      {val.country && cities.length > 0 && (
        <select
          className="rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20"
          value={val.city}
          onChange={e => onChange({ ...val, city: e.target.value })}
        >
          <option value="">{tr ? '— Şehir seçin —' : '— Select city —'}</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {val.country && cities.length === 0 && (
        <input
          className="rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20"
          placeholder={tr ? 'Şehir adı' : 'City name'}
          value={val.city}
          onChange={e => onChange({ ...val, city: e.target.value })}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: AnswerInput
// ─────────────────────────────────────────────────────────────────────────────
function AnswerInput({ question, value, onChange, onSubmit, lang, disabled }) {
  const tr = lang === 'tr';
  if (!question) return null;

  const { type, subtype, options, placeholder, minYear, maxYear } = question;

  if (type === 'info') {
    return (
      <button
        onClick={onSubmit}
        disabled={disabled}
        className="rounded-full bg-[#302817] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
      >
        {tr ? 'Devam Et →' : 'Continue →'}
      </button>
    );
  }

  if (type === 'country_city') {
    return (
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <CountryCityInput value={value} onChange={onChange} lang={lang} />
        <button
          onClick={onSubmit}
          disabled={disabled || !value?.country}
          className="rounded-full bg-[#302817] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          {tr ? 'Onayla →' : 'Confirm →'}
        </button>
      </div>
    );
  }

  if (type === 'year_select') {
    const min = minYear || 2010;
    const max = maxYear || new Date().getFullYear();
    const years = [];
    for (let y = max; y >= min; y--) years.push(y);
    return (
      <div className="flex flex-wrap gap-2">
        {years.map(y => (
          <Chip
            key={y}
            label={String(y)}
            selected={value === String(y)}
            onClick={() => { onChange(String(y)); setTimeout(onSubmit, 80); }}
          />
        ))}
      </div>
    );
  }

  if (type === 'single_select') {
    return (
      <div className="flex flex-wrap gap-2">
        {(options || []).map(opt => (
          <Chip
            key={opt.value}
            label={opt.label?.[lang] || opt.label?.en || opt.value}
            selected={value === opt.value}
            onClick={() => { onChange(opt.value); setTimeout(onSubmit, 80); }}
          />
        ))}
      </div>
    );
  }

  if (type === 'multi_select') {
    const vals = Array.isArray(value) ? value : [];
    const toggle = (v) => {
      if (vals.includes(v)) onChange(vals.filter(x => x !== v));
      else onChange([...vals, v]);
    };
    return (
      <div className="flex flex-col gap-3 w-full">
        <div className="flex flex-wrap gap-2">
          {(options || []).map(opt => (
            <Chip
              key={opt.value}
              label={opt.label?.[lang] || opt.label?.en || opt.value}
              selected={vals.includes(opt.value)}
              onClick={() => toggle(opt.value)}
              multi
            />
          ))}
        </div>
        <button
          onClick={onSubmit}
          disabled={disabled || vals.length === 0}
          className="self-start rounded-full bg-[#302817] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          {tr ? 'Onayla →' : 'Confirm →'}
        </button>
      </div>
    );
  }

  // text / numeric / etc.
  return (
    <div className="flex w-full max-w-sm gap-2 items-end">
      <input
        className="flex-1 rounded-xl border border-[#302817]/12 bg-white px-4 py-2.5 text-sm text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20"
        type={subtype === 'numeric' ? 'text' : 'text'}
        inputMode={subtype === 'numeric' ? 'numeric' : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSubmit(); } }}
        placeholder={placeholder?.[lang] || placeholder?.en || ''}
        disabled={disabled}
        autoFocus
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !String(value || '').trim()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-40"
      >
        <Send className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Progress Sidebar
// ─────────────────────────────────────────────────────────────────────────────
function ProgressSidebar({ answers, currentId, lang, open, onToggle }) {
  const tr = lang === 'tr';

  // Count questions per stage using getQuestionById
  const allAnswered = Object.keys(answers);
  const stageStats = CARBONIQ_STAGES.map(stage => {
    const answeredInStage = allAnswered.filter(qid => {
      const q = getQuestionById(qid);
      return q && q.stage === stage.id;
    });
    return { stage, answeredCount: answeredInStage.length };
  });

  const totalAnswered = Object.keys(answers).length;
  const totalQuestions = 133;
  const pct = Math.round((totalAnswered / totalQuestions) * 100);

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-[#302817]/6 bg-[#FAFAF8] transition-all duration-300 ${
        open ? 'w-[220px]' : 'w-0 overflow-hidden'
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#302817]/6 px-3 py-3">
        <span className="text-[10px] font-bold text-[#302817]/50 uppercase tracking-wider">
          {tr ? 'İlerleme' : 'Progress'}
        </span>
        <button
          onClick={onToggle}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/6 hover:text-[#302817] transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Overall progress */}
      <div className="border-b border-[#302817]/6 px-3 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#302817]/60">
            {totalAnswered} / {totalQuestions}
          </span>
          <span className="text-[10px] font-bold text-[#95A847]">{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#302817]/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#95A847] to-[#B4BE6A] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stage list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {CARBONIQ_STAGES.map(stage => {
          const stat = stageStats.find(s => s.stage.id === stage.id);
          const answered = stat?.answeredCount || 0;
          const currentQ = getQuestionById(currentId);
          const isCurrent = currentQ?.stage === stage.id;
          return (
            <div
              key={stage.id}
              className={`rounded-xl px-3 py-2 transition ${
                isCurrent
                  ? 'bg-[#B4BE6A]/15 border border-[#B4BE6A]/30'
                  : 'hover:bg-[#302817]/4'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${isCurrent ? 'bg-[#95A847]' : answered > 0 ? 'bg-[#B4BE6A]/60' : 'bg-[#302817]/15'}`} />
                <span className={`text-[10px] font-bold truncate ${isCurrent ? 'text-[#75863B]' : 'text-[#302817]/55'}`}>
                  {stage.title[lang] || stage.title.en}
                </span>
              </div>
              {answered > 0 && (
                <span className="text-[9px] text-[#302817]/35 pl-3">{answered} {tr ? 'cevaplandı' : 'answered'}</span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: AI Help Drawer
// ─────────────────────────────────────────────────────────────────────────────
function AIHelpDrawer({ open, onClose, currentQuestion, lang, helpSessionRef }) {
  const tr = lang === 'tr';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Pre-fill when opened
  useEffect(() => {
    if (open && currentQuestion) {
      const qText = currentQuestion.text?.[lang] || currentQuestion.text?.en || '';
      const pre = tr
        ? `Soru ${currentQuestion.number} hakkında: "${qText}" — `
        : `I'm on question ${currentQuestion.number} about: "${qText}". `;
      setInput(pre);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, currentQuestion?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sending]);

  const sendHelp = async () => {
    const content = input.trim();
    if (!content || sending) return;

    // Ensure we have a help session
    if (!helpSessionRef.current) {
      try {
        const res = await api.createChatSession(tr ? 'Envanter Yardımı' : 'Questionnaire Help');
        if (res.ok) {
          const sess = await res.json();
          helpSessionRef.current = sess.id;
        } else return;
      } catch { return; }
    }

    setInput('');
    setSending(true);
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content }]);
    try {
      const res = await api.sendChatMessage(helpSessionRef.current, content);
      if (res.ok) {
        const aiMsg = await res.json();
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch {}
    setSending(false);
    inputRef.current?.focus();
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay (mobile) */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 z-50 flex w-[min(340px,100vw)] flex-col border-l border-[#302817]/8 bg-white shadow-[−8px_0_40px_rgba(48,40,23,0.08)] md:relative md:inset-auto md:z-auto md:w-[300px] md:shadow-none">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[#302817]/6 px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10">
            <HelpCircle className="h-4 w-4 text-[#75863B]" />
          </div>
          <span className="flex-1 text-sm font-bold text-[#302817]">
            {tr ? 'AI Yardımı' : 'AI Help'}
          </span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/6 hover:text-[#302817] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
              <HelpCircle className="h-8 w-8 text-[#302817]/15" />
              <p className="text-xs text-[#302817]/40 max-w-[200px]">
                {tr ? 'Bu soru hakkında AI\'dan yardım isteyin.' : 'Ask AI for help with this specific question.'}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={msg.id || i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] rounded-[18px] px-3 py-2.5 text-[12.5px] leading-[1.6] ${
                  msg.role === 'user'
                    ? 'rounded-tr-sm bg-[#302817] text-white'
                    : 'rounded-tl-sm border border-[#302817]/6 bg-[#FAFAF8] text-[#302817]'
                }`}
              >
                {msg.role === 'user' ? msg.content : <Markdown text={msg.content} />}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex gap-2">
              <div className="rounded-[18px] rounded-tl-sm border border-[#302817]/6 bg-[#FAFAF8] px-3 py-2.5">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-[#302817]/6 p-3">
          <div className="flex gap-2 rounded-2xl border border-[#302817]/10 bg-[#FAFAF8] px-3 py-2 focus-within:border-[#B4BE6A]/40 focus-within:ring-2 focus-within:ring-[#B4BE6A]/15 transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHelp(); } }}
              rows={2}
              className="flex-1 resize-none bg-transparent text-[12.5px] text-[#302817] outline-none placeholder:text-[#302817]/30"
              placeholder={tr ? 'Sorunuzu yazın…' : 'Ask your question…'}
              style={{ scrollbarWidth: 'none' }}
            />
            <button
              onClick={sendHelp}
              disabled={!input.trim() || sending}
              className="flex h-7 w-7 shrink-0 self-end items-center justify-center rounded-full bg-[#302817] text-white transition hover:bg-black disabled:opacity-30"
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Welcome Screen
// ─────────────────────────────────────────────────────────────────────────────
function QuestionnaireWelcome({ onStart, loading, answeredCount, tr }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10 shadow-[0_4px_20px_rgba(149,168,71,0.2)]">
        <ClipboardList className="h-9 w-9 text-[#75863B]" />
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#302817]">
          {tr ? 'Karbon Envanterinizi Oluşturun' : 'Build your carbon inventory with AI'}
        </h2>
        <p className="mt-3 text-sm text-[#302817]/55 max-w-md">
          {tr
            ? '133 sorudan oluşan ISO 14064-1 uyumlu yapılandırılmış envanter akışı. AI asistanı her adımda yanınızda.'
            : '133-question ISO 14064-1 structured inventory flow. AI assistant by your side at every step.'}
        </p>
      </div>
      {answeredCount > 0 && (
        <div className="rounded-2xl border border-[#B4BE6A]/30 bg-[#B4BE6A]/8 px-5 py-3 text-sm font-semibold text-[#75863B]">
          {tr
            ? `${answeredCount} soru daha önce yanıtlandı — kaldığınız yerden devam edebilirsiniz.`
            : `${answeredCount} questions already answered — you can continue where you left off.`}
        </div>
      )}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onStart}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-[#302817] px-8 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-black disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {tr
            ? (answeredCount > 0 ? 'Devam Et' : 'Envantere Başla')
            : (answeredCount > 0 ? 'Continue Inventory' : 'Start Inventory')}
        </button>
        <p className="text-[11px] text-[#302817]/30">
          {tr ? 'Verileriniz güvenli şekilde kaydedilir.' : 'Your data is saved securely.'}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Main Tab
// ─────────────────────────────────────────────────────────────────────────────
function QuestionnaireTab({ language }) {
  const tr = language === 'tr';
  const lang = language;

  // State
  const [started, setStarted] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [currentId, setCurrentId] = useState(() => getInitialQuestionId());
  const [answers, setAnswers] = useState({});
  const [answerValue, setAnswerValue] = useState('');
  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [reportId, setReportId] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [assumptions, setAssumptions] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  const helpSessionRef = useRef(null);
  const scrollRef = useRef(null);

  const currentQuestion = getQuestionById(currentId);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Init answer value when question changes
  useEffect(() => {
    if (currentQuestion) {
      const existing = answers[currentId];
      setAnswerValue(existing !== undefined ? normalizeAnswerValue(currentQuestion, existing) : getInitialValue(currentQuestion));
    }
  }, [currentId]);

  // ── handleStart ────────────────────────────────────────────────────────────
  const handleStart = async () => {
    setStartLoading(true);
    try {
      const res = await api.startCarbonReport();
      if (res.ok) {
        const data = await res.json();
        setReportId(data.id);
        // Restore any existing answers from server
        if (data.answers && Object.keys(data.answers).length > 0) {
          setAnswers(data.answers);
          // Find last answered question and set next
          const answeredIds = Object.keys(data.answers);
          const lastId = answeredIds[answeredIds.length - 1];
          const nextId = getNextQuestionId(lastId, data.answers);
          const initId = nextId || getInitialQuestionId();
          setCurrentId(initId);
        }
      }
    } catch (e) {
      console.error('Start error:', e);
    }

    // Build welcome message
    const firstQ = getQuestionById(currentId);
    const welcomeMsg = {
      id: 'welcome',
      role: 'assistant',
      content: tr
        ? `Merhaba! Ben CarbonIQ — ISO 14064-1 uyumlu karbon envanteri oluşturmanıza yardımcı olacağım. Size 133 soru soracağım. İstediğiniz zaman geri dönebilirsiniz.\n\n**Soru 1:** ${firstQ?.text?.tr || firstQ?.text?.en}`
        : `Hello! I'm CarbonIQ — I'll help you build an ISO 14064-1 compliant carbon inventory. I'll ask you 133 questions. You can go back at any time.\n\n**Question 1:** ${firstQ?.text?.en}`,
    };
    if (firstQ?.helper) {
      welcomeMsg.content += `\n\n_${firstQ.helper?.[lang] || firstQ.helper?.en}_`;
    }
    setMessages([welcomeMsg]);
    setStarted(true);
    setStartLoading(false);
  };

  // ── saveStepToBackend ──────────────────────────────────────────────────────
  const saveStepToBackend = async (questionId, value, rid) => {
    const rid_ = rid || reportId;
    if (!rid_) return;
    try {
      const backendData = mapAnswerForBackend(questionId, value);
      const res = await api.submitReportStep(rid_, questionId, backendData);
      if (!res.ok) {
        setSaveError(tr ? 'Kayıt hatası oluştu.' : 'Save error occurred.');
      } else {
        setSaveError(null);
      }
    } catch {
      setSaveError(tr ? 'Bağlantı hatası.' : 'Connection error.');
    }
  };

  // ── submitAnswer ───────────────────────────────────────────────────────────
  const submitAnswer = useCallback(async (overrideValue) => {
    const q = getQuestionById(currentId);
    if (!q || isTyping) return;

    const raw = overrideValue !== undefined ? overrideValue : answerValue;
    const value = normalizeAnswerValue(q, raw);

    // Validate
    if (q.type !== 'info') {
      const err = validateCarbonIQAnswer(q, value, answers);
      if (err) {
        setMessages(prev => [...prev, {
          id: Date.now() + '-err',
          role: 'assistant',
          type: 'error',
          content: err[lang] || err.en || String(err),
        }]);
        return;
      }
    }

    // Add user bubble
    const displayVal = getDisplayValue(q, value, lang);
    if (q.type !== 'info') {
      setMessages(prev => [...prev, { id: Date.now() + '-user', role: 'user', content: displayVal }]);
    }

    // Save answer
    const newAnswers = { ...answers, [currentId]: value };
    setAnswers(newAnswers);
    setHistory(prev => [...prev, currentId]);

    // Save to backend
    await saveStepToBackend(currentId, value, reportId);

    // Check for warnings
    const warning = getQuestionWarning ? getQuestionWarning(currentId, value, newAnswers) : null;
    // Check for triggered assumptions
    const newAssumptions = getTriggeredAssumptions ? getTriggeredAssumptions(currentId, value, newAnswers) : [];
    if (newAssumptions.length > 0) {
      setAssumptions(prev => [...prev, ...newAssumptions]);
    }

    // Show typing
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const nextId = getNextQuestionId(currentId, newAnswers);

      // Show warning if any
      if (warning) {
        setMessages(prev => [...prev, {
          id: Date.now() + '-warn',
          role: 'assistant',
          type: 'warning',
          content: warning[lang] || warning.en || String(warning),
        }]);
      }

      if (!nextId) {
        // Completed
        setCompleted(true);
        setMessages(prev => [...prev, {
          id: Date.now() + '-done',
          role: 'assistant',
          type: 'info',
          content: tr
            ? `Tebrikler! Tüm sorular tamamlandı. Karbon envanteriniz başarıyla oluşturuldu.`
            : `Congratulations! All questions completed. Your carbon inventory has been successfully created.`,
        }]);
      } else {
        const nextQ = getQuestionById(nextId);
        setCurrentId(nextId);
        setAnswerValue(getInitialValue(nextQ));

        let questionText = nextQ?.text?.[lang] || nextQ?.text?.en || '';
        let helperText = nextQ?.helper?.[lang] || nextQ?.helper?.en || '';
        let content = `**${tr ? 'Soru' : 'Question'} ${nextQ?.number}:** ${questionText}`;
        if (helperText) content += `\n\n_${helperText}_`;

        const bubbleType = nextQ?.type === 'info' ? 'info' : 'assistant';
        setMessages(prev => [...prev, {
          id: Date.now() + '-q',
          role: 'assistant',
          type: bubbleType,
          content,
        }]);
      }
    }, 900);
  }, [currentId, answerValue, answers, isTyping, reportId, lang, tr]);

  // ── goBack ─────────────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (history.length === 0) return;
    const prevId = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentId(prevId);
    const prevQ = getQuestionById(prevId);
    setAnswerValue(normalizeAnswerValue(prevQ, answers[prevId]) ?? getInitialValue(prevQ));
    // Remove last 2 messages (user answer + AI question)
    setMessages(prev => prev.slice(0, -2));
  }, [history, answers]);

  // ── resetFlow ──────────────────────────────────────────────────────────────
  const resetFlow = useCallback(() => {
    const initId = getInitialQuestionId();
    setCurrentId(initId);
    setAnswers({});
    setHistory([]);
    setCompleted(false);
    setAssumptions([]);
    setSaveError(null);
    const firstQ = getQuestionById(initId);
    setMessages([{
      id: 'reset',
      role: 'assistant',
      content: tr
        ? `Envanter sıfırlandı. **Soru 1:** ${firstQ?.text?.tr || firstQ?.text?.en}`
        : `Inventory reset. **Question 1:** ${firstQ?.text?.en}`,
    }]);
    setAnswerValue(getInitialValue(firstQ));
  }, [tr]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!started) {
    return (
      <QuestionnaireWelcome
        onStart={handleStart}
        loading={startLoading}
        answeredCount={Object.keys(answers).length}
        tr={tr}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden relative">
      {/* Progress sidebar */}
      <ProgressSidebar
        answers={answers}
        currentId={currentId}
        lang={lang}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Sub-header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[#302817]/6 px-4 py-2">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/6 hover:text-[#302817] transition"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            {currentQuestion && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#302817]/40">
                  {tr ? 'Soru' : 'Q'} {currentQuestion.number} / 133
                </span>
                {currentQuestion.isoRef && (
                  <span className="rounded-full bg-[#B4BE6A]/15 px-2 py-0.5 text-[9px] font-bold text-[#75863B]">
                    {currentQuestion.isoRef}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {history.length > 0 && !completed && (
              <button
                onClick={goBack}
                title={tr ? 'Geri' : 'Back'}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/6 hover:text-[#302817] transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={resetFlow}
              title={tr ? 'Sıfırla' : 'Reset'}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/6 hover:text-[#302817] transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Chat messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {messages.map((msg, i) => (
              <ChatBubble key={msg.id || i} msg={msg} />
            ))}
            {isTyping && (
              <div className="flex gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10 text-[#75863B]">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-[22px] rounded-tl-sm border border-[#302817]/6 bg-white px-4 py-3 shadow-[0_2px_12px_rgba(48,40,23,0.05)]">
                  <TypingDots />
                </div>
              </div>
            )}
            {saveError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700">
                {saveError}
              </div>
            )}
          </div>
        </div>

        {/* Input bar */}
        {!completed && (
          <div className="shrink-0 border-t border-[#302817]/6 px-4 py-3 sm:px-6">
            <div className="mx-auto w-full max-w-2xl">
              <div className="flex flex-col gap-2">
                <AnswerInput
                  question={currentQuestion}
                  value={answerValue}
                  onChange={setAnswerValue}
                  onSubmit={() => submitAnswer()}
                  lang={lang}
                  disabled={isTyping}
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-[#302817]/25">
                    {tr ? 'Verileriniz güvenli şekilde kaydedilir.' : 'Your data is saved securely.'}
                  </p>
                  <button
                    onClick={() => setHelpOpen(v => !v)}
                    className="flex items-center gap-1.5 rounded-full border border-[#302817]/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#302817]/55 shadow-sm transition hover:border-[#B4BE6A]/40 hover:bg-[#B4BE6A]/5 hover:text-[#302817]"
                  >
                    <HelpCircle className="h-3 w-3" />
                    {tr ? 'AI Yardımı' : 'Ask AI Help'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {completed && (
          <div className="shrink-0 border-t border-[#302817]/6 px-4 py-4 sm:px-6">
            <div className="mx-auto w-full max-w-2xl flex items-center justify-center gap-3">
              <button
                onClick={resetFlow}
                className="flex items-center gap-2 rounded-full border border-[#302817]/12 bg-white px-5 py-2.5 text-sm font-semibold text-[#302817]/70 shadow-sm transition hover:bg-[#302817]/5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {tr ? 'Yeniden Başla' : 'Start Over'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Help Drawer */}
      <AIHelpDrawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        currentQuestion={currentQuestion}
        lang={lang}
        helpSessionRef={helpSessionRef}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Free Chat Tab
// ─────────────────────────────────────────────────────────────────────────────
function FreeChatTab({ language }) {
  const tr = language === 'tr';

  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState('');

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    (async () => {
      setLoadingSessions(true);
      try {
        const res = await api.getChatSessions();
        if (res.ok) setSessions(await res.json());
      } catch {}
      setLoadingSessions(false);
    })();
  }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    (async () => {
      setLoadingMessages(true);
      try {
        const res = await api.getChatSession(activeId);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch {}
      setLoadingMessages(false);
      inputRef.current?.focus();
    })();
  }, [activeId]);

  const startNew = useCallback(async (initialPrompt = '') => {
    try {
      const res = await api.createChatSession();
      if (!res.ok) return;
      const session = await res.json();
      setSessions(prev => [session, ...prev]);
      setActiveId(session.id);
      setMessages([]);
      setError('');
      if (initialPrompt) {
        setTimeout(() => sendMessage(initialPrompt, session.id), 50);
      }
    } catch {}
  }, []); // eslint-disable-line

  const sendMessage = useCallback(async (text, sid) => {
    const content = (text || input).trim();
    const sessionId = sid || activeId;
    if (!content || !sessionId || sending) return;

    setInput('');
    setSending(true);
    setError('');
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content }]);

    try {
      const res = await api.sendChatMessage(sessionId, content);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || (tr ? 'Bir hata oluştu.' : 'Something went wrong.'));
      } else {
        const aiMsg = await res.json();
        setMessages(prev => [...prev, aiMsg]);
        if (aiMsg.session_title) {
          setSessions(prev => prev.map(s =>
            s.id === sessionId
              ? { ...s, title: aiMsg.session_title, updated_at: new Date().toISOString(), message_count: (s.message_count || 0) + 2 }
              : s
          ));
        }
      }
    } catch {
      setError(tr ? 'Bağlantı hatası.' : 'Connection error.');
    }
    setSending(false);
    inputRef.current?.focus();
  }, [input, activeId, sending, tr]);

  const deleteSession = useCallback(async (id) => {
    try {
      await api.deleteChatSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeId === id) { setActiveId(null); setMessages([]); }
    } catch {}
  }, [activeId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const activeSession = sessions.find(s => s.id === activeId);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar */}
      <aside className={`flex shrink-0 flex-col border-r border-[#302817]/6 bg-[#FAFAF8] transition-all duration-300 ${sidebarOpen ? 'w-[220px]' : 'w-0 overflow-hidden'}`}>
        <div className="flex items-center justify-between border-b border-[#302817]/6 px-3 py-3">
          <span className="text-xs font-bold text-[#302817]/50 uppercase tracking-wider">
            {tr ? 'Sohbetler' : 'Chats'}
          </span>
          <button
            onClick={() => startNew()}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#302817] text-white shadow-sm transition hover:bg-black"
            title={tr ? 'Yeni sohbet' : 'New chat'}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-[#302817]/30" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-[#302817]/35">
              {tr ? 'Henüz sohbet yok' : 'No chats yet'}
            </p>
          ) : (
            sessions.map(s => (
              <SessionItem
                key={s.id}
                session={s}
                active={s.id === activeId}
                onClick={() => setActiveId(s.id)}
                onDelete={deleteSession}
                tr={tr}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-[#302817]/6 px-4 py-3">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#302817]/40 transition hover:bg-[#302817]/6 hover:text-[#302817]"
          >
            {sidebarOpen
              ? <ChevronLeft className="h-4 w-4" />
              : <MessageSquare className="h-4 w-4" />}
          </button>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10">
            <Bot className="h-4 w-4 text-[#75863B]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#302817]">
              {activeSession ? activeSession.title : 'CarbonIQ'}
            </p>
            <p className="text-[11px] font-semibold text-[#302817]/40">
              {tr ? 'ISO 14064-1 · Karbon uzmanı AI' : 'ISO 14064-1 · Carbon expert AI'}
            </p>
          </div>
          {!activeId && (
            <button
              onClick={() => startNew()}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-black"
            >
              <Plus className="h-3 w-3" />
              {tr ? 'Yeni' : 'New'}
            </button>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {!activeId ? (
            <EmptyState onNew={startNew} tr={tr} />
          ) : loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-[#302817]/30" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Bot className="h-10 w-10 text-[#302817]/15" />
              <p className="text-sm text-[#302817]/40">
                {tr ? 'Sorunuzu yazın...' : 'Ask your first question…'}
              </p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              {messages.map((msg, i) => (
                <Bubble key={msg.id || i} role={msg.role} content={msg.content} />
              ))}
              {sending && (
                <div className="flex gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/20 to-[#B4BE6A]/10 text-[#75863B]">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-[20px] rounded-tl-sm border border-[#302817]/6 bg-white px-4 py-3 shadow-[0_2px_12px_rgba(48,40,23,0.05)]">
                    <TypingDots />
                  </div>
                </div>
              )}
              {error && (
                <div className="mx-auto w-full max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#302817]/6 px-4 py-3 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[22px] border border-[#302817]/10 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(48,40,23,0.05)] focus-within:border-[#B4BE6A]/50 focus-within:ring-4 focus-within:ring-[#B4BE6A]/12 transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!activeId && !sending}
              placeholder={
                !activeId
                  ? (tr ? 'Yeni sohbet başlatmak için tıklayın ↑' : 'Click "New" to start chatting')
                  : (tr ? 'Mesajınızı yazın… (Enter gönderir)' : 'Type a message… (Enter to send)')
              }
              rows={1}
              className="min-h-[24px] max-h-[120px] flex-1 resize-none bg-transparent text-sm font-medium text-[#302817] outline-none placeholder:text-[#302817]/30 disabled:cursor-not-allowed"
              style={{ scrollbarWidth: 'none' }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={() => {
                if (!activeId) startNew(input);
                else sendMessage();
              }}
              disabled={!input.trim() || sending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {sending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-[#302817]/25">
            {tr ? 'CarbonIQ yanılabilir. Önemli kararlar için uzmanla doğrulayın.' : 'CarbonIQ may make errors. Verify critical decisions with an expert.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: CarbonAIPage (dual-tab)
// ─────────────────────────────────────────────────────────────────────────────
export default function CarbonAIPage({ language = 'en' }) {
  const tr = language === 'tr';
  const [activeTab, setActiveTab] = useState('questionnaire');

  return (
    <div className="flex h-[calc(100svh-190px)] min-h-[520px] flex-col overflow-hidden rounded-[28px] border border-[#302817]/8 bg-white shadow-[0_10px_40px_rgba(48,40,23,0.06)] sm:h-[calc(100svh-150px)] lg:h-[calc(100vh-120px)]">

      {/* Tab switcher */}
      <div className="flex shrink-0 items-center gap-1 border-b border-[#302817]/6 bg-[#FAFAF8] px-4 py-2">
        <button
          onClick={() => setActiveTab('questionnaire')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            activeTab === 'questionnaire'
              ? 'bg-[#302817] text-white shadow-sm'
              : 'text-[#302817]/55 hover:bg-[#302817]/6 hover:text-[#302817]'
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          {tr ? 'Envanter' : 'Questionnaire'}
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            activeTab === 'chat'
              ? 'bg-[#302817] text-white shadow-sm'
              : 'text-[#302817]/55 hover:bg-[#302817]/6 hover:text-[#302817]'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {tr ? 'AI Sohbet' : 'AI Chat'}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex flex-1 min-h-0 flex-col">
        {activeTab === 'questionnaire' ? (
          <QuestionnaireTab language={language} />
        ) : (
          <FreeChatTab language={language} />
        )}
      </div>
    </div>
  );
}
