'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export default function SurveyNamingDialog({
  isOpen,
  onClose,
  onConfirm,
  currentUser = 'User',
  currentDate = '',
  tr = false
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!name.trim()) {
      alert(tr ? 'لطفاً نام سروی را وارد کنید' : 'Please enter a survey name');
      return;
    }
    setLoading(true);
    await onConfirm(name.trim());
    setLoading(false);
    setName('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleConfirm();
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[#244959]">
            {tr ? 'نام سروی' : 'Survey Name'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#244959]/10 rounded-lg transition"
          >
            <X className="w-5 h-5 text-[#244959]/60" />
          </button>
        </div>

        {/* Input */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-[#244959] mb-2">
              {tr ? 'نام سروی' : 'Survey Name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tr ? 'مثال: سروی سال ۱۴۰۳' : 'e.g., Q3 Emissions Audit'}
              className="w-full px-4 py-3 border border-[#244959]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#89E789] focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Metadata Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#244959]/60">{tr ? 'تاریخ' : 'Date'}:</span>
              <span className="font-semibold text-[#244959]">{currentDate}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#244959]/60">{tr ? 'ایجاد کننده' : 'Created By'}:</span>
              <span className="font-semibold text-[#244959]">{currentUser}</span>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mb-6 p-3 bg-[#FAFAF8] rounded-lg border border-[#244959]/8">
          <p className="text-xs text-[#244959]/50 mb-1">
            {tr ? 'نام نهایی' : 'Final Name'}
          </p>
          <p className="font-semibold text-[#244959]">
            {name.trim() ? `${name.trim()} — ${currentDate}` : (tr ? 'نام سروی — تاریخ' : 'Survey Name — Date')}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-[#244959]/20 rounded-lg font-semibold text-[#244959] hover:bg-[#244959]/5 transition disabled:opacity-50"
          >
            {tr ? 'لغو' : 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !name.trim()}
            className="flex-1 px-4 py-3 bg-[#244959] rounded-lg font-semibold text-white hover:bg-[#1a3a2e] transition disabled:opacity-50"
          >
            {loading ? (tr ? 'در حال شروع...' : 'Starting...') : (tr ? 'شروع سروی' : 'Start Survey')}
          </button>
        </div>
      </div>
    </div>
  );
}
