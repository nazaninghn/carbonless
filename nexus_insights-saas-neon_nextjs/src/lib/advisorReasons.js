// Plain-language text for "Danışman Onayı" (advisor approval) flags. The
// backend stores a short English note per flag (advisor_triggers.py); the
// review page shows this text instead, keyed by reason_code, with the few
// numbers that note carries.
import { getQuestionById } from '@/lib/carboniq/questions';

const REASONS = {
  sector_average: {
    tr: 'Fatura veya sayaç verisi yerine sektör ortalaması kullanıldı.',
    en: 'A sector average was used instead of invoice or meter data.',
  },
  estimate_used: {
    tr: 'Fatura veya sayaç verisi yerine mühendislik tahmini kullanıldı.',
    en: 'An engineering estimate was used instead of invoice or meter data.',
  },
  supplier_declaration: {
    tr: 'Tedarikçi veya üreticinin emisyon faktörü beyanı girildi.',
    en: 'A supplier or manufacturer emission factor declaration was entered.',
  },
  ipcc_default_leakage: {
    tr: 'Yıllık soğutucu gaz dolumu 0 girildi; IPCC varsayılan kaçak oranı uygulandı.',
    en: 'Annual refrigerant refill was 0; the IPCC default leak rate was applied.',
  },
  zero_leakage_declaration: {
    tr: 'Yıllık soğutucu gaz dolumu 0 girildi ve sıfır kaçak beyan edildi.',
    en: 'Annual refrigerant refill was 0 and zero leakage was declared.',
  },
  no_op_control_3a: {
    tr: 'Operasyonel kontrol yok — kaynak Kapsam 1\'den Kapsam 3 Kategori 8\'e taşındı.',
    en: 'No operational control — the source was moved from Scope 1 to Scope 3 Category 8.',
  },
  k3_category_no: {
    tr: 'Bir Kapsam 3 kategorisi "uygulanamaz" olarak işaretlendi.',
    en: 'A Scope 3 category was marked as not applicable.',
  },
  rfi_applied: {
    tr: 'Uçuş kaydında RFI işaretlendi; kabin sınıfı faktörleri RFI\'yı zaten içerdiği için ×1,9 ayrıca uygulanmadı.',
    en: 'RFI was ticked on a flight; the cabin-class factors already include RFI, so ×1.9 was not applied again.',
  },
  rfi_not_applied: {
    tr: 'Uçuş kaydında RFI işaretlenmedi; kabin sınıfı faktörleri RFI\'yı zaten içerir, hesap değişmez.',
    en: 'RFI was not ticked on a flight; the cabin-class factors already include RFI, the result is the same.',
  },
  biomass_neutral: {
    tr: 'Biyokütle seçildi — CO₂\'i biyojenik olarak ayrıca raporlanır; CH₄ ve N₂O Kapsam 1\'e dahildir.',
    en: 'Biomass was selected — its CO₂ is reported separately as biogenic; CH₄ and N₂O count in Scope 1.',
  },
  ar6_gwp_confirmed: {
    tr: 'IPCC AR6 (2021) KIP (GWP) referansı seçildi; soğutucu gaz kaçakları AR6 değerleri birleştirilene kadar hesaplanmıyor.',
    en: 'The IPCC AR6 (2021) GWP reference was chosen; refrigerant leaks are not calculated until the AR6 values are unified.',
  },
  ef_database_change: {
    tr: 'Standart bir veri tabanı yerine özel bir emisyon faktörü veri tabanı seçildi.',
    en: 'A custom emission factor database was selected instead of a standard one.',
  },
  '6a_entity_exclusion': {
    tr: 'Bir kuruluş veya tesis envanter sınırının dışında bırakıldı.',
    en: 'An entity or facility was excluded from the inventory boundary.',
  },
  '6c_medium_materiality': {
    tr: (n) => `Hariç tutulan kaynağın tahmini emisyon payı %${n || '5–20'}.`,
    en: (n) => `The excluded source's estimated emission share is ${n || '5–20'}%.`,
  },
  '6c_high_materiality': {
    tr: 'Hariç tutulan kaynağın tahmini emisyon payı %20\'nin üzerinde.',
    en: "The excluded source's estimated emission share is above 20%.",
  },
  pct5_exceeded: {
    tr: 'Hariç tutulan kaynakların toplam payı ISO 14064-1\'in %5 sınırını aşıyor.',
    en: 'The combined share of excluded sources exceeds the ISO 14064-1 5% threshold.',
  },
  current_year_data: {
    tr: 'Raporlama yılı içinde bulunulan yıl — bazı veriler henüz tahmini olabilir.',
    en: 'The reporting year is the current year — some data may still be estimated.',
  },
  no_base_year_recalc: {
    tr: 'Yapısal değişikliğin etkisi %5\'i aşıyor ancak baz yıl yeniden hesaplanmadı.',
    en: 'A structural change exceeds 5% but the base year was not recalculated.',
  },
  overseas_site_c2_conflict: {
    tr: (c) => `Yurt dışı faaliyet "Hayır" olarak cevaplandı ama yurt dışında bir tesis eklendi${c ? ` (${c})` : ''}.`,
    en: (c) => `International operations was answered "No" but an overseas facility was added${c ? ` (${c})` : ''}.`,
  },
  site_count_mismatch: {
    tr: (d, a) => `Tesis sayısı ${d ?? '?'} olarak beyan edildi ama ${a ?? '?'} tesis girildi.`,
    en: (d, a) => `${d ?? '?'} facilities were declared but ${a ?? '?'} were entered.`,
  },
};

const CATEGORY_EN = {
  'Veri Girişi': 'Data entry',
  Metodoloji: 'Methodology',
  Kapsam: 'Scope',
  Belge: 'Document',
  Tutarsızlık: 'Inconsistency',
};

// The numbers the stored English note carries, for the reasons that have any.
function params(item) {
  const d = item.description || '';
  switch (item.reason_code) {
    case '6c_medium_materiality': {
      const m = d.match(/share is ([\d-]+)%/);
      return [m ? m[1].replace('-', '–') : null];
    }
    case 'overseas_site_c2_conflict': {
      const m = d.match(/\(([^)]+)\)/);
      return [m ? m[1] : null];
    }
    case 'site_count_mismatch': {
      const m = d.match(/declared (\d+) facilities but (\d+)/);
      return m ? [m[1], m[2]] : [];
    }
    default:
      return [];
  }
}

// { text, question } for one flag: the reason in the UI language, and the
// question it came from ("Soru 101 — <question text>") when it is known.
export function advisorReasonText(item, tr) {
  const lang = tr ? 'tr' : 'en';
  const entry = REASONS[item.reason_code];
  let text;
  if (entry) {
    const t = entry[lang];
    text = typeof t === 'function' ? t(...params(item)) : t;
  } else {
    text = item.description || item.reason_code;
  }
  const q = item.question_id ? getQuestionById(item.question_id) : null;
  const qText = q ? (q.text?.[lang] || q.text?.en || '').replace(/^\[[^\]]*\]\s*—\s*/, '') : '';
  const question = q
    ? `${tr ? 'Soru' : 'Question'} ${q.number}${qText ? ` — ${qText}` : ''}`
    : null;
  return { text, question };
}

export function advisorCategoryLabel(category, tr) {
  return tr ? category : (CATEGORY_EN[category] || category);
}
