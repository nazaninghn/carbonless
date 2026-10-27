'use client';
import { useEffect } from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import Button from '@/components/Button';

export default function ConfirmDialog({ open, onConfirm, onCancel, title, message, confirmText, cancelText, type = 'warning', language = 'en', children }) {
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
        {children}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" size="lg" className="flex-1 whitespace-normal px-4" onClick={onCancel}>
            {cancelText || (tr ? 'İptal' : 'Cancel')}
          </Button>
          <Button variant={type === 'danger' ? 'danger' : 'dark'} size="lg" className="flex-1 whitespace-normal px-4" onClick={onConfirm}>
            {confirmText || (tr ? 'Onayla' : 'Confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
