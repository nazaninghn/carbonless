'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { extendSession, expireSession } from '@/lib/utils/api';
import { hasUnsaved } from '@/lib/session/unsaved';
import {
  ACTIVITY_WRITE_MS, KEY_ACTIVITY, KEY_ENDED, KEY_EXTENDED, KEY_REPORTED, TICK_MS,
  activityAgeSeconds, clock, idleState, msLeft, shouldExtend,
} from '@/lib/session/idle';

// The browser half of the 30-minute inactivity timeout (the server enforces it: accounts/session.py).
//  - records real activity (press, tap, key; NOT mouse movement, scrolling, focus, timers or polling) in localStorage,
//    so every tab of the browser shares it;
//  - tells the server about it, so the session lasts exactly as long as the user keeps working;
//  - warns two minutes before the end (and says so when an answer is typed but not submitted);
//  - at the limit, ends the session here and in every other tab, and sends the user to the login page.
// Nothing is saved or deleted by this component: saved data stays where it is.

const SETTLE_MS = 8000;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const read = (key) => { try { return num(localStorage.getItem(key)); } catch { return 0; } };
const write = (key, value) => { try { localStorage.setItem(key, String(value)); } catch { /* storage unavailable */ } };
const signedIn = () => { try { return Boolean(localStorage.getItem('_ca')); } catch { return false; } };

export default function SessionIdleGuard() {
  const { language } = useLanguage();
  const tr = language === 'tr';
  const [left, setLeft] = useState(null);          // ms left, only while the warning is shown
  const [unsaved, setUnsavedNow] = useState(false);
  const endingRef = useRef(false);
  const lastWriteRef = useRef(0);
  const mountedAtRef = useRef(Date.now());

  const evaluate = useCallback(async () => {
    if (endingRef.current || !signedIn()) { setLeft(null); return; }
    const now = Date.now();
    let lastActivity = read(KEY_ACTIVITY);
    if (!lastActivity) {                           // first look after signing in: the sign-in itself was activity
      lastActivity = now;
      write(KEY_ACTIVITY, now);
      write(KEY_EXTENDED, now);                    // ... and the server already knows: the sign-in stamped it
      write(KEY_REPORTED, now);
    }
    const state = idleState({ now, lastActivity });
    if (state === 'expired') {
      endingRef.current = true;
      setLeft(null);
      await expireSession();
      return;
    }
    if (state === 'warning') { setLeft(msLeft({ now, lastActivity })); setUnsavedNow(hasUnsaved()); } else setLeft(null);

    // Not in the first seconds after the page opens: a refresh rotates the refresh token, and a page that navigates away
    // while the answer is on its way would lose the new token. The next check (15 s) does it.
    if (now - mountedAtRef.current > SETTLE_MS && shouldExtend({ now, lastActivity, lastExtend: read(KEY_EXTENDED), reported: read(KEY_REPORTED) })) {
      let reportedAt = 0;
      const result = await extendSession(() => {
        // re-read inside the cross-tab lock: another tab may have told the server a moment ago
        const t = Date.now();
        const last = read(KEY_ACTIVITY);
        if (!shouldExtend({ now: t, lastActivity: last, lastExtend: read(KEY_EXTENDED), reported: read(KEY_REPORTED) })) return null;
        reportedAt = last;
        return activityAgeSeconds({ now: t, lastActivity: last });
      });
      if (result.ok) { write(KEY_EXTENDED, Date.now()); write(KEY_REPORTED, reportedAt); }
      else if (result.expired && !endingRef.current) { endingRef.current = true; await expireSession(); }
    }
  }, []);

  useEffect(() => {
    const onActivity = (e) => {
      if (!signedIn() || endingRef.current) return;
      const now = Date.now();
      // an already expired session is not revived by a click: the check ends it
      if (idleState({ now, lastActivity: read(KEY_ACTIVITY) || now }) === 'expired') { evaluate(); return; }
      if (now - lastWriteRef.current < ACTIVITY_WRITE_MS) return;
      lastWriteRef.current = now;
      write(KEY_ACTIVITY, now);
      // a press INSIDE the warning is dismissed by its own button (below): removing the dialog on pointerdown would pull
      // the button away before the click completes
      if (!(e?.target?.closest && e.target.closest('[data-session-warning]'))) setLeft(null);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, onActivity, { capture: true, passive: true }));

    // another tab ended the session: follow it
    const onStorage = (e) => {
      if (e.key === KEY_ENDED && e.newValue && !endingRef.current) {
        endingRef.current = true;
        window.location.href = '/login?reason=session_expired';
      }
    };
    window.addEventListener('storage', onStorage);

    // returning to the tab or the window is not activity, but it is a moment to check the clock
    const onWake = () => { evaluate(); };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);

    evaluate();
    const timer = setInterval(evaluate, TICK_MS);
    const countdown = setInterval(() => {
      setLeft((current) => (current == null ? null : msLeft({ now: Date.now(), lastActivity: read(KEY_ACTIVITY) || Date.now() })));
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
      clearInterval(timer);
      clearInterval(countdown);
    };
  }, [evaluate]);

  if (left == null) return null;
  return (
    <div role="alertdialog" aria-live="assertive" aria-labelledby="idle-title" data-testid="session-idle-warning" data-session-warning="true"
      className="fixed inset-x-3 bottom-4 z-[200] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 shadow-xl sm:bottom-6">
      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p id="idle-title" className="text-[13px] font-bold text-amber-900">
          {tr ? 'Oturumunuz yakında sona erecek' : 'Your session is about to expire'}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-amber-900/90">
          {tr
            ? `Hareketsizlik nedeniyle ${clock(left)} içinde çıkış yapılacak. Kaydedilmiş verileriniz silinmez.`
            : `You will be signed out in ${clock(left)} because of inactivity. Your saved data is not deleted.`}
        </p>
        {unsaved && (
          <p data-testid="session-idle-unsaved" className="mt-1 text-[12px] font-semibold leading-snug text-red-700">
            {tr
              ? 'Yazdığınız ama göndermediğiniz bir yanıt var. Gönderilmeden çıkış yapılırsa kaydedilmez.'
              : 'An answer you typed has not been submitted. If you are signed out first, it will not be saved.'}
          </p>
        )}
        <button type="button" data-testid="session-stay" onClick={() => setLeft(null)}
          className="mt-2 inline-flex h-8 items-center rounded-[10px] bg-[#072C0E] px-3 text-[12px] font-semibold text-white hover:bg-[#175022]">
          {tr ? 'Oturumu açık tut' : 'Stay signed in'}
        </button>
      </div>
    </div>
  );
}
