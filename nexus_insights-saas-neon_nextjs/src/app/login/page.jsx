'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import Image from 'next/image';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Globe2 } from 'lucide-react';
import { api, markSessionActive } from '@/lib/utils/api';

function LoginContent() {
  const { t, language, changeLanguage } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const tr = language === 'tr';

  const sessionExpired = searchParams.get('reason') === 'session_expired';

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.ok) {
        markSessionActive();
        document.cookie = 'carbonless_mode_chosen=1; path=/; SameSite=Lax';
        window.location.href = '/dashboard/select';
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status >= 500) {
          setError(tr ? 'Sunucu hatasi. Lutfen tekrar deneyin.' : 'Server error. Please try again.');
        } else {
          setError(data?.error || (tr ? 'Kullanici adi veya sifre hatali.' : 'Invalid username or password.'));
        }
      }
    } catch {
      setError(tr ? 'Sunucu baglanti hatasi' : 'Server connection error');
    } finally { setLoading(false); }
  }, [email, password, tr, router]);

  return (
    <main className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4 py-10">

      {/* Language toggle - top right */}
      <div className="fixed top-5 right-5 z-50">
        <div className="flex items-center gap-0.5 rounded-full bg-white border border-[#DEFAE1] p-0.5 shadow-sm">
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
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <NextLink href="/" className="flex items-center gap-2.5">
            <Image src="/carbonless.png" alt="Carbonless" width={44} height={44} className="h-11 w-11" />
            <span className="text-[20px] font-bold text-[#072C0E] tracking-tight">Carbonless</span>
          </NextLink>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#DEFAE1] bg-white p-7 sm:p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h2 className="text-[22px] font-bold text-[#072C0E] tracking-tight">{t.login.title}</h2>
            <p className="mt-1.5 text-[13px] text-[#072C0E]/50">{t.login.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email/Username */}
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-[12px] font-semibold text-[#072C0E]/70">{t.login.email}</label>
              <div className="flex items-center gap-3 rounded-xl border border-[#DEFAE1] bg-[#F5F5F5] px-4 py-3 transition focus-within:border-[#2ABD41] focus-within:ring-2 focus-within:ring-[#2ABD41]/15">
                <Mail className="h-4 w-4 text-[#2ABD41]" />
                <input
                  id="login-email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-medium text-[#072C0E] outline-none placeholder:text-[#072C0E]/30"
                  placeholder={t.login.emailPlaceholder}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="login-password" className="block text-[12px] font-semibold text-[#072C0E]/70">{t.login.password}</label>
                <NextLink href="/forgot-password" className="text-[11px] font-semibold text-[#2ABD41] hover:underline">{t.login.forgotPassword}</NextLink>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-[#DEFAE1] bg-[#F5F5F5] px-4 py-3 transition focus-within:border-[#2ABD41] focus-within:ring-2 focus-within:ring-[#2ABD41]/15">
                <LockKeyhole className="h-4 w-4 text-[#2ABD41]" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-medium text-[#072C0E] outline-none placeholder:text-[#072C0E]/30"
                  placeholder="********"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[#072C0E]/35 hover:text-[#072C0E]">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Errors */}
            {sessionExpired && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-medium text-amber-700">
                {tr ? 'Oturumunuz sona erdi.' : 'Your session has expired.'}
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-600">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#2ABD41] px-5 py-3.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#1D9C31] disabled:opacity-50"
            >
              {loading ? (tr ? 'Giris yapiliyor...' : 'Signing in...') : t.login.title}
              {!loading && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
            </button>
          </form>

          <p className="mt-5 text-center text-[12px] text-[#072C0E]/50">
            {t.login.noAccount}{' '}
            <NextLink href="/register" className="font-semibold text-[#2ABD41] hover:underline">{t.nav.register}</NextLink>
          </p>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-[11px] text-[#072C0E]/30">
          {t.login.secureData}
        </p>
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
