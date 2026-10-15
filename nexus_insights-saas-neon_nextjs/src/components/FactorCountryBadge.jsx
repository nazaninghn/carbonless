import { COUNTRIES } from '@/lib/data/countries';

const NAME = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));

// An entry whose electricity grid factor is for another country than its
// facility (a site in Germany on the Turkish grid). Shown next to the entry
// so an approver or auditor notices; the calculation is not changed.
export default function FactorCountryBadge({ entry, tr, className = '' }) {
  if (!entry?.factor_country_mismatch) return null;
  const where = NAME[entry.facility_country]?.[tr ? 'tr' : 'en'] || entry.facility_country || '';
  const factor = (tr && entry.emission_factor_name_tr) || entry.emission_factor_name || '';
  const title = tr
    ? `${entry.facility_name || 'Tesis'} ${where} konumunda; bu kayıt "${factor}" faktörüyle hesaplandı.`
    : `${entry.facility_name || 'The facility'} is in ${where}; this entry uses "${factor}".`;
  return (
    <span title={title} aria-label={title}
      className={`rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700 ring-1 ring-amber-200 ${className}`}>
      {tr ? `Başka ülke faktörü · ${where}` : `Other country's factor · ${where}`}
    </span>
  );
}
