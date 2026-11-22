'use client';

// A source that is not in the list, entered with the organisation's OWN emission factor.
// The user says where the factor comes from. A published source is accepted at once and counted; any other
// needs its document and goes to the advisor. Either way the questionnaire stays where it is: this is a
// dialog over the question, and closing it changes nothing in the answers.
// Server rules: carbonless_backend/emissions/serializers.py (CustomEmissionRequestSerializer).
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/utils/api';
import { parseLocalizedNumber } from '@/lib/utils/numbers';

const UNITS = ['kg', 'tonne', 'litre', 'm3', 'kWh', 'MWh', 'GJ', 'km', 'tonne-km', 'unit'];
const SOURCE_TYPES = [
  { value: 'published', label: { tr: 'Yayımlanmış kaynak (standart, veri tabanı, resmi yayın)', en: 'Published source (standard, database, official publication)' } },
  { value: 'supplier', label: { tr: 'Tedarikçi veya üretici deklarasyonu', en: 'Supplier or manufacturer declaration' } },
  { value: 'own_calculation', label: { tr: 'Kendi ölçümümüz veya hesabımız', en: 'Our own measurement or calculation' } },
  { value: 'other', label: { tr: 'Diğer', en: 'Other' } },
];
const SOURCE_MIN = 10;

function scopeOf(questionId) {
  const id = String(questionId || '');
  return id.startsWith('3') ? 'scope1' : id.startsWith('4') ? 'scope2' : 'scope3';
}

// The month the figure is filed under: December of a past year, the current month of the current one
// (a later month would be a future period, which the server refuses).
function filingMonth(year) {
  const now = new Date();
  return Number(year) < now.getFullYear() ? 12 : now.getMonth() + 1;
}

function firstError(data, tr) {
  if (!data || typeof data !== 'object') return '';
  const raw = Object.values(data).flat().find(v => typeof v === 'string');
  if (!raw) return '';
  const [a, b] = String(raw).split(' / ');
  return tr ? a : (b || a);
}

export default function OwnFactorForm({ reportId, year, questionId, questionLabel, lang, onClose, onSaved }) {
  const tr = lang === 'tr';
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [factor, setFactor] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [source, setSource] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const firstField = useRef(null);

  useEffect(() => { firstField.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const needsDocument = !!sourceType && sourceType !== 'published';

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const qty = parseLocalizedNumber(quantity);
    const ef = parseLocalizedNumber(factor);
    if (!name.trim()) return setError(tr ? 'Kaynağın adını yazın.' : 'Write the name of the source.');
    if (!(qty > 0)) return setError(tr ? 'Geçerli bir miktar girin.' : 'Enter a valid quantity.');
    if (!(ef > 0)) return setError(tr ? 'Geçerli bir emisyon faktörü girin (birim başına kg CO₂e).' : 'Enter a valid emission factor (kg CO₂e per unit).');
    if (!sourceType) return setError(tr ? 'Faktörün nereden geldiğini seçin.' : 'Choose where the factor comes from.');
    if (source.trim().length < SOURCE_MIN) {
      return setError(tr ? `Faktörün kaynağını yazın (en az ${SOURCE_MIN} karakter: yayın, tablo, yıl veya belge adı).`
        : `Write where the factor comes from (at least ${SOURCE_MIN} characters: publication, table, year or document).`);
    }
    if (needsDocument && !file) {
      return setError(tr ? 'Yayımlanmış bir kaynak dışındaki faktörler için belge yükleyin; danışman inceler.'
        : 'Upload the document for a factor that is not from a published source; an advisor reviews it.');
    }
    setError('');
    setSaving(true);
    try {
      const fd = new FormData();
      const fields = {
        scope: scopeOf(questionId), category_name: questionLabel || String(questionId || ''), source_name: name.trim(),
        description: tr ? `Envanter anketi · ${questionLabel || questionId}: listede olmayan kaynak, kuruluşun kendi emisyon faktörü`
          : `Inventory questionnaire · ${questionLabel || questionId}: source not in the list, the organisation's own emission factor`,
        unit, quantity: String(qty), year: String(year), month: String(filingMonth(year)), inventory: String(reportId),
        proposed_factor_kg_co2e: String(ef), factor_source_type: sourceType, factor_source: source.trim(),
      };
      Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('factor_document', file);
      const res = await api.createOwnFactorRequest(fd);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(firstError(data, tr) || (tr ? 'Kaydedilemedi. Lütfen tekrar deneyin.' : 'It could not be saved. Please try again.'));
        return;
      }
      setResult(data);
      onSaved?.(data);
    } catch {
      setError(tr ? 'Bağlantı hatası. Lütfen tekrar deneyin.' : 'Connection error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const input = 'mt-0.5 block w-full rounded-md border border-[#B9D3BF] bg-white px-2 py-1.5 text-[13px] text-[#0E2A14]';
  const label = 'block text-[12px] font-semibold text-[#0E2A14]';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="own-factor-title" data-testid="own-factor-dialog"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="own-factor-title" className="text-[15px] font-bold text-[#0E2A14]">
            {tr ? 'Listede olmayan kaynak — kendi emisyon faktörünüz' : 'A source not in the list — your own emission factor'}
          </h2>
          <button type="button" onClick={onClose} aria-label={tr ? 'Kapat' : 'Close'} className="rounded-md px-2 py-0.5 text-[18px] leading-none text-[#175022]">×</button>
        </div>

        {result ? (
          <div data-testid="own-factor-result" className="mt-3 space-y-3">
            <p className={`rounded-lg border px-3 py-2 text-[13px] ${result.status === 'approved' ? 'border-[#CFE3D3] bg-[#F4FAF5] text-[#0E2A14]' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              {result.status === 'approved'
                ? (tr ? `Kabul edildi ve envantere eklendi: ${Number(result.calculated_co2e_kg).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} kg CO₂e. Danışman bu kaydı sonradan inceleyebilir.`
                  : `Accepted and added to the inventory: ${Number(result.calculated_co2e_kg).toLocaleString('en-US', { maximumFractionDigits: 2 })} kg CO₂e. An advisor may still review it later.`)
                : (tr ? 'Danışmana gönderildi. Belgeniz incelenip onaylanınca envantere eklenir; o zamana kadar sayılmaz. Ankete devam edebilirsiniz — yalnızca imza, bu karar verilene kadar bekler.'
                  : 'Sent to the advisor. It is added to the inventory once your document is reviewed and approved; until then it is not counted. You can go on with the questionnaire — only the signature waits for this decision.')}
            </p>
            <button type="button" data-testid="own-factor-close" onClick={onClose} className="rounded-md bg-[#175022] px-3 py-1.5 text-[13px] font-semibold text-white">
              {tr ? 'Ankete dön' : 'Back to the questionnaire'}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-2.5" noValidate>
            <p className="text-[12px] leading-snug text-[#175022]/80">
              {tr
                ? 'Kaynağınız listede yoksa miktarını ve kendi emisyon faktörünüzü girin. Faktörün nereden geldiğini belirtin: yayımlanmış bir kaynak hemen kabul edilir; diğerleri belgeyle danışmana gider. Anket bu sırada durmaz.'
                : 'If your source is not in the list, enter its amount and your own emission factor. Say where the factor comes from: a published source is accepted at once; any other goes to the advisor with its document. The questionnaire does not stop meanwhile.'}
            </p>
            <label className={label}>{tr ? 'Kaynağın adı' : 'Name of the source'}
              <input ref={firstField} data-testid="own-factor-name" value={name} onChange={e => setName(e.target.value)} maxLength={255} className={input} placeholder={tr ? 'Örn: Basınçlı hava' : 'e.g. Compressed air'} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className={label}>{tr ? 'Yıllık miktar' : 'Annual amount'}
                <input data-testid="own-factor-quantity" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} className={input} placeholder={tr ? 'Örn: 12.000' : 'e.g. 12,000'} />
              </label>
              <label className={label}>{tr ? 'Birim' : 'Unit'}
                <select data-testid="own-factor-unit" value={unit} onChange={e => setUnit(e.target.value)} className={input}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
            </div>
            <label className={label}>{tr ? `Emisyon faktörünüz (kg CO₂e / ${unit})` : `Your emission factor (kg CO₂e per ${unit})`}
              <input data-testid="own-factor-value" inputMode="decimal" value={factor} onChange={e => setFactor(e.target.value)} className={input} placeholder={tr ? 'Örn: 0,12' : 'e.g. 0.12'} />
            </label>
            <label className={label}>{tr ? 'Bu faktör nereden geliyor?' : 'Where does this factor come from?'}
              <select data-testid="own-factor-source-type" value={sourceType} onChange={e => setSourceType(e.target.value)} className={input}>
                <option value="" disabled>{tr ? 'Seçin' : 'Select'}</option>
                {SOURCE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label[lang] || o.label.en}</option>)}
              </select>
            </label>
            <label className={label}>{tr ? 'Kaynak (yayın, tablo, yıl veya belge adı)' : 'Source (publication, table, year or document)'}
              <textarea data-testid="own-factor-source" value={source} onChange={e => setSource(e.target.value)} rows={2} maxLength={500} className={input}
                placeholder={tr ? 'Örn: Ecoinvent 3.9, basınçlı hava 7 bar, Tablo 4' : 'e.g. Ecoinvent 3.9, compressed air 7 bar, Table 4'} />
            </label>
            {sourceType && (
              <p data-testid="own-factor-route" className={`rounded-md px-2 py-1.5 text-[11px] font-semibold leading-snug ${needsDocument ? 'bg-amber-50 text-amber-800' : 'bg-[#F4FAF5] text-[#175022]'}`}>
                {needsDocument
                  ? (tr ? 'Bu faktör belgeyle danışmana gider; onaylanana kadar envantere sayılmaz.' : 'This factor goes to the advisor with its document; it is not counted until it is approved.')
                  : (tr ? 'Yayımlanmış kaynak: gönderdiğinizde kabul edilir ve hemen sayılır.' : 'Published source: accepted when you submit it and counted at once.')}
              </p>
            )}
            <div>
              <span className={label}>{needsDocument ? (tr ? 'Belge (zorunlu)' : 'Document (required)') : (tr ? 'Belge (isteğe bağlı)' : 'Document (optional)')}</span>
              <input data-testid="own-factor-document" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={e => setFile(e.target.files?.[0] || null)} className="mt-0.5 block w-full text-[12px] text-[#0E2A14]" />
            </div>
            {error && <p role="alert" data-testid="own-factor-error" className="rounded-md bg-red-50 px-2 py-1.5 text-[12px] font-semibold text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" data-testid="own-factor-submit" disabled={saving} className="rounded-md bg-[#175022] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60">
                {saving ? (tr ? 'Gönderiliyor…' : 'Sending…') : (tr ? 'Gönder' : 'Submit')}
              </button>
              <button type="button" onClick={onClose} className="rounded-md border border-[#B9D3BF] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0E2A14]">
                {tr ? 'Vazgeç' : 'Cancel'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
