// Descriptions the system writes on entries it creates ("AI Chat: electricity
// 1250.5 kwh", "Questionnaire step 3A-5 · Merkez") are kept as stored — the
// questionnaire finds its own entries by that prefix — but shown in the UI
// language. Same rules as emissions/descriptions.py.
export function autoDescriptionLabel(desc, tr) {
  const d = desc || '';
  if (d.startsWith('AI Chat:')) return tr ? 'AI sohbetinden' : 'From AI chat';
  if (d.startsWith('Questionnaire step ')) {
    const rest = d.slice('Questionnaire step '.length).trim();
    const base = tr ? 'Anketten' : 'From the questionnaire';
    return rest ? `${base} — ${rest}` : base;
  }
  if (d.startsWith('Workspace ')) {
    const tag = d.slice('Workspace '.length).split(' ')[0];
    const base = tr ? 'Çalışma alanından' : 'From the workspace';
    return tag ? `${base} — ${tag}` : base;
  }
  return null;
}

// The questionnaire and workspace re-find their entries by the stored text,
// so those descriptions must not be edited.
export const isLinkedDescription = (desc) =>
  (desc || '').startsWith('Questionnaire step ') || (desc || '').startsWith('Workspace ');

// "Anketten — Soru 68 · VA-01 · PCAF %10 × 1.200 tCO2e" for an entry the
// questionnaire made: its question's number (not the step code 4A-1) and how
// it was calculated, in the UI language (calc_detail holds both). Other
// entries: the plain autoDescriptionLabel.
export function entrySourceLabel(entry, tr) {
  const d = entry?.description || '';
  if (!d.startsWith('Questionnaire step ')) return autoDescriptionLabel(d, tr);
  const rest = d.slice('Questionnaire step '.length).trim();
  const step = rest.split(' ')[0];
  const parts = [entry.question_number ? `${tr ? 'Soru' : 'Question'} ${entry.question_number}` : step];
  const detail = entry.calc_detail?.[tr ? 'tr' : 'en'] || (rest.includes(' · ') ? rest.split(' · ').slice(1).join(' · ') : '');
  if (detail) parts.push(detail);
  return `${tr ? 'Anketten' : 'From the questionnaire'} — ${parts.join(' · ')}`;
}

// Questionnaire entries hold a whole year's amount; they are stored with
// month 1 only because the field needs a value, so they are shown as
// "Yıllık" / "Annual" rather than January.
export const isAnnualEntry = (entry) => (entry?.description || '').startsWith('Questionnaire step ');

export function entryPeriodLabel(entry, months, tr) {
  if (isAnnualEntry(entry)) return tr ? 'Yıllık' : 'Annual';
  return months[(parseInt(entry?.month) || 1) - 1] || '';
}
