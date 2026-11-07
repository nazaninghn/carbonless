'use client';
import { useEffect, useRef } from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import Button from '@/components/Button';

// busy:         the confirmed action is running: the confirm button shows a spinner, both buttons
//               are disabled and Escape does nothing, so the dialog can't be dismissed half-way.
// initialFocus: 'cancel' | 'confirm' — focus that button on open, keep Tab / Shift+Tab inside the
//               dialog, and give focus back to where it was on close.
// solidOnSmall: below 1024px the site switches every backdrop blur off (globals.css), which leaves the
//               92%-white card see-through; this makes the card solid and the backdrop a little darker there.
// All three are opt-in, so existing callers look and behave exactly as before.
export default function ConfirmDialog({ open, onConfirm, onCancel, title, message, confirmText, cancelText, type = 'warning', language = 'en', children, busy = false, initialFocus, solidOnSmall = false, testId }) {
  // Every current caller passes confirmText/cancelText explicitly, so this
  // fallback never actually fires today — but it's a latent bug for any
  // future caller that forgets to, since it silently shows English
  // regardless of the selected language otherwise.
  const tr = language === 'tr';
  const boxRef = useRef(null);
  // Dismiss on Escape key — consistent with every other modal in the app.
  // With initialFocus (the dialog takes the keyboard) Escape is caught first and stops here,
  // so whatever is open behind the dialog (the AI chat, a panel) doesn't close as well.
  useEffect(() => {
    if (!open) return;
    const capture = !!initialFocus;
    const handleKey = (e) => {
      if (e.key !== 'Escape') return;
      if (capture) e.stopPropagation();
      if (!busy) onCancel();
    };
    window.addEventListener('keydown', handleKey, capture);
    return () => window.removeEventListener('keydown', handleKey, capture);
  }, [open, onCancel, busy, initialFocus]);

  useEffect(() => {
    if (!open || !initialFocus) return undefined;
    const back = document.activeElement;
    boxRef.current?.querySelector(`[data-dialog-action="${initialFocus}"]`)?.focus();
    const onTab = (e) => {
      if (e.key !== 'Tab' || !boxRef.current) return;
      const nodes = [...boxRef.current.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')];
      if (!nodes.length) { e.preventDefault(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1], a = document.activeElement;
      if (e.shiftKey && (a === first || !boxRef.current.contains(a))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !boxRef.current.contains(a))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onTab);
    return () => {
      document.removeEventListener('keydown', onTab);
      if (back && document.contains(back)) back.focus?.({ preventScroll: true });
    };
  }, [open, initialFocus]);

  // While busy both buttons are disabled, so the focus drops out of them; when the
  // action ends with the dialog still open (it failed), put it back on the start button.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (open && initialFocus && wasBusy.current && !busy && !boxRef.current?.contains(document.activeElement)) {
      boxRef.current?.querySelector(`[data-dialog-action="${initialFocus}"]`)?.focus();
    }
    wasBusy.current = busy;
  }, [busy, open, initialFocus]);

  if (!open) return null;

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      aria-busy={busy || undefined}
      data-testid={testId}
      className={`fixed inset-0 z-[9999] flex overflow-y-auto bg-black/15 p-4 backdrop-blur-md ${solidOnSmall ? 'max-lg:bg-[#072C0E]/35' : ''}`}
    >
      <div className={`m-auto w-full max-w-sm animate-in rounded-[1.5rem] border border-[#072C0E]/10 bg-white/92 p-6 shadow-[0_20px_60px_rgba(7, 44, 14,0.15)] backdrop-blur-2xl ${solidOnSmall ? 'max-lg:bg-white' : ''}`}>
        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-[#DEFAE1] text-[#072C0E]'}`}>
            {type === 'danger' ? <LogOut className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h3 id="confirm-dialog-title" className="text-lg font-bold tracking-[-0.02em] text-[#072C0E]">{title}</h3>
          <p id="confirm-dialog-message" className="mt-2 text-sm leading-6 text-[#072C0E]/55">{message}</p>
        </div>
        {children}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" size="lg" className="flex-1 whitespace-normal px-4" onClick={onCancel} disabled={busy} data-dialog-action="cancel">
            {cancelText || (tr ? 'İptal' : 'Cancel')}
          </Button>
          <Button variant={type === 'danger' ? 'danger' : 'dark'} size="lg" className="flex-1 whitespace-normal px-4" onClick={onConfirm} loading={busy} data-dialog-action="confirm">
            {confirmText || (tr ? 'Onayla' : 'Confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
