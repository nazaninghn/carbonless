'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import QuestionnairePageTab from '@/components/dashboard/QuestionnairePageTab';

// The page holds the Carbon Inventory only. It used to carry a "Data Panel"
// drawer whose forms (fuel, electricity, transport, travel) wrote their own
// emission records next to the inventory's answers to the same questions —
// the same gas bill entered in both was counted twice — so it is gone: every
// figure is entered once, in the inventory.

/* ─── Main page ──────────────────────────────────────────────────────────────── */
export default function WorkspacePage() {
  const [lang] = useState('tr');
  const tr = lang === 'tr';

  // The year of the inventory being filled (from its saves): "Back" opens the
  // dashboard on that year, not on the current one.
  const [inventoryYear, setInventoryYear] = useState(null);
  useEffect(() => {
    const onSaved = (e) => {
      const y = Number(e.detail?.year);
      if (e.detail?.source === 'inventory' && y) setInventoryYear(y);
    };
    window.addEventListener('carbonless:emissions-updated', onSaved);
    return () => window.removeEventListener('carbonless:emissions-updated', onSaved);
  }, []);
  const dashboardHref = inventoryYear ? `/dashboard?tab=dashboard&year=${inventoryYear}` : '/dashboard';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F1FCF2]">

      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-[#072C0E]/8 bg-white">
        {/* Logo */}
        <a href={dashboardHref} className="flex items-center gap-2 shrink-0">
          <Image src="/carbonless.png" alt="Carbonless" width={30} height={30} className="h-7 w-7" />
          <span className="hidden sm:block text-[13px] font-bold text-[#072C0E]/70">Carbonless</span>
        </a>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <a href={dashboardHref}
            className="flex items-center gap-1 rounded-full border border-[#072C0E]/12 bg-[#072C0E]/4 px-3 py-1.5 text-[11px] font-bold text-[#072C0E]/50 transition hover:bg-[#072C0E]/8">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tr ? 'Geri' : 'Back'}</span>
          </a>
        </div>
      </header>

      {/* ── Content: the Carbon Inventory (its AI assistant is on /dashboard) ── */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-3">
        <QuestionnairePageTab language={lang} />
      </div>
    </div>
  );
}
