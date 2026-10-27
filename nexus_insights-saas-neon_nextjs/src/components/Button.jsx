'use client';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

// Shared button. Styling lives in globals.css (.btn, .btn-sm|md|lg, .btn-<variant>);
// this wrapper adds loading state and duplicate-click protection.
const VARIANT = {
  primary: 'btn-primary',
  'primary-dark': 'btn-primary-dark',
  secondary: 'btn-secondary',
  tertiary: 'btn-tertiary',
  glass: 'btn-glass',
  dark: 'btn-dark',
  danger: 'btn-danger',
};

/**
 * variant: primary | primary-dark | secondary | tertiary | glass | dark | danger
 * size:    sm | md | lg
 * icon:    icon-only button — `aria-label` is required (there is no visible text)
 * loading: shows a spinner, sets aria-busy and ignores further clicks / submits
 * href:    renders a next/link instead of a <button>
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  icon = false,
  loading = false,
  disabled = false,
  href,
  type = 'button',
  className = '',
  onClick,
  children,
  ...rest
}) {
  const blocked = loading || disabled;
  const cls = [
    icon ? 'btn-icon' : `btn ${VARIANT[variant] || VARIANT.primary}`,
    icon ? (size === 'sm' ? 'btn-sm' : '') : `btn-${size}`,
    className,
  ].filter(Boolean).join(' ');

  const handleClick = (e) => {
    if (blocked) { e.preventDefault(); return; }
    onClick?.(e);
  };

  const content = (
    <>
      {loading && <Loader2 aria-hidden="true" className="animate-spin" />}
      {children}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cls}
        aria-disabled={blocked || undefined}
        aria-busy={loading || undefined}
        tabIndex={blocked ? -1 : undefined}
        onClick={handleClick}
        {...rest}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={cls}
      disabled={blocked}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...rest}
    >
      {content}
    </button>
  );
}
