import { getQuestionById } from '@/lib/carboniq/questions';

// A stored questionnaire answer, written the way the questionnaire shows it,
// for the Danışman Onayı cards: option codes become their labels
// ("not_controlled" -> "Operasyonel kontrol dışında"), compound answers list
// each field ("Birim: kg CO₂e / kWh · Kaynak: …"), per-facility answers list
// every facility. Returns '' when there is nothing to show.

const YES_NO = {
  yes: { tr: 'Evet', en: 'Yes' },
  no: { tr: 'Hayır', en: 'No' },
  true: { tr: 'Evet', en: 'Yes' },
  false: { tr: 'Hayır', en: 'No' },
};

const MAX_LENGTH = 220;

function optionLabel(options, value, lang) {
  const opt = (options || []).find((o) => String(o.value) === String(value));
  const label = opt?.label?.[lang] ?? opt?.label;
  if (typeof label === 'string') return label.replace(/\s*\((Önerilen|Recommended)\)\s*$/, '');
  return YES_NO[String(value)]?.[lang] ?? String(value);
}

function scalar(value, options, lang) {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map((v) => scalar(v, options, lang)).filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return optionLabel(options, value, lang);
}

function compound(value, fields, lang) {
  return fields
    .map((f) => {
      const v = scalar(value?.[f.id], f.options, lang);
      if (!v) return '';
      const label = f.label?.[lang] ?? f.id;
      return `${label}: ${v}`;
    })
    .filter(Boolean)
    .join(' · ');
}

export function formatAdvisorAnswer(questionId, answer, tr) {
  const lang = tr ? 'tr' : 'en';
  if (answer === null || answer === undefined || answer === '') return '';
  const q = getQuestionById(questionId);
  let text = '';

  if (q?.fields?.length && answer && Array.isArray(answer.items)) {
    // repeatable compound: { items: [...], draft: {...} } — one part per row
    text = answer.items.map((v) => compound(v, q.fields, lang)).filter(Boolean).join(' | ');
  } else if (q?.fields?.length && answer && typeof answer === 'object' && !Array.isArray(answer)) {
    const isPerItem = Object.values(answer).length > 0
      && Object.values(answer).every((v) => v && typeof v === 'object' && !Array.isArray(v));
    text = isPerItem
      ? Object.values(answer).map((v) => compound(v, q.fields, lang)).filter(Boolean).join(' | ')
      : compound(answer, q.fields, lang);
  } else if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    text = Object.values(answer).map((v) => scalar(v, q?.options, lang)).filter(Boolean).join(', ');
  } else {
    text = scalar(answer, q?.options, lang);
  }

  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text;
}
