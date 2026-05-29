'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  Bot, Send, Plus, Trash2, MessageSquare, Sparkles, Loader2, ChevronLeft,
  ClipboardList, AlertTriangle, RotateCcw, X,
  HelpCircle, CheckCircle2, Menu,
} from 'lucide-react';
import { api } from '@/lib/utils/api';
import {
  CARBONIQ_STAGES,
  TOTAL_QUESTIONS,
  getInitialQuestionId,
  getNextQuestionId,
  getQuestionById,
  getQuestionWarning,
  getSystemMessage,
  getTriggeredAssumptions,
  validateCarbonIQAnswer,
} from '@/lib/carboniq/questions';

// ─────────────────────────────────────────────────────────────────────────────
// Timing constants
const TYPING_DELAY_MS = 900;       // simulated AI "thinking" animation duration
const CHIP_AUTO_SUBMIT_DELAY_MS = 80; // lets React flush state before sendMessage reads it

// Fix #87: module-level constant mirrors the backend MAX_MESSAGE_LENGTH=4000 so
// handleKeyDown can reference it without adding `input` to its dependency array,
// and the char-limit IIFE no longer re-declares it on every render.
const CHAT_CHAR_LIMIT = 4000;

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
    case 'A4': { const y = parseInt(value, 10); return { reporting_year: Number.isNaN(y) ? null : y }; }
    case 'A5': return { prepared_by: value };
    case 'A6': return { purposes: Array.isArray(value) ? value.filter(v => v !== 'skip') : [] };
    case 'A7': return { has_previous_report: value === 'yes' };
    case 'A7a': { const y = parseInt(value, 10); return { baseline_year: Number.isNaN(y) ? null : y }; }
    default: return { answer: value };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire helpers
// ─────────────────────────────────────────────────────────────────────────────
function normalizeAnswerValue(q, raw) {
  if (!q) return raw;
  if (q.type === 'multi_select') return Array.isArray(raw) ? raw : (raw ? [raw] : []);
  if (q.type === 'compound') return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  return raw ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper: extract the items + itemLabels for a loop question.
// Returns null if the question is not a loop question.
// Shared by initLoopOrAdvance (on the forward path) and goBack (on the back path).
// ─────────────────────────────────────────────────────────────────────────────
function buildLoopItems(loopQuestionId, currentAnswers, lang) {
  const q = getQuestionById(loopQuestionId);
  if (!q?.loopSource) return null;
  const sourceAnswer = currentAnswers[q.loopSource];
  let items;
  if (Array.isArray(sourceAnswer)) {
    items = sourceAnswer;
  } else if (typeof sourceAnswer === 'string' && sourceAnswer.trim()) {
    items = sourceAnswer.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  } else if (sourceAnswer && typeof sourceAnswer === 'object') {
    const seen = new Set();
    items = [];
    for (const v of Object.values(sourceAnswer)) {
      const arr = Array.isArray(v) ? v : (v != null ? [v] : []);
      for (const x of arr) { if (x && !seen.has(x)) { seen.add(x); items.push(x); } }
    }
  } else {
    items = [];
  }
  const sourceQ = getQuestionById(q.loopSource);
  const exclusiveVals = new Set(
    (sourceQ?.options || []).filter(o => o.exclusive || o.value === 'none').map(o => o.value)
  );
  items = items.filter(x => !exclusiveVals.has(x));
  const itemLabels = items.map(item => {
    const opt = sourceQ?.options?.find(o => o.value === item);
    return opt?.label?.[lang] || opt?.label?.en || item;
  });
  return { items, itemLabels };
}

function getInitialValue(q) {
  if (!q) return '';
  if (q.type === 'multi_select') return [];
  if (q.type === 'country_city') return { country: '', city: '' };
  if (q.type === 'compound') return {};
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
  if (q.type === 'single_select' || q.type === 'year_select' || q.type === 'equipment_loop' || q.type === 'fuel_loop') {
    const opt = q.options?.find(o => o.value === value);
    return opt ? (opt.label?.[lang] || opt.label?.en || value) : String(value);
  }
  if (q.type === 'compound') {
    if (!value || typeof value !== 'object') return '—';
    return Object.entries(value)
      .filter(([, v]) => v !== '' && v !== undefined && v !== null)
      .map(([k, v]) => {
        const field = q.fields?.find(f => f.id === k);
        const label = field?.label?.[lang] || field?.label?.en || k;
        return `${label}: ${v}`;
      })
      .join(' · ') || '—';
  }
  return String(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: Markdown renderer
// Safety: input is HTML-escaped before any regex substitution, so injected
// content cannot contain raw HTML tags. The only elements we emit are
// hard-coded tag strings (strong, em, code, p, ul, ol, li, br) — no href/src
// attributes are produced, so javascript: URI injection is not possible.
//
// Wrapped in memo: the message list re-renders on every keystroke because
// `sending` state lives in the same component. memo() ensures the 12-regex
// chain only re-runs when the `text` prop actually changes.
// ─────────────────────────────────────────────────────────────────────────────
const Markdown = memo(function Markdown({ text }) {
  const html = (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-black/10 px-1 py-0.5 text-[12px] font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<p class="mt-3 mb-1 font-bold text-[#302817]">$1</p>')
    .replace(/^## (.+)$/gm, '<p class="mt-4 mb-1 text-base font-bold text-[#302817]">$1</p>')
    .replace(/^# (.+)$/gm, '<p class="mt-4 mb-1 text-lg font-bold text-[#302817]">$1</p>')
    // Wrap consecutive unordered list lines in <ul> before paragraph splitting
    // so list items never end up inside a <p> (block-in-inline = invalid HTML).
    .replace(/((?:^- .+$\n?)+)/gm,
      m => `<ul class="ml-4 my-1 list-disc space-y-0.5">${m.replace(/^- (.+)$/gm, '<li>$1</li>')}</ul>`)
    // Wrap consecutive ordered list lines in <ol>
    .replace(/((?:^\d+\. .+$\n?)+)/gm,
      m => `<ol class="ml-4 my-1 list-decimal space-y-0.5">${m.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')}</ol>`)
    // Use <div> blocks so that <ul>/<ol> children are valid (block inside block).
    // Using <p> here would make <ul>/<ol> inside <p> — the browser auto-closes
    // the <p> before each list, splitting paragraphs and breaking layout.
    .replace(/\n\n/g, '</div><div class="mt-2">')
    .replace(/\n/g, '<br/>');
  // Outer <div> wrapper ensures plain-text responses (no \n\n) still have a
  // block container, and multi-paragraph responses open/close correctly.
  return <div className="prose-content" dangerouslySetInnerHTML={{ __html: `<div>${html}</div>` }} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared: Typing dots
// ─────────────────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="typing-dot h-2 w-2 rounded-full bg-[#B4BE6A]"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Free-chat: Bubble
// ─────────────────────────────────────────────────────────────────────────────
// Fix #104: memo() prevents re-rendering every bubble in the list when only
// the latest message or sending state changes at the FreeChatTab level.
const Bubble = memo(function Bubble({ role, content }) {
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
});

// ─────────────────────────────────────────────────────────────────────────────
// Free-chat: Session list item
// ─────────────────────────────────────────────────────────────────────────────
// Fix #105: memo() avoids re-rendering every session tile when only the active
// session changes.  The inline `() => setActiveId(s.id)` arrow in the parent
// previously created a new function reference on every render, defeating memo.
// The prop is renamed `onSelect` and receives `setActiveId` directly so the
// stable setter reference is passed through — the tile itself calls
// `onSelect(session.id)` which is referentially stable.
const SessionItem = memo(function SessionItem({ session, active, onSelect, onDelete, tr }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(session.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(session.id); } }}
      className={`group relative w-full cursor-pointer rounded-xl px-3 py-2.5 text-left transition ${
        active
          ? 'bg-[#302817]/8 text-[#302817]'
          : 'text-[#302817]/60 hover:bg-[#302817]/5 hover:text-[#302817]'
      }`}
    >
      <p className="truncate text-xs font-bold leading-tight pr-6">{session.title}</p>
      <p className="mt-0.5 text-[10px] font-medium text-[#302817]/35">
        {session.message_count ?? 0} {tr ? 'mesaj' : 'msgs'}{session.updated_at ? ` · ${new Date(session.updated_at).toLocaleDateString()}` : ''}
      </p>
      <button
        onClick={e => { e.stopPropagation(); onDelete(session.id); }}
        aria-label={tr ? 'Sohbeti sil' : 'Delete chat'}
        className="absolute right-2 top-2.5 hidden rounded-md p-1 text-[#302817]/30 transition hover:bg-red-50 hover:text-red-400 group-hover:flex"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
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
// Fix #106: memo() prevents re-rendering the full message history on every
// keystroke in the questionnaire input field.
const ChatBubble = memo(function ChatBubble({ msg }) {
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
});

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Chip
// ─────────────────────────────────────────────────────────────────────────────
function Chip({ label, selected, onClick, multi, disabled }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
        selected
          ? 'border-[#95A847] bg-[#95A847] text-white shadow-sm'
          : 'border-[#302817]/12 bg-white text-[#302817]/70 hover:border-[#B4BE6A]/50 hover:bg-[#B4BE6A]/8 hover:text-[#302817]'
      }`}
    >
      {multi && selected && <span className="mr-1" aria-hidden="true">✓</span>}
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
// Questionnaire: CompoundInput
// ─────────────────────────────────────────────────────────────────────────────
function CompoundInput({ fields = [], value, onChange, lang, disabled }) {
  const val = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  return (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      {fields.map(field => {
        // Hide fields whose conditionalOn toggle is false/unset.
        // Boolean fields store true/false; check both the boolean and the string 'true'.
        if (field.conditionalOn) {
          const condVal = val[field.conditionalOn];
          const condMet = condVal === true || condVal === 'true';
          if (!condMet) return null;
        }
        const fieldVal = val[field.id] ?? '';
        const setField = (v) => onChange({ ...val, [field.id]: v });
        const charLen = field.maxLength ? String(fieldVal).length : null;
        return (
          <div key={field.id} className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#302817]/70">
              {field.label?.[lang] || field.label?.en || field.id}
              {field.required && <span className="ml-1 text-red-400">*</span>}
            </label>
            {field.type === 'boolean' ? (
              <div role="radiogroup" className="flex gap-2">
                {[{ value: 'true', label: lang === 'tr' ? 'Evet' : 'Yes' }, { value: 'false', label: lang === 'tr' ? 'Hayır' : 'No' }].map(opt => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    selected={String(fieldVal) === opt.value}
                    onClick={() => !disabled && setField(opt.value === 'true')}
                    disabled={disabled}
                  />
                ))}
              </div>
            ) : field.type === 'select' || field.type === 'single_select' ? (
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {(field.options || []).map(opt => (
                  <Chip
                    key={opt.value}
                    label={opt.label?.[lang] || opt.label?.en || opt.value}
                    selected={fieldVal === opt.value}
                    onClick={() => !disabled && setField(opt.value)}
                    disabled={disabled}
                  />
                ))}
              </div>
            ) : field.subtype === 'multi_line' ? (
              <textarea
                className="rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20 resize-none"
                rows={3}
                value={fieldVal}
                onChange={e => setField(e.target.value)}
                placeholder={field.placeholder?.[lang] || field.placeholder?.en || ''}
                disabled={disabled}
                maxLength={field.maxLength}
              />
            ) : (
              <input
                className="rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20"
                type="text"
                inputMode={field.subtype === 'numeric' ? 'numeric' : 'text'}
                value={fieldVal}
                onChange={e => setField(e.target.value)}
                placeholder={field.placeholder?.[lang] || field.placeholder?.en || ''}
                disabled={disabled}
                maxLength={field.maxLength}
              />
            )}
            {field.maxLength && (
              <span className="text-right text-[10px] text-[#302817]/35">{charLen}/{field.maxLength}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: AnswerInput
// ─────────────────────────────────────────────────────────────────────────────
function AnswerInput({ question, value, onChange, onSubmit, lang, disabled }) {
  const tr = lang === 'tr';
  // Guard against duplicate auto-submits from rapid double-taps on chip options
  const chipTimerRef = useRef(null);
  // Cancel any pending submit timer when this component unmounts (e.g. tab switch)
  useEffect(() => () => { if (chipTimerRef.current !== null) clearTimeout(chipTimerRef.current); }, []);
  const scheduleSubmit = () => {
    if (chipTimerRef.current !== null) clearTimeout(chipTimerRef.current);
    chipTimerRef.current = setTimeout(() => { chipTimerRef.current = null; onSubmit(); }, CHIP_AUTO_SUBMIT_DELAY_MS);
  };

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

  // equipment_loop / fuel_loop — loop sub-questions asked per-item.
  // Render as single_select when the question has options; otherwise fall through to text input.
  if ((type === 'equipment_loop' || type === 'fuel_loop') && options && options.length > 0) {
    return (
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {options.map(opt => (
          <Chip
            key={opt.value}
            label={opt.label?.[lang] || opt.label?.en || opt.value}
            selected={value === opt.value}
            onClick={() => { onChange(opt.value); scheduleSubmit(); }}
            disabled={disabled}
          />
        ))}
      </div>
    );
  }

  if (type === 'country_city') {
    // Disable Confirm until both country AND city are filled.
    // The validator also requires city, so without this guard the user
    // could tap Confirm with an empty city and see an error bubble instead
    // of the button simply staying disabled — confusing on mobile.
    const cityRequired = !value?.city;
    return (
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <CountryCityInput value={value} onChange={onChange} lang={lang} />
        <button
          onClick={onSubmit}
          disabled={disabled || !value?.country || cityRequired}
          className="rounded-full bg-[#302817] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          {tr ? 'Onayla →' : 'Confirm →'}
        </button>
      </div>
    );
  }

  if (type === 'year_select') {
    // Prefer question.options when defined (gives correct range + custom labels)
    if (options && options.length > 0) {
      return (
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {options.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label?.[lang] || opt.label?.en || opt.value}
              selected={value === opt.value}
              onClick={() => { onChange(opt.value); scheduleSubmit(); }}
              disabled={disabled}
            />
          ))}
        </div>
      );
    }
    // Fallback: generate range from minYear/maxYear
    const min = minYear || 2010;
    const max = maxYear || new Date().getFullYear();
    const years = [];
    for (let y = max; y >= min; y--) years.push(y);
    return (
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {years.map(y => (
          <Chip
            key={y}
            label={String(y)}
            selected={value === String(y)}
            onClick={() => { onChange(String(y)); scheduleSubmit(); }}
            disabled={disabled}
          />
        ))}
      </div>
    );
  }

  if (type === 'single_select') {
    return (
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {(options || []).map(opt => (
          <Chip
            key={opt.value}
            label={opt.label?.[lang] || opt.label?.en || opt.value}
            selected={value === opt.value}
            onClick={() => { onChange(opt.value); scheduleSubmit(); }}
            disabled={disabled}
          />
        ))}
      </div>
    );
  }

  if (type === 'multi_select') {
    const vals = Array.isArray(value) ? value : [];
    // Support exclusive options (e.g. value='none'): selecting one clears all others;
    // selecting any other option removes the exclusive one automatically.
    const exclusiveValues = new Set((options || []).filter(o => o.exclusive || o.value === 'none').map(o => o.value));
    const toggle = (v) => {
      if (exclusiveValues.has(v)) {
        // Toggle exclusive option — selecting it clears all other selections
        onChange(vals.includes(v) ? [] : [v]);
      } else {
        // Remove any exclusive options, then toggle the target
        const withoutExclusive = vals.filter(x => !exclusiveValues.has(x));
        if (withoutExclusive.includes(v)) onChange(withoutExclusive.filter(x => x !== v));
        else onChange([...withoutExclusive, v]);
      }
    };
    return (
      <div className="flex flex-col gap-3 w-full">
        <div role="group" aria-label={tr ? 'Seçenekler' : 'Options'} className="flex flex-wrap gap-2">
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

  if (type === 'compound') {
    const fields = question.fields || [];
    const compoundVal = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
    const requiredFields = fields.filter(f => f.required !== false);
    // Fix #100: skip fields whose conditionalOn condition is not met — they are
    // hidden by CompoundInput and have no value, so they must not block the button.
    // Previously, a hidden required field could permanently disable Confirm.
    const allRequiredFilled = requiredFields.every(f => {
      if (f.conditionalOn) {
        const condVal = compoundVal[f.conditionalOn];
        if (condVal !== true && condVal !== 'true') return true; // hidden — treat as satisfied
      }
      const v = compoundVal[f.id];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
    return (
      <div className="flex flex-col gap-4 w-full max-w-lg">
        <CompoundInput
          fields={fields}
          value={value}
          onChange={onChange}
          lang={lang}
          disabled={disabled}
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !allRequiredFilled}
          className="self-start rounded-full bg-[#302817] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          {tr ? 'Onayla →' : 'Confirm →'}
        </button>
      </div>
    );
  }

  // multi_line text
  if (subtype === 'multi_line') {
    const mlRequired = question.required !== false;
    const maxLen = question.maxLength;
    const charCount = String(value || '').length;
    const mlEmpty = !String(value || '').trim();
    return (
      <div className="flex flex-col gap-1 w-full max-w-lg">
        <textarea
          className="w-full rounded-xl border border-[#302817]/12 bg-white px-4 py-2.5 text-sm text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20 resize-none"
          rows={4}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder?.[lang] || placeholder?.en || ''}
          disabled={disabled}
          autoFocus
          maxLength={maxLen}
        />
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-[#302817]/40">{tr ? 'Göndermek için Ctrl+Enter' : 'Ctrl+Enter to submit'}</span>
          {maxLen && <span className="text-[10px] text-[#302817]/35">{charCount}/{maxLen}</span>}
        </div>
        {!mlRequired && mlEmpty && (
          <span className="text-[10px] text-[#302817]/40 pl-1">
            {tr ? 'Bu alan isteğe bağlıdır — boş bırakabilirsiniz.' : 'This field is optional — you may leave it blank.'}
          </span>
        )}
        <button
          onClick={onSubmit}
          disabled={disabled || (mlRequired && mlEmpty)}
          className="self-start rounded-full bg-[#302817] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          {tr ? 'Onayla →' : 'Confirm →'}
        </button>
      </div>
    );
  }

  // text / numeric / single-line
  const isRequired = question.required !== false;
  const maxLen = question.maxLength;
  const charCount = String(value || '').length;
  const isEmpty = !String(value || '').trim();
  return (
    <div className="flex flex-col gap-1 w-full max-w-sm">
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 rounded-xl border border-[#302817]/12 bg-white px-4 py-2.5 text-sm text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20"
          type="text"
          inputMode={subtype === 'numeric' ? 'numeric' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSubmit(); } }}
          placeholder={placeholder?.[lang] || placeholder?.en || ''}
          disabled={disabled}
          autoFocus
          maxLength={maxLen}
        />
        <button
          onClick={onSubmit}
          disabled={disabled || (isRequired && isEmpty)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
      {maxLen && (
        <span className="text-right text-[10px] text-[#302817]/35 pr-12">{charCount}/{maxLen}</span>
      )}
      {!isRequired && isEmpty && (
        <span className="text-[10px] text-[#302817]/40 pl-1">
          {tr ? 'Bu alan isteğe bağlıdır — boş bırakabilirsiniz.' : 'This field is optional — you may leave it blank.'}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Progress Sidebar
// ─────────────────────────────────────────────────────────────────────────────
function ProgressSidebar({ answers, currentId, lang, open, onToggle }) {
  const tr = lang === 'tr';

  // O(stages × answers) — memoized so it only recomputes when answers or currentId change
  const { stageStats, totalAnswered, pct } = useMemo(() => {
    const allAnswered = Object.keys(answers);
    const stageStats = CARBONIQ_STAGES.map(stage => {
      const answeredInStage = allAnswered.filter(qid => {
        const q = getQuestionById(qid);
        return q && q.stage === stage.id;
      });
      return { stage, answeredCount: answeredInStage.length };
    });
    const totalAnswered = allAnswered.length;
    const pct = Math.min(100, Math.round((totalAnswered / TOTAL_QUESTIONS) * 100));
    return { stageStats, totalAnswered, pct };
  }, [answers]);

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-[#302817]/6 bg-[#FAFAF8] transition-all duration-300 ${
        open
          ? 'absolute inset-y-0 left-0 z-30 w-[220px] lg:relative lg:inset-auto lg:z-auto'
          : 'w-0 overflow-hidden'
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
            {totalAnswered} / {TOTAL_QUESTIONS}
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
  const [helpError, setHelpError] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  // Monotonically-incrementing counter for stable message keys — avoids the
  // Date.now() collision risk when two messages land in the same millisecond.
  const msgIdRef = useRef(0);
  // Fix #77: synchronous mutex — prevents two rapid Enter/click events from both
  // seeing helpSessionRef.current===null and each creating a duplicate session.
  // React state (sending) only blocks after a re-render; this ref blocks
  // immediately in the same event-loop tick.
  const helpSessionCreatingRef = useRef(false);
  // Tracks whether the drawer is currently open so async continuations in
  // sendHelp don't dispatch state updates after the drawer has been closed.
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);
  // Fix #89: isMountedRef guards against state updates after resetFlow() unmounts
  // the drawer while a sendHelp fetch is still in flight.  openRef guards the
  // "is the drawer visible" question; isMountedRef guards the "is the component
  // still mounted" question — both checks are needed.
  const isMountedRef = useRef(true);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  // Clear conversation when drawer closes so stale messages don't reappear on next open
  useEffect(() => { if (!open) setMessages([]); }, [open]);

  // Pre-fill when the drawer opens — skip if a send is already in flight.
  // Fix #88: `currentQuestion` removed from deps so advancing to the next question
  // while the drawer is open does NOT overwrite text the user has already started
  // typing.  The pre-fill only fires on a fresh open (open: false → true).
  // `sending` intentionally omitted — only re-trigger on open/language change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && currentQuestion && !sending) {
      const qText = currentQuestion.text?.[lang] || currentQuestion.text?.en || '';
      const pre = tr
        ? `Soru ${currentQuestion.number} hakkında: "${qText}" — `
        : `I'm on question ${currentQuestion.number} about: "${qText}". `;
      setInput(pre);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, lang, tr]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sending]);

  const sendHelp = useCallback(async () => {
    const content = input.trim();
    // Fix #99: reject oversized messages — the backend enforces MAX_MESSAGE_LENGTH=4000
    // and would return a 400, but the drawer has no visible warning for that path.
    if (!content || sending || input.length > CHAT_CHAR_LIMIT) return;

    // Ensure we have a help session — guarded by helpSessionCreatingRef so that
    // two rapid sends (before the first re-render disables the button) don't both
    // see helpSessionRef.current===null and race to create duplicate sessions.
    if (!helpSessionRef.current) {
      if (helpSessionCreatingRef.current) return; // already creating — drop the duplicate
      helpSessionCreatingRef.current = true;
      try {
        const res = await api.createChatSession(tr ? 'Envanter Yardımı' : 'Questionnaire Help');
        if (res.ok) {
          const sess = await res.json();
          helpSessionRef.current = sess.id;
        } else {
          // Fix #103: guard state updates — component may have unmounted or drawer
          // may have been closed while the session-creation request was in-flight.
          if (!isMountedRef.current || !openRef.current) return;
          setHelpError(tr ? 'Oturum başlatılamadı. Lütfen tekrar deneyin.' : 'Could not start session. Please try again.');
          return;
        }
      } catch {
        // Fix #103: same guard for the network-error path.
        if (!isMountedRef.current || !openRef.current) return;
        setHelpError(tr ? 'Bağlantı hatası.' : 'Connection error.');
        return;
      } finally {
        helpSessionCreatingRef.current = false;
      }
    }

    // Fix #103: guard before the post-session-creation state batch — component
    // may have unmounted or drawer closed while createChatSession was awaited.
    if (!isMountedRef.current || !openRef.current) return;
    setInput('');
    setSending(true);
    setHelpError('');
    setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'user', content }]);
    try {
      const res = await api.sendChatMessage(helpSessionRef.current, content);
      // Fix #89: guard with isMountedRef AND openRef so we never setState on an
      // unmounted component (resetFlow path) or on a closed drawer (onClose path).
      if (isMountedRef.current && openRef.current) {
        if (res.ok) {
          const aiMsg = await res.json();
          setMessages(prev => [...prev, { id: aiMsg.id ?? `m-${++msgIdRef.current}`, ...aiMsg }]);
        } else {
          // 404/410 means the session was deleted (e.g. from the FreeChatTab session
          // list). Null the ref so the next send creates a fresh session automatically.
          if (res.status === 404 || res.status === 410) helpSessionRef.current = null;
          setHelpError(tr ? 'Yanıt alınamadı. Lütfen tekrar deneyin.' : 'Could not get a response. Please try again.');
        }
      }
    } catch {
      if (isMountedRef.current && openRef.current) setHelpError(tr ? 'Bağlantı hatası.' : 'Connection error.');
    } finally {
      // Always reset — even if the drawer was closed mid-flight — so the send
      // button is not permanently stuck in a spinner on the next open.
      if (isMountedRef.current) setSending(false);
      if (isMountedRef.current && openRef.current) inputRef.current?.focus();
    }
  }, [input, sending, tr, helpSessionRef]);

  if (!open) return null;

  return (
    <>
      {/* Overlay (mobile) */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 z-50 flex w-[min(340px,100vw)] flex-col border-l border-[#302817]/8 bg-white shadow-[-8px_0_40px_rgba(48,40,23,0.08)] md:relative md:inset-auto md:z-auto md:w-[300px] md:shadow-none">
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
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
          {/* Fix #98+#99: aria-label for accessibility; char limit mirrors backend
              MAX_MESSAGE_LENGTH so users see a warning instead of a cryptic 400. */}
          {(() => {
            const helpCharOver = input.length > CHAT_CHAR_LIMIT;
            const helpCharWarn = input.length >= Math.floor(CHAT_CHAR_LIMIT * 0.8);
            return (
              <>
                <div className={`flex gap-2 rounded-2xl border bg-[#FAFAF8] px-3 py-2 focus-within:ring-2 transition ${
                  helpCharOver
                    ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100'
                    : 'border-[#302817]/10 focus-within:border-[#B4BE6A]/40 focus-within:ring-[#B4BE6A]/15'
                }`}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        // Fix #99: block Enter when over char limit (same guard as FreeChatTab)
                        if (input.length > CHAT_CHAR_LIMIT) return;
                        sendHelp();
                      }
                    }}
                    onInput={e => {
                      // Fix #70: auto-resize to match content (matches FreeChatTab textarea pattern)
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    rows={2}
                    // Fix #98: aria-label provides accessible name for screen readers
                    // (placeholder alone disappears once the user starts typing)
                    aria-label={tr ? 'AI yardım sorusu' : 'AI help question'}
                    className="flex-1 resize-none bg-transparent text-[12.5px] text-[#302817] outline-none placeholder:text-[#302817]/30"
                    placeholder={tr ? 'Sorunuzu yazın…' : 'Ask your question…'}
                    style={{ scrollbarWidth: 'none' }}
                  />
                  <button
                    onClick={sendHelp}
                    disabled={!input.trim() || sending || helpCharOver}
                    className="flex h-7 w-7 shrink-0 self-end items-center justify-center rounded-full bg-[#302817] text-white transition hover:bg-black disabled:opacity-30"
                  >
                    {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </button>
                </div>
                {helpCharWarn && (
                  <p className={`mt-1 text-right text-[10px] font-semibold tabular-nums ${helpCharOver ? 'text-red-500' : 'text-amber-500'}`}>
                    {input.length}/{CHAT_CHAR_LIMIT}
                  </p>
                )}
              </>
            );
          })()}
          {/* Fix #92: add role="alert" so screen readers announce the error; add
              dismiss button for consistency with the FreeChatTab error banner. */}
          {helpError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-1.5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5"
            >
              <span className="flex-1 text-[11px] font-semibold text-red-500">{helpError}</span>
              <button
                onClick={() => setHelpError('')}
                aria-label={tr ? 'Hatayı kapat' : 'Dismiss error'}
                className="shrink-0 text-red-400 transition hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Welcome Screen
// ─────────────────────────────────────────────────────────────────────────────
function QuestionnaireWelcome({ onStart, loading, answeredCount, tr, error }) {
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
            ? `${TOTAL_QUESTIONS} sorudan oluşan ISO 14064-1 uyumlu yapılandırılmış envanter akışı. AI asistanı her adımda yanınızda.`
            : `${TOTAL_QUESTIONS}-question ISO 14064-1 structured inventory flow. AI assistant by your side at every step.`}
        </p>
      </div>
      {answeredCount > 0 && !error && (
        <div className="rounded-2xl border border-[#B4BE6A]/30 bg-[#B4BE6A]/8 px-5 py-3 text-sm font-semibold text-[#75863B]">
          {tr
            ? `${answeredCount} soru daha önce yanıtlandı — kaldığınız yerden devam edebilirsiniz.`
            : `${answeredCount} questions already answered — you can continue where you left off.`}
        </div>
      )}
      {error && (
        <div className="max-w-sm rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600">
          {error}
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
  const [startError, setStartError] = useState('');
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  // loopState: { questionId, items, itemLabels, currentIndex, collected }
  const [loopState, setLoopState] = useState(null);
  // On mobile sidebar starts closed; desktop starts open
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  const helpSessionRef = useRef(null);
  const scrollRef = useRef(null);
  const isMounted = useRef(true);
  const typingTimerRef = useRef(null);
  const saveSuccessTimerRef = useRef(null);
  const scrollTimerRef = useRef(null);
  // Synchronous mutex — prevents a second submitAnswer call from passing the
  // isTyping guard during the await saveStepToBackend network window.
  const isSubmittingRef = useRef(false);
  // Prevents a rapid double-click on "Start / Continue Inventory" from firing
  // two concurrent POST /questionnaire/start/ requests, which would create
  // duplicate reports on the backend.
  const startingRef = useRef(false);
  // Stable message-key counter — avoids Date.now() collisions
  const msgIdRef = useRef(0);
  // Tracks messages.length at the moment the CURRENT question bubble was shown.
  // Stored in history entries so goBack() can slice precisely back to that point,
  // correctly removing all loop-item bubbles regardless of how many there were.
  const questionMsgLenRef = useRef(0);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Cancel any pending timers so they don't fire on a dead component
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const currentQuestion = getQuestionById(currentId);

  // Auto scroll — debounced to prevent double-fire when messages + isTyping update together.
  // Returns a cleanup so the timer never fires on an unmounted component.
  useEffect(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      if (!isMounted.current || !scrollRef.current) return;
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
    return () => { if (scrollTimerRef.current) { clearTimeout(scrollTimerRef.current); scrollTimerRef.current = null; } };
  }, [messages, isTyping]);

  // Keep a ref so the init effect can read the latest answers without being
  // re-triggered on every setAnswers call (which would race with submitAnswer).
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Init answer value when the QUESTION changes (navigation / goBack).
  // Deliberately excludes `answers` from the dep array — the ref above is used
  // instead to avoid re-running on every keystroke / submission.
  useEffect(() => {
    if (currentQuestion) {
      const existing = answersRef.current[currentId];
      setAnswerValue(existing !== undefined ? normalizeAnswerValue(currentQuestion, existing) : getInitialValue(currentQuestion));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]); // only run when the question changes

  // ── handleStart ────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    // Ref guard: the Start button is disabled while loading (startLoading state),
    // but React state updates are async — a rapid double-click can fire two
    // concurrent requests before the first re-render disables the button.
    if (startingRef.current) return;
    startingRef.current = true;
    setStartLoading(true);
    setStartError('');
    // Capture the effective starting question ID before any async setState calls
    // (setState is async — reading currentId after setCurrentId still sees the old value)
    let effectiveId = currentId;
    try {
      const res = await api.startCarbonReport();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // No company or other server error — guard against unmount during the await
        if (!isMounted.current) return;
        setStartError(
          data.error ||
          (tr
            ? 'Rapor başlatılamadı. Lütfen önce Ayarlar bölümünden bir şirket oluşturun.'
            : 'Could not start report. Please create a company first in Settings.')
        );
        return;
      }
      // Fix: backend returns report_id (not id)
      setReportId(data.report_id);
      // If resuming an existing report, jump to where user left off
      if (data.resumed && data.current_step && data.current_step !== 'DONE') {
        effectiveId = data.current_step;
        setCurrentId(data.current_step);
      }

      // Guard: component may have unmounted during the async call
      if (!isMounted.current) return;

      // Build welcome message using effectiveId — not the stale currentId from the closure
      const firstQ = getQuestionById(effectiveId);
      const isResume = effectiveId !== currentId;
      const welcomeMsg = {
        id: 'welcome',
        role: 'assistant',
        content: tr
          ? `Merhaba! Ben CarbonIQ — ISO 14064-1 uyumlu karbon envanteri oluşturmanıza yardımcı olacağım. Size ${TOTAL_QUESTIONS} soru soracağım. İstediğiniz zaman geri dönebilirsiniz.\n\n${isResume ? `**Kaldığınız yer — Soru ${firstQ?.number}:**` : '**Soru 1:**'} ${firstQ?.text?.tr || firstQ?.text?.en}`
          : `Hello! I'm CarbonIQ — I'll help you build an ISO 14064-1 compliant carbon inventory. I'll ask you ${TOTAL_QUESTIONS} questions. You can go back at any time.\n\n${isResume ? `**Resuming — Question ${firstQ?.number}:**` : '**Question 1:**'} ${firstQ?.text?.en}`,
      };
      if (firstQ?.helper) {
        welcomeMsg.content += `\n\n_${firstQ.helper?.[lang] || firstQ.helper?.en}_`;
      }
      setMessages([welcomeMsg]);
      // The welcome message embeds Q1 — treat its length (1) as the "question shown" marker
      // so that goBack() from Q2 correctly slices back to just the welcome message.
      questionMsgLenRef.current = 1;
      setStarted(true);
    } catch {
      if (!isMounted.current) return;
      setStartError(tr ? 'Bağlantı hatası oluştu.' : 'Connection error. Please try again.');
    } finally {
      // Single exit point — replaces three scattered setStartLoading(false) calls.
      if (isMounted.current) {
        setStartLoading(false);
        startingRef.current = false;
      }
    }
  }, [currentId, tr, lang]);

  // ── saveStepToBackend ──────────────────────────────────────────────────────
  const saveStepToBackend = useCallback(async (questionId, value, rid) => {
    const rid_ = rid || reportId;
    if (!rid_) return true; // no backend configured — treat as success
    try {
      const backendData = mapAnswerForBackend(questionId, value);
      const res = await api.submitReportStep(rid_, questionId, backendData);
      // Guard: component may have unmounted while the save request was in-flight
      if (!isMounted.current) return false;
      if (!res.ok) {
        setSaveError(tr ? 'Kayıt hatası oluştu.' : 'Save error occurred.');
        setSaveSuccess(false);
        return false;
      }
      setSaveError(null);
      setSaveSuccess(true);
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = setTimeout(() => {
        if (isMounted.current) setSaveSuccess(false);
      }, 2000);
      return true;
    } catch {
      if (isMounted.current) {
        setSaveError(tr ? 'Bağlantı hatası.' : 'Connection error.');
        setSaveSuccess(false);
      }
      return false;
    }
  }, [reportId, tr]);

  // ── advanceToQuestion ──────────────────────────────────────────────────────
  // Shared helper: navigate to nextId and post its question bubble.
  // Call only from inside a typingTimerRef.current timeout (after setIsTyping(false)).
  const advanceToQuestion = useCallback((nextId) => {
    if (!nextId) {
      setCompleted(true);
      setMessages(prev => {
        questionMsgLenRef.current = prev.length + 1; // keep ref in sync for goBack from completion screen
        return [...prev, {
          id: `m-${++msgIdRef.current}`,
          role: 'assistant',
          type: 'info',
          content: tr
            ? `Tebrikler! Tüm sorular tamamlandı. Karbon envanteriniz başarıyla oluşturuldu.`
            : `Congratulations! All questions completed. Your carbon inventory has been successfully created.`,
        }];
      });
      return;
    }
    const nextQ = getQuestionById(nextId);
    setCurrentId(nextId);
    setAnswerValue(getInitialValue(nextQ));
    let questionText = nextQ?.text?.[lang] || nextQ?.text?.en || '';
    let helperText = nextQ?.helper?.[lang] || nextQ?.helper?.en || '';
    let content = `**${tr ? 'Soru' : 'Question'} ${nextQ?.number}:** ${questionText}`;
    if (helperText) content += `\n\n_${helperText}_`;
    const bubbleType = nextQ?.type === 'info' ? 'info' : 'assistant';
    setMessages(prev => {
      questionMsgLenRef.current = prev.length + 1; // capture length AFTER this bubble
      return [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: bubbleType, content }];
    });
  }, [lang, tr]);

  // ── initLoopOrAdvance ──────────────────────────────────────────────────────
  // If the target question has `loopSource`, initialises a fresh per-item loop
  // using items extracted from currentAnswers[loopSource].  Otherwise just
  // calls advanceToQuestion.  Always call from inside a typingTimerRef callback
  // (i.e. after setIsTyping(false) has been called).
  //
  // Source-answer shapes handled:
  //   • Array  — multi_select answer (most common)
  //   • String — free-text list, split on comma / newline
  //   • Object — collected from a prior loop { item: answer | answer[] };
  //              values are flattened + deduplicated (e.g. fuel types per equipment)
  const initLoopOrAdvance = useCallback((startId, currentAnswers) => {
    // Walk the chain iteratively — avoids stack overflow when multiple consecutive
    // loop questions all have zero items (e.g. all selections were exclusive 'none').
    let nextId = startId;
    while (nextId) {
      const nextQ = getQuestionById(nextId);
      if (!nextQ?.loopSource) break; // non-loop question → let advanceToQuestion handle it
      const built = buildLoopItems(nextId, currentAnswers, lang);
      if (built && built.items.length > 0) {
        const { items, itemLabels } = built;
        setLoopState({ questionId: nextId, items, itemLabels, currentIndex: 0, collected: {} });
        setCurrentId(nextId);
        setAnswerValue(getInitialValue(nextQ));
        const firstLabel = itemLabels[0] || items[0];
        const loopText   = nextQ?.text?.[lang]   || nextQ?.text?.en   || '';
        const loopHelper = nextQ?.helper?.[lang]  || nextQ?.helper?.en || '';
        let content = `**${tr ? 'Soru' : 'Question'} ${nextQ?.number} — ${firstLabel}:** ${loopText}`;
        if (loopHelper) content += `\n\n_${loopHelper}_`;
        setMessages(prev => {
          questionMsgLenRef.current = prev.length + 1; // capture length AFTER first-item bubble
          return [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: 'assistant', content }];
        });
        return;
      }
      // No items — advance to the next in the chain and repeat
      nextId = nextQ.loopNext || null;
    }
    // Either a non-loop question or the end of an all-empty loop chain.
    // Apply the same conditionalShow skip logic used in submitAnswer so that a
    // question reached via loopNext (e.g. 3C-0) is not shown if its condition
    // isn't met.  Without this, a question like 3C-0 (only for industrial NACE
    // sectors) could appear when reached through an empty 3B-EF loop.
    while (nextId) {
      const candidate = getQuestionById(nextId);
      if (!candidate?.conditionalShow) break;
      const { questionId: csQid, includesValue: csVal, inValues: csVals, equals: csEquals } = candidate.conditionalShow;
      const csAnswer = currentAnswers[csQid];
      const matches = csVals
        ? (Array.isArray(csAnswer) ? csAnswer.some(a => csVals.includes(a)) : csVals.includes(csAnswer))
        : csEquals !== undefined
          ? csAnswer === csEquals
          : (Array.isArray(csAnswer) ? csAnswer.includes(csVal) : csAnswer === csVal);
      if (matches) break;
      nextId = candidate.next || candidate.loopNext || null;
    }
    advanceToQuestion(nextId);
  }, [advanceToQuestion, lang, tr]);

  // ── submitAnswer ───────────────────────────────────────────────────────────
  const submitAnswer = useCallback(async (overrideValue) => {
    const q = getQuestionById(currentId);
    if (!q || isTyping) return;
    if (isSubmittingRef.current) return;

    const raw = overrideValue !== undefined ? overrideValue : answerValue;
    const value = normalizeAnswerValue(q, raw);

    // Validate — validateCarbonIQAnswer returns {ok, message}; check .ok not truthiness
    if (q.type !== 'info') {
      const err = validateCarbonIQAnswer(q, value, answers, lang);
      if (!err.ok) {
        setMessages(prev => [...prev, {
          id: `m-${++msgIdRef.current}`,
          role: 'assistant',
          type: 'error',
          content: err.message || (lang === 'tr' ? 'Geçersiz yanıt.' : 'Invalid answer.'),
        }]);
        return;
      }
    }

    // ── Loop handling ──────────────────────────────────────────────────────────
    // If we are currently iterating a loop, collect the item answer and either
    // ask the next item or advance past the loop question entirely.
    if (loopState && loopState.questionId === currentId) {
      const { items, itemLabels, currentIndex, collected } = loopState;
      const itemLabel = itemLabels[currentIndex] || items[currentIndex] || `#${currentIndex + 1}`;
      const newCollected = { ...collected, [items[currentIndex]]: value };

      // Show user bubble with item context
      const displayVal = getDisplayValue(q, value, lang);
      if (q.type !== 'info') {
        setMessages(prev => [...prev, {
          id: `m-${++msgIdRef.current}`,
          role: 'user',
          content: `[${itemLabel}] ${displayVal}`,
        }]);
      }

      const nextIndex = currentIndex + 1;

      if (nextIndex < items.length) {
        // More items to ask — stay on same question, advance index
        const nextLabel = itemLabels[nextIndex] || items[nextIndex] || `#${nextIndex + 1}`;
        // Functional updater: spreads the latest state after the async saveStepToBackend
        // await rather than the closure-captured value, guarding against any future
        // concurrent mutation even though isSubmittingRef currently prevents it.
        setLoopState(prev => prev ? { ...prev, currentIndex: nextIndex, collected: newCollected } : null);
        setAnswerValue(getInitialValue(q));

        // Save collected-so-far to backend — clear mutex AFTER setIsTyping(true)
        // to eliminate the window where both guards are simultaneously false.
        isSubmittingRef.current = true;
        await saveStepToBackend(currentId, newCollected, reportId);

        setIsTyping(true);
        isSubmittingRef.current = false;
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          typingTimerRef.current = null;
          if (!isMounted.current) return;
          setIsTyping(false);
          const loopText = q?.text?.[lang] || q?.text?.en || '';
          const loopHelper = q?.helper?.[lang] || q?.helper?.en || '';
          let content = `**${tr ? 'Soru' : 'Question'} ${q?.number} — ${nextLabel}:** ${loopText}`;
          if (loopHelper) content += `\n\n_${loopHelper}_`;
          setMessages(prev => [...prev, {
            id: `m-${++msgIdRef.current}`,
            role: 'assistant',
            type: 'assistant',
            content,
          }]);
        }, TYPING_DELAY_MS);
        return;
      }

      // All items done — save final collected value and advance past loop question
      const finalAnswers = { ...answers, [currentId]: newCollected };
      setAnswers(finalAnswers);
      // Store msgLen so goBack() can remove ALL loop bubbles (N items × 2 each)
      setHistory(prev => [...prev, { id: currentId, msgLen: questionMsgLenRef.current }]);
      setLoopState(null);

      // Clear mutex AFTER setIsTyping(true) to eliminate mutex gap (same as normal path).
      isSubmittingRef.current = true;
      await saveStepToBackend(currentId, newCollected, reportId);

      // Use newCollected (the full { item: answer } map) not value (last item only) —
      // warnings and assumptions on loop questions are keyed to the aggregate answer.
      const warning = getQuestionWarning ? getQuestionWarning(q, newCollected, lang) : null;
      const newAssumptions = getTriggeredAssumptions ? getTriggeredAssumptions(q, newCollected) : [];
      if (newAssumptions.length > 0) setAssumptions(prev => [...prev, ...newAssumptions]);

      setIsTyping(true);
      isSubmittingRef.current = false;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
        if (!isMounted.current) return;
        setIsTyping(false);
        if (warning) {
          setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: 'warning', content: warning }]);
        }
        // Advance past loop, skipping any conditionalShow-hidden questions.
        // Use candidate.next (not getNextQuestionId) for the skip step — getNextQuestionId
        // with an empty default answer returns null for nextByValue-only questions,
        // which would falsely terminate the questionnaire.
        let nextId = q.loopNext || null;
        while (nextId) {
          const candidate = getQuestionById(nextId);
          if (!candidate?.conditionalShow) break;
          const { questionId: csQid, includesValue: csVal, inValues: csVals, equals: csEquals } = candidate.conditionalShow;
          const csAnswer = finalAnswers[csQid];
          const matches = csVals
            ? (Array.isArray(csAnswer) ? csAnswer.some(a => csVals.includes(a)) : csVals.includes(csAnswer))
            : csEquals !== undefined
              ? csAnswer === csEquals
              : (Array.isArray(csAnswer) ? csAnswer.includes(csVal) : csAnswer === csVal);
          if (matches) break;
          nextId = candidate.next || candidate.loopNext || null;
        }
        initLoopOrAdvance(nextId, finalAnswers);
      }, TYPING_DELAY_MS);
      return;
    }
    // ── End loop handling ──────────────────────────────────────────────────────

    // Add user bubble
    const displayVal = getDisplayValue(q, value, lang);
    if (q.type !== 'info') {
      setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'user', content: displayVal }]);
    }

    // Save answer
    const newAnswers = { ...answers, [currentId]: value };
    setAnswers(newAnswers);
    setHistory(prev => [...prev, { id: currentId, msgLen: questionMsgLenRef.current }]);

    // Save to backend — lock out further submits until save completes;
    // isSubmittingRef is cleared AFTER setIsTyping(true) to avoid the
    // tiny gap where both guards are false simultaneously.
    isSubmittingRef.current = true;
    await saveStepToBackend(currentId, value, reportId);

    // getQuestionWarning takes (question, value, lang); getTriggeredAssumptions takes (question, value)
    // — lang is resolved at render time for assumptions so language switches show correct text.
    const warning = getQuestionWarning ? getQuestionWarning(q, value, lang) : null;
    // getSystemMessage resolves the contextual info message for the selected answer (if any).
    // These are defined on 50+ questions (systemMessages) but were previously never displayed.
    const sysMsg = getSystemMessage ? getSystemMessage(q, value, lang) : null;
    const newAssumptions = getTriggeredAssumptions ? getTriggeredAssumptions(q, value) : [];
    if (newAssumptions.length > 0) {
      setAssumptions(prev => [...prev, ...newAssumptions]);
    }

    // Show typing — reset mutex only AFTER setIsTyping(true) so there is
    // never a window where both isSubmitting and isTyping are false.
    setIsTyping(true);
    isSubmittingRef.current = false;

    // Cancel any previous timer that hasn't fired yet
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
      if (!isMounted.current) return;
      setIsTyping(false);

      if (warning) {
        setMessages(prev => [...prev, {
          id: `m-${++msgIdRef.current}`,
          role: 'assistant',
          type: 'warning',
          content: warning,
        }]);
      }
      // Show contextual system message as an info bubble (after any warning, before next question)
      if (sysMsg) {
        setMessages(prev => [...prev, {
          id: `m-${++msgIdRef.current}`,
          role: 'assistant',
          type: 'info',
          content: sysMsg,
        }]);
      }

      // Compute candidate next question, then skip any conditionalShow-hidden questions.
      // Use candidate.next for skip-advance (not getNextQuestionId) to avoid null
      // on nextByValue-only questions that have no default answer path.
      let nextId = getNextQuestionId(q, value);
      while (nextId) {
        const candidate = getQuestionById(nextId);
        if (!candidate?.conditionalShow) break;
        const { questionId: csQid, includesValue: csVal, inValues: csVals, equals: csEquals } = candidate.conditionalShow;
        const csAnswer = newAnswers[csQid];
        const matches = csVals
          ? (Array.isArray(csAnswer) ? csAnswer.some(a => csVals.includes(a)) : csVals.includes(csAnswer))
          : csEquals !== undefined
            ? csAnswer === csEquals
            : (Array.isArray(csAnswer) ? csAnswer.includes(csVal) : csAnswer === csVal);
        if (matches) break;
        nextId = candidate.next || candidate.loopNext || null;
      }

      if (!nextId) {
        setCompleted(true);
        setMessages(prev => [...prev, {
          id: `m-${++msgIdRef.current}`,
          role: 'assistant',
          type: 'info',
          content: tr
            ? `Tebrikler! Tüm sorular tamamlandı. Karbon envanteriniz başarıyla oluşturuldu.`
            : `Congratulations! All questions completed. Your carbon inventory has been successfully created.`,
        }]);
      } else {
        initLoopOrAdvance(nextId, newAnswers);
      }
    }, TYPING_DELAY_MS);
  }, [currentId, answerValue, answers, isTyping, loopState, reportId, lang, tr, saveStepToBackend, initLoopOrAdvance]);

  // ── goBack ─────────────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (history.length === 0) return;
    // Cancel any in-flight typing timer so its callback can't post stale bubbles
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    isSubmittingRef.current = false;
    setIsTyping(false);

    const prevEntry = history[history.length - 1];
    // History entries are { id, msgLen } objects; guard against legacy string entries
    const prevId  = typeof prevEntry === 'object' ? prevEntry.id  : prevEntry;
    const msgLen  = typeof prevEntry === 'object' ? prevEntry.msgLen : null;
    setHistory(prev => prev.slice(0, -1));
    setCurrentId(prevId);
    const prevQ = getQuestionById(prevId);

    // Restore messages to exactly the state when prevId's bubble was first shown.
    // msgLen = messages.length right after that bubble was added, so slice to msgLen
    // removes the user's answer, any warning, the next question, and (for loops) all
    // extra per-item bubbles — in a single reliable cut.
    if (msgLen != null) {
      setMessages(prev => prev.slice(0, msgLen));
      questionMsgLenRef.current = msgLen; // keep ref in sync for any further goBack
    } else {
      // Fallback for history entries that predate the msgLen format
      const hadWarning = getQuestionWarning && getQuestionWarning(prevQ, answers[prevId], lang);
      const toRemove = prevQ?.type === 'info' ? 1 : hadWarning ? 3 : 2;
      setMessages(prev => prev.slice(0, -toRemove));
    }

    if (prevQ?.loopSource) {
      // Re-enter the loop from item 0 so submitAnswer takes the loop path again.
      // Clear the old collected answer so the user re-answers all items cleanly.
      const built = buildLoopItems(prevId, answers, lang);
      if (built && built.items.length > 0) {
        const { items, itemLabels } = built;
        setLoopState({ questionId: prevId, items, itemLabels, currentIndex: 0, collected: {} });
        setAnswers(prev => { const n = { ...prev }; delete n[prevId]; return n; });
      } else {
        setLoopState(null);
      }
      setAnswerValue(getInitialValue(prevQ));
    } else {
      setLoopState(null);
      setAnswerValue(normalizeAnswerValue(prevQ, answers[prevId]) ?? getInitialValue(prevQ));
    }
  }, [history, answers, lang]);

  // ── resetFlow ──────────────────────────────────────────────────────────────
  const resetFlow = useCallback(() => {
    // Cancel any in-flight typing animation so it can't post stale bubbles
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    if (saveSuccessTimerRef.current) { clearTimeout(saveSuccessTimerRef.current); saveSuccessTimerRef.current = null; }
    isSubmittingRef.current = false;
    const initId = getInitialQuestionId();
    setCurrentId(initId);
    setAnswers({});
    setHistory([]);
    setCompleted(false);
    setAssumptions([]);
    setSaveError(null);
    setSaveSuccess(false);
    setLoopState(null);
    setIsTyping(false);
    setResetConfirm(false);
    helpSessionRef.current = null; // clear help session so next help opens a fresh one
    setReportId(null);             // prevent stale report ID from leaking into the new session
    setMessages([]);
    questionMsgLenRef.current = 0;
    setAnswerValue(getInitialValue(getQuestionById(initId)));
    // Return to welcome screen — handleStart will create a fresh backend report
    // and assign a new reportId, so subsequent saves reach the correct session.
    // Without this, reportId stays null and all post-reset answers are silently discarded.
    setStarted(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!started) {
    return (
      <QuestionnaireWelcome
        onStart={handleStart}
        loading={startLoading}
        answeredCount={Object.keys(answers).length}
        tr={tr}
        error={startError}
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden relative">
      {/* Mobile backdrop for progress sidebar */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/25 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
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
                  {tr ? 'Soru' : 'Q'} {currentQuestion.number} / {TOTAL_QUESTIONS}
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
                aria-label={tr ? 'Önceki soruya dön' : 'Go back to previous question'}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/6 hover:text-[#302817] transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {resetConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-red-500">{tr ? 'Emin misin?' : 'Sure?'}</span>
                <button
                  onClick={() => { setResetConfirm(false); resetFlow(); }}
                  className="rounded-full bg-red-500 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-red-600"
                >
                  {tr ? 'Evet' : 'Yes'}
                </button>
                <button
                  onClick={() => setResetConfirm(false)}
                  className="rounded-full border border-[#302817]/15 px-2 py-1 text-[10px] font-bold text-[#302817]/50 transition hover:bg-[#302817]/5"
                >
                  {tr ? 'Hayır' : 'No'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setResetConfirm(true)}
                title={tr ? 'Sıfırla' : 'Reset'}
                aria-label={tr ? 'Envanteri sıfırla' : 'Reset inventory'}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/6 hover:text-[#302817] transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chat messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div
            className="mx-auto flex w-full max-w-2xl flex-col gap-4"
            aria-live="polite"
            aria-atomic="false"
            aria-label={tr ? 'Sohbet geçmişi' : 'Conversation history'}
          >
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
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
            {assumptions.length > 0 && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  {tr ? 'ISO 14064-1 Varsayımları' : 'ISO 14064-1 Assumptions'}
                </p>
                <ul className="flex flex-col gap-1">
                  {assumptions.map((a, i) => {
                    // Stable key: use questionId + trigger rather than the missing a.id field
                    const key = typeof a === 'object'
                      ? `${a.questionId || ''}_${a.trigger || i}`
                      : String(a);
                    // Resolve bilingual text at render time so language switches work
                    const text = typeof a === 'object'
                      ? (typeof a.text === 'object' ? (a.text?.[lang] || a.text?.en) : a.text)
                      : a;
                    return <li key={key} className="text-xs text-blue-800">• {text}</li>;
                  })}
                </ul>
              </div>
            )}
            {saveSuccess && (
              <div role="status" aria-live="polite" className="rounded-2xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-700">
                {tr ? '✓ Kaydedildi' : '✓ Saved'}
              </div>
            )}
            {saveError && (
              <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700">
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
              {resetConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#302817]/60">{tr ? 'Tüm yanıtlar silinecek. Emin misin?' : 'All answers will be cleared. Sure?'}</span>
                  <button onClick={() => { setResetConfirm(false); resetFlow(); }} className="rounded-full bg-red-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-600">{tr ? 'Evet, Sıfırla' : 'Yes, Reset'}</button>
                  <button onClick={() => setResetConfirm(false)} className="rounded-full border border-[#302817]/15 px-4 py-2 text-xs font-bold text-[#302817]/50 transition hover:bg-[#302817]/5">{tr ? 'İptal' : 'Cancel'}</button>
                </div>
              ) : (
                <button
                  onClick={() => setResetConfirm(true)}
                  className="flex items-center gap-2 rounded-full border border-[#302817]/12 bg-white px-5 py-2.5 text-sm font-semibold text-[#302817]/70 shadow-sm transition hover:bg-[#302817]/5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {tr ? 'Yeniden Başla' : 'Start Over'}
                </button>
              )}
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
  // On mobile starts closed; desktop opens automatically
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState('');
  // Mirrors creatingSessionRef so the "New Chat" buttons can be disabled while
  // the createChatSession request is in-flight (refs don't trigger re-renders).
  const [creatingSession, setCreatingSession] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  // Ref mirror of tr — lets the session-load effect read the current language
  // without being in its dependency array (which would re-trigger the fetch on
  // every language switch even though sessions are language-independent).
  const trRef = useRef(tr);
  useEffect(() => { trRef.current = tr; }, [tr]);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  // Stable message-key counter — avoids Date.now() collisions
  const msgIdRef = useRef(0);
  // Ref mirror of `input` — lets sendMessage read the current value without
  // adding `input` to its dep array (which would cause it to be recreated on
  // every keystroke, cascading to startNew and handleKeyDown).
  const inputValueRef = useRef('');
  const scrollTimerRef = useRef(null);
  // isMounted guard — prevents state updates after component unmounts from async callbacks
  const isMountedRef = useRef(true);
  // Prevents concurrent "New chat" calls from creating duplicate sessions
  const creatingSessionRef = useRef(false);
  // Fix #101: ref mirror of `sending` — lets sendMessage guard against concurrent
  // sends synchronously (same tick) without adding `sending` to its dep array.
  // With `sending` in the dep array, sendMessage/startNew/handleKeyDown were all
  // recreated on every send-start and send-end, causing 3 unnecessary re-memoizations
  // per round-trip.  The ref guard is also MORE correct than state: it blocks in the
  // same event-loop tick, eliminating the TOCTOU window where two rapid clicks both
  // see sending===false before the first re-render.
  const sendingRef = useRef(false);
  // Tracks per-session in-flight deletes so double-clicks don't send duplicate DELETEs
  const deletingIdsRef = useRef(/** @type {Set<string|number>} */ (new Set()));
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, []);

  // Fix #93: mirror the QuestionnaireTab scroll pattern — null the ref inside
  // the callback (so stale non-null is never left after it fires), check
  // isMountedRef before calling scrollTo, and null in cleanup (was just clearing
  // without nulling, leaving a dangling non-null value in the ref).
  useEffect(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      if (!isMountedRef.current || !scrollRef.current) return;
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
    return () => { if (scrollTimerRef.current) { clearTimeout(scrollTimerRef.current); scrollTimerRef.current = null; } };
  }, [messages, sending]);

  useEffect(() => {
    // Sessions are language-independent — load only once on mount.
    // [tr] is NOT in the dep array to prevent a spurious API re-fetch + loading-spinner
    // flash on every language switch. trRef.current is read inside the callback so
    // error messages still resolve in the language that was active when the error fired.
    let cancelled = false;
    (async () => {
      setLoadingSessions(true);
      try {
        const res = await api.getChatSessions();
        if (!cancelled && res.ok) {
          // Fix 26E: coerce to array — backend may return paginated {results:[],count:0}
          const d = await res.json().catch(() => []);
          setSessions(Array.isArray(d) ? d : (d.results ?? []));
        } else if (!cancelled && !res.ok) setError(trRef.current ? 'Sohbetler yüklenemedi.' : 'Could not load chats.');
      } catch {
        if (!cancelled) setError(trRef.current ? 'Sohbetler yüklenemedi.' : 'Could not load chats.');
      }
      if (!cancelled) setLoadingSessions(false);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // [tr] is intentionally excluded — messages are language-independent.
    // trRef.current gives the current language for error messages without
    // re-triggering a fetch on every TR↔EN switch (same pattern as loadSessions).
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    setError('');          // Fix #69: clear stale error from previous session
    setLoadingMessages(true);
    (async () => {
      try {
        const res = await api.getChatSession(activeId);
        if (cancelled) return; // tab switched before response arrived
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setMessages((data.messages || []).map((m, i) => ({ id: m.id ?? `hist-${i}`, ...m })));
        } else if (!cancelled) {
          setError(trRef.current ? 'Mesajlar yüklenemedi.' : 'Could not load messages.');
        }
      } catch {
        if (!cancelled) setError(trRef.current ? 'Mesajlar yüklenemedi.' : 'Could not load messages.');
      }
      if (!cancelled) {
        setLoadingMessages(false);
        inputRef.current?.focus();
      }
    })();
    return () => { cancelled = true; }; // cleanup: ignore response if activeId changed
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // sendMessage declared BEFORE startNew so that startNew's dep array [sendMessage]
  // references an already-initialised variable (avoids TDZ / stale-undefined dep).
  const sendMessage = useCallback(async (text, sid) => {
    // Read input from the ref mirror rather than from closure so that `input`
    // does not need to be in the dep array — if it were, sendMessage (and
    // everything that depends on it: startNew, handleKeyDown) would be
    // recreated on every keystroke, causing unnecessary re-renders.
    const content = (text || inputValueRef.current).trim();
    const sessionId = sid || activeId;
    // Fix #101: use sendingRef (synchronous, same-tick) instead of `sending` state
    // so the guard fires immediately without waiting for a re-render.
    if (!content || !sessionId || sendingRef.current) return;

    setInput('');
    inputValueRef.current = '';
    sendingRef.current = true;
    setSending(true);
    setError('');
    setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'user', content }]);

    try {
      const res = await api.sendChatMessage(sessionId, content);
      if (!isMountedRef.current) return;
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (isMountedRef.current) setError(d.error || (trRef.current ? 'Bir hata oluştu.' : 'Something went wrong.'));
      } else {
        const aiMsg = await res.json();
        if (!isMountedRef.current) return;
        setMessages(prev => [...prev, { id: aiMsg.id ?? `m-${++msgIdRef.current}`, ...aiMsg }]);
        if (aiMsg.session_title) {
          // Fix #45: after updating the session title / timestamp, re-sort descending by
          // updated_at so the active chat bubbles up to the top of the sidebar list,
          // matching the server-side ORDER BY -updated_at on next page load.
          setSessions(prev => [...prev.map(s =>
            s.id === sessionId
              ? { ...s, title: aiMsg.session_title, updated_at: new Date().toISOString(), message_count: (s.message_count || 0) + 2 }
              : s
          )].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
        }
      }
    } catch {
      if (isMountedRef.current) setError(trRef.current ? 'Bağlantı hatası.' : 'Connection error.');
    } finally {
      // Mirror the sendHelp pattern: always reset sending so the button is never
      // permanently stuck in spinner state if an early return skips this path.
      // Fix #101: reset sendingRef unconditionally (ref is not tied to mount state).
      sendingRef.current = false;
      if (isMountedRef.current) {
        setSending(false);
        inputRef.current?.focus();
      }
    }
  }, [activeId]); // Fix #101: `sending` removed — read via sendingRef.current; `tr` and `input` also read via refs

  const startNew = useCallback(async (initialPrompt = '') => {
    // Prevent concurrent "New chat" clicks from creating duplicate sessions.
    // Ref provides the synchronous guard; state drives the disabled prop on the button.
    if (creatingSessionRef.current) return;
    creatingSessionRef.current = true;
    setCreatingSession(true);
    try {
      const res = await api.createChatSession();
      if (!isMountedRef.current) return;
      if (!res.ok) {
        setError(trRef.current ? 'Sohbet başlatılamadı.' : 'Failed to start chat.');
        return;
      }
      const session = await res.json();
      if (!isMountedRef.current) return;
      setSessions(prev => [session, ...prev]);
      setActiveId(session.id);
      setMessages([]);
      setError('');
      if (initialPrompt) {
        // Tiny delay lets React flush the state above (activeId, messages) before
        // sendMessage reads them. sendMessage is stable (no input dep), so it is
        // safe to omit from this dep array.
        setTimeout(() => { if (isMountedRef.current) sendMessage(initialPrompt, session.id); }, CHIP_AUTO_SUBMIT_DELAY_MS);
      }
    } catch {
      if (isMountedRef.current) setError(trRef.current ? 'Bağlantı hatası.' : 'Connection error.');
    } finally {
      creatingSessionRef.current = false;
      if (isMountedRef.current) setCreatingSession(false);
    }
  }, [sendMessage]); // `tr` removed — read via trRef.current

  const deleteSession = useCallback(async (id) => {
    // Guard: ignore double-clicks / rapid re-submits for the same session id
    if (deletingIdsRef.current.has(id)) return;
    deletingIdsRef.current.add(id);
    try {
      const res = await api.deleteChatSession(id);
      if (!isMountedRef.current) return;
      if (!res.ok) {
        setError(trRef.current ? 'Sohbet silinemedi.' : 'Failed to delete chat.');
        return;
      }
      // Fix #90: guard all state updates with isMountedRef — the user could navigate
      // away while the DELETE is in-flight, causing "Can't perform a React state update
      // on an unmounted component" warnings without this check.
      if (!isMountedRef.current) return;
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeId === id) { setActiveId(null); setMessages([]); }
    } catch {
      if (isMountedRef.current) setError(trRef.current ? 'Sohbet silinemedi. Lütfen tekrar deneyin.' : 'Failed to delete chat. Please try again.');
    } finally {
      // Always clean up the in-flight guard regardless of mount state
      deletingIdsRef.current.delete(id);
    }
  }, [activeId]); // `tr` removed — read via trRef.current

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Fix #86: block Enter when the message is over the character limit — the
      // send button is already disabled via `charOver`, but the keyboard path
      // bypassed that check and sent a request that the backend rejects with 400.
      if (inputValueRef.current.length > CHAT_CHAR_LIMIT) return;
      // Fix #83: when no session is open, Enter should start a new chat (same as
      // the send button's onClick), instead of silently calling sendMessage which
      // immediately returns because sessionId is null. The textarea placeholder
      // now also hints at this behaviour ("Press Enter… to start chatting").
      if (!activeId) startNew(inputValueRef.current);
      else sendMessage();
    }
  }, [activeId, sendMessage, startNew]);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeId), [sessions, activeId]);

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      {/* Mobile backdrop for chat sidebar */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/25 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside className={`flex shrink-0 flex-col border-r border-[#302817]/6 bg-[#FAFAF8] transition-all duration-300 ${
        sidebarOpen
          ? 'absolute inset-y-0 left-0 z-30 w-[220px] lg:relative lg:inset-auto lg:z-auto'
          : 'w-0 overflow-hidden'
      }`}>
        <div className="flex items-center justify-between border-b border-[#302817]/6 px-3 py-3">
          <span className="text-xs font-bold text-[#302817]/50 uppercase tracking-wider">
            {tr ? 'Sohbetler' : 'Chats'}
          </span>
          <button
            onClick={() => startNew()}
            disabled={creatingSession}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
            title={tr ? 'Yeni sohbet' : 'New chat'}
          >
            {creatingSession
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Plus className="h-3.5 w-3.5" />}
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
                onSelect={setActiveId}
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
              disabled={creatingSession}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingSession
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Plus className="h-3 w-3" />}
              {tr ? 'Yeni' : 'New'}
            </button>
          )}
        </header>

        {/* Error banner — shown at all times (session load, message load, send errors) */}
        {/* Fix #81: added dismiss × so users aren't stuck staring at a stale error. */}
        {error && (
          <div role="alert" aria-live="assertive" className="shrink-0 mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError('')}
              aria-label={tr ? 'Hatayı kapat' : 'Dismiss error'}
              className="shrink-0 text-red-400 transition hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

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
              {messages.map((msg) => (
                <Bubble key={msg.id} role={msg.role} content={msg.content} />
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
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#302817]/6 px-4 py-3 sm:px-6">
          {/* Fix #82: mirror the backend MAX_MESSAGE_LENGTH=4000 in the UI so users
              see a warning before they hit a 400 error, not after.
              Fix #87: CHAT_CHAR_LIMIT is now a module-level constant (see top of file)
              so it is not re-declared on every render cycle. */}
          {(() => {
            const charCount = input.length;
            const charOver  = charCount > CHAT_CHAR_LIMIT;
            const charWarn  = charCount >= Math.floor(CHAT_CHAR_LIMIT * 0.8); // 3200+
            return (
              <>
                <div className={`mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[22px] border bg-white px-4 py-3 shadow-[0_4px_20px_rgba(48,40,23,0.05)] focus-within:ring-4 transition ${
                  charOver
                    ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100'
                    : 'border-[#302817]/10 focus-within:border-[#B4BE6A]/50 focus-within:ring-[#B4BE6A]/12'
                }`}>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => { setInput(e.target.value); inputValueRef.current = e.target.value; }}
                    onKeyDown={handleKeyDown}
                    // Fix #91: was `disabled={!activeId && !sending}` which prevented typing
                    // before a session existed, making the "Press Enter to start chatting"
                    // placeholder a lie — users could not type a custom first message.
                    // Now only locked during active network operations (sending / creatingSession).
                    disabled={sending || creatingSession}
                    placeholder={
                      !activeId
                        ? (tr ? 'Yeni sohbet başlatmak için Enter\'a basın' : 'Press Enter or click ↑ to start chatting')
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
                    disabled={!input.trim() || sending || creatingSession || charOver}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {/* Fix #68: also disable + spin during session creation (creatingSession),
                        not just while AI is replying (sending). Matches sidebar/header buttons. */}
                    {(sending || creatingSession)
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="mt-1.5 mx-auto flex w-full max-w-3xl items-center justify-between px-1">
                  <p className="text-[10px] text-[#302817]/25">
                    {tr ? 'CarbonIQ yanılabilir. Önemli kararlar için uzmanla doğrulayın.' : 'CarbonIQ may make errors. Verify critical decisions with an expert.'}
                  </p>
                  {charWarn && (
                    <span className={`text-[10px] font-semibold tabular-nums ${charOver ? 'text-red-500' : 'text-amber-500'}`}>
                      {charCount}/{CHAT_CHAR_LIMIT}
                    </span>
                  )}
                </div>
              </>
            );
          })()}
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
  // Fix #44: track whether the Chat tab has ever been opened so we can lazy-mount
  // FreeChatTab on first visit and then KEEP it mounted on subsequent tab switches.
  // Switching tabs no longer unmounts the inactive component, preserving questionnaire
  // state (messages, answers, history, loopState) across tab switches.
  const [chatMounted, setChatMounted] = useState(false);

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
          onClick={() => { setActiveTab('chat'); setChatMounted(true); }}
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

      {/* Tab content — both stay mounted once visited so in-progress state is preserved */}
      <div className="flex flex-1 min-h-0 flex-col">
        <div className={`flex flex-1 min-h-0 flex-col ${activeTab !== 'questionnaire' ? 'hidden' : ''}`}>
          <QuestionnaireTab language={language} />
        </div>
        {chatMounted && (
          <div className={`flex flex-1 min-h-0 flex-col ${activeTab !== 'chat' ? 'hidden' : ''}`}>
            <FreeChatTab language={language} />
          </div>
        )}
      </div>
    </div>
  );
}
