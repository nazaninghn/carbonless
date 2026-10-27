'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { ACCENTS } from './heroContent';

/* Detail dialog for a metric card / orbit node. No per-category public page
   exists (the dashboard needs a sign-in and has no deep links), so each category
   gets this small explanation in EN/TR, with the sample-data disclosure and two
   real links: the sign-up CTA the hero already has, and the one page that
   explains it further (the Scope 1/2/3 FAQ entry, or the features page).

   It is a native <dialog> opened with showModal(), so the browser provides what
   a hand-built modal would have to fake: focus moves in, Tab stays inside, Esc
   closes, the page behind is inert and focus returns to what opened it.
   Clicking the backdrop (the dialog element itself — the padding lives on the
   inner box) closes it too. While it is open the page does not scroll. */
export default function MetricDialog({ category, lang, t, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return undefined;
    if (category && !d.open) d.showModal();
    if (!category && d.open) d.close();
    if (!category) return undefined;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden'; // scrollbar-gutter is stable, so nothing shifts
    return () => { html.style.overflow = prev; };
  }, [category]);

  const close = () => ref.current?.close();
  const c = category;
  const a = c ? ACCENTS[c.accent] : ACCENTS.green;
  const text = c ? (c.detail[lang] ?? c.detail.en) : null;
  const label = c ? (c.label[lang] ?? c.label.en) : '';
  const Icon = c?.icon;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) close(); }}
      aria-labelledby="hero-dialog-title"
      aria-describedby="hero-dialog-body"
      className="m-auto max-h-[90svh] w-[min(92vw,26rem)] overflow-auto rounded-[22px] border border-[#DEFAE1] bg-white p-0 text-[#072C0E] shadow-[0_24px_70px_rgba(7,44,14,0.22)] backdrop:bg-[#072C0E]/40"
    >
      {c && (
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: a.tint, color: a.ink }}>
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase leading-snug tracking-[0.1em] text-[#1A7B2A]">{text.tag}</p>
              <h2 id="hero-dialog-title" className="mt-0.5 text-[22px] font-bold leading-tight tracking-[-0.02em]" style={{ fontFamily: "'General Sans', sans-serif" }}>{label}</h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t.close}
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#072C0E]/60 transition hover:bg-[#F1FCF2] hover:text-[#072C0E]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <p className="mt-4 flex items-baseline gap-1.5 text-[#072C0E]">
            <span className="text-[28px] font-bold leading-none tracking-[-0.02em]">{c.value}</span>
            <span className="text-[14px] font-semibold text-[#072C0E]/70">tCO₂e</span>
          </p>
          <p className="mt-1 text-[12px] font-medium text-[#1A7B2A]">{t.sample}</p>

          <p id="hero-dialog-body" className="mt-4 text-[14px] leading-[1.7] text-[#072C0E]/75">{text.body}</p>

          <div className="mt-6 flex flex-col gap-2">
            <Link href="/register" onClick={close} className="flex min-h-[44px] items-center justify-center rounded-full btn-primary px-5 py-2.5 text-[14px] font-bold transition">
              {t.startCta}
            </Link>
            <Link
              href={c.learn === 'faq' ? '/#faq' : '/features'}
              onClick={close}
              className="flex min-h-[44px] items-center justify-center rounded-full btn-secondary px-5 py-2.5 text-center text-[14px] font-bold transition"
            >
              {c.learn === 'faq' ? t.learnScopes : t.learnFeatures}
            </Link>
          </div>
        </div>
      )}
    </dialog>
  );
}
