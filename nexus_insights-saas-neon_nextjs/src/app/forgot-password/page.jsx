'use client';

import { useState, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import SimpleHeader from '@/components/SimpleHeader';
import NextLink from 'next/link';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function ForgotPasswordPage() {
  const { language } = useLanguage();
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const tr = language === 'tr';

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Fix 25D: add 30-second timeout — matches app-wide fetchWithTimeout policy
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(`${API_BASE}/accounts/password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      // Treat both 200 and 404 as "sent" to avoid email enumeration
      if (res.ok || res.status === 404) {
        setSent(true);
      } else {
        setError(tr ? 'Bir hata oluştu. Lütfen tekrar deneyin.' : 'An error occurred. Please try again.');
      }
    } catch {
      setError(tr ? 'Bağlantı hatası. Lütfen tekrar deneyin.' : 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email, tr]);

  return (
    <div className="bg-gradient-to-br from-[#F9EFE5]/60 via-white to-[#B4BE6A]/8 text-[#302817] antialiased min-h-screen">
      <SimpleHeader />
      <main className="pt-24 lg:pt-32 pb-16">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            {!sent ? (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">
                    {language === 'tr' ? 'Şifremi Unuttum' : 'Forgot Password'}
                  </h2>
                  <p className="text-sm text-[#302817]/60">
                    {language === 'tr'
                      ? 'E-posta adresinizi girin, şifre sıfırlama bağlantısı göndereceğiz.'
                      : 'Enter your email and we will send you a password reset link.'}
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-[#302817]/75 mb-2">
                      {language === 'tr' ? 'E-posta' : 'Email'}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#95A847]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#302817]/15 focus:ring-2 focus:ring-[#95A847]/30 focus:border-[#95A847] outline-none"
                        placeholder={language === 'tr' ? 'ornek@email.com' : 'example@email.com'}
                        required
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-[#75863B] to-[#95A847] text-white font-semibold rounded-xl hover:scale-[1.02] transition-all disabled:opacity-60"
                  >
                    {loading
                      ? (tr ? 'Gönderiliyor…' : 'Sending…')
                      : (tr ? 'Sıfırlama Bağlantısı Gönder' : 'Send Reset Link')}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-[#95A847] mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">
                  {language === 'tr' ? 'E-posta Gönderildi' : 'Email Sent'}
                </h2>
                <p className="text-sm text-[#302817]/60 mb-4">
                  {language === 'tr'
                    ? `${email} adresine şifre sıfırlama bağlantısı gönderildi. Lütfen gelen kutunuzu kontrol edin.`
                    : `A password reset link has been sent to ${email}. Please check your inbox.`}
                </p>
              </div>
            )}
            <div className="mt-6 text-center">
              <NextLink href="/login" className="text-sm text-[#95A847] hover:text-[#75863B] flex items-center justify-center gap-1">
                <ArrowLeft className="w-4 h-4" />
                {language === 'tr' ? 'Giriş sayfasına dön' : 'Back to login'}
              </NextLink>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
