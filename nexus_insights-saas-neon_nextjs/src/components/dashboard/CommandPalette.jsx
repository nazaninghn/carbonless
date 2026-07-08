'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ClipboardCheck,
  FileText,
  Leaf,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Target,
  TrendingDown,
  X,
} from 'lucide-react';

// ─── Static action catalogue ──────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'nav_dashboard', group: 'nav', icon: LayoutDashboard, tr: 'Kontrol Paneli',    en: 'Dashboard',   tab: 'dashboard' },
  { id: 'nav_emissions', group: 'nav', icon: Leaf,            tr: 'Emisyon Yönetimi',  en: 'Emissions',   tab: 'emissions' },
  { id: 'nav_ai',        group: 'nav', icon: Bot,             tr: 'AI Carbon',         en: 'AI Carbon',   tab: 'ai_carbon' },
  { id: 'nav_reduction', group: 'nav', icon: TrendingDown,    tr: 'Azaltma Hedefleri', en: 'Targets',     tab: 'reduction' },
  { id: 'nav_reporting', group: 'nav', icon: FileText,        tr: 'Raporlama',         en: 'Reports',     tab: 'reporting' },
  { id: 'nav_review',    group: 'nav', icon: ClipboardCheck,  tr: 'Onay Bekleyenler',  en: 'Review',      tab: 'review'    },
  { id: 'nav_settings',  group: 'nav', icon: Settings,        tr: 'Ayarlar',           en: 'Settings',    tab: 'settings'  },
];

const QUICK_ITEMS = [
  { id: 'qa_entry',  group: 'quick', icon: Plus,       tr: 'Yeni Emisyon Kaydı',   en: 'Add Emission Entry',   tab: 'emissions', action: 'addEntry'  },
  { id: 'qa_target', group: 'quick', icon: Target,     tr: 'Yeni Azaltma Hedefi',  en: 'New Reduction Target', tab: 'reduction', action: 'addTarget' },
  { id: 'qa_report', group: 'quick', icon: FileText,   tr: 'Raporlama Merkezine Git', en: 'Go to Report Center', tab: 'reporting', action: null       },
];

const GROUPS = [
  { key: 'nav',   tr: 'Gezinme',       en: 'Navigation'      },
  { key: 'quick', tr: 'Hızlı İşlemler', en: 'Quick Actions'  },
  { key: 'entry', tr: 'Kayıt Ara',     en: 'Entries'         },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function CommandPalette({
  language,
  setActiveTab,
  entries = [],
  setShowAddForm,
}) {
  const [open,        setOpen]        = useState(false);
  const [query,       setQuery]       = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);
  const tr = language === 'tr';

  // ── Keyboard shortcut to open / close ──────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Auto-focus + reset on open ─────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Build flat result list ─────────────────────────────────────────────────
  // useMemo (not useCallback + immediate invoke) so the array is only rebuilt
  // when query, language, or entries change — not on every render.
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();

    const navResults = NAV_ITEMS
      .filter(a => !q || a[tr ? 'tr' : 'en'].toLowerCase().includes(q))
      .map(a => ({ ...a, label: a[tr ? 'tr' : 'en'] }));

    const quickResults = QUICK_ITEMS
      .filter(a => !q || a[tr ? 'tr' : 'en'].toLowerCase().includes(q))
      .map(a => ({ ...a, label: a[tr ? 'tr' : 'en'] }));

    const entryResults = q
      ? entries
          .filter(e => {
            const name = (e.emission_factor_name || '').toLowerCase();
            return name.includes(q);
          })
          .slice(0, 5)
          .map(e => ({
            id:    `entry_${e.id}`,
            group: 'entry',
            icon:  Leaf,
            label: e.emission_factor_name,
            sub:   `${e.scope?.replace('scope', 'S')} · ${(parseFloat(e.calculated_co2e_kg) / 1000).toFixed(4)} t · ${e.year}`,
            tab:   'emissions',
            action: null,
          }))
      : [];

    return [...navResults, ...quickResults, ...entryResults];
  }, [query, tr, entries]);

  // ── Activate an item ───────────────────────────────────────────────────────
  // Declared BEFORE the arrow-key useEffect so the dep array can reference it
  // without a temporal dead zone (const is not hoisted like var).
  const activate = useCallback((item) => {
    setOpen(false);
    setActiveTab(item.tab);
    if (item.action === 'addEntry' && setShowAddForm) {
      setTimeout(() => setShowAddForm(true), 120);
    }
  }, [setActiveTab, setShowAddForm]);

  const scrollItemIntoView = useCallback((idx) => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${idx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, []);

  // ── Arrow-key + Enter navigation ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted(h => {
          const next = Math.min(h + 1, items.length - 1);
          scrollItemIntoView(next);
          return next;
        });
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted(h => {
          const prev = Math.max(h - 1, 0);
          scrollItemIntoView(prev);
          return prev;
        });
      }
      if (e.key === 'Enter' && items[highlighted]) {
        activate(items[highlighted]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, highlighted, items, activate, scrollItemIntoView]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[14vh]"
      onMouseDown={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-[#302817]/18 backdrop-blur-[6px]" />

      {/* Panel */}
      <div
        className="relative w-full max-w-[560px] overflow-hidden rounded-[1.75rem] border border-[#302817]/10 bg-white/96 shadow-[0_28px_80px_rgba(48,40,23,0.2),0_0_0_1px_rgba(48,40,23,0.04)] backdrop-blur-2xl"
        style={{ animation: 'cpIn 160ms cubic-bezier(0.16,1,0.3,1) both' }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── Search row ── */}
        <div className="flex items-center gap-3 border-b border-[#302817]/8 px-5 py-4">
          <Search className="h-4 w-4 shrink-0 text-[#302817]/30" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlighted(0); }}
            placeholder={tr ? 'Ara veya komut yaz…' : 'Search or type a command…'}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#302817] outline-none placeholder:font-medium placeholder:text-[#302817]/30"
          />
          <div className="flex shrink-0 items-center gap-1.5">
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-[#302817]/7 text-[#302817]/40 transition hover:bg-[#302817]/12"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <kbd className="hidden rounded-lg border border-[#302817]/10 bg-[#302817]/5 px-1.5 py-0.5 text-[10px] font-bold text-[#302817]/25 sm:block">
              ESC
            </kbd>
          </div>
        </div>

        {/* ── Results list ── */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto overscroll-contain px-2 py-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-12 text-center">
              <Search className="h-8 w-8 text-[#302817]/12" />
              <p className="text-sm font-semibold text-[#302817]/35">
                {tr ? 'Sonuç bulunamadı' : 'No results found'}
              </p>
              <p className="text-xs text-[#302817]/25">
                {tr ? 'Farklı bir şey deneyin' : 'Try a different search'}
              </p>
            </div>
          ) : (
            GROUPS.map(g => {
              const gItems = items.filter(i => i.group === g.key);
              if (gItems.length === 0) return null;
              return (
                <div key={g.key} className="mb-1 last:mb-0">
                  <p className="mb-0.5 px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#302817]/28">
                    {g[tr ? 'tr' : 'en']}
                  </p>
                  {gItems.map(item => {
                    const idx  = items.indexOf(item);
                    const Icon = item.icon;
                    const isHi = highlighted === idx;
                    return (
                      <button
                        key={item.id}
                        data-idx={idx}
                        onClick={() => activate(item)}
                        onMouseMove={() => setHighlighted(idx)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-100 ${
                          isHi
                            ? 'bg-[#244959] text-white'
                            : 'text-[#302817]/70 hover:bg-[#302817]/4'
                        }`}
                      >
                        {/* Icon */}
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          isHi ? 'bg-white/14' : 'bg-[#89E789]/14'
                        }`}>
                          <Icon className={`h-3.5 w-3.5 ${isHi ? 'text-white' : 'text-[#51B291]'}`} />
                        </span>

                        {/* Label + sub */}
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[13px] font-semibold ${isHi ? 'text-white' : 'text-[#302817]'}`}>
                            {item.label}
                          </span>
                          {item.sub && (
                            <span className={`block text-[10px] ${isHi ? 'text-white/55' : 'text-[#302817]/35'}`}>
                              {item.sub}
                            </span>
                          )}
                        </span>

                        {/* Enter hint */}
                        {isHi && (
                          <kbd className="shrink-0 rounded-md border border-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white/45">
                            ↵
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer shortcut hints ── */}
        <div className="flex items-center gap-5 border-t border-[#302817]/6 px-5 py-2.5">
          {[
            { key: '↑↓', label: tr ? 'gezin' : 'navigate' },
            { key: '↵',  label: tr ? 'seç'   : 'select'   },
            { key: 'ESC',label: tr ? 'kapat' : 'close'    },
          ].map(h => (
            <span key={h.key} className="flex items-center gap-1 text-[10px] font-semibold text-[#302817]/30">
              <kbd className="rounded border border-[#302817]/10 bg-[#302817]/5 px-1 py-0.5 text-[9px] font-bold">
                {h.key}
              </kbd>
              {h.label}
            </span>
          ))}
          <span className="ml-auto text-[10px] font-semibold text-[#302817]/20">
            {tr ? `${items.length} sonuç` : `${items.length} result${items.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

    </div>
  );
}
