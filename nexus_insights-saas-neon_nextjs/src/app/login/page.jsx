'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import {
  ArrowRight, CheckCircle2, Eye, EyeOff, Globe2,
  LockKeyhole, Mail, ShieldCheck, Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const { t, language, changeLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'session_expired') setSessionExpired(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/accounts/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: email, password }),
      });
      let data = {};
      try { data = await res.json(); } catch {}
      if (res.ok) {
        if (data.access) { const { setAccessToken } = await import('@/lib/utils/api'); setAccessToken(data.access); }
        window.location.href = '/dashboard';
      } else {
        setError(language === 'tr' ? 'E-posta veya şifre hatalı' : 'Invalid email or password');
      }
    } catch {
      setError(language === 'tr' ? 'Sunucu bağlantı hatası' : 'Server connection error');
    } finally { setLoading(false); }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F9EFE5] text-[#302817]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(248,248,248,0.92),transparent_34%),radial-gradient(circle_at_30%_32%,rgba(127,135,144,0.14),transparent_30%),radial-gradient(circle_at_75%_22%,rgba(143,146,161,0.15),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-gradient-to-b from-white/75 via-[#F9EFE5]/50 to-[#F9EFE5]" />

      <header className="relative z-20 mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NextLink href="/" className="flex items-center gap-3">
          <img src="/carbonless.png" alt="Carbonless" className="h-8 w-8 sm:h-10 sm:w-10" />
          <span className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[#302817]">Carbonless</span>
        </NextLink>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button onClick={() => changeLanguage(language === 'tr' ? 'en' : 'tr')} className="inline-flex items-center gap-1.5 rounded-full border border-[#8F92A1]/25 bg-white/55 px-3 py-2 text-xs font-bold text-[#302817] shadow-lg shadow-[#302817]/5 backdrop-blur-xl transition hover:border-[#8F92A1]/45 hover:bg-white/80">
            <Globe2 className="h-4 w-4 text-[#7F8790]" />{language === 'tr' ? 'EN' : 'TR'}
          </button>
          <NextLink href="/register" className="rounded-full border border-[#302817]/15 bg-white/55 px-4 py-2.5 text-sm font-bold text-[#302817] shadow-xl shadow-[#302817]/10 backdrop-blur-xl transition hover:border-[#8F92A1]/40 hover:bg-[#302817] hover:text-[#F9EFE5] sm:px-6 sm:py-3">
            {language === 'tr' ? 'Hesap Oluştur' : 'Create account'}
          </NextLink>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-6xl items-center gap-6 px-4 pb-8 pt-0 sm:px-6 lg:grid-cols-[0.9fr_0.75fr] lg:px-8">
        {/* Left side - desktop only */}
        <div className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#8F92A1]/25 bg-white/55 px-4 py-2 text-sm font-bold text-[#8F92A1] shadow-lg shadow-[#302817]/5 backdrop-blur-xl">
            <Sparkles className="h-4 w-4 text-[#7F8790]" />
            {language === 'tr' ? 'Akıllı karbon raporlamaya hoş geldiniz' : 'Welcome back to smarter carbon reporting'}
          </div>
          <h1 className="mt-5 max-w-xl text-4xl font-bold leading-[1.05] tracking-[-0.055em] text-[#302817] xl:text-5xl">
            {language === 'tr' ? 'Karbon envanterinize netlikle devam edin.' : 'Continue your carbon inventory with clarity.'}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#302817]/65">
            {language === 'tr' ? 'Emisyon verilerinize ve raporlarınıza tek bir temiz çalışma alanından erişin.' : 'Access emissions, reports and reduction targets from one clean workspace.'}
          </p>
          <div className="mt-8 grid max-w-lg gap-3">
            {(language === 'tr' ? ['Scope 1, 2 ve 3 emisyonlarını takip edin', 'Ekibiniz için temiz raporlar oluşturun', 'Şirket verilerinizi güvenli tutun'] : ['Track Scope 1, 2 and 3 emissions', 'Generate clean reports for your team', 'Keep company data secure']).map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-[#302817]/10 bg-white/55 px-4 py-3 shadow-sm shadow-[#302817]/5 backdrop-blur-xl">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#8F92A1]" />
                <span className="text-sm font-semibold text-[#302817]/75">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Form */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[2rem] border border-[#302817]/10 bg-white/55 p-5 shadow-2xl shadow-[#302817]/10 backdrop-blur-2xl sm:p-6">
            <div className="mb-5 text-center sm:text-left">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#8F92A1]/14 text-[#7F8790] ring-1 ring-[#8F92A1]/25 sm:mx-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-[-0.04em] text-[#302817]">{t.login.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#302817]/60">{t.login.subtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-[#302817]/75">{t.login.email}</label>
                <div className="group flex items-center gap-3 rounded-2xl border border-[#302817]/10 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl transition focus-within:border-[#8F92A1]/60 focus-within:bg-white/70 focus-within:ring-4 focus-within:ring-[#8F92A1]/20">
                  <Mail className="h-5 w-5 text-[#7F8790]" />
                  <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent text-sm font-semibold text-[#302817] outline-none placeholder:text-[#302817]/35" placeholder={t.login.emailPlaceholder} required />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-4">
                  <label className="block text-sm font-bold text-[#302817]/75">{t.login.password}</label>
                  <NextLink href="/forgot-password" className="text-xs font-bold text-[#7F8790] transition hover:text-[#302817]">{t.login.forgotPassword}</NextLink>
                </div>
                <div className="group flex items-center gap-3 rounded-2xl border border-[#302817]/10 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl transition focus-within:border-[#8F92A1]/60 focus-within:bg-white/70 focus-within:ring-4 focus-within:ring-[#8F92A1]/20">
                  <LockKeyhole className="h-5 w-5 text-[#7F8790]" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent text-sm font-semibold text-[#302817] outline-none placeholder:text-[#302817]/35" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[#302817]/45 transition hover:text-[#302817]" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 text-xs font-semibold text-[#302817]/60">
                <input type="checkbox" className="h-4 w-4 rounded border-[#302817]/20 accent-[#8F92A1]" />{t.login.rememberMe}
              </label>

              {sessionExpired && <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-xs font-semibold text-amber-700">{language === 'tr' ? 'Oturumunuz sona erdi.' : 'Your session has expired.'}</div>}
              {error && <div className="rounded-2xl border border-red-200 bg-red-50/90 p-3 text-xs font-semibold text-red-600">{error}</div>}

              <button type="submit" disabled={loading} className="group flex w-full items-center justify-center gap-2 rounded-full bg-[#302817] px-5 py-3 text-sm font-bold text-[#F9EFE5] shadow-xl shadow-[#302817]/18 transition hover:-translate-y-0.5 hover:bg-black disabled:opacity-60">
                {loading ? (language === 'tr' ? 'Giriş yapılıyor...' : 'Signing in...') : t.login.title}
                {!loading && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-[#302817]/60">
              {t.login.noAccount}{' '}
              <NextLink href="/register" className="font-bold text-[#7F8790] transition hover:text-[#302817]">{t.nav.register}</NextLink>
            </p>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-[#302817]/50">
            <ShieldCheck className="h-3.5 w-3.5 text-[#8F92A1]" />{t.login.secureData}
          </div>
        </div>
      </section>
    </main>
  );
}
