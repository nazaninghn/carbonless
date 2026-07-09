'use client';

import { useInventory } from './InventoryWorkflow';

export default function SaveDraftModal({ tr = false }) {
  const { showSaveModal, handleSaveModalResponse, loading } = useInventory();

  if (!showSaveModal) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#244959]/10">
        <h3 className="text-lg font-bold text-[#244959] mb-2">
          {tr ? 'ذخیره تغییرات؟' : 'Save Changes?'}
        </h3>

        <p className="mt-2 text-sm text-[#244959]/60 mb-6">
          {tr
            ? 'این موجودیت‌شما تغییرات ذخیره نشده دارد. آیا می‌خواهید ذخیره کنید؟'
            : 'You have unsaved changes in this inventory. Do you want to save them?'}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleSaveModalResponse(true)}
            disabled={loading}
            className="rounded-full bg-[#244959] px-5 py-3 text-sm font-bold text-white hover:bg-[#1a3a2e] transition disabled:opacity-50"
          >
            {loading ? (tr ? 'در حال ذخیره...' : 'Saving...') : (tr ? 'بله، ذخیره کن' : 'Yes, save changes')}
          </button>

          <button
            onClick={() => handleSaveModalResponse(false)}
            disabled={loading}
            className="rounded-full border border-[#244959]/15 px-5 py-3 text-sm font-semibold text-[#244959]/70 hover:bg-[#244959]/5 transition disabled:opacity-50"
          >
            {tr ? 'نه، تغییرات را دور بریز' : 'No, discard changes'}
          </button>

          <button
            onClick={() => handleSaveModalResponse(null)}
            disabled={loading}
            className="rounded-full px-5 py-3 text-sm font-semibold text-[#244959]/40 hover:bg-[#244959]/5 transition disabled:opacity-50"
          >
            {tr ? 'لغو' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
