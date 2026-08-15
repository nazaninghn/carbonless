'use client';
import { Component } from 'react';

/**
 * React Error Boundary — catches render-time errors in any child subtree.
 * Use it to wrap dashboard tabs so one tab crashing doesn't nuke the whole app.
 *
 * Props:
 *   fallbackTitle   – heading shown in error state (optional)
 *   fallbackMessage – body text shown in error state (optional)
 *   children        – the subtree to protect
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error, _info) {
    // Intentionally silent in production — error state is surfaced via render fallback.
    // To debug locally: set a breakpoint here or hook into window.onerror.
  }

  render() {
    if (this.state.hasError) {
      // Every current call site (app/dashboard/page.jsx, x10) passes
      // `language` but not fallbackTitle/fallbackMessage — meaning
      // every dashboard tab, if it ever crashes, showed this hardcoded
      // English text to Turkish users regardless of their selected
      // language. Real, live gap (not dead-code like ConfirmDialog's
      // equivalent), since a render crash is exactly the kind of thing
      // that does happen in production.
      const tr = this.props.language === 'tr';
      const title   = this.props.fallbackTitle   || (tr ? 'Bir şeyler ters gitti' : 'Something went wrong');
      const message = this.props.fallbackMessage || (tr ? 'Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin veya tekrar deneyin.' : 'An unexpected error occurred. Please refresh the page or try again.');

      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-red-200/70 bg-red-50/60 p-12 text-center shadow-[0_4px_16px_rgba(220,38,38,0.06)]">
          {/* Icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100/80">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          {/* Text */}
          <div>
            <p className="text-base font-bold text-red-800">{title}</p>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-red-600/70">{message}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-full bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-red-700"
            >
              {this.props.language === 'tr' ? 'Tekrar Dene' : 'Try Again'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full border border-red-300 bg-white px-5 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50"
            >
              {this.props.language === 'tr' ? 'Sayfayı Yenile' : 'Reload Page'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
