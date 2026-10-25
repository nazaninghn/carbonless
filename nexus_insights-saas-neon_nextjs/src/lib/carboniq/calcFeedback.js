// What the Wizard says right after an answer is saved.
//
// Two different totals exist and they are not interchangeable:
//   fb.total_kg      the total of the entries THE QUESTIONNAIRE created (this inventory's
//                    annual figures) — a partial total: monthly form/chat entries and approved
//                    custom requests are not in it;
//   fb.year_total_kg everything approved for the reporting year — the figure the Dashboard,
//                    the exports and the reports show.
// The message names the first as the questionnaire total and, when anything else is approved
// for the year, adds the second. It never calls the questionnaire-only figure "the approved
// total" or "the inventory total": that is what the Dashboard shows.
//
// Returns the line to show, or null when the answer changed nothing.

const tonnes = (kg, tr) => {
  const t = Math.abs(kg) / 1000;
  const locale = tr ? 'tr-TR' : 'en-US';
  return t >= 0.01
    ? `${t.toLocaleString(locale, { maximumFractionDigits: 2 })} t CO₂e`
    : `${Math.abs(kg).toLocaleString(locale, { maximumFractionDigits: 1 })} kg CO₂e`;
};

export function calcFeedbackLine(fb, { tr = false, year = null } = {}) {
  if (!fb) return null;
  const delta = Number(fb.delta_kg) || 0;
  if (Math.abs(delta) < 0.05) return null;
  const sign = delta > 0 ? '+' : '−';
  const questionnaire = Number(fb.total_kg) || 0;
  const hasYear = fb.year_total_kg !== undefined && fb.year_total_kg !== null;
  const yearTotal = Number(fb.year_total_kg) || 0;
  // Other approved emissions (monthly entries, custom requests) exist for the year.
  const other = hasYear && Math.abs(yearTotal - questionnaire) >= 0.05;
  const yearPart = other
    ? (tr
      ? `; ${year ? `${year} yılının ` : ''}tüm onaylı emisyonları (aylık kayıtlar ve onaylı özel talepler dahil): ${tonnes(yearTotal, tr)}`
      : `; all approved emissions${year ? ` for ${year}` : ''} (monthly entries and approved custom requests included): ${tonnes(yearTotal, tr)}`)
    : '';
  if (fb.pending) {
    // A data-entry member's change waits for approval: it is not in any total yet.
    return tr
      ? `⏳ Onaya gönderildi: **${sign}${tonnes(delta, tr)}** — onaylanınca envantere eklenir (onaylı anket toplamı ${tonnes(questionnaire, tr)}${yearPart}).`
      : `⏳ Sent for approval: **${sign}${tonnes(delta, tr)}** — added to the inventory once approved (approved questionnaire total ${tonnes(questionnaire, tr)}${yearPart}).`;
  }
  return tr
    ? `✓ Envantere yansıdı: **${sign}${tonnes(delta, tr)}** (anket toplamı ${tonnes(questionnaire, tr)}${yearPart}).`
    : `✓ Added to the inventory: **${sign}${tonnes(delta, tr)}** (questionnaire total ${tonnes(questionnaire, tr)}${yearPart}).`;
}
