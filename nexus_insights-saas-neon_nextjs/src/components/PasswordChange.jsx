'use client';
import { useState, useCallback } from 'react';
import { api } from '@/lib/utils/api';
import PasswordStrengthIndicator, { isPasswordStrong } from '@/components/PasswordStrengthIndicator';

export default function PasswordChange({ language }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const tr = language === 'tr';

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    // Fix 26D: prevent double-submit before React flushes the disabled state
    if (loading) return;
    setMsg(''); setError('');
    if (newPw !== confirm) {
      setError(tr ? 'Yeni şifreler eşleşmiyor' : 'New passwords do not match');
      return;
    }
    if (!isPasswordStrong(newPw)) {
      setError(tr
        ? 'Şifre yeterince güçlü değil. Lütfen büyük harf, küçük harf, rakam ve özel karakter kullanın.'
        : 'Password is not strong enough. Please use uppercase, lowercase, numbers and special characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.changePassword({ old_password: oldPw, new_password: newPw });
      if (res.ok) {
        setMsg(tr ? 'Şifre başarıyla değiştirildi' : 'Password changed successfully');
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
  }, [oldPw, newPw, confirm, loading, tr]);

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <div>
        <label className="block text-xs text-[#302817]/55 mb-1">{tr ? 'Mevcut Şifre' : 'Current Password'}</label>
        <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} className="w-full px-3 py-2 border border-[#302817]/10 rounded-xl text-sm outline-none focus:border-[#51B291] focus:ring-2 focus:ring-[#51B291]/20" required />
      </div>
      <div>
        <label className="block text-xs text-[#302817]/55 mb-1">{tr ? 'Yeni Şifre' : 'New Password'}</label>
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full px-3 py-2 border border-[#302817]/10 rounded-xl text-sm outline-none focus:border-[#51B291] focus:ring-2 focus:ring-[#51B291]/20" required />
        <PasswordStrengthIndicator password={newPw} language={language} />
      </div>
      <div>
        <label className="block text-xs text-[#302817]/55 mb-1">{tr ? 'Yeni Şifre (Tekrar)' : 'Confirm New Password'}</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full px-3 py-2 border border-[#302817]/10 rounded-xl text-sm outline-none focus:border-[#51B291] focus:ring-2 focus:ring-[#51B291]/20" required />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      {msg && <p className="text-sm text-green-600 bg-green-50 p-2 rounded">{msg}</p>}
      <button type="submit" disabled={loading} className="px-4 py-2 bg-[#244959] text-white rounded-xl text-sm hover:bg-[#1a3a2e] disabled:opacity-60">
        {loading ? (tr ? 'Değiştiriliyor…' : 'Changing…') : (tr ? 'Şifreyi Değiştir' : 'Change Password')}
      </button>
    </form>
  );
}
