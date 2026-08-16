'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const CODE_LENGTH = 6;

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';
  // Set by the register page when the backend reported email_sent === false.
  const mailFailed = searchParams.get('mail') === 'failed';
  const { language } = useLanguage();
  const tr = language === 'tr';

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [status, setStatus] = useState('idle'); // idle | verifying | success | error
  const [message, setMessage] = useState('');
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent
  const inputRefs = useRef([]);

  const code = digits.join('');

  const handleDigitChange = (index, value) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    setDigits(prev => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    setStatus('idle');
    setMessage('');
    if (clean && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (code.length !== CODE_LENGTH || !email) return;
    setStatus('verifying');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/accounts/verify-email-code/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus('success');
        setMessage(data.message || (tr ? 'E-posta başarıyla doğrulandı!' : 'Email verified successfully!'));
      } else {
        setStatus('error');
        setMessage(data.error || (tr ? 'Doğrulama başarısız.' : 'Verification failed.'));
        setDigits(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } catch {
      setStatus('error');
      setMessage(tr ? 'Bağlantı hatası. Lütfen tekrar deneyin.' : 'Connection error. Please try again.');
    }
  };

  // Auto-submit once all 6 digits are filled
  useEffect(() => {
    if (code.length === CODE_LENGTH && status === 'idle') {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleResend = async () => {
    if (!email || resendState === 'sending') return;
    setResendState('sending');
    try {
      await fetch(`${API_BASE}/accounts/resend-verification/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Fall through — resendState still flips to 'sent' since the
      // endpoint never reveals whether the email exists either way
    }
    setResendState('sent');
    setDigits(Array(CODE_LENGTH).fill(''));
    setStatus('idle');
    setMessage('');
    inputRefs.current[0]?.focus();
    setTimeout(() => setResendState('idle'), 30_000);
  };

  return (
    <main className="min-h-screen bg-[#F1FCF2] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/carbonless.png" alt="Carbonless" width={40} height={40} className="h-10 w-10" />
            <span className="text-[18px] font-bold text-[#072C0E]">Carbonless</span>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#DEFAE1] bg-white p-8 shadow-sm text-center">
          {status === 'success' ? (
            <>
              <div className="h-16 w-16 rounded-full bg-[#DEFAE1] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#2ABD41]" />
              </div>
              <h1 className="text-[20px] font-bold text-[#072C0E]">{tr ? 'E-posta Doğrulandı!' : 'Email Verified!'}</h1>
              <p className="mt-2 text-[14px] text-[#072C0E]/50">{message}</p>
              <Link href="/login"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#2ABD41] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#1D9C31] transition">
                {tr ? 'Girişe Devam Et' : 'Continue to Login'}
              </Link>
            </>
          ) : (
            <>
              <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-amber-500" />
              </div>
              <h1 className="text-[20px] font-bold text-[#072C0E]">{tr ? 'Doğrulama Kodunu Girin' : 'Enter Verification Code'}</h1>
              {mailFailed ? (
                // The server told us the mail never left. Saying "we sent a
                // code" here would be a lie that leaves the user refreshing
                // their inbox indefinitely.
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-left">
                  <p className="text-[13px] font-semibold text-red-700">
                    {tr ? 'Doğrulama e-postasını gönderemedik.' : "We couldn't send the verification email."}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-red-600">
                    {tr
                      ? 'Hesabınız oluşturuldu, ancak posta sunucumuz mesajı reddetti. Aşağıdaki "Kodu tekrar gönder" seçeneğini deneyin — yine başarısız olursa, hesabınızı manuel olarak etkinleştirmemiz için lütfen destek ekibiyle iletişime geçin.'
                      : 'Your account was created, but our mail server rejected the message. Try "Resend code" below — if it still fails, please contact support so we can activate your account manually.'}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[14px] text-[#072C0E]/50">
                  {email
                    ? (tr
                        ? <>6 haneli kod <span className="font-semibold text-[#072C0E]">{email}</span> adresine gönderildi.</>
                        : <>We sent a 6-digit code to <span className="font-semibold text-[#072C0E]">{email}</span>.</>)
                    : (tr ? 'E-posta adresinize 6 haneli bir kod gönderdik.' : 'We sent a 6-digit code to your email address.')}
                </p>
              )}

              <form onSubmit={handleVerify} className="mt-6">
                <div className="flex justify-center gap-2" onPaste={handlePaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={e => handleDigitChange(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      disabled={status === 'verifying'}
                      className={`h-12 w-10 rounded-xl border text-center text-[18px] font-bold text-[#072C0E] outline-none transition focus:ring-2 focus:ring-[#2ABD41] ${
                        status === 'error' ? 'border-red-300 bg-red-50' : 'border-[#DEFAE1] bg-white'
                      }`}
                    />
                  ))}
                </div>

                {status === 'error' && (
                  <p className="mt-3 text-[13px] font-semibold text-red-600">{message}</p>
                )}
                {status === 'verifying' && (
                  <p className="mt-3 flex items-center justify-center gap-2 text-[13px] text-[#072C0E]/50">
                    <Loader2 className="h-4 w-4 animate-spin" /> {tr ? 'Doğrulanıyor...' : 'Verifying...'}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={code.length !== CODE_LENGTH || status === 'verifying'}
                  className="mt-5 w-full rounded-full bg-[#2ABD41] px-6 py-3 text-[14px] font-bold text-white transition hover:bg-[#1D9C31] disabled:opacity-40"
                >
                  {tr ? 'Doğrula' : 'Verify'}
                </button>
              </form>

              <button
                onClick={handleResend}
                disabled={resendState === 'sending' || !email}
                className="mt-4 text-[13px] font-medium text-[#2ABD41] hover:underline disabled:opacity-50"
              >
                {resendState === 'sending'
                  ? (tr ? 'Gönderiliyor...' : 'Sending...')
                  : resendState === 'sent'
                    ? (tr ? 'Kod gönderildi — e-postanızı kontrol edin' : 'Code sent — check your email')
                    : (tr ? 'Kod almadınız mı? Tekrar gönder' : "Didn't get a code? Resend")}
              </button>

              <div className="mt-6">
                <Link href="/login"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-[#DEFAE1] px-6 py-3 text-[14px] font-semibold text-[#072C0E]/70 hover:border-[#072C0E]/30 transition">
                  {tr ? 'Girişe Dön' : 'Back to Login'}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#2ABD41]" /></div>}>
      <VerifyContent />
    </Suspense>
  );
}
