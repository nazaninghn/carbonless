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
