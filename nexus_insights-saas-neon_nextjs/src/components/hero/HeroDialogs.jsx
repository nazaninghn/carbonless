'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

/* -- The hero's overlay: the enlarged Earth (the Scope information is a small popover, ScopePopover.jsx) --
   Both are a native modal <dialog> (showModal): it sits in the browser's top layer, makes the page behind inert, traps
   Tab, closes on Escape and names itself for assistive tech. On top of that we close on a click outside the content,
   lock the page's scroll (without letting the page jump sideways when the scrollbar goes) and, when it closes, hand
   focus back to whatever opened it (the parent does that: Safari does not focus a button when it is clicked). */

function useScrollLock() {
  useEffect(() => {
    const html = document.documentElement;
    const gap = window.innerWidth - html.clientWidth;
    const prev = { overflow: html.style.overflow, padding: document.body.style.paddingRight };
    html.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => { html.style.overflow = prev.overflow; document.body.style.paddingRight = prev.padding; };
  }, []);
}

function CloseButton({ onClick, label }) {
  return (
    <button type="button" data-testid="hero-dialog-close" className="hero-dlg-close" aria-label={label} onClick={onClick}>
      <X aria-hidden="true" strokeWidth={2} />
    </button>
  );
}

/* children: the content, or a function of close() when the content places the close button itself */
function Dialog({ onClose, className = '', labelledBy, label, children, closeLabel, testId }) {
  const ref = useRef(null);
  useScrollLock();

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      data-testid={testId}
      className={`hero-dlg ${className}`}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) close(); }}   // a click on the dim area around the content
    >
      {typeof children === 'function' ? children(close) : <>{children}<CloseButton onClick={close} label={closeLabel} /></>}
    </dialog>
  );
}

/* The Earth, large: the whole PNG, undistorted (its aspect ratio is kept), turning like the one in the hero. */
export function EarthDialog({ onClose, copy }) {
  return (
    <Dialog onClose={onClose} label={copy.ui.earthDialog} closeLabel={copy.ui.close} className="hero-dlg-earth" testId="hero-earth-dialog">
      <div data-testid="hero-earth-large" className="hero-dlg-earth-box">
        <div className="hero-earth-spin">
          <Image src="/earth.png" alt="" width={1306} height={1205} sizes="(min-width: 900px) 880px, 92vw" className="block h-auto w-full max-w-none select-none" />
        </div>
      </div>
    </Dialog>
  );
}
