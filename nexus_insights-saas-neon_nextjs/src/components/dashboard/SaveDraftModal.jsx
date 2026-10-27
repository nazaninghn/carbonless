'use client';

import Button from '@/components/Button';
import { useInventory } from './InventoryWorkflow';

export default function SaveDraftModal({ tr = false }) {
  const { showSaveModal, handleSaveModalResponse, loading } = useInventory();

  if (!showSaveModal) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#175022]/10"
        role="dialog" aria-modal="true" aria-labelledby="save-draft-title"
        onKeyDown={(e) => { if (e.key === 'Escape' && !loading) { e.stopPropagation(); handleSaveModalResponse(null); } }}>
        <h3 id="save-draft-title" className="text-lg font-bold text-[#175022] mb-2">
          {tr ? 'Değişiklikleri kaydet?' : 'Save Changes?'}
        </h3>

        <p className="mt-2 text-sm text-[#175022]/60 mb-6">
          {tr
            ? 'Bu envanterde kaydedilmemiş değişiklikler var. Kaydetmek ister misiniz?'
            : 'You have unsaved changes in this inventory. Do you want to save them?'}
        </p>

        <div className="flex flex-col gap-3">
          <Button
            variant="dark"
            size="lg"
            loading={loading}
            onClick={() => handleSaveModalResponse(true)}
          >
            {loading ? (tr ? 'Kaydediliyor...' : 'Saving...') : (tr ? 'Evet, kaydet' : 'Yes, save changes')}
          </Button>

          <Button
            variant="secondary"
            size="lg"
            disabled={loading}
            onClick={() => handleSaveModalResponse(false)}
          >
            {tr ? 'Hayır, değişiklikleri at' : 'No, discard changes'}
          </Button>

          <Button
            variant="tertiary"
            size="lg"
            disabled={loading}
            onClick={() => handleSaveModalResponse(null)}
          >
            {tr ? 'İptal' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}

