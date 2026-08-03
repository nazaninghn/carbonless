'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import Image from 'next/image';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { api, markSessionActive } from '@/lib/utils/api';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function LoginContent() {
  const { t, language, changeLanguage } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [maybeUnverified, setMaybeUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);
  const tr = language === 'tr';

  const sessionExpired = searchParams.get('reason') === 'session_expired';

  const completeLogin = useCallback(() => {
    markSessionActive();
    document.cookie = 'carbonless_mode_chosen=1; path=/; SameSite=Lax';
    window.location.href = '/dashboard/select';
  }, []);

  const handleGoogleCredential = useCallback(async (response) => {
    setError('');
    setMaybeUnverified(false);
    setLoading(true);
    try {
      const res = await api.googleLogin(response.credential);
      if (res.ok) {
        completeLogin();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || (tr ? 'Google ile giris basarisiz oldu.' : 'Google sign-in failed.'));
      }
    } catch {
      setError(tr ? 'Sunucu baglanti hatasi' : 'Server connection error');
    } finally { setLoading(false); }
  }, [tr, completeLogin]);

  // Render the official Google button once both the GSI script has loaded
  // and the target div exists. Re-runs on language change so the button's
  // own locale (and our text) stay in sync.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleReady || !googleButtonRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    googleButtonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'center',
      width: Math.min(googleButtonRef.current.offsetWidth || 336, 400),
      locale: tr ? 'tr' : 'en',
    });
  }, [googleReady, tr, handleGoogleCredential]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setMaybeUnverified(false);
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.ok) {
        completeLogin();
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status >= 500) {
          setError(tr ? 'Sunucu hatasi. Lutfen tekrar deneyin.' : 'Server error. Please try again.');
        } else {
          const detail = data?.detail || data?.error;
          if (detail === 'No active account found with the given credentials') {
            setMaybeUnverified(true);
          }
          setError(detail || (tr ? 'Kullanici adi veya sifre hatali.' : 'Invalid username or password.'));
        }
      }
    } catch {
      setError(tr ? 'Sunucu baglanti hatasi' : 'Server connection error');
    } finally { setLoading(false); }
  }, [email, password, tr, completeLogin]);

  return (
    <main className="relative min-h-screen bg-[#F9FFF4]">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loginCaptionFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .login-caption-float {
          animation: loginCaptionFloat 5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .login-caption-float { animation: none; }
        }
      `}} />
      {/* Language toggle — pinned to the true top-right corner of the page,
          independent of the two-column split (sits above the image on desktop) */}
      <div className="absolute top-5 right-5 z-50 flex items-center gap-0.5 rounded-full bg-white/95 border border-[#DEFAE1] p-0.5 shadow-sm backdrop-blur-sm">
        {['en', 'tr'].map(l => (
          <button
            key={l}
            onClick={() => changeLanguage(l)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition ${
              language === l ? 'bg-[#2ABD41] text-white' : 'text-[#072C0E]/40 hover:text-[#072C0E]'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Caps the two-column layout on ultra-wide monitors so the form doesn't
          pin to the far-left edge with the image card stranded in empty space. */}
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] lg:gap-5 lg:p-5">
      {/* Left — Form column */}
      <div className="flex w-full lg:w-[44%] flex-col px-6 py-6 sm:px-12">
        {/* Top row: logo */}
        <div className="flex items-center">
          <NextLink href="/" className="flex items-center gap-2.5">
            <Image src="/carbonless.png" alt="Carbonless" width={36} height={36} className="h-9 w-9" />
            <span className="text-[17px] font-extrabold text-[#072C0E] tracking-tight">Carbonless</span>
          </NextLink>
        </div>

        {/* Centered form */}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DEFAE1] bg-white px-3 py-1 text-[11px] font-bold text-[#1A7B2A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2ABD41]" />
              {tr ? 'Karbon muhasebesi platformu' : 'Carbon accounting platform'}
            </span>
            <h2 className="mt-4 text-[34px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#072C0E]">
              {tr ? <>Tekrar <span className="text-[#2ABD41]">hoş geldiniz</span></> : <>Welcome <span className="text-[#2ABD41]">back</span></>}
            </h2>
            <p className="mt-2 text-[14px] text-[#072C0E]/50">{t.login.subtitle}</p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-[#072C0E]/55">{t.login.email}</label>
                <div className="flex items-center gap-3 rounded-2xl border border-[#DEFAE1] bg-white px-4 py-3.5 shadow-sm transition focus-within:border-[#2ABD41] focus-within:ring-4 focus-within:ring-[#2ABD41]/10">
                  <Mail className="h-[18px] w-[18px] text-[#2ABD41]" strokeWidth={1.8} />
                  <input id="login-email" type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent text-[14px] font-medium text-[#072C0E] outline-none placeholder:text-[#072C0E]/30" placeholder={t.login.emailPlaceholder} required />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="login-password" className="block text-[12px] font-bold uppercase tracking-wide text-[#072C0E]/55">{t.login.password}</label>
                  <NextLink href="/forgot-password" className="text-[12px] font-semibold text-[#2ABD41] hover:underline">{t.login.forgotPassword}</NextLink>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-[#DEFAE1] bg-white px-4 py-3.5 shadow-sm transition focus-within:border-[#2ABD41] focus-within:ring-4 focus-within:ring-[#2ABD41]/10">
                  <LockKeyhole className="h-[18px] w-[18px] text-[#2ABD41]" strokeWidth={1.8} />
                  <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent text-[14px] font-medium text-[#072C0E] outline-none placeholder:text-[#072C0E]/30" placeholder="********" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[#072C0E]/35 hover:text-[#072C0E]">
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              {sessionExpired && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[12px] font-medium text-amber-700">
                  {tr ? 'Oturumunuz sona erdi.' : 'Your session has expired.'}
                </div>
              )}
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-[12px] font-medium text-red-600">
                  {error}
                  {maybeUnverified && (
                    <div className="mt-2 border-t border-red-200 pt-2">
                      {tr ? 'Hesabiniz henuz dogrulanmadiysa: ' : "Your account may not be verified yet. "}
                      <NextLink href={`/verify-email?email=${encodeURIComponent(email)}`} className="font-semibold text-[#2ABD41] hover:underline">
                        {tr ? 'Dogrulama kodunu gir' : 'Enter verification code'}
                      </NextLink>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading} className="group flex w-full items-center justify-center gap-2 rounded-full bg-[#2ABD41] px-5 py-4 text-[14px] font-bold text-white shadow-lg shadow-[#2ABD41]/25 transition hover:bg-[#1D9C31] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0">
                {loading ? (tr ? 'Giris yapiliyor...' : 'Signing in...') : t.login.title}
                {!loading && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}
              </button>
            </form>

            {GOOGLE_CLIENT_ID && (
              <>
                <Script
                  src="https://accounts.google.com/gsi/client"
                  strategy="afterInteractive"
                  onLoad={() => setGoogleReady(true)}
                />
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#DEFAE1]" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#072C0E]/35">
                    {tr ? 'veya' : 'or'}
                  </span>
                  <div className="h-px flex-1 bg-[#DEFAE1]" />
                </div>
                <div ref={googleButtonRef} className="mt-5 flex w-full justify-center" />
              </>
            )}

            <div className="mt-8 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#DEFAE1]" />
              <p className="text-[12px] text-[#072C0E]/50">
                {t.login.noAccount}{' '}
                <NextLink href="/register" className="font-bold text-[#2ABD41] hover:underline">{t.nav.register}</NextLink>
              </p>
              <div className="h-px flex-1 bg-[#DEFAE1]" />
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[#072C0E]/30">&copy; 2026 Carbonless</p>
      </div>

      {/* Right — Illustration shown at its natural 5:4 ratio, no background card
          behind it, sized up to fill the column better without stretching/cropping. */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 xl:p-10">
        <div className="w-full max-w-xl">
          {/* login-bg.png is a flat opaque PNG (no alpha channel) with a solid
              white backdrop baked in, which showed up as a hard rectangle against
              the page's cream background. mix-blend-multiply drops white to
              transparent against the page color and leaves the illustration
              itself untouched, so the seam disappears without editing the asset. */}
          <Image
            src="/login-bg.png"
            alt="Carbonless"
            width={1402}
            height={1122}
            className="h-auto w-full mix-blend-multiply"
            priority
          />
          {/* Glass caption — attached under the illustration, gentle drift so it feels alive */}
          <div className="login-caption-float relative -mt-4 mx-6 rounded-2xl border border-white/60 bg-white/85 p-5 shadow-lg shadow-[#072C0E]/5 backdrop-blur-md">
            <p className="text-[15px] font-bold text-[#072C0E]">
              {tr ? 'Scope 1 · 2 · 3 emisyonlarınızı AI ile ölçün' : 'Measure your Scope 1 · 2 · 3 emissions with AI'}
            </p>
            <p className="mt-1 text-[12px] font-medium text-[#072C0E]/60">
              {tr ? 'ISO 14064-1 uyumlu raporlar, dakikalar içinde' : 'ISO 14064-1 compliant reports, in minutes'}
            </p>
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
