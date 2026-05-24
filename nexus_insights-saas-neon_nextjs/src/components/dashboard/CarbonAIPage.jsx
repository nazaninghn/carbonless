'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  getTriggeredAssumptions,
  validateCarbonIQAnswer,
} from '@/lib/carboniq/questions';

// ─────────────────────────────────────────────────────────────────────────────
// Timing constants
const TYPING_DELAY_MS = 900;       // simulated AI "thinking" animation duration
const CHIP_AUTO_SUBMIT_DELAY_MS = 80; // lets React flush state before sendMessage reads it

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
  if (q.type === 'single_select' || q.type === 'year_select') {
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
// hard-coded tag strings (strong, em, code, p, li, br) — no href/src
// attributes are produced, so javascript: URI injection is not possible.
// ─────────────────────────────────────────────────────────────────────────────
function Markdown({ text }) {
  const html = (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
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
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
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
function Chip({ label, selected, onClick, multi, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
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
// Questionnaire: CompoundInput
// ─────────────────────────────────────────────────────────────────────────────
function CompoundInput({ fields = [], value, onChange, lang, disabled }) {
  const val = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  return (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      {fields.map(field => {
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
              <div className="flex gap-2">
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
              <div className="flex flex-wrap gap-2">
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
    // Prefer question.options when defined (gives correct range + custom labels)
    if (options && options.length > 0) {
      return (
        <div className="flex flex-wrap gap-2">
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
      <div className="flex flex-wrap gap-2">
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
      <div className="flex flex-wrap gap-2">
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

  if (type === 'compound') {
    const fields = question.fields || [];
    const compoundVal = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
    const requiredFields = fields.filter(f => f.required !== false);
    const allRequiredFilled = requiredFields.every(f => {
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
    const maxLen = question.maxLength;
    const charCount = String(value || '').length;
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
        <button
          onClick={onSubmit}
          disabled={disabled || !String(value || '').trim()}
          className="self-start rounded-full bg-[#302817] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          {tr ? 'Onayla →' : 'Confirm →'}
        </button>
      </div>
    );
  }

  // text / numeric / single-line
  const maxLen = question.maxLength;
  const charCount = String(value || '').length;
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
          disabled={disabled || !String(value || '').trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
      {maxLen && (
        <span className="text-right text-[10px] text-[#302817]/35 pr-12">{charCount}/{maxLen}</span>
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
  // Tracks whether the drawer is currently open so async continuations in
  // sendHelp don't dispatch state updates after the drawer has been closed.
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  // Clear conversation when drawer closes so stale messages don't reappear on next open
  useEffect(() => { if (!open) setMessages([]); }, [open]);

  // Pre-fill when opened — skip if a send is already in flight to avoid overwriting the input
  useEffect(() => {
    if (open && currentQuestion && !sending) {
      const qText = currentQuestion.text?.[lang] || currentQuestion.text?.en || '';
      const pre = tr
        ? `Soru ${currentQuestion.number} hakkında: "${qText}" — `
        : `I'm on question ${currentQuestion.number} about: "${qText}". `;
      setInput(pre);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  // Include the full question object (not just .id) so a language switch that
  // changes question.text while keeping the same id still re-fills the input.
  }, [open, currentQuestion, lang, tr]); // `sending` intentionally omitted — we only want to re-trigger on open/question change

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sending]);

  const sendHelp = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;

    // Ensure we have a help session
    if (!helpSessionRef.current) {
      try {
        const res = await api.createChatSession(tr ? 'Envanter Yardımı' : 'Questionnaire Help');
        if (res.ok) {
          const sess = await res.json();
          helpSessionRef.current = sess.id;
        } else {
          setHelpError(tr ? 'Oturum başlatılamadı. Lütfen tekrar deneyin.' : 'Could not start session. Please try again.');
          return;
        }
      } catch {
        setHelpError(tr ? 'Bağlantı hatası.' : 'Connection error.');
        return;
      }
    }

    setInput('');
    setSending(true);
    setHelpError('');
    setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'user', content }]);
    try {
      const res = await api.sendChatMessage(helpSessionRef.current, content);
      if (openRef.current) {
        if (res.ok) {
          const aiMsg = await res.json();
          setMessages(prev => [...prev, { id: aiMsg.id ?? `m-${++msgIdRef.current}`, ...aiMsg }]);
        } else {
          setHelpError(tr ? 'Yanıt alınamadı. Lütfen tekrar deneyin.' : 'Could not get a response. Please try again.');
        }
      }
    } catch {
      if (openRef.current) setHelpError(tr ? 'Bağlantı hatası.' : 'Connection error.');
    }
    setSending(false);
    if (openRef.current) inputRef.current?.focus();
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
          {helpError && (
            <p className="mt-1.5 text-[11px] font-semibold text-red-500">{helpError}</p>
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
  // Stable message-key counter — avoids Date.now() collisions
  const msgIdRef = useRef(0);
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

  // Auto scroll — debounced to prevent double-fire when messages + isTyping update together
  useEffect(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 50);
  }, [messages, isTyping]);

  // Keep a ref so the init effect can read the latest answers without being
  // re-triggered on every setAnswers call (which would race with submitAnswer).
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Init answer value when the QUESTION changes (navigation / goBack).
  // Deliberately excludes `answers` from the dep array — the ref above is used
  // instead to avoid re-running on every keystroke / submission.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentQuestion) {
      const existing = answersRef.current[currentId];
      setAnswerValue(existing !== undefined ? normalizeAnswerValue(currentQuestion, existing) : getInitialValue(currentQuestion));
    }
  }, [currentId]); // only run when the question changes

  // ── handleStart ────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setStartLoading(true);
    setStartError('');
    // Capture the effective starting question ID before any async setState calls
    // (setState is async — reading currentId after setCurrentId still sees the old value)
    let effectiveId = currentId;
    try {
      const res = await api.startCarbonReport();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // No company or other server error
        setStartError(
          data.error ||
          (tr
            ? 'Rapor başlatılamadı. Lütfen önce Ayarlar bölümünden bir şirket oluşturun.'
            : 'Could not start report. Please create a company first in Settings.')
        );
        setStartLoading(false);
        return;
      }
      // Fix: backend returns report_id (not id)
      setReportId(data.report_id);
      // If resuming an existing report, jump to where user left off
      if (data.resumed && data.current_step && data.current_step !== 'DONE') {
        effectiveId = data.current_step;
        setCurrentId(data.current_step);
      }
    } catch {
      if (!isMounted.current) return;
      setStartError(tr ? 'Bağlantı hatası oluştu.' : 'Connection error. Please try again.');
      setStartLoading(false);
      return;
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
    setStarted(true);
    setStartLoading(false);
  }, [currentId, tr, lang]);

  // ── saveStepToBackend ──────────────────────────────────────────────────────
  const saveStepToBackend = useCallback(async (questionId, value, rid) => {
    const rid_ = rid || reportId;
    if (!rid_) return true; // no backend configured — treat as success
    try {
      const backendData = mapAnswerForBackend(questionId, value);
      const res = await api.submitReportStep(rid_, questionId, backendData);
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
      setSaveError(tr ? 'Bağlantı hatası.' : 'Connection error.');
      setSaveSuccess(false);
      return false;
    }
  }, [reportId, tr]);

  // ── advanceToQuestion ──────────────────────────────────────────────────────
  // Shared helper: navigate to nextId and post its question bubble.
  // Call only from inside a typingTimerRef.current timeout (after setIsTyping(false)).
  const advanceToQuestion = useCallback((nextId) => {
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
    setMessages(prev => [...prev, {
      id: `m-${++msgIdRef.current}`,
      role: 'assistant',
      type: bubbleType,
      content,
    }]);
  }, [lang, tr]);

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
        setLoopState({ ...loopState, currentIndex: nextIndex, collected: newCollected });
        setAnswerValue(getInitialValue(q));

        // Save collected-so-far to backend
        isSubmittingRef.current = true;
        await saveStepToBackend(currentId, newCollected, reportId);
        isSubmittingRef.current = false;

        setIsTyping(true);
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
      setHistory(prev => [...prev, currentId]);
      setLoopState(null);

      isSubmittingRef.current = true;
      await saveStepToBackend(currentId, newCollected, reportId);
      isSubmittingRef.current = false;

      const warning = getQuestionWarning ? getQuestionWarning(q, value, lang) : null;
      const newAssumptions = getTriggeredAssumptions ? getTriggeredAssumptions(q, value, lang) : [];
      if (newAssumptions.length > 0) setAssumptions(prev => [...prev, ...newAssumptions]);

      setIsTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
        if (!isMounted.current) return;
        setIsTyping(false);
        if (warning) {
          setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: 'warning', content: warning }]);
        }
        // Advance past loop, skipping any conditionalShow-hidden questions
        let nextId = q.loopNext || null;
        while (nextId) {
          const candidate = getQuestionById(nextId);
          if (!candidate?.conditionalShow) break;
          const { questionId: csQid, includesValue: csVal, inValues: csVals } = candidate.conditionalShow;
          const csAnswer = finalAnswers[csQid];
          const matches = csVals
            ? (Array.isArray(csAnswer) ? csAnswer.some(a => csVals.includes(a)) : csVals.includes(csAnswer))
            : (Array.isArray(csAnswer) ? csAnswer.includes(csVal) : csAnswer === csVal);
          if (matches) break;
          nextId = getNextQuestionId(candidate, getInitialValue(candidate));
        }
        advanceToQuestion(nextId);
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
    setHistory(prev => [...prev, currentId]);

    // Save to backend — lock out further submits until save completes;
    // setIsTyping(true) takes over blocking once the timer fires.
    isSubmittingRef.current = true;
    await saveStepToBackend(currentId, value, reportId);
    isSubmittingRef.current = false;

    // getQuestionWarning/getTriggeredAssumptions take the question OBJECT + single value + lang
    const warning = getQuestionWarning ? getQuestionWarning(q, value, lang) : null;
    const newAssumptions = getTriggeredAssumptions ? getTriggeredAssumptions(q, value, lang) : [];
    if (newAssumptions.length > 0) {
      setAssumptions(prev => [...prev, ...newAssumptions]);
    }

    // Show typing
    setIsTyping(true);

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

      // Compute candidate next question, then skip any conditionalShow-hidden questions
      let nextId = getNextQuestionId(q, value);
      while (nextId) {
        const candidate = getQuestionById(nextId);
        if (!candidate?.conditionalShow) break;
        const { questionId: csQid, includesValue: csVal, inValues: csVals } = candidate.conditionalShow;
        const csAnswer = newAnswers[csQid];
        const matches = csVals
          ? (Array.isArray(csAnswer) ? csAnswer.some(a => csVals.includes(a)) : csVals.includes(csAnswer))
          : (Array.isArray(csAnswer) ? csAnswer.includes(csVal) : csAnswer === csVal);
        if (matches) break;
        nextId = getNextQuestionId(candidate, getInitialValue(candidate));
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
        const nextQ = getQuestionById(nextId);

        // Initialize loop state if the next question is a loop question
        if (nextQ?.loopType && nextQ?.loopSource) {
          const sourceAnswer = newAnswers[nextQ.loopSource];
          // Arrays come from multi_select; strings (e.g. free-text facility list) are split by comma/newline
          const items = Array.isArray(sourceAnswer)
            ? sourceAnswer
            : (typeof sourceAnswer === 'string' && sourceAnswer.trim()
                ? sourceAnswer.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
                : []);
          const sourceQ = getQuestionById(nextQ.loopSource);
          const itemLabels = items.map(item => {
            const opt = sourceQ?.options?.find(o => o.value === item);
            return opt?.label?.[lang] || opt?.label?.en || item;
          });
          if (items.length > 0) {
            setLoopState({ questionId: nextId, items, itemLabels, currentIndex: 0, collected: {} });
            setCurrentId(nextId);
            setAnswerValue(getInitialValue(nextQ));
            const firstLabel = itemLabels[0] || items[0];
            const loopText = nextQ?.text?.[lang] || nextQ?.text?.en || '';
            const loopHelper = nextQ?.helper?.[lang] || nextQ?.helper?.en || '';
            let content = `**${tr ? 'Soru' : 'Question'} ${nextQ?.number} — ${firstLabel}:** ${loopText}`;
            if (loopHelper) content += `\n\n_${loopHelper}_`;
            setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: 'assistant', content }]);
            return;
          }
          // No items to loop — skip the loop question entirely
          nextId = nextQ.loopNext || null;
        }

        advanceToQuestion(nextId);
      }
    }, TYPING_DELAY_MS);
  }, [currentId, answerValue, answers, isTyping, loopState, reportId, lang, tr, saveStepToBackend, advanceToQuestion]);

  // ── goBack ─────────────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (history.length === 0) return;
    // Cancel any in-flight typing timer — its callback would overwrite the
    // currentId/answerValue we're about to set and append a stale bubble.
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    isSubmittingRef.current = false;
    setIsTyping(false);
    // Clear any active loop — going back exits the loop entirely
    setLoopState(null);
    const prevId = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentId(prevId);
    const prevQ = getQuestionById(prevId);
    setAnswerValue(normalizeAnswerValue(prevQ, answers[prevId]) ?? getInitialValue(prevQ));
    // Determine how many messages were added when prevId was answered:
    //   info type: 1  (no user bubble, just the next question bubble)
    //   non-info without warning: 2  (user bubble + next question bubble)
    //   non-info with warning: 3  (user bubble + warning bubble + next question bubble)
    // getQuestionWarning takes the question OBJECT + single value + lang (not ID, not answers map)
    const hadWarning = getQuestionWarning && getQuestionWarning(prevQ, answers[prevId], lang);
    const toRemove = prevQ?.type === 'info' ? 1 : hadWarning ? 3 : 2;
    setMessages(prev => prev.slice(0, -toRemove));
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
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
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
                  {assumptions.map((a, i) => (
                    <li key={i} className="text-xs text-blue-800">• {a}</li>
                  ))}
                </ul>
              </div>
            )}
            {saveSuccess && (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-700">
                {tr ? '✓ Kaydedildi' : '✓ Saved'}
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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  // Stable message-key counter — avoids Date.now() collisions
  const msgIdRef = useRef(0);
  // Ref mirror of `input` — lets sendMessage read the current value without
  // adding `input` to its dep array (which would cause it to be recreated on
  // every keystroke, cascading to startNew and handleKeyDown).
  const inputValueRef = useRef('');
  const scrollTimerRef = useRef(null);

  useEffect(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
    return () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); };
  }, [messages, sending]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSessions(true);
      try {
        const res = await api.getChatSessions();
        if (!cancelled && res.ok) setSessions(await res.json());
        else if (!cancelled && !res.ok) setError(tr ? 'Sohbetler yüklenemedi.' : 'Could not load chats.');
      } catch {
        if (!cancelled) setError(tr ? 'Sohbetler yüklenemedi.' : 'Could not load chats.');
      }
      if (!cancelled) setLoadingSessions(false);
    })();
    return () => { cancelled = true; };
  }, [tr]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    setLoadingMessages(true);
    (async () => {
      try {
        const res = await api.getChatSession(activeId);
        if (cancelled) return; // tab switched before response arrived
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setMessages((data.messages || []).map((m, i) => ({ id: m.id ?? `hist-${i}`, ...m })));
        } else if (!cancelled) {
          setError(tr ? 'Mesajlar yüklenemedi.' : 'Could not load messages.');
        }
      } catch {
        if (!cancelled) setError(tr ? 'Mesajlar yüklenemedi.' : 'Could not load messages.');
      }
      if (!cancelled) {
        setLoadingMessages(false);
        inputRef.current?.focus();
      }
    })();
    return () => { cancelled = true; }; // cleanup: ignore response if activeId changed
  }, [activeId, tr]);

  // sendMessage declared BEFORE startNew so that startNew's dep array [sendMessage]
  // references an already-initialised variable (avoids TDZ / stale-undefined dep).
  const sendMessage = useCallback(async (text, sid) => {
    // Read input from the ref mirror rather than from closure so that `input`
    // does not need to be in the dep array — if it were, sendMessage (and
    // everything that depends on it: startNew, handleKeyDown) would be
    // recreated on every keystroke, causing unnecessary re-renders.
    const content = (text || inputValueRef.current).trim();
    const sessionId = sid || activeId;
    if (!content || !sessionId || sending) return;

    setInput('');
    inputValueRef.current = '';
    setSending(true);
    setError('');
    setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'user', content }]);

    try {
      const res = await api.sendChatMessage(sessionId, content);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || (tr ? 'Bir hata oluştu.' : 'Something went wrong.'));
      } else {
        const aiMsg = await res.json();
        setMessages(prev => [...prev, { id: aiMsg.id ?? `m-${++msgIdRef.current}`, ...aiMsg }]);
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
  }, [activeId, sending, tr]); // `input` removed — read via inputValueRef.current

  const startNew = useCallback(async (initialPrompt = '') => {
    try {
      const res = await api.createChatSession();
      if (!res.ok) {
        setError(tr ? 'Sohbet başlatılamadı.' : 'Failed to start chat.');
        return;
      }
      const session = await res.json();
      setSessions(prev => [session, ...prev]);
      setActiveId(session.id);
      setMessages([]);
      setError('');
      if (initialPrompt) {
        // Tiny delay lets React flush the state above (activeId, messages) before
        // sendMessage reads them. sendMessage is stable (no input dep), so it is
        // safe to omit from this dep array.
        setTimeout(() => sendMessage(initialPrompt, session.id), CHIP_AUTO_SUBMIT_DELAY_MS);
      }
    } catch {
      setError(tr ? 'Bağlantı hatası.' : 'Connection error.');
    }
  }, [sendMessage, tr]);

  const deleteSession = useCallback(async (id) => {
    try {
      const res = await api.deleteChatSession(id);
      if (!res.ok) {
        setError(tr ? 'Sohbet silinemedi.' : 'Failed to delete chat.');
        return;
      }
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeId === id) { setActiveId(null); setMessages([]); }
    } catch {
      setError(tr ? 'Sohbet silinemedi. Lütfen tekrar deneyin.' : 'Failed to delete chat. Please try again.');
    }
  }, [activeId, tr]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

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

        {/* Error banner — shown at all times (session load, message load, send errors) */}
        {error && (
          <div className="shrink-0 mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
            {error}
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
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[22px] border border-[#302817]/10 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(48,40,23,0.05)] focus-within:border-[#B4BE6A]/50 focus-within:ring-4 focus-within:ring-[#B4BE6A]/12 transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); inputValueRef.current = e.target.value; }}
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
