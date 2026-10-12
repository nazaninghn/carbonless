'use client';
import { useEffect, useState } from 'react';
import { api, setCompanyContext, COMPANY_CHANGED_KEY } from '@/lib/utils/api';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// Keeps a dashboard page tied to the company it was opened with:
// - names that company on every API call (see setCompanyContext);
// - a link that names a company (?company=7, from an e-mail or a notice of
//   another company) switches to it first;
// - coming back to a tab after another tab switched company reloads it;
// - after such a reload, says which company the page now shows.
export default function CompanyGuard() {
  const { language } = useLanguage();
  const tr = language === 'tr';
  const [changedTo, setChangedTo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let currentId = null;
    // Read now: the dashboard drops its query (tab/year) once it has used it.
    const params = new URLSearchParams(window.location.search);
    const wanted = Number(params.get('company'));
    try {
      const name = sessionStorage.getItem(COMPANY_CHANGED_KEY);
      if (name !== null) {
        sessionStorage.removeItem(COMPANY_CHANGED_KEY);
        setChangedTo(name || '—');
      }
    } catch {}

    const load = async () => {
      const res = await api.getMyCompanies().catch(() => null);
      if (!res?.ok) return null;
      const list = await res.json().catch(() => []);
      return Array.isArray(list) ? list : null;
    };

    (async () => {
      const list = await load();
      if (cancelled || !list) return;
      const current = list.find(c => c.is_current);
      if (wanted && current && wanted !== current.id && list.some(c => c.id === wanted)) {
        const sw = await api.switchCompany(wanted).catch(() => null);
        if (sw?.ok) {
          params.delete('company');
          const q = params.toString();
          window.location.replace(window.location.pathname + (q ? `?${q}` : ''));
          return;
        }
      }
      const here = new URLSearchParams(window.location.search);
      if (here.has('company')) {
        here.delete('company');
        const q = here.toString();
        window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : ''));
      }
      currentId = current?.id ?? null;
      setCompanyContext(currentId);
    })();

    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || currentId == null) return;
      const list = await load();
      const now = list?.find(c => c.is_current);
      if (now && now.id !== currentId) {
        try { sessionStorage.setItem(COMPANY_CHANGED_KEY, now.name || ''); } catch {}
        window.location.reload();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  useEffect(() => {
    if (!changedTo) return;
    const t = setTimeout(() => setChangedTo(null), 8000);
    return () => clearTimeout(t);
  }, [changedTo]);

  if (!changedTo) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-3 z-[9999] mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-900 shadow-lg">
      {tr
        ? `Şirket başka bir sekmede değiştirildi. Sayfa yenilendi; şu an ${changedTo} şirketindesiniz.`
        : `The company was switched in another tab. The page was reloaded; you are now in ${changedTo}.`}
      <button type="button" onClick={() => setChangedTo(null)} className="ml-2 text-amber-700 hover:underline">
        {tr ? 'Tamam' : 'OK'}
      </button>
    </div>
  );
}
