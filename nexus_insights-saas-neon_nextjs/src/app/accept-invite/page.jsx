'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, XCircle, Loader2, Users } from 'lucide-react';
import { api } from '@/lib/utils/api';
import { useLanguage } from '@/lib/i18n/LanguageContext';

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const { language } = useLanguage();
  const tr = language === 'tr';

  useEffect(() => {
    if (!token) { setStatus('no-token'); return; }

    (async () => {
      try {
        const res = await api.acceptInvite(token);
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus('success');
          setMessage(data.message || (tr ? 'Şirkete başarıyla katıldınız!' : 'You have joined the company successfully!'));
        } else {
          setStatus('error');
          setMessage(data.error || (tr ? 'Geçersiz veya süresi dolmuş davet bağlantısı.' : 'Invalid or expired invite link.'));
        }
      } catch {
        setStatus('error');
        setMessage(tr ? 'Bağlantı hatası. Lütfen tekrar deneyin.' : 'Connection error. Please try again.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="min-h-screen bg-[#F1FCF2] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/carbonless.png" alt="Carbonless" width={40} height={40} className="h-10 w-10" />
            <span className="text-[18px] font-bold text-[#072C0E]">Carbonless</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-[#DEFAE1] bg-white p-8 shadow-sm text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 text-[#2ABD41] animate-spin mx-auto mb-4" />
              <h1 className="text-[20px] font-bold text-[#072C0E]">{tr ? 'Davet kabul ediliyor...' : 'Accepting invite...'}</h1>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="h-16 w-16 rounded-full bg-[#DEFAE1] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#2ABD41]" />
              </div>
              <h1 className="text-[20px] font-bold text-[#072C0E]">{tr ? 'Ekibe hoş geldiniz!' : 'Welcome to the team!'}</h1>
              <p className="mt-2 text-[14px] text-[#072C0E]/50">{message}</p>
              <Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#2ABD41] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#1D9C31] transition">
                {tr ? "Panele Git" : 'Go to Dashboard'}
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <h1 className="text-[20px] font-bold text-[#072C0E]">{tr ? 'Davet Başarısız' : 'Invite Failed'}</h1>
              <p className="mt-2 text-[14px] text-red-600">{message}</p>
              <Link href="/login" className="mt-4 inline-block text-[13px] font-medium text-[#2ABD41] hover:underline">
                {tr ? 'Girişe Git' : 'Go to Login'}
              </Link>
            </>
          )}
          {status === 'no-token' && (
            <>
              <Users className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h1 className="text-[20px] font-bold text-[#072C0E]">{tr ? 'Davet Kodu Eksik' : 'Missing Invite Token'}</h1>
              <p className="mt-2 text-[14px] text-[#072C0E]/50">{tr ? 'Bu davet bağlantısı geçersiz görünüyor.' : 'This invite link appears to be invalid.'}</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#2ABD41]" /></div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
