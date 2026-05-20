'use client';
import { useEffect } from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';

export default function ConfirmDialog({ open, onConfirm, onCancel, title, message, confirmText, cancelText, type = 'warning' }) {
  // Dismiss on Escape key — consistent with every other modal in the app
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/15 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm animate-in rounded-[1.5rem] border border-[#302817]/10 bg-white/92 p-6 shadow-[0_20px_60px_rgba(48,40,23,0.15)] backdrop-blur-2xl">
        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-[#F9EFE5] text-[#302817]'}`}>
            {type === 'danger' ? <LogOut className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h3 className="text-lg font-bold tracking-[-0.02em] text-[#302817]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#302817]/55">{message}</p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-[#302817]/10 bg-white py-3 text-sm font-bold text-[#302817] transition hover:bg-[#F8F8F8]"
          >
            {cancelText || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-full py-3 text-sm font-bold text-white shadow-lg transition-colors ${type === 'danger' ? 'bg-red-500 shadow-red-500/20 hover:bg-red-600' : 'bg-[#302817] shadow-[#302817]/15 hover:bg-black'}`}
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
