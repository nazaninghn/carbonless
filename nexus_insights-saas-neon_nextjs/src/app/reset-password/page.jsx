'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, XCircle, Loader2, LockKeyhole, Eye, EyeOff } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function ResetContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('form'); // form | loading | success | error
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== password2) {
      setMessage('Passwords do not match.');
      setStatus('error');
      return;
    }
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/accounts/password-reset-confirm/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Password reset successfully!');
      } else {
        setStatus('error');
        setMessage(data.error || 'Reset failed. The link may have expired.');
      }
    } catch {
      setStatus('error');
      setMessage('Connection error. Please try again.');
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[#f9faf5] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/carbonless.png" alt="Carbonless" width={40} height={40} className="h-10 w-10" />
              <span className="text-[18px] font-bold text-[#1a1a1a]">Carbonless</span>
            </Link>
          </div>
          <div className="rounded-2xl border border-[#e8e8e0] bg-white p-8 shadow-sm">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-[20px] font-bold text-[#1a1a1a]">Invalid Reset Link</h1>
            <p className="mt-2 text-[14px] text-[#302817]/50">This password reset link is invalid or missing a token.</p>
            <Link href="/forgot-password" className="mt-4 inline-block text-[13px] font-medium text-[#4CAF50] hover:underline">
              Request a new reset link
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f9faf5] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/carbonless.png" alt="Carbonless" width={40} height={40} className="h-10 w-10" />
            <span className="text-[18px] font-bold text-[#1a1a1a]">Carbonless</span>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#e8e8e0] bg-white p-8 shadow-sm">
          {status === 'success' ? (
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-[#e8f5e9] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#4CAF50]" />
              </div>
              <h1 className="text-[20px] font-bold text-[#1a1a1a]">Password Reset!</h1>
              <p className="mt-2 text-[14px] text-[#302817]/50">{message}</p>
              <Link href="/login"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#4CAF50] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#388E3C] transition">
                Login with New Password
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="h-12 w-12 rounded-2xl bg-[#f0f9f0] flex items-center justify-center mx-auto mb-3">
                  <LockKeyhole className="h-6 w-6 text-[#4CAF50]" />
                </div>
                <h1 className="text-[20px] font-bold text-[#1a1a1a]">Set New Password</h1>
                <p className="mt-1 text-[13px] text-[#302817]/50">Enter your new password below.</p>
              </div>

              {status === 'error' && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] font-medium text-red-600">
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#302817]/70 mb-1.5">New Password</label>
                  <div className="flex items-center gap-2 rounded-xl border border-[#e8e8e0] px-4 py-3 focus-within:border-[#4CAF50]/50 focus-within:ring-2 focus-within:ring-[#4CAF50]/10">
                    <LockKeyhole className="h-4 w-4 text-[#302817]/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#302817]/30"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="text-[#302817]/40 hover:text-[#302817]">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#302817]/70 mb-1.5">Confirm Password</label>
                  <div className="flex items-center gap-2 rounded-xl border border-[#e8e8e0] px-4 py-3 focus-within:border-[#4CAF50]/50 focus-within:ring-2 focus-within:ring-[#4CAF50]/10">
                    <LockKeyhole className="h-4 w-4 text-[#302817]/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password2}
                      onChange={e => setPassword2(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#302817]/30"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full rounded-full bg-[#1a1a1a] py-3 text-[14px] font-bold text-white hover:bg-[#333] transition disabled:opacity-50"
                >
                  {status === 'loading' ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#4CAF50]" /></div>}>
      <ResetContent />
    </Suspense>
  );
}
