'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import SimpleHeader from '@/components/SimpleHeader';
import NextLink from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // For now just show success — real email sending needs SMTP config
    setSent(true);
  };

  return (
    <div className="bg-gradient-to-br from-green-50 via-white to-emerald-50 text-gray-900 antialiased min-h-screen">
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
                  <p className="text-gray-600 text-sm">
                    {language === 'tr'
                      ? 'E-posta adresinizi girin, şifre sıfırlama bağlantısı göndereceğiz.'
                      : 'Enter your email and we will send you a password reset link.'}
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'tr' ? 'E-posta' : 'Email'}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder={language === 'tr' ? 'ornek@email.com' : 'example@email.com'}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl hover:scale-[1.02] transition-all"
                  >
                    {language === 'tr' ? 'Sıfırlama Bağlantısı Gönder' : 'Send Reset Link'}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">
                  {language === 'tr' ? 'E-posta Gönderildi' : 'Email Sent'}
                </h2>
                <p className="text-gray-600 text-sm mb-4">
                  {language === 'tr'
                    ? `${email} adresine şifre sıfırlama bağlantısı gönderildi. Lütfen gelen kutunuzu kontrol edin.`
                    : `A password reset link has been sent to ${email}. Please check your inbox.`}
                </p>
              </div>
            )}
            <div className="mt-6 text-center">
              <NextLink href="/login" className="text-sm text-primary hover:text-secondary flex items-center justify-center gap-1">
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
