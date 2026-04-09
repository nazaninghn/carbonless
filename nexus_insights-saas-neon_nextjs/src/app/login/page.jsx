'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { auth } from '@/lib/auth';
import SimpleHeader from '@/components/SimpleHeader';
import NextLink from 'next/link';
import { Mail, Lock, ArrowRight, Leaf, TrendingDown, BarChart3 } from 'lucide-react';

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  const [loading, setLoading] = useState(false);

  // Check for session expired
  useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('session_expired')) {
      setSessionExpired(true);
      localStorage.removeItem('session_expired');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/accounts/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        auth.setTokens(data.access, data.refresh);
        window.location.href = '/dashboard';
      } else {
        setError(t.language === 'tr' ? 'E-posta veya şifre hatalı' : 'Invalid email or password');
      }
    } catch {
      setError(t.language === 'tr' ? 'Sunucu bağlantı hatası' : 'Server connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-green-50 via-white to-emerald-50 text-gray-900 antialiased min-h-screen">
      <SimpleHeader />
      
      <main className="pt-24 lg:pt-32 pb-16 lg:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Side - Branding & Info */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Decorative Elements */}
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
                    <Leaf className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">{t.hero.badge}</span>
                  </div>
                  
                  <h1 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                    {t.language === 'tr' ? 'Karbon Yönetiminize' : t.login.welcomeBack}
                    <span className="block gradient-text mt-2">
                      {t.language === 'tr' ? 'Hoş Geldiniz' : ''}
                    </span>
                  </h1>
                  
                  <p className="text-lg text-gray-600 mb-8">
                    {t.login.welcomeSubtitle}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-green-600 mb-2">
                        <TrendingDown className="w-5 h-5" />
                        <span className="text-2xl font-bold">-25%</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {t.login.avgReduction}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-primary mb-2">
                        <BarChart3 className="w-5 h-5" />
                        <span className="text-2xl font-bold">500+</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {t.login.activeCompanies}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-secondary mb-2">
                        <Leaf className="w-5 h-5" />
                        <span className="text-2xl font-bold">50K</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {t.login.co2Reduced}
                      </p>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <span className="text-gray-700">
                        {t.login.realtimeTracking}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <span className="text-gray-700">
                        {t.login.iso14064Reporting}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <span className="text-gray-700">
                        {t.login.smartRecommendations}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div>
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10 relative overflow-hidden">
                {/* Decorative gradient */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-full -mr-20 -mt-20"></div>
                
                <div className="relative z-10">
                  {/* Header */}
                  <div className="mb-8">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-2">{t.login.title}</h2>
                    <p className="text-gray-600">{t.login.subtitle}</p>
                  </div>

                  {/* Login Form */}
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Username / Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        {t.login.email}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          id="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-gray-400"
                          placeholder={t.login.emailPlaceholder}
                          required
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                        {t.login.password}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="password"
                          id="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-gray-400"
                          placeholder="••••••••"
                          required
                        />
                      </div>
                    </div>

                    {/* Remember & Forgot */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                        />
                        <span className="ml-2 text-sm text-gray-600">
                          {t.login.rememberMe}
                        </span>
                      </label>
                      <NextLink href="/forgot-password" className="text-sm text-primary hover:text-secondary transition-colors font-medium">
                        {t.login.forgotPassword}
                      </NextLink>
                    </div>

                    {/* Session Expired */}
                    {sessionExpired && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                        {t.language === 'tr' ? 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.' : 'Your session has expired. Please log in again.'}
                      </div>
                    )}

                    {/* Error Message */}
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                        {error}
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full px-6 py-4 bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl hover:scale-[1.02] transition-all duration-300 shadow-lg shadow-primary/25 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:hover:scale-100"
                    >
                      {loading ? (t.language === 'tr' ? 'Giriş yapılıyor...' : 'Signing in...') : t.login.title}
                      {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500">
                        {t.login.or}
                      </span>
                    </div>
                  </div>

                  {/* Register Link */}
                  <div className="text-center">
                    <p className="text-gray-600">
                      {t.login.noAccount}{' '}
                      <NextLink href="/register" className="text-primary font-semibold hover:text-secondary transition-colors">
                        {t.nav.register}
                      </NextLink>
                    </p>
                  </div>
                </div>
              </div>

              {/* Trust Badge */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  🔒 {t.login.secureData}
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
