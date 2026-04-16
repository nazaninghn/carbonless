'use client';
import { useState } from 'react';
import { api } from '@/lib/utils/api';
import PasswordStrengthIndicator, { isPasswordStrong } from '@/components/PasswordStrengthIndicator';

export default function PasswordChange({ language }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (newPw !== confirm) {
      setError(language === 'tr' ? 'Yeni şifreler eşleşmiyor' : 'New passwords do not match');
      return;
    }
    if (!isPasswordStrong(newPw)) {
      setError(language === 'tr' ? 'Şifre yeterince güçlü değil. Lütfen büyük harf, küçük harf, rakam ve özel karakter kullanın.' : 'Password is not strong enough. Please use uppercase, lowercase, numbers and special characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.changePassword({ old_password: oldPw, new_password: newPw });
      if (res.ok) {
        setMsg(language === 'tr' ? 'Şifre başarıyla değiştirildi' : 'Password changed successfully');
        setOldPw(''); setNewPw(''); setConfirm('');
      } else {
        const data = await res.json();
        setError(data.error || 'Error');
      }
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <div>
        <label className="block text-xs text-gray-600 mb-1">{language === 'tr' ? 'Mevcut Şifre' : 'Current Password'}</label>
        <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">{language === 'tr' ? 'Yeni Şifre' : 'New Password'}</label>
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
        <PasswordStrengthIndicator password={newPw} language={language} />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">{language === 'tr' ? 'Yeni Şifre (Tekrar)' : 'Confirm New Password'}</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      {msg && <p className="text-sm text-green-600 bg-green-50 p-2 rounded">{msg}</p>}
      <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-secondary disabled:opacity-60">
        {loading ? '...' : (language === 'tr' ? 'Şifreyi Değiştir' : 'Change Password')}
      </button>
    </form>
  );
}
