'use client';

// Sign-up for someone invited to a team. The company registration form at
// /register asks for the company's legal name, NACE code, turnover…, which an
// invited employee doesn't know — and it creates a company of their own. Here
// they only make an account with the invited address; verifying it joins the
// team (the backend skips the placeholder company for a matching invite).
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Users, Loader2, XCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { roleLabel } from '@/lib/permissions';
import { describeRegisterErrors } from '@/lib/registerErrors';
import { authErrorMessage } from '@/lib/authErrors';
import PasswordStrengthIndicator, { isPasswordStrong } from '@/components/PasswordStrengthIndicator';
import { api, markSessionActive } from '@/lib/utils/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const FIELD = 'w-full rounded-xl border border-[#072C0E]/12 bg-[#F8F8F8] px-3 py-2.5 text-sm text-[#072C0E] focus:border-[#2ABD41] focus:bg-white focus:outline-none';

function JoinContent() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const { language } = useLanguage();
  const tr = language === 'tr';
  const [invite, setInvite] = useState(null);      // {email, role, company}
  const [loadError, setLoadError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setLoadError(tr ? 'Davet bağlantısı eksik.' : 'The invite link is incomplete.'); return; }
    try { sessionStorage.setItem('pendingInviteToken', token); } catch {}
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/companies/invite-info/?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) { setInvite(data); return; }
        setLoadError(data.code === 'invite_expired'
          ? (tr ? 'Bu davetin süresi dolmuş. Sizi davet eden kişiden yeni bir davet isteyin.' : 'This invite has expired. Ask the person who invited you for a new one.')
          : data.code === 'invite_used'
            ? (tr ? 'Bu davet zaten kullanılmış. Hesabınızla giriş yapabilirsiniz.' : 'This invite has already been used. You can log in with your account.')
            : (tr ? 'Bu davet bağlantısı geçersiz.' : 'This invite link is invalid.'));
      } catch {
        setLoadError(tr ? 'Bağlantı hatası. Lütfen tekrar deneyin.' : 'Connection error. Please try again.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    if (!username.trim()) { setError(tr ? 'Kullanıcı adı girin.' : 'Enter a username.'); return; }
    if (password !== password2) { setError(tr ? 'Şifreler eşleşmiyor.' : 'Passwords do not match.'); return; }
    if (!isPasswordStrong(password)) { setError(tr ? 'Şifre yeterince güçlü değil.' : 'Password is not strong enough.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/accounts/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(), email: invite.email, password, password2,
          invite_token: token, language,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.code === 'rate_limited'
          ? authErrorMessage(data, tr)
          : (describeRegisterErrors(data, tr).message || (tr ? 'Kayıt yapılamadı.' : 'Sign-up failed.')));
        return;
      }
      const mail = data?.email_sent === false ? '&mail=failed' : '';
      // Accounts start inactive until the email is verified; verifying joins
      // the team. (With verification switched off the login works at once.)
      const login = await api.login(username.trim(), password).catch(() => null);
      if (login?.ok) {
        markSessionActive();
        document.cookie = 'carbonless_mode_chosen=1; path=/; SameSite=Lax';
        try { localStorage.setItem('carbonless_startup_mode', 'inventory'); } catch {}
        router.push('/dashboard');
        return;
      }
      router.push(`/verify-email?email=${encodeURIComponent(invite.email)}${mail}`);
    } catch {
      setError(tr ? 'Bağlantı hatası. Lütfen tekrar deneyin.' : 'Connection error. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [saving, username, password, password2, invite, token, language, tr, router]);

  return (
    <main className="min-h-screen bg-[#F1FCF2] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/carbonless.png" alt="Carbonless" width={40} height={40} className="h-10 w-10" />
            <span className="text-[18px] font-bold text-[#072C0E]">Carbonless</span>
          </Link>
        </div>
        <div className="rounded-2xl border border-[#DEFAE1] bg-white p-6 shadow-sm sm:p-8">
          {!invite && !loadError && (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-[#2ABD41]" /></div>
          )}
          {loadError && (
            <div className="text-center">
              <XCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
              <p className="text-[14px] text-[#072C0E]/70">{loadError}</p>
              <Link href="/login" className="mt-6 inline-flex items-center rounded-full bg-[#2ABD41] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#1D9C31] transition">
                {tr ? 'Giriş Yap' : 'Log In'}
              </Link>
            </div>
          )}
          {invite && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-[#2ABD41]" />
                <h1 className="text-[20px] font-bold text-[#072C0E]">
                  {tr ? `${invite.company} ekibine katılın` : `Join ${invite.company}`}
                </h1>
                <p className="mt-1 text-[13px] text-[#072C0E]/55">
                  {tr ? `Rolünüz: ${roleLabel(invite.role, true)}. Şirket bilgisi gerekmez — sadece hesabınızı oluşturun.`
                      : `Your role: ${roleLabel(invite.role, false)}. No company details needed — just create your account.`}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#072C0E]/70">{tr ? 'E-posta' : 'Email'}</label>
                <input type="email" value={invite.email} readOnly className={`${FIELD} cursor-not-allowed opacity-70`} />
                <p className="mt-1 text-[11px] text-[#072C0E]/45">{tr ? 'Davet bu adrese gönderildi.' : 'The invite was sent to this address.'}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#072C0E]/70">{tr ? 'Kullanıcı Adı' : 'Username'} *</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className={FIELD} required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#072C0E]/70">{tr ? 'Şifre' : 'Password'} *</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className={FIELD} required />
                <PasswordStrengthIndicator password={password} language={language} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#072C0E]/70">{tr ? 'Şifre Tekrar' : 'Confirm Password'} *</label>
                <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} autoComplete="new-password" className={FIELD} required />
              </div>
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>}
              <button type="submit" disabled={saving}
                className="w-full rounded-full bg-[#2ABD41] py-3 text-[14px] font-bold text-white hover:bg-[#1D9C31] transition disabled:opacity-60">
                {saving ? '…' : (tr ? 'Hesap Oluştur ve Katıl' : 'Create Account and Join')}
              </button>
              <p className="text-center text-[12px] text-[#072C0E]/50">
                {tr ? 'Zaten hesabınız var mı? ' : 'Already have an account? '}
                <Link href="/login" className="font-semibold text-[#2ABD41] hover:underline">{tr ? 'Giriş yapın' : 'Log in'}</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinContent />
    </Suspense>
  );
}
