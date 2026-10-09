'use client';

import { getPermissions, noPermissionMessage } from '@/lib/permissions';
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import Image from 'next/image';
import {
  Send, Plus, Trash2, MessageSquare, Sparkles, Loader2, ChevronLeft,
  ClipboardList, RotateCcw, X, FileText, Download,
  HelpCircle, CheckCircle2, Menu, BarChart3, BookOpen,
  Zap, Fuel, Car, Plane, Flame, Droplets, Truck, Calendar, Save, AlertCircle, Pencil, Check,
} from 'lucide-react';
import { api } from '@/lib/utils/api';
import { COUNTRIES } from '@/lib/data/countries';
import CompletionReportCard from './CompletionReportCard';
import { InventoryProvider, useInventory } from './InventoryWorkflow';
import InventoryLibrary from './InventoryLibrary';
import ReviewPage from './ReviewPage';
import SaveDraftModal from './SaveDraftModal';
import ConfirmDialog from '@/components/ConfirmDialog';

// ─────────────────────────────────────────────────────────────────────────────
// Carbon Brain orb animations (injected once via <style> in FreeChatTab)
// ─────────────────────────────────────────────────────────────────────────────
const CHAT_ANIM_STYLES = `
@keyframes cbFloat   { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-14px)} }
@keyframes cbGlow    { 0%,100%{opacity:0.45} 50%{opacity:1} }
@keyframes cbRing    { to{transform:rotate(360deg)} }
@keyframes cbFadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.cb-float   { animation: cbFloat   5.5s ease-in-out infinite; }
.cb-glow    { animation: cbGlow    4s   ease-in-out infinite; }
.cb-ring    { animation: cbRing    9s   linear     infinite; }
.cb-ring-r  { animation: cbRing    14s  linear     infinite reverse; }
.cb-fadeup  { animation: cbFadeUp  0.55s ease-out  both; }
`;
import {
  CARBONIQ_STAGES,
  CARBONIQ_QUESTIONS,
  TOTAL_QUESTIONS,
  getInitialQuestionId,
  getNextQuestionId,
  getQuestionById,
  setQuestionnaireCompanyCountry,
  getQuestionWarning,
  getSystemMessage,
  getTriggeredAssumptions,
  validateCarbonIQAnswer,
  normalizeCarbonIQNumbers,
  readAnswerValue,
  resolveFieldOptions,
  employeeCountWarning,
  exclusionShareWarning,
  scope3RowWarning,
  unmapPhase1Answer,
  groupedLoopItems,
  baseLoopItem,
  loopItemGroup,
} from '@/lib/carboniq/questions';
import { fixed } from '@/lib/formatNumber';
import { isFutureMonth, futurePeriodMessage } from '@/lib/periods';

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
  // All 81 provinces (il), in Turkish alphabetical order.
  TR: ['Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya','Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kilis','Kırıkkale','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Şanlıurfa','Siirt','Sinop','Şırnak','Sivas','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak'],
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

// Country names in the UI language, from the shared country list.
const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));
const COUNTRY_CODES = ['TR','GB','DE','US','FR','IT','ES','NL','BE','AT','CH','SE','NO','DK','FI','PL','PT','GR',
  'RU','UA','CN','JP','KR','IN','SA','AE','QA','IL','EG','MA','BR','MX','AR','CA','AU','NZ',
  'SG','MY','TH','ID','VN','GE','AZ','KZ','OTHER'];
function countryName(code, lang) {
  if (code === 'OTHER') return lang === 'tr' ? 'Diğer' : 'Other';
  const c = COUNTRY_BY_CODE[code];
  return c ? (lang === 'tr' ? c.tr : c.en) : code;
}
// City <select> value that switches to typing the city name.
const OTHER_CITY = '__other__';

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
    case 'A6': {
      const purposeMap = {
        'internal_strategy': 'internal', 'legal_obligation': 'legal',
        'voluntary_disclosure': 'voluntary', 'customer_request': 'client', 'skip': 'skip',
      };
      // 'skip' is itself a valid StepA6Serializer choice (VALID_PURPOSES
      // includes it) — filtering it out before sending used to drop it
      // silently, so re-opening A6 via Edit after picking "I want to skip"
      // showed nothing selected instead of that choice still checked.
      return { purposes: Array.isArray(value) ? value.map(v => purposeMap[v] || v) : [] };
    }
    // 'skip' maps to null (the field is nullable), distinct from a real 'no'
    // — collapsing both to false used to make a resumed/edited A7 show "No"
    // selected after the user had actually picked "I want to skip".
    case 'A7': return { has_previous_report: value === 'skip' ? null : value === 'yes' };
    case 'A7a': { const y = parseInt(value, 10); return { baseline_year: Number.isNaN(y) ? null : y }; }
    // A7b is a compound step whose field ids are already the Company field
    // names, so it passes straight through. Every field is optional; blanks are
    // sent as empty strings so clearing one actually clears it on the server.
    case 'A7b': {
      const v = (value && typeof value === 'object') ? value : {};
      return {
        registered_address: v.registered_address || '',
        tax_office: v.tax_office || '',
        trade_registry_number: v.trade_registry_number || '',
        telephone: v.telephone || '',
        website: v.website || '',
        inventory_declaration_scope: v.inventory_declaration_scope || '',
        environmental_regulations: v.environmental_regulations || '',
        certificates: v.certificates || '',
      };
    }

    // ── Phase 1 continuation (B / C / D) ──────────────────────────────────────
    // B1: options are 'NACE_A', 'NACE_B', … — strip the prefix so handle_B1's
    // nace_code[0] cluster detection ('A'→agriculture, 'C'→manufacturing, etc.) works.
    case 'B1': {
      const raw = typeof value === 'string' ? value : '';
      return { nace_code: raw.replace(/^NACE_/, ''), nace_label: '' };
    }
    case 'B2': return { activity_description: value || '' };
    // B3: frontend option values use underscores ('1_50'); backend serializer expects
    // hyphens/plus ('1-50', '5000+').
    case 'B3': {
      const bandMap = {
        '1_50': '1-50', '51_250': '51-250', '251_1000': '251-1000',
        '1001_5000': '1001-5000', '5000_plus': '5000+',
      };
      return { employee_band: bandMap[value] || value };
    }
    // B4: text/numeric input — coerce string to integer for the serializer.
    case 'B4': { const n = parseInt(value, 10); return { number_of_facilities: Number.isNaN(n) ? 1 : n }; }
    case 'B5': return { facility_types: Array.isArray(value) ? value : [] };
    // B6: frontend uses snake_case values; backend serializer expects its own format.
    case 'B6': {
      const revenueMap = {
        'under_1m': '<1M', '1m_10m': '1-10M', '10m_100m': '10-100M',
        '100m_1b': '100M-1B', 'over_1b': '1B+',
      };
      return { revenue_band: revenueMap[value] || value };
    }
    // C1/C2/C3: options are 'yes'/'no'; DRF BooleanField only accepts true/false.
    case 'C1': return { has_subsidiaries: value === 'yes' };
    case 'C2': return { has_international: value === 'yes' };
    case 'C3': return { has_jv_franchise: value === 'yes' };
    // D1/D3/D4: option values already match serializer choices.
    case 'D1': return { ef_database: value };
    case 'D3': return { boundary_approach: value };
    case 'D4': return { scope3_approach: value };

    default: return { answer: value };
  }
}

// Stage-1 answers that change from year to year, never pre-filled from
// another inventory: employee band, number of locations, revenue band.
const YEAR_SPECIFIC_STEPS = new Set(['B3', 'B4', 'B6']);

// unmapPhase1Answer, readAnswerValue: imported from questions.js — shared with
// InventoryWorkflow.jsx (which normalises a resumed report's answers at
// hydration time and would circularly import this file otherwise).

// Evaluates a question's `conditionalShow` against the current answers.
// Shared by the forward-skip loop in submitAnswer and the progress denominator,
// so "is this question reachable?" is answered the same way in both places.
//
// A finished loop question (loopSource) stores its answer as an aggregate map
// keyed by loop item — { 'natural_gas': 'sector_average', 'diesel': 'invoice_meter' }
// for a scalar per-item answer, or { 'EQ-3D-01': {refill_kg, capacity_kg}, ... }
// when the per-item question is itself a compound. Neither shape is a bare
// string/array, so without unpacking them here, any conditionalShow that
// targets a loop question can never match — which is exactly what made 3A-6a
// (the estimation-method follow-up) unreachable. `field` lets a condition
// drill into one compound sub-field (per loop item, or on a plain compound
// answer) before the value/membership check runs.
function conditionalShowMatches(conditionalShow, answersMap) {
  if (!conditionalShow) return true;
  const { questionId, field, includesValue, inValues, equals, greaterThan, unitIn } = conditionalShow;
  const raw = readAnswerValue(answersMap, questionId);
  // unitIn: an "amount unit" answer (or any item of a per-site loop) was
  // given in one of these units — 4A-1a only for a TL invoice amount.
  if (unitIn) {
    const vals = raw && typeof raw === 'object' ? Object.values(raw) : [raw];
    return vals.some(v => typeof v === 'string' && unitIn.includes(v.trim().split(/\s+/).pop()));
  }

  let candidates;
  if (Array.isArray(raw)) {
    candidates = raw;
  } else if (raw && typeof raw === 'object') {
    const values = Object.values(raw);
    const isLoopOfCompounds = values.length > 0 && values.every(v => v && typeof v === 'object');
    if (field) {
      candidates = isLoopOfCompounds ? values.map(v => v[field]) : [raw[field]];
    } else {
      candidates = isLoopOfCompounds ? [] : values; // no scalar to compare without `field`
    }
  } else {
    candidates = [raw];
  }

  if (inValues) return candidates.some(v => inValues.includes(v));
  if (equals !== undefined) {
    return candidates.some(v => (typeof equals === 'number' ? Number(v) === equals : v === equals));
  }
  // e.g. K3C7-2 (hybrid office days) only makes sense if hybrid_count > 0.
  if (greaterThan !== undefined) return candidates.some(v => Number(v) > greaterThan);
  return candidates.includes(includesValue);
}

// The questions on this user's route through the survey, in order: walked
// from the first question along the answers given (nextByValue branches,
// loops, hidden conditional questions), and past the last answer along each
// question's default next. Answers left behind on a branch the user later
// turned away from (6A-2 after switching 6A-1 to "none flagged") are not on
// the route, so the summaries and the progress count no longer include them.
// Section pickers and go-back answers only lead back into earlier sections
// while editing, so the walk takes the forward branch instead.
function questionPath(answersMap) {
  const src = answersMap || {};
  const path = [];
  const seen = new Set();
  let id = getInitialQuestionId();
  while (id && !seen.has(id) && path.length < 2000) {
    const q = getQuestionById(id);
    if (!q) break;
    seen.add(id);
    if (q.conditionalShow && !(id in src) && !conditionalShowMatches(q.conditionalShow, src)) {
      id = q.next || q.loopNext || null;
      continue;
    }
    if (q.loopSource && !(id in src) && loopResumeState(q, src).items.length === 0) {
      id = q.loopNext || q.next || null;
      continue;
    }
    if (q.type === 'section_picker') { id = q.next || null; continue; }
    path.push(q);
    const answered = id in src;
    const value = answered ? readAnswerValue(src, id) : undefined;
    let next;
    if (q.loopSource) next = q.loopNext || q.next || null;
    else if (q.type === 'info' || !answered) {
      next = q.next || q.loopNext || (q.nextByValue ? Object.values(q.nextByValue).find(Boolean) : null) || null;
    } else next = getNextQuestionId(q, value);
    if (next === '4-GİRİŞ' && readAnswerValue(src, 'SCOPE-GROUPING') !== 'separate') {
      next = getQuestionById('4-GİRİŞ')?.next || next;
    }
    const backwards = (n) => !n || seen.has(n) || getQuestionById(n)?.type === 'section_picker';
    if (next && backwards(next)) {
      const alts = [q.next, ...Object.values(q.nextByValue || {}), q.loopNext];
      next = alts.find(n => n && !backwards(n)) || null;
    }
    id = next;
  }
  return path;
}

// The survey's progress: real questions answered over the questions that
// apply given the answers so far. Shown in the sidebar and sent with every
// saved step, so the inventory library shows the very same numbers.
function computeSurveyProgress(answersMap, completed = false) {
  const route = questionPath(answersMap).filter(q => q.type !== 'info');
  const answered = route.filter(q => q.id in answersMap).length;
  const total = completed ? answered : route.length;
  const percent = completed ? 100 : (total ? Math.min(100, Math.round((answered / total) * 100)) : 0);
  return { answered, total, percent };
}

// Supplier EF form → the step whose consumption amounts it applies to.
const EF_SOURCE_STEP = { '3A-EF-a': '3A-5', '3B-EF-a': '3B-7', '4A-EF-a': '4A-1', '4B-EF-a': '4B-2' };
const UNIT_GROUP = {
  kwh: 'energy', mwh: 'energy', gj: 'energy',
  litre: 'liquid', l: 'liquid', lt: 'liquid',
  kg: 'mass', ton: 'mass', tonne: 'mass', tonnes: 'mass',
  'm³': 'gas', m3: 'gas',
  km: 'distance', 'ton-km': 'freight',
};
// The consumption units entered for an EF form's source step (["m³"]), and
// whether the chosen "kg CO₂e / <unit>" fits none of them. Only a hint for
// the user to re-check the document — nothing is converted or recalculated.
function efUnitMismatch(questionId, efUnit, answers) {
  const src = EF_SOURCE_STEP[questionId];
  const m = /^kgCO2e_(.+)$/.exec(String(efUnit || ''));
  if (!src || !m) return null;
  const efGroup = UNIT_GROUP[m[1].toLowerCase()];
  if (!efGroup) return null;
  const units = new Set();
  const walk = (v) => {
    if (typeof v === 'string') {
      const u = v.trim().match(/[\d.,]+\s*(\S+)$/);
      if (u) units.add(u[1]);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(readAnswerValue(answers, src));
  const list = [...units];
  if (!list.length || list.some(u => UNIT_GROUP[u.toLowerCase()] === efGroup)) return null;
  return list;
}

// 109a rows pre-filled from Stage 2: the sites put outside operational
// control in 28a, with the reason given in 2C-1 (the share is left to the
// user — 2C-2 is in tCO2e, not a share).
const STAGE2_REASON_TO_6A = {
  no_control: 'not_controlled', operational_boundary: 'not_controlled', no_data: 'no_data',
  immaterial: 'materiality', sold_divested: 'other', other: 'other',
};
function stage2ExclusionRows(answers) {
  if (readAnswerValue(answers, '2B-OC1') !== 'no') return [];
  const raw = readAnswerValue(answers, '2B-OC1a');
  const rows = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  const reason = STAGE2_REASON_TO_6A[readAnswerValue(answers, '2C-1')] || '';
  return rows.map(r => String(r?.facility || '').trim()).filter(Boolean)
    .map(source => ({ source, reason, share: '' }));
}

// Facilities the user declared outside operational control in 2B-OC1a
// (lower-cased), [] when 2B-OC1 was answered "yes".
function noControlSites(answers) {
  if (readAnswerValue(answers, '2B-OC1') !== 'no') return [];
  const raw = readAnswerValue(answers, '2B-OC1a');
  const rows = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  return rows.map(r => String(r?.facility || '').trim().toLocaleLowerCase('tr-TR')).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire helpers
// ─────────────────────────────────────────────────────────────────────────────
// The earlier answer for one item of a per-site / per-fuel loop question. The
// saved answer is the whole loop's {itemKey: value} map; the input for an item
// must get that item's own value, never the map itself (which rendered as
// "[object Object]" when a user came back to such a question).
function loopItemValue(aggregate, itemKey) {
  if (!aggregate || typeof aggregate !== 'object' || Array.isArray(aggregate)) return undefined;
  return aggregate[itemKey];
}

function normalizeAnswerValue(q, raw) {
  if (!q) return raw;
  if (q.type === 'multi_select') return Array.isArray(raw) ? raw : (raw ? [raw] : []);
  if (q.type === 'compound') {
    if (q.repeatable) {
      // A question made repeatable later (e.g. 6C-2) may still hold one plain
      // object from before — keep it as the first item instead of dropping it.
      // A saved row that lacks a field the question requires now (K3C1-4a's
      // category, the description of a "Diğer" waste) opens in the form to
      // be completed: a row in the list can only be removed, not edited.
      const incomplete = (row) => (q.fields || []).some(f => {
        if (f.required === false) return false;
        if (f.conditionalOn) {
          const c = row[f.conditionalOn];
          const met = f.conditionalOnValue ? f.conditionalOnValue.includes(c) : (c === true || c === 'true');
          if (!met) return false;
        }
        return String(row[f.id] ?? '').trim() === '';
      });
      let rows = [];
      // An answer saved when the question was one line of text (6A-1a) opens
      // as the first row's name instead of being dropped.
      if (typeof raw === 'string' && raw.trim() && q.fields?.[0]) {
        return { items: [], draft: { [q.fields[0].id]: raw.trim() } };
      }
      if (raw && typeof raw === 'object' && Array.isArray(raw.items)) {
        // A form that already holds something (a pre-filled row) stays as is.
        if (raw.draft && typeof raw.draft === 'object' && Object.values(raw.draft).some(v => String(v ?? '').trim())) {
          return { items: raw.items, draft: raw.draft };
        }
        rows = raw.items;
      }
      else if (raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length > 0) rows = [raw];
      const firstOpen = rows.findIndex(r => r && typeof r === 'object' && incomplete(r));
      if (firstOpen === -1) return { items: rows, draft: {} };
      return { items: rows.filter((_, i) => i !== firstOpen), draft: rows[firstOpen] };
    }
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  }
  return raw ?? '';
}

// An earlier amount comes back in its stored form ("120000 kWh", "2.1");
// put it in the input the way the user types numbers ("120.000", "2,1").
function localizeStoredAmount(q, v, lang) {
  const numericQ = q?.subtype === 'numeric' || q?.type === 'numeric' || !!q?.units;
  if (!numericQ || typeof v !== 'string') return v;
  const m = /^(\d+(?:\.\d+)?)(\s+\S.*)?$/.exec(v.trim());
  if (!m) return v;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || (n < 1000 && !m[1].includes('.'))) return v;
  return `${n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 6 })}${m[2] || ''}`;
}

// Source lists whose earlier-inventory answer is shown as a reminder (3A-1 …).
const PREVIOUS_SELECTION_STEPS = ['3A-1', '3B-1', '3C-1', '3D-0'];

// Clean option labels for user-facing display:
// 1. Strip leading code prefixes like "EQ-3B-13 — ", "SC-01 — "
// 2. Strip routing arrows like " → Scope 1", " → Kapsam 2 (Kategori 13)"
// 3. Strip internal overlap warnings like " (⚠ Cat.4 overlap check)"
// 4. Strip NACE codes in parens like " (NACE C23)"
function stripOptionCode(text) {
  if (!text) return text;
  let result = text;
  // 1. Leading code prefix: all-caps/digits/hyphens before " — "
  const dashIdx = result.indexOf(' — ');
  if (dashIdx !== -1) {
    const prefix = result.slice(0, dashIdx);
    if (/^[A-Z0-9][A-Z0-9-]*$/.test(prefix)) result = result.slice(dashIdx + 3);
  }
  // 2. Routing arrow suffix " → ..." (catches Scope/Kapsam/Aktarılır etc.)
  const arrowIdx = result.indexOf(' →');
  if (arrowIdx !== -1) result = result.slice(0, arrowIdx);
  // 3. Internal overlap warning "(⚠ ...)"
  result = result.replace(/\s*\(⚠[^)]*\)/g, '');
  // 4. NACE code in parens "(NACE ...)"
  result = result.replace(/\s*\(NACE[^)]*\)/g, '');
  return result.trim();
}

// Labels of the visible required compound fields still empty in `obj` — lets a
// disabled Confirm / Done button say what it is waiting for instead of just
// greying out (conditionalOn-hidden fields are ignored, as in the button check).
function missingRequiredLabels(requiredFields, obj, lang) {
  return requiredFields
    .filter(f => {
      if (f.conditionalOn) {
        const condVal = obj[f.conditionalOn];
        const condMet = f.conditionalOnValue
          ? f.conditionalOnValue.includes(condVal)
          : (condVal === true || condVal === 'true');
        if (!condMet) return false;
      }
      const v = obj[f.id];
      return v === undefined || v === null || String(v).trim() === '';
    })
    .map(f => f.label?.[lang] || f.label?.en || f.id);
}

function MissingFieldsHint({ labels, tr }) {
  if (!labels || labels.length === 0) return null;
  return (
    <p role="status" className="text-[11px] font-semibold text-amber-700">
      {tr ? 'Eksik alanlar: ' : 'Still needed: '}{labels.join(', ')}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper: extract the items + itemLabels for a loop question.
// Returns null if the question is not a loop question.
// Shared by initLoopOrAdvance (on the forward path) and goBack (on the back path).
// ─────────────────────────────────────────────────────────────────────────────
// Upper bound for a count-driven loop, so a mistyped "500" doesn't ask 500 times.
const MAX_LOOP_ITEMS = 50;

// "Binek araç", or "Binek araç — Grup 2" for a type split into groups.
function loopItemLabel(sourceQ, item, items, lang) {
  const base = baseLoopItem(item);
  const opt = sourceQ?.options?.find(o => o.value === base);
  const label = stripOptionCode(opt?.label?.[lang] || opt?.label?.en || base);
  const group = loopItemGroup(item);
  const split = group > 1 || (items || []).includes(`${base}#2`);
  return split ? `${label} — ${lang === 'tr' ? 'Grup' : 'Group'} ${group}` : label;
}

function buildLoopItems(loopQuestionId, currentAnswers, lang) {
  const q = getQuestionById(loopQuestionId);
  if (!q?.loopSource) return null;
  const sourceAnswer = currentAnswers[q.loopSource];
  const countQ = getQuestionById(q.loopSource);
  // A numeric source ("How many facilities?" → 5) means N items, one per
  // facility. It used to be read as one text item "5", so a company with five
  // sites was asked about a single one (name, activity, electricity…).
  const isCount = countQ && (countQ.subtype === 'numeric' || countQ.type === 'numeric');
  const count = isCount ? parseInt(String(sourceAnswer ?? '').replace(/\D/g, ''), 10) : NaN;
  if (isCount && count > 0) {
    const n = Math.min(count, MAX_LOOP_ITEMS);
    const names = currentAnswers['2A-2'] && typeof currentAnswers['2A-2'] === 'object' ? currentAnswers['2A-2'] : {};
    const items = Array.from({ length: n }, (_, i) => String(i + 1));
    const itemLabels = items.map(k => {
      const base = `${lang === 'tr' ? 'Tesis' : 'Facility'} ${k}`;
      const name = loopQuestionId !== '2A-2' ? String(names[k]?.name || '').trim() : '';
      return name ? `${base} — ${name}` : base;
    });
    return { items, itemLabels };
  }
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
  // A per-item question that applies to some items only (K3C1-3m: the
  // material of raw materials and packaging).
  if (q.loopItemsOnly) items = items.filter(x => q.loopItemsOnly.includes(baseLoopItem(x)));
  // A type split into groups at its count question is asked per group.
  items = groupedLoopItems(loopQuestionId, items, currentAnswers);
  const itemLabels = items.map(item => loopItemLabel(sourceQ, item, items, lang));
  return { items, itemLabels };
}

// ── stripDocLabels ────────────────────────────────────────────────────────────
// Strips internal documentation annotations from question text before display.
// These come from the DOCX source file and serve the document author, not users.
//
// Removes:
//   1. Leading [Bracket labels] — e.g. "[Tesis N] ", "[OC1 = Evet] ", "[Ekipman adı] — "
//      Applied repeatedly so "[A] — [B] text" → "text"
//   2. Trailing auto-fill notes — e.g. " (B4'ten otomatik gelir)", " (auto-filled from 2A-5)"
function stripDocLabels(text) {
  if (!text) return text;
  let result = text;
  const leadingBracket = /^\[[^\]]+\]\s*(?:—\s*)?/;
  let prev;
  do { prev = result; result = result.replace(leadingBracket, ''); } while (result !== prev);
  result = result.replace(/\s*\([^)]*(?:'ten\s+otomatik|auto-filled from)[^)]*\)\s*$/, '');
  return result.trim();
}

function getInitialValue(q) {
  if (!q) return '';
  if (q.type === 'multi_select') return [];
  if (q.type === 'country_city') return { country: '', city: '' };
  if (q.type === 'compound') return q.repeatable ? { items: [], draft: {} } : {};
  return '';
}

// isAggregate: true only when `value` is a finished loop question's answer —
// { itemKey: perItemAnswer, ... } — as read back from `answers[q.id]` after the
// loop completed (e.g. in BlockSummaryTable). Per-iteration call sites (the user
// chat bubble shown while the loop is still running) pass the single item's raw
// answer and must NOT set this, since a per-item compound answer like 3D-4's
// {refill_kg, capacity_kg} has the same "object of scalars" shape as an
// aggregate and would otherwise be misread as one.
// A compound sub-field's value as the user saw it: a select shows its option
// label ("R-410A (GWP: 2.088)", not the stored "R410A"), a boolean Evet/Hayır.
function fieldValueText(field, v, lang) {
  if (Array.isArray(field?.options)) {
    const opt = field.options.find(o => String(o.value) === String(v));
    if (opt) return stripOptionCode(opt.label?.[lang] || opt.label?.en || String(v));
  }
  if (v === true || v === 'true') return lang === 'tr' ? 'Evet' : 'Yes';
  if (v === false || v === 'false') return lang === 'tr' ? 'Hayır' : 'No';
  // Numbers as the user typed them in their locale: 1,2 · 5.000.000 (not 1.2 / 5000000).
  if ((field?.type === 'numeric' || field?.subtype === 'numeric') && field.format !== 'year' && v !== '' && Number.isFinite(Number(v))) {
    return Number(v).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 4 });
  }
  return v;
}

// A compound answer's entries in the order the form shows its fields (the
// stored object's key order follows whichever field was touched first).
function orderedFieldEntries(q, obj) {
  const idx = (k) => {
    const i = (q?.fields || []).findIndex(f => f.id === k);
    return i === -1 ? Infinity : i;
  };
  return Object.entries(obj || {}).sort(([a], [b]) => idx(a) - idx(b));
}

// Unit codes that need a Turkish label (the stored value keeps the code).
const UNIT_LABELS_TR = { tonnes: 'ton', litres: 'litre' };
function unitLabel(u, lang) {
  return (lang === 'tr' && UNIT_LABELS_TR[u]) || u;
}

// "12000 m³" (stored with a plain dot decimal) → "12.000 m³" in Turkish.
function amountWithUnitText(q, value, lang) {
  if (!q?.units || typeof value !== 'string') return null;
  const m = /^(-?\d+(?:\.\d+)?)\s+(\S.*)$/.exec(value.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 4 })} ${unitLabel(m[2], lang)}`;
}

function getDisplayValue(q, value, lang = 'en', { isAggregate = false, answers = null } = {}) {
  if (!q || value === undefined || value === null || value === '') return '—';
  if (isAggregate && q.loopSource && typeof value === 'object' && !Array.isArray(value)) {
    const sourceQ = getQuestionById(q.loopSource);
    const keys = Object.keys(value);
    const entries = Object.entries(value).map(([itemKey, itemVal]) => {
      const opt = sourceQ?.options?.find(o => o.value === baseLoopItem(itemKey));
      const isCountItem = !opt && /^\d+$/.test(itemKey)
        && (sourceQ?.subtype === 'numeric' || sourceQ?.type === 'numeric');
      // Per-facility loops (4A-1, 2A-3) are keyed "1", "2"…: show the
      // facility's name from 2A-2 when known, not "Tesis 1".
      const siteName = isCountItem && answers
        ? String(readAnswerValue(answers, '2A-2')?.[itemKey]?.name || '').trim() : '';
      const itemLabel = opt
        ? loopItemLabel(sourceQ, itemKey, keys, lang)
        : isCountItem ? (siteName || `${lang === 'tr' ? 'Tesis' : 'Facility'} ${itemKey}`) : itemKey;
      const formatted = getDisplayValue(q, itemVal, lang); // recurse on the plain per-item value
      return `${itemLabel}: ${formatted}`;
    });
    return entries.join(' · ') || '—';
  }
  if (q.type === 'country_city') {
    const v = value;
    if (!v?.country) return '—';
    return `${countryName(v.country, lang)}${v.city ? ', ' + v.city : ''}`;
  }
  if (q.type === 'multi_select') {
    if (!Array.isArray(value) || value.length === 0) return '—';
    return value.map(v => {
      const opt = q.options?.find(o => o.value === v);
      return opt ? stripOptionCode(opt.label?.[lang] || opt.label?.en || v) : v;
    }).join(', ');
  }
  if (q.type === 'single_select' || q.type === 'year_select' || q.type === 'equipment_loop' || q.type === 'fuel_loop' || q.type === 'section_picker') {
    const opt = q.options?.find(o => o.value === value);
    return opt ? stripOptionCode(opt.label?.[lang] || opt.label?.en || String(value)) : (amountWithUnitText(q, value, lang) ?? String(value));
  }
  // Fields whose options come from other answers (K3C1-4a's category) show
  // their label, not the stored code, when the answers are at hand.
  const shownFields = answers ? resolveFieldOptions(q.fields || [], answers) : q.fields;
  // A field whose label follows another field's value (K3C6-2 quantity).
  const fieldLabel = (field, k, obj) => {
    const l = field?.labelByValue?.labels?.[obj?.[field.labelByValue.field]] || field?.label;
    return l?.[lang] || l?.en || k;
  };
  if (q.type === 'compound' && q.repeatable) {
    const items = Array.isArray(value?.items) ? value.items : (Array.isArray(value) ? value : []);
    if (items.length === 0) return '—';
    return items
      .map((item, i) => {
        const inner = orderedFieldEntries(q, item)
          .filter(([, v]) => v !== '' && v !== undefined && v !== null)
          .map(([k, v]) => {
            const field = shownFields?.find(f => f.id === k);
            const label = fieldLabel(field, k, item);
            return `${label}: ${fieldValueText(field, v, lang)}`;
          })
          .join(', ');
        return `#${i + 1} ${inner}`;
      })
      .join(' | ');
  }
  if (q.type === 'compound') {
    if (!value || typeof value !== 'object') return '—';
    return orderedFieldEntries(q, value)
      // Keys the server adds (7C-2's confirmed_by) are not answers.
      .filter(([k]) => !q.fields?.length || q.fields.some(f => f.id === k))
      .filter(([, v]) => v !== '' && v !== undefined && v !== null)
      .map(([k, v]) => {
        const field = shownFields?.find(f => f.id === k);
        const label = fieldLabel(field, k, value);
        return `${label}: ${fieldValueText(field, v, lang)}`;
      })
      .join(' · ') || '—';
  }
  return amountWithUnitText(q, value, lang) ?? String(value);
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
    .replace(/`(.+?)`/g, '<code class="rounded bg-[#175022]/10 px-1 py-0.5 text-[12px] font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<p class="mt-3 mb-1 font-bold text-[#175022]">$1</p>')
    .replace(/^## (.+)$/gm, '<p class="mt-4 mb-1 text-base font-bold text-[#175022]">$1</p>')
    .replace(/^# (.+)$/gm, '<p class="mt-4 mb-1 text-lg font-bold text-[#175022]">$1</p>')
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
          className="typing-dot h-2 w-2 rounded-full bg-[#8BEA99]"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Free-chat: Bubble
// ─────────────────────────────────────────────────────────────────────────────
const Bubble = memo(function Bubble({ role, content }) {
  const isUser = role === 'user';
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] sm:max-w-[70%] rounded-2xl rounded-br-sm bg-[#1A7B2A] px-4 py-3 text-[13.5px] leading-[1.65] text-white/95">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 max-w-[88%]">
      <div className="mt-1 h-6 w-6 shrink-0 rounded-xl bg-[#175022] flex items-center justify-center shadow-sm">
        <Sparkles className="h-3 w-3 text-white/90" />
      </div>
      <div className="flex-1 min-w-0 text-[13.5px] leading-[1.7] text-[#175022]">
        <Markdown text={content} />
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
          ? 'bg-[#2ABD41]/12 text-[#175022]'
          : 'text-[#175022]/60 hover:bg-[#175022]/5 hover:text-[#175022]'
      }`}
    >
      <div className="flex items-center gap-2 pr-6">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-[#2ABD41]' : 'bg-transparent'}`} />
        <p className="truncate text-[12px] font-medium leading-tight">{session.title}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(session.id); }}
        aria-label={tr ? 'Sohbeti sil' : 'Delete chat'}
        className="absolute right-2 top-2.5 hidden rounded-md p-1 text-[#175022]/30 transition hover:bg-red-50 hover:text-red-400 group-hover:flex"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Free-chat: Introduction screen (shown when no session is selected)
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ onNew, tr }) {
  const suggestions = tr ? [
    { img: '/icons/scopes.png', text: 'Kapsam 1, 2 ve 3 arasındaki fark nedir?', label: 'Kapsamlar' },
    { img: '/icons/analytics.png', text: 'En büyük emisyon kaynağım hangisi?', label: 'Analiz' },
    { img: '/icons/reporting.png', text: 'ISO 14064-1 raporu nasıl hazırlanır?', label: 'Raporlama' },
    { img: '/icons/targets.png', text: 'Karbon azaltma hedefleri nasıl belirlenir?', label: 'Hedefler' },
    { img: '/icons/efficiency.png', text: 'Enerji verimliliği önerileri', label: 'Verimlilik' },
    { img: '/icons/calculator.png', text: 'Emisyon faktörlerini hesapla', label: 'Hesaplama' },
    { text: 'How i must write for calc...', label: 'Rehber', isGuide: true },
  ] : [
    { img: '/icons/scopes.png', text: "What's the difference between Scope 1, 2, and 3?", label: 'Scopes' },
    { img: '/icons/analytics.png', text: "What's my biggest emission source?", label: 'Analytics' },
    { img: '/icons/reporting.png', text: "How do I prepare an ISO 14064-1 report?", label: 'Reporting' },
    { img: '/icons/targets.png', text: "How do I set carbon reduction targets?", label: 'Targets' },
    { img: '/icons/efficiency.png', text: "Energy efficiency recommendations", label: 'Efficiency' },
    { img: '/icons/calculator.png', text: "Calculate my emission factors", label: 'Calculator' },
    { text: 'How i must write for calc...', label: 'Guide', isGuide: true },
  ];

  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-3 sm:px-6 pb-4 sm:pb-6">
      <div className="w-full max-w-2xl flex flex-col items-center gap-4 sm:gap-6">

        {/* Hero image — carbon-hero.png sphere */}
        <div className="relative">
          <div className="h-24 w-24 sm:h-44 sm:w-44 relative cb-float">
            <Image
              src="/carbon-hero.png"
              alt="CarbonIQ AI"
              width={176}
              height={176}
              className="h-full w-full object-contain drop-shadow-xl"
            />
          </div>
          {/* Subtle glow behind */}
          <div className="absolute inset-0 rounded-full bg-[#2ABD41]/8 blur-3xl scale-150 -z-10" />
        </div>

        {/* Welcome text */}
        <div className="text-center">
          <p className="text-[12px] sm:text-[13px] text-[#2ABD41] font-medium mb-1">
            {tr ? 'Merhaba 👋' : 'Hi, there'}
          </p>
          <h2 className="text-[20px] sm:text-[28px] font-bold text-[#072C0E] tracking-tight leading-tight">
            {tr ? 'Size nasıl yardımcı olabilirim?' : 'How can I assist?'}
          </h2>
        </div>


        {/* Suggestion chips — horizontal scrollable row like Dinnect.
            Edge fade (mask-image) softens the hard clip at the screen edge
            so the cut-off chip reads as "scroll for more" instead of a
            broken/lopsided layout. */}
        <div
          className="w-full overflow-x-auto pb-2 -mx-3 px-3 [mask-image:linear-gradient(to_right,transparent_0,black_20px,black_calc(100%-20px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_20px,black_calc(100%-20px),transparent_100%)]"
        >
          <div className="flex gap-2 min-w-max px-0.5">
            {suggestions.map(({ img, text, label, isGuide }) => (
              <button
                key={text}
                onClick={() => isGuide ? setShowGuide(true) : onNew(text)}
                className={`flex items-center gap-1.5 sm:gap-2 rounded-full border px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-[12px] font-medium shadow-sm whitespace-nowrap transition-all duration-200 active:scale-[0.97] ${isGuide ? 'border-[#2ABD41] bg-[#F1FCF2] text-[#175022] hover:bg-[#2ABD41] hover:text-white' : 'border-[#DEFAE1] bg-white text-[#175022]/60 hover:border-[#2ABD41]/30 hover:bg-[#F1FCF2] hover:text-[#175022]'}`}
              >
                {isGuide
                  ? <BookOpen className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
                  : <Image src={img} alt={label} width={18} height={18} className="h-4 w-4 sm:h-[18px] sm:w-[18px] object-contain" />}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Guide Modal */}
        {showGuide && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
            onClick={() => setShowGuide(false)}
          >
            <div
              className="w-full max-w-lg rounded-[1.5rem] bg-white p-6 shadow-2xl border border-[#DEFAE1] animate-[cbFadeUp_0.25s_ease-out_both]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2ABD41]/15 text-[#2ABD41]">
                    <BookOpen className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#072C0E] tracking-tight">
                    {tr ? 'Nasıl Yazmalıyım?' : 'How to Write Prompts'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  aria-label={tr ? 'Kapat' : 'Close'}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#072C0E]/35 transition hover:bg-[#072C0E]/6 hover:text-[#072C0E]"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
              <p className="text-[13px] text-[#072C0E]/55 mb-4 ml-[46px]">
                {tr ? 'Miktar + birim + faaliyet türü yazın. Örnekler:' : 'Write: quantity + unit + activity type. Examples:'}
              </p>
              <div className="space-y-2">
                {(tr ? [
                  { icon: Zap, text: '"14.000 kWh elektrik kullandık"' },
                  { icon: Fuel, text: '"500 litre dizel yakıt yaktık"' },
                  { icon: Car, text: '"Araçlarımız 5.000 km yol yaptı"' },
                  { icon: Plane, text: '"İstanbul-Londra uçtuk"' },
                  { icon: Trash2, text: '"2 ton atığı çöpe gönderdik"' },
                  { icon: Flame, text: '"1000 m³ doğalgaz kullandık"' },
                  { icon: Droplets, text: '"100 m³ su tükettik"' },
                  { icon: Truck, text: '"10.000 ton-km kamyon taşımacılığı"' },
                ] : [
                  { icon: Zap, text: '"We used 14,000 kWh of electricity"' },
                  { icon: Fuel, text: '"We burned 500 liters of diesel"' },
                  { icon: Car, text: '"Our vehicles drove 5,000 km"' },
                  { icon: Plane, text: '"Flight from Istanbul to London"' },
                  { icon: Trash2, text: '"2 tonnes of waste to landfill"' },
                  { icon: Flame, text: '"1000 m³ of natural gas"' },
                  { icon: Droplets, text: '"100 m³ water consumption"' },
                  { icon: Truck, text: '"10,000 tonne-km truck freight"' },
                ]).map(({ icon: Icon, text }, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl bg-[#F9FFF4] px-3 py-2.5 transition-colors hover:bg-[#F1FCF2]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2ABD41]/12 text-[#2ABD41]">
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </div>
                    <span className="text-[13px] text-[#072C0E]/70 font-medium">{text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#072C0E]/3 px-3 py-2.5">
                <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#2ABD41]" />
                <p className="text-[11px] leading-5 text-[#072C0E]/45">
                  {tr ? 'AI eksik bilgiyi sorar — sadece bildiklerinizi yazın.' : "AI will ask for missing info — just write what you know."}
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Free-chat: Date-group sessions for sidebar
// ─────────────────────────────────────────────────────────────────────────────
function groupSessionsByDate(sessions, tr) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  const week  = new Date(today); week.setDate(week.getDate() - 7);
  const groups = [
    { key: 'today',     label: tr ? 'Bugün'       : 'Today',       items: [] },
    { key: 'yesterday', label: tr ? 'Dün'          : 'Yesterday',   items: [] },
    { key: 'week',      label: tr ? 'Son 7 gün'   : 'Last 7 days', items: [] },
    { key: 'older',     label: tr ? 'Daha önce'   : 'Older',       items: [] },
  ];
  sessions.forEach(s => {
    if (!s.updated_at) { groups[3].items.push(s); return; }
    const d = new Date(s.updated_at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today)  groups[0].items.push(s);
    else if (day >= yest) groups[1].items.push(s);
    else if (d   >= week) groups[2].items.push(s);
    else                  groups[3].items.push(s);
  });
  return groups.filter(g => g.items.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: ChatBubble
// ─────────────────────────────────────────────────────────────────────────────
// Fix #106: memo() prevents re-rendering the full message history on every
// keystroke in the questionnaire input field.
const ChatBubble = memo(function ChatBubble({ msg }) {
  const base = 'rounded-[20px] px-4 py-3 text-[13.5px] leading-[1.65] max-w-[85%] sm:max-w-[75%]';
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className={`${base} rounded-br-sm rounded-tr-sm bg-[#1A7B2A] text-white/95`}>{msg.content}</div>
      </div>
    );
  }
  if (msg.type === 'warning') {
    return (
      <div className="flex gap-3">
        <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-amber-400 flex items-center justify-center">
          <span className="block h-2 w-2 rounded-full bg-white/90" />
        </div>
        <div className={`${base} rounded-tl-sm border border-amber-200 bg-amber-50 text-amber-800`}>
          <Markdown text={msg.content} />
        </div>
      </div>
    );
  }
  if (msg.type === 'error') {
    return (
      <div className="flex gap-3">
        <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-red-400 flex items-center justify-center">
          <span className="block h-2 w-2 rounded-full bg-white/90" />
        </div>
        <div className={`${base} rounded-tl-sm border border-red-200 bg-red-50 text-red-700`}>
          {msg.content}
        </div>
      </div>
    );
  }
  if (msg.type === 'info') {
    return (
      <div className="flex gap-3">
        <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-[#2ABD41] flex items-center justify-center">
          <span className="block h-2 w-2 rounded-full bg-white/90" />
        </div>
        <div className={`${base} rounded-tl-sm border border-[#8BEA99]/30 bg-[#8BEA99]/8 text-[#175022]`}>
          <Markdown text={msg.content} />
        </div>
      </div>
    );
  }
  // assistant (default)
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-[#2ABD41] flex items-center justify-center shadow-sm">
        <span className="block h-2 w-2 rounded-full bg-white/80" />
      </div>
      <div className="flex-1 min-w-0 text-[13.5px] leading-[1.7] text-[#175022]">
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
          ? 'border-[#2ABD41] bg-[#2ABD41] text-white shadow-sm'
          : 'border-[#175022]/12 bg-white text-[#175022]/70 hover:border-[#8BEA99]/50 hover:bg-[#8BEA99]/8 hover:text-[#175022]'
      }`}
    >
      {multi && selected && <Check className="mr-1 inline h-3 w-3" strokeWidth={3} aria-hidden="true" />}
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
  // A city that is not in the list (typed via "Diğer") keeps the text box open.
  const [typing, setTyping] = useState(Boolean(val.city) && cities.length > 0 && !cities.includes(val.city));
  const showTextBox = val.country && (cities.length === 0 || typing);
  const inputClass = 'rounded-xl border border-[#175022]/12 bg-white px-3 py-2 text-sm text-[#175022] outline-none focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/20';
  const countryOptions = [...COUNTRY_CODES].sort((a, b) => {
    if (a === 'TR' || b === 'OTHER') return -1;
    if (b === 'TR' || a === 'OTHER') return 1;
    return countryName(a, lang).localeCompare(countryName(b, lang), tr ? 'tr' : 'en');
  });
  return (
    <div className="flex flex-col gap-2 w-full">
      <select
        className={inputClass}
        value={val.country}
        onChange={e => { setTyping(false); onChange({ country: e.target.value, city: '' }); }}
      >
        <option value="">{tr ? '— Ülke seçin —' : '— Select country —'}</option>
        {countryOptions.map(code => (
          <option key={code} value={code}>{countryName(code, lang)}</option>
        ))}
      </select>
      {val.country && cities.length > 0 && (
        <select
          className={inputClass}
          value={typing ? OTHER_CITY : val.city}
          onChange={e => {
            if (e.target.value === OTHER_CITY) { setTyping(true); onChange({ ...val, city: '' }); }
            else { setTyping(false); onChange({ ...val, city: e.target.value }); }
          }}
        >
          <option value="">{tr ? '— Şehir seçin —' : '— Select city —'}</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
          <option value={OTHER_CITY}>{tr ? 'Diğer (yazın)' : 'Other (type it)'}</option>
        </select>
      )}
      {showTextBox && (
        <input
          className={inputClass}
          placeholder={tr ? 'Şehir adı' : 'City name'}
          value={val.city}
          maxLength={100}
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
        // conditionalOnValue generalises this to non-boolean fields — e.g. K3C6-2's
        // cabin_class only makes sense when travel_mode is one of the flight codes.
        if (field.conditionalOn) {
          const condVal = val[field.conditionalOn];
          const condMet = field.conditionalOnValue
            ? field.conditionalOnValue.includes(condVal)
            : (condVal === true || condVal === 'true');
          if (!condMet) return null;
        }
        const fieldVal = val[field.id] ?? '';
        const setField = (v) => onChange({ ...val, [field.id]: v });
        const charLen = field.maxLength ? String(fieldVal).length : null;
        return (
          <div key={field.id} className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#175022]/70">
              {/* labelByValue: the label follows another field's choice
                  (K3C6-2's quantity says "Gece sayısı" for a hotel). */}
              {(() => {
                const byVal = field.labelByValue?.labels?.[val[field.labelByValue.field]];
                const lbl = byVal || field.label;
                return lbl?.[lang] || lbl?.en || field.id;
              })()}
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
            ) : (field.type === 'select' || field.type === 'single_select') && field.renderAs === 'native_select' ? (
              // Chips don't scale past a handful of options — a country list
              // (70+) rendered as Chip buttons floods the chat bubble with a
              // wall of tap targets. Fields that opt in with renderAs get the
              // compact native <select> the dedicated CountryCityInput widget
              // already uses elsewhere, instead.
              <select
                className="rounded-xl border border-[#175022]/12 bg-white px-3 py-2 text-sm text-[#175022] outline-none focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/20"
                value={fieldVal}
                onChange={e => setField(e.target.value)}
                disabled={disabled}
              >
                <option value="">{lang === 'tr' ? '— Seçin —' : '— Select —'}</option>
                {(field.options || []).map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {stripOptionCode(opt.label?.[lang] || opt.label?.en || opt.value)}
                  </option>
                ))}
              </select>
            ) : field.type === 'select' || field.type === 'single_select' ? (
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {(field.options || []).map(opt => (
                  <Chip
                    key={opt.value}
                    label={stripOptionCode(opt.label?.[lang] || opt.label?.en || opt.value)}
                    selected={fieldVal === opt.value}
                    onClick={() => !disabled && setField(opt.value)}
                    disabled={disabled}
                  />
                ))}
              </div>
            ) : field.subtype === 'multi_line' ? (
              <textarea
                className="rounded-xl border border-[#175022]/12 bg-white px-3 py-2 text-sm text-[#175022] outline-none placeholder:text-[#175022]/30 focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/20 resize-none"
                rows={3}
                value={fieldVal}
                onChange={e => setField(e.target.value)}
                placeholder={field.placeholder?.[lang] || field.placeholder?.en || ''}
                disabled={disabled}
                maxLength={field.maxLength}
              />
            ) : (
              <input
                className="rounded-xl border border-[#175022]/12 bg-white px-3 py-2 text-sm text-[#175022] outline-none placeholder:text-[#175022]/30 focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/20"
                type="text"
                inputMode={field.type === 'numeric' || field.subtype === 'numeric' ? 'decimal' : 'text'}
                value={fieldVal}
                onChange={e => setField(e.target.value)}
                placeholder={field.placeholder?.[lang] || field.placeholder?.en || (field.type === 'numeric' ? (lang === 'tr' ? 'Sayı girin' : 'Enter a number') : '')}
                disabled={disabled}
                maxLength={field.maxLength}
              />
            )}
            {field.maxLength && (
              <span className="text-right text-[10px] text-[#175022]/35">{charLen}/{field.maxLength}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Scope1SummaryTable
// Rendered inline in the chat area when TY-1 (Q63) is the current question.
// Reads the Stage-3 answers and summarises them in a compact 4-row table.
// ─────────────────────────────────────────────────────────────────────────────
function Scope1SummaryTable({ answers, lang, tr }) {
  // Resolve an option label from a question's options array
  const optLabel = (qId, value) => {
    const q = getQuestionById(qId);
    if (!q?.options) return value;
    const opt = q.options.find(o => o.value === value);
    if (!opt) return value;
    const raw = opt.label?.[lang] || opt.label?.en || value;
    // Strip the leading code prefix "EQ-3A-01 — " so we show the readable name only
    const parts = raw.split(' — ');
    return parts.length > 1 ? parts.slice(1).join(' — ') : raw;
  };

  // Format multi-select answer (array of codes) → comma-separated readable names
  const fmtList = (qId, arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.filter(v => v !== 'none').map(v => optLabel(qId, v)).join(', ') || null;
  };

  // Format fuel-consumption loop answer { fuel_key: 'amount unit' } → "Doğalgaz: 15 000 m³ · ..."
  const FUEL_LABELS = {
    tr: { natural_gas: 'Doğalgaz', fuel_oil: 'Fuel oil', diesel: 'Motorin', lpg: 'LPG', coal: 'Kömür', biomass: 'Biyokütle', other_fossil: 'Diğer yakıt' },
    en: { natural_gas: 'Natural gas', fuel_oil: 'Fuel oil', diesel: 'Diesel', lpg: 'LPG', coal: 'Coal', biomass: 'Biomass', other_fossil: 'Other fuel' },
  };
  const fmtFuel = (loopObj) => {
    if (!loopObj || typeof loopObj !== 'object' || Array.isArray(loopObj)) return null;
    const lbl = FUEL_LABELS[lang] || FUEL_LABELS.en;
    const entries = Object.entries(loopObj).filter(([, v]) => v);
    if (entries.length === 0) return null;
    return entries.map(([k, v]) => `${lbl[k] || k}: ${amountText(v)}`).join(' · ');
  };

  // Per-item amounts the later questions collected, keyed by the item code
  // ({ 'EQ-3B-01': '12000 litre' }, { 'EQ-3C-01': { quantity: '5', … } }) →
  // "Binek araç: 12.000 litre · …". Only what the user entered — no
  // emissions are computed here.
  const num = (v) => {
    const n = Number(v);
    return v !== '' && v !== null && v !== undefined && Number.isFinite(n)
      ? n.toLocaleString(tr ? 'tr-TR' : 'en-US', { maximumFractionDigits: 4 })
      : String(v ?? '');
  };
  const amountText = (v) => {
    const m = String(v ?? '').trim().match(/^([\d.,]+)\s*(.*)$/);
    return m ? `${num(m[1])}${m[2] ? ` ${m[2]}` : ''}` : String(v ?? '');
  };
  // "R410A" → "R-410A" (the option label without its GWP note).
  const gasLabel = (code) => {
    const opt = (getQuestionById('3D-2')?.fields || []).find(f => f.id === 'gas_type')?.options?.find(o => o.value === code);
    const raw = opt ? (opt.label?.[lang] || opt.label?.en || code) : code;
    return String(raw).replace(/\s*\(GWP[^)]*\).*$/, '');
  };
  const fmtPerItem = (listQ, loopObj, describe) => {
    if (!loopObj || typeof loopObj !== 'object' || Array.isArray(loopObj)) return null;
    const parts = Object.entries(loopObj)
      .map(([k, v]) => { const d = describe(v); return d ? `${optLabel(listQ, k)}: ${d}` : null; })
      .filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  };

  // A report resumed from the backend stores every answer as { answer: value }
  // (see readAnswerValue) — reading answers[...] directly here meant a resumed
  // session's Scope 1 summary always showed every category as "not skipped,
  // no items", even after real data had been entered.
  const ra = (qId) => readAnswerValue(answers, qId);
  const sections = [
    {
      id: '3A',
      label: tr ? 'Sabit Yanma' : 'Stationary Combustion',
      skipped: ra('3A-0') === 'no',
      items: fmtList('3A-1', ra('3A-1')),
      extra: fmtFuel(ra('3A-5')),
    },
    {
      id: '3B',
      label: tr ? 'Mobil Yanma' : 'Mobile Combustion',
      skipped: ra('3B-0') === 'no',
      items: fmtList('3B-1', ra('3B-1')),
      extra: fmtPerItem('3B-1', ra('3B-7'), v => (v ? amountText(v) : null)),
    },
    {
      id: '3C',
      label: tr ? 'Proses Emisyonları' : 'Process Emissions',
      skipped: ra('3C-0') === 'no',
      items: fmtList('3C-1', ra('3C-1')),
      extra: fmtPerItem('3C-1', ra('3C-2'), v => (v?.quantity ? `${tr ? 'üretim' : 'production'} ${num(v.quantity)}` : null)),
    },
    {
      id: '3D',
      label: tr ? 'Kaçak Emisyonlar' : 'Fugitive Emissions',
      skipped: Array.isArray(ra('3D-0')) && ra('3D-0').every(v => v === 'none'),
      items: fmtList('3D-0', ra('3D-0')),
      extra: (() => {
        const units = ra('3D-2') || {};
        const refills = ra('3D-4') || {};
        if (typeof units !== 'object' || typeof refills !== 'object') return null;
        const keys = [...new Set([...Object.keys(units), ...Object.keys(refills)])];
        const parts = keys.map(k => {
          const u = units[k] || {}; const r = refills[k] || {};
          const bits = [
            u.unit_count ? `${num(u.unit_count)} ${tr ? 'adet' : 'units'}` : null,
            u.gas_type ? gasLabel(u.gas_type) : null,
            r.refill_kg !== undefined && r.refill_kg !== '' ? `${tr ? 'dolum' : 'refill'} ${num(r.refill_kg)} kg` : null,
          ].filter(Boolean);
          return bits.length ? `${optLabel('3D-0', k)}: ${bits.join(', ')}` : null;
        }).filter(Boolean);
        return parts.length ? parts.join(' · ') : null;
      })(),
    },
  ];

  return (
    <div className="rounded-2xl border border-[#2ABD41]/30 bg-[#F1FCF2] overflow-hidden text-[#175022]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#2ABD41]/15 border-b border-[#2ABD41]/20">
        <ClipboardList className="h-3.5 w-3.5 text-[#175022] shrink-0" />
        <span className="text-[11px] font-bold text-[#175022] uppercase tracking-wider">
          {tr ? 'Kapsam 1 Özeti' : 'Scope 1 Summary'}
        </span>
      </div>
      {/* Rows */}
      <div className="divide-y divide-[#175022]/6">
        {sections.map(s => (
          <div key={s.id} className="flex items-start gap-3 px-4 py-2.5">
            {/* Block badge */}
            <span className="shrink-0 mt-0.5 rounded-md bg-[#175022]/8 px-1.5 py-0.5 text-[10px] font-bold text-[#175022]/50 leading-tight">
              {s.id}
            </span>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-semibold text-[#175022]/80">{s.label}</span>
              {s.skipped ? (
                <span className="ml-2 text-[11px] text-[#175022]/35 italic">
                  {tr ? 'yok' : 'none'}
                </span>
              ) : s.items ? (
                <div className="mt-0.5">
                  <p className="text-[11px] text-[#175022]/60 leading-relaxed">{s.items}</p>
                  {s.extra && (
                    <p className="text-[11px] text-[#175022] mt-0.5 leading-relaxed font-medium">{s.extra}</p>
                  )}
                </div>
              ) : (
                <span className="ml-2 text-[11px] text-[#175022]/30 italic">
                  {tr ? 'veri girilmedi' : 'no data entered'}
                </span>
              )}
            </div>
            {/* Status dot */}
            <span className={`shrink-0 mt-1 h-2 w-2 rounded-full ${
              s.skipped ? 'bg-[#175022]/15' : s.items ? 'bg-[#2ABD41]' : 'bg-amber-400'
            }`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Scope2SummaryTable
// Shown under 4C-1 (the Scope 2 summary question): the electricity, shared
// building, on-site generation and purchased heat/steam amounts the user
// entered. Only what was entered — no emissions are computed here.
// ─────────────────────────────────────────────────────────────────────────────
function Scope2SummaryTable({ answers, lang, tr }) {
  const ra = (qId) => readAnswerValue(answers, qId);
  const num = (v) => {
    const n = Number(v);
    return v !== '' && v !== null && v !== undefined && Number.isFinite(n)
      ? n.toLocaleString(tr ? 'tr-TR' : 'en-US', { maximumFractionDigits: 4 })
      : String(v ?? '');
  };
  const amountText = (v) => {
    const m = String(v ?? '').trim().match(/^([\d.,]+)\s*(.*)$/);
    return m ? `${num(m[1])}${m[2] ? ` ${unitLabel(m[2], tr ? 'tr' : 'en')}` : ''}` : String(v ?? '');
  };
  const facilities = ra('2A-2') || {};
  const siteName = (k) => String(facilities?.[k]?.name || '').trim() || `${tr ? 'Tesis' : 'Site'} ${k}`;
  const perSite = (obj) => (obj && typeof obj === 'object' && !Array.isArray(obj)
    ? Object.entries(obj).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${siteName(k)}: ${amountText(v)}`).join(' · ')
    : null);

  const shared = ra('4A-2') === 'yes';
  const share = ra('4A-2b');
  const area = ra('4A-2c');
  const sharedSites = (() => {
    const v = ra('4A-2s');
    const rows = Array.isArray(v?.items) ? v.items : Array.isArray(v) ? v : [];
    return rows.map(r => String(r?.facility || '').trim()).filter(Boolean).join(', ');
  })();
  const sharedText = !shared ? null : (sharedSites ? `${sharedSites} — ` : '') + (share
    ? `${tr ? 'Bina yönetimi payı' : 'Building management share'}: ${amountText(share)} kWh`
    : (area && typeof area === 'object' && area.company_m2)
      ? `${tr ? 'Alan' : 'Area'}: ${num(area.company_m2)} / ${num(area.building_m2)} m²`
      : (tr ? 'Paylaşımlı bina' : 'Shared building'));

  const gen = ra('4A-3a');
  const genText = ra('4A-3') !== 'yes' ? null : (gen && typeof gen === 'object' && gen.production_kwh)
    ? `${gen.facility ? `${gen.facility} — ` : ''}${tr ? 'Üretim' : 'Production'}: ${num(gen.production_kwh)} kWh${gen.grid_sales && gen.grid_sales_kwh ? ` · ${tr ? 'şebekeye satış' : 'sold to grid'}: ${num(gen.grid_sales_kwh)} kWh` : ''}`
    : null;

  const heatQ = getQuestionById('4B-1');
  const heatLabel = (k) => {
    const opt = heatQ?.options?.find(o => o.value === k);
    return opt ? stripOptionCode(opt.label?.[lang] || opt.label?.en || k) : k;
  };
  const heat = ra('4B-2');
  const heatText = heat && typeof heat === 'object'
    ? Object.entries(heat).filter(([, v]) => v).map(([k, v]) => `${heatLabel(k)}: ${amountText(v)}`).join(' · ') || null
    : null;

  const rows = [
    { id: '4A', label: tr ? 'Satın alınan elektrik' : 'Purchased electricity', skipped: ra('4A-0') === 'no', extra: perSite(ra('4A-1')) },
    ...(sharedText ? [{ id: '4A', label: tr ? 'Paylaşımlı bina' : 'Shared building', extra: sharedText }] : []),
    ...(genText ? [{ id: '4A', label: tr ? 'Sahada yenilenebilir üretim' : 'On-site renewable generation', extra: genText }] : []),
    { id: '4B', label: tr ? 'Satın alınan ısı / buhar / soğutma' : 'Purchased heat / steam / cooling', skipped: ra('4B-0') === 'no', extra: heatText },
  ];

  return (
    <div className="rounded-2xl border border-[#2ABD41]/30 bg-[#F1FCF2] overflow-hidden text-[#175022]">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#2ABD41]/15 border-b border-[#2ABD41]/20">
        <ClipboardList className="h-3.5 w-3.5 text-[#175022] shrink-0" />
        <span className="text-[11px] font-bold text-[#175022] uppercase tracking-wider">
          {tr ? 'Kapsam 2 Özeti' : 'Scope 2 Summary'}
        </span>
      </div>
      <div className="divide-y divide-[#175022]/6">
        {rows.map((r, i) => (
          <div key={`${r.id}-${i}`} className="flex items-start gap-3 px-4 py-2.5">
            <span className="shrink-0 mt-0.5 rounded-md bg-[#175022]/8 px-1.5 py-0.5 text-[10px] font-bold text-[#175022]/50 leading-tight">{r.id}</span>
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-semibold text-[#175022]/80">{r.label}</span>
              {r.skipped ? (
                <span className="ml-2 text-[11px] text-[#175022]/35 italic">{tr ? 'yok' : 'none'}</span>
              ) : r.extra ? (
                <p className="text-[11px] text-[#175022] mt-0.5 leading-relaxed font-medium">{r.extra}</p>
              ) : (
                <span className="ml-2 text-[11px] text-[#175022]/30 italic">{tr ? 'veri girilmedi' : 'no data entered'}</span>
              )}
            </div>
            <span className={`shrink-0 mt-1 h-2 w-2 rounded-full ${r.skipped ? 'bg-[#175022]/15' : r.extra ? 'bg-[#2ABD41]' : 'bg-amber-400'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Scope3SummaryTable
// Shown under K3-TY (the Scope 3 summary question): one row per category with
// what the user entered there. Only what was entered — no emissions computed.
// ─────────────────────────────────────────────────────────────────────────────
const SCOPE3_CATEGORIES = [
  ['5A', 1, 'Satın alınan mal ve hizmetler', 'Purchased goods and services'],
  ['5B', 2, 'Sermaye malları', 'Capital goods'],
  ['5C', 3, 'Yakıt ve enerjiyle ilgili faaliyetler', 'Fuel- and energy-related activities'],
  ['5D', 4, 'Yukarı akış nakliye ve dağıtım', 'Upstream transportation and distribution'],
  ['5E', 5, 'Faaliyetlerde oluşan atık', 'Waste generated in operations'],
  ['5F', 6, 'İş seyahatleri', 'Business travel'],
  ['5G', 7, 'Çalışan ulaşımı', 'Employee commuting'],
  ['5H', 8, 'Kiralanan varlıklar', 'Upstream leased assets'],
  ['5I', 9, 'Aşağı akış nakliye ve dağıtım', 'Downstream transportation and distribution'],
  ['5J', 10, 'Satılan ürünlerin işlenmesi', 'Processing of sold products'],
  ['5K', 11, 'Satılan ürünlerin kullanımı', 'Use of sold products'],
  ['5L', 12, 'Satılan ürünlerin ömür sonu', 'End-of-life treatment of sold products'],
  ['5M', 13, 'Kiraya verilen varlıklar', 'Downstream leased assets'],
  ['5N', 14, 'Franchise\'lar', 'Franchises'],
  ['5O', 15, 'Yatırımlar', 'Investments'],
];
const SCOPE3_NOT_APPLICABLE = ['no', 'na'];

function Scope3SummaryTable({ answers, lang, tr }) {
  const rows = SCOPE3_CATEGORIES.map(([block, n, trName, enName]) => {
    const qs = CARBONIQ_QUESTIONS.filter(q => q.stage === 5 && q.block === block && q.type !== 'info');
    const [gate, ...details] = qs;
    const asked = qs.some(q => q.id in answers);
    const gateVal = gate ? readAnswerValue(answers, gate.id) : undefined;
    const skipped = SCOPE3_NOT_APPLICABLE.includes(gateVal);
    // A category with no detail questions (Kat. 3 is one confirmation) shows
    // the gate answer itself.
    const extra = details
      .filter(q => q.id in answers)
      .map(q => {
        const t = getDisplayValue(q, readAnswerValue(answers, q.id), lang, { isAggregate: !!q.loopSource, answers });
        // A bare value ("15", "300") says nothing on its own: a question
        // with a summaryLabel is shown as "Label: value".
        const lbl = q.summaryLabel?.[lang] || q.summaryLabel?.en;
        return lbl && t && t !== '—' ? `${lbl}: ${t}` : t;
      })
      .filter(t => t && t !== '—')
      .join(' · ') || (gate && gate.id in answers && !skipped ? getDisplayValue(gate, gateVal, lang) : '');
    return {
      id: `K${n}`,
      label: tr ? trName : enName,
      notAsked: !asked,
      skipped,
      extra: extra.length > 240 ? `${extra.slice(0, 240)}…` : extra,
    };
  });

  return (
    <div className="rounded-2xl border border-[#2ABD41]/30 bg-[#F1FCF2] overflow-hidden text-[#175022]">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#2ABD41]/15 border-b border-[#2ABD41]/20">
        <ClipboardList className="h-3.5 w-3.5 text-[#175022] shrink-0" />
        <span className="text-[11px] font-bold text-[#175022] uppercase tracking-wider">
          {tr ? 'Kapsam 3 Özeti' : 'Scope 3 Summary'}
        </span>
      </div>
      <div className="divide-y divide-[#175022]/6">
        {rows.map(r => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className="shrink-0 mt-0.5 rounded-md bg-[#175022]/8 px-1.5 py-0.5 text-[10px] font-bold text-[#175022]/50 leading-tight">{r.id}</span>
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-semibold text-[#175022]/80">{r.label}</span>
              {r.notAsked ? (
                <span className="ml-2 text-[11px] text-[#175022]/35 italic">{tr ? 'sorulmadı' : 'not asked'}</span>
              ) : r.skipped ? (
                <span className="ml-2 text-[11px] text-[#175022]/35 italic">{tr ? 'yok' : 'none'}</span>
              ) : r.extra ? (
                <p className="text-[11px] text-[#175022] mt-0.5 leading-relaxed font-medium">{r.extra}</p>
              ) : (
                <span className="ml-2 text-[11px] text-[#175022]/30 italic">{tr ? 'veri girilmedi' : 'no data entered'}</span>
              )}
            </div>
            <span className={`shrink-0 mt-1 h-2 w-2 rounded-full ${r.notAsked || r.skipped ? 'bg-[#175022]/15' : r.extra ? 'bg-[#2ABD41]' : 'bg-amber-400'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: AnswerInput
// currentLoopItem — for fuel_loop / equipment_loop questions whose `units` is
// an object keyed by item value (e.g. { natural_gas: ['m³','kWh'], ... }).
// ─────────────────────────────────────────────────────────────────────────────
function AnswerInput({ question, value, onChange, onSubmit, lang, disabled, currentLoopItem, answers }) {
  const tr = lang === 'tr';
  // Guard against duplicate auto-submits from rapid double-taps on chip options
  const chipTimerRef = useRef(null);
  // Cancel any pending submit timer when this component unmounts (e.g. tab switch)
  useEffect(() => () => { if (chipTimerRef.current !== null) clearTimeout(chipTimerRef.current); }, []);
  // Fix #108: pass the clicked value directly to onSubmit so submitAnswer receives
  // it as overrideValue — eliminating the React async-state race where answerValue
  // hasn't re-rendered yet when the 80 ms timer fires (first click → stale empty
  // value → validation error; second click → state flushed → works).
  const scheduleSubmit = (val) => {
    if (chipTimerRef.current !== null) clearTimeout(chipTimerRef.current);
    chipTimerRef.current = setTimeout(() => { chipTimerRef.current = null; onSubmit(val); }, CHIP_AUTO_SUBMIT_DELAY_MS);
  };

  // ── Unit-aware numeric input state ──────────────────────────────────────────
  // Resolve the unit list for the current question + loop item.
  // question.units can be:
  //   • string[]  — one list for all items (e.g. ['kWh','MWh'])
  //   • object    — keyed by fuel/item type (e.g. { natural_gas: ['m³','kWh'] })
  const rawUnits = question?.units;
  let unitList = rawUnits
    ? (Array.isArray(rawUnits) ? rawUnits : (currentLoopItem ? (rawUnits[baseLoopItem(currentLoopItem)] || []) : []))
    : [];
  // unitFrom: the unit follows the data type picked for this item in an
  // earlier question (3B-7 takes litre / km / ton-km from 3B-6).
  if (question?.unitFrom && currentLoopItem && answers) {
    const picked = loopItemValue(readAnswerValue(answers, question.unitFrom.questionId), currentLoopItem);
    const only = question.unitFrom.map?.[picked];
    if (only && unitList.includes(only)) unitList = [only];
  }

  // Parse stored "amount unit" string back into parts when value has a space-separated unit.
  const parseStored = (v) => {
    if (!v || typeof v !== 'string') return { amount: v || '', unit: '' };
    const parts = v.split(' ');
    if (parts.length >= 2) {
      const potentialUnit = parts[parts.length - 1];
      if (unitList.includes(potentialUnit)) {
        return { amount: parts.slice(0, -1).join(' '), unit: potentialUnit };
      }
    }
    return { amount: v, unit: '' };
  };

  const initialParsed = parseStored(value);
  const [selectedUnit, setSelectedUnit] = useState(() => initialParsed.unit || unitList[0] || '');

  // Reset unit selection when question changes or when the loop item changes (different fuel = different units).
  const prevQuestionIdRef = useRef(question?.id);
  const prevLoopItemRef = useRef(currentLoopItem);
  useEffect(() => {
    const qChanged = prevQuestionIdRef.current !== question?.id;
    const itemChanged = prevLoopItemRef.current !== currentLoopItem;
    if (qChanged || itemChanged) {
      prevQuestionIdRef.current = question?.id;
      prevLoopItemRef.current = currentLoopItem;
      setSelectedUnit(unitList[0] || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, currentLoopItem]); // intentionally exclude unitList (derived)

  // An earlier answer restored into the input ("100.000 USD") brings its
  // unit along: the chip used to stay on the first unit (TL), so confirming
  // the shown value silently saved it as "100000 TL".
  useEffect(() => {
    const u = parseStored(value).unit;
    if (u && u !== selectedUnit) setSelectedUnit(u);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!question) return null;

  const { type, subtype, options, placeholder, minYear, maxYear } = question;

  if (type === 'info') {
    return (
      <button
        onClick={() => onSubmit()}
        disabled={disabled}
        className="rounded-full bg-[#175022] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#175022] disabled:opacity-40"
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
            label={stripOptionCode(opt.label?.[lang] || opt.label?.en || opt.value)}
            selected={value === opt.value}
            onClick={() => { onChange(opt.value); scheduleSubmit(opt.value); }}
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
          onClick={() => onSubmit(value)}
          disabled={disabled || !value?.country || cityRequired}
          className="rounded-full bg-[#175022] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#175022] disabled:opacity-40"
        >
          {tr ? 'Onayla →' : 'Confirm →'}
        </button>
      </div>
    );
  }

  if (type === 'year_select') {
    // Prefer question.options when defined (gives correct range + custom labels)
    if (options && options.length > 0) {
      // A year that must precede another answer (baseline < reporting year)
      // only offers the years that can actually be accepted.
      const rule = question.validateAgainst;
      const limit = rule?.rule === 'less_than' ? parseInt(answers?.[rule.questionId], 10) : NaN;
      const yearOptions = Number.isNaN(limit)
        ? options
        : options.filter(opt => parseInt(opt.value, 10) < limit);
      return (
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {yearOptions.map(opt => (
            <Chip
              key={opt.value}
              label={stripOptionCode(opt.label?.[lang] || opt.label?.en || opt.value)}
              selected={value === opt.value}
              onClick={() => { onChange(opt.value); scheduleSubmit(opt.value); }}
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
            onClick={() => { const v = String(y); onChange(v); scheduleSubmit(v); }}
            disabled={disabled}
          />
        ))}
      </div>
    );
  }

  if (type === 'single_select') {
    // An option with onlyForItems is offered only for those loop items
    // (3B-6 "ton-km" only for goods vehicles, not for a passenger car).
    const shown = (options || []).filter(o => !o.onlyForItems || !currentLoopItem || o.onlyForItems.includes(baseLoopItem(currentLoopItem)));
    return (
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {shown.map(opt => (
          <Chip
            key={opt.value}
            label={stripOptionCode(opt.label?.[lang] || opt.label?.en || opt.value)}
            selected={value === opt.value}
            onClick={() => { onChange(opt.value); scheduleSubmit(opt.value); }}
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
              label={stripOptionCode(opt.label?.[lang] || opt.label?.en || opt.value)}
              selected={vals.includes(opt.value)}
              onClick={() => toggle(opt.value)}
              // Every other answer type forwards `disabled`; this one dropped it,
              // so its chips stayed live while a save was in flight and toggles
              // made during that window were lost when the answer re-initialised.
              disabled={disabled}
              multi
            />
          ))}
        </div>
        <button
          onClick={() => onSubmit()}
          disabled={disabled || vals.length === 0}
          className="self-start rounded-full bg-[#175022] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#175022] disabled:opacity-40"
        >
          {tr ? 'Onayla →' : 'Confirm →'}
        </button>
      </div>
    );
  }

  // section_picker — large tappable cards for choosing which Scope 1 block to re-enter.
  // Auto-submits on click (same CHIP_AUTO_SUBMIT_DELAY_MS pattern as single_select chips)
  // so the user just taps once and is taken directly to that section's first question.
  if (type === 'section_picker') {
    return (
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {(options || []).map(opt => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => { onChange(opt.value); scheduleSubmit(opt.value); }}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
              value === opt.value
                ? 'border-[#2ABD41]/50 bg-[#2ABD41]/8 shadow-sm'
                : 'border-[#175022]/10 bg-white hover:border-[#175022]/20 hover:bg-[#F1FCF2]'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[#175022] leading-tight">
                {stripOptionCode(opt.label?.[lang] || opt.label?.en || opt.value)}
              </div>
              {opt.description && (
                <div className="text-[11px] text-[#175022]/50 mt-0.5 leading-relaxed">
                  {opt.description?.[lang] || opt.description?.en}
                </div>
              )}
            </div>
            <span className="shrink-0 text-[#175022]/25 text-base leading-none">›</span>
          </button>
        ))}
      </div>
    );
  }

  if (type === 'compound' && question.repeatable) {
    // Repeatable compound (e.g. K3C2's multiple capital-goods purchases): value
    // is { items: [...committed entries], draft: {...entry being edited} }.
    // "+ Add Another" commits the draft and clears it for a new entry; "Done"
    // commits the draft (if complete) and submits the whole items array.
    const fields = resolveFieldOptions(question.fields || [], answers);
    const val = (value && typeof value === 'object' && !Array.isArray(value)) ? value : { items: [], draft: {} };
    const items = Array.isArray(val.items) ? val.items : [];
    const draft = (val.draft && typeof val.draft === 'object') ? val.draft : {};
    const requiredFields = fields.filter(f => f.required !== false);
    const isFieldsetComplete = (obj) => requiredFields.every(f => {
      if (f.conditionalOn) {
        const condVal = obj[f.conditionalOn];
        const condMet = f.conditionalOnValue
          ? f.conditionalOnValue.includes(condVal)
          : (condVal === true || condVal === 'true');
        if (!condMet) return true; // hidden — treat as satisfied
      }
      const v = obj[f.id];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
    const draftFilled = isFieldsetComplete(draft);
    const draftIsEmpty = Object.values(draft).every(v => v === '' || v === undefined || v === null);
    const canFinish = (draftIsEmpty || draftFilled) && (items.length > 0 || draftFilled);
    const draftMissing = draftIsEmpty ? [] : missingRequiredLabels(requiredFields, draft, lang);
    const summarize = (item) => fields
      .filter(f => item[f.id] !== undefined && item[f.id] !== '' && item[f.id] !== null)
      .map(f => `${f.label?.[lang] || f.label?.en || f.id}: ${fieldValueText(f, item[f.id], lang)}`)
      .join(' · ');
    return (
      <div className="flex flex-col gap-4 w-full max-w-lg">
        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 rounded-xl border border-[#8BEA99]/40 bg-[#F1FCF2] px-3 py-2 text-xs text-[#175022]">
                <span className="flex-1">{idx + 1}. {summarize(item)}</span>
                <button
                  onClick={() => onChange({ items: items.filter((_, i) => i !== idx), draft })}
                  disabled={disabled}
                  aria-label={tr ? 'Kaldır' : 'Remove'}
                  className="shrink-0 rounded-full px-2 py-0.5 text-sm font-bold text-[#175022]/40 transition hover:bg-red-50 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <CompoundInput
          fields={fields}
          value={draft}
          onChange={(newDraft) => onChange({ items, draft: newDraft })}
          lang={lang}
          disabled={disabled}
        />
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ items: [...items, draft], draft: {} })}
            disabled={disabled || !draftFilled}
            className="self-start rounded-full border border-[#175022]/20 px-5 py-2.5 text-sm font-bold text-[#175022] transition hover:bg-[#175022]/5 disabled:opacity-40"
          >
            {tr ? '+ Başka Ekle' : '+ Add Another'}
          </button>
          <button
            onClick={() => onSubmit({ items: draftFilled ? [...items, draft] : items })}
            disabled={disabled || !canFinish}
            className="self-start rounded-full bg-[#175022] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#175022] disabled:opacity-40"
          >
            {tr ? 'Tamamla →' : 'Done →'}
          </button>
        </div>
        {!draftFilled && <MissingFieldsHint labels={draftMissing} tr={tr} />}
      </div>
    );
  }

  if (type === 'compound') {
    // A document-year example follows this inventory's year ("Örn: 2024"),
    // not a fixed 2023.
    const invYear = String(readAnswerValue(answers, 'A4') || '').trim();
    // groupOnly fields (3D-4's gas) belong to the 2nd, 3rd … group of a type.
    const fields = resolveFieldOptions(question.fields || [], answers)
      .filter(f => !f.groupOnly || loopItemGroup(currentLoopItem) > 1)
      .map(f =>
      (f.id === 'ef_year' && /^\d{4}$/.test(invYear)) ? { ...f, placeholder: { tr: `Örn: ${invYear}`, en: `e.g. ${invYear}` } } : f);
    const compoundVal = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
    const requiredFields = fields.filter(f => f.required !== false);
    // Fix #100: skip fields whose conditionalOn condition is not met — they are
    // hidden by CompoundInput and have no value, so they must not block the button.
    // Previously, a hidden required field could permanently disable Confirm.
    const allRequiredFilled = requiredFields.every(f => {
      if (f.conditionalOn) {
        const condVal = compoundVal[f.conditionalOn];
        const condMet = f.conditionalOnValue
          ? f.conditionalOnValue.includes(condVal)
          : (condVal === true || condVal === 'true');
        if (!condMet) return true; // hidden — treat as satisfied
      }
      const v = compoundVal[f.id];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
    const startedFilling = Object.values(compoundVal).some(v => v !== '' && v !== undefined && v !== null);
    const compoundMissing = startedFilling && !allRequiredFilled
      ? missingRequiredLabels(requiredFields, compoundVal, lang)
      : [];
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
          onClick={() => onSubmit()}
          disabled={disabled || !allRequiredFilled}
          className="self-start rounded-full bg-[#175022] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#175022] disabled:opacity-40"
        >
          {tr ? 'Onayla →' : 'Confirm →'}
        </button>
        <MissingFieldsHint labels={compoundMissing} tr={tr} />
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
          className="w-full rounded-xl border border-[#175022]/12 bg-white px-4 py-2.5 text-sm text-[#175022] outline-none placeholder:text-[#175022]/30 focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/20 resize-none"
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
          <span className="text-[10px] text-[#175022]/40">{tr ? 'Göndermek için Ctrl+Enter' : 'Ctrl+Enter to submit'}</span>
          {maxLen && <span className="text-[10px] text-[#175022]/35">{charCount}/{maxLen}</span>}
        </div>
        {!mlRequired && mlEmpty && (
          <span className="text-[10px] text-[#175022]/40 pl-1">
            {tr ? 'Bu alan isteğe bağlıdır — boş bırakabilirsiniz.' : 'This field is optional — you may leave it blank.'}
          </span>
        )}
        <button
          onClick={() => onSubmit()}
          disabled={disabled || (mlRequired && mlEmpty)}
          className="self-start rounded-full bg-[#175022] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#175022] disabled:opacity-40"
        >
          {tr ? 'Onayla →' : 'Confirm →'}
        </button>
      </div>
    );
  }

  // text / numeric / single-line — with optional unit selector
  const isRequired = question.required !== false;
  const maxLen = question.maxLength || question.exactLength;
  // '%' is a display-only suffix — don't bake it into the stored value because
  // it breaks numeric comparisons (Number("60 %") → NaN). All other units ARE
  // part of the stored value so the backend knows the measurement scale.
  const shouldCombineUnit = unitList.length > 0 && selectedUnit && selectedUnit !== '%';
  // Extract amount portion from a stored "amount unit" string (e.g. "15000 m³" → "15000")
  const amountStr = shouldCombineUnit ? parseStored(value).amount : (value || '');
  const charCount = String(amountStr).length;
  const isEmpty = !String(amountStr).trim();
  // Final value to submit: "15000 m³" for physical units, or just the number for %
  // An empty optional amount is submitted empty, not as a bare " kg".
  const buildSubmitValue = () => (shouldCombineUnit && String(amountStr).trim()) ? `${amountStr} ${selectedUnit}` : amountStr;

  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 rounded-xl border border-[#175022]/12 bg-white px-4 py-2.5 text-sm text-[#175022] outline-none placeholder:text-[#175022]/30 focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/20"
          type="text"
          inputMode={
            subtype === 'numeric' || type === 'numeric' ||
            ((type === 'fuel_loop' || type === 'equipment_loop') && question.units)
              ? 'numeric' : 'text'
          }
          value={amountStr}
          onChange={e => onChange(
            shouldCombineUnit ? `${e.target.value} ${selectedUnit}` : e.target.value
          )}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onSubmit(buildSubmitValue()); }
          }}
          placeholder={placeholder?.[lang] || placeholder?.en || ''}
          disabled={disabled}
          autoFocus
          maxLength={maxLen}
        />
        {/* Fixed unit label when there's only one option (e.g. "%" or "litre") */}
        {unitList.length === 1 && (
          <span className="shrink-0 rounded-xl border border-[#175022]/12 bg-[#F1FCF2] px-3 py-2.5 text-sm font-semibold text-[#175022]/60">
            {unitList[0]}
          </span>
        )}
        <button
          onClick={() => onSubmit(buildSubmitValue())}
          disabled={disabled || (isRequired && isEmpty)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#175022] text-white shadow-sm transition hover:bg-[#175022] disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Unit selector chips — shown when 2+ unit options exist */}
      {unitList.length >= 2 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          <span className="text-[11px] text-[#175022]/40 font-medium">
            {tr ? 'Birim:' : 'Unit:'}
          </span>
          {unitList.map(u => (
            <button
              key={u}
              type="button"
              disabled={disabled}
              onClick={() => {
                setSelectedUnit(u);
                // Keep parent value in sync immediately when unit changes
                if (amountStr) onChange(`${amountStr} ${u}`);
              }}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                selectedUnit === u
                  ? 'border-[#2ABD41]/50 bg-[#2ABD41]/12 text-[#175022]'
                  : 'border-[#175022]/10 bg-white text-[#175022]/55 hover:border-[#175022]/20 hover:bg-[#F1FCF2]'
              }`}
            >
              {unitLabel(u, lang)}
            </button>
          ))}
        </div>
      )}
      {maxLen && (
        <span className="text-right text-[10px] text-[#175022]/35 pr-12">{charCount}/{maxLen}</span>
      )}
      {!isRequired && isEmpty && (
        <span className="text-[10px] text-[#175022]/40 pl-1">
          {tr ? 'Bu alan isteğe bağlıdır — boş bırakabilirsiniz.' : 'This field is optional — you may leave it blank.'}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Block summary helpers
// ─────────────────────────────────────────────────────────────────────────────
// Editing one section from a scope summary (TY-1 / K3-TY = "edit", then the
// picker TY-edit / K3-TY-edit = the section's first question): once the flow
// would leave that section, go back to the summary instead of walking every
// later section again — as the picker promises. Returns the next question id.
const SECTION_EDIT_FLOWS = [
  { summary: 'TY-1', picker: 'TY-edit', stage: 3, editValues: ['edit'] },
  { summary: '4C-1', picker: '4C-edit', stage: 4, editValues: ['edit', 'add_source'] },
  { summary: 'K3-TY', picker: 'K3-TY-edit', stage: 5, editValues: ['edit', 'add_category'] },
  // 7C-1 "Hayır": fix a whole stage, then come back to the sign-off check.
  { summary: '7C-1', picker: '7C-edit', level: 'stage', editValues: ['fix_missing'] },
];
function scope1EditReturn(fromQ, nextId, answers) {
  for (const f of SECTION_EDIT_FLOWS) {
    if (!f.editValues.includes(readAnswerValue(answers, f.summary))) continue;
    if (f.level === 'stage') {
      const stage = getQuestionById(readAnswerValue(answers, f.picker))?.stage;
      if (!stage || fromQ?.stage !== stage) continue;
      const next = getQuestionById(nextId);
      return next && next.stage === stage ? nextId : f.summary;
    }
    const block = getQuestionById(readAnswerValue(answers, f.picker))?.block;
    if (!block || fromQ?.stage !== f.stage || fromQ?.block !== block) continue;
    const next = getQuestionById(nextId);
    return next && next.stage === f.stage && next.block === block ? nextId : f.summary;
  }
  return nextId;
}

// A block whose only answers are info screens or a scope-summary confirmation
// has nothing to review — skip the "section complete" table for it. Same for
// a block with a single question: its answer is the bubble right above, so
// the table only added a "Devam Et" click (Stage 6 had one after nearly
// every question).
function blockNeedsSummary(blockId, answers) {
  return getBlockAnsweredQuestions(blockId, answers)
    .filter(q => !q.showSummaryTable && q.type !== 'section_picker').length > 1;
}

// A per-item (loop) question's saved items: which items it has and the
// first one without an answer (-1 when every item is answered).
function loopResumeState(q, answersMap) {
  const items = buildLoopItems(q.id, answersMap || {}, 'en')?.items || [];
  const saved = readAnswerValue(answersMap || {}, q.id);
  const agg = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const has = (v) => v !== undefined && v !== null && v !== ''
    && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
  // An optional per-item question (84a) may be left blank for an item: a
  // saved empty value is answered too, or reopening would ask it again.
  const done = (it) => has(agg[it]) || (q.required === false && Object.prototype.hasOwnProperty.call(agg, it));
  return { items, agg, firstOpen: items.findIndex(it => !done(it)) };
}

// Resuming a saved inventory: from Stage 2 on the server's current_step is
// the question last *answered* (Stage 1 stores the next one), so reopening
// there showed an already-answered question to be submitted again. Step past
// it the same way submitting would. A loop question is stepped past once
// every item is answered (it used to restart at item 1 — all facilities had
// to be confirmed again after every reload); a partly answered one is kept,
// and the resume effect re-enters it at its first unanswered item.
function resumeQuestionId(stepId, answersMap) {
  const q = getQuestionById(stepId);
  if (!q || q.stage < 2) return stepId;
  // A per-item question whose list is empty but which was still asked and
  // answered as a plain question (3D-EF after "no fugitive sources") steps
  // on like any other answer — it used to be shown again on every reopen.
  const loopSt = q.loopSource ? loopResumeState(q, answersMap) : null;
  if (loopSt && (loopSt.items.length > 0 || !(answersMap && stepId in answersMap))) {
    const st = loopSt;
    if (st.items.length === 0 || st.firstOpen !== -1) return stepId;
    let nextId = q.loopNext || q.next || null;
    // Same walk as finishing the loop: skip following loops that are already
    // complete or have no items, and questions whose condition is not met.
    while (nextId) {
      const candidate = getQuestionById(nextId);
      if (candidate?.loopSource) {
        const cs = loopResumeState(candidate, answersMap);
        if (cs.items.length === 0 || cs.firstOpen === -1) { nextId = candidate.loopNext || candidate.next || null; continue; }
        break;
      }
      if (candidate?.conditionalShow && !conditionalShowMatches(candidate.conditionalShow, answersMap)) {
        nextId = candidate.next || candidate.loopNext || null;
        continue;
      }
      break;
    }
    nextId = scope1EditReturn(q, nextId, answersMap);
    return nextId && getQuestionById(nextId) ? nextId : stepId;
  }
  const value = readAnswerValue(answersMap || {}, stepId);
  // An info screen the user already continued past, or an optional question
  // they left empty, is saved with an empty answer — that still counts as
  // answered, otherwise reopening shows it again.
  const saved = answersMap && stepId in answersMap;
  const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  if (empty && !(saved && (q.type === 'info' || !q.required))) return stepId;
  let nextId = q.type === 'info' ? (q.next || null) : getNextQuestionId(q, value);
  if (nextId === '4-GİRİŞ' && readAnswerValue(answersMap, 'SCOPE-GROUPING') !== 'separate') {
    nextId = getQuestionById('4-GİRİŞ')?.next || nextId;
  }
  if (q.type !== 'section_picker') {
    // Per-item questions with nothing to loop over (3D-0 "none of these")
    // are skipped, as submitting does — reopening used to land on 3D-2 and
    // ask refrigerant details for zero sources. Like submitting, only the run
    // of loop questions straight after this one (3D-EF, after a hidden
    // question, is still asked).
    let leadingLoops = true;
    while (nextId) {
      const candidate = getQuestionById(nextId);
      if (leadingLoops && candidate?.loopSource && loopResumeState(candidate, answersMap).items.length === 0) {
        nextId = candidate.loopNext || candidate.next || null;
        continue;
      }
      leadingLoops = false;
      if (!candidate?.conditionalShow) break;
      if (conditionalShowMatches(candidate.conditionalShow, answersMap)) break;
      nextId = candidate.next || candidate.loopNext || null;
    }
  }
  nextId = scope1EditReturn(q, nextId, answersMap);
  return nextId && getQuestionById(nextId) ? nextId : stepId;
}

function getBlockId(q) {
  if (!q) return null;
  if (q.stage === 1) return `S1-${q.block}`;
  return `S${q.stage}-${q.block}`;
}

const BLOCK_LABELS = {
  'S1-A': { tr: 'Blok A — İdari Bilgiler', en: 'Block A — Administrative Info' },
  'S1-B': { tr: 'Blok B — Faaliyet Profili', en: 'Block B — Activity Profile' },
  'S1-C': { tr: 'Blok C — Yapısal Bilgiler', en: 'Block C — Structural Info' },
  'S1-D': { tr: 'Blok D — Raporlama Tercihleri', en: 'Block D — Reporting Preferences' },
  // A summary closes one block, not the whole stage: "Kapsam 1 — Özet —
  // Tamamlandı" after stationary combustion read as if vehicles were done too.
  'S2-2A': { tr: 'Tesisler — Özet', en: 'Facilities — Summary' },
  'S2-2B': { tr: 'Kontrol Yaklaşımı — Özet', en: 'Control Approach — Summary' },
  'S2-2C': { tr: 'Kontrol Dışı Tesisler — Özet', en: 'Facilities Outside Control — Summary' },
  'S3-3A': { tr: 'Kapsam 1 · Sabit Yanma — Özet', en: 'Scope 1 · Stationary Combustion — Summary' },
  'S3-3B': { tr: 'Kapsam 1 · Araçlar (Hareketli Yanma) — Özet', en: 'Scope 1 · Vehicles (Mobile Combustion) — Summary' },
  'S3-3C': { tr: 'Kapsam 1 · Proses Emisyonları — Özet', en: 'Scope 1 · Process Emissions — Summary' },
  'S3-3D': { tr: 'Kapsam 1 · Kaçak Emisyonlar — Özet', en: 'Scope 1 · Fugitive Emissions — Summary' },
  'S4-4A': { tr: 'Kapsam 2 · Satın Alınan Elektrik — Özet', en: 'Scope 2 · Purchased Electricity — Summary' },
  'S4-4B': { tr: 'Kapsam 2 · Satın Alınan Isı / Buhar / Soğutma — Özet', en: 'Scope 2 · Purchased Heat / Steam / Cooling — Summary' },
  'S5-5A': { tr: 'Kapsam 3 · Kat.1 Satın Alınan Mal ve Hizmetler — Özet', en: 'Scope 3 · Cat.1 Purchased Goods and Services — Summary' },
  'S5-5B': { tr: 'Kapsam 3 · Kat.2 Sermaye Malları — Özet', en: 'Scope 3 · Cat.2 Capital Goods — Summary' },
  'S5-5C': { tr: 'Kapsam 3 · Kat.3 Yakıt ve Enerji ile İlgili Faaliyetler — Özet', en: 'Scope 3 · Cat.3 Fuel- and Energy-Related Activities — Summary' },
  'S5-5D': { tr: 'Kapsam 3 · Kat.4 Yukarı Akış Taşımacılık — Özet', en: 'Scope 3 · Cat.4 Upstream Transportation — Summary' },
  'S5-5E': { tr: 'Kapsam 3 · Kat.5 Faaliyetlerde Oluşan Atık — Özet', en: 'Scope 3 · Cat.5 Waste Generated in Operations — Summary' },
  'S5-5F': { tr: 'Kapsam 3 · Kat.6 İş Seyahatleri — Özet', en: 'Scope 3 · Cat.6 Business Travel — Summary' },
  'S5-5G': { tr: 'Kapsam 3 · Kat.7 Çalışanların İşe Gidiş-Gelişi — Özet', en: 'Scope 3 · Cat.7 Employee Commuting — Summary' },
  'S5-5H': { tr: 'Kapsam 3 · Kat.8 Kiralanan Varlıklar — Özet', en: 'Scope 3 · Cat.8 Upstream Leased Assets — Summary' },
  'S5-5I': { tr: 'Kapsam 3 · Kat.9 Aşağı Akış Taşımacılık — Özet', en: 'Scope 3 · Cat.9 Downstream Transportation — Summary' },
  'S5-5J': { tr: 'Kapsam 3 · Kat.10 Satılan Ürünlerin İşlenmesi — Özet', en: 'Scope 3 · Cat.10 Processing of Sold Products — Summary' },
  'S5-5K': { tr: 'Kapsam 3 · Kat.11 Satılan Ürünlerin Kullanımı — Özet', en: 'Scope 3 · Cat.11 Use of Sold Products — Summary' },
  'S5-5L': { tr: 'Kapsam 3 · Kat.12 Ürünlerin Ömür Sonu — Özet', en: 'Scope 3 · Cat.12 End-of-Life of Sold Products — Summary' },
  'S5-5M': { tr: 'Kapsam 3 · Kat.13 Kiraya Verilen Varlıklar — Özet', en: 'Scope 3 · Cat.13 Downstream Leased Assets — Summary' },
  'S5-5N': { tr: 'Kapsam 3 · Kat.14 Franchise — Özet', en: 'Scope 3 · Cat.14 Franchises — Summary' },
  'S5-5O': { tr: 'Kapsam 3 · Kat.15 Yatırımlar — Özet', en: 'Scope 3 · Cat.15 Investments — Summary' },
};

function getBlockLabel(blockId, stageId) {
  if (BLOCK_LABELS[blockId]) return BLOCK_LABELS[blockId];
  const stage = CARBONIQ_STAGES.find(s => s.id === stageId);
  const nameTr = stage ? (stage.title.tr || stage.title.en) : `Aşama ${stageId}`;
  const nameEn = stage ? (stage.title.en || stage.title.tr) : `Stage ${stageId}`;
  return { tr: `${nameTr} — Özet`, en: `${nameEn} — Summary` };
}

function getBlockAnsweredQuestions(blockId, answers) {
  // Answered questions of the block on the user's route — an answer left on
  // a branch they turned away from is not part of their inventory any more.
  const onRoute = new Set(questionPath(answers).map(q => q.id));
  return CARBONIQ_QUESTIONS.filter(
    q => getBlockId(q) === blockId && q.id in answers && q.type !== 'info' && onRoute.has(q.id),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: BlockSummaryTable
// Shown at the end of each block so the user can review & edit before proceeding.
// ─────────────────────────────────────────────────────────────────────────────
function BlockSummaryTable({ blockId, stageId, questions, answers, lang, onEdit, onContinue }) {
  const tr = lang === 'tr';
  const label = getBlockLabel(blockId, stageId);
  return (
    <div className="rounded-2xl border border-[#8BEA99]/40 bg-[#F1FCF2] px-4 py-4 w-full">
      <div className="mb-2 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-[#2ABD41]" />
        <span className="text-sm font-bold text-[#175022]">
          {label[lang] || label.en} — {tr ? 'Tamamlandı' : 'Complete'}
        </span>
      </div>
      <p className="mb-3 text-xs text-[#175022]/55">
        {tr
          ? <>Bu bölümdeki yanıtlarınız aşağıda. Düzenlemek istediğiniz varsa <strong>Düzenle</strong> butonunu kullanın.</>
          : <>Your answers for this section are below. Use <strong>Edit</strong> to change any answer before continuing.</>}
      </p>
      <div className="overflow-x-auto rounded-xl border border-[#175022]/8 mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#175022]/8 bg-[#175022]/3">
              <th className="px-3 py-2 text-left font-semibold text-[#175022]/50">#</th>
              <th className="px-3 py-2 text-left font-semibold text-[#175022]/50">
                {tr ? 'Soru' : 'Question'}
              </th>
              <th className="px-3 py-2 text-left font-semibold text-[#175022]/50">
                {tr ? 'Yanıt' : 'Answer'}
              </th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q, idx) => {
              // A report resumed from the backend stores every answer as
              // { answer: value } (mapAnswerForBackend's default PATCH shape,
              // echoed back verbatim by the report-status endpoint) — reading
              // answers[q.id] directly showed literally "[object Object]" for
              // every row once a report had been reloaded/resumed even once.
              const answer = readAnswerValue(answers, q.id);
              const displayVal = getDisplayValue(q, answer, lang, { isAggregate: true, answers });
              const qText = stripDocLabels(q.text?.[lang] || q.text?.en || q.id);
              return (
                <tr key={q.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#175022]/2'}>
                  <td className="px-3 py-2 font-mono text-[10px] text-[#175022]/35">{q.number}</td>
                  <td className="px-3 py-2 text-[#175022]/65 max-w-[180px] leading-snug">{qText}</td>
                  <td className="px-3 py-2 font-semibold text-[#175022] max-w-[160px] leading-snug">{displayVal}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onEdit(q.id)}
                      className="flex items-center gap-1 rounded-lg border border-[#175022]/12 px-2 py-1 text-[10px] font-bold text-[#175022]/50 transition hover:border-[#8BEA99]/40 hover:bg-[#8BEA99]/8 hover:text-[#175022]"
                    >
                      <Pencil className="h-2.5 w-2.5" strokeWidth={2.5} />
                      {tr ? 'Düzenle' : 'Edit'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button
          onClick={onContinue}
          className="rounded-full bg-[#175022] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#175022]"
        >
          {tr ? 'Devam Et →' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Progress Sidebar
// ─────────────────────────────────────────────────────────────────────────────
function ProgressSidebar({ answers, currentId, lang, open, onToggle, completed = false }) {
  const tr = lang === 'tr';
  // Default to combined (Scope 1 & 2 together) unless user explicitly chose 'separate'
  const scopeGroupingAnswer = readAnswerValue(answers, 'SCOPE-GROUPING');
  const scopesCombined = scopeGroupingAnswer !== 'separate';

  // O(stages × answers) — memoized so it only recomputes when answers or currentId change.
  // When Scope 1+2 are set to "combined" (SCOPE-GROUPING), stages 3 and 4 are
  // folded into a single "Scope 1 & 2" row — same underlying questions, just a
  // different display grouping (see the question's own comment for why).
  const { displayStages, stageStats, totalAnswered, applicableTotal, pct } = useMemo(() => {
    // Count only real questions on the user's route — info screens are stored
    // in `answers` too, and answers left on an abandoned branch no longer apply.
    const routeAnswered = questionPath(answers).filter(q => q.type !== 'info' && q.id in answers);
    const countForStage = (stageId) => routeAnswered.filter(q => q.stage === stageId).length;

    const displayStages = scopesCombined
      ? [
          ...CARBONIQ_STAGES.filter(s => s.id < 3),
          { id: 'combined-3-4', stageIds: [3, 4], title: { tr: 'Kapsam 1 ve 2', en: 'Scope 1 & 2' } },
          ...CARBONIQ_STAGES.filter(s => s.id > 4),
        ]
      : CARBONIQ_STAGES;

    const stageStats = displayStages.map(stage => ({
      stage,
      answeredCount: stage.stageIds
        ? stage.stageIds.reduce((sum, id) => sum + countForStage(id), 0)
        : countForStage(stage.id),
    }));
    // Once the survey is completed every question on the route is answered,
    // so the answered count IS the total and the bar reads 100%.
    const { answered: totalAnswered, total: applicableTotal, percent: pct } =
      computeSurveyProgress(answers, completed);
    return { displayStages, stageStats, totalAnswered, applicableTotal, pct };
  }, [answers, scopesCombined, completed]);

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-[#175022]/6 bg-[#F1FCF2] transition-all duration-300 ${
        open
          ? 'absolute inset-y-0 left-0 z-30 w-[220px] lg:relative lg:inset-auto lg:z-auto'
          : 'w-0 overflow-hidden'
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#175022]/6 px-3 py-3">
        <span className="text-[10px] font-bold text-[#175022]/50 uppercase tracking-wider">
          {tr ? 'İlerleme' : 'Progress'}
        </span>
        <button
          onClick={onToggle}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[#175022]/40 hover:bg-[#175022]/6 hover:text-[#175022] transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Overall progress */}
      <div className="border-b border-[#175022]/6 px-3 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#175022]/60">
            {totalAnswered} / {applicableTotal}
          </span>
          <span className="text-[10px] font-bold text-[#2ABD41]">{lang === 'tr' ? `%${pct}` : `${pct}%`}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#175022]/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#2ABD41] to-[#8BEA99] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stage list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {displayStages.map(stage => {
          const stat = stageStats.find(s => s.stage.id === stage.id);
          const answered = stat?.answeredCount || 0;
          const currentQ = getQuestionById(currentId);
          const isCurrent = stage.stageIds
            ? stage.stageIds.includes(currentQ?.stage)
            : currentQ?.stage === stage.id;
          return (
            <div
              key={stage.id}
              className={`rounded-xl px-3 py-2 transition ${
                isCurrent
                  ? 'bg-[#8BEA99]/15 border border-[#8BEA99]/30'
                  : 'hover:bg-[#175022]/4'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${isCurrent ? 'bg-[#2ABD41]' : answered > 0 ? 'bg-[#8BEA99]/60' : 'bg-[#175022]/15'}`} />
                <span className={`text-[10px] font-bold truncate ${isCurrent ? 'text-[#175022]' : 'text-[#175022]/55'}`}>
                  {stage.title[lang] || stage.title.en}
                </span>
              </div>
              {answered > 0 && (
                <span className="text-[9px] text-[#175022]/35 pl-3">{answered} {tr ? 'cevaplandı' : 'answered'}</span>
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

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Workflow Wrapper (New Architecture)
// ─────────────────────────────────────────────────────────────────────────────
function QuestionnaireTabWithWorkflow({ language, isVisible = true }) {
  return (
    <InventoryProvider>
      <QuestionnaireTabInner language={language} isVisible={isVisible} />
    </InventoryProvider>
  );
}

function QuestionnaireTabInner({ language, isVisible = true }) {
  const {
    mode,
    activeInventoryId,
    answers: workflowAnswers,
    currentStep: workflowStep,
    stepExact: workflowStepExact,
    inventoryStatus,
    startedBy,
    setDirty,
    backToLibrary,
  } = useInventory();

  const tr = language === 'tr';

  // If in library mode, show InventoryLibrary
  if (mode === 'library') {
    return <InventoryLibrary tr={tr} />;
  }

  // If in review mode, show ReviewPage
  if (mode === 'review') {
    return <ReviewPage tr={tr} />;
  }

  // Otherwise (questionnaire mode) — hydrate the legacy survey component
  // directly with what InventoryWorkflow already resolved (Continue/New both
  // go through the context first), so it starts the survey on the first
  // render instead of re-discovering state via its own localStorage/picker.
  return (
    <>
      <QuestionnaireTab
        language={language}
        isVisible={isVisible}
        hydrated
        initialReportId={activeInventoryId}
        initialAnswers={workflowAnswers}
        initialStep={workflowStep}
        initialStepExact={workflowStepExact}
        inventoryCompleted={inventoryStatus === 'completed'}
        startedBy={startedBy}
        onDirtyChange={setDirty}
        onExitToLibrary={backToLibrary}
      />
      <SaveDraftModal tr={tr} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Questionnaire: Main Tab (Legacy - Questionnaire Flow Only)
// ─────────────────────────────────────────────────────────────────────────────
// hydrated: when true, this instance was launched by the new InventoryWorkflow
// with an already-resolved inventoryId/answers/step — skip the internal
// library/welcome/localStorage-restore paths entirely and start the survey
// directly. This is what makes "Continue" from InventoryLibrary a single click
// instead of landing on this component's own (now-legacy) picker first.
export function QuestionnaireTab({
  language, isVisible = true,
  hydrated = false, initialReportId = null, initialAnswers = null, initialStep = null, initialStepExact = false,
  onDirtyChange = null, onExitToLibrary = null, startedBy = null, inventoryCompleted = false,
}) {
  const tr = language === 'tr';
  const lang = language;

  // State
  const [started, setStarted] = useState(() => hydrated && !!initialReportId);
  // A question opened on purpose ("Ankette aç") is shown as is; a resumed
  // inventory steps past the last answered question.
  const [currentId, setCurrentId] = useState(() => (hydrated && initialStep && (
    initialStepExact && getQuestionById(initialStep) ? initialStep : resumeQuestionId(initialStep, initialAnswers)
  )) || getInitialQuestionId());
  const [answers, setAnswers] = useState(() => (hydrated && initialAnswers) || {});
  const [answerValue, setAnswerValue] = useState('');
  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [reportId, setReportId] = useState(() => (hydrated && initialReportId) || null);
  const [completed, setCompleted] = useState(false);
  const [assumptions, setAssumptions] = useState([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  // validationError: the message from the last failed submit attempt.
  // showValidationError: true after the first failed Confirm click; reset when question changes.
  // Together they show the error only after submit AND only while the answer is still invalid.
  const [validationError, setValidationError] = useState('');
  const [showValidationError, setShowValidationError] = useState(false);
  // loopState: { questionId, items, itemLabels, currentIndex, collected }
  const [loopState, setLoopState] = useState(null);
  // Generic loop info messages already shown ("questionId|text"), so they appear once per loop.
  const loopSysMsgShownRef = useRef(new Set());
  // blockSummaryState: shown at block/stage transitions; null when not active
  const [blockSummaryState, setBlockSummaryState] = useState(null);
  // On mobile sidebar starts closed; desktop starts open
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [completedReport, setCompletedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  // ✅ Edit mode: return to review after saving, not continue survey
  const [editingQuestionId, setEditingQuestionId] = useState(null);

  // ✅ "Reuse previous Company Profile?" — previousProfile holds the check
  // result (null until fetched, {available:false} if the company has none),
  // showReuseDialog drives the confirm modal, reuseLoading guards the button
  // while the copy-over request is in flight.
  const [previousProfile, setPreviousProfile] = useState(null);
  // This inventory's reporting year as chosen when it was created.
  const reportYearRef = useRef(null);
  const [showReuseDialog, setShowReuseDialog] = useState(false);
  const [reuseLoading, setReuseLoading] = useState(false);
  // Reporting year chosen in the reuse dialog — the year is this inventory's
  // own and is never copied from the earlier one.
  const [reuseYear, setReuseYear] = useState('');
  const previousProfileCheckedRef = useRef(false);

  // reportId persistence/restore lives entirely in InventoryWorkflow.jsx now
  // (localStorage key 'carboniq_activeInventoryId') — this component is always
  // hydrated with an already-resolved reportId/answers/step from that context.

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  // ✅ On a genuinely fresh report (nothing answered yet, sitting at the very
  // first question) check whether this company already has a Company Profile
  // saved on an earlier report, and if so, offer to reuse it instead of
  // re-asking ~20 questions. Runs once per mount — a resumed report (any
  // answers already present) or one that's already past A1 skips this.
  // The company's HQ country decides what Question 2 (tax ID) accepts: a
  // VKN/TCKN in Turkey, the local tax / VAT number anywhere else. The state
  // only exists to re-render once getQuestionById knows the country.
  const [, setCompanyCountryState] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.getCompanyDetail()
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        setQuestionnaireCompanyCountry(data.country_of_headquarters);
        setCompanyCountryState(data.country_of_headquarters || '');
        // A resumed questionnaire may already show Question 2 with the
        // VKN/TCKN hint (posted before the country arrived): swap in the
        // hint that now applies.
        const base = CARBONIQ_QUESTIONS.find(q => q.id === 'A2');
        const now = getQuestionById('A2');
        if (base && now && now.helper !== base.helper) {
          setMessages(prev => prev.map(m => {
            if (m.role !== 'assistant' || typeof m.content !== 'string') return m;
            let content = m.content;
            for (const l of ['tr', 'en']) content = content.replace(base.helper[l], now.helper[l]);
            return content === m.content ? m : { ...m, content };
          }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (previousProfileCheckedRef.current) return;
    // Fetch while anywhere in Stage 1 (Company Profile), not only at a fresh
    // A1: it also carries the registration details used to pre-fill A1/A2,
    // which a user resuming mid-stage should still get. The reuse offer
    // itself stays limited to a genuinely fresh report.
    if (!reportId || getQuestionById(currentId)?.stage !== 1) return;
    const isFreshStart = currentId === 'A1' && Object.keys(answers).length === 0;
    previousProfileCheckedRef.current = true;
    api.getPreviousCompanyProfile(reportId)
      .then(res => res.json())
      .then(data => {
        if (!isMounted.current) return;
        setPreviousProfile(data);
        if (data?.current_reporting_year) reportYearRef.current = data.current_reporting_year;
        if (data?.available && isFreshStart) {
          const thisYear = new Date().getFullYear();
          const prev = Number(data.reporting_year);
          // The year chosen when the inventory was created; otherwise the
          // year after the earlier inventory.
          const own = Number(data.current_reporting_year);
          setReuseYear(String(own || (prev ? Math.min(prev + 1, thisYear) : thisYear - 1)));
          setShowReuseDialog(true);
        }
      })
      .catch(e => console.error('getPreviousCompanyProfile failed:', e));
  }, [reportId, currentId, answers]);

  const handleConfirmReuseProfile = useCallback(async () => {
    if (!reportId || reuseLoading) return;
    setReuseLoading(true);
    try {
      // The answers about to be copied, so the inventory list gets the same
      // answered/total the questionnaire will show.
      const copied = { ...answersRef.current };
      Object.entries(previousProfile?.answers || {}).forEach(([stepId, backendAnswer]) => {
        const raw = unmapPhase1Answer(stepId, backendAnswer);
        if (raw !== undefined) copied[stepId] = raw;
      });
      copied.A4 = String(reuseYear);
      const { answered, total } = computeSurveyProgress(copied);
      const res = await api.reuseCompanyProfile(reportId, Number(reuseYear), { answered, total });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setAnswers(prev => {
          const next = { ...prev };
          Object.entries(data.answers || {}).forEach(([stepId, backendAnswer]) => {
            const raw = unmapPhase1Answer(stepId, backendAnswer);
            next[stepId] = raw !== undefined ? raw : true;
          });
          return next;
        });
        const nextId = data.current_step || '2A-0';
        const nextQ = getQuestionById(nextId);
        setCurrentId(nextId);
        setAnswerValue(getInitialValue(nextQ));
        onDirtyChange?.(true);
        // Replace the transcript rather than appending: the mount-time welcome
        // bubble already asked question 1 (the company name), and we've just
        // skipped past it. Appending would leave that question visibly asked
        // but abandoned, directly above the message saying it was skipped.
        setMessages([
          {
            id: `m-${++msgIdRef.current}`,
            role: 'assistant',
            type: 'info',
            content: tr
              ? '✅ Önceki şirket profiliniz kullanıldı. Şimdi organizasyon sınırınızı tanımlayalım.'
              : "✅ Reused your previous company profile. Let's define your organizational boundary now.",
          },
          ...(nextQ ? [{
            id: `m-${++msgIdRef.current}`,
            role: 'assistant',
            type: nextQ.type === 'info' ? 'info' : 'assistant',
            content: nextQ.text?.[lang] || nextQ.text?.en,
          }] : []),
        ]);
      }
    } catch (e) {
      console.error('reuseCompanyProfile failed:', e);
    } finally {
      setReuseLoading(false);
      setShowReuseDialog(false);
    }
  }, [reportId, reuseLoading, reuseYear, tr, lang, onDirtyChange, previousProfile]);

  // Another inventory of this company already covers `year`? Emission entries
  // are kept per company and year, so a second inventory for the same year
  // would share — and overwrite — the first one's numbers.
  const inventoryForYear = useCallback((year) => (
    (previousProfile?.other_inventories || []).find(r => String(r.reporting_year) === String(year))
  ), [previousProfile]);
  const sameYearWarning = useCallback((year) => {
    const other = inventoryForYear(year);
    if (!other) return null;
    return tr
      ? `${year} yılı için zaten bir envanteriniz var: “${other.title}”. Aynı yıl için ikinci bir envanter, o envanterle aynı emisyon kayıtlarını kullanır — bu envanterde girdiğiniz değerler öncekinin değerlerinin yerine geçer. Farklı bir yıl için hazırlıyorsanız yılı değiştirin.`
      : `You already have an inventory for ${year}: “${other.title}”. A second inventory for the same year uses the same emission records — the values you enter here replace the earlier ones. If this inventory is for another year, change the year.`;
  }, [inventoryForYear, tr]);

  // "No, let me re-enter": the user fills the profile in themselves, so the
  // earlier report's answers are no longer offered — only the name and tax
  // number typed at sign-up stay pre-filled.
  const handleDeclineReuseProfile = useCallback(() => {
    setShowReuseDialog(false);
    setPreviousProfile(prev => (prev ? { ...prev, answers: prev.registration_answers || {} } : prev));
    const registered = unmapPhase1Answer(currentId, previousProfile?.registration_answers?.[currentId]);
    setAnswerValue(registered !== undefined ? registered : getInitialValue(getQuestionById(currentId)));
  }, [currentId, previousProfile]);

  const scrollRef = useRef(null);
  const isMounted = useRef(true);
  const typingTimerRef = useRef(null);
  const saveSuccessTimerRef = useRef(null);
  const scrollTimerRef = useRef(null);
  // Synchronous mutex — prevents a second submitAnswer call from passing the
  // isTyping guard during the await saveStepToBackend network window.
  const isSubmittingRef = useRef(false);
  // Render-visible twin of the mutex above. The ref alone is what makes the
  // re-entry guard correct (a state update is async, so a second click could
  // slip through before it lands), but a ref changing does not re-render, so
  // for the whole network round-trip the chips stayed enabled while
  // submitAnswer silently dropped every click on the mutex — the answer just
  // "did nothing" and users clicked again and again. Disabling the input on
  // this makes that window visible instead of dead.
  const [submitting, setSubmitting] = useState(false);
  // Always move the two together; call this instead of assigning the ref.
  const markSubmitting = useCallback((busy) => {
    isSubmittingRef.current = busy;
    setSubmitting(busy);
  }, []);
  // Prevents a rapid double-click on "Start / Continue Inventory" from firing
  // two concurrent POST /questionnaire/start/ requests, which would create
  // duplicate reports on the backend.
  const startingRef = useRef(false);
  // Stable message-key counter — avoids Date.now() collisions
  const msgIdRef = useRef(0);
  // "Not calculated" notes already shown after a save (each is said once).
  const shownCalcNotesRef = useRef(new Set());
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

  // ✅ Per-stage answer breakdown for the completion report — reuses the same
  // CARBONIQ_STAGES grouping the ProgressSidebar already shows during the
  // survey, so the finished-report view stays consistent with what the user
  // saw while answering. completedReport.answers (backend, authoritative) is
  // preferred over local `answers` state once available.
  const completionStageBreakdown = useMemo(() => {
    if (!completed) return [];
    // The backend echoes each step as it was saved (Stage 1 as named fields,
    // the rest as { answer }); the route walk reads widget values, so
    // normalise them the way a resumed inventory is.
    const src = completedReport?.answers
      ? Object.fromEntries(Object.entries(completedReport.answers).map(([qid, raw]) => {
          const unmapped = unmapPhase1Answer(qid, raw);
          return [qid, unmapped !== undefined ? unmapped : readAnswerValue({ [qid]: raw }, qid)];
        }))
      : answers;
    const combined = readAnswerValue(src, 'SCOPE-GROUPING') !== 'separate';
    const stagesToShow = combined
      ? [
          ...CARBONIQ_STAGES.filter(s => s.id !== 3 && s.id !== 4 && s.id < 5),
          { id: 'combined-3-4', stageIds: [3, 4], title: { tr: 'Kapsam 1 ve 2', en: 'Scope 1 & 2' } },
          ...CARBONIQ_STAGES.filter(s => s.id >= 5),
        ]
      : CARBONIQ_STAGES;
    // Same "applicable" rule as the live progress bar, so a completed survey
    // reads 100% here too instead of counting branches this user never saw.
    const applicable = questionPath(src).filter(q => q.type !== 'info');
    return stagesToShow.map(stage => {
      const stageIds = stage.stageIds || [stage.id];
      const stageQuestions = applicable.filter(q => stageIds.includes(q.stage));
      const answeredIds = stageQuestions.filter(q => q.id in src).map(q => q.id);
      // The survey is finished, so the questions this user was routed to are
      // exactly the answered ones; applicable-but-unanswered questions were
      // skipped by nextByValue routing and never applied (see ProgressSidebar).
      return {
        id: stage.id,
        title: stage.title,
        answeredCount: answeredIds.length,
        totalCount: answeredIds.length,
      };
    });
  }, [completed, completedReport, answers]);

  // ✅ Seed the initial chat bubble when hydrated by InventoryWorkflow.
  // The old self-driven resume path (since removed) used to build this
  // welcome message itself; a hydrated mount skips that path entirely
  // (started=true from first render), so it must build its own resume
  // bubble once here.
  useEffect(() => {
    if (!hydrated || !initialReportId) return;
    const firstQ = getQuestionById(currentId);
    if (!firstQ) return;
    // A brand-new inventory has nothing to resume — greet it as a start.
    const isFresh = Object.keys(answers).length === 0;
    // Same cleanup the live flow applies: strips the "[Equipment name] —"
    // doc placeholder that loop questions carry in their raw text.
    const qText = stripDocLabels(firstQ.text?.[lang] || firstQ.text?.en || '');
    // Resuming onto a loop question: re-enter the loop at its first
    // unanswered item, carrying the answered ones, so the item is named and
    // submitAnswer takes the loop path.
    let itemLabel = null;
    let resumeItem;
    let resumeIndex = 0;
    if (firstQ.loopSource) {
      const built = buildLoopItems(currentId, answers, lang);
      if (built && built.items.length > 0) {
        const { agg, firstOpen } = loopResumeState(firstQ, answers);
        const index = firstOpen >= 0 ? firstOpen : 0;
        resumeItem = built.items[index];
        resumeIndex = index;
        const collected = {};
        built.items.forEach((it, i) => { if (i < index && agg[it] !== undefined) collected[it] = agg[it]; });
        setLoopState({ questionId: currentId, items: built.items, itemLabels: built.itemLabels, currentIndex: index, collected });
        itemLabel = built.itemLabels[index] || built.items[index];
      }
    }
    const qRef = itemLabel ? `${firstQ.number} (${itemLabel})` : `${firstQ.number}`;
    // Opened on purpose: on the sign-off check to fix a finished inventory,
    // or on one question ("Ankette aç") — not "resuming where you left off".
    const editIntro = !initialStepExact ? null
      : inventoryCompleted && currentId === '7C-1'
        ? (tr ? `Bu envanter tamamlandı. Bir bölümü düzeltmek için "Hayır — bir bölüme dönüp düzeltmek istiyorum"u seçin; bölüm bitince buraya dönersiniz — Soru ${qRef}:`
              : `This inventory is complete. To fix a section choose "No — I want to go back and fix a section"; you come back here when the section is done — Question ${qRef}:`)
        : inventoryCompleted
          ? (tr ? `Tamamlanmış bir envanteri düzenliyorsunuz — Soru ${qRef}. İşiniz bitince "Düzenlemeyi bitir" ile imza adımına dönün:`
                : `You are editing Question ${qRef} of a completed inventory. When you are done, use "Finish editing" to return to the sign-off step:`)
          : (tr ? `Düzenlediğiniz soru — Soru ${qRef}:` : `You are editing Question ${qRef}:`);
    const intro = isFresh
      ? (tr ? `Karbon envanterinize başlayalım — Soru ${qRef}:` : `Let's start your carbon inventory — Question ${qRef}:`)
      : editIntro
        ? editIntro
      : startedBy
        // Opened by a team mate of the one who started it: nothing of theirs
        // to "resume" — say whose inventory it is and where it stands.
        ? (tr ? `Bu envanteri ${startedBy} başlattı. Soru ${qRef} ile devam ediyorsunuz:` : `${startedBy} started this inventory. You're continuing at Question ${qRef}:`)
        : (tr ? `Tekrar hoş geldiniz! Kaldığınız yerden devam ediyorsunuz — Soru ${qRef}:` : `Welcome back! Resuming where you left off — Question ${qRef}:`);
    const welcomeMsg = {
      id: 'welcome',
      role: 'assistant',
      content: `${intro}\n\n${qText}`,
    };
    if (firstQ.helper) {
      welcomeMsg.content += `\n\n_${firstQ.helper?.[lang] || firstQ.helper?.en}_`;
    }
    setMessages([welcomeMsg]);
    questionMsgLenRef.current = 1;
    // The item the loop resumes on — not item 0: a second facility used to
    // open with the first one's name (then refused as a duplicate), a
    // second meter with the first one's reading.
    const resumeLoopValue = itemLabel
      ? (loopItemValue(readAnswerValue(answers, currentId), resumeItem) ?? facilityPrefill(firstQ, resumeIndex))
      : undefined;
    setAnswerValue(itemLabel
      ? (resumeLoopValue !== undefined ? localizeStoredAmount(firstQ, normalizeAnswerValue(firstQ, resumeLoopValue), lang) : getInitialValue(firstQ))
      : normalizeAnswerValue(firstQ, readAnswerValue(answers, currentId)) ?? getInitialValue(firstQ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear inline validation error whenever the user changes their answer.
  // This prevents stale "please fill in X" messages from lingering after
  // the user has already corrected the field.
  useEffect(() => { setValidationError(''); setShowValidationError(false); }, [answerValue]);

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

  // Which question the current answerValue was initialised for. Until this
  // catches up with currentId the answer controls belong to the question the
  // user is leaving, not the one on screen, so they must not accept input.
  const [answerForId, setAnswerForId] = useState(currentId);
  // Ref twin, for the same reason the submit mutex has one: disabling the
  // controls is a render away, so a click already in flight can still reach
  // submitAnswer with the outgoing question's value.
  const answerForIdRef = useRef(currentId);
  useEffect(() => { answerForIdRef.current = answerForId; }, [answerForId]);

  // Keep a ref so the init effect can read the latest answers without being
  // re-triggered on every setAnswers call (which would race with submitAnswer).
  const answersRef = useRef(answers);
  // Facilities already registered (sign-up / Settings): 2A-2's per-facility
  // name+country starts from them instead of blank. Sign-up's placeholder
  // names ("Tesis 1") are not offered as a name, only their country.
  // Also the facilities of the company's earlier inventory, in that
  // inventory's order, so "Tesis 1" stays the same site year to year.
  // Kept as state: on a resumed 2A-2 the lists arrive after the question
  // is already on screen, and must still fill it (see the effect below).
  const [facilitySources, setFacilitySources] = useState({ registered: [], previous: [], activities: {}, subsidiaries: [], selections: {}, previousYear: null, loaded: false });
  const registeredFacilitiesRef = useRef([]);
  // Read through a ref so callbacks created before the lists arrived (the
  // loop's next-item step) still see them.
  const facilitySourcesRef = useRef(facilitySources);
  facilitySourcesRef.current = facilitySources;
  useEffect(() => {
    api.getFacilities()
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.results || []);
        registeredFacilitiesRef.current = list.filter(f => f && f.is_active !== false);
        setFacilitySources(prev => ({ ...prev, registered: registeredFacilitiesRef.current }));
      })
      .catch(() => {});
  }, []);
  // 6B-OV: the assumptions the answers already imply (estimates, defaults)
  // — the questions promised these would be documented; listed so the user
  // sees them before deciding whether to add their own.
  const [recordedAssumptions, setRecordedAssumptions] = useState(null);
  // The 7C-2 signature is for an owner, admin or manager (the backend
  // refuses others); a data-entry member is told so before filling it in.
  const [canSign, setCanSign] = useState(true);
  useEffect(() => {
    if (currentId !== '7C-2') return;
    api.getProfile()
      .then(res => (res.ok ? res.json() : null))
      .then(profile => { if (profile && isMounted.current) setCanSign(getPermissions(profile).canApprove); })
      .catch(() => {});
  }, [currentId]);
  useEffect(() => {
    if (!reportId || currentId !== '6B-OV') return;
    api.getReportAssumptions(reportId, lang)
      .then(res => (res.ok ? res.json() : {}))
      .then(data => { if (isMounted.current) setRecordedAssumptions(Array.isArray(data?.assumptions) ? data.assumptions : []); })
      .catch(() => {});
  }, [reportId, currentId, lang]);

  const previousFacilitiesFetchedRef = useRef(false);
  useEffect(() => {
    if (!reportId || previousFacilitiesFetchedRef.current) return;
    if (!['2A-1', '2A-2', '2A-3', '2A-4', ...PREVIOUS_SELECTION_STEPS].includes(currentId)) return;
    previousFacilitiesFetchedRef.current = true;
    api.getPreviousCompanyProfile(reportId)
      .then(res => (res.ok ? res.json() : {}))
      .then(data => {
        if (!isMounted.current) return;
        setFacilitySources(prev => ({
          ...prev,
          previous: Array.isArray(data?.previous_facilities) ? data.previous_facilities : [],
          activities: data?.previous_facility_activities && typeof data.previous_facility_activities === 'object' ? data.previous_facility_activities : {},
          subsidiaries: Array.isArray(data?.previous_subsidiaries) ? data.previous_subsidiaries : [],
          selections: data?.previous_selections && typeof data.previous_selections === 'object' ? data.previous_selections : {},
          previousYear: data?.previous_year || null,
          loaded: true,
        }));
      })
      .catch(() => setFacilitySources(prev => ({ ...prev, loaded: true })));
  }, [reportId, currentId]);
  // 2A-1 (facility count) starts from B4, which a reused company profile may
  // carry from an older year; the previous inventory's own facility list is
  // the better default once it has arrived (the hint below the field already
  // named it). Only while the field still holds the B4 value.
  useEffect(() => {
    if (currentId !== '2A-1' || !facilitySources.loaded || '2A-1' in answersRef.current) return;
    const n = facilitySources.previous.length;
    if (!n) return;
    const b4 = readAnswerValue(answersRef.current, 'B4');
    setAnswerValue(v => (String(v ?? '').trim() === '' || String(v) === String(b4 ?? '') ? String(n) : v));
  }, [currentId, facilitySources.loaded, facilitySources.previous]);
  const facilityPrefill = (q, index) => {
    // 3A-2b: the site was just given in 3A-2 — a site declared outside
    // operational control in 2B-OC1a starts on "no", any other on "yes".
    if (q?.id === '3A-2b') {
      const eq = readAnswerValue(answersRef.current, '3A-1');
      const item = Array.isArray(eq) ? eq[index] : undefined;
      const site = String(loopItemValue(readAnswerValue(answersRef.current, '3A-2'), item)?.site || '').trim();
      if (!site) return undefined;
      return noControlSites(answersRef.current).includes(site.toLocaleLowerCase('tr-TR')) ? 'no' : 'yes';
    }
    // 2A-3 (what the facility does): last year's answer for the facility
    // with the same name, whatever its position.
    if (q?.id === '2A-3') {
      const sites = readAnswerValue(answersRef.current, '2A-2');
      const name = String(sites?.[String(index + 1)]?.name || '').trim();
      const prev = name ? facilitySourcesRef.current.activities?.[name] : undefined;
      return prev || undefined;
    }
    if (q?.id !== '2A-2') return undefined;
    // Wait for last year's list: the registered facilities arrive first, in
    // their own order, so a resumed "Tesis 2" used to get the registered
    // list's second name — the one already given to Tesis 1.
    if (!facilitySourcesRef.current.loaded) return undefined;
    const clean = (n) => { const name = String(n || '').trim(); return /^(tesis|facility)\s*\d+$/i.test(name) ? '' : name; };
    // The earlier inventory's list first (its order), then registered
    // facilities it did not have.
    const previous = facilitySourcesRef.current.previous.map(f => ({ name: clean(f.name), country: f.country || '' }));
    const seen = new Set(previous.map(f => f.name.toLocaleLowerCase('tr-TR')).filter(Boolean));
    const extra = registeredFacilitiesRef.current
      .map(f => ({ name: clean(f.name), country: f.country || '' }))
      .filter(f => !f.name || !seen.has(f.name.toLocaleLowerCase('tr-TR')));
    const f = [...previous, ...extra][index];
    return f ? { name: f.name, country: f.country } : undefined;
  };
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // A resumed 2A-2 is on screen before the facility lists arrive: fill the
  // open item once they do, unless something is already entered there.
  useEffect(() => {
    if (currentId === '2A-4') {
      const subs = facilitySources.subsidiaries;
      if (!subs?.length || answersRef.current['2A-4'] !== undefined) return;
      setAnswerValue(v => {
        const empty = !v || ((!v.items || v.items.length === 0)
          && !Object.values(v.draft || {}).some(x => String(x ?? '').trim()));
        return empty ? normalizeAnswerValue(currentQuestion, { items: subs, draft: {} }) : v;
      });
      return;
    }
    if (currentId !== '2A-2' && currentId !== '2A-3') return;
    const index = loopState && loopState.questionId === currentId ? loopState.currentIndex : 0;
    const pre = facilityPrefill(currentQuestion, index);
    if (!pre) return;
    setAnswerValue(v => {
      const empty = typeof pre === 'string'
        ? !String(v ?? '').trim()
        : (!v || typeof v !== 'object' || (!String(v.name || '').trim() && !String(v.country || '').trim()));
      return empty ? normalizeAnswerValue(currentQuestion, pre) : v;
    });
  }, [facilitySources]); // eslint-disable-line react-hooks/exhaustive-deps

  // Init answer value when the QUESTION changes (navigation / goBack).
  // Deliberately excludes `answers` from the dep array — the ref above is used
  // instead to avoid re-running on every keystroke / submission.
  // Fix #62: also clear validationError here — the existing [answerValue] effect
  // is not enough when the restored value is the same object reference (e.g. the
  // user already filled country+city, navigated away, came back — React sees no
  // reference change so the [answerValue] effect never fires and the stale error
  // from the previous Confirm click would persist indefinitely.
  useEffect(() => {
    if (currentQuestion) {
      // Mid-loop, answers[currentId] holds the FINISHED loop's aggregate
      // ({ itemKey: perItemAnswer, ... }) — not this item's value. Reading it
      // directly here would dump that raw object into the text input (rendering
      // as "[object Object]") whenever a stale aggregate from an earlier pass
      // through the loop is still sitting in `answers`. Pull the per-item value
      // from loopState.collected instead while a loop is actively running.
      let existing;
      if (loopState && loopState.questionId === currentId) {
        const item = loopState.items[loopState.currentIndex];
        existing = loopState.collected[item] ?? loopItemValue(answersRef.current[currentId], item)
          ?? facilityPrefill(currentQuestion, loopState.currentIndex);
      } else if (currentQuestion.loopSource) {
        // The loop has not been (re)entered yet — on resume, where the resume
        // effect starts it at the first unanswered item in this same pass. Take
        // that item's value: reading item 0 here pre-filled a half-answered
        // loop's open item with the first item's answer (a second vehicle got
        // the first one's count, site and size).
        const { items: resumeItems, firstOpen } = loopResumeState(currentQuestion, answersRef.current);
        const index = firstOpen >= 0 ? firstOpen : 0;
        existing = loopItemValue(answersRef.current[currentId], resumeItems[index]) ?? facilityPrefill(currentQuestion, index);
      } else {
        existing = answersRef.current[currentId];
        // Signing again: the earlier declaration is not carried over — the
        // person signing now ticks it themselves.
        if (currentId === '7C-2' && existing && typeof existing === 'object' && !Array.isArray(existing)) {
          // eslint-disable-next-line no-unused-vars
          const { declaration_accepted, confirmed_by, ...rest } = existing;
          existing = rest;
        }
        // prefillFrom: the question repeats an earlier one (2A-1 asks the
        // facility count B4 already did) — start from that answer, as its
        // helper text promises, instead of blank.
        if (existing === undefined && currentQuestion.prefillFrom) {
          const src = readAnswerValue(answersRef.current, currentQuestion.prefillFrom);
          if (src !== undefined && src !== null && typeof src !== 'object' && String(src).trim() !== '') existing = String(src);
        }
        // 2A-4 (subsidiaries): the earlier inventory's list, to confirm or edit.
        if (existing === undefined && currentId === '2A-4' && facilitySourcesRef.current.subsidiaries?.length) {
          existing = { items: facilitySourcesRef.current.subsidiaries, draft: {} };
        }
        // 6A-1a: the sites declared outside operational control in Stage 2.
        if (existing === undefined && currentId === '6A-1a') {
          const pre = stage2ExclusionRows(answersRef.current);
          // The first site opens in the form (its share still to pick); the
          // 109 hint names them all.
          if (pre.length) existing = { items: [], draft: pre[0] };
        }
        // A4 (reporting year): the year chosen when the inventory was created.
        if (existing === undefined && currentId === 'A4' && reportYearRef.current) {
          existing = String(reportYearRef.current);
        }
      }
      setAnswerValue(existing !== undefined ? localizeStoredAmount(currentQuestion, normalizeAnswerValue(currentQuestion, existing), lang) : getInitialValue(currentQuestion));
      // Marks answerValue as belonging to THIS question. React usually runs
      // this effect before the browser paints, but on a transcript this long
      // the new question's options can paint first, leaving a window where they
      // are clickable while answerValue still holds the previous question's
      // answer. A click landing there was applied to the outgoing value and
      // then wiped by the setAnswerValue above — the selection simply did not
      // appear, and the user clicked again. See the `answerReady` gate below.
      setAnswerForId(currentId);
      setValidationError('');
      setShowValidationError(false); // always clear stale inline error when question changes
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]); // only run when the question changes

  // ✅ Pre-fill Stage-1 (Company Profile) inputs from the previous report once
  // the user has moved past the reuse dialog — applies whether they declined
  // reuse (previousProfile stays populated) or no previous profile existed
  // (previousProfile is {available:false}, so unmapPhase1Answer never matches
  // and this is a no-op). Skipped for a question the user already answered
  // (e.g. navigating back), so it never clobbers a real in-progress edit.
  // Declared after the per-question reset above: effects run in order, and
  // before it the reset wiped a prefill that was already loaded (B4).
  useEffect(() => {
    if (!previousProfile?.answers || currentId in answers) return;
    // The reporting year belongs to this inventory — pre-filling the earlier
    // inventory's year made "continue" silently create a second one for it.
    if (currentId === 'A4') return;
    // Employees, locations and revenue belong to a year too: an earlier
    // inventory's (or today's) figure is not this year's answer.
    if (YEAR_SPECIFIC_STEPS.has(currentId)) return;
    const prefilled = unmapPhase1Answer(currentId, previousProfile.answers[currentId]);
    if (prefilled !== undefined) setAnswerValue(prefilled);
  }, [currentId, previousProfile, answers]);

  // Fix #61: Clear stale validationError when the outer dashboard tab makes
  // this component visible again.  QuestionnaireTab is kept alive via CSS
  // hidden (Fix #46) so all state — including a red "Please enter…" banner
  // from a previous Confirm click — persists across tab switches.
  // Because the user may have already corrected the answer before navigating
  // away, `onChange` never fires on re-visit, leaving the error banner showing
  // even though Turkey + İstanbul are both filled.
  // Clearing unconditionally on isVisible=true is safe: if the form is still
  // invalid when the user next clicks Confirm, the error is re-shown then.
  useEffect(() => {
    if (isVisible) { setValidationError(''); setShowValidationError(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  // ── Language switch — re-show current pending question in the new language ──
  // When the user switches language mid-questionnaire, the existing chat bubbles
  // are static strings in the old language. This effect detects the switch and
  // appends a fresh bubble for the currently pending question in the new language,
  // so the user immediately sees what they need to answer without waiting for the
  // next natural question advance.
  //
  // Guards: only fires after questionnaire has started and hasn't completed,
  // and only when the question is actually waiting (not while isTyping).
  const prevLangRef = useRef(language);
  useEffect(() => {
    if (prevLangRef.current === language) return;
    prevLangRef.current = language;
    if (!started || completed || isTyping) return;
    const q = getQuestionById(currentId);
    if (!q) return;
    const newTr = language === 'tr';
    if (loopState && loopState.questionId === currentId) {
      const { currentIndex, items, itemLabels } = loopState;
      const itemLabel = itemLabels[currentIndex] || items[currentIndex] || `#${currentIndex + 1}`;
      const loopText = stripDocLabels(q.text?.[language] || q.text?.en || '');
      const loopHelper = q.helper?.[language] || q.helper?.en || '';
      let content = `**${newTr ? 'Soru' : 'Question'} ${q.number} — ${itemLabel}:** ${loopText}`;
      if (loopHelper) content += `\n\n_${loopHelper}_`;
      setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: 'assistant', content }]);
    } else {
      const questionText = stripDocLabels(q.text?.[language] || q.text?.en || '');
      const helperText = q.helper?.[language] || q.helper?.en || '';
      const isInfo = q.type === 'info';
      let content = isInfo ? questionText : `**${newTr ? 'Soru' : 'Question'} ${q.number}:** ${questionText}`;
      if (helperText) content += `\n\n_${helperText}_`;
      setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: isInfo ? 'info' : 'assistant', content }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]); // only language — not currentId/loopState, those use their own effects

  // ── saveStepToBackend ──────────────────────────────────────────────────────
  const saveStepToBackend = useCallback(async (questionId, value, rid) => {
    const rid_ = rid || reportId;
    if (!rid_) return { success: true, data: {} };
    try {
      const backendData = mapAnswerForBackend(questionId, value);
      const { answered, total } = computeSurveyProgress({ ...answersRef.current, [questionId]: value });
      const res = await api.submitReportStep(rid_, questionId, backendData, lang, { answered, total });

      // Guard: component may have unmounted while the save request was in-flight
      if (!isMounted.current) return { success: false, data: {} };

      // ✅ Parse JSON ONCE
      const respData = await res.json().catch(() => ({}));

      // `success: false` means the answer was NOT stored, whatever the HTTP
      // status (a 200 used to carry it for a duplicate tax ID, and the
      // questionnaire moved on as if it had been saved).
      if (!res.ok || respData?.success === false) {
        setSaveSuccess(false);
        const botMsg = Array.isArray(respData?.bot_messages) && respData.bot_messages[0]
          ? String(respData.bot_messages[0]).replace(/^[❌⚠️\s]+/u, '')
          : '';
        // Every rejected field, not just the first (a bad phone AND website
        // used to show only the phone message).
        const fieldErrors = respData?.errors && typeof respData.errors === 'object' && !Array.isArray(respData.errors)
          ? [...new Set(Object.values(respData.errors).flat().filter(m => typeof m === 'string'))].join(' ')
          : '';
        // A 403 with its own reason (the sign-off's "owner, admin or
        // manager") says it; a bare one gets the generic role message.
        const msg = res.status === 403
          ? (respData?.code ? (respData.error || noPermissionMessage(lang === 'tr')) : noPermissionMessage(lang === 'tr'))
          : (respData?.error || respData?.detail || fieldErrors || botMsg || (lang === 'tr' ? 'Kayıt hatası oluştu. Lütfen tekrar deneyin.' : 'Save failed. Please try again.'));
        if (isMounted.current) setSaveError(msg);
        return { success: false, data: {} };
      }

      // ✅ Save succeeded - clear error
      setSaveError('');
      setSaveSuccess(true);
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = setTimeout(() => {
        if (isMounted.current) setSaveSuccess(false);
      }, 2000);

      // What the answer did to the inventory: the CO₂e it added, and why an
      // amount it gave is not calculated — a missing number used to look
      // like a counted one. Each note is said once.
      const fb = respData?.calc_feedback;
      if (fb) {
        const trL = lang === 'tr';
        const tonnes = (kg) => {
          const t = Math.abs(kg) / 1000;
          return t >= 0.01
            ? `${t.toLocaleString(trL ? 'tr-TR' : 'en-US', { maximumFractionDigits: 2 })} t CO₂e`
            : `${Math.abs(kg).toLocaleString(trL ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 })} kg CO₂e`;
        };
        const parts = [];
        const delta = Number(fb.delta_kg) || 0;
        if (Math.abs(delta) >= 0.05) {
          const sign = delta > 0 ? '+' : '−';
          parts.push(trL
            ? `✓ Envantere yansıdı: **${sign}${tonnes(delta)}** (bu envanterin toplamı ${tonnes(Number(fb.total_kg) || 0)}).`
            : `✓ Added to the inventory: **${sign}${tonnes(delta)}** (inventory total ${tonnes(Number(fb.total_kg) || 0)}).`);
        }
        for (const note of fb.notes || []) {
          if (shownCalcNotesRef.current.has(note)) continue;
          shownCalcNotesRef.current.add(note);
          parts.push(`ℹ️ ${trL ? 'Hesaplanmadı' : 'Not calculated'}: ${note}`);
        }
        if (parts.length) {
          setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: 'assistant', content: parts.join('\n\n') }]);
        }
      }

      return { success: true, data: respData };
    } catch (e) {
      // Log before swallowing. This catch reports every failure as the same
      // "Connection error" — a real network drop, the 30 s request timeout
      // against a cold backend, and a bug in mapAnswerForBackend all look
      // identical to the user, and discarding `e` left nothing to tell them
      // apart from a bug report either.
      console.error(`Failed to save step ${questionId} of report ${rid_}:`, e);
      if (isMounted.current) {
        setSaveSuccess(false);
        const timedOut = e?.name === 'AbortError';
        setSaveError(
          lang === 'tr'
            ? (timedOut
                ? 'Sunucu yanıt vermedi. Lütfen tekrar deneyin.'
                : 'Bağlantı hatası. Lütfen tekrar deneyin.')
            : (timedOut
                ? 'The server did not respond in time. Please try again.'
                : 'Connection error. Please try again.'));
      }
      return { success: false, data: {} };
    }
  }, [reportId, lang]);

  // ── advanceToQuestion ──────────────────────────────────────────────────────
  // Shared helper: navigate to nextId and post its question bubble.
  // Call only from inside a typingTimerRef.current timeout (after setIsTyping(false)).
  const advanceToQuestion = useCallback((nextId) => {
    if (!nextId) {
      setCompleted(true);

      // Fetch completed report
      if (reportId) {
        setReportLoading(true);
        api.getReportStatus(reportId)
          .then(res => res.json())
          .then(data => {
            setCompletedReport(data);
            setReportLoading(false);
          })
          .catch(e => {
            console.error('Failed to fetch report:', e);
            setCompletedReport({ status: 'completed' });
            setReportLoading(false);
          });
      }

      setMessages(prev => {
        const filtered = prev.filter(m => m.type !== 'error');
        questionMsgLenRef.current = filtered.length + 1;
        return [...filtered, {
          id: `m-${++msgIdRef.current}`,
          role: 'assistant',
          type: 'info',
          content: tr
            ? `✅ Tebrikler! Tüm sorular tamamlandı. Raporunuz aşağıda görüntüleniyor.`
            : `✅ Congratulations! All questions completed. Your report is displayed below.`,
        }];
      });
      return;
    }
    const nextQ = getQuestionById(nextId);
    setCurrentId(nextId);
    setAnswerValue(getInitialValue(nextQ));
    setSaveError('');
    const questionText = stripDocLabels(nextQ?.text?.[lang] || nextQ?.text?.en || '');
    const helperText = nextQ?.helper?.[lang] || nextQ?.helper?.en || '';
    // Info screens are transitional — no question number prefix
    const isInfo = nextQ?.type === 'info';
    let content = isInfo
      ? questionText
      : `**${tr ? 'Soru' : 'Question'} ${nextQ?.number}:** ${questionText}`;
    if (helperText) content += `\n\n_${helperText}_`;
    const bubbleType = isInfo ? 'info' : 'assistant';
    setMessages(prev => {
      // Strip stale type:'error' bubbles so old validation errors vanish
      // the moment the user successfully answers a question.
      const filtered = prev.filter(m => m.type !== 'error');
      questionMsgLenRef.current = filtered.length + 1; // capture length AFTER this bubble
      return [...filtered, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: bubbleType, content }];
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
        const loopText   = stripDocLabels(nextQ?.text?.[lang]   || nextQ?.text?.en   || '');
        const loopHelper = nextQ?.helper?.[lang]  || nextQ?.helper?.en || '';
        let content = `**${tr ? 'Soru' : 'Question'} ${nextQ?.number}** _(${firstLabel})_\n\n${loopText}`;
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
      if (conditionalShowMatches(candidate.conditionalShow, currentAnswers)) break;
      nextId = candidate.next || candidate.loopNext || null;
    }
    advanceToQuestion(nextId);
  }, [advanceToQuestion, lang, tr]);

  // ── submitAnswer ───────────────────────────────────────────────────────────
  const submitAnswer = useCallback(async (overrideValue) => {
    const q = getQuestionById(currentId);
    if (!q || isTyping) return;
    if (isSubmittingRef.current) return;
    // answerValue still belongs to the question being left — submitting now
    // would file the outgoing answer against the incoming question. An
    // override (a chip that passes its own value) is safe and exempt.
    if (overrideValue === undefined && answerForIdRef.current !== currentId) return;

    const raw = overrideValue !== undefined ? overrideValue : answerValue;
    const value = normalizeCarbonIQNumbers(q, normalizeAnswerValue(q, raw));

    // Validate — validateCarbonIQAnswer returns {ok, message}; check .ok not truthiness
    if (q.type !== 'info') {
      const err = validateCarbonIQAnswer(q, value, answers, lang);
      if (!err.ok) {
        // Show inline — NOT as a chat bubble so old errors don't confuse users
        // who have already fixed their answer (e.g. country_city after filling both fields).
        setValidationError(err.message || (lang === 'tr' ? 'Geçersiz yanıt.' : 'Invalid answer.'));
        setShowValidationError(true);
        return;
      }
      setValidationError(''); // clear any previous inline error on successful validation
      setShowValidationError(false);
    }

    // ── Loop handling ──────────────────────────────────────────────────────────
    // If we are currently iterating a loop, collect the item answer and either
    // ask the next item or advance past the loop question entirely.
    if (loopState && loopState.questionId === currentId) {
      const { items, itemLabels, currentIndex, collected } = loopState;
      const itemLabel = itemLabels[currentIndex] || items[currentIndex] || `#${currentIndex + 1}`;
      // Each facility needs its own name (the server rejects a repeat too):
      // two facilities called the same can't be told apart anywhere else.
      if (currentId === '2A-2') {
        const nm = String(value?.name || '').trim().toLocaleLowerCase('tr');
        const clash = nm && Object.entries(collected || {}).some(([k, v]) =>
          k !== String(items[currentIndex]) && String(v?.name || '').trim().toLocaleLowerCase('tr') === nm);
        if (clash) {
          setSaveError(tr
            ? `"${String(value.name).trim()}" adını başka bir tesis için zaten kullandınız. Her tesise farklı bir ad verin.`
            : `You already used "${String(value.name).trim()}" for another facility. Give each facility its own name.`);
          return;
        }
      }
      const newCollected = { ...collected, [items[currentIndex]]: value };
      // The per-answer info message (e.g. 3B-2 "operational lease → not
      // Scope 1") — the loop path used to skip these entirely. A generic
      // message is shown once per loop, not once per item.
      const rawLoopSysMsg = getSystemMessage ? getSystemMessage(q, value, lang) : null;
      const loopSysMsgKey = `${currentId}|${rawLoopSysMsg}`;
      const genericMsg = q.systemMessages?.selected;
      const genericText = genericMsg && typeof genericMsg === 'object' ? (genericMsg[lang] || genericMsg.en) : genericMsg;
      const itemSpecificMsg = !!rawLoopSysMsg && rawLoopSysMsg !== genericText;
      let loopSysMsg = null;
      if (rawLoopSysMsg && (itemSpecificMsg || !loopSysMsgShownRef.current.has(loopSysMsgKey))) {
        loopSysMsgShownRef.current.add(loopSysMsgKey);
        loopSysMsg = items.length > 1 && itemSpecificMsg ? `**${itemLabel}:** ${rawLoopSysMsg}` : rawLoopSysMsg;
      }

      // Show user bubble with item context
      const displayVal = getDisplayValue(q, value, lang, { answers });
      const loopBubbleId = `m-${++msgIdRef.current}`;
      if (q.type !== 'info') {
        setMessages(prev => [...prev, {
          id: loopBubbleId,
          role: 'user',
          content: `${itemLabel}: ${displayVal}`,
        }]);
      }
      // A rejected answer must not look accepted: drop its chat bubble so it
      // is not shown as saved (the input keeps the value for correction).
      const dropRejectedBubble = (bubbleId) => setMessages(prev => prev.filter(m => m.id !== bubbleId));

      const nextIndex = currentIndex + 1;

      if (nextIndex < items.length) {
        // More items to ask — stay on same question, advance index
        const nextLabel = itemLabels[nextIndex] || items[nextIndex] || `#${nextIndex + 1}`;

        // Save collected-so-far BEFORE advancing the item index. This used to
        // advance first and then discard saveStepToBackend's result entirely,
        // so a save that failed — a dropped connection, or the 30 s request
        // timeout against a cold backend — moved the loop on to the next item
        // anyway. The user got a red "Connection error" banner while the
        // question advanced underneath it, and the answer for that item was
        // never persisted. Staying put on failure matches what the final-item
        // path and the non-loop path already do, and lets the user retry.
        // The items not reached yet keep their earlier saved answers: the
        // save used to hold only the items answered so far, so leaving an
        // edit half way deleted the rest (a finished inventory lost the
        // other vehicles' answers). Items no longer in the list are dropped.
        const savedAgg = readAnswerValue(answersRef.current, currentId);
        const toSave = {};
        items.forEach(it => {
          const v = it in newCollected ? newCollected[it]
            : (savedAgg && typeof savedAgg === 'object' && !Array.isArray(savedAgg) ? savedAgg[it] : undefined);
          if (v !== undefined) toSave[it] = v;
        });
        markSubmitting(true);
        const loopSave = await saveStepToBackend(currentId, toSave, reportId);
        if (!loopSave.success) {
          dropRejectedBubble(loopBubbleId);
          markSubmitting(false);
          return;
        }

        // Functional updater: spreads the latest state after the async saveStepToBackend
        // await rather than the closure-captured value, guarding against any future
        // concurrent mutation even though isSubmittingRef currently prevents it.
        setLoopState(prev => prev ? { ...prev, currentIndex: nextIndex, collected: newCollected } : null);
        const earlierItemValue = loopItemValue(answersRef.current[currentId], items[nextIndex]);
        const nextItemValue = earlierItemValue !== undefined ? earlierItemValue : facilityPrefill(q, nextIndex);
        setAnswerValue(nextItemValue !== undefined ? localizeStoredAmount(q, normalizeAnswerValue(q, nextItemValue), lang) : getInitialValue(q));

        // Clear the mutex AFTER setIsTyping(true) to eliminate the window where
        // both guards are simultaneously false.
        setIsTyping(true);
        markSubmitting(false);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          typingTimerRef.current = null;
          if (!isMounted.current) return;
          setIsTyping(false);
          if (loopSysMsg) {
            setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: 'info', content: loopSysMsg }]);
          }
          const loopText = stripDocLabels(q?.text?.[lang] || q?.text?.en || '');
          const loopHelper = q?.helper?.[lang] || q?.helper?.en || '';
          let content = `**${tr ? 'Soru' : 'Question'} ${q?.number}** _(${nextLabel})_\n\n${loopText}`;
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
      markSubmitting(true);
      const saveRes = await saveStepToBackend(currentId, newCollected, reportId);

      // Backend rejected the answer (e.g. failed server-side format
      // validation) — stay on this question so the user can fix it, instead
      // of silently advancing past bad data. saveStepToBackend already set
      // saveError for display.
      if (!saveRes.success) {
        // Roll back so the rejected answer is not counted as answered and
        // the loop can be retried from its last item.
        dropRejectedBubble(loopBubbleId);
        setAnswers(answers);
        setHistory(prev => prev.slice(0, -1));
        setLoopState(loopState);
        markSubmitting(false);
        return;
      }

      // ✅ Check if backend says survey is completed
      if (saveRes.success && (saveRes.data?.completed === true || saveRes.data?.next_step === null)) {
        setCompleted(true);
        setMessages(prev => [...prev, {
          id: `m-${++msgIdRef.current}`,
          role: 'assistant',
          type: 'info',
          content: tr
            ? `✅ Tebrikler! Tüm sorular tamamlandı.`
            : `✅ Congratulations! All questions completed.`,
        }]);
        // Fetch report
        if (reportId) {
          setReportLoading(true);
          api.getReportStatus(reportId)
            .then(r => r.json())
            .then(data => { setCompletedReport(data); setReportLoading(false); })
            .catch(e => { console.error('Failed to fetch report:', e); setReportLoading(false); });
        }
        markSubmitting(false);
        return;
      }

      // Use newCollected (the full { item: answer } map) not value (last item only) —
      // warnings and assumptions on loop questions are keyed to the aggregate answer.
      const warning = getQuestionWarning ? getQuestionWarning(q, newCollected, lang) : null;
      const newAssumptions = getTriggeredAssumptions ? getTriggeredAssumptions(q, newCollected) : [];
      if (newAssumptions.length > 0) setAssumptions(prev => [...prev, ...newAssumptions]);

      setIsTyping(true);
      markSubmitting(false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
        if (!isMounted.current) return;
        setIsTyping(false);
        if (warning) {
          setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: 'warning', content: warning }]);
        }
        if (loopSysMsg) {
          setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role: 'assistant', type: 'info', content: loopSysMsg }]);
        }
        // Advance past loop, skipping any conditionalShow-hidden questions.
        // Use candidate.next (not getNextQuestionId) for the skip step — getNextQuestionId
        // with an empty default answer returns null for nextByValue-only questions,
        // which would falsely terminate the questionnaire.
        let nextId = q.loopNext || null;
        while (nextId) {
          const candidate = getQuestionById(nextId);
          if (!candidate?.conditionalShow) break;
          if (conditionalShowMatches(candidate.conditionalShow, finalAnswers)) break;
          nextId = candidate.next || candidate.loopNext || null;
        }
        const loopEditNextId = scope1EditReturn(q, nextId, finalAnswers);
        const loopDirectJump = loopEditNextId !== nextId;
        nextId = loopEditNextId;
        const currLoopBlockId = getBlockId(q);
        const nextLoopBlockId = getBlockId(getQuestionById(nextId));
        if (!loopDirectJump && nextId && nextLoopBlockId && currLoopBlockId && currLoopBlockId !== nextLoopBlockId && blockNeedsSummary(currLoopBlockId, finalAnswers)) {
          setBlockSummaryState({ blockId: currLoopBlockId, stageId: q.stage, nextId });
          setMessages(prev => [...prev, {
            id: `m-${++msgIdRef.current}`,
            role: 'assistant',
            type: 'info',
            content: tr
              ? `Bu bölüm tamamlandı! Yanıtlarınızı aşağıda görebilirsiniz. Düzenlemek istediğiniz varsa **Düzenle** butonunu, devam etmek için **Devam Et** butonunu kullanın.`
              : `This section is complete! Review your answers below. Use **Edit** to change an answer or click **Continue** to proceed.`,
          }]);
        } else {
          initLoopOrAdvance(nextId, finalAnswers);
        }
      }, TYPING_DELAY_MS);
      return;
    }
    // ── End loop handling ──────────────────────────────────────────────────────

    // Add user bubble
    const displayVal = getDisplayValue(q, value, lang, { answers });
    const userBubbleId = `m-${++msgIdRef.current}`;
    if (q.type !== 'info') {
      setMessages(prev => [...prev, { id: userBubbleId, role: 'user', content: displayVal }]);
    }

    // Save answer
    const newAnswers = { ...answers, [currentId]: value };
    setAnswers(newAnswers);
    setHistory(prev => [...prev, { id: currentId, msgLen: questionMsgLenRef.current }]);

    // Save to backend — lock out further submits until save completes;
    // isSubmittingRef is cleared AFTER setIsTyping(true) to avoid the
    // tiny gap where both guards are false simultaneously.
    markSubmitting(true);
    const saveRes = await saveStepToBackend(currentId, value, reportId);

    // Backend rejected the answer (e.g. failed server-side format
    // validation) — stay on this question so the user can fix it, instead
    // of silently advancing past bad data. saveStepToBackend already set
    // saveError for display.
    if (!saveRes.success) {
      // Roll back: a rejected answer is not counted in the progress and its
      // bubble is removed so it does not look accepted.
      setMessages(prev => prev.filter(m => m.id !== userBubbleId));
      setAnswers(answers);
      setHistory(prev => prev.slice(0, -1));
      markSubmitting(false);
      setIsTyping(false);
      return;
    }

    // ✅ If in edit mode, just save and return to review (don't continue survey)
    if (editingQuestionId && saveRes.success) {
      setEditingQuestionId(null);
      markSubmitting(false);
      setIsTyping(false);
      // Stay in completed view - user can re-review table
      return;
    }

    // ✅ Check if backend says survey is completed
    if (saveRes.success && (saveRes.data?.completed === true || saveRes.data?.next_step === null)) {
      setCompleted(true);
      setMessages(prev => [...prev, {
        id: `m-${++msgIdRef.current}`,
        role: 'assistant',
        type: 'info',
        content: tr
          ? `✅ Tebrikler! Tüm sorular tamamlandı.`
          : `✅ Congratulations! All questions completed.`,
      }]);
      // Fetch report
      if (reportId) {
        setReportLoading(true);
        api.getReportStatus(reportId)
          .then(r => r.json())
          .then(data => { setCompletedReport(data); setReportLoading(false); })
          .catch(e => { console.error('Failed to fetch report:', e); setReportLoading(false); });
      }
      markSubmitting(false);
      return;
    }

    // getQuestionWarning takes (question, value, lang); getTriggeredAssumptions takes (question, value)
    // — lang is resolved at render time for assumptions so language switches show correct text.
    const warning = [
      getQuestionWarning ? getQuestionWarning(q, value, lang) : null,
      q.id === 'A4' ? sameYearWarning(value) : null,
      employeeCountWarning(q, value, newAnswers, lang),
      exclusionShareWarning(q, value, newAnswers, lang),
      scope3RowWarning(q, value, newAnswers, lang),
    ].filter(Boolean).join('\n\n') || null;
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
    markSubmitting(false);

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
      //
      // EXCEPTION — section_picker: the user explicitly chose a destination, so we
      // must NOT apply the conditionalShow skip-loop. 3C-0 has conditionalShow for
      // NACE sectors; without this bypass a non-industrial user picking "3C" would
      // be silently redirected to 3D-0 instead of the section they selected.
      let nextId = getNextQuestionId(q, value);
      // Scope 1+2 "combined" grouping (see SCOPE-GROUPING): skip the Scope 2
      // intro screen so the two scopes read as one continuous section instead
      // of being interrupted by a "now starting Scope 2" break.
      if (nextId === '4-GİRİŞ' && readAnswerValue(newAnswers, 'SCOPE-GROUPING') !== 'separate') {
        nextId = getQuestionById('4-GİRİŞ')?.next || nextId;
      }
      if (q.type !== 'section_picker') {
        while (nextId) {
          const candidate = getQuestionById(nextId);
          if (!candidate?.conditionalShow) break;
          if (conditionalShowMatches(candidate.conditionalShow, newAnswers)) break;
          nextId = candidate.next || candidate.loopNext || null;
        }
      }
      const editNextId = scope1EditReturn(q, nextId, newAnswers);
      // Jumping to a chosen section, or back to the Scope 1 summary after
      // editing one, is not the end of a block: no "section complete" table.
      const directJump = q.type === 'section_picker' || editNextId !== nextId;
      nextId = editNextId;

      if (!nextId) {
        // ✅ This branch fires when the client-side traversal (getNextQuestionId)
        // reaches the end without the backend having already signalled
        // completion (the saveRes.data?.completed check a few dozen lines up
        // this same submitAnswer call). Previously this branch set
        // completed=true but never fetched completedReport, and then force-
        // navigated to the Reports tab after 3s regardless — so the user saw
        // an empty/loading CompletionReportCard for a moment and then got
        // yanked to a generic dashboard tab before they could read anything.
        // Now it matches the other two completion paths: fetch the real
        // report and let CompletionReportCard's own buttons drive navigation.
        setCompleted(true);
        setMessages(prev => [...prev, {
          id: `m-${++msgIdRef.current}`,
          role: 'assistant',
          type: 'info',
          content: tr
            ? `Tebrikler! Tüm sorular tamamlandı. Karbon envanteriniz başarıyla oluşturuldu.`
            : `Congratulations! All questions completed. Your carbon inventory has been successfully created.`,
        }]);
        if (reportId) {
          setReportLoading(true);
          api.getReportStatus(reportId)
            .then(r => r.json())
            .then(data => { setCompletedReport(data); setReportLoading(false); })
            .catch(e => { console.error('Failed to fetch report:', e); setCompletedReport({ status: 'completed' }); setReportLoading(false); });
        }
      } else {
        // Show a block-level summary table when crossing a block/stage boundary
        const currBlockId = getBlockId(q);
        const nextQ = getQuestionById(nextId);
        const nextBlockId = getBlockId(nextQ);
        if (!directJump && nextBlockId && currBlockId && currBlockId !== nextBlockId && blockNeedsSummary(currBlockId, newAnswers)) {
          setBlockSummaryState({ blockId: currBlockId, stageId: q.stage, nextId });
          setMessages(prev => [...prev, {
            id: `m-${++msgIdRef.current}`,
            role: 'assistant',
            type: 'info',
            content: tr
              ? `Bu bölüm tamamlandı! Yanıtlarınızı aşağıda görebilirsiniz. Düzenlemek istediğiniz varsa **Düzenle** butonunu, devam etmek için **Devam Et** butonunu kullanın.`
              : `This section is complete! Review your answers below. Use **Edit** to change an answer or click **Continue** to proceed.`,
          }]);
        } else {
          initLoopOrAdvance(nextId, newAnswers);
        }
      }
    }, TYPING_DELAY_MS);
  }, [currentId, answerValue, answers, isTyping, loopState, reportId, lang, tr, saveStepToBackend, initLoopOrAdvance, markSubmitting, sameYearWarning]);

  // After leaving and coming back, this session's `history` is empty, so the
  // back button had nothing to go to. Fall back to the last answered question
  // before the current one in survey order. Loop questions are skipped: their
  // per-item state isn't restorable from the saved answer alone.
  const resumePrevId = useMemo(() => {
    if (history.length > 0 || completed || !currentId) return null;
    const idx = CARBONIQ_QUESTIONS.findIndex(q => q.id === currentId);
    for (let i = idx - 1; i >= 0; i--) {
      const q = CARBONIQ_QUESTIONS[i];
      if (q.type === 'info' || q.loopSource) continue;
      if (q.id in answers) return q.id;
    }
    return null;
  }, [history.length, completed, currentId, answers]);

  // ── goBack ─────────────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (blockSummaryState) { setBlockSummaryState(null); return; }
    if (history.length === 0) {
      if (!resumePrevId) return;
      if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
      markSubmitting(false);
      setIsTyping(false);
      setValidationError('');
      setShowValidationError(false);
      setLoopState(null);
      const prevQ = getQuestionById(resumePrevId);
      setCurrentId(resumePrevId);
      setAnswerValue(normalizeAnswerValue(prevQ, readAnswerValue(answers, resumePrevId)) ?? getInitialValue(prevQ));
      const questionText = stripDocLabels(prevQ?.text?.[lang] || prevQ?.text?.en || '');
      setMessages(prev => {
        questionMsgLenRef.current = prev.length + 1;
        return [...prev, {
          id: `m-${++msgIdRef.current}`,
          role: 'assistant',
          type: 'assistant',
          content: `**${tr ? 'Soru' : 'Question'} ${prevQ?.number}:** ${questionText}\n\n_${tr ? 'Önceki yanıtınız aşağıda; değiştirip kaydedebilirsiniz.' : 'Your previous answer is below; change it and save.'}_`,
        }];
      });
      return;
    }
    // Cancel any in-flight typing timer so its callback can't post stale bubbles
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    markSubmitting(false);
    setIsTyping(false);
    setValidationError('');
    setShowValidationError(false);

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
      const hadWarning = getQuestionWarning && getQuestionWarning(prevQ, readAnswerValue(answers, prevId), lang);
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
      setAnswerValue(normalizeAnswerValue(prevQ, readAnswerValue(answers, prevId)) ?? getInitialValue(prevQ));
    }
  }, [history, answers, lang, tr, blockSummaryState, markSubmitting, resumePrevId]);

  // ── jumpToQuestion ─────────────────────────────────────────────────────────
  // Called when the user clicks "Edit" in a BlockSummaryTable row.
  // Enter edit mode WITHOUT hiding the block summary — user stays in review UI.
  const jumpToQuestion = useCallback((qId) => {
    const histIdx = history.findIndex(h => (typeof h === 'object' ? h.id : h) === qId);
    if (histIdx === -1) return;
    const entry = history[histIdx];
    const msgLen = typeof entry === 'object' ? entry.msgLen : null;

    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    markSubmitting(false);
    setIsTyping(false);
    // ✅ KEEP blockSummaryState — don't disappear the review table!
    setHistory(history.slice(0, histIdx));
    setCurrentId(qId);
    setEditingQuestionId(qId);
    const q = getQuestionById(qId);
    if (!q?.loopSource) setLoopState(null);
    setValidationError('');
    setShowValidationError(false);

    if (msgLen != null) {
      setMessages(prev => prev.slice(0, msgLen));
      questionMsgLenRef.current = msgLen;
    }
    const prevQ = getQuestionById(qId);
    setAnswerValue(normalizeAnswerValue(prevQ, readAnswerValue(answers, qId)) ?? getInitialValue(prevQ));
  }, [history, answers, markSubmitting]);

  // ── finishEditing ──────────────────────────────────────────────────────────
  // A finished inventory being corrected: back to the sign-off check (7C-1)
  // instead of confirming every later, already answered question again.
  const finishEditing = useCallback(() => {
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    markSubmitting(false);
    setIsTyping(false);
    setBlockSummaryState(null);
    setLoopState(null);
    setEditingQuestionId(null);
    setValidationError('');
    setShowValidationError(false);
    advanceToQuestion('7C-1');
  }, [advanceToQuestion, markSubmitting]);

  // ── proceedFromSummary ─────────────────────────────────────────────────────
  const proceedFromSummary = useCallback(() => {
    if (!blockSummaryState) return;
    const { nextId } = blockSummaryState;
    setBlockSummaryState(null);
    setIsTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
      if (!isMounted.current) return;
      setIsTyping(false);
      initLoopOrAdvance(nextId, answers);
    }, TYPING_DELAY_MS);
  }, [blockSummaryState, answers, initLoopOrAdvance]);

  // ── resetFlow ──────────────────────────────────────────────────────────────
  const resetFlow = useCallback(async () => {
    // Cancel any in-flight typing animation so it can't post stale bubbles
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    if (saveSuccessTimerRef.current) { clearTimeout(saveSuccessTimerRef.current); saveSuccessTimerRef.current = null; }
    markSubmitting(false);

    // Clear this inventory's answers only. (The old /reset/ call marked every
    // in-progress inventory of the company "completed" — a half-filled one
    // then showed up as a finished report.)
    if (reportId) {
      try {
        const res = await api.restartReport(reportId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        console.warn('Restart failed:', e);
        setSaveError(tr ? 'Envanter sıfırlanamadı. Lütfen tekrar deneyin.' : 'Could not reset the inventory. Please try again.');
        setResetConfirm(false);
        markSubmitting(false);
        return;
      }
    }

    const initId = getInitialQuestionId();
    setCurrentId(initId);
    setAnswers({});
    setHistory([]);
    setCompleted(false);
    setAssumptions([]);
    setSaveSuccess(false);
    setSaveError('');
    setValidationError('');
    setShowValidationError(false);
    setLoopState(null);
    setBlockSummaryState(null);
    setIsTyping(false);
    setResetConfirm(false);
    setReportId(null);
    setMessages([]);
    setCompletedReport(null);
    questionMsgLenRef.current = 0;
    setAnswerValue(getInitialValue(getQuestionById(initId)));
    setStarted(false);
    // ✅ Hand control back to InventoryWorkflow — it owns picking/naming the
    // next inventory now. Unmounts this component before the started=false
    // update above could ever paint the (now-removed) internal picker.
    onExitToLibrary?.();
  }, [onExitToLibrary, markSubmitting, reportId, tr]);

  // ── Render ─────────────────────────────────────────────────────────────────
  // This component is only ever mounted hydrated (with started=true from the
  // first render) — QuestionnaireTabInner routes through InventoryLibrary for
  // picking/naming an inventory before this ever renders. !started should not
  // happen in practice (resetFlow() below calls onExitToLibrary(), which
  // unmounts this component via the parent's mode switch before a re-render
  // with started=false could ever paint) — this is just a defensive fallback.
  if (!started) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#175022]/30" />
      </div>
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
        completed={completed}
      />

      {/* Main area */}
      {/* min-h-0 is required here — without it this flex column can't shrink
          below its content height, so the chat messages div's flex-1
          overflow-y-auto below never actually engages: instead of scrolling,
          older messages just get clipped by the parent's overflow-hidden as
          the conversation grows past the visible area. */}
      <div className="flex flex-1 min-w-0 min-h-0 flex-col">
        {/* Sub-header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[#175022]/6 px-4 py-2">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#175022]/40 hover:bg-[#175022]/6 hover:text-[#175022] transition"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            {currentQuestion && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#175022]/40">
                  {tr ? 'Soru' : 'Q'} {currentQuestion.number}
                </span>
                {currentQuestion.isoRef && (
                  <span className="rounded-full bg-[#8BEA99]/15 px-2 py-0.5 text-[9px] font-bold text-[#175022]">
                    {currentQuestion.isoRef}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {inventoryCompleted && !completed && (currentQuestion?.stage ?? 7) < 7 && (
              <button
                onClick={finishEditing}
                className="flex h-7 items-center gap-1 rounded-full bg-[#175022] px-2.5 text-[11px] font-bold text-white hover:bg-[#1A7B2A] transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tr ? 'Düzenlemeyi bitir' : 'Finish editing'}</span>
                <span className="sm:hidden">{tr ? 'Bitir' : 'Finish'}</span>
              </button>
            )}
            {(history.length > 0 || resumePrevId) && !completed && (
              <button
                onClick={goBack}
                aria-label={tr ? 'Önceki soruya dön' : 'Go back to previous question'}
                className="flex h-7 items-center gap-1 rounded-full border border-[#175022]/15 bg-white px-2.5 text-[11px] font-bold text-[#175022]/70 hover:bg-[#175022]/6 hover:text-[#175022] transition"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {tr ? 'Önceki soru' : 'Previous question'}
              </button>
            )}
            {resetConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-red-500">{tr ? 'Emin misiniz?' : 'Sure?'}</span>
                <button
                  onClick={() => { setResetConfirm(false); resetFlow(); }}
                  className="rounded-full bg-red-500 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-red-600"
                >
                  {tr ? 'Evet' : 'Yes'}
                </button>
                <button
                  onClick={() => setResetConfirm(false)}
                  className="rounded-full border border-[#175022]/15 px-2 py-1 text-[10px] font-bold text-[#175022]/50 transition hover:bg-[#175022]/5"
                >
                  {tr ? 'Hayır' : 'No'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setResetConfirm(true)}
                title={tr ? 'Sıfırla' : 'Reset'}
                aria-label={tr ? 'Envanteri sıfırla' : 'Reset inventory'}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#175022]/40 hover:bg-[#175022]/6 hover:text-[#175022] transition"
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
            {/* Scope 1 summary table — shown inline when TY-1 (Q63) is current.
                Rendered as a live component so it always reflects the latest answers
                and switches language instantly without needing a re-ask. */}
            {currentQuestion?.showSummaryTable && !isTyping && !completed && (
              currentQuestion.showSummaryTable === 'scope2'
                ? <Scope2SummaryTable answers={answers} lang={lang} tr={tr} />
                : currentQuestion.showSummaryTable === 'scope3'
                  ? <Scope3SummaryTable answers={answers} lang={lang} tr={tr} />
                  : <Scope1SummaryTable answers={answers} lang={lang} tr={tr} />
            )}
            {/* Block summary table — shown at block/stage transitions for review & edit */}
            {blockSummaryState && !isTyping && (
              <BlockSummaryTable
                blockId={blockSummaryState.blockId}
                stageId={blockSummaryState.stageId}
                questions={getBlockAnsweredQuestions(blockSummaryState.blockId, answers)}
                answers={answers}
                lang={lang}
                onEdit={jumpToQuestion}
                onContinue={proceedFromSummary}
              />
            )}
            {isTyping && (
              <div className="flex gap-3">
                <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-[#2ABD41] flex items-center justify-center shadow-sm">
                  <span className="block h-2 w-2 rounded-full bg-white/80" />
                </div>
                <div className="py-1">
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
              <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                {tr ? 'Kaydedildi' : 'Saved'}
              </div>
            )}
            {saveError && (
              <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                <span>{saveError}</span>
              </div>
            )}
          </div>

          {/* Completion Report Card */}
          {completed && (
            <div className="mt-6">
              <CompletionReportCard
                report={completedReport}
                loading={reportLoading}
                tr={tr}
                stageBreakdown={completionStageBreakdown}
                assumptions={assumptions}
                onStartNew={() => onExitToLibrary?.()}
                onViewFull={() => {
                  window.dispatchEvent(new CustomEvent('carboniq-navigate', { detail: { tab: 'reporting', year: parseInt(answers.A4, 10) || undefined } }));
                }}
              />
            </div>
          )}
        </div>

        {/* Input bar — shown if no block summary OR in edit mode (editingQuestionId set) */}
        {/* Scrolls once it outgrows the space left for it. This used to be a
            plain shrink-0 block with no height cap and no overflow, which is
            fine for a text field or a few chips but not for a question like
            Q39 (~30 equipment options): the chips wrap into more rows than the
            window has room for, and because the block can neither shrink nor
            scroll, the "Confirm" button below them is pushed off-screen with
            no way to reach it — the questionnaire simply cannot be advanced.
            min-h-0 is what actually lets a flex child shrink below its content
            height; without it overflow-y-auto here would never engage. */}
        {!completed && (!blockSummaryState || editingQuestionId) && (
          <div className="min-h-0 shrink overflow-y-auto border-t border-[#175022]/6 px-4 py-3 sm:px-6">
            <div className="mx-auto w-full max-w-2xl">
              <div className="flex flex-col gap-2">
                <AnswerInput
                  question={currentQuestion}
                  value={answerValue}
                  onChange={v => { setAnswerValue(v); setValidationError(''); setShowValidationError(false); }}
                  onSubmit={submitAnswer}
                  lang={lang}
                  answers={answers}
                  disabled={isTyping || submitting || answerForId !== currentId}
                  currentLoopItem={
                    loopState && loopState.questionId === currentId
                      ? loopState.items[loopState.currentIndex]
                      : undefined
                  }
                />
                {/* The facilities registered today are only a reference for B4:
                    an inventory for an earlier year may have had a different
                    number, so the count is shown, never filled in. */}
                {/* 2A-1: the copied count may be last year's — show what is
                    registered now and what the earlier inventory had, so a
                    facility is not dropped unnoticed. Shown, never filled in. */}
                {currentId === '2A-1' && (facilitySources.registered.length > 0 || facilitySources.previous.length > 0) && (
                  <p className="text-xs text-[#175022]/60">
                    {tr
                      ? `Şu an kayıtlı ${facilitySources.registered.length} tesisiniz var${facilitySources.previous.length ? `; önceki envanterinizde ${facilitySources.previous.length} tesis girmiştiniz` : ''}. Bu envanterin yılı için sayı farklıysa düzeltin.`
                      : `You have ${facilitySources.registered.length} registered ${facilitySources.registered.length === 1 ? 'facility' : 'facilities'}${facilitySources.previous.length ? `; your earlier inventory listed ${facilitySources.previous.length}` : ''}. If the number differs for this inventory's year, correct it.`}
                  </p>
                )}
                {/* Annual amounts: say which year they are for. */}
                {['3A-5', '3B-7', '4A-1', '4B-2', 'K3C1-2', 'K3C1-3a'].includes(currentId) && /^\d{4}$/.test(String(readAnswerValue(answers, 'A4') || '').trim()) && (
                  <p className="text-xs text-[#175022]/60">
                    {tr
                      ? `Bu envanter ${String(readAnswerValue(answers, 'A4')).trim()} yılı içindir — 1 Ocak – 31 Aralık ${String(readAnswerValue(answers, 'A4')).trim()} toplamını girin.`
                      : `This inventory is for ${String(readAnswerValue(answers, 'A4')).trim()} — enter the total for 1 January – 31 December ${String(readAnswerValue(answers, 'A4')).trim()}.`}
                  </p>
                )}
                {/* 4A-1: the reminder 3B-5 promises for electric vehicles. */}
                {currentId === '4A-1' && !(loopState?.questionId === '4A-1' && loopState.currentIndex > 0) && (() => {
                  const fuels = readAnswerValue(answers, '3B-5');
                  const evs = fuels && typeof fuels === 'object'
                    ? Object.entries(fuels).filter(([, f]) => f === 'electric' || f === 'hybrid').map(([k]) => k) : [];
                  if (!evs.length) return null;
                  const vq = getQuestionById('3B-1');
                  const names = evs.map(k => loopItemLabel(vq, k, Object.keys(fuels), lang));
                  return (
                    <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
                      {tr
                        ? `Hatırlatma: Soru 53'te elektrikli / hibrit araç belirttiniz (${names.join(', ')}). Tesislerinizde şarj ediliyorsa bu şarj elektriğinin burada girdiğiniz tüketime dahil olduğundan emin olun.`
                        : `Reminder: in Question 53 you listed electric / hybrid vehicles (${names.join(', ')}). If they are charged at your facilities, make sure that charging electricity is included in the consumption you enter here.`}
                    </p>
                  );
                })()}
                {/* Supplier EF forms: the unit does not fit the consumption entered. */}
                {EF_SOURCE_STEP[currentId] && (() => {
                  const units = efUnitMismatch(currentId, answerValue?.ef_unit, answers);
                  if (!units) return null;
                  const opt = (currentQuestion?.fields || []).find(f => f.id === 'ef_unit')?.options?.find(o => o.value === answerValue.ef_unit);
                  const efLabel = opt ? (opt.label?.[lang] || opt.label?.en) : answerValue.ef_unit;
                  return (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      {tr
                        ? `Seçtiğiniz birim (${efLabel}) tüketimi girdiğiniz birimle (${units.join(', ')}) uyuşmuyor. Belgedeki birimi kontrol edin.`
                        : `The unit you chose (${efLabel}) does not match the unit you entered consumption in (${units.join(', ')}). Check the unit on the document.`}
                    </p>
                  );
                })()}
                {/* 6A-1: what Stage 2 already put outside the boundary. */}
                {currentId === '6A-1' && stage2ExclusionRows(answers).length > 0 && (
                  <p className="text-xs text-[#175022]/60">
                    {tr
                      ? `Soru 28a'da işletme kontrolü dışında belirttiğiniz tesisler: ${stage2ExclusionRows(answers).map(r => r.source).join(', ')}. "Evet" derseniz ${stage2ExclusionRows(answers).length > 1 ? 'ilki forma dolu gelir; diğerlerini "+ Başka Ekle" ile ekleyin' : 'hariç tutma formuna dolu gelir'}.`
                      : `In Question 28a you marked these sites as outside operational control: ${stage2ExclusionRows(answers).map(r => r.source).join(', ')}. Answer "Yes" and the first comes pre-filled in the exclusion form${stage2ExclusionRows(answers).length > 1 ? '; add the others with "+ Add Another"' : ''}.`}
                  </p>
                )}
                {currentId === '7C-2' && !canSign && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    {tr
                      ? 'İmza adımını şirket sahibi, yönetici veya müdür tamamlayabilir. Envanter hazır; onlardan bu adımı imzalamalarını isteyin.'
                      : 'Only the company owner, an admin or a manager can complete the sign-off. The inventory is ready; ask one of them to sign this step.'}
                  </p>
                )}
                {currentId === '6B-OV' && recordedAssumptions?.length > 0 && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    <p className="font-semibold">
                      {tr
                        ? 'Cevaplarınızdan raporun "Kabuller" bölümüne kendiliğinden eklenecek kabuller:'
                        : 'Assumptions your answers already add to the report\'s "Assumptions" section:'}
                    </p>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {recordedAssumptions.map((a, i) => <li key={i}>{a.text}</li>)}
                    </ul>
                    <p className="mt-1">
                      {tr
                        ? 'Bunları tekrar girmenize gerek yok. Başka bir varsayımınız yoksa "Hayır" seçebilirsiniz.'
                        : 'No need to enter these again. If you have no other assumptions, you can choose "No".'}
                    </p>
                  </div>
                )}
                {/* 6C-1: own factors the user already gave earlier. */}
                {currentId === '6C-1' && (() => {
                  const own = [
                    ['3A-EF', tr ? 'Soru 47 — sabit yanma tedarikçi faktörü' : 'Q47 — stationary combustion supplier factor'],
                    ['3B-EF', tr ? 'Soru 55 — araç tedarikçi faktörü' : 'Q55 — vehicle supplier factor'],
                    ['4A-EF', tr ? 'Soru 76 — elektrik tedarikçi beyanı' : 'Q76 — electricity supplier declaration'],
                    ['4B-EF', tr ? 'Soru 79 — ısı/buhar tedarikçi beyanı' : 'Q79 — heat/steam supplier declaration'],
                  ].filter(([id]) => readAnswerValue(answers, id) === 'yes').map(([, l]) => l);
                  if (readAnswerValue(answers, 'K3C3-INFO') === 'custom') own.push(tr ? 'Soru 88a — kendi WTT / T&D faktörünüz' : 'Q88a — your own WTT / T&D factor');
                  if (!own.length) return null;
                  return (
                    <p className="text-xs text-[#175022]/60">
                      {tr
                        ? `Önceki cevaplarınızda kendi emisyon faktörlerinizi girdiniz: ${own.join('; ')}. Bunlar standart faktör yerine kullanıldıysa "farklı emisyon faktörü" seçeneği uygun olabilir.`
                        : `Earlier you entered your own emission factors: ${own.join('; ')}. If they replace the standard factors, the "different emission factor" option may apply.`}
                    </p>
                  );
                })()}
                {/* 3A-2: a site the user put outside operational control in 28a. */}
                {currentId === '3A-2' && answerValue?.site && noControlSites(answers).includes(String(answerValue.site).trim().toLocaleLowerCase('tr-TR')) && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    {tr
                      ? `"${String(answerValue.site).trim()}" tesisini Soru 28a'da işletme kontrolünüz dışında olarak belirttiniz. Doğruysa devam edin — sonraki soruda bu ekipman için "Hayır" seçili gelecek.`
                      : `You marked "${String(answerValue.site).trim()}" as outside your operational control in Question 28a. If that is right, continue — the next question will start on "No" for this equipment.`}
                  </p>
                )}
                {/* 3A-1/3B-1/3C-1/3D-0: what the earlier inventory listed, as a
                    reminder only — nothing is pre-selected for a new year. */}
                {PREVIOUS_SELECTION_STEPS.includes(currentId) && currentQuestion && (facilitySources.selections[currentId] || []).length > 0 && (() => {
                  const labels = facilitySources.selections[currentId].map(v => {
                    const opt = (currentQuestion.options || []).find(o => o.value === v);
                    return opt ? stripOptionCode(opt.label?.[lang] || opt.label?.en || v) : v;
                  });
                  const yr = facilitySources.previousYear;
                  return (
                    <p className="text-xs text-[#175022]/60">
                      {tr
                        ? `Önceki envanterinizde${yr ? ` (${yr})` : ''} seçtikleriniz: ${labels.join(', ')}. Bu yıl da varsa yeniden seçin.`
                        : `Your earlier inventory${yr ? ` (${yr})` : ''} listed: ${labels.join(', ')}. Select them again if they still apply this year.`}
                    </p>
                  );
                })()}
                {currentId === 'B4' && previousProfile?.facility_count > 0 && (() => {
                  const n = previousProfile.facility_count;
                  const year = readAnswerValue(answers, 'A4');
                  return (
                    <p className="text-xs text-[#175022]/60">
                      {tr
                        ? `Şu an kayıtlı ${n} tesisiniz var.${year ? ` ${year} yılında sayı farklıysa o yılın sayısını girin.` : ''}`
                        : `You currently have ${n} registered ${n === 1 ? 'facility' : 'facilities'}.${year ? ` If the number was different in ${year}, enter that year's count.` : ''}`}
                    </p>
                  );
                })()}
                {/* Inline validation error — only shows after a failed Confirm attempt
                    AND while the current answer is still actually invalid.
                    showValidationError resets when answerValue changes or question/tab switches,
                    so the error disappears as soon as the user fills the field correctly. */}
                {showValidationError && validationError && currentQuestion && !validateCarbonIQAnswer(currentQuestion, answerValue, answers, lang).ok && (
                  <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                    <span>{validationError}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-[#175022]/25">
                    {tr ? 'Verileriniz güvenli şekilde kaydedilir.' : 'Your data is saved securely.'}
                  </p>
                  <button
                    onClick={() => {
                      // The site's AI assistant (chat history, calculations)
                      // opens beside the survey with this question as context.
                      const qText = stripDocLabels(currentQuestion?.text?.[lang] || currentQuestion?.text?.en || '');
                      const prefill = currentQuestion
                        ? (tr ? `Soru ${currentQuestion.number} hakkında: "${qText}" — ` : `About question ${currentQuestion.number}: "${qText}" — `)
                        : '';
                      window.dispatchEvent(new CustomEvent('carbonless:assistant', { detail: { open: true, prefill } }));
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-[#175022]/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#175022]/55 shadow-sm transition hover:border-[#8BEA99]/40 hover:bg-[#8BEA99]/5 hover:text-[#175022]"
                  >
                    <HelpCircle className="h-3 w-3" />
                    {tr ? 'AI Yardımı' : 'Ask AI Help'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reuse previous Company Profile? — shown once, on a genuinely fresh
          report, when this company already has one from an earlier report. */}
      <ConfirmDialog
        open={showReuseDialog && !reuseLoading}
        onConfirm={handleConfirmReuseProfile}
        onCancel={handleDeclineReuseProfile}
        title={tr ? 'Önceki şirket profilini kullanalım mı?' : 'Reuse your previous company profile?'}
        message={
          previousProfile?.reporting_year
            ? (tr
                ? `${previousProfile.reporting_year} raporlama yılı için kaydettiğiniz şirket bilgileri (unvan, sektör, sınır yaklaşımı vb.) bu raporda da aynı mı? Aynıysa bu ~20 soruyu atlayıp doğrudan devam edebilirsiniz.`
                : `Is the company info you saved for reporting year ${previousProfile.reporting_year} (legal name, sector, boundary approach, etc.) still the same for this report? If so, we can skip these ~20 questions and jump straight ahead.`)
            : (tr
                ? 'Daha önce kaydettiğiniz şirket bilgileri bu raporda da aynı mı? Aynıysa bu ~20 soruyu atlayıp doğrudan devam edebilirsiniz.'
                : 'Is the company info you saved before still the same for this report? If so, we can skip these ~20 questions and jump straight ahead.')
        }
        confirmText={tr ? 'Evet, aynı — atla' : 'Yes, same — skip'}
        cancelText={tr ? 'Hayır, tekrar gireyim' : 'No, let me re-enter'}
        type="warning"
      >
        <div className="mt-4 text-left">
          <label htmlFor="reuse-year" className="block text-xs font-bold text-[#072C0E]">
            {tr ? 'Bu envanterin raporlama yılı' : 'Reporting year of this inventory'}
          </label>
          <select
            id="reuse-year"
            value={reuseYear}
            onChange={(e) => setReuseYear(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#072C0E]/15 bg-white px-3 py-2 text-sm text-[#072C0E]"
          >
            {(getQuestionById('A4')?.options || []).map(o => (
              <option key={o.value} value={o.value}>{o.label?.[lang] || o.value}</option>
            ))}
          </select>
          {sameYearWarning(reuseYear) && (
            <p role="alert" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {sameYearWarning(reuseYear)}
            </p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Free Chat Tab
// ─────────────────────────────────────────────────────────────────────────────
function FreeChatTab({ language, summary, entries, targets, fetchData, compact = false, prefill = null }) {
  // Local language toggle — EN / TR, initialized from app-level language prop.
  // This component mounts once and stays mounted (chatMounted never flips
  // back to false), so without the effect below this initial value would be
  // permanently frozen — if the site-wide language changed after first mount
  // (or hadn't finished resolving from localStorage yet when this captured
  // its initial value), the AI chat would keep responding in the stale
  // language forever regardless of what the header's EN/TR toggle showed.
  // Re-syncing on every `language` prop change fixes that while still
  // letting the user manually override via the chat's own EN/TR buttons —
  // that override just holds until the site-wide language changes again.
  const [activeLang, setActiveLang] = useState(language || 'en');
  useEffect(() => { setActiveLang(language || 'en'); }, [language]);
  const tr = activeLang === 'tr';
  // A read-only role (auditor) sees the calculation but not the save card,
  // which the server would refuse.
  const [canEdit, setCanEdit] = useState(true);
  useEffect(() => {
    api.getProfile()
      .then(res => (res.ok ? res.json() : null))
      .then(profile => { if (profile) setCanEdit(getPermissions(profile).canEdit); })
      .catch(() => {});
  }, []);
  const totalTonne = summary?.total_tonne || 0;
  const s1 = summary?.scope1_tonne || 0;
  const s2 = summary?.scope2_tonne || 0;
  const s3 = summary?.scope3_tonne || 0;

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
  // Prevents double-click duplicates on save button
  const [savingMessageId, setSavingMessageId] = useState(null);
  // Period overrides for pending entries whose date wasn't extracted from the
  // chat message — keyed by `${msg.id}-${idx}`, value { month, year }. The
  // backend silently defaults to the current month when it doesn't know the
  // real date, so the confirm card must let the user correct it before save.
  const [periodOverrides, setPeriodOverrides] = useState({});
  // Mirrors creatingSessionRef so the "New Chat" buttons can be disabled while
  // the createChatSession request is in-flight (refs don't trigger re-renders).
  const [creatingSession, setCreatingSession] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);

  const handleDownloadAttachment = useCallback(async (msg) => {
    if (downloadingAttachmentId) return;
    setDownloadingAttachmentId(msg.id);
    try {
      const res = await api.downloadChatAttachment(msg.id);
      if (!res.ok) {
        setError(tr ? 'Dosya indirilemedi.' : 'Could not download the file.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = msg.attachment_name || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError(tr ? 'Bağlantı hatası.' : 'Connection error.');
    } finally {
      setDownloadingAttachmentId(null);
    }
  }, [downloadingAttachmentId, tr]);

  useEffect(() => {
    // In the side panel the history stays behind its button (it would cover the chat).
    if (!compact && typeof window !== 'undefined' && window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  // Ref mirror of tr — lets the session-load effect read the current language
  // without being in its dependency array (which would re-trigger the fetch on
  // every language switch even though sessions are language-independent).
  const trRef = useRef(activeLang === 'tr');
  useEffect(() => { trRef.current = activeLang === 'tr'; }, [activeLang]);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  // Stable message-key counter — avoids Date.now() collisions
  const msgIdRef = useRef(0);
  // Ref mirror of `input` — lets sendMessage read the current value without
  // adding `input` to its dep array (which would cause it to be recreated on
  // every keystroke, cascading to startNew and handleKeyDown).
  const inputValueRef = useRef('');
  // "AI Yardımı" on a survey question opens the assistant with that
  // question as the start of the message (prefill = { text, key }).
  useEffect(() => {
    if (!prefill?.text) return;
    setInput(prefill.text);
    inputValueRef.current = prefill.text;
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [prefill?.key]); // eslint-disable-line react-hooks/exhaustive-deps
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
  //
  // ✅ Skip entirely when there's no active session (EmptyState is showing).
  // This effect used to fire on every mount regardless of activeId, scrolling
  // straight past the "Hi, there" greeting on first open and forcing the user
  // to scroll back up to see the welcome screen. EmptyState centres itself in
  // the available height, so there is nothing to scroll to in that state.
  useEffect(() => {
    if (!activeId) return;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      if (!isMountedRef.current || !scrollRef.current) return;
      // Smooth scrolling is skipped outright while the document is hidden, so a
      // reply that lands in a backgrounded tab left the chat parked at the top:
      // the scrollTo ran, reported no error, and moved nothing. Animate only
      // when the page is actually visible and jump instantly otherwise, so the
      // newest message is always in view on return.
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: document.visibilityState === 'visible' ? 'smooth' : 'auto',
      });
    }, 50);
    return () => { if (scrollTimerRef.current) { clearTimeout(scrollTimerRef.current); scrollTimerRef.current = null; } };
  }, [messages, sending, activeId]);

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
  const sendMessage = useCallback(async (text, sid, displayOverride) => {
    // Read input from the ref mirror rather than from closure so that `input`
    // does not need to be in the dep array — if it were, sendMessage (and
    // everything that depends on it: startNew, handleKeyDown) would be
    // recreated on every keystroke, causing unnecessary re-renders.
    const content = (text || inputValueRef.current).trim();
    const sessionId = sid || activeId;
    // Fix #101: use sendingRef (synchronous, same-tick) instead of `sending` state
    // so the guard fires immediately without waiting for a re-render.
    if (!content || !sessionId || sendingRef.current) return;

    // Only clear input if no override text was passed (quick reply buttons pass text directly)
    if (!text) {
      setInput('');
      inputValueRef.current = '';
    }
    sendingRef.current = true;
    setSending(true);
    setError('');
    // displayOverride lets quick-reply buttons show a user-friendly label in
    // the chat bubble while still sending the raw value to the backend.
    const displayContent = displayOverride || content;
    setMessages(prev => [...prev, {
      id: `m-${++msgIdRef.current}`, role: 'user', content: displayContent,
    }]);

    try {
      // trRef mirrors the chat's own EN/TR toggle (independent of the outer app
      // language) — send it so the backend replies in the language actually
      // selected in this chat, instead of guessing from the message text alone.
      const currentLang = trRef.current ? 'tr' : 'en';
      const res = await api.sendChatMessage(sessionId, content, currentLang);
      if (!isMountedRef.current) return;
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (isMountedRef.current) setError(d.error || (trRef.current ? 'Bir hata oluştu.' : 'Something went wrong.'));
      } else {
        const aiMsg = await res.json();
        if (!isMountedRef.current) return;
        setMessages(prev => [...prev, { id: aiMsg.id ?? `m-${++msgIdRef.current}`, ...aiMsg }]);
        // The chat can save real emission entries in the background (see the
        // ```emission_entry block the backend parses out of the AI reply).
        // Without this, the Dashboard tab keeps showing pre-chat totals until
        // a full page reload, because its data was only fetched once on mount.
        if (aiMsg.saved_entries?.length > 0) {
          fetchData?.();
        }
        if (aiMsg.session_title) {
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
      sendingRef.current = false;
      if (isMountedRef.current) {
        setSending(false);
        inputRef.current?.focus();
      }
    }
  }, [activeId, fetchData]);

  const startNew = useCallback(async (initialPrompt = '') => {
    // ── Calculate button: show local guide instead of calling the API ──
    const calcTriggers = [
      'calculate my emission factors', 'emisyon faktörlerini hesapla',
      'calculate my emissions', 'calculate emissions', 'hesapla',
    ];
    if (initialPrompt && calcTriggers.includes(initialPrompt.trim().toLowerCase())) {
      const guideContent = trRef.current
        ? 'Hesaplama için miktar, birim ve aktivite girin.\n\nÖrnek:\n• 18000 kWh electricity\n• 5000 m3 natural gas\n• 200 liters diesel\n• 4000 km road travel'
        : 'To calculate emissions, enter amount, unit, and activity.\n\nExamples:\n• 18000 kWh electricity\n• 5000 m3 natural gas\n• 200 liters diesel\n• 4000 km road travel';
      // Create session without sending to AI
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
        setError('');
        setMessages([{ id: `guide-${session.id}`, role: 'assistant', content: guideContent }]);
      } catch {
        if (isMountedRef.current) setError(trRef.current ? 'Bağlantı hatası.' : 'Connection error.');
      } finally {
        creatingSessionRef.current = false;
        if (isMountedRef.current) setCreatingSession(false);
      }
      return;
    }

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
      setError('');
      if (initialPrompt) {
        setMessages([]);
        // startNew's only 3 call sites all pass either the textarea's own
        // current value or nothing — never canned/foreign text — so it's
        // always safe to clear the input here. Without this, the first
        // message of a brand-new chat sent the text (visible in the reply)
        // but left it sitting in the textbox, because sendMessage() below
        // only clears input for its *own* no-arg calls, not when it's
        // handed text explicitly (that branch exists so quick-reply clicks
        // don't wipe an unrelated draft the user was mid-typing).
        setInput('');
        inputValueRef.current = '';
        // Tiny delay lets React flush the state above (activeId, messages) before
        // sendMessage reads them. sendMessage is stable (no input dep), so it is
        // safe to omit from this dep array.
        setTimeout(() => { if (isMountedRef.current) sendMessage(initialPrompt, session.id); }, CHIP_AUTO_SUBMIT_DELAY_MS);
      } else {
        // Inject a local welcome greeting — shown immediately, not persisted to API.
        const welcome = trRef.current
          ? `Merhaba! Ben **CarbonIQ** — karbon hesaplama asistanınızım.\n\nBana verilerinizi söyleyin, ben hesaplayayım. Örneğin:\n\n• "14.000 kWh elektrik kullandık"\n• "500 litre dizel yakıt yaktık"\n• "5000 km araç kullandık"\n• "2 ton atığı çöpe gönderdik"\n• "İstanbul-Ankara uçtuk"\n\nSadece miktarı ve türü yazın, gerisini ben halledeyim! 🌱`
          : `Hello! I'm **CarbonIQ** — your carbon calculator assistant.\n\nTell me your activity data and I'll calculate the emissions. For example:\n\n• "We used 14,000 kWh of electricity"\n• "Our vehicles drove 5,000 km"\n• "We burned 500 liters of diesel"\n• "2 tonnes of waste to landfill"\n• "Flight from Istanbul to London"\n\nJust type the amount and activity — I'll handle the rest! 🌱`;
        setMessages([{ id: `welcome-${session.id}`, role: 'assistant', content: welcome }]);
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
    <>
    <style>{CHAT_ANIM_STYLES}</style>
    <div className="relative flex flex-1 min-h-0 overflow-hidden">
      {/* Mobile backdrop for chat sidebar */}
      {sidebarOpen && (
        <div
          className={`absolute inset-0 z-20 bg-black/25 ${compact ? '' : 'lg:hidden'}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside className={`flex shrink-0 flex-col border-r border-[#175022]/6 bg-[#F1FCF2] transition-all duration-300 ${
        sidebarOpen
          ? `absolute inset-y-0 left-0 z-30 w-[220px] ${compact ? '' : 'lg:relative lg:inset-auto lg:z-auto'}`
          : 'w-0 overflow-hidden'
      }`}>
        {/* New chat */}
        <div className="shrink-0 px-3 pt-4 pb-2">
          <button
            onClick={() => startNew()}
            disabled={creatingSession}
            className="flex w-full items-center gap-2 rounded-xl border border-[#175022]/10 bg-white px-3 py-2.5 text-[12px] font-semibold text-[#175022]/70 shadow-sm transition hover:bg-[#DEFAE1] hover:border-[#2ABD41]/30 hover:text-[#175022] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creatingSession
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Plus className="h-3.5 w-3.5" />}
            {tr ? 'Yeni sohbet' : 'New chat'}
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-[#175022]/20" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-3 py-8 text-center text-[11px] text-[#175022]/28 leading-relaxed">
              {tr ? 'Henüz sohbet yok.' : 'No chats yet.'}
            </p>
          ) : (
            groupSessionsByDate(sessions, tr).map(group => (
              <div key={group.key} className="mb-1">
                <p className="px-2 pb-1 pt-3 text-[9.5px] font-semibold uppercase tracking-wider text-[#175022]/25">
                  {group.label}
                </p>
                {group.items.map(s => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    active={s.id === activeId}
                    onSelect={setActiveId}
                    onDelete={deleteSession}
                    tr={tr}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Clean header - hidden on mobile (parent header already shows branding + tabs) */}
        <header className="hidden sm:flex shrink-0 items-center gap-2 border-b border-[#175022]/6 bg-white px-3 sm:px-4 py-2 sm:py-2.5">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-[#175022]/35 transition hover:bg-[#175022]/5 hover:text-[#175022]"
            title={sidebarOpen ? (tr ? 'Geçmişi gizle' : 'Hide history') : (tr ? 'Geçmişi göster' : 'Show history')}
          >
            <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] sm:text-[13px] font-semibold text-[#175022]/80">
              {activeSession ? activeSession.title : 'Carbon AI'}
            </p>
          </div>

          {totalTonne > 0 && (
            <span className="hidden sm:inline-block shrink-0 rounded-full bg-[#DEFAE1] border border-[#2ABD41]/20 px-2.5 py-1 text-[11px] font-semibold text-[#175022]">
              {fixed(totalTonne, 1)} tCO₂e
            </span>
          )}

          {/* Language toggle */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[#175022]/8 bg-[#175022]/4 p-0.5">
            {['tr', 'en'].map(l => (
              <button
                key={l}
                onClick={() => setActiveLang(l)}
                className={`rounded-md px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide transition ${
                  activeLang === l ? 'bg-white text-[#175022] shadow-sm' : 'text-[#175022]/40 hover:text-[#175022]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </header>

        {/* Mobile-only compact bar */}
        <div className="flex sm:hidden shrink-0 items-center justify-between border-b border-[#175022]/6 bg-white px-3 py-1.5">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#175022]/40"
          >
            <Menu className="h-3.5 w-3.5" />
          </button>
          <p className="text-[11px] font-semibold text-[#175022]/60 truncate max-w-[40%]">
            {activeSession ? activeSession.title : 'Carbon AI'}
          </p>
          <div className="flex items-center gap-0.5 rounded-md border border-[#175022]/8 bg-[#175022]/4 p-0.5">
            {['tr', 'en'].map(l => (
              <button
                key={l}
                onClick={() => setActiveLang(l)}
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase transition ${
                  activeLang === l ? 'bg-white text-[#175022] shadow-sm' : 'text-[#175022]/35'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div role="alert" aria-live="assertive" className="shrink-0 mx-4 mt-3 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="shrink-0 text-red-400 transition hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* No bottom padding here: the input bar below is a normal flex sibling
            (shrink-0), not a fixed overlay, so this container's height already
            stops above it and nothing needs to be reserved. The pb-48 that used
            to be here — stacked on the list's own pb-40 — added ~352px of dead
            space that the scroll-to-bottom effect then scrolled into, parking a
            short conversation entirely above the viewport. */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-5">
          {!activeId ? (
            <EmptyState onNew={startNew} tr={tr} />
          ) : loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-[#175022]/30" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[12px] text-[#175022]/30">
                {tr ? 'Sorunuzu yazın…' : 'Type your question below…'}
              </p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
              {messages.map((msg) => (
                <div key={msg.id}>
                  <Bubble role={msg.role} content={msg.content} />
                  {/* ── Attachment download badge ──
                      A just-sent message only has its local `m-N` placeholder id
                      until the session is reloaded from the backend (send_message's
                      response describes the AI reply, not the user message that
                      carried the attachment) — the real numeric id the download
                      endpoint needs isn't available yet, so show a pending state
                      instead of a button that would 404. */}
                  {msg.has_attachment && (
                    typeof msg.id === 'number' ? (
                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(msg)}
                        disabled={downloadingAttachmentId === msg.id}
                        className="ml-9 mt-1.5 flex items-center gap-1.5 rounded-full border border-[#175022]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#175022]/70 shadow-sm transition hover:border-[#2ABD41]/40 hover:text-[#175022] disabled:opacity-50"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span className="max-w-[220px] truncate">{msg.attachment_name || 'attachment'}</span>
                        {downloadingAttachmentId === msg.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Download className="h-3 w-3" />}
                      </button>
                    ) : (
                      <div className="ml-9 mt-1.5 flex items-center gap-1.5 rounded-full border border-[#175022]/10 bg-[#175022]/5 px-3 py-1.5 text-[11px] font-semibold text-[#175022]/40">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="max-w-[220px] truncate">{msg.attachment_name || 'attachment'}</span>
                      </div>
                    )
                  )}
                  {/* ── Quick reply buttons / Period dropdown ── */}
                  {msg.role === 'assistant' && msg.ui?.quick_replies?.length > 0 && !msg.entriesSaved && !msg.quickReplyUsed && (
                    (() => {
                      // If this is a period question, show month/year dropdowns instead of buttons
                      const isPeriod = msg.ui.quick_replies.some(o => (o.value || o) === 'this_month') && msg.ui.quick_replies.length > 5;
                      if (isPeriod) {
                        const monthNames = tr
                          ? ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
                          : ['January','February','March','April','May','June','July','August','September','October','November','December'];
                        const thisYear = new Date().getFullYear();
                        const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3];
                        return (
                          <div className="ml-9 mt-3 max-w-sm rounded-2xl border border-[#2ABD41]/20 bg-gradient-to-br from-[#F1FCF2] to-white p-3.5 shadow-sm">
                            <div className="mb-2.5 flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2ABD41]/15 text-[#2ABD41]">
                                <Calendar className="h-3.5 w-3.5" strokeWidth={2.25} />
                              </div>
                              <span className="text-[12px] font-bold text-[#175022]">
                                {tr ? 'Hangi dönem?' : 'Which period?'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                id={`period-month-${msg.id}`}
                                defaultValue={new Date().getMonth() + 1}
                                className="rounded-lg border border-[#2ABD41]/30 bg-white px-3 py-2 text-[13px] font-semibold text-[#175022] shadow-sm"
                              >
                                {monthNames.map((name, i) => (
                                  <option key={i} value={i + 1}>{name}</option>
                                ))}
                              </select>
                              <select
                                id={`period-year-${msg.id}`}
                                defaultValue={thisYear}
                                className="rounded-lg border border-[#2ABD41]/30 bg-white px-3 py-2 text-[13px] font-semibold text-[#175022] shadow-sm"
                              >
                                {years.map(y => (
                                  <option key={y} value={y}>{y}</option>
                                ))}
                              </select>
                            </div>
                            <div className="mt-2.5 flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const month = document.getElementById(`period-month-${msg.id}`)?.value;
                                  const year = document.getElementById(`period-year-${msg.id}`)?.value;
                                  const monthShort = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][parseInt(month)-1];
                                  const value = `${monthShort} ${year}`;
                                  const label = `${monthNames[parseInt(month)-1]} ${year}`;
                                  setMessages(prev => prev.map(m =>
                                    m.id === msg.id ? { ...m, quickReplyUsed: true, selectedReply: label } : m
                                  ));
                                  sendMessage(value, null, label);
                                }}
                                className="flex items-center gap-1.5 rounded-full bg-[#2ABD41] px-5 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#1D9C31]"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {tr ? 'Onayla' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMessages(prev => prev.map(m =>
                                    m.id === msg.id ? { ...m, quickReplyUsed: true, selectedReply: tr ? 'İptal edildi' : 'Cancelled' } : m
                                  ));
                                  sendMessage('cancel', null, tr ? 'İptal' : 'Cancel');
                                }}
                                className="flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-[12px] font-semibold text-red-500 transition hover:bg-red-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                {tr ? 'İptal' : 'Cancel'}
                              </button>
                            </div>
                          </div>
                        );
                      }
                      // Normal quick reply buttons
                      return (
                    <div className="ml-9 mt-3 flex flex-wrap gap-2">
                      {msg.ui.quick_replies.map((option, idx) => (
                        <button
                          key={`${msg.id}-qr-${idx}`}
                          type="button"
                          onClick={() => {
                            if (option.kind === 'free_text') {
                              inputRef.current?.focus();
                              return;
                            }
                            if (option.kind === 'cancel') {
                              setMessages(prev => prev.map(m =>
                                m.id === msg.id ? { ...m, quickReplyUsed: true, selectedReply: tr ? 'İptal edildi' : 'Cancelled' } : m
                              ));
                              sendMessage('cancel', null, tr ? 'İptal' : 'Cancel');
                              return;
                            }
                            setMessages(prev => prev.map(m =>
                              m.id === msg.id ? { ...m, quickReplyUsed: true, selectedReply: option.label } : m
                            ));
                            sendMessage(option.value, null, option.label);
                          }}
                          className="rounded-full border border-[#2ABD41]/30 bg-white px-4 py-2 text-[12px] font-bold text-[#1A7B2A] shadow-sm transition hover:bg-[#F1FCF2] hover:border-[#2ABD41]/60"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                      );
                    })()
                  )}
                  {/* ── Selected reply indicator ── */}
                  {msg.quickReplyUsed && msg.selectedReply && (
                    <div className="ml-9 mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#2ABD41]">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      {(tr ? 'Seçildi: ' : 'Selected: ') + msg.selectedReply}
                    </div>
                  )}
                  {/* ── Save confirmation section ── */}
                  {msg.pending_entries && msg.pending_entries.length > 0 && !msg.entriesSaved && !canEdit && (
                    <p className="ml-9 mt-3 max-w-[85%] rounded-xl border border-[#175022]/10 bg-[#F1FCF2] px-4 py-2.5 text-[12px] text-[#175022]/70">
                      {tr
                        ? 'Denetçi rolünüz salt okunur: sonucu görebilirsiniz, ancak kayıt olarak ekleyemezsiniz.'
                        : 'Your auditor role is read-only: you can see the result but not save it as an entry.'}
                    </p>
                  )}
                  {msg.pending_entries && msg.pending_entries.length > 0 && !msg.entriesSaved && canEdit && (
                    <div className="ml-9 mt-3 rounded-2xl border border-[#2ABD41]/20 bg-gradient-to-br from-[#F1FCF2] to-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2ABD41]/15 text-[#2ABD41]">
                          <Save className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </div>
                        <p className="text-[13px] font-bold text-[#175022]">
                          {tr ? "Bu sonucu dashboard'a kaydet?" : 'Save this result to your dashboard?'}
                        </p>
                      </div>
                      {/* Show clean result summary */}
                      <div className="mb-3 space-y-2">
                        {msg.pending_entries.map((pe, idx) => (
                          <div key={idx} className="rounded-lg bg-white/80 border border-[#175022]/5 px-3 py-2.5">
                            <div className="text-[12px] text-[#175022]/80">
                              <span className={`font-semibold ${tr && pe.factor_name_tr ? '' : 'capitalize'}`}>{tr && pe.factor_name_tr ? pe.factor_name_tr : (pe.fuel_type || '').replace(/_/g, ' ')}</span>
                              {tr ? ' sonucu: ' : ' result: '}
                              <span className="font-bold text-[#175022]">{Number(pe.co2e_kg).toLocaleString(tr ? 'tr-TR' : 'en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} kgCO₂e</span>
                              {' '}
                              <span className="text-[#1A7B2A]">({Number(pe.co2e_tonne).toLocaleString(tr ? 'tr-TR' : 'en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} tCO₂e)</span>
                            </div>
                            {(pe.factor_source_label || pe.factor_reference) && (
                              <div className="mt-1 text-[10px] text-[#1A7B2A]">
                                {tr ? 'Kaynak: Kayıtlı faktör — ' : 'Source: Registered factor — '}
                                {/* The reference text is English; Turkish users get the source's Turkish name. */}
                                {tr ? (pe.factor_source_label_tr || pe.factor_source_label || pe.factor_reference) : (pe.factor_reference || pe.factor_source_label)}
                              </div>
                            )}
                            {/* Always shown — the user confirms the period explicitly
                                every time, even when the AI extracted a date from the
                                message, rather than silently trusting the extraction. */}
                            {(() => {
                              const key = `${msg.id}-${idx}`;
                              const override = periodOverrides[key] || { month: pe.month, year: pe.year };
                              const monthNames = tr
                                ? ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
                                : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                              const thisYear = new Date().getFullYear();
                              // The AI may have extracted a year further back than the
                              // usual 3-year window (e.g. year found but not month, from
                              // "in 2020 we used...") — without this, the <select>'s value
                              // wouldn't match any <option>, silently desyncing what's
                              // shown from what would actually be saved.
                              const yearOptions = [thisYear, thisYear - 1, thisYear - 2];
                              if (override.year && !yearOptions.includes(override.year)) {
                                yearOptions.push(override.year);
                                yearOptions.sort((a, b) => b - a);
                              }
                              // Confident extraction gets a neutral confirm prompt;
                              // an unrecognized/missing date keeps the amber warning
                              // so the user notices it's a guess, not a read-back.
                              const boxClass = pe.date_extracted
                                ? 'mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-[#F1FCF2] px-2.5 py-2 border border-[#2ABD41]/20'
                                : 'mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 border border-amber-100';
                              return (
                                <div className={boxClass}>
                                  {pe.date_extracted ? (
                                    <Calendar className="h-3.5 w-3.5 shrink-0 text-[#2ABD41]" strokeWidth={2.25} />
                                  ) : (
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2.25} />
                                  )}
                                  <span className={`text-[10px] font-semibold ${pe.date_extracted ? 'text-[#1A7B2A]' : 'text-amber-700'}`}>
                                    {pe.date_extracted
                                      ? (tr ? 'Dönemi onayla:' : 'Confirm period:')
                                      : (tr ? 'Dönem tahmin edilemedi:' : 'Period could not be determined:')}
                                  </span>
                                  <select
                                    value={override.month}
                                    onChange={(e) => setPeriodOverrides(prev => ({ ...prev, [key]: { ...override, month: Number(e.target.value) } }))}
                                    className="rounded-md border border-[#175022]/15 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#175022]"
                                  >
                                    {monthNames.map((name, i) => (
                                      <option key={i} value={i + 1} disabled={isFutureMonth(override.year, i + 1)}>{name}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={override.year}
                                    onChange={(e) => setPeriodOverrides(prev => ({ ...prev, [key]: { ...override, year: Number(e.target.value) } }))}
                                    className="rounded-md border border-[#175022]/15 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#175022]"
                                  >
                                    {yearOptions.map(y => (
                                      <option key={y} value={y}>{y}</option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2.5">
                        <button
                          onClick={async () => {
                            setSavingMessageId(msg.id);
                            try {
                              let lastStatus = 'approved';
                              let savedCount = 0;
                              // Check every period first so nothing is half-saved.
                              const future = msg.pending_entries.some((pe, idx) => {
                                const o = periodOverrides[`${msg.id}-${idx}`];
                                return isFutureMonth(o?.year ?? pe.year, o?.month ?? pe.month);
                              });
                              if (future) { setError(futurePeriodMessage(tr)); return; }
                              for (const [idx, pe] of msg.pending_entries.entries()) {
                                const override = periodOverrides[`${msg.id}-${idx}`];
                                const peToSave = { ...(override ? { ...pe, month: override.month, year: override.year } : pe), language };
                                let res = await api.confirmEmissionEntry(peToSave);
                                let data = await res.json().catch(() => ({}));
                                if (res.status === 409 && data.code === 'possible_duplicate') {
                                  // Same source, period and quantity is already saved: ask
                                  // before doubling it; "Cancel" skips just this one.
                                  const saveAnyway = window.confirm(tr
                                    ? 'Bu dönem için aynı kaynak ve miktarla bir kayıt zaten var. Aynı faturayı iki kez girerseniz toplam iki kat görünür.\n\nYine de kaydedilsin mi?'
                                    : 'An entry with the same source and quantity already exists for this period. Entering the same invoice twice doubles it in the totals.\n\nSave it anyway?');
                                  if (!saveAnyway) continue;
                                  res = await api.confirmEmissionEntry({ ...peToSave, confirm_duplicate: true });
                                  data = await res.json().catch(() => ({}));
                                }
                                if (!res.ok) {
                                  setError(res.status === 403 ? noPermissionMessage(tr) : (data.error || (tr ? 'Kayıt başarısız.' : 'Save failed.')));
                                  return;
                                }
                                if (data.entry_status) lastStatus = data.entry_status;
                                savedCount += 1;
                              }
                              if (savedCount === 0) return;
                              setMessages(prev => prev.map(m =>
                                m.id === msg.id ? { ...m, entriesSaved: true, entryStatus: lastStatus } : m
                              ));
                              await fetchData?.();
                              window.dispatchEvent(new CustomEvent('carbonless:emissions-updated', { detail: { source: 'chat' } }));
                            } catch {
                              setError(tr ? 'Bağlantı hatası.' : 'Connection error.');
                            } finally {
                              setSavingMessageId(null);
                            }
                          }}
                          disabled={savingMessageId === msg.id}
                          className="flex items-center gap-2 rounded-full bg-[#2ABD41] px-5 py-2.5 text-[12px] font-bold text-white shadow-sm hover:bg-[#1D9C31] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {savingMessageId === msg.id ? (tr ? 'Kaydediliyor...' : 'Saving...') : (tr ? 'Evet, Kaydet' : 'Yes, Save')}
                        </button>
                        <button
                          onClick={() => {
                            setMessages(prev => prev.map(m =>
                              m.id === msg.id ? { ...m, entriesSaved: true, entriesRejected: true } : m
                            ));
                          }}
                          className="flex items-center gap-2 rounded-full border border-[#175022]/15 bg-white px-5 py-2.5 text-[12px] font-semibold text-[#175022]/50 hover:border-red-300 hover:text-red-500 hover:bg-red-50/50 transition"
                        >
                          <X className="h-4 w-4" />
                          {tr ? 'Hayır' : 'No'}
                        </button>
                      </div>
                    </div>
                  )}
                  {msg.entriesSaved && !msg.entriesRejected && (
                    <div className="ml-9 mt-2 rounded-xl bg-[#F1FCF2] border border-[#2ABD41]/20 px-4 py-2.5">
                      <div className="flex items-center gap-2 text-[12px] font-semibold text-[#2ABD41]">
                        <CheckCircle2 className="h-4 w-4" />
                        {tr ? 'Dashboard\'a kaydedildi' : 'Saved to dashboard'}
                      </div>
                      <div className="mt-1 text-[10px] text-[#1A7B2A]">
                        {msg.entryStatus === 'approved'
                          ? (tr ? 'Durum: Onaylandı' : 'Status: Approved')
                          : (tr ? 'Durum: Onay bekliyor. Onaylandığında toplamlara eklenir.' : 'Status: Awaiting approval. It will count in the totals once approved.')}
                      </div>
                    </div>
                  )}
                  {msg.entriesRejected && (
                    <div className="ml-9 mt-2 flex items-center gap-2 text-[11px] font-semibold text-[#175022]/30">
                      <X className="h-3.5 w-3.5" />
                      {tr ? 'Kaydedilmedi' : 'Not saved'}
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex gap-3">
                  <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-[#2ABD41] flex items-center justify-center shadow-sm">
                    <span className="block h-2 w-2 rounded-full bg-white/80" />
                  </div>
                  <div className="py-1">
                    <TypingDots />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#175022]/6 px-3 pt-2 pb-2 sm:px-6 sm:pt-3 sm:pb-3">
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
                <div className={`mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[22px] border bg-white px-4 py-3 shadow-[0_4px_20px_rgba(7, 44, 14,0.05)] focus-within:ring-4 transition ${
                  charOver
                    ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100'
                    : 'border-[#175022]/10 focus-within:border-[#8BEA99]/50 focus-within:ring-[#8BEA99]/12'
                }`}>
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => { setInput(e.target.value); inputValueRef.current = e.target.value; }}
                      onKeyDown={handleKeyDown}
                      disabled={sending || creatingSession}
                      placeholder={tr ? 'Carbonless\'a sor…' : 'Ask Carbonless…'}
                      rows={1}
                      className="min-h-[24px] max-h-[120px] w-full resize-none bg-transparent text-sm font-medium text-[#175022] outline-none placeholder:text-[#175022]/30 disabled:cursor-not-allowed"
                      style={{ scrollbarWidth: 'none' }}
                      onInput={e => {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!activeId) startNew(input);
                      else sendMessage();
                    }}
                    disabled={!input.trim() || sending || creatingSession || charOver}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#175022] text-white shadow-sm transition hover:bg-[#175022] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {(sending || creatingSession)
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="mt-1.5 mx-auto flex w-full max-w-3xl items-center justify-end px-1">
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
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: CarbonAIPage (dual-tab)
// ─────────────────────────────────────────────────────────────────────────────
// The site's AI assistant: the full chat (history, file uploads, emission
// calculations with save cards) in a side panel beside the Carbon Inventory.
// It replaced both the full-screen "AI Sohbet" page and the inventory's
// separate "AI Yardımı" drawer, so there is one assistant everywhere.
export function InventoryAssistant({ open, onClose, prefill, language = 'en', summary, entries, targets, fetchData, docked = false }) {
  const tr = language === 'tr';
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <>
      <style>{CHAT_ANIM_STYLES}</style>
      {/* Kept mounted while closed so the conversation is not lost. */}
      <div
        className={docked
          // AI mode: a column beside the inventory on wide screens, full
          // screen over it on a phone.
          ? `${open ? 'flex' : 'hidden'} fixed inset-0 z-[95] flex-col bg-white lg:static lg:z-auto lg:w-[480px] lg:shrink-0 lg:border-l lg:border-[#DEFAE1] xl:w-[540px]`
          : `fixed inset-y-0 right-0 z-[80] flex w-full flex-col border-l border-[#DEFAE1] bg-white shadow-2xl transition-transform duration-300 sm:w-[460px] lg:w-[540px] ${
            open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
          }`}
        aria-hidden={!open}
        role="dialog"
        aria-label={tr ? 'AI Asistan' : 'AI Assistant'}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#DEFAE1] bg-[#F1FCF2] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Image src="/chatbot.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            <div>
              <p className="text-[13px] font-bold text-[#175022]">{tr ? 'Carbonless AI Asistan' : 'Carbonless AI Assistant'}</p>
              <p className="text-[10px] text-[#2ABD41]">
                {tr ? 'Sorularınızı yanıtlar, emisyon hesaplar' : 'Answers your questions, calculates emissions'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#175022]/10 bg-white text-[#175022]/50 transition hover:text-[#175022]"
            aria-label={tr ? 'Kapat' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <FreeChatTab
            language={language}
            summary={summary}
            entries={entries}
            targets={targets}
            fetchData={fetchData}
            compact
            prefill={prefill}
          />
        </div>
      </div>
    </>
  );
}
