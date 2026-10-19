'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { COUNTRIES } from '@/lib/data/countries';

/**
 * Searchable country picker — single or multi select
 * @param {string} value - selected country code(s), comma-separated for multi
 * @param {function} onChange - callback with selected value
 * @param {string} language - 'tr' or 'en'
 * @param {boolean} multi - allow multiple selections
 * @param {string} placeholder
 */
export default function CountryPicker({ value, onChange, language = 'tr', multi = false, placeholder, inputId }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  // The highlighted row of the open list: ↑/↓ move it, Enter picks it (the
  // picker could only be used with a mouse — Enter did nothing).
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const listId = `${inputId || 'country'}-listbox`;

  // Close on outside click or Escape key
  useEffect(() => {
    const onMouse = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey   = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown',   onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown',   onKey);
    };
  }, []);

  const lang = language === 'tr' ? 'tr' : 'en';
  // Memoized so the array reference stays stable across renders — avoids false
  // "new dep on every render" warnings in the handleSelect/handleRemove callbacks.
  const selected = useMemo(
    () => multi ? (value || '').split(',').map(s => s.trim()).filter(Boolean) : [],
    [multi, value],
  );
  const singleVal = !multi ? value : '';

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return COUNTRIES.filter(c =>
      c.tr.toLowerCase().includes(q) || c.en.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  const getLabel = (code) => {
    const c = COUNTRIES.find(x => x.code === code || x.tr === code || x.en === code);
    return c ? `${c.flag} ${c[lang]}` : code;
  };

  const handleSelect = useCallback((country) => {
    if (multi) {
      // Fix 27A/B: store country.code (language-neutral) instead of country[lang]
      const code = country.code;
      // Tapping a country already chosen keeps it: the open list covered its
      // tag, so un-choosing it here went unnoticed (the headquarters country
      // is added for the user, who then tapped it and lost it). Removing is
      // the tag's ✕. After a pick the list closes so the tags show.
      if (!selected.includes(code)) onChange([...selected, code].join(', '));
      setSearch('');
      setOpen(false);
    } else {
      onChange(country.code); // store code, not localized name
      setSearch('');
      setOpen(false);
    }
  }, [multi, selected, onChange]); // lang removed — no longer read inside

  const shown = filtered.slice(0, 15);
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); setActive(0); return; }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(i => (shown.length ? (i + step + shown.length) % shown.length : 0));
    } else if (e.key === 'Enter') {
      if (open && shown[active]) {
        e.preventDefault(); // never submit the form with the list open
        handleSelect(shown[active]);
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const handleRemove = useCallback((name) => {
    if (multi) {
      onChange(selected.filter(s => s !== name).join(', '));
    } else {
      onChange('');
    }
  }, [multi, selected, onChange]);

  return (
    <div ref={ref} className="relative">
      <input
        id={inputId}
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${shown[active].code}` : undefined}
        placeholder={placeholder || (language === 'tr' ? 'Ülke ara...' : 'Search country...')}
        className="w-full px-4 py-3 bg-white border border-[#8BEA99]/40 rounded-lg focus:ring-2 focus:ring-[#2ABD41]/30 focus:border-[#2ABD41] outline-none"
      />

      {/* Selected tags */}
      {multi && selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(name => (
            <span key={name} className="inline-flex items-center gap-1 px-2 py-1 bg-[#8BEA99]/15 border border-[#8BEA99]/35 rounded-md text-xs text-[#175022]">
              {getLabel(name)}
              <button type="button" onClick={() => handleRemove(name)} aria-label={`${language === 'tr' ? 'Kaldır' : 'Remove'}: ${getLabel(name)}`} className="text-[#2ABD41] hover:text-red-500">✕</button>
            </span>
          ))}
        </div>
      )}
      {!multi && singleVal && (
        <div className="mt-1 px-3 py-1.5 bg-[#8BEA99]/15 border border-[#8BEA99]/35 rounded-lg text-sm text-[#175022] flex items-center justify-between">
          <span>{getLabel(singleVal)}</span>
          <button type="button" onClick={() => handleRemove(singleVal)} className="text-[#2ABD41] hover:text-red-500 ml-2 text-xs">✕</button>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div id={listId} role="listbox" className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[#8BEA99]/30 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {shown.map((c, i) => {
            // Fix 27B: compare against c.code — survives language changes mid-session
            const isSelected = multi ? selected.includes(c.code) : singleVal === c.code;
            return (
              <button
                key={c.code}
                id={`${listId}-${c.code}`}
                type="button"
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onClick={() => handleSelect(c)}
                className={`w-full text-left px-4 py-2 hover:bg-green-50 text-sm border-b border-gray-100 last:border-0 flex items-center gap-2 ${isSelected ? 'bg-green-50' : ''} ${i === active ? 'ring-2 ring-inset ring-[#2ABD41]/40' : ''}`}
              >
                <span>{c.flag}</span>
                <span className="text-slate">{c[lang]}</span>
                <span className="text-graphite/60 text-xs ml-auto">{c.code}</span>
                {isSelected && <span className="text-xs font-semibold text-green-600">✓ {language === 'tr' ? 'Seçili' : 'Selected'}</span>}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-sm text-graphite">{language === 'tr' ? 'Sonuç bulunamadı' : 'No results'}</div>
          )}
        </div>
      )}
    </div>
  );
}
