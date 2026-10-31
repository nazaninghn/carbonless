'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';

// Browser Back inside the signed-in workspace (the Dashboard and the AI Analyzer,
// which are both /dashboard) asks first instead of leaving: "Do you want to leave?"
// with Stay and Log Out. Switching between Dashboard and AI Analyzer is not a
// navigation (no history entry), so it never asks.
//
// How: two extra history entries for the same URL ("guards", numbered 1 and 2 in
// history.state) sit on top of the page's own entry. Back pops a guard, which
// lands on the same page and fires popstate: the dialog opens and the guards are
// topped up to two again, so the user is still here and the next Back asks again
// (one dialog, never a loop, and the history keeps a fixed size). Two guards, not
// one, because two Backs a few milliseconds apart (a held-down Alt+Left) can both
// run before the first popstate is handled; with one guard the second would leave
// the page. Forward onto the top guard is the same page: nothing to do. A reload
// keeps the marks, so no guard is added twice.
//
// Only Log Out ends the session, through the normal logout (onLogout: api.logout
// in strict mode). If that request fails, nothing is cleared, the user stays
// signed in on this page, and the dialog says so and offers to try again.
const GUARD_KEY = 'carbonlessLeaveGuard';
const GUARDS = 2;
const guardDepth = (state) => (state && Number(state[GUARD_KEY])) || 0;
// From the entry the user is on, add guards up to the top one (keeping the router's own state on each).
const topUpGuards = () => {
  for (let d = guardDepth(window.history.state) + 1; d <= GUARDS; d++) {
    window.history.pushState({ ...(window.history.state || {}), [GUARD_KEY]: d }, '', window.location.href);
  }
};

export default function LeaveWorkspaceGuard({ language = 'en', enabled = true, onLogout }) {
  const tr = language === 'tr';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    // After the page's own first effects (a "?tab=…" link drops its query then), so
    // the guard copies the clean URL. Under Strict Mode's mount / unmount / mount the
    // first timer is cleared, and the marks stop any guard being added twice either way.
    const t = setTimeout(topUpGuards, 0);
    const onPop = (e) => {
      if (guardDepth(e.state) >= GUARDS) return;   // Forward onto the top guard: same page, nothing to ask
      topUpGuards();                               // stay here, and keep asking on the next Back
      if (!busyRef.current) setFailed(false);
      setOpen(true);
    };
    window.addEventListener('popstate', onPop);
    return () => { clearTimeout(t); window.removeEventListener('popstate', onPop); };
  }, [enabled]);

  const stay = useCallback(() => {
    if (busyRef.current) return;
    setOpen(false);
    setFailed(false);
  }, []);

  const logOut = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    let result;
    try { result = await onLogout(); } catch { result = { ok: false }; }
    if (result && result.ok === false) {
      // not signed out: say so, and let the user stay or try again
      busyRef.current = false;
      setBusy(false);
      setFailed(true);
    }
    // otherwise the Login page is loading; the dialog stays busy until the page leaves
  }, [onLogout]);

  return (
    <ConfirmDialog
      open={open}
      type="danger"
      language={language}
      testId="leave-workspace-dialog"
      initialFocus="cancel"
      solidOnSmall
      busy={busy}
      title={tr ? 'Ayrılmak istiyor musunuz?' : 'Do you want to leave?'}
      message={tr
        ? 'Carbonless çalışma alanından ayrılmak istediğinizden emin misiniz? Çıkış yapmayı seçmediğiniz sürece hesabınız açık kalacaktır.'
        : 'Are you sure you want to leave your Carbonless workspace? You will remain signed in unless you choose to log out.'}
      cancelText={tr ? 'Kal' : 'Stay'}
      confirmText={busy ? (tr ? 'Çıkış yapılıyor…' : 'Logging out…') : (tr ? 'Çıkış Yap' : 'Log Out')}
      onCancel={stay}
      onConfirm={logOut}
    >
      {failed && (
        <p role="alert" data-testid="leave-workspace-error" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-[13px] font-medium leading-5 text-red-600">
          {tr
            ? 'Çıkış yapılamadı. Hesabınız hâlâ açık. Bağlantınızı kontrol edip tekrar deneyin.'
            : "Couldn't log out. You are still signed in. Check your connection and try again."}
        </p>
      )}
    </ConfirmDialog>
  );
}
