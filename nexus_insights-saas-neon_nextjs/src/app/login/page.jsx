'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { authErrorMessage } from '@/lib/authErrors';
import NextLink from 'next/link';
import Image from 'next/image';
import { Cormorant_Garamond } from 'next/font/google';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { api, markSessionActive } from '@/lib/utils/api';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// The Django backend (and Simple-JWT's own default serializer) returns
// English error prose, not error codes — `detail` below was being shown
// to the user verbatim regardless of selected language, bypassing the
// tr/en branching entirely for any login failure with a specific
// message. Maps the known, stable strings; anything not in this map
// still falls back to the raw text (better than silently swallowing a
// real error), but at least the common cases are translated.
const KNOWN_BACKEND_ERRORS_TR = {
  'No active account found with the given credentials': 'Girilen bilgilerle eşleşen aktif bir hesap bulunamadı.',
  'Invalid credentials': 'Kullanıcı adı veya şifre hatalı.',
  'This account is inactive.': 'Bu hesap devre dışı.',
};

function translateBackendError(detail, tr) {
  if (!tr || !detail) return detail;
  return KNOWN_BACKEND_ERRORS_TR[detail] || detail;
}

/* How long the door handle takes to turn (the loginDoorOpen animation below). */
const DOOR_MS = 1000;

/* The brand tagline's face: Cormorant Garamond italic, a refined serif that sets the sentence apart from the interface's sans (Inter / General Sans).
   Loaded here, so only the Login page pays for it. latin-ext covers the Turkish letters. */
const taglineFont = Cormorant_Garamond({ subsets: ['latin', 'latin-ext'], weight: ['500', '600'], style: ['italic'], display: 'swap' });

/* The Login picture (public/loginnew.png, 1122 x 1402, transparent) with the brand tagline directly under it.
   The art spans x 187-974, y 225-1237 of the canvas, so the picture is drawn in a 820 x 1050 box that starts at (170, 210): the empty
   margins are cropped away (nothing visible is lost), its proportions are kept, and the box has a fixed aspect ratio so nothing shifts
   while it loads. `widthClass` sets how wide the box may be.
   After a successful sign-in the door handle is pressed down (`open`): the same picture split in two layers drawn over it,
   public/login-door-base.webp (the picture without the handle, with what lies under it filled in) and
   public/login-door-handle.webp (the handle alone), both on the same 1122 x 1402 canvas; the handle turns about its spindle
   (319, 367). Together they reproduce loginnew.png, so the swap from the original to the layers can't be seen. */
const ART_POS = { width: '136.83%', left: '-20.73%', top: '-20%' };
function LoginArt({ tr, widthClass, open }) {
  return (
    <figure data-testid="login-art" className="m-0 flex w-full flex-col items-center text-center">
      <div data-testid="login-art-box" data-door={open ? 'open' : undefined} className={`relative ${widthClass}`} style={{ aspectRatio: '820 / 1050' }}>
        <Image
          data-testid="login-art-img"
          src="/loginnew.png"
          alt={tr ? 'Ormandan bir ayak izi ve karbon simgeleri olan kapı askısı' : 'A door hanger with a footprint made of forest and carbon icons'}
          width={1122}
          height={1402}
          sizes="(min-width: 1024px) 416px, 70vw"
          className="login-art-whole absolute h-auto max-w-none select-none"
          style={ART_POS}
        />
        <div aria-hidden="true" className="login-door pointer-events-none absolute max-w-none select-none" style={{ ...ART_POS, aspectRatio: '1122 / 1402' }}>
          <Image data-door-layer="base" src="/login-door-base.webp" alt="" width={1122} height={1402} sizes="(min-width: 1024px) 570px, 96vw" className="absolute inset-0 h-full w-full" />
          <Image data-door-layer="handle" src="/login-door-handle.webp" alt="" width={1122} height={1402} sizes="(min-width: 1024px) 570px, 96vw" className="login-door-handle absolute inset-0 h-full w-full" />
        </div>
      </div>
      {/* from 1024px up the rule and the tagline sit a little to the left of the picture's centre line, toward the form, so the sentence reads as part of the page's left side; on phones they stay centred */}
      <figcaption className="mt-1 flex flex-col items-center lg:-translate-x-10 xl:-translate-x-14">
        <span aria-hidden="true" className="mb-4 block h-px w-14 bg-gradient-to-r from-transparent via-[#2ABD41] to-transparent" />
        <p
          data-testid="login-tagline"
          className={`${taglineFont.className} max-w-[20em] px-2 text-[clamp(1.375rem,1.1rem+0.9vw,1.875rem)] font-semibold italic leading-[1.3] tracking-[0.012em] text-[#175022]`}
          style={{ textWrap: 'balance' }}
        >
          {tr ? 'Ölçtüğümüz her ayak izi, daha yeşil bir yarına atılmış bir adımdır.' : 'Every footprint we measure is a step toward a greener tomorrow.'}
        </p>
      </figcaption>
    </figure>
  );
}

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
  const mainRef = useRef(null);
  const busyRef = useRef(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const tr = language === 'tr';

  const sessionExpired = searchParams.get('reason') === 'session_expired';
  // set by the session layer when an answer was typed but never submitted before the session ended
  const [unsavedNote, setUnsavedNote] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem('carbonless_expired_unsaved') === '1') {
        setUnsavedNote(true);
        sessionStorage.removeItem('carbonless_expired_unsaved');
      }
    } catch { /* storage unavailable */ }
  }, []);

  const completeLogin = useCallback(() => {
    markSessionActive();
    document.cookie = 'carbonless_mode_chosen=1; path=/; SameSite=Lax';
    // Came from an invite link while signed out: finish joining that team.
    let inviteToken = null;
    try { inviteToken = sessionStorage.getItem('pendingInviteToken'); } catch {}
    // Came from a link into the app (an approval e-mail): go back to it.
    // Only a path inside the dashboard — never another site.
    const next = searchParams.get('next') || '';
    const safeNext = /^\/dashboard(\/|\?|$)/.test(next) && !next.startsWith('//') ? next : null;
    window.location.href = inviteToken
      ? `/accept-invite?token=${encodeURIComponent(inviteToken)}`
      : (safeNext || '/dashboard/select');
  }, [searchParams]);

  /* Press the door handle on the visible picture and resolve when it has finished. Only called after the server accepted the
     sign-in. Resolves at once (no delay) when motion is reduced, the picture is off screen, or its layers aren't ready. */
  const openDoor = useCallback(() => new Promise(resolve => {
    const box = [...(mainRef.current?.querySelectorAll('[data-testid="login-art-box"]') || [])].find(el => el.getClientRects().length);
    const r = box?.getBoundingClientRect();
    if (!r || r.bottom <= 0 || r.top >= window.innerHeight || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return resolve();
    const layers = [...box.querySelectorAll('[data-door-layer]')];
    const ready = Promise.all(layers.map(img => img.decode()));
    const tooSlow = new Promise((_, reject) => setTimeout(reject, 800));
    Promise.race([ready, tooSlow]).then(() => {
      let timer;
      const done = () => { clearTimeout(timer); resolve(); };
      timer = setTimeout(done, DOOR_MS + 400);   // in case animationend never comes (e.g. a background tab)
      const handle = box.querySelector('[data-door-layer="handle"]');
      if (!handle) return resolve();
      handle.addEventListener('animationend', done, { once: true });
      setDoorOpen(true);
    }, () => resolve());
  }), []);

  const handleGoogleCredential = useCallback(async (response) => {
    if (busyRef.current) return;   // one sign-in at a time (either way), including while the door opens
    busyRef.current = true;
    setError('');
    setMaybeUnverified(false);
    setLoading(true);
    try {
      const res = await api.googleLogin(response.credential);
      if (res.ok) {
        // Signed in with Google: the same door, then the app opens.
        await openDoor();
        completeLogin();
        return;
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.code === 'rate_limited'
          ? authErrorMessage(data, tr)
          : translateBackendError(data?.error, tr) || (tr ? 'Google ile giriş başarısız oldu.' : 'Google sign-in failed.'));
      }
    } catch {
      setError(tr ? 'Sunucu bağlantı hatası' : 'Server connection error');
    }
    setLoading(false);
    busyRef.current = false;
  }, [tr, completeLogin, openDoor]);

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
    if (busyRef.current) return;   // one sign-in at a time, including while the door opens
    busyRef.current = true;
    setError('');
    setMaybeUnverified(false);
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.ok) {
        // Signed in: the door handle turns, then the app opens. The button stays disabled until the page leaves.
        await openDoor();
        completeLogin();
        return;
      } else {
        const data = await res.json().catch(() => ({}));
        if (data?.code === 'rate_limited') {
          setError(authErrorMessage(data, tr));
        } else if (res.status >= 500) {
          setError(tr ? 'Sunucu hatası. Lütfen tekrar deneyin.' : 'Server error. Please try again.');
        } else {
          const detail = data?.detail || data?.error;
          if (detail === 'No active account found with the given credentials') {
            setMaybeUnverified(true);
          }
          setError(translateBackendError(detail, tr) || (tr ? 'Kullanıcı adı veya şifre hatalı.' : 'Invalid username or password.'));
        }
      }
    } catch {
      setError(tr ? 'Sunucu bağlantı hatası' : 'Server connection error');
    }
    setLoading(false);
    busyRef.current = false;
  }, [email, password, tr, completeLogin, openDoor]);

  return (
    <main ref={mainRef} className="relative min-h-screen bg-green-50">
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
        /* the door handle: pressed down about its spindle, with a little give at the start and a soft settle at the end */
        @keyframes loginDoorOpen {
          0% { transform: rotate(0deg); animation-timing-function: cubic-bezier(0.3, 0, 0.6, 1); }
          12% { transform: rotate(-2deg); animation-timing-function: cubic-bezier(0.5, 0, 0.3, 1); }
          68% { transform: rotate(31deg); animation-timing-function: ease-in-out; }
          84% { transform: rotate(28.5deg); animation-timing-function: ease-in-out; }
          100% { transform: rotate(30deg); }
        }
        .login-door { opacity: 0; }
        .login-door-handle { transform-origin: 28.431% 26.177%; }
        [data-door="open"] .login-door { opacity: 1; }
        [data-door="open"] .login-art-whole { opacity: 0; }
        [data-door="open"] .login-door-handle { animation: loginDoorOpen ${DOOR_MS}ms both; }
      `}} />
      {/* Language toggle — pinned to the true top-right corner of the page,
          independent of the two-column split (sits above the image on desktop) */}
      <div className="absolute top-5 right-5 z-50 flex items-center gap-0.5 rounded-full bg-white/95 border border-[#DEFAE1] p-0.5 shadow-sm backdrop-blur-sm">
        {['en', 'tr'].map(l => (
          <button
            key={l}
            onClick={() => changeLanguage(l)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition ${
              language === l ? 'btn-primary' : 'text-[#072C0E]/40 hover:text-[#072C0E]'
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
              {/* "Forgot password" sits above the field but comes after it in
                  the page order: Tab from the email goes to the password, not
                  to the link (typing the password there and pressing Enter
                  opened the forgot-password page). */}
              <div className="grid grid-cols-[1fr_auto] items-center gap-y-2">
                <label htmlFor="login-password" className="col-start-1 row-start-1 block text-[12px] font-bold uppercase tracking-wide text-[#072C0E]/55">{t.login.password}</label>
                <div className="col-span-2 row-start-2 flex items-center gap-3 rounded-2xl border border-[#DEFAE1] bg-white px-4 py-3.5 shadow-sm transition focus-within:border-[#2ABD41] focus-within:ring-4 focus-within:ring-[#2ABD41]/10">
                  <LockKeyhole className="h-[18px] w-[18px] text-[#2ABD41]" strokeWidth={1.8} />
                  <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent text-[14px] font-medium text-[#072C0E] outline-none placeholder:text-[#072C0E]/30" placeholder="********" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword} aria-label={tr ? (showPassword ? 'Şifreyi gizle' : 'Şifreyi göster') : (showPassword ? 'Hide password' : 'Show password')} className="text-[#072C0E]/35 hover:text-[#072C0E]">
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                <NextLink href="/forgot-password" className="col-start-2 row-start-1 text-[12px] font-semibold text-[#2ABD41] hover:underline">{t.login.forgotPassword}</NextLink>
              </div>

              {sessionExpired && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[12px] font-medium text-amber-700">
                  {tr
                    ? 'Oturumunuz, 30 dakika işlem yapılmadığı için sona erdi. Kaydedilmiş verileriniz korunuyor; giriş yaparak kaldığınız yerden devam edebilirsiniz.'
                    : 'Your session ended after 30 minutes of inactivity. Your saved data is safe: sign in to continue where you left off.'}
                  {unsavedNote && (
                    <span data-testid="session-unsaved-note" className="mt-1 block font-semibold text-red-700">
                      {tr
                        ? 'Göndermediğiniz bir yanıt kaydedilemedi; lütfen tekrar girin.'
                        : 'An answer you had typed but not submitted was not saved. Please enter it again.'}
                    </span>
                  )}
                </div>
              )}
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-[12px] font-medium text-red-600">
                  {error}
                  {maybeUnverified && (
                    <div className="mt-2 border-t border-red-200 pt-2">
                      {tr ? 'Hesabınız henüz doğrulanmadıysa: ' : "Your account may not be verified yet. "}
                      <NextLink href={`/verify-email?email=${encodeURIComponent(email)}`} className="font-semibold text-[#2ABD41] hover:underline">
                        {tr ? 'Doğrulama kodunu gir' : 'Enter verification code'}
                      </NextLink>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading || doorOpen} className="group flex w-full items-center justify-center gap-2 rounded-full btn-primary px-5 py-4 text-[14px] font-bold transition disabled:hover:translate-y-0">
                {loading ? (tr ? 'Giriş yapılıyor...' : 'Signing in...') : t.login.title}
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

        <div className="lg:hidden pb-6 pt-2">
          <LoginArt tr={tr} widthClass="w-[min(62%,15rem)]" open={doorOpen} />
        </div>

        <p className="text-[11px] text-[#072C0E]/30">&copy; {new Date().getFullYear()} Carbonless</p>
      </div>

      {/* Right — the Login illustration (loginnew.png) with the brand tagline under it, then the glass caption; no background card behind it. */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 xl:p-10">
        <div className="flex w-full max-w-xl flex-col items-center">
          {/* loginnew.png has a real alpha channel, so it sits straight on the page with no blend trick (the earlier login-bg.png needed one) */}
          <LoginArt tr={tr} widthClass="w-[min(100%,26rem,calc((100svh-17rem)*0.78))]" open={doorOpen} />
          {/* Glass caption — attached under the illustration, gentle drift so it feels alive */}
          <div className="login-caption-float relative mt-8 mx-6 w-full max-w-md rounded-2xl border border-white/60 bg-white/85 p-5 shadow-lg shadow-[#072C0E]/5 backdrop-blur-md">
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
