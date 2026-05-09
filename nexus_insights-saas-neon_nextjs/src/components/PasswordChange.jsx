'use client';
import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { api } from '@/lib/utils/api';
import PasswordStrengthIndicator, { isPasswordStrong } from '@/components/PasswordStrengthIndicator';

function PasswordInput({ label, value, onChange, show, onToggle, placeholder }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{label}</label>
      <div className="flex items-center gap-3 rounded-2xl border border-[#302817]/10 bg-white/60 px-4 py-3 shadow-sm transition focus-within:border-[#B4BE6A]/60 focus-within:ring-4 focus-within:ring-[#B4BE6A]/20">
        <LockKeyhole className="h-4 w-4 shrink-0 text-[#95A847]" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          className="w-full bg-transparent text-sm font-semibold text-[#302817] outline-none placeholder:text-[#302817]/30"
        />
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 text-[#302817]/40 transition hover:text-[#302817]"
          aria-label="Toggle password visibility"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function PasswordChange({ language }) {
  const tr = language === 'tr';

  const [oldPw,    setOldPw]    = useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [msg,      setMsg]      = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const [showOld,     setShowOld]     = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (newPw !== confirm) {
      setError(tr ? 'Yeni şifreler eşleşmiyor' : 'New passwords do not match');
      return;
    }
    if (!isPasswordStrong(newPw)) {
      setError(tr
        ? 'Şifre yeterince güçlü değil. Büyük harf, küçük harf, rakam ve özel karakter kullanın.'
        : 'Password is not strong enough. Use uppercase, lowercase, numbers and special characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.changePassword({ old_password: oldPw, new_password: newPw });
      if (res.ok) {
        setMsg(tr ? 'Şifre başarıyla değiştirildi ✓' : 'Password changed successfully ✓');
        setOldPw(''); setNewPw(''); setConfirm('');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || (tr ? 'Hata oluştu' : 'An error occurred'));
      }
    } catch {
      setError(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <PasswordInput
        label={tr ? 'Mevcut Şifre' : 'Current Password'}
        value={oldPw}
        onChange={e => setOldPw(e.target.value)}
        show={showOld}
        onToggle={() => setShowOld(p => !p)}
        placeholder="••••••••"
      />

      <div>
        <PasswordInput
          label={tr ? 'Yeni Şifre' : 'New Password'}
          value={newPw}
          onChange={e => setNewPw(e.target.value)}
          show={showNew}
          onToggle={() => setShowNew(p => !p)}
          placeholder={tr ? 'En az 8 karakter' : 'Min 8 characters'}
        />
        <PasswordStrengthIndicator password={newPw} language={language} />
      </div>

      <PasswordInput
        label={tr ? 'Yeni Şifre (Tekrar)' : 'Confirm New Password'}
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        show={showConfirm}
        onToggle={() => setShowConfirm(p => !p)}
        placeholder={tr ? 'Şifreyi tekrar girin' : 'Re-enter new password'}
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-2xl border border-[#95A847]/30 bg-[#95A847]/10 px-4 py-3 text-sm font-semibold text-[#75863B]">
          {msg}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-full bg-[#302817] px-6 py-2.5 text-sm font-bold text-[#F9EFE5] shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black disabled:opacity-60"
      >
        {loading ? '...' : (tr ? 'Şifreyi Değiştir' : 'Change Password')}
      </button>
    </form>
  );
}
