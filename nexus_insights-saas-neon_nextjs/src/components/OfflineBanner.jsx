'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// Says so when the device loses its connection. Without it a dropped
// connection on a phone looked like missing data: pages showed their empty
// states and saves failed with no explanation.
export default function OfflineBanner() {
  const { language } = useLanguage();
  const tr = language === 'tr';
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="pointer-events-none fixed inset-x-0 top-1.5 z-[70] flex justify-center px-4"
    >
      <p className="rounded-full bg-[#072C0E] px-3.5 py-1.5 text-center text-[11px] font-semibold text-white shadow-lg">
        {tr
          ? 'İnternet bağlantısı yok — kaydetmek için bağlantıyı bekleyin'
          : 'No internet connection — wait for it before saving'}
      </p>
    </div>
  );
}
