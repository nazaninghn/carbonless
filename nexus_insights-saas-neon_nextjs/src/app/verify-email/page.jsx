'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error | no-token
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/accounts/verify-email/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed.');
        }
      } catch {
        setStatus('error');
        setMessage('Connection error. Please try again.');
      }
    })();
  }, [token]);

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
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 text-[#2ABD41] animate-spin mx-auto mb-4" />
              <h1 className="text-[20px] font-bold text-[#072C0E]">Verifying your email...</h1>
              <p className="mt-2 text-[14px] text-[#072C0E]/50">Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="h-16 w-16 rounded-full bg-[#DEFAE1] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#2ABD41]" />
              </div>
              <h1 className="text-[20px] font-bold text-[#072C0E]">Email Verified!</h1>
              <p className="mt-2 text-[14px] text-[#072C0E]/50">{message}</p>
              <Link href="/login"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#2ABD41] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#1D9C31] transition">
                Continue to Login
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <h1 className="text-[20px] font-bold text-[#072C0E]">Verification Failed</h1>
              <p className="mt-2 text-[14px] text-red-600">{message}</p>
              <div className="mt-6 flex flex-col gap-3">
                <Link href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#072C0E] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#175022] transition">
                  Go to Login
                </Link>
                <button
                  onClick={() => window.location.reload()}
                  className="text-[13px] font-medium text-[#2ABD41] hover:underline">
                  Try Again
                </button>
              </div>
            </>
          )}

          {status === 'no-token' && (
            <>
              <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-amber-500" />
              </div>
              <h1 className="text-[20px] font-bold text-[#072C0E]">Check Your Email</h1>
              <p className="mt-2 text-[14px] text-[#072C0E]/50">
                We sent a verification link to your email address. Click the link to activate your account.
              </p>
              <Link href="/login"
                className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-[#DEFAE1] px-6 py-3 text-[14px] font-semibold text-[#072C0E]/70 hover:border-[#072C0E]/30 transition">
                Back to Login
              </Link>
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
