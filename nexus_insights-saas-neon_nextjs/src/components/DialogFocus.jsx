'use client';
import { useEffect } from 'react';

// Keyboard focus for every modal (any element with aria-modal="true"):
// opening one moves focus into it, Tab and Shift+Tab stay inside it, and
// closing it returns focus to whatever opened it. Without this, focus stayed
// on the page behind an open dialog and Tab walked its search box and
// filters — a keyboard or screen-reader user could not tell a form was open.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const visible = (el) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
};

function activeDialog() {
  const all = [...document.querySelectorAll('[aria-modal="true"]')]
    .filter(d => visible(d) && !d.closest('[inert]'));
  return all[all.length - 1] || null;
}

const focusables = (dialog) => [...dialog.querySelectorAll(FOCUSABLE)].filter(visible);

export default function DialogFocus() {
  useEffect(() => {
    let current = null;
    let opener = null;

    const sync = () => {
      const d = activeDialog();
      if (d === current) return;
      if (d) {
        if (!current) opener = document.activeElement;
        current = d;
        if (!d.contains(document.activeElement)) {
          // The first control after the header's Close button, so the user
          // starts at the top of the form; Close itself only if nothing else.
          const items = focusables(d);
          const isClose = (e) => /^(kapat|close)$/i.test(e.getAttribute('aria-label') || '');
          const start = d.querySelector('[autofocus]') || items.find(e => !isClose(e)) || items[0] || d;
          start.focus?.({ preventScroll: true });
        }
      } else {
        current = null;
        if (opener && document.contains(opener)) opener.focus?.({ preventScroll: true });
        opener = null;
      }
    };

    const onKey = (e) => {
      if (e.key !== 'Tab' || !current) return;
      const items = focusables(current);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault(); first.focus();
      }
    };

    let pending = false;
    const obs = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; sync(); });
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal', 'inert', 'class', 'style'] });
    document.addEventListener('keydown', onKey, true);
    sync();
    return () => { obs.disconnect(); document.removeEventListener('keydown', onKey, true); };
  }, []);
  return null;
}
