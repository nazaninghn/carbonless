'use client';

import { useInventory } from './InventoryWorkflow';

export default function SaveDraftModal({ tr = false }) {
  const { showSaveModal, handleSaveModalResponse, loading } = useInventory();

  if (!showSaveModal) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#175022]/10">
        <h3 className="text-lg font-bold text-[#175022] mb-2">
          {tr ? 'Değişiklikleri kaydet?' : 'Save Changes?'}
        </h3>

        <p className="mt-2 text-sm text-[#175022]/60 mb-6">
          {tr
            ? 'Bu envanterde kaydedilmemiş değişiklikler var. Kaydetmek ister misiniz?'
            : 'You have unsaved changes in this inventory. Do you want to save them?'}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleSaveModalResponse(true)}
            disabled={loading}
            className="rounded-full bg-[#175022] px-5 py-3 text-sm font-bold text-white hover:bg-[#175022] transition disabled:opacity-50"
          >
            {loading ? (tr ? 'Kaydediliyor...' : 'Saving...') : (tr ? 'Evet, kaydet' : 'Yes, save changes')}
          </button>

          <button
            onClick={() => handleSaveModalResponse(false)}
            disabled={loading}
            className="rounded-full border border-[#175022]/15 px-5 py-3 text-sm font-semibold text-[#175022]/70 hover:bg-[#175022]/5 transition disabled:opacity-50"
          >
            {tr ? 'Hayır, değişiklikleri at' : 'No, discard changes'}
          </button>

          <button
            onClick={() => handleSaveModalResponse(null)}
            disabled={loading}
            className="rounded-full px-5 py-3 text-sm font-semibold text-[#175022]/40 hover:bg-[#175022]/5 transition disabled:opacity-50"
          >
            {tr ? 'İptal' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

