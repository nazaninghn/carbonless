'use client';

import { noPermissionMessage } from '@/lib/permissions';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  AlertCircle, AlertTriangle, FileText, Leaf, Paperclip,
  Pencil, Plus, Search, Trash2, Undo2, X,
} from 'lucide-react';
import { notCountedText } from '@/lib/notCounted';
import { api } from '@/lib/utils/api';
import { downloadProofDocument } from '@/lib/proofDownload';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import { isFutureMonth, futurePeriodMessage } from '@/lib/periods';
import { autoDescriptionLabel, entrySourceLabel, isLinkedDescription, isAnnualEntry, entryPeriodLabel } from '@/lib/entryDescription';
import { parseLocalizedNumber } from '@/lib/utils/numbers';
import Scope3EntryForm from '@/components/dashboard/Scope3EntryForm';
import useCountUp from '@/lib/hooks/useCountUp';
import { DASHBOARD_ANIM_STYLES } from '@/lib/constants/dashboardAnimations';
import {
  SCOPE_META, STATUS_META, CATEGORY_LABELS, SCOPE3_CATEGORY_NUMBER,
  MONTHS_TR, MONTHS_EN,
  ALLOWED_UPLOAD_MIME as ALLOWED_MIME,
  MAX_UPLOAD_BYTES as MAX_FILE_BYTES,
  scopeLabel, fmt, unitLabel, factorLabel,
} from '@/lib/constants/emissions';
import { fixed } from '@/lib/formatNumber';
import { COUNTRIES } from '@/lib/data/countries';
import FactorCountryBadge from '@/components/FactorCountryBadge';
import { FOCUS_ENTRY_EVENT, FOCUS_ENTRY_KEY } from '@/components/dashboard/CommandPalette';

// ─── KPI mini card (count-up + hover lift) ─────────────────────────────────
function EmissionsKPI({ label, value, decimals = 2, sub, color, delay = 0 }) {
  const animated = useCountUp(value, 900);
  return (
    <div
      className="dash-fade-up group relative overflow-hidden rounded-xl border border-[#072C0E]/7 bg-white px-3 py-2.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(7,44,14,0.08)] hover:border-[#2ABD41]/25"
      style={{ animationDelay: `${delay}ms` }}
    >
      {color && (
        <div
          className="absolute left-3 right-3 top-0 h-[3px] rounded-b-full opacity-60 transition-opacity duration-300 group-hover:opacity-100"
          style={{ backgroundColor: color }}
        />
      )}
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#072C0E]/40 sm:text-[10px]">{label}</p>
      <p className="mt-1 text-[18px] font-bold leading-none tabular-nums text-[#072C0E] sm:text-xl">{fixed(animated, decimals)}</p>
      <p className="mt-0.5 text-[9px] font-semibold text-[#072C0E]/35">{sub}</p>
    </div>
  );
}

// ─── Proof document download (lib/proofDownload.js) ────────────────────────
// Paperclip for an entry's proof: amber with a warning when the recorded file
// is no longer on the server (proof_available false).
function ProofButton({ entry, tr, toast, className }) {
  if (!entry.proof_document) return null;
  const missing = entry.proof_available === false;
  return (
    <button
      type="button"
      onClick={() => downloadProofDocument(entry.id, toast, tr)}
      title={missing
        ? (tr ? 'Kanıt dosyası sunucuda yok — kaydı düzenleyip yeniden yükleyin' : 'Proof file missing on the server — edit the entry to upload it again')
        : (tr ? 'Kanıtı indir' : 'Download proof')}
      className={`${className} ${missing ? 'text-amber-500 hover:text-amber-600' : 'text-[#2ABD41] hover:text-[#1D9C31]'}`}
    >
      {missing ? <AlertTriangle className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
    </button>
  );
}

// Same mapping as emissions/factor_lookup.py (the AI chat's choice).
const GRID_BY_COUNTRY = {
  GB: 'uk-grid', UK: 'uk-grid', US: 'us-grid', CN: 'china-grid', DE: 'germany-grid', FR: 'france-grid',
  IN: 'india-grid', JP: 'japan-grid', BR: 'brazil-grid', AU: 'australia-grid', CA: 'canada-grid',
  KR: 'south-korea-grid', SA: 'saudi-arabia-grid', AE: 'uae-grid',
};
const EU_COUNTRIES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
const TURKEY_CODES = new Set(['TR', 'TUR', 'TURKEY', 'TÜRKIYE', 'TÜRKİYE', 'TURKIYE']);
const COUNTRY_NAME = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));

// A facility's electricity uses its own country's grid factor, never another
// country's or an average in its place (same rule as the backend's
// facility_grid_slug); null = that country has no grid factor of its own.
// In Turkey the official factor follows the facility's grid connection
// (transmission / distribution); none chosen yet = null (its electricity waits).
const TURKEY_GRID_BY_CONNECTION = { transmission: 'turkey-grid-transmission', distribution: 'turkey-grid-distribution' };
function facilityGridSlug(country, connection) {
  const c = String(country || '').trim().toUpperCase();
  if (!c) return null;
  if (TURKEY_CODES.has(c)) return TURKEY_GRID_BY_CONNECTION[connection] || null;
  return GRID_BY_COUNTRY[c] || null;
}
const GRID_SLUGS = new Set(['turkey-grid', ...Object.values(TURKEY_GRID_BY_CONNECTION), 'eu-grid', 'grid-average', ...Object.values(GRID_BY_COUNTRY)]);

// A source published for several years (UK grid 2024, 2025): the row of the
// entry year, else the latest earlier one, else the earliest — as the backend
// picks it (emissions/factor_lookup.pick_factor).
function factorsForYear(factors, year) {
  const y = Number(year) || null;
  const best = new Map();
  for (const f of factors) {
    const key = `${f.slug}|${f.country}`;
    const cur = best.get(key);
    if (!cur) { best.set(key, f); continue; }
    const score = (r) => (y == null ? r.year : (r.year <= y ? 10000 + r.year : -r.year));
    if (score(f) > score(cur)) best.set(key, f);
  }
  return factors.filter(f => best.get(`${f.slug}|${f.country}`) === f);
}

// Month-filter value for the questionnaire's annual entries (after the 12 months).
const ANNUAL = 13;

// Only approved entries are part of the totals — the same rule the backend
// summary and every report apply (emissions/inventory.py). Pending and
// rejected entries stay listed and are summed separately, for information.
const countedKg = (e) => (e.status === 'approved' ? (parseFloat(e.calculated_co2e_kg) || 0) : 0);

// ─── Entry Card (mobile) ──────────────────────────────────────────────────────
// Units offered in the custom-request form (stored as written).
const CUSTOM_UNITS = [
  { v: 'litre', tr: 'litre', en: 'litres' }, { v: 'kg', tr: 'kg', en: 'kg' },
  { v: 'ton', tr: 'ton', en: 'tonnes' }, { v: 'kWh', tr: 'kWh', en: 'kWh' },
  { v: 'm³', tr: 'm³', en: 'm³' }, { v: 'km', tr: 'km', en: 'km' },
  { v: 'adet', tr: 'adet', en: 'units' },
];

// Full month names for "Kaydet ve Şubat →" (the pills use the short ones).
const FULL_MONTHS = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

// The status pill: an approved entry with a deletion request (still counted
// until an approver accepts it) and a waiting change to an approved entry
// say so.
const DELETE_REQUESTED_META = { bg: 'bg-amber-100', text: 'text-amber-800', tr: 'Silme talebi', en: 'Deletion requested' };
const PENDING_CHANGE_META = { bg: 'bg-amber-100', text: 'text-amber-700', tr: 'Değişiklik onayda', en: 'Change pending' };
// A form entry's deletion request can be taken back from its row; an
// inventory answer's is withdrawn by answering the question again.
// Only its author sees it: an approver refuses the request on Onay
// Bekleyenler, which tells the author why.
function canWithdrawDelete(entry) {
  return entry.delete_requested && entry.is_mine !== false
    && !(entry.description || '').startsWith('Questionnaire step');
}

function WithdrawDeleteButton({ tr, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-[10px] font-bold text-amber-800 transition hover:bg-amber-100"
    >
      <Undo2 className="h-3 w-3" />
      {tr ? 'Talebi geri al' : 'Withdraw request'}
    </button>
  );
}

function entryStatusMeta(entry) {
  if (entry.delete_requested) return DELETE_REQUESTED_META;
  // A form entry's change, or an inventory answer's new rows next to its
  // approved ones: both wait as a change, not as a new entry.
  if (entry.status === 'submitted' && (entry.replaces_entry || entry.replaces)) return PENDING_CHANGE_META;
  return STATUS_META[entry.status] ?? STATUS_META.submitted;
}

// "(onaylı: 12.000 litre)": the approved value that stays in the totals
// until a waiting change is approved.
function approvedValueText(entry, tr) {
  const r = entry.status === 'submitted' ? entry.replaces : null;
  if (!r) return '';
  const value = r.quantity != null ? `${fmt(r.quantity)} ${unitLabel(r.unit, tr)}` : `${fmt(r.co2e_kg)} kg CO₂e`;
  return tr ? `onaylı: ${value}` : `approved: ${value}`;
}

function EntryCard({ entry, months, language, maxKg, onEdit, onDelete, onCancelDelete, canEdit = true, focused = false }) {
  const tr = language === 'tr';
  const toast = useToast();
  const sm = SCOPE_META[entry.scope] ?? SCOPE_META.scope1;
  const st = entryStatusMeta(entry);
  const kg = parseFloat(entry.calculated_co2e_kg) || 0;
  const barPct = maxKg > 0 ? (countedKg(entry) / maxKg) * 100 : 0;
  const name = (tr && entry.emission_factor_name_tr) ? entry.emission_factor_name_tr : entry.emission_factor_name;

  return (
    <div data-entry-id={entry.id} className={`rounded-2xl border bg-white p-4 shadow-[0_2px_12px_rgba(7,44,14,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(7,44,14,0.08)] hover:border-[#2ABD41]/20 ${focused ? 'border-[#2ABD41] ring-2 ring-[#2ABD41]/40' : 'border-[#072C0E]/8'}`}>
      {/* Top row */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-[#072C0E]">{name}</p>
          <p className="mt-0.5 text-[10px] text-[#072C0E]/40">
            {entryPeriodLabel(entry, months, tr)} · {tr ? 'Miktar' : 'Qty'}: {fmt(entry.quantity)} {unitLabel(entry.unit, tr)}
          </p>
          {entry.questionnaire_source && entrySourceLabel(entry, tr) && (
            <p className="mt-0.5 text-[10px] leading-4 text-[#072C0E]/45">{entrySourceLabel(entry, tr)}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ProofButton entry={entry} tr={tr} toast={toast}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[#2ABD41]/10" />
          {canEdit && canWithdrawDelete(entry) && (
            <WithdrawDeleteButton tr={language === 'tr'} onClick={() => onCancelDelete(entry.id)} />
          )}
          {canEdit && (<>
          <button
            onClick={() => onEdit(entry)}
            aria-label={language === 'tr' ? 'Kaydı düzenle' : 'Edit entry'}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#072C0E]/30 transition hover:bg-[#2ABD41]/10 hover:text-[#2ABD41]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            aria-label={language === 'tr' ? 'Kaydı sil' : 'Delete entry'}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#072C0E]/30 transition hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          </>)}
        </div>
      </div>

      {/* Mini bar */}
      <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-[#072C0E]/5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(barPct, barPct > 0 ? 2 : 0)}%`, backgroundColor: sm.bar }}
        />
      </div>

      {/* Bottom row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${sm.bg} ${sm.text}`}>
          {tr ? sm.label.replace('Scope', 'Kapsam') : sm.label}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${st.bg} ${st.text}`}>
          {tr ? st.tr : st.en}
        </span>
        {approvedValueText(entry, tr) && (
          <span className="text-[9px] font-semibold text-amber-700">({approvedValueText(entry, tr)})</span>
        )}
        {entry.status === 'draft' && entry.rejected_reason && (
          <span className="w-full text-[10px] font-medium text-red-600">
            {tr ? 'Red nedeni' : 'Reason'}: {entry.rejected_reason}
          </span>
        )}
        {entry.facility_name && (
          <span className="rounded-full bg-[#072C0E]/5 px-2 py-0.5 text-[9px] font-semibold text-[#072C0E]/50">
            {entry.facility_name}
          </span>
        )}
        <FactorCountryBadge entry={entry} tr={tr} />
        <span className="ml-auto text-[12px] font-bold text-[#072C0E]">
          {fmt(kg)} <span className="text-[9px] font-semibold text-[#072C0E]/40">kg</span>
        </span>
        <span className="text-[11px] text-[#072C0E]/40">
          {fixed((kg / 1000), 4)} t
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EmissionsTab({
  language, selectedYear, selectedCountry, companyCountry = '',
  entries, factors, facilityList,
  customRequests = [],
  questionnaireProfile,
  showAddForm, setShowAddForm,
  setActiveTab,
  fetchData,
  canEdit = true,
  canApprove = false,
  currentUsername,
  yearsWithData = [],
  onYearChange,
}) {
  const tr    = language === 'tr';
  const toast = useToast();
  // A data-entry member changes only the entries they entered; owner, admin
  // and manager may change any (the backend enforces the same rule).
  const canChange = useCallback((entry) => canEdit && (canApprove || entry.is_mine !== false), [canEdit, canApprove]);

  // ── Local state ──────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [filterMonth,    setFilterMonth]    = useState(0);   // 0 = all months, ANNUAL = questionnaire's annual entries
  const [filterFacility, setFilterFacility] = useState('');
  const [sortBy,         setSortBy]         = useState('month');

  // An entry picked in the search (Ctrl+K): filters cleared so it is in the
  // list, then scrolled to and marked for a few seconds.
  const [focusedId, setFocusedId] = useState(null);
  useEffect(() => {
    const focus = (id) => {
      if (!id) return;
      try { sessionStorage.removeItem(FOCUS_ENTRY_KEY); } catch { /* nothing kept */ }
      setSearch(''); setFilterScope(''); setFilterMonth(0); setFilterFacility('');
      setFocusedId(String(id));
    };
    try { focus(sessionStorage.getItem(FOCUS_ENTRY_KEY)); } catch { /* opened normally */ }
    const onFocus = (e) => focus(e.detail);
    window.addEventListener(FOCUS_ENTRY_EVENT, onFocus);
    return () => window.removeEventListener(FOCUS_ENTRY_EVENT, onFocus);
  }, []);
  // A notification can also switch the year, so the entry may only appear once
  // that year's entries have loaded: look for it as the list changes, and
  // start the 4-second mark only once it has been scrolled to.
  const focusShownRef = useRef(null);
  useEffect(() => {
    if (!focusedId) { focusShownRef.current = null; return undefined; }
    if (focusShownRef.current === focusedId) return undefined;
    const show = setTimeout(() => {
      const el = [...document.querySelectorAll(`[data-entry-id="${focusedId}"]`)].find(n => n.offsetParent !== null);
      if (!el) return;
      focusShownRef.current = focusedId;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setFocusedId(id => (id === focusedId ? null : id)), 4000);
    }, 150);
    // Not in this year's list at all: stop waiting after a while.
    const giveUp = setTimeout(() => setFocusedId(id => (id === focusedId && focusShownRef.current !== id ? null : id)), 10000);
    return () => { clearTimeout(show); clearTimeout(giveUp); };
  }, [focusedId, entries]);

  // Add form
  const [selScope,    setSelScope]    = useState('');
  const [selCategory, setSelCategory] = useState('');
  const [selFactor,   setSelFactor]   = useState('');
  const [month,       setMonth]       = useState(new Date().getMonth() + 1);
  const [quantity,    setQuantity]    = useState('');
  const [desc,        setDesc]        = useState('');
  const [facility,    setFacility]    = useState('');
  const [file,        setFile]        = useState(null);
  const [formError,   setFormError]   = useState('');
  // The duplicate warning sits at the end of the long form; on a phone it
  // appeared below the fold and Save seemed to do nothing.
  const dupWarningRef = useRef(null);
  const [submitting,  setSubmitting]  = useState(false);

  // Edit
  const [editing,     setEditing]     = useState(null);
  const [editQty,     setEditQty]     = useState('');
  const [editDesc,    setEditDesc]    = useState('');
  const [editFacility,setEditFacility]= useState('');
  const [editSaving,  setEditSaving]  = useState(false);
  // Proof document of the entry being edited: attach/replace/remove at once.
  const [proofBusy, setProofBusy] = useState(false);
  const [confirmProofRemove, setConfirmProofRemove] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null); // stores the entry id to delete

  // Scope 3 dedicated form
  const [showScope3Form, setShowScope3Form] = useState(false);

  // Custom request
  const [showCustom,   setShowCustom]  = useState(false);
  const [cScope,  setCScope]   = useState('scope1');
  const [cCat,    setCCat]     = useState('');
  const [cSrc,    setCSrc]     = useState('');
  const [cDesc,   setCDesc]    = useState('');
  const [cUnit,   setCUnit]    = useState('');
  // Common units to pick from; "Diğer" opens a short free-text field.
  const [cUnitOther, setCUnitOther] = useState(false);
  const [cQty,    setCQty]     = useState('');
  const [cMonth,  setCMonth]   = useState(new Date().getMonth() + 1);
  const [cFacility, setCFacility] = useState('');
  const [cSaving, setCSaving]  = useState(false);
  const [withdrawing, setWithdrawing] = useState(null); // custom request to withdraw

  // ── Derived ──────────────────────────────────────────────────────────────
  const months = tr ? MONTHS_TR : MONTHS_EN;
  // Both forms save to the year chosen at the top of the page; they did not
  // say so, and a December bill typed in January met greyed-out months.
  const yearHint = tr
    ? `${selectedYear} yılına kaydedilir. Başka bir yıl için sayfanın üstündeki yıl seçimini değiştirin.`
    : `Saved to ${selectedYear}. For another year, change the year at the top of the page.`;
  // Approved custom requests are added to the dashboard and report totals
  // (the summary does that), not to the entry totals on this page — said
  // here, since the cards read 0,00 while the dashboard showed the amount.
  const customApprovedKg = customRequests
    // A facility electricity factor replaces that facility's factor — it is
    // not an amount of its own in any total.
    .filter(cr => cr.status === 'approved' && !cr.electricity_method && String(cr.year) === String(selectedYear) && cr.calculated_co2e_kg)
    .reduce((t, cr) => t + Number(cr.calculated_co2e_kg), 0);
  const fullMonths = FULL_MONTHS[tr ? 'tr' : 'en'];
  const catLabel = k => CATEGORY_LABELS[k]?.[tr ? 'tr' : 'en'] ?? k;

  // The picked facility's country: its electricity is calculated with that
  // country's own grid factor only (null when the country has none).
  const facilityObj = useMemo(() => (facilityList || []).find(x => String(x.id) === String(facility)), [facilityList, facility]);
  const facilityCountry = String(facilityObj?.country || '').trim().toUpperCase();
  const facilityGrid = useMemo(() => facilityGridSlug(facilityCountry, facilityObj?.grid_connection),
    [facilityCountry, facilityObj]);
  const needsConnection = TURKEY_CODES.has(facilityCountry) && !facilityObj?.grid_connection;
  // An electricity factor approved for this facility and year (Özel Talep)
  // applies in the inventory's electricity question, not in this form.
  const approvedFacilityFactor = useMemo(() => customRequests.find(cr =>
    cr.status === 'approved' && cr.electricity_method === 'location_based'
    && String(cr.facility) === String(facility) && String(cr.year) === String(selectedYear)), [customRequests, facility, selectedYear]);

  // Filtered factors (same logic as page.jsx, incl. questionnaire preferred source)
  const filteredFactors = useMemo(() => {
    // Hoist the country-category Set out of the per-item callback — O(n) not O(n²)
    const ccCats = (selectedCountry && selectedCountry !== 'global')
      ? new Set(
          factors
            .filter(ff => ff.country === selectedCountry && (!selScope || ff.scope === selScope))
            .map(ff => ff.category)
        )
      : null;
    // Preferred source lookup — build once, not per-item
    let preferred = null;
    if (selectedCountry !== 'turkey' && questionnaireProfile?.preferred_factor_source
        && !['mixed','unsure'].includes(questionnaireProfile.preferred_factor_source)) {
      const srcMap = { national: ['turkey_grid','turkey_fleet','atom_kablo'], defra: ['defra_2024'], ipcc: ['ipcc_2006','ipcc_2019'] };
      preferred = srcMap[questionnaireProfile.preferred_factor_source] ?? null;
    }
    const yearFactors = factorsForYear(factors, selectedYear);
    const list = yearFactors.filter(f => {
      let m = true;
      if (selScope)    m = m && f.scope === selScope;
      if (selCategory) m = m && f.category === selCategory;
      if (ccCats) {
        m = m && (ccCats.has(f.category) ? f.country === selectedCountry : f.country === 'global');
      } else if (selectedCountry === 'global') {
        m = m && f.country === 'global';
      }
      if (preferred) m = m && preferred.includes(f.source);
      return m;
    });
    // A facility with a country: of the electricity grids, only that
    // country's own is offered (added when the company's list lacks it);
    // other countries' grids and averages are left out. Non-grid sources
    // (e.g. 100% renewable) stay.
    if (facilityCountry) {
      const seen = new Set(list.map(f => f.id));
      if (facilityGrid) {
        list.push(...yearFactors.filter(f => f.slug === facilityGrid && !seen.has(f.id)
          && (!selScope || f.scope === selScope) && (!selCategory || f.category === selCategory)));
      }
      return list.filter(f => !GRID_SLUGS.has(f.slug) || f.slug === facilityGrid)
        .sort((a, b) => (b.slug === facilityGrid) - (a.slug === facilityGrid));
    }
    // The company's own grid first (a UK company sees "UK grid" on top).
    const ownGrid = GRID_BY_COUNTRY[companyCountry] || (EU_COUNTRIES.has(companyCountry) ? 'eu-grid' : null);
    return ownGrid ? [...list].sort((a, b) => (b.slug === ownGrid) - (a.slug === ownGrid)) : list;
  }, [factors, selScope, selCategory, selectedCountry, questionnaireProfile, companyCountry, facilityCountry, facilityGrid, selectedYear]);
  // Picking a facility can take the chosen source off the list (another
  // country's grid): clear it rather than save what is no longer offered.
  useEffect(() => {
    if (selFactor && !filteredFactors.some(f => String(f.id) === String(selFactor))) setSelFactor('');
  }, [filteredFactors, selFactor]);

  const categories = useMemo(() => {
    // Hoist the country-category Set — O(n) not O(n²)
    const ccCats = (selectedCountry && selectedCountry !== 'global')
      ? new Set(
          factors
            .filter(ff => ff.country === selectedCountry && (!selScope || ff.scope === selScope))
            .map(ff => ff.category)
        )
      : null;
    return [...new Set(
      factors
        .filter(f => !selScope || f.scope === selScope)
        .filter(f => {
          if (!ccCats) return true; // global or no country
          return ccCats.has(f.category) ? f.country === selectedCountry : f.country === 'global';
        })
        .map(f => f.category)
    )].sort((a, b) => (SCOPE3_CATEGORY_NUMBER[a] ?? 99) - (SCOPE3_CATEGORY_NUMBER[b] ?? 99));
  }, [factors, selScope, selectedCountry]);

  const selFactorObj = useMemo(
    () => factors.find(f => f.id === parseInt(selFactor)),
    [factors, selFactor],
  );

  // Filtered + sorted entries
  const filtered = useMemo(() => {
    const base = entries.filter(e => {
      const name = (tr && e.emission_factor_name_tr ? e.emission_factor_name_tr : e.emission_factor_name) || '';
      return (!search         || name.toLowerCase().includes(search.toLowerCase()))
          && (!filterScope    || e.scope === filterScope)
          && (!filterMonth    || (filterMonth === ANNUAL ? isAnnualEntry(e) : !isAnnualEntry(e) && parseInt(e.month) === filterMonth))
          && (!filterFacility || String(e.facility ?? '') === filterFacility);
    });
    return [...base].sort((a, b) => {
      if (sortBy === 'kg_desc') return (parseFloat(b.calculated_co2e_kg) || 0) - (parseFloat(a.calculated_co2e_kg) || 0);
      if (sortBy === 'kg_asc')  return (parseFloat(a.calculated_co2e_kg) || 0) - (parseFloat(b.calculated_co2e_kg) || 0);
      if (sortBy === 'name')    return (a.emission_factor_name || '').localeCompare(b.emission_factor_name || '');
      return parseInt(a.month) - parseInt(b.month); // default: month asc
    });
  }, [entries, search, filterScope, filterMonth, filterFacility, sortBy, tr]);

  const otherYears = (yearsWithData || []).filter(y => y !== Number(selectedYear));

  const maxKg = useMemo(
    () => Math.max(...filtered.map(countedKg), 1),
    [filtered]
  );

  // Totals — memoized so the reduce only re-runs when `filtered` actually changes
  const totalKg = useMemo(
    () => filtered.reduce((a, e) => a + countedKg(e), 0),
    [filtered],
  );

  // Month pill counts — single O(n) pass over entries.
  // Previously 12 inline .filter() calls inside render (one per month pill), which ran
  // entries.length × 12 comparisons on every render including every search keystroke.
  const monthCountMap = useMemo(() => {
    const map = {};
    for (const e of entries) {
      const m = isAnnualEntry(e) ? ANNUAL : parseInt(e.month);
      if (m >= 1 && m <= ANNUAL) map[m] = (map[m] || 0) + 1;
    }
    return map;
  }, [entries]);

  // KPI counts + kg totals — single O(n) pass replaces 6 separate filter/reduce calls
  const countAll = entries.length;
  const { countS1, countS2, countS3, s1kg, s2kg, s3kg, totKg } = useMemo(() => {
    let countS1 = 0, countS2 = 0, countS3 = 0, s1kg = 0, s2kg = 0, s3kg = 0;
    for (const e of entries) {
      const kg = countedKg(e);
      if      (e.scope === 'scope1') { countS1++; s1kg += kg; }
      else if (e.scope === 'scope2') { countS2++; s2kg += kg; }
      else if (e.scope === 'scope3') { countS3++; s3kg += kg; }
    }
    return { countS1, countS2, countS3, s1kg, s2kg, s3kg, totKg: s1kg + s2kg + s3kg };
  }, [entries]);

  // What the cards count: the entries inside their totals (approved only).
  // The scope filter pills above keep counting every listed entry.
  const approvedCount = useMemo(() => {
    const c = { scope1: 0, scope2: 0, scope3: 0 };
    for (const e of entries) if (e.status === 'approved' && c[e.scope] !== undefined) c[e.scope]++;
    return c;
  }, [entries]);
  // Waiting for approval, per scope: the cards said "0 kayıt" while the K2
  // filter beside them counted the pending entry as 1.
  const pendingCount = useMemo(() => {
    const c = { scope1: 0, scope2: 0, scope3: 0 };
    for (const e of entries) if (e.status === 'submitted' && c[e.scope] !== undefined) c[e.scope]++;
    return c;
  }, [entries]);
  const countLabel = (approved, pending) => `${approved} ${tr ? 'onaylı' : 'approved'}${pending ? ` · ${pending} ${tr ? 'bekleyen' : 'pending'}` : ''}`;

  // Not in any total above; shown under the cards for information.
  const notCounted = useMemo(() => {
    // A change or a deletion waiting on an approved entry is counted apart,
    // without an amount: until approved the approved figure stands.
    const out = { pending: { n: 0, kg: 0 }, rejected: { n: 0, kg: 0 }, changes: 0, deletes: 0 };
    // One inventory save is one change, however many rows it recalculated.
    const batches = new Set();
    for (const e of entries) {
      if (e.delete_requested) { out.deletes++; continue; }
      if (e.status === 'submitted' && e.replaces) {
        if (e.change_batch) {
          if (batches.has(e.change_batch)) continue;
          batches.add(e.change_batch);
        }
        out.changes++;
        continue;
      }
      const bucket = e.status === 'submitted' ? out.pending : e.status === 'draft' ? out.rejected : null;
      if (bucket) { bucket.n++; bucket.kg += parseFloat(e.calculated_co2e_kg) || 0; }
    }
    return out;
  }, [entries]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  // Set by "Save anyway" after the server flagged a likely duplicate.
  const [dupWarning, setDupWarning] = useState(false);
  useEffect(() => {
    if (dupWarning) dupWarningRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [dupWarning]);
  const confirmDupRef = useRef(false);
  // "Kaydet ve sonraki ay": keep the source and facility, move to the next
  // month — twelve bills no longer mean twelve times picking the source.
  const saveNextRef = useRef(false);

  const resetAddForm = useCallback(() => {
    setSelScope(''); setSelCategory(''); setSelFactor('');
    setQuantity(''); setDesc(''); setFacility(''); setFile(null); setFormError('');
    setDupWarning(false);
  }, []);

  const handleAdd = useCallback(async (e) => {
    e.preventDefault();
    // Fix 30A: code-level guard — disabled attr can't stop Enter-key submission mid-flight
    if (submitting) return;
    setFormError('');
    const confirmDuplicate = confirmDupRef.current;
    confirmDupRef.current = false;
    const goNext = saveNextRef.current;
    saveNextRef.current = false;
    setDupWarning(false);

    // Client-side file validation
    if (file) {
      if (file.size > MAX_FILE_BYTES) {
        setFormError(tr ? 'Dosya 10 MB sınırını aşıyor.' : 'File exceeds the 10 MB limit.');
        return;
      }
      if (!ALLOWED_MIME.has(file.type)) {
        setFormError(tr ? 'Desteklenmeyen dosya türü.' : 'Unsupported file type.');
        return;
      }
    }

    // Fix 24E: client-side guard — catch missing factor/quantity before hitting the API
    if (!selFactor) {
      setFormError(tr ? 'Lütfen emisyon kaynağı seçin.' : 'Please select an emission source.');
      return;
    }
    if (!(parseLocalizedNumber(quantity) > 0)) {
      setFormError(tr ? 'Geçerli bir miktar girin.' : 'Please enter a valid quantity.');
      return;
    }
    if (isFutureMonth(selectedYear, month)) {
      setFormError(futurePeriodMessage(tr));
      return;
    }

    setSubmitting(true);
    try {
      let res;
      if (file) {
        const fd = new FormData();
        fd.append('emission_factor', parseInt(selFactor));
        fd.append('year', selectedYear);
        fd.append('month', parseInt(month));
        fd.append('quantity', parseLocalizedNumber(quantity));
        fd.append('description', desc);
        if (facility) fd.append('facility', facility);
        fd.append('proof_document', file);
        if (confirmDuplicate) fd.append('confirm_duplicate', 'true');
        res = await api.createEntryWithFile(fd);
      } else {
        // Fix 24A: coerce empty string to null — Django FK rejects '' but accepts null
        res = await api.createEntry({
          emission_factor: parseInt(selFactor), year: selectedYear,
          month: parseInt(month), quantity: parseLocalizedNumber(quantity), description: desc,
          facility: facility || null,
          ...(confirmDuplicate ? { confirm_duplicate: true } : {}),
        });
      }
      if (res.ok) {
        const saved = await res.json().catch(() => ({}));
        const nextMonth = parseInt(month) + 1;
        if (goNext && nextMonth <= 12 && !isFutureMonth(selectedYear, nextMonth)) {
          setQuantity(''); setDesc(''); setFile(null); setFormError(''); setDupWarning(false);
          setMonth(nextMonth); fetchData();
          toast.success(tr
            ? `${fullMonths[parseInt(month) - 1]} kaydedildi${saved.status === 'submitted' ? ' ve onaya gönderildi' : ''} — şimdi ${fullMonths[nextMonth - 1]}`
            : `${fullMonths[parseInt(month) - 1]} saved${saved.status === 'submitted' ? ' and sent for approval' : ''} — now ${fullMonths[nextMonth - 1]}`);
          return;
        }
        setShowAddForm(false); resetAddForm(); fetchData();
        if (saved.status === 'submitted') {
          // Only approved entries count, so the totals won't move yet —
          // say so, or the entry looks lost.
          toast.info(tr
            ? 'Kayıt eklendi ve onaya gönderildi. Onaylandığında toplamlara eklenir.'
            : 'Entry added and sent for approval. It will count in the totals once approved.');
        } else {
          toast.success(tr ? 'Kayıt başarıyla eklendi ✓' : 'Entry added successfully ✓');
        }
      } else {
        // Don't expose raw server response — show a user-friendly message
        if (res.status === 409) {
          // A likely duplicate, or a month of a source the year's inventory
          // already holds as an annual amount (the server says which).
          const d = await res.json().catch(() => ({}));
          // "Yine de kaydet" keeps going to the next month if that was asked.
          saveNextRef.current = goNext;
          setDupWarning(d.code === 'annual_overlap' || d.code === 'yearly_repeat' ? { overlap: tr ? d.message_tr : d.message_en, kind: d.code } : true);
        } else if (res.status === 403) {
          setFormError(noPermissionMessage(tr));
          toast.error(noPermissionMessage(tr));
        } else {
          const d = await res.json().catch(() => ({}));
          const one = (v) => (Array.isArray(v) ? v[0] : v);
          if (String(one(d.code) || '').includes('future_period')) {
            setFormError(futurePeriodMessage(tr));
          } else if (one(d.message_tr) && one(d.message_en)) {
            // A rule the server explains itself (e.g. a facility's electricity
            // needs its own country's grid factor).
            setFormError(String(one(tr ? d.message_tr : d.message_en)));
          } else {
            setFormError(tr ? 'Kayıt eklenemedi. Lütfen alanları kontrol edin.' : 'Could not save entry. Please check your inputs.');
          }
        }
      }
    } catch {
      // Shown next to the Save buttons (a toast sat on top of them on a
      // phone, and the form's own error was below the fold).
      setFormError(tr
        ? 'Kaydedilemedi — internet bağlantınızı kontrol edin. Girdiğiniz bilgiler duruyor; bağlantı gelince tekrar Kaydet\'e basın.'
        : "Couldn't save — check your internet connection. What you entered is kept; press Save again once you're back online.");
    }
    finally { setSubmitting(false); }
  }, [file, tr, selFactor, selectedYear, month, fullMonths, quantity, desc, facility, submitting, toast, resetAddForm, fetchData, setShowAddForm]);

  const handleDelete = useCallback((id) => {
    setDeleteConfirm(id);
  }, []);

  const handleCancelDelete = useCallback(async (id) => {
    try {
      const res = await api.cancelDeleteRequest(id);
      if (res.ok) {
        fetchData();
        toast.success(tr ? 'Silme talebi geri alındı — kayıt onaylı haliyle duruyor' : 'Deletion request withdrawn — the entry stays approved');
      } else {
        toast.error(res.status === 403 ? noPermissionMessage(tr) : (tr ? 'Talep geri alınamadı' : 'Could not withdraw the request'));
      }
    } catch {
      toast.error(tr ? 'Talep geri alınamadı' : 'Could not withdraw the request');
    }
  }, [fetchData, toast, tr]);

  const confirmDelete = useCallback(async () => {
    const id = deleteConfirm;
    setDeleteConfirm(null);
    try {
      const res = await api.deleteEntry(id);
      if (res.status === 202) {
        // A data-entry member's approved entry: deleting it is a request.
        fetchData();
        toast.info(tr
          ? 'Silme talebi onaya gönderildi. Onaylanana kadar kayıt toplamlarda kalır.'
          : 'Deletion request sent for approval. Until approved the entry stays in the totals.');
      } else if (res.ok || res.status === 204) {
        fetchData();
        toast.success(tr ? 'Kayıt silindi' : 'Entry deleted');
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(res.status === 403 ? noPermissionMessage(tr)
          : body?.code === 'edit_in_questionnaire'
            ? (tr ? 'Bu kayıt ankette düzeltilir — ilgili cevabı değiştirin.' : 'This entry is corrected in the questionnaire — change that answer.')
            : (tr ? 'Kayıt silinemedi' : 'Failed to delete entry'));
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    }
  }, [deleteConfirm, tr, toast, fetchData]);

  const handleEdit = useCallback(async (e) => {
    e.preventDefault();
    if (!editing) return;
    // Fix 30B: code-level guard — prevents stale-state double-submit
    if (editSaving) return;
    // Same guard as handleAdd's — this form's quantity input had no min="0"
    // and no pre-submit check, so an entry could be edited down to 0 or a
    // negative quantity (silently rejected by the backend as a raw
    // "Update failed" toast instead of this friendly message).
    if (!(parseLocalizedNumber(editQty) > 0)) {
      toast.error(tr ? 'Geçerli bir miktar girin.' : 'Please enter a valid quantity.');
      return;
    }
    setEditSaving(true);
    try {
      // Fix 24B: coerce empty string to null — Django FK rejects '' but accepts null
      const res = await api.updateEntry(editing.id, {
        quantity: parseLocalizedNumber(editQty), facility: editFacility || null,
        // Keep a system-written description unless the user typed a new one;
        // never touch the questionnaire's own (it finds its entries by it).
        ...(isLinkedDescription(editing.description) || (autoDescriptionLabel(editing.description, tr) && !editDesc.trim())
          ? {} : { description: editDesc }),
      });
      if (res.ok) {
        const saved = await res.json().catch(() => ({}));
        const backToReview = editing.status === 'approved' && saved.status === 'submitted';
        setEditing(null); fetchData();
        if (saved.pending_change) {
          // A data-entry member's change to an approved entry waits next to it.
          toast.info(tr
            ? 'Değişiklik onaya gönderildi. Onaylanana kadar mevcut değer toplamlarda kalır.'
            : 'Change sent for approval. Until approved the current value stays in the totals.');
        } else if (backToReview) {
          // Changing the amount of an approved entry is a new figure: it
          // waits for approval again.
          toast.info(tr ? 'Kayıt güncellendi ve yeniden onaya gönderildi.' : 'Entry updated and sent for approval again.');
        } else {
          toast.success(tr ? 'Kayıt güncellendi' : 'Entry updated');
        }
      } else {
        toast.error(res.status === 403 ? noPermissionMessage(tr) : (tr ? 'Güncelleme başarısız' : 'Update failed'));
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally { setEditSaving(false); }
  }, [editing, editQty, editDesc, editFacility, editSaving, tr, toast, fetchData]);

  const uploadProof = useCallback(async (file) => {
    if (!editing || !file || proofBusy) return;
    setProofBusy(true);
    try {
      const res = await api.uploadProof(editing.id, file);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditing(data);
        fetchData();
        toast.success(tr ? 'Kanıt belgesi kaydedildi' : 'Proof document saved');
      } else if (res.status === 403) {
        toast.error(noPermissionMessage(tr));
      } else {
        const msg = Array.isArray(data?.proof_document) ? data.proof_document[0] : data?.error;
        toast.error(tr
          ? (/type not allowed/i.test(msg || '') ? 'Bu dosya türü desteklenmiyor (PDF, JPG, PNG, Word, Excel).'
             : /10MB/i.test(msg || '') ? 'Dosya 10 MB’tan küçük olmalı.' : 'Kanıt yüklenemedi.')
          : (msg || 'Could not upload the proof.'));
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally { setProofBusy(false); }
  }, [editing, proofBusy, tr, toast, fetchData]);

  const removeProof = useCallback(async () => {
    if (!editing || proofBusy) return;
    setProofBusy(true);
    try {
      const res = await api.removeProof(editing.id);
      if (res.ok || res.status === 204) {
        setEditing({ ...editing, proof_document: null, proof_available: false });
        setConfirmProofRemove(false);
        fetchData();
        toast.success(tr ? 'Kanıt belgesi kaldırıldı' : 'Proof document removed');
      } else {
        toast.error(res.status === 403 ? noPermissionMessage(tr) : (tr ? 'Kanıt kaldırılamadı.' : 'Could not remove the proof.'));
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally { setProofBusy(false); }
  }, [editing, proofBusy, tr, toast, fetchData]);

  // Questionnaire records are corrected on their own question: the
  // Karbon Envanteri tab opens that inventory at that question.
  const fixInQuestionnaire = useCallback((src) => {
    try { sessionStorage.setItem('carboniq_open_request', JSON.stringify(src)); } catch {}
    setEditing(null);
    window.dispatchEvent(new CustomEvent('carboniq-navigate', { detail: { tab: 'questionnaire' } }));
  }, []);

  const openEdit = useCallback((entry) => {
    setEditing(entry);
    setConfirmProofRemove(false);
    setEditQty(entry.quantity);
    // A system-written description ("AI Chat: …") opens empty, with its
    // readable form as the placeholder; typing replaces it.
    setEditDesc(autoDescriptionLabel(entry.description, tr) ? '' : (entry.description || ''));
    setEditFacility(entry.facility || '');
  }, [tr]);

  const handleCustom = useCallback(async (e) => {
    e.preventDefault();
    // Fix 30C: code-level guard — prevents stale-state double-submit
    if (cSaving) return;
    // Same guard as handleAdd's — this form's quantity input had no min="0"
    // and no pre-submit check.
    if (!(parseLocalizedNumber(cQty) > 0)) {
      toast.error(tr ? 'Geçerli bir miktar girin.' : 'Please enter a valid quantity.');
      return;
    }
    if (isFutureMonth(selectedYear, cMonth)) {
      toast.error(futurePeriodMessage(tr));
      return;
    }
    setCSaving(true);
    try {
      const res = await api.createCustomRequest({
        scope: cScope, category_name: cCat, source_name: cSrc,
        description: cDesc, unit: cUnit, quantity: parseLocalizedNumber(cQty),
        year: selectedYear, month: parseInt(cMonth),
        facility: cFacility ? parseInt(cFacility) : null,
      });
      if (res.ok) {
        setShowCustom(false);
        setCCat(''); setCSrc(''); setCDesc(''); setCUnit(''); setCUnitOther(false); setCQty(''); setCFacility('');
        fetchData();
        toast.info(tr ? 'Özel talep gönderildi — Carbonless ekibi inceleyecek' : 'Custom request submitted — the Carbonless team will review it');
      } else {
        toast.error(res.status === 403 ? noPermissionMessage(tr) : (tr ? 'Talep gönderilemedi' : 'Failed to submit request'));
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setCSaving(false);
    }
  }, [cScope, cCat, cSrc, cDesc, cUnit, cQty, cFacility, selectedYear, cMonth, cSaving, tr, toast, fetchData, setShowCustom]);

  // ── Escape key handlers — one per modal ─────────────────────────────────
  useEffect(() => {
    if (!showAddForm) return;
    const onKey = (e) => { if (e.key === 'Escape' && !submitting) { setShowAddForm(false); resetAddForm(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAddForm, submitting, setShowAddForm, resetAddForm]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e) => { if (e.key === 'Escape' && !editSaving) setEditing(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, editSaving]);

  useEffect(() => {
    if (!showCustom) return;
    const onKey = (e) => { if (e.key === 'Escape' && !cSaving) setShowCustom(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCustom, cSaving]);

  // ── Shared modal classes ─────────────────────────────────────────────────
  const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 backdrop-blur-md';
  const MODAL   = 'flex max-h-[90svh] w-full flex-col overflow-hidden rounded-3xl border border-[#072C0E]/8 bg-white/94 shadow-[0_20px_60px_rgba(7, 44, 14,0.14)] backdrop-blur-2xl';
  const FIELD   = 'h-12 w-full rounded-2xl border border-[#072C0E]/10 bg-[#DEFAE1]/40 px-4 text-sm font-medium text-[#072C0E] outline-none transition focus:ring-4 focus:ring-[#2ABD41]/15';
  const LABEL   = 'mb-1.5 block text-xs font-bold text-[#072C0E]/60';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 sm:space-y-4">
      <style>{DASHBOARD_ANIM_STYLES}</style>

      {/* ── Hero header ───────────────────────────────────────────────── */}
      <div className="dash-fade-up relative overflow-hidden rounded-[1.5rem] border border-[#072C0E]/10 bg-[#F1FCF2] p-4 shadow-[0_6px_24px_rgba(7, 44, 14,0.05)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2ABD41]">
              {tr ? 'Emisyon çalışma alanı' : 'Emission workspace'}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-[-0.03em] sm:text-2xl">
              {tr ? 'Emisyon Yönetimi' : 'Emission Management'} · {selectedYear}
            </h1>
            <p className="mt-0.5 text-sm text-[#072C0E]/55">
              {tr ? 'Aktivite verilerinizi girin ve yönetin' : 'Record and manage your activity data'}
            </p>
          </div>
          {canEdit ? (
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#072C0E] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#072C0E]/15 transition-colors hover:bg-[#175022]"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr ? 'Yeni Kayıt' : 'New Entry'}
            </button>
            <button
              onClick={() => setShowCustom(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#072C0E]/15 bg-white px-4 py-2.5 text-xs font-bold text-[#072C0E]/60 transition hover:border-[#072C0E]/25 hover:bg-[#DEFAE1]/60"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr ? 'Özel Talep' : 'Custom Request'}
            </button>
          </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-[#072C0E]/10 bg-[#F8F8F8] px-4 py-2 text-xs font-bold text-[#072C0E]/55 sm:shrink-0">
              {tr ? 'Salt okunur erişim' : 'Read-only access'}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI mini cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: tr ? 'Toplam tCO₂e' : 'Total tCO₂e', value: totKg/1000, sub: countLabel(approvedCount.scope1 + approvedCount.scope2 + approvedCount.scope3, pendingCount.scope1 + pendingCount.scope2 + pendingCount.scope3), color: null },
          { label: tr ? 'Kapsam 1' : 'Scope 1', value: s1kg/1000, sub: countLabel(approvedCount.scope1, pendingCount.scope1), color: '#072C0E' },
          { label: tr ? 'Kapsam 2' : 'Scope 2', value: s2kg/1000, sub: countLabel(approvedCount.scope2, pendingCount.scope2), color: '#2ABD41' },
          { label: tr ? 'Kapsam 3' : 'Scope 3', value: s3kg/1000, sub: countLabel(approvedCount.scope3, pendingCount.scope3), color: '#8BEA99' },
        ].map((k, i) => (
          <EmissionsKPI key={k.label} label={k.label} value={k.value} sub={k.sub} color={k.color} delay={i * 60} />
        ))}
      </div>

      {(notCounted.pending.n > 0 || notCounted.rejected.n > 0 || notCounted.changes > 0 || notCounted.deletes > 0) && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs leading-5 text-amber-800">
          <span className="font-bold">{tr ? 'Bilgi: ' : 'For information: '}</span>
          {notCountedText({
            pending: { count: notCounted.pending.n, total_kg: notCounted.pending.kg },
            rejected: { count: notCounted.rejected.n, total_kg: notCounted.rejected.kg },
            changes: { count: notCounted.changes },
            delete_requests: { count: notCounted.deletes },
          }, tr)}
        </p>
      )}

      {/* ── Search + Scope filter ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-[#072C0E]/10 bg-white px-3.5 py-2.5 shadow-sm">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#072C0E]/30" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tr ? 'Kaynak ara…' : 'Search source…'}
            aria-label={tr ? 'Emisyon kaynaklarında ara' : 'Search emission sources'}
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#072C0E] outline-none placeholder:text-[#072C0E]/30"
          />
          {search && (
            <button aria-label={tr ? 'Aramayı temizle' : 'Clear search'} onClick={() => setSearch('')} className="text-[#072C0E]/30 hover:text-[#072C0E]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Scope pills */}
        <div className="flex gap-1.5">
          {[
            { val: '', label: tr ? 'Tümü' : 'All', count: countAll },
            { val: 'scope1', label: tr ? 'K1' : 'S1', count: countS1 },
            { val: 'scope2', label: tr ? 'K2' : 'S2', count: countS2 },
            { val: 'scope3', label: tr ? 'K3' : 'S3', count: countS3 },
          ].map(p => (
            <button
              key={p.val}
              onClick={() => setFilterScope(p.val)}
              className={`rounded-full px-3 py-2 text-[11px] font-bold transition ${
                filterScope === p.val
                  ? 'bg-[#175022] text-white'
                  : 'border border-[#072C0E]/10 bg-white text-[#072C0E]/60 hover:bg-[#072C0E]/5'
              }`}
            >
              {p.label} <span className="opacity-60">{p.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Month filter + Facility + Sort ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Month pills (only months that actually have data) */}
        <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilterMonth(0)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              filterMonth === 0
                ? 'bg-[#175022] text-white'
                : 'border border-[#072C0E]/10 bg-white text-[#072C0E]/60 hover:bg-[#072C0E]/5'
            }`}
          >
            {tr ? 'Tüm Aylar' : 'All Months'}
          </button>
          {[...months, tr ? 'Yıllık' : 'Annual'].map((m, i) => {
            const mo = i + 1;
            const count = monthCountMap[mo] || 0;
            if (count === 0) return null;
            return (
              <button
                key={mo}
                onClick={() => setFilterMonth(filterMonth === mo ? 0 : mo)}
                className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition ${
                  filterMonth === mo
                    ? 'bg-[#175022] text-white'
                    : 'border border-[#072C0E]/10 bg-white text-[#072C0E]/60 hover:bg-[#072C0E]/5'
                }`}
              >
                {m}
                <span className="ml-0.5 text-[9px] opacity-50">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Facility filter (only when multiple facilities exist) */}
        {facilityList.length > 1 && (
          <select
            value={filterFacility}
            onChange={e => setFilterFacility(e.target.value)}
            className="shrink-0 rounded-xl border border-[#072C0E]/10 bg-white px-3 py-2 text-[11px] font-bold text-[#072C0E] shadow-sm outline-none transition hover:bg-[#DEFAE1]/60"
          >
            <option value="">{tr ? 'Tüm Tesisler' : 'All Facilities'}</option>
            {facilityList.map(f => (
              <option key={f.id} value={String(f.id)}>{f.name}</option>
            ))}
          </select>
        )}

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="shrink-0 rounded-xl border border-[#072C0E]/10 bg-white px-3 py-2 text-[11px] font-bold text-[#072C0E] shadow-sm outline-none transition hover:bg-[#DEFAE1]/60"
        >
          <option value="month">{tr ? 'Ay ↑' : 'Month ↑'}</option>
          <option value="kg_desc">{tr ? 'CO₂e ↓' : 'CO₂e ↓'}</option>
          <option value="kg_asc">{tr ? 'CO₂e ↑' : 'CO₂e ↑'}</option>
          <option value="name">{tr ? 'İsme göre' : 'By name'}</option>
        </select>
      </div>

      {/* ── Active filter summary chip ────────────────────────────────── */}
      {(filterMonth !== 0 || filterFacility || search || filterScope) && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#072C0E]/40 font-semibold">
            {tr ? 'Filtre aktif:' : 'Filtered:'}{' '}
            <strong className="text-[#072C0E]">{filtered.length}</strong>
            {' / '}{entries.length}{' '}{tr ? 'kayıt' : 'entries'}
          </span>
          <button
            onClick={() => { setSearch(''); setFilterScope(''); setFilterMonth(0); setFilterFacility(''); }}
            className="inline-flex items-center gap-1 rounded-full border border-[#072C0E]/10 bg-white px-2.5 py-1 font-bold text-[#072C0E]/50 transition hover:border-red-200 hover:text-red-500"
          >
            <X className="h-3 w-3" />
            {tr ? 'Temizle' : 'Clear'}
          </button>
        </div>
      )}

      {/* ── Custom Requests list ──────────────────────────────────────── */}
      {customRequests.length > 0 && (
        <div className="rounded-[1.5rem] border border-[#072C0E]/8 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#2ABD41]">
            {tr ? 'Özel Talepler' : 'Custom Requests'}
          </p>
          {customApprovedKg > 0 && (
            <p role="note" className="mb-3 rounded-xl border border-[#2ABD41]/25 bg-[#F1FCF2] px-3 py-2 text-[11px] font-semibold leading-4 text-[#175022]">
              {tr
                ? `${selectedYear} yılı onaylı özel talepler: ${fixed(customApprovedKg / 1000, 2)} tCO₂e. Bu tutar Kontrol Paneli ve raporlardaki toplama dahildir; bu sayfadaki kayıt toplamlarına dahil değildir.`
                : `Approved custom requests for ${selectedYear}: ${fixed(customApprovedKg / 1000, 2)} tCO₂e. This is included in the dashboard and report totals, not in the entry totals on this page.`}
            </p>
          )}
          <div className="space-y-2">
            {customRequests.map(cr => (
              <div key={cr.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#072C0E]/6 bg-[#F8F8F8]/60 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#072C0E]">{cr.source_name}</p>
                  <p className="text-[10px] text-[#072C0E]/45">{cr.category_name} · {fmt(cr.quantity, 4)} {cr.unit} · {months[(cr.month || 1) - 1]} {cr.year}</p>
                  {cr.status === 'approved' && cr.electricity_method && (
                    <p className="mt-0.5 text-[10px] text-[#175022]">
                      {cr.electricity_method === 'market_based'
                        ? (tr ? `Onaylanan faktör ${fmt(cr.approved_factor_kg_co2e, 6)} kg CO₂e/kWh — yalnızca piyasa bazlı Kapsam 2 sonucunda kullanılır, toplamlara eklenmez.`
                              : `Approved factor ${fmt(cr.approved_factor_kg_co2e, 6)} kg CO₂e/kWh — used only in the market-based Scope 2 result, not added to the totals.`)
                        : (tr ? `Onaylanan faktör ${fmt(cr.approved_factor_kg_co2e, 6)} kg CO₂e/kWh — bu tesisin ${cr.year} elektriği envanterde bu faktörle hesaplanır; talebin miktarı ayrıca eklenmez.`
                              : `Approved factor ${fmt(cr.approved_factor_kg_co2e, 6)} kg CO₂e/kWh — this facility's ${cr.year} electricity in the inventory is calculated with it; the request's amount is not added on top.`)}
                    </p>
                  )}
                  {cr.status === 'rejected' && cr.admin_notes && (
                    <p className="mt-0.5 text-[10px] text-red-500">{tr ? 'Not' : 'Note'}: {cr.admin_notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  cr.status === 'approved' ? 'bg-[#2ABD41]/12 text-[#175022]' :
                  cr.status === 'rejected' ? 'bg-red-50 text-red-500' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  {cr.status === 'approved' ? (tr ? 'Onaylandı' : 'Approved') :
                   cr.status === 'rejected' ? (tr ? 'Reddedildi' : 'Rejected') :
                   (tr ? 'Beklemede' : 'Pending')}
                  {cr.status === 'approved' && cr.calculated_co2e_kg && !cr.electricity_method
                    ? ` · ${fixed((cr.calculated_co2e_kg / 1000), 4)} t` : ''}
                </span>
                {cr.status === 'pending' && (canApprove || cr.username === currentUsername) && (
                  <button
                    type="button"
                    onClick={() => setWithdrawing(cr)}
                    className="rounded-full border border-[#072C0E]/10 px-2.5 py-1 text-[10px] font-bold text-[#072C0E]/60 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    {tr ? 'Geri çek' : 'Withdraw'}
                  </button>
                )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-[#072C0E]/8 bg-white p-12 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2ABD41]/10 text-[#2ABD41]">
            <Leaf className="h-7 w-7" />
          </div>
          <div>
            <p className="text-base font-bold text-[#072C0E]">
              {customApprovedKg > 0
                ? (tr ? `${selectedYear} için henüz kayıt yok` : `No entries for ${selectedYear} yet`)
                : otherYears.length > 0
                ? (tr ? `${selectedYear} için henüz veri yok` : `No data for ${selectedYear} yet`)
                : (tr ? 'Henüz veri yok' : 'No emission data yet')}
            </p>
            <p className="mt-1 text-sm text-[#072C0E]/50">
              {otherYears.length > 0
                ? (tr ? `Kayıtlarınız başka yıllarda: ${otherYears.join(', ')}.` : `Your entries are in other years: ${otherYears.join(', ')}.`)
                : (tr ? 'Fatura, sayaç okuma veya ESG raporunuzdan veri ekleyin.' : 'Add data from invoices, meter readings or your ESG report.')}
            </p>
          </div>
          {otherYears.length > 0 && onYearChange && (
            <button
              onClick={() => onYearChange(otherYears[0])}
              className="mt-1 rounded-full border border-[#2ABD41] bg-[#F1FCF2] px-5 py-2.5 text-xs font-semibold text-[#175022] transition hover:bg-[#DEFAE1]"
            >
              {tr ? `${otherYears[0]} yılına geç` : `Switch to ${otherYears[0]}`}
            </button>
          )}
          {canEdit && <button
            onClick={() => setShowAddForm(true)}
            className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#072C0E] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#072C0E]/15 transition hover:bg-[#175022]"
          >
            <Plus className="h-3.5 w-3.5" />
            {tr ? 'İlk Kaydı Ekle' : 'Add First Entry'}
          </button>}
        </div>
      )}

      {/* ── DESKTOP TABLE (md+) ───────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="hidden overflow-hidden rounded-[1.5rem] border border-[#072C0E]/8 bg-white shadow-[0_4px_20px_rgba(7, 44, 14,0.04)] md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b border-[#072C0E]/6 bg-[#F8F8F8]/80">
                <tr>
                  {[
                    tr ? 'Kaynak' : 'Source',
                    tr ? 'Kapsam' : 'Scope',
                    tr ? 'Ay' : 'Month',
                    tr ? 'Miktar' : 'Qty',
                    'kg CO₂e',
                    'tCO₂e',
                    tr ? 'CO₂e payı' : 'CO₂e share',
                    tr ? 'İşlemler' : 'Actions',
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#072C0E]/35 ${
                        i >= 3 && i <= 6 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#072C0E]/5">
                {filtered.map(entry => {
                  const sm = SCOPE_META[entry.scope] ?? SCOPE_META.scope1;
                  const st = entryStatusMeta(entry);
                  const kg = parseFloat(entry.calculated_co2e_kg) || 0;
                  const barPct = maxKg > 0 ? (countedKg(entry) / maxKg) * 100 : 0;
                  // The share of the (filtered) total — the bar is scaled to
                  // the largest row, the number is not.
                  const sharePct = totalKg > 0 ? (countedKg(entry) / totalKg) * 100 : 0;
                  const name = (tr && entry.emission_factor_name_tr) ? entry.emission_factor_name_tr : entry.emission_factor_name;
                  const how = entry.questionnaire_source ? entrySourceLabel(entry, tr) : null;
                  return (
                    <tr key={entry.id} data-entry-id={entry.id}
                      className={`group/row transition-colors hover:bg-[#DEFAE1]/40 ${focusedId === String(entry.id) ? 'bg-[#DEFAE1] outline outline-2 outline-[#2ABD41]' : ''}`}>
                      {/* Source */}
                      <td className="max-w-[220px] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold text-[#072C0E]">{name}</span>
                          <ProofButton entry={entry} tr={tr} toast={toast} className="shrink-0 transition" />
                        </div>
                        {how && (
                          <p className="mt-0.5 truncate text-[10px] text-[#072C0E]/45" title={how}>{how}</p>
                        )}
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${st.bg} ${st.text}`}>
                            {tr ? st.tr : st.en}
                          </span>
                          {approvedValueText(entry, tr) && (
                            <span className="text-[10px] font-semibold text-amber-700">({approvedValueText(entry, tr)})</span>
                          )}
                          {entry.status === 'draft' && entry.rejected_reason && (
                            <span className="truncate text-[10px] font-medium text-red-600" title={entry.rejected_reason}>
                              {tr ? 'Red nedeni' : 'Reason'}: {entry.rejected_reason}
                            </span>
                          )}
                          {entry.facility_name && (
                            <span className="text-[9px] text-[#072C0E]/35">{entry.facility_name}</span>
                          )}
                          <FactorCountryBadge entry={entry} tr={tr} className="w-fit" />
                        </div>
                      </td>
                      {/* Scope */}
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${sm.bg} ${sm.text}`}>
                          {tr ? sm.label.replace('Scope', 'Kapsam') : sm.label}
                        </span>
                      </td>
                      {/* Month */}
                      <td className="px-4 py-3 text-xs text-[#072C0E]/50">{entryPeriodLabel(entry, months, tr)}</td>
                      {/* Quantity */}
                      <td className="px-4 py-3 text-right text-xs font-semibold text-[#072C0E]/70">
                        {fmt(entry.quantity)} <span className="text-[#072C0E]/30">{unitLabel(entry.unit, tr)}</span>
                      </td>
                      {/* kg CO₂e */}
                      <td className="px-4 py-3 text-right text-[13px] font-bold text-[#072C0E]">
                        {fmt(kg)}
                      </td>
                      {/* tCO₂e */}
                      <td className="px-4 py-3 text-right text-xs text-[#072C0E]/40">
                        {fixed((kg / 1000), 4)}
                      </td>
                      {/* Bar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#072C0E]/5">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.max(barPct, barPct > 0 ? 2 : 0)}%`, backgroundColor: sm.bar }}
                            />
                          </div>
                          <span className="w-8 text-right text-[9px] font-bold text-[#072C0E]/30"
                            title={entry.status !== 'approved' ? (tr ? 'Onaylanmadığı için toplamda yok' : 'Not in the totals until approved') : undefined}>
                            {entry.status !== 'approved' ? '—'
                              : sharePct > 0 && sharePct < 0.1 ? (tr ? '<%0,1' : '<0.1%')
                              : (tr ? `%${fixed(sharePct, sharePct < 1 ? 1 : 0)}` : `${fixed(sharePct, sharePct < 1 ? 1 : 0)}%`)}
                          </span>
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3">
                        {canChange(entry) && canWithdrawDelete(entry) && (
                          <div className="mb-1 flex justify-end">
                            <WithdrawDeleteButton tr={tr} onClick={() => handleCancelDelete(entry.id)} />
                          </div>
                        )}
                        {canChange(entry) && <div className="flex justify-end gap-1 opacity-0 transition group-hover/row:opacity-100">
                          <button
                            onClick={() => openEdit(entry)}
                            aria-label={tr ? 'Kaydı düzenle' : 'Edit entry'}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#072C0E]/35 transition hover:bg-[#2ABD41]/12 hover:text-[#2ABD41]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            aria-label={tr ? 'Kaydı sil' : 'Delete entry'}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#072C0E]/35 transition hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot className="border-t-2 border-[#072C0E]/8 bg-[#F8F8F8]/60">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-[#072C0E]/50">
                    {filtered.length} {tr ? 'kayıt' : 'entries'}
                    {filtered.some(e => e.status !== 'approved') && (
                      <span className="font-semibold"> · {tr ? 'toplam yalnızca onaylı kayıtlar' : 'total: approved entries only'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-[#072C0E]">
                    {fmt(totalKg)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-[#072C0E]/60">
                    {fixed((totalKg / 1000), 3)} t
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── MOBILE CARDS (< md) ───────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="space-y-2 md:hidden">
          {filtered.map(entry => (
            <EntryCard
              key={entry.id}
              focused={focusedId === String(entry.id)}
              entry={entry}
              months={months}
              language={language}
              maxKg={maxKg}
              onEdit={openEdit}
              onDelete={handleDelete}
              onCancelDelete={handleCancelDelete}
              canEdit={canChange(entry)}
            />
          ))}
          {/* Mobile totals */}
          <div className="flex items-center justify-between rounded-xl border border-[#072C0E]/8 bg-white px-4 py-3">
            <span className="text-xs font-bold text-[#072C0E]/40">
              {filtered.length} {tr ? 'kayıt' : 'entries'} · {filtered.some(e => e.status !== 'approved')
                ? (tr ? 'Onaylı toplam' : 'Approved total')
                : (tr ? 'Toplam' : 'Total')}
            </span>
            <span className="text-sm font-bold text-[#072C0E]">
              {fmt(totalKg)} kg · {fixed((totalKg / 1000), 3)} t
            </span>
          </div>
        </div>
      )}

      {/* ── No results (filtered) ─────────────────────────────────────── */}
      {entries.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#072C0E]/6 bg-white/60 py-10 text-center">
          <p className="text-sm font-bold text-[#072C0E]/40">{tr ? 'Sonuç bulunamadı' : 'No results found'}</p>
          <button onClick={() => { setSearch(''); setFilterScope(''); setFilterMonth(0); setFilterFacility(''); }} className="text-xs font-bold text-[#2ABD41] hover:underline">
            {tr ? 'Filtreyi temizle' : 'Clear filters'}
          </button>
        </div>
      )}

      {/* ═══════════════════ ADD ENTRY MODAL ═════════════════════════════ */}
      {showAddForm && canEdit && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-3xl`} role="dialog" aria-modal="true" aria-labelledby="add-entry-title">
            <div className="flex shrink-0 items-center justify-between border-b border-[#072C0E]/8 px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <h2 id="add-entry-title" className="text-lg font-bold tracking-[-0.02em]">{tr ? 'Emisyon Verisi Ekle' : 'Add Emission Entry'}</h2>
                <p className="mt-0.5 text-xs text-[#072C0E]/45">{tr ? 'Aktivite verisi ve kanıt belgesi kaydedin' : 'Record activity data and supporting evidence'}</p>
              </div>
              <button aria-label={tr ? 'Kapat' : 'Close'} onClick={() => { setShowAddForm(false); resetAddForm(); }} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#072C0E]/40 hover:bg-[#072C0E]/5"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <form id="add-entry-form" onSubmit={handleAdd} className="space-y-5">
                {/* Scope */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2ABD41]">{tr ? 'Emisyon bilgisi' : 'Emission info'}</p>
                  <div>
                    <p id="add-entry-scope" className={LABEL}>{tr ? 'Kapsam' : 'Scope'}</p>
                    <div role="group" aria-labelledby="add-entry-scope" className="grid grid-cols-3 gap-2">
                      {[
                        { val: 'scope1', label: tr ? 'Kapsam 1' : 'Scope 1', sub: tr ? 'Doğrudan' : 'Direct' },
                        { val: 'scope2', label: tr ? 'Kapsam 2' : 'Scope 2', sub: tr ? 'Enerji' : 'Energy' },
                        { val: 'scope3', label: tr ? 'Kapsam 3' : 'Scope 3', sub: tr ? 'Dolaylı' : 'Indirect' },
                      ].map(s => (
                        <button key={s.val} type="button" aria-pressed={selScope === s.val}
                          onClick={() => { setSelScope(s.val); setSelCategory(''); setSelFactor(''); }}
                          className={`rounded-2xl border px-3 py-3 text-center transition ${selScope === s.val ? 'border-[#2ABD41]/50 bg-[#2ABD41]/10 ring-2 ring-[#2ABD41]/15' : 'border-[#072C0E]/10 bg-[#DEFAE1]/40 hover:border-[#2ABD41]/30'}`}
                        >
                          <p className="text-xs font-bold">{s.label}</p>
                          <p className="text-[10px] text-[#072C0E]/40">{s.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selScope && (
                    <div>
                      <label htmlFor="add-entry-category" className={LABEL}>{tr ? 'Kategori' : 'Category'}</label>
                      <select id="add-entry-category" value={selCategory} onChange={e => { setSelCategory(e.target.value); setSelFactor(''); }} className={FIELD}>
                        <option value="">{tr ? 'Seçiniz' : 'Select'}</option>
                        {categories.map(c => (
                          <option key={c} value={c}>
                            {selScope === 'scope3' && SCOPE3_CATEGORY_NUMBER[c] ? `${tr ? 'Kat.' : 'Cat.'} ${SCOPE3_CATEGORY_NUMBER[c]} — ` : ''}{catLabel(c)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selCategory && (
                    <div>
                      <label htmlFor="add-entry-source" className={LABEL}>{tr ? 'Emisyon Kaynağı' : 'Emission Source'}</label>
                      <select id="add-entry-source" value={selFactor} onChange={e => setSelFactor(e.target.value)} className={FIELD}>
                        <option value="">{tr ? 'Seçiniz' : 'Select'}</option>
                        {filteredFactors.map(f => (
                          <option key={f.id} value={f.id}>
                            {tr && f.name_tr ? f.name_tr : f.name} ({factorLabel(f.factor_kg_co2e, f.unit, tr)})
                          </option>
                        ))}
                      </select>
                      {(() => {
                        if (!facilityCountry || selCategory !== 'electricity') return null;
                        const where = COUNTRY_NAME[facilityCountry]?.[tr ? 'tr' : 'en'] || facilityCountry;
                        const g = facilityGrid && filteredFactors.find(f => f.slug === facilityGrid);
                        if (!g && needsConnection && !approvedFacilityFactor) {
                          return (
                            <p role="note" className="mt-1.5 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                              {tr
                                ? 'Bu tesisin şebeke bağlantı türü (iletim / dağıtım) seçilmedi; resmi Türkiye faktörü buna göre değişir. Ayarlar › Tesisler\'den bağlantı türünü seçin — o zamana kadar bu tesisin elektriği hesaplanmaz.'
                                : 'This facility\'s grid connection (transmission / distribution) is not chosen; the official Turkish factor depends on it. Choose it in Settings › Facilities — until then this facility\'s electricity is not calculated.'}
                            </p>
                          );
                        }
                        if (!g && approvedFacilityFactor) {
                          return (
                            <p role="note" className="mt-1.5 rounded-xl bg-[#2ABD41]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#175022]">
                              {tr
                                ? `Bu tesisin ${selectedYear} elektrik faktörü Özel Talep #${approvedFacilityFactor.id} ile onaylandı (${fmt(approvedFacilityFactor.approved_factor_kg_co2e, 6)} kg CO₂e/kWh). Bu faktör envanterin elektrik sorusunda (Soru 68) uygulanır — bu tesisin elektrik tüketimini orada girin veya güncelleyin.`
                                : `This facility's ${selectedYear} electricity factor was approved with Custom Request #${approvedFacilityFactor.id} (${fmt(approvedFacilityFactor.approved_factor_kg_co2e, 6)} kg CO₂e/kWh). It applies in the inventory's electricity question (Q68) — enter or update this facility's electricity consumption there.`}
                            </p>
                          );
                        }
                        if (!g) {
                          return (
                            <p role="note" className="mt-1.5 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                              {tr
                                ? `Seçili tesis ${where} konumunda ve bu ülke için kayıtlı bir elektrik şebekesi faktörü yok; başka bir ülkenin faktörü kullanılmaz. Doğru faktörün belirlenmesi için Özel Talep gönderin.`
                                : `The selected facility is in ${where}, and there is no registered electricity grid factor for that country; another country's factor is not used. Send a Custom Request so the right factor can be set.`}
                            </p>
                          );
                        }
                        const name = tr && g.name_tr ? g.name_tr : g.name;
                        return (
                          <p className="mt-1.5 text-[11px] text-[#072C0E]/60">
                            {tr
                              ? `Seçili tesis ${where} konumunda: elektriği o ülkenin şebeke faktörüyle ("${name}") hesaplanır.`
                              : `The selected facility is in ${where}: its electricity is calculated with that country's grid factor ("${name}").`}
                          </p>
                        );
                      })()}
                    </div>
                  )}

                  {selFactorObj && (
                    <div className="rounded-2xl border border-[#2ABD41]/25 bg-[#2ABD41]/8 px-4 py-3">
                      <p className="text-xs font-bold text-[#175022]">{tr ? 'Faktör:' : 'Factor:'} {factorLabel(selFactorObj.factor_kg_co2e, selFactorObj.unit, tr)}</p>
                      <p className="mt-0.5 text-[10px] text-[#175022]/70">⚠️ {tr ? `Miktarı ${unitLabel(selFactorObj.unit, tr)} cinsinden girin` : `Enter quantity in ${unitLabel(selFactorObj.unit, tr)}`}</p>
                      {selFactorObj.is_yearly && (
                        <p className="mt-1.5 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                          {tr
                            ? 'Bu kaynak yıllık (ya da tek seferlik) bir miktardır: yılın toplamını bir kez, herhangi bir aya girin. Her ay girerseniz birden fazla kez sayılır.'
                            : 'This source is a yearly (or one-off) amount: enter the year\'s total once, under any month. Entered every month, it is counted more than once.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Measurement */}
                <div className="space-y-3 border-t border-[#072C0E]/8 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2ABD41]">{tr ? 'Ölçüm' : 'Measurement'}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="add-entry-month" className={LABEL}>{tr ? `Ay · ${selectedYear}` : `Month · ${selectedYear}`}</label>
                      <select id="add-entry-month" value={month} onChange={e => setMonth(e.target.value)} className={FIELD}>
                        {months.map((m, i) => <option key={m} value={i + 1} disabled={isFutureMonth(selectedYear, i + 1)}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="add-entry-quantity" className={LABEL}>{tr ? 'Miktar' : 'Quantity'}{selFactorObj ? ` (${unitLabel(selFactorObj.unit, tr)})` : ''}</label>
                      <input id="add-entry-quantity" type="text" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} className={FIELD} />
                    </div>
                  </div>
                  <p className="-mt-1 text-[11px] text-[#072C0E]/45">{yearHint}</p>
                  {quantity && selFactorObj && (
                    <div className="rounded-2xl border border-[#2ABD41]/25 bg-[#2ABD41]/8 px-4 py-3">
                      <p className="text-xs font-bold text-[#175022]">
                        {tr ? 'Tahmini:' : 'Estimated:'}{' '}
                        {fixed((parseLocalizedNumber(quantity) * parseFloat(selFactorObj.factor_kg_co2e)), 2)} kg CO₂e
                        {' '}({fixed(((parseLocalizedNumber(quantity) * parseFloat(selFactorObj.factor_kg_co2e)) / 1000), 4)} t)
                      </p>
                    </div>
                  )}
                </div>

                {/* Facility */}
                <div className="space-y-3 border-t border-[#072C0E]/8 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2ABD41]">{tr ? 'Tesis' : 'Facility'}</p>
                  {facilityList.length > 0 ? (
                    <select value={facility} onChange={e => setFacility(e.target.value)} className={FIELD} aria-label={tr ? 'Tesis' : 'Facility'}>
                      <option value="">{tr ? 'Seçiniz (opsiyonel)' : 'Select (optional)'}</option>
                      {facilityList.map(f => <option key={f.id} value={f.id}>{f.name}{f.city ? ` – ${f.city}` : ''}</option>)}
                    </select>
                  ) : (
                    <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-3">
                      <p className="text-xs text-amber-800">{tr ? 'Henüz tesis eklenmemiş.' : 'No facilities added yet.'}</p>
                      {setActiveTab && canApprove ? (
                        <button type="button" onClick={() => { setShowAddForm(false); setActiveTab('settings'); }} className="mt-1 text-xs font-bold text-[#2ABD41] hover:underline">
                          {tr ? '→ Ayarlar\'dan tesis ekleyin' : '→ Add facility from Settings'}
                        </button>
                      ) : (
                        <p className="mt-1 text-xs text-amber-800/80">
                          {tr ? 'Tesisleri şirket sahibi, yönetici veya müdür ekler.' : 'Facilities are added by the owner, admins or managers.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Additional */}
                <div className="space-y-3 border-t border-[#072C0E]/8 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2ABD41]">{tr ? 'Ek bilgiler' : 'Additional details'}</p>
                  <div>
                    <label htmlFor="add-entry-description" className={LABEL}>{tr ? 'Açıklama' : 'Description'}</label>
                    <textarea id="add-entry-description" value={desc} onChange={e => setDesc(e.target.value)} className="w-full rounded-2xl border border-[#072C0E]/10 bg-[#DEFAE1]/40 px-4 py-3 text-sm font-medium text-[#072C0E] outline-none transition focus:ring-4 focus:ring-[#2ABD41]/15" rows={2} />
                  </div>
                  {/* File upload */}
                  <div>
                    <label className={LABEL}>{tr ? 'Kanıt Belgesi' : 'Proof Document'}</label>
                    <div
                      className="rounded-2xl border-2 border-dashed border-[#2ABD41]/30 bg-[#2ABD41]/4 p-5 text-center transition hover:border-[#2ABD41]/50 hover:bg-[#2ABD41]/7"
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                      onDrop={e => {
                        e.preventDefault();
                        const dropped = e.dataTransfer.files[0];
                        if (dropped) setFile(dropped);
                      }}
                    >
                      {file ? (
                        <div className="flex items-center justify-between rounded-xl bg-[#2ABD41]/10 px-4 py-2.5">
                          <span className="flex items-center gap-2 truncate text-xs font-bold text-[#175022]">
                            <FileText className="h-3.5 w-3.5 shrink-0" />{file.name}
                          </span>
                          <button type="button" onClick={() => setFile(null)} className="shrink-0 text-xs font-bold text-red-400 hover:text-red-600" aria-label={tr ? 'Dosyayı kaldır' : 'Remove file'}>✕</button>
                        </div>
                      ) : (
                        <>
                          {/* Visually hidden but focusable (it was display:none, so
                              Tab skipped it and a keyboard user could not attach a
                              proof); the label below shows the focus ring. */}
                          <input type="file" id="proof-upload" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setFile(e.target.files[0] || null)} className="peer sr-only" />
                          <label htmlFor="proof-upload" className="block cursor-pointer rounded-xl peer-focus-visible:ring-4 peer-focus-visible:ring-[#2ABD41]/30">
                            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#2ABD41]/15 text-[#2ABD41]">
                              <Paperclip className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-bold text-[#072C0E]/60">{tr ? 'Dosya bırakın veya göz atın' : 'Drop file or browse'}</p>
                            <p className="mt-1 text-[10px] text-[#072C0E]/35">{tr ? 'Fatura, sayaç, ESG belgesi · max 10MB' : 'Invoice, meter reading, ESG doc · max 10MB'}</p>
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {dupWarning && (
                  <div ref={dupWarningRef} role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <p className="flex items-center gap-2 font-bold">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {dupWarning.kind === 'yearly_repeat'
                        ? (tr ? 'Bu yıllık kaynak bu yıl zaten girilmiş' : 'This yearly source is already entered for this year')
                        : dupWarning.overlap
                        ? (tr ? 'Bu kaynak yıllık envanterde zaten var' : 'This source is already in the annual inventory')
                        : (tr ? 'Bu kayıt zaten var gibi görünüyor' : 'This entry looks like it already exists')}
                    </p>
                    <p className="mt-1">
                      {dupWarning.overlap || (tr
                        ? 'Bu ay için aynı kaynak ve aynı miktarla bir kayıt var. Aynı faturayı iki kez girerseniz toplam iki kat görünür.'
                        : 'There is already an entry with the same source and quantity for this month. Entering the same invoice twice doubles it in the totals.')}
                    </p>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => { confirmDupRef.current = true; document.getElementById('add-entry-form')?.requestSubmit(); }}
                      className="mt-2 rounded-full border border-amber-300 bg-white px-4 py-1.5 font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                    >
                      {tr ? 'Yine de kaydet' : 'Save anyway'}
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Right above the Save buttons, so it is in view on a phone
                whichever part of the long form is scrolled to. */}
            {formError && (
              <div role="alert" className="flex shrink-0 items-center gap-2 border-t border-red-200/60 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-600 sm:px-6">
                <AlertCircle className="h-4 w-4 shrink-0" />{formError}
              </div>
            )}
            <div className="flex shrink-0 items-center justify-between border-t border-[#072C0E]/8 bg-[#F8F8F8]/80 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
              <button type="button" onClick={() => { setShowAddForm(false); resetAddForm(); }} className="rounded-full border border-[#072C0E]/10 bg-white px-5 py-2.5 text-xs font-bold transition hover:bg-[#F8F8F8]">
                {tr ? 'İptal' : 'Cancel'}
              </button>
              <div className="flex items-center gap-2">
                {parseInt(month) < 12 && !isFutureMonth(selectedYear, parseInt(month) + 1) && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => { saveNextRef.current = true; document.getElementById('add-entry-form')?.requestSubmit(); }}
                    title={tr ? 'Kaynak ve tesis aynı kalır; form bir sonraki aya geçer.' : 'Source and facility stay; the form moves to the next month.'}
                    className="rounded-full border border-[#072C0E]/15 bg-white px-4 py-2.5 text-xs font-bold text-[#072C0E] transition hover:bg-[#F8F8F8] disabled:opacity-60"
                  >
                    {tr ? `Kaydet ve ${fullMonths[parseInt(month)]} →` : `Save & ${fullMonths[parseInt(month)]} →`}
                  </button>
                )}
                <button type="submit" form="add-entry-form" disabled={submitting} className="rounded-full bg-[#072C0E] px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#072C0E]/15 transition-colors hover:bg-[#175022] disabled:opacity-60">
                  {submitting ? (tr ? 'Kaydediliyor…' : 'Saving…') : (tr ? 'Kaydet' : 'Save Entry')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ EDIT MODAL ══════════════════════════════════ */}
      {editing && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-md`} role="dialog" aria-modal="true" aria-labelledby="edit-entry-title">
            <div className="flex shrink-0 items-center justify-between border-b border-[#072C0E]/8 px-4 py-3 sm:px-6 sm:py-4">
              <h2 id="edit-entry-title" className="text-base font-bold">{tr ? 'Kaydı Düzenle' : 'Edit Entry'}</h2>
              <button aria-label={tr ? 'Kapat' : 'Close'} onClick={() => setEditing(null)} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#072C0E]/40 hover:bg-[#072C0E]/5"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <p className="mb-4 text-sm font-semibold text-[#072C0E]/60">
                {tr && editing.emission_factor_name_tr ? editing.emission_factor_name_tr : editing.emission_factor_name}
              </p>
              {editing.status === 'draft' && (
                <div className="mb-4 rounded-2xl border border-red-200/60 bg-red-50/60 px-4 py-3 text-xs text-red-700">
                  {editing.rejected_reason && (
                    <p className="font-bold">{tr ? 'Red nedeni' : 'Reason for rejection'}: {editing.rejected_reason}</p>
                  )}
                  <p className="mt-0.5">
                    {tr ? 'Düzelttiğinizde kayıt tekrar onaya gönderilir.' : 'Once corrected, the entry is sent for approval again.'}
                  </p>
                  {/* Only the amount, facility and note can change here. */}
                  <p className="mt-0.5">
                    {tr ? 'Kaynak veya ay yanlışsa bu kaydı silip yeniden ekleyin.' : 'If the source or month is wrong, delete this entry and add it again.'}
                  </p>
                </div>
              )}
              {editing.questionnaire_source ? (
                <div className="rounded-2xl border border-[#2ABD41]/25 bg-[#DEFAE1]/50 px-4 py-3 text-xs leading-5 text-[#175022]">
                  {entrySourceLabel(editing, tr) && (
                    <p className="mb-1.5 font-semibold">{tr ? 'Hesaplama' : 'Calculation'}: {entrySourceLabel(editing, tr)}</p>
                  )}
                  {tr
                    ? 'Bu kayıt Karbon Envanteri anketindeki cevabınızdan oluşturuldu. Burada değiştirirseniz anket o soruyu tekrar kaydettiğinde eski değer geri gelir; bu yüzden düzeltmeyi ankette, ilgili soruda yapın.'
                    : 'This entry was created from your Carbon Inventory answer. A change made here would be overwritten the next time that question is saved, so correct it in the questionnaire, on that question.'}
                </div>
              ) : (
              <form id="edit-form" onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label htmlFor="edit-entry-quantity" className={LABEL}>{tr ? 'Miktar' : 'Quantity'} ({unitLabel(editing.unit, tr)})</label>
                  <input id="edit-entry-quantity" type="text" inputMode="decimal" value={editQty} onChange={e => setEditQty(e.target.value)} className={FIELD} required />
                </div>
                <div>
                  <label htmlFor="edit-entry-facility" className={LABEL}>{tr ? 'Tesis' : 'Facility'}</label>
                  {facilityList.length > 0 ? (
                    <select id="edit-entry-facility" value={editFacility} onChange={e => setEditFacility(e.target.value)} className={FIELD}>
                      <option value="">{tr ? 'Seçiniz' : 'Select'}</option>
                      {facilityList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  ) : (
                    <input id="edit-entry-facility" type="text" value={editFacility} onChange={e => setEditFacility(e.target.value)} className={FIELD} />
                  )}
                </div>
                <div>
                  <label htmlFor="edit-entry-description" className={LABEL}>{tr ? 'Açıklama' : 'Description'}</label>
                  <textarea id="edit-entry-description" value={isLinkedDescription(editing.description) ? autoDescriptionLabel(editing.description, tr) : editDesc}
                    readOnly={isLinkedDescription(editing.description)}
                    placeholder={autoDescriptionLabel(editing.description, tr) || ''}
                    onChange={e => setEditDesc(e.target.value)} className="w-full rounded-2xl border border-[#072C0E]/10 bg-[#DEFAE1]/40 px-4 py-3 text-sm font-medium text-[#072C0E] outline-none transition focus:ring-4 focus:ring-[#2ABD41]/15" rows={2} />
                </div>
              </form>
              )}
              {/* Proof document — saved at once, separately from the form
                  (it doesn't change the amount or its approval). */}
              <div className="mt-4 rounded-2xl border border-[#072C0E]/10 bg-[#F8F8F8] px-4 py-3">
                <p className={LABEL}>{tr ? 'Kanıt belgesi (fatura, sayaç okuması…)' : 'Proof document (invoice, meter reading…)'}</p>
                {editing.proof_document ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {editing.proof_available === false ? (
                      <span className="font-semibold text-amber-600">{tr ? 'Dosya sunucuda bulunamadı — yeniden yükleyin.' : 'File missing on the server — upload it again.'}</span>
                    ) : (
                      <button type="button" onClick={() => downloadProofDocument(editing.id, toast, tr)} className="inline-flex items-center gap-1 font-semibold text-[#175022] hover:underline">
                        <Paperclip className="h-3.5 w-3.5" />
                        {decodeURIComponent(String(editing.proof_document).split('/').pop() || '')}
                      </button>
                    )}
                    {confirmProofRemove ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-red-600">{tr ? 'Kaldırılsın mı?' : 'Remove it?'}</span>
                        <button type="button" disabled={proofBusy} onClick={removeProof} className="font-bold text-red-600 hover:underline">{tr ? 'Evet, kaldır' : 'Yes, remove'}</button>
                        <button type="button" onClick={() => setConfirmProofRemove(false)} className="text-[#072C0E]/50 hover:underline">{tr ? 'Vazgeç' : 'Cancel'}</button>
                      </span>
                    ) : (
                      <button type="button" disabled={proofBusy} onClick={() => setConfirmProofRemove(true)} className="text-red-500 hover:underline">{tr ? 'Kaldır' : 'Remove'}</button>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-[#072C0E]/50">{tr ? 'Bu kayda henüz belge eklenmedi.' : 'No document attached yet.'}</p>
                )}
                <label className={`mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#2ABD41]/40 bg-white px-3 py-1.5 text-xs font-bold text-[#175022] transition hover:bg-[#DEFAE1] focus-within:ring-4 focus-within:ring-[#2ABD41]/30 ${proofBusy ? 'pointer-events-none opacity-60' : ''}`}>
                  <Paperclip className="h-3.5 w-3.5" />
                  {proofBusy ? '…' : editing.proof_document ? (tr ? 'Belgeyi değiştir' : 'Replace document') : (tr ? 'Belge ekle' : 'Attach document')}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="sr-only" disabled={proofBusy}
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadProof(f); }} />
                </label>
                <p className="mt-1 text-[10px] text-[#072C0E]/40">PDF, JPG, PNG, Word, Excel · {tr ? 'en fazla 10 MB' : 'max 10 MB'}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-[#072C0E]/8 px-4 py-3 sm:px-6 sm:py-4">
              <button type="button" onClick={() => setEditing(null)} disabled={editSaving} className="flex-1 rounded-full border border-[#072C0E]/10 bg-white py-2.5 text-xs font-bold transition hover:bg-[#F8F8F8] disabled:opacity-60">{tr ? 'İptal' : 'Cancel'}</button>
              {editing.questionnaire_source ? (
                <button type="button" onClick={() => fixInQuestionnaire(editing.questionnaire_source)} className="flex-1 rounded-full bg-[#072C0E] py-2.5 text-xs font-bold text-white shadow-lg shadow-[#072C0E]/12 transition hover:bg-[#175022]">{tr ? 'Ankette düzelt' : 'Fix in questionnaire'}</button>
              ) : (
              <button type="submit" form="edit-form" disabled={editSaving} className="flex-1 rounded-full bg-[#072C0E] py-2.5 text-xs font-bold text-white shadow-lg shadow-[#072C0E]/12 transition hover:bg-[#175022] disabled:opacity-60">{editSaving ? '…' : (tr ? 'Kaydet' : 'Save')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ DELETE CONFIRM DIALOG ═══════════════════════ */}
      {(() => {
        // An entry of an inventory comes back from its answer at the next
        // save, so it is removed by changing that answer, not deleted here.
        const e = entries.find(x => x.id === deleteConfirm);
        const src = e?.questionnaire_source;
        const name = e ? ((tr && e.emission_factor_name_tr) ? e.emission_factor_name_tr : e.emission_factor_name) : '';
        const what = e ? `${name} · ${entryPeriodLabel(e, months, tr)} ${e.year} · ${fmt(e.quantity)} ${unitLabel(e.unit, tr)}` : '';
        return (
          <ConfirmDialog
            open={deleteConfirm !== null}
            type={src ? 'info' : 'danger'}
            title={src ? (tr ? 'Ankette düzeltin' : 'Fix it in the questionnaire') : (tr ? 'Kaydı Sil' : 'Delete Entry')}
            message={src
              ? (tr
                ? `"${what}" Karbon Envanteri anketindeki cevabınızdan geliyor. Burada silinse bile anket bir sonraki kayıtta onu geri getirir; kaldırmak için ankette ilgili cevabı değiştirin.`
                : `"${what}" comes from your Carbon Inventory answer. Deleted here, it would come back at the next save; change that answer in the questionnaire to remove it.`)
              : (!e
                ? (tr ? 'Bu kaydı silmek istediğinize emin misiniz?' : 'Delete this entry?')
                : (tr ? `"${what}" kaydını silmek istediğinize emin misiniz?` : `Delete the entry "${what}"?`))}
            confirmText={src ? (tr ? 'Ankette düzelt' : 'Fix in questionnaire') : (tr ? 'Sil' : 'Delete')}
            cancelText={tr ? 'İptal' : 'Cancel'}
            onConfirm={src ? () => { setDeleteConfirm(null); fixInQuestionnaire(src); } : confirmDelete}
            onCancel={() => setDeleteConfirm(null)}
          />
        );
      })()}

      <ConfirmDialog
        open={withdrawing !== null}
        type="danger"
        title={tr ? 'Talebi geri çek' : 'Withdraw request'}
        message={tr
          ? `"${withdrawing?.source_name || ''}" talebi silinecek. Gerekirse yeniden gönderebilirsiniz.`
          : `The request "${withdrawing?.source_name || ''}" will be deleted. You can send it again if needed.`}
        confirmText={tr ? 'Geri çek' : 'Withdraw'}
        cancelText={tr ? 'Vazgeç' : 'Cancel'}
        onConfirm={async () => {
          const cr = withdrawing;
          setWithdrawing(null);
          try {
            const res = await api.deleteCustomRequest(cr.id);
            if (res.ok || res.status === 204) {
              toast.success(tr ? 'Talep geri çekildi' : 'Request withdrawn');
              fetchData();
            } else {
              const d = await res.json().catch(() => ({}));
              toast.error(d.code === 'already_reviewed'
                ? (tr ? 'Bu talep zaten incelendi.' : 'This request has already been reviewed.')
                : res.status === 403 ? noPermissionMessage(tr) : (tr ? 'Talep geri çekilemedi' : 'Could not withdraw the request'));
            }
          } catch {
            toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
          }
        }}
        onCancel={() => setWithdrawing(null)}
      />

      {/* ═══════════════════ CUSTOM REQUEST MODAL ════════════════════════ */}
      {showCustom && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-2xl`} role="dialog" aria-modal="true" aria-labelledby="custom-request-title">
            <div className="flex shrink-0 items-center justify-between border-b border-[#072C0E]/8 px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <h2 id="custom-request-title" className="text-base font-bold">{tr ? 'Özel Emisyon Talebi' : 'Custom Emission Request'}</h2>
                <p className="mt-0.5 text-xs text-[#072C0E]/45">{tr
                  ? 'Listede olmayan kaynak mı? Talebi Carbonless ekibi inceler; uygun emisyon faktörü belirlenince kayıt olarak eklenir.'
                  : 'Source not in the list? The Carbonless team reviews the request; once a suitable emission factor is set, it is added as an entry.'}</p>
              </div>
              <button aria-label={tr ? 'Kapat' : 'Close'} onClick={() => setShowCustom(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#072C0E]/40 hover:bg-[#072C0E]/5"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <form id="custom-form" onSubmit={handleCustom} className="space-y-4">
                <div>
                  <label className={LABEL}>{tr ? 'Kapsam' : 'Scope'}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['scope1','scope2','scope3'].map((s, i) => (
                      <button key={s} type="button" onClick={() => setCScope(s)}
                        className={`rounded-2xl border px-3 py-2.5 text-center transition ${cScope === s ? 'border-[#2ABD41]/50 bg-[#2ABD41]/10 ring-2 ring-[#2ABD41]/15' : 'border-[#072C0E]/10 bg-[#DEFAE1]/40 hover:border-[#2ABD41]/30'}`}
                      >
                        <p className="text-xs font-bold">{tr ? 'Kapsam' : 'Scope'} {i + 1}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="custom-category" className={LABEL}>{tr ? 'Kategori Adı' : 'Category Name'} *</label>
                  <input id="custom-category" type="text" value={cCat} onChange={e => setCCat(e.target.value)} placeholder={tr ? 'Örn: Jeneratör yakıtı' : 'e.g. Generator fuel'} className={FIELD} required />
                </div>
                <div>
                  <label htmlFor="custom-source" className={LABEL}>{tr ? 'Emisyon Kaynağı' : 'Emission Source'} *</label>
                  <input id="custom-source" type="text" value={cSrc} onChange={e => setCSrc(e.target.value)} placeholder={tr ? 'Örn: Dizel jeneratör' : 'e.g. Diesel generator'} className={FIELD} required />
                </div>
                <div>
                  <label htmlFor="custom-description" className={LABEL}>{tr ? 'Açıklama' : 'Description'} *</label>
                  <textarea id="custom-description" value={cDesc} onChange={e => setCDesc(e.target.value)} className="w-full rounded-2xl border border-[#072C0E]/10 bg-[#DEFAE1]/40 px-4 py-3 text-sm font-medium outline-none transition focus:ring-4 focus:ring-[#2ABD41]/15" rows={3} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="custom-unit" className={LABEL}>{tr ? 'Birim' : 'Unit'} *</label>
                    <select
                      id="custom-unit"
                      value={cUnitOther ? '__other' : cUnit}
                      onChange={e => {
                        if (e.target.value === '__other') { setCUnitOther(true); setCUnit(''); }
                        else { setCUnitOther(false); setCUnit(e.target.value); }
                      }}
                      className={FIELD} required={!cUnitOther}
                    >
                      <option value="">{tr ? 'Seçiniz' : 'Select'}</option>
                      {CUSTOM_UNITS.map(u => <option key={u.v} value={u.v}>{tr ? u.tr : u.en}</option>)}
                      <option value="__other">{tr ? 'Diğer…' : 'Other…'}</option>
                    </select>
                    {cUnitOther && (
                      <input type="text" value={cUnit} onChange={e => setCUnit(e.target.value)} maxLength={20}
                        aria-label={tr ? 'Diğer birim' : 'Other unit'}
                        placeholder={tr ? 'Birim (örn. paket)' : 'Unit (e.g. packages)'} className={`${FIELD} mt-2`} required autoFocus />
                    )}
                  </div>
                  <div>
                    <label htmlFor="custom-quantity" className={LABEL}>{tr ? 'Miktar' : 'Quantity'} *</label>
                    <input id="custom-quantity" type="text" inputMode="decimal" value={cQty} onChange={e => setCQty(e.target.value)} className={FIELD} required />
                  </div>
                </div>
                <div className={facilityList.length > 0 ? 'grid grid-cols-2 gap-3' : ''}>
                  <div>
                    <label htmlFor="custom-month" className={LABEL}>{tr ? `Ay · ${selectedYear}` : `Month · ${selectedYear}`}</label>
                    <select id="custom-month" value={cMonth} onChange={e => setCMonth(e.target.value)} className={FIELD}>
                      {months.map((m, i) => <option key={m} value={i + 1} disabled={isFutureMonth(selectedYear, i + 1)}>{m}</option>)}
                    </select>
                  </div>
                  {/* The request is stored per facility (and the ISO report
                      splits by facility); the form had no way to say which. */}
                  {facilityList.length > 0 && (
                    <div>
                      {/* Half width on a phone: "(optional)" moved to the label so
                          the empty choice is not cut off ("Seçiniz (opsiy…"). */}
                      <label htmlFor="custom-facility" className={LABEL}>{tr ? 'Tesis (opsiyonel)' : 'Facility (optional)'}</label>
                      <select id="custom-facility" value={cFacility} onChange={e => setCFacility(e.target.value)} className={FIELD}>
                        <option value="">{tr ? 'Seçiniz' : 'Select'}</option>
                        {facilityList.map(f => <option key={f.id} value={f.id}>{f.name}{f.city ? ` – ${f.city}` : ''}</option>)}
                      </select>
                      {(() => {
                        // Already approved for this facility and year: a second
                        // request for the same electricity would only wait.
                        const done = cFacility && customRequests.find(cr =>
                          cr.status === 'approved' && cr.electricity_method
                          && String(cr.facility) === String(cFacility) && String(cr.year) === String(selectedYear));
                        if (!done) return null;
                        const market = done.electricity_method === 'market_based';
                        return (
                          <p role="note" className="mt-1.5 rounded-xl bg-[#2ABD41]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#175022]">
                            {tr
                              ? `Bu tesisin ${selectedYear} elektrik faktörü Özel Talep #${done.id} ile zaten onaylandı (${fmt(done.approved_factor_kg_co2e, 6)} kg CO₂e/kWh${market ? ', piyasa bazlı' : ''}). Elektrik için yeni talep gerekmez${market ? '' : ' — tüketimi envanterin elektrik sorusunda (Soru 68) girin'}.`
                              : `This facility's ${selectedYear} electricity factor is already approved with Custom Request #${done.id} (${fmt(done.approved_factor_kg_co2e, 6)} kg CO₂e/kWh${market ? ', market-based' : ''}). No new request is needed for its electricity${market ? '' : ' — enter the consumption in the inventory\'s electricity question (Q68)'}.`}
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <p className="-mt-2 text-[11px] text-[#072C0E]/45">{yearHint}</p>
              </form>
            </div>
            <div className="flex shrink-0 items-center justify-between border-t border-[#072C0E]/8 bg-[#F8F8F8]/80 px-4 py-3 sm:px-6 sm:py-4">
              <button type="button" onClick={() => setShowCustom(false)} className="rounded-full border border-[#072C0E]/10 bg-white px-5 py-2.5 text-xs font-bold transition hover:bg-[#F8F8F8]">{tr ? 'İptal' : 'Cancel'}</button>
              <button type="submit" form="custom-form" disabled={cSaving} className="rounded-full bg-[#072C0E] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-colors hover:bg-[#175022] disabled:opacity-60">
                {cSaving ? '…' : (tr ? 'Talep Gönder' : 'Submit Request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
