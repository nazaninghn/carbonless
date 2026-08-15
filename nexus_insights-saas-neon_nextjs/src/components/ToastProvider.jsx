'use client';

/**
 * Toast notification system
 *
 * Usage:
 *   1. Wrap your app (or page) with <ToastProvider>
 *   2. Call const toast = useToast() inside any child component
 *   3. toast.success('Saved!') / toast.error('Oops') / toast.warning(...) / toast.info(...)
 */

import {
  createContext, useCallback, useContext,
  useEffect, useMemo, useRef, useState,
} from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastCtx = createContext(null);
let _seq = 0;

// ─── Per-type config ──────────────────────────────────────────────────────────
const CONFIG = {
  success: {
    icon:   CheckCircle2,
    accent: '#2ABD41',
    bg:     'bg-white',
    border: 'border-[#2ABD41]/25',
    bar:    '#2ABD41',
    text:   'text-[#175022]',
    dim:    'text-[#072C0E]/55',
  },
  error: {
    icon:   AlertCircle,
    accent: '#ef4444',
    bg:     'bg-white',
    border: 'border-red-200',
    bar:    '#ef4444',
    text:   'text-red-600',
    dim:    'text-[#072C0E]/55',
  },
  warning: {
    icon:   AlertTriangle,
    accent: '#f59e0b',
    bg:     'bg-white',
    border: 'border-amber-200',
    bar:    '#f59e0b',
    text:   'text-amber-600',
    dim:    'text-[#072C0E]/55',
  },
  info: {
    icon:   Info,
    accent: '#3b82f6',
    bg:     'bg-white',
    border: 'border-blue-200',
    bar:    '#3b82f6',
    text:   'text-blue-600',
    dim:    'text-[#072C0E]/55',
  },
};

// ─── Single Toast ─────────────────────────────────────────────────────────────
function Toast({ id, type, message, duration, onDismiss, language }) {
  const [in_,    setIn]    = useState(false);
  const [out,    setOut]   = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef    = useRef(null);
  const startedRef  = useRef(Date.now());
  const remainRef   = useRef(duration);

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    setOut(true);
    setTimeout(() => onDismiss(id), 260);
  }, [id, onDismiss]);

  // Slide-in on mount
  useEffect(() => {
    const t = setTimeout(() => setIn(true), 16);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss with pause-on-hover
  useEffect(() => {
    if (paused) {
      clearTimeout(timerRef.current);
      remainRef.current -= Date.now() - startedRef.current;
      return;
    }
    startedRef.current = Date.now();
    timerRef.current = setTimeout(dismiss, remainRef.current);
    return () => clearTimeout(timerRef.current);
  }, [paused, dismiss]);

  const { icon: Icon, bg, border, bar, text, dim } = CONFIG[type] ?? CONFIG.info;

  return (
    <div
      className={`
        pointer-events-auto w-full overflow-hidden
        rounded-2xl border shadow-[0_8px_32px_rgba(7, 44, 14,0.13)]
        backdrop-blur-xl transition-all duration-[260ms]
        ${bg} ${border}
        ${in_ && !out
          ? 'translate-x-0 translate-y-0 opacity-100'
          : 'translate-x-5 opacity-0'}
      `}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Body */}
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${text}`} />
        <p className={`flex-1 text-[13px] font-semibold leading-[1.45] ${dim}`}>
          {message}
        </p>
        <button
          onClick={dismiss}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full opacity-35 transition-opacity hover:opacity-70 ${text}`}
          aria-label={language === 'tr' ? 'Kapat' : 'Dismiss'}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] bg-black/4">
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: bar,
            // animationPlayState pauses the bar in-place on hover so it resumes from
            // the same position when the mouse leaves. The previous approach toggled
            // animation between 'none' and the full keyframe string, which caused the
            // bar to restart from 0% every time the user un-hovered — a visual glitch
            // where the bar appeared full again even though dismiss was imminent.
            animation: `toastProg ${duration}ms linear forwards`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  );
}

// ─── Container (fixed, stacked) ───────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss, language }) {
  return (
    <>
      {/* bottom-20 on mobile keeps toasts above the fixed bottom nav (h-16 + safe-area)
          bottom-6 on lg because no bottom nav */}
      <div
        className="
          pointer-events-none
          fixed bottom-20 right-0 z-[300]
          flex w-full max-w-[360px] flex-col gap-2
          px-3
          lg:bottom-6 lg:px-4
        "
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(t => (
          <Toast key={t.id} {...t} onDismiss={onDismiss} language={language} />
        ))}
      </div>
    </>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children, language }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((type, message, duration = 3500) => {
    const id = ++_seq;
    // Keep max 5 toasts — drop oldest if overflow
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  // Memoize so the context value reference stays stable across re-renders
  // triggered by toasts state changes — prevents all useToast() consumers from
  // re-rendering every time a toast is added or dismissed.
  // `add` is already useCallback([]) so its reference never changes.
  const toast = useMemo(() => ({
    success: (msg, dur) => add('success', msg, dur),
    error:   (msg, dur) => add('error',   msg, dur),
    warning: (msg, dur) => add('warning', msg, dur),
    info:    (msg, dur) => add('info',    msg, dur),
  }), [add]);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} language={language} />
    </ToastCtx.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastCtx);
  // Graceful no-op outside provider (never throws in production)
  return ctx ?? {
    success: () => {},
    error:   () => {},
    warning: () => {},
    info:    () => {},
  };
}
