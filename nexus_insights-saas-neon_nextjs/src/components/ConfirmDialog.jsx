'use client';
import { useEffect } from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';

export default function ConfirmDialog({ open, onConfirm, onCancel, title, message, confirmText, cancelText, type = 'warning', language = 'en' }) {
  // Every current caller passes confirmText/cancelText explicitly, so this
  // fallback never actually fires today — but it's a latent bug for any
  // future caller that forgets to, since it silently shows English
  // regardless of the selected language otherwise.
  const tr = language === 'tr';
  // Dismiss on Escape key — consistent with every other modal in the app
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/15 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-sm animate-in rounded-[1.5rem] border border-[#072C0E]/10 bg-white/92 p-6 shadow-[0_20px_60px_rgba(7, 44, 14,0.15)] backdrop-blur-2xl">
        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-[#DEFAE1] text-[#072C0E]'}`}>
            {type === 'danger' ? <LogOut className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h3 id="confirm-dialog-title" className="text-lg font-bold tracking-[-0.02em] text-[#072C0E]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#072C0E]/55">{message}</p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-[#072C0E]/10 bg-white py-3 text-sm font-bold text-[#072C0E] transition hover:bg-[#F8F8F8]"
          >
            {cancelText || (tr ? 'İptal' : 'Cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-full py-3 text-sm font-bold text-white shadow-lg transition-colors ${type === 'danger' ? 'bg-red-500 shadow-red-500/20 hover:bg-red-600' : 'bg-[#072C0E] shadow-[#072C0E]/15 hover:bg-[#175022]'}`}
          >
            {confirmText || (tr ? 'Onayla' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
