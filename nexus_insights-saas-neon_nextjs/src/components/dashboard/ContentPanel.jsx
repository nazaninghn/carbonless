'use client';

import { Info, AlertTriangle, Compass } from 'lucide-react';
import { kindLabel } from '@/lib/carboniq/contentKinds';

// How the questionnaire shows text that is NOT the question: a labelled panel with an icon, clearly apart from
// the question and from the answer options. The question itself keeps its own styling (ChatBubble).
//   information   blue panel, info icon     — explains the question or what an answer leads to
//   notification  amber panel, warning icon — something to notice (a warning, a status)
//   instruction   neutral panel, compass    — how to move through the questionnaire
const STYLES = {
  information: {
    Icon: Info,
    box: 'border-sky-200 bg-sky-50/70 text-sky-950',
    icon: 'text-sky-600',
    label: 'text-sky-700',
  },
  notification: {
    Icon: AlertTriangle,
    box: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'text-amber-600',
    label: 'text-amber-700',
  },
  instruction: {
    Icon: Compass,
    box: 'border-[#175022]/12 bg-[#175022]/[0.035] text-[#175022]',
    icon: 'text-[#175022]/55',
    label: 'text-[#175022]/60',
  },
};

/**
 * @param {{ kind: 'information' | 'notification' | 'instruction', tr?: boolean, collapsed?: boolean,
 *           label?: string, className?: string, children: import('react').ReactNode }} props
 * `collapsed` shows the panel closed (one line to open it): used where the same guidance would otherwise be
 * repeated for every item of a loop.
 */
export default function ContentPanel({ kind, tr = false, collapsed = false, label, className = '', children }) {
  const s = STYLES[kind] || STYLES.information;
  const name = label || kindLabel(kind, tr);
  const head = (
    <span className="flex items-center gap-1.5">
      <s.Icon className={`h-3.5 w-3.5 shrink-0 ${s.icon}`} strokeWidth={2.25} aria-hidden="true" />
      <span className={`text-[10px] font-bold uppercase tracking-wider ${s.label}`}>{name}</span>
    </span>
  );
  const role = kind === 'notification' ? 'status' : undefined;
  if (collapsed) {
    return (
      <details data-testid={`content-${kind}`} data-content-kind={kind}
        className={`group rounded-xl border px-3 py-2 text-[13px] leading-[1.6] ${s.box} ${className}`}>
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{head}
          <span className="ml-2 text-[11px] font-medium opacity-70 group-open:hidden">{tr ? 'Göster' : 'Show'}</span>
        </summary>
        <div className="mt-1.5">{children}</div>
      </details>
    );
  }
  return (
    <div data-testid={`content-${kind}`} data-content-kind={kind} role={role} aria-label={name}
      className={`rounded-xl border px-3 py-2.5 text-[13px] leading-[1.6] ${s.box} ${className}`}>
      <div className="mb-1">{head}</div>
      <div>{children}</div>
    </div>
  );
}
