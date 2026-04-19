'use client';
import { useState, useRef, useEffect } from 'react';
import { COUNTRIES } from '@/lib/data/countries';

/**
 * Searchable country picker — single or multi select
 * @param {string} value - selected country code(s), comma-separated for multi
 * @param {function} onChange - callback with selected value
 * @param {string} language - 'tr' or 'en'
 * @param {boolean} multi - allow multiple selections
 * @param {string} placeholder
 */
export default function CountryPicker({ value, onChange, language = 'tr', multi = false, placeholder }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const lang = language === 'tr' ? 'tr' : 'en';
  const selected = multi ? (value || '').split(',').map(s => s.trim()).filter(Boolean) : [];
  const singleVal = !multi ? value : '';

  const filtered = COUNTRIES.filter(c => {
    const q = search.toLowerCase();
    return c.tr.toLowerCase().includes(q) || c.en.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });

  const getLabel = (code) => {
    const c = COUNTRIES.find(x => x.code === code || x.tr === code || x.en === code);
    return c ? `${c.flag} ${c[lang]}` : code;
  };

  const handleSelect = (country) => {
    if (multi) {
      const name = country[lang];
      const newList = selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name];
      onChange(newList.join(', '));
    } else {
      onChange(country[lang]);
      setSearch('');
      setOpen(false);
    }
  };

  const handleRemove = (name) => {
    if (multi) {
      onChange(selected.filter(s => s !== name).join(', '));
    } else {
      onChange('');
    }
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || (language === 'tr' ? 'Ülke ara...' : 'Search country...')}
        className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
      />

      {/* Selected tags */}
      {multi && selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(name => (
            <span key={name} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 border border-green-300 rounded-md text-xs text-green-800">
              {getLabel(name)}
              <button type="button" onClick={() => handleRemove(name)} className="text-green-600 hover:text-red-500">✕</button>
            </span>
          ))}
        </div>
      )}
      {!multi && singleVal && (
        <div className="mt-1 px-3 py-1.5 bg-green-100 border border-green-300 rounded-lg text-sm text-green-800 flex items-center justify-between">
          <span>{getLabel(singleVal)}</span>
          <button type="button" onClick={() => handleRemove(singleVal)} className="text-green-600 hover:text-red-500 ml-2 text-xs">✕</button>
        </div>
      )}

      {/* Dropdown */}
      {open && search.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-green-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 15).map(c => {
            const isSelected = multi ? selected.includes(c[lang]) : singleVal === c[lang];
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => handleSelect(c)}
                className={`w-full text-left px-4 py-2 hover:bg-green-50 text-sm border-b border-gray-100 last:border-0 flex items-center gap-2 ${isSelected ? 'bg-green-50' : ''}`}
              >
                <span>{c.flag}</span>
                <span className="text-gray-900">{c[lang]}</span>
                <span className="text-gray-400 text-xs ml-auto">{c.code}</span>
                {isSelected && <span className="text-green-500">✓</span>}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">{language === 'tr' ? 'Sonuç bulunamadı' : 'No results'}</div>
          )}
        </div>
      )}
    </div>
  );
}
