'use client';

import { AlertCircle, Clock } from 'lucide-react';
import { attentionCopy } from '@/lib/carboniq/attention';
import { pendingCopy } from '@/lib/carboniq/pending';

// The unanswered-questions overview shown above the answer bar. It lists WHICH questions need attention, split by what
// they are: required questions that are unanswered (red) and questions left on purpose with "I don't know — answer
// later" (amber). Each one has a button that opens that question with everything already saved untouched.
// Read-only: nothing is saved, converted or removed here. Questions the answers make unnecessary are not listed
// (they are neither unanswered nor pending); the progress sidebar lists them for information.
//
// `overview` comes from attentionOverview (lib/carboniq/attention.js). `labelOf(id)` gives { number, text }.
export default function AttentionPanel({ overview, tr = false, open, onToggle, onGo, labelOf }) {
  if (!overview || overview.needsAttention === 0) return null;
  const c = attentionCopy(tr);
  const p = pendingCopy(tr);
  const listId = 'pending-questions-list';
  const groups = [
    { key: 'required', items: overview.required, head: c.requiredHead, hint: c.requiredHint, badge: c.requiredBadge,
      row: 'border-red-200 bg-white', pill: 'bg-red-100 text-red-800', btn: 'border-red-300 text-red-900 hover:bg-red-50', Icon: AlertCircle },
    { key: 'deferred', items: overview.deferred, head: c.deferredHead, hint: c.deferredHint, badge: c.deferredBadge,
      row: 'border-amber-200 bg-white', pill: 'bg-amber-100 text-amber-800', btn: 'border-amber-300 text-amber-900 hover:bg-amber-100', Icon: Clock },
  ].filter(g => g.items.length > 0);
  const bannerText = (
    <span className="flex items-center gap-2">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      <span>{p.banner} <span className="font-bold">{p.title}: {c.count(overview.needsAttention)}</span></span>
    </span>
  );
  const toggle = (
    <button type="button" data-testid="pending-questions-toggle"
      aria-expanded={open} aria-controls={listId}
      aria-label={open ? p.toggleClose : p.toggleOpen}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 text-left text-xs font-semibold text-amber-800">
      {bannerText}
      <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
  );
  // The list is a sheet over the bottom of the questionnaire (anchored to its column, which is `relative`), starting
  // below the bar with "My Inventories". Opening it changes nothing underneath: the banner keeps its room (an
  // invisible copy), the conversation and the answer bar keep their size, and exactly one thing scrolls — the list.
  return (
    <div data-testid="pending-questions-panel" role="region" aria-label={c.title}
      className="shrink-0 border-t border-amber-200 bg-amber-50 px-4 py-2 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        {open ? (
          <div aria-hidden="true" className="invisible flex items-center justify-between gap-3 text-xs font-semibold">
            {bannerText}<span>−</span>
          </div>
        ) : toggle}
      </div>
      {open && (
        <div id={listId} data-testid="pending-questions-list"
          className="absolute inset-x-0 bottom-0 z-30 flex max-h-[calc(100%-3.25rem)] flex-col overflow-hidden border-t border-amber-300 bg-amber-50 shadow-[0_-10px_24px_-14px_rgba(7,44,14,0.35)] sm:max-h-[min(30rem,calc(100%-3.25rem))]">
          <div className="shrink-0 border-b border-amber-200 px-4 py-2 sm:px-6">
            <div className="mx-auto w-full max-w-2xl">{toggle}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
              {groups.map(g => (
                <section key={g.key} data-testid={`attention-group-${g.key}`} aria-label={g.head}>
                  <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#072C0E]/70">
                    <g.Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
                    {g.head} <span className="font-semibold normal-case tracking-normal">({g.items.length})</span>
                  </h3>
                  <p className="mb-1 text-[11px] text-[#072C0E]/60">{g.hint}</p>
                  <ul className="flex flex-col gap-1.5">
                    {g.items.map(item => {
                      const { number, text } = labelOf(item.id);
                      return (
                        <li key={item.id} data-testid={`pending-question-${item.id}`} data-status={item.status}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${g.row}`}>
                          <span className="min-w-0 text-xs text-[#072C0E]">
                            <span className="font-bold">{c.question} {number}</span>
                            <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${g.pill}`}>{g.badge}</span>
                            <span className="mt-0.5 block truncate text-[#175022]/70">{text}</span>
                            {item.wasDeferred && item.status === 'required' && (
                              <span className="mt-0.5 block text-[11px] font-medium text-red-700">{c.wasDeferredNote}</span>
                            )}
                          </span>
                          <button type="button" onClick={() => onGo(item.id)}
                            aria-label={`${c.goTo}: ${c.question} ${number}`}
                            className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold ${g.btn}`}>
                            {c.goTo}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
