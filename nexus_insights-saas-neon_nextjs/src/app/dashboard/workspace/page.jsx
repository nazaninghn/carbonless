'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, MessageSquare, Flame, Zap, Truck, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Minus, Globe, Menu, X,
} from 'lucide-react';
import { getReportFields, getCategoryStatus } from '@/lib/workspace/api';
import { ChatWorkspace } from '@/components/workspace/ChatWorkspace';
import { StationaryCombustionPanel } from '@/components/workspace/panels/StationaryCombustionPanel';
import { api } from '@/lib/utils/api';

// ── Status badge ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  complete:     { color: 'bg-green-100 text-green-700 border-green-200',  icon: CheckCircle2, label: { tr: 'Tamamlandı', en: 'Complete' } },
  in_progress:  { color: 'bg-amber-100 text-amber-700 border-amber-200',  icon: Clock,        label: { tr: 'Devam ediyor', en: 'In Progress' } },
  missing:      { color: 'bg-red-50 text-red-500 border-red-200',         icon: AlertCircle,  label: { tr: 'Eksik', en: 'Missing' } },
  not_applicable: { color: 'bg-[#302817]/5 text-[#302817]/40 border-[#302817]/10', icon: Minus, label: { tr: 'Geçerli Değil', en: 'N/A' } },
};

function StatusBadge({ status, lang }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.missing;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label[lang] || cfg.label.en}
    </span>
  );
}

// ── Category definitions (MVP) ────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: '3A',
    scope: 1,
    icon: Flame,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    label: { tr: 'Sabit Yanma', en: 'Stationary Combustion' },
    desc: { tr: 'Kapsam 1 · Isıtma ve enerji yakıtları', en: 'Scope 1 · Heating and energy fuels' },
  },
  {
    id: '4A',
    scope: 2,
    icon: Zap,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
    label: { tr: 'Elektrik', en: 'Electricity' },
    desc: { tr: 'Kapsam 2 · Satın alınan elektrik', en: 'Scope 2 · Purchased electricity' },
  },
  {
    id: 'K4',
    scope: 3,
    icon: Truck,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    label: { tr: 'Yukarı Akış Taşımacılığı', en: 'Upstream Transport' },
    desc: { tr: 'Kapsam 3 · Lojistik ve kargo', en: 'Scope 3 · Logistics and freight' },
  },
];

const SCOPE_GROUPS = [
  { id: 1, label: { tr: 'Kapsam 1', en: 'Scope 1' }, cats: ['3A'] },
  { id: 2, label: { tr: 'Kapsam 2', en: 'Scope 2' }, cats: ['4A'] },
  { id: 3, label: { tr: 'Kapsam 3', en: 'Scope 3' }, cats: ['K4'] },
];

// ── Scope Sidebar ─────────────────────────────────────────────────────────────
function ScopeSidebar({ selectedCat, onSelect, statuses, lang, open, onClose }) {
  const tr = lang === 'tr';
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/20 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-56 shrink-0 border-r border-[#302817]/6 bg-[#FAFAF8]
        flex flex-col transition-transform duration-200
        lg:relative lg:inset-auto lg:z-auto lg:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between border-b border-[#302817]/6 px-4 py-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#302817]/50">
            {tr ? 'Emisyon Kapsamları' : 'Emission Scopes'}
          </span>
          <button onClick={onClose} className="text-[#302817]/40 hover:text-[#302817] transition lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {SCOPE_GROUPS.map(group => {
            const cats = CATEGORIES.filter(c => group.cats.includes(c.id));
            return (
              <div key={group.id}>
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#302817]/40">
                  {group.label[lang] || group.label.en}
                </p>
                {cats.map(cat => {
                  const Icon = cat.icon;
                  const status = statuses[cat.id] || 'missing';
                  const isActive = selectedCat === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { onSelect(cat.id); onClose(); }}
                      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
                        isActive
                          ? 'bg-[#302817]/8 text-[#302817]'
                          : 'text-[#302817]/55 hover:bg-[#302817]/4 hover:text-[#302817]'
                      }`}
                    >
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cat.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${cat.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{cat.label[lang] || cat.label.en}</p>
                        <StatusBadge status={status} lang={lang} />
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

// ── Category card grid ────────────────────────────────────────────────────────
function CategoryCard({ cat, status, onClick, lang }) {
  const Icon = cat.icon;
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 rounded-2xl border border-[#302817]/8 bg-white p-4 text-left shadow-sm transition hover:border-[#B4BE6A]/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cat.bg}`}>
          <Icon className={`h-5 w-5 ${cat.color}`} />
        </div>
        <StatusBadge status={status} lang={lang} />
      </div>
      <div>
        <p className="text-sm font-bold text-[#302817]">{cat.label[lang] || cat.label.en}</p>
        <p className="mt-0.5 text-[11px] text-[#302817]/45">{cat.desc[lang] || cat.desc.en}</p>
      </div>
      <div className="flex items-center gap-1 text-[11px] font-semibold text-[#302817]/40">
        {lang === 'tr' ? 'Veri gir' : 'Enter data'}
        <ChevronRight className="h-3 w-3" />
      </div>
    </button>
  );
}

// ── Right data-entry panel ────────────────────────────────────────────────────
function DataEntryPanel({ categoryId, reportId, fieldValues, lang, onSaved }) {
  if (!categoryId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <Globe className="h-10 w-10 text-[#302817]/15 mb-3" />
        <p className="text-sm font-semibold text-[#302817]/40">
          {lang === 'tr' ? 'Bir kategori seçin' : 'Select a category'}
        </p>
        <p className="text-xs text-[#302817]/25 mt-1">
          {lang === 'tr' ? 'Soldan kategori seçerek veri girişi yapın' : 'Choose a category from the list to enter data'}
        </p>
      </div>
    );
  }
  if (categoryId === '3A') {
    return (
      <StationaryCombustionPanel
        reportId={reportId}
        fieldValues={fieldValues}
        lang={lang}
        onSaved={onSaved}
      />
    );
  }
  // Placeholder for unbuilt panels
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cat?.bg} mb-3`}>
        {cat && <cat.icon className={`h-6 w-6 ${cat.color}`} />}
      </div>
      <p className="text-sm font-bold text-[#302817]">{cat?.label[lang]}</p>
      <p className="mt-1 text-xs text-[#302817]/40">
        {lang === 'tr' ? 'Bu panel yakında eklenecek (Faz 2)' : 'This panel coming soon (Phase 2)'}
      </p>
    </div>
  );
}

// ── Main Workspace page ───────────────────────────────────────────────────────
export default function WorkspacePage() {
  const [lang] = useState('tr'); // could come from user profile
  const tr = lang === 'tr';

  const [reportId, setReportId] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [statuses, setStatuses] = useState({});
  const [selectedCat, setSelectedCat] = useState('3A');
  const [mode, setMode] = useState('dashboard'); // 'dashboard' | 'chat'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load active report
  useEffect(() => {
    (async () => {
      try {
        const res = await api('/questionnaire/');
        if (res.ok) {
          const data = await res.json();
          const reports = data.reports || [];
          if (reports.length > 0) {
            setReportId(reports[0].report_id);
          }
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  // Load field values when reportId is known
  const loadFields = useCallback(async () => {
    if (!reportId) return;
    try {
      const data = await getReportFields(reportId);
      const vals = data.values || {};
      setFieldValues(vals);
      // Recompute category statuses
      const s = {};
      CATEGORIES.forEach(cat => {
        s[cat.id] = getCategoryStatus(cat.id, vals);
      });
      setStatuses(s);
    } catch { /* ignore */ }
  }, [reportId]);

  useEffect(() => { loadFields(); }, [loadFields]);

  // Called when fields are saved (from panel or after AI confirm)
  const handleFieldsSaved = useCallback(() => {
    loadFields();
  }, [loadFields]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F7F2]">
        <div className="text-sm text-[#302817]/40">
          {tr ? 'Yükleniyor…' : 'Loading…'}
        </div>
      </div>
    );
  }

  if (!reportId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#F8F7F2] px-6 text-center">
        <h2 className="text-xl font-bold text-[#302817]">
          {tr ? 'Aktif rapor bulunamadı' : 'No active report found'}
        </h2>
        <p className="text-sm text-[#302817]/50">
          {tr
            ? 'Workspace\'i kullanmak için önce CarbonIQ anketi üzerinden bir rapor başlatın.'
            : 'Start a report via the CarbonIQ questionnaire to use the Workspace.'}
        </p>
        <a
          href="/dashboard"
          className="rounded-full bg-[#302817] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-black transition"
        >
          {tr ? 'Dashboard\'a Dön' : 'Back to Dashboard'}
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F7F2] font-sans">
      {/* Scope Sidebar */}
      <ScopeSidebar
        selectedCat={selectedCat}
        onSelect={setSelectedCat}
        statuses={statuses}
        lang={lang}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[#302817]/6 bg-white px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/5 hover:text-[#302817] transition lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-[#302817]">
              {tr ? 'Karbon Workspace' : 'Carbon Workspace'}
            </h1>
            <p className="text-[11px] text-[#302817]/40">
              {tr ? `Rapor #${reportId}` : `Report #${reportId}`}
            </p>
          </div>
          {/* Mode switch */}
          <div className="flex items-center rounded-xl border border-[#302817]/10 bg-[#302817]/3 p-0.5">
            {[
              { key: 'dashboard', icon: LayoutDashboard, label: { tr: 'Dashboard', en: 'Dashboard' } },
              { key: 'chat',      icon: MessageSquare,   label: { tr: 'AI Asistan', en: 'AI Assistant' } },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  mode === m.key
                    ? 'bg-white text-[#302817] shadow-sm'
                    : 'text-[#302817]/45 hover:text-[#302817]'
                }`}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.label[lang] || m.label.en}
              </button>
            ))}
          </div>
        </header>

        {/* Body: center + right panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Center */}
          <div className="flex flex-1 flex-col overflow-y-auto min-w-0">
            {mode === 'dashboard' ? (
              <div className="p-5">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[#302817]/40">
                  {tr ? 'Emisyon Kategorileri — Faz 1' : 'Emission Categories — Phase 1'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {CATEGORIES.map(cat => (
                    <CategoryCard
                      key={cat.id}
                      cat={cat}
                      status={statuses[cat.id] || 'missing'}
                      onClick={() => setSelectedCat(cat.id)}
                      lang={lang}
                    />
                  ))}
                </div>

                {/* Quick summary */}
                <div className="mt-6 rounded-2xl border border-[#302817]/8 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#302817]/40 mb-3">
                    {tr ? 'Mevcut Veriler' : 'Current Data'}
                  </p>
                  {Object.keys(fieldValues).length === 0 ? (
                    <p className="text-sm text-[#302817]/35">
                      {tr ? 'Henüz veri girilmedi. AI Asistan veya paneli kullanın.' : 'No data entered yet. Use AI Assistant or a panel.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Object.entries(fieldValues).map(([k, v]) => (
                        <div key={k} className="rounded-xl border border-[#302817]/6 bg-[#FAFAF8] px-3 py-2">
                          <p className="text-[10px] text-[#302817]/40 font-mono">{k.replace('rf.', '')}</p>
                          <p className="text-sm font-bold text-[#302817] truncate">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Chat mode */
              <div className="flex-1 overflow-hidden h-full">
                <ChatWorkspace
                  reportId={reportId}
                  lang={lang}
                  onFieldsConfirmed={handleFieldsSaved}
                />
              </div>
            )}
          </div>

          {/* Right data-entry panel */}
          <aside className="hidden w-72 shrink-0 border-l border-[#302817]/6 bg-white xl:flex flex-col">
            <div className="border-b border-[#302817]/6 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#302817]/40">
                {tr ? 'Veri Girişi' : 'Data Entry'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <DataEntryPanel
                categoryId={selectedCat}
                reportId={reportId}
                fieldValues={fieldValues}
                lang={lang}
                onSaved={handleFieldsSaved}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
