// @ts-check
// What the dashboard can truthfully say about ONE inventory, from data the server already calculated.
//
// Four kinds of statement, never mixed:
//   fact      calculated from the figures (a share, a ranking, a comparison the server made)
//   warning   something in the data that affects how far to trust or complete it
//   missing   information that is not there yet (an unanswered question, a scope with nothing calculated)
//   ai        an action that hands a question to the AI assistant — never presented as a finding
//
// Nothing here invents a number, a target or a comparison: a statement exists only when its data does, and with no
// data there are no facts at all. No calculation is made (every amount is the server's); this only ranks and phrases.
// Pure and bilingual, so it can be tested without a browser.

/**
 * @typedef {'fact' | 'warning' | 'missing' | 'ai'} InsightKind
 * @typedef {{ id: string, kind: InsightKind, title: string, text: string,
 *             action?: { kind: 'tab' | 'continue' | 'ask-ai', tab?: string, label: string, prefill?: string } }} Insight
 */

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const num = (/** @type {unknown} */ v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** @param {number} n @param {boolean} tr @param {number} [d] */
export function fmt(n, tr, d = 1) {
  return num(n).toLocaleString(tr ? 'tr-TR' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
const pct = (/** @type {number} */ part, /** @type {number} */ whole, /** @type {boolean} */ tr) =>
  whole > 0 ? fmt((part / whole) * 100, tr, 0) : null;

/**
 * The three scopes with their share of the total; null when there is nothing to share.
 * @param {{ scope1_tonne?: number, scope2_tonne?: number, scope3_tonne?: number } | null | undefined} summary
 */
export function scopeShares(summary) {
  const s = [
    { key: 'scope1', tonne: num(summary?.scope1_tonne) },
    { key: 'scope2', tonne: num(summary?.scope2_tonne) },
    { key: 'scope3', tonne: num(summary?.scope3_tonne) },
  ];
  const total = s.reduce((a, x) => a + Math.max(x.tonne, 0), 0);
  if (!(total > 0)) return null;
  return { total, scopes: s.map(x => ({ ...x, share: Math.max(x.tonne, 0) / total })) };
}

/**
 * Quarterly totals of the monthly entries (kg), or null when no month has data. The annual inventory total is not
 * split by month by the server, so it is not part of this.
 * @param {Array<{ month: number, total_kg: number }> | null | undefined} monthly
 */
export function quarterly(monthly) {
  const list = Array.isArray(monthly) ? monthly : [];
  if (!list.some(m => num(m?.total_kg) > 0)) return null;
  const q = [0, 0, 0, 0];
  for (const m of list) {
    const i = Math.floor((num(m?.month) - 1) / 3);
    if (i >= 0 && i < 4) q[i] += num(m?.total_kg);
  }
  return q.map((kg, i) => ({ quarter: i + 1, total_kg: kg }));
}

/**
 * The comparison with the year before, only when the server made one (it leaves it out when it would not be fair).
 * @param {{ change_pct?: number, previous_year?: number, months?: number } | null | undefined} change
 * @param {boolean} tr
 */
export function yearComparison(change, tr) {
  if (!change || typeof change.change_pct !== 'number') return null;
  const months = num(change.months) || 12;
  const m = tr ? MONTHS_TR : MONTHS_EN;
  const span = months < 12 ? `${m[0]}–${m[Math.max(months - 1, 0)]} ${change.previous_year}` : String(change.previous_year);
  return { down: change.change_pct <= 0, pct: Math.abs(change.change_pct), span };
}

/**
 * @param {{
 *   summary: any, targets?: any[], inventory?: any | null,
 *   status?: { requiredUnanswered: number | null, pending: number | null } | null,
 *   facilitiesWithoutGrid?: number, canApprove?: boolean, pendingApprovals?: number, notCountedLine?: string | null, tr: boolean,
 *   categoryName: (category: string) => string,
 * }} args
 * @returns {Insight[]}
 */
export function buildInsights({ summary, targets = [], inventory = null, status = null, facilitiesWithoutGrid = 0,
  canApprove = false, pendingApprovals = 0, notCountedLine = null, tr, categoryName }) {
  /** @type {Insight[]} */ const out = [];
  const total = num(summary?.total_tonne);
  const shares = scopeShares(summary);
  const scopeName = { scope1: tr ? 'Kapsam 1' : 'Scope 1', scope2: tr ? 'Kapsam 2' : 'Scope 2', scope3: tr ? 'Kapsam 3' : 'Scope 3' };

  // ── calculated facts ─────────────────────────────────────────────────────────────────────────────────────────
  if (shares) {
    const top = [...shares.scopes].sort((a, b) => b.tonne - a.tonne)[0];
    if (top.tonne > 0) out.push({
      id: 'top-scope', kind: 'fact',
      title: tr ? 'En büyük kapsam' : 'Largest scope',
      text: tr
        ? `${scopeName[/** @type {'scope1'|'scope2'|'scope3'} */ (top.key)]}, envanterin %${fmt(top.share * 100, tr, 0)}'ini oluşturuyor (${fmt(top.tonne, tr, 2)} tCO2e).`
        : `${scopeName[/** @type {'scope1'|'scope2'|'scope3'} */ (top.key)]} is ${fmt(top.share * 100, tr, 0)}% of the inventory (${fmt(top.tonne, tr, 2)} tCO2e).`,
    });
  }

  const cats = (Array.isArray(summary?.by_category) ? summary.by_category : [])
    .map((/** @type {any} */ c) => ({ category: String(c.category ?? ''), kg: num(c.total_kg) }))
    .filter((/** @type {{category:string,kg:number}} */ c) => c.category && c.kg > 0)
    .sort((/** @type {any} */ a, /** @type {any} */ b) => b.kg - a.kg);
  const catTotal = cats.reduce((/** @type {number} */ a, /** @type {{kg:number}} */ c) => a + c.kg, 0);
  if (cats.length && catTotal > 0) out.push({
    id: 'top-source', kind: 'fact',
    title: tr ? 'En büyük kaynak' : 'Largest source',
    text: tr
      ? `${categoryName(cats[0].category)}: ${fmt(cats[0].kg / 1000, tr, 2)} tCO2e (kaynaklı emisyonların %${pct(cats[0].kg, catTotal, tr)}'i).`
      : `${categoryName(cats[0].category)}: ${fmt(cats[0].kg / 1000, tr, 2)} tCO2e (${pct(cats[0].kg, catTotal, tr)}% of source-attributed emissions).`,
  });

  const s3 = (Array.isArray(summary?.scope3_by_category) ? summary.scope3_by_category : [])
    .filter((/** @type {any} */ c) => num(c.total_co2e_kg) > 0)
    .sort((/** @type {any} */ a, /** @type {any} */ b) => num(b.total_co2e_kg) - num(a.total_co2e_kg));
  const s3kg = num(summary?.scope3_kg);
  if (s3.length && s3kg > 0) {
    const c = s3[0];
    out.push({
      id: 'top-scope3', kind: 'fact',
      title: tr ? 'En büyük Kapsam 3 kategorisi' : 'Largest Scope 3 category',
      text: tr
        ? `${c.ghg_number}. kategori — ${c.name_tr}: Kapsam 3'ün %${pct(num(c.total_co2e_kg), s3kg, tr)}'i.`
        : `Category ${c.ghg_number} — ${c.name_en}: ${pct(num(c.total_co2e_kg), s3kg, tr)}% of Scope 3.`,
    });
  }

  const byFacility = (Array.isArray(summary?.by_facility) ? summary.by_facility : [])
    .filter((/** @type {any} */ f) => num(f.total_kg) > 0);
  const facTotal = byFacility.reduce((/** @type {number} */ a, /** @type {any} */ f) => a + num(f.total_kg), 0);
  if (byFacility.length >= 2 && facTotal > 0 && num(byFacility[0].total_kg) / facTotal >= 0.5) out.push({
    id: 'facility-concentration', kind: 'fact',
    title: tr ? 'Tesis yoğunlaşması' : 'Facility concentration',
    text: tr
      ? `${byFacility[0].facility_name}, tesislere atanan emisyonların %${pct(num(byFacility[0].total_kg), facTotal, tr)}'ini oluşturuyor.`
      : `${byFacility[0].facility_name} accounts for ${pct(num(byFacility[0].total_kg), facTotal, tr)}% of facility-attributed emissions.`,
  });

  const cmp = yearComparison(summary?.previous_year_change, tr);
  if (cmp) out.push({
    id: 'year-change', kind: 'fact',
    title: tr ? 'Önceki dönemle karşılaştırma' : 'Change versus the previous period',
    text: tr
      ? `${cmp.span} dönemine göre %${fmt(cmp.pct, tr, 1)} ${cmp.down ? 'daha düşük' : 'daha yüksek'}.`
      : `${fmt(cmp.pct, tr, 1)}% ${cmp.down ? 'lower' : 'higher'} than ${cmp.span}.`,
  });

  const months = (Array.isArray(summary?.monthly) ? summary.monthly : []).filter((/** @type {any} */ m) => num(m.total_kg) > 0);
  if (months.length >= 2) {
    const peak = [...months].sort((/** @type {any} */ a, /** @type {any} */ b) => num(b.total_kg) - num(a.total_kg))[0];
    out.push({
      id: 'peak-month', kind: 'fact',
      title: tr ? 'Aylık kayıtlarda zirve' : 'Peak of the monthly entries',
      text: tr
        ? `${MONTHS_TR[num(peak.month) - 1]} ayı: ${fmt(num(peak.total_kg) / 1000, tr, 2)} tCO2e (veri girilen ${months.length} ay içinde).`
        : `${MONTHS_EN[num(peak.month) - 1]}: ${fmt(num(peak.total_kg) / 1000, tr, 2)} tCO2e (of ${months.length} months with entries).`,
    });
  }

  // ── warnings ─────────────────────────────────────────────────────────────────────────────────────────────────
  if (notCountedLine) out.push({ id: 'not-counted', kind: 'warning', title: tr ? 'Toplamlara dahil olmayan kayıtlar' : 'Entries outside the totals', text: notCountedLine,
    action: { kind: 'tab', tab: 'review', label: tr ? 'İncele' : 'Review' } });
  const unassigned = num(summary?.unassigned_records?.entries);
  if (unassigned > 0) out.push({ id: 'unassigned', kind: 'warning', title: tr ? 'Envantere atanmamış kayıtlar' : 'Records not assigned to an inventory',
    text: tr ? `${unassigned} kayıt hiçbir envantere atanmamış; bu envanterin toplamlarına dahil değildir.`
      : `${unassigned} record${unassigned === 1 ? ' is' : 's are'} not assigned to any inventory and not included in this inventory's totals.`,
    action: { kind: 'tab', tab: 'emissions', label: tr ? 'Emisyonlar' : 'Emissions' } });
  const credit = summary?.avoided_credit?.note;
  if (credit && (credit.en || credit.tr)) out.push({ id: 'avoided-credit', kind: 'warning', title: tr ? 'Doğrulanmamış geri kazanım kredisi' : 'Unverified recycling credit', text: String(tr ? credit.tr || credit.en : credit.en || credit.tr) });
  const customPending = num(summary?.custom_emissions?.pending_count);
  if (customPending > 0) out.push({ id: 'custom-pending', kind: 'warning', title: tr ? 'Onay bekleyen özel faktör talepleri' : 'Custom factor requests awaiting approval',
    text: tr ? `${customPending} özel emisyon faktörü talebi onay bekliyor; onaylanana kadar hesaplamaya dahil değil.`
      : `${customPending} custom emission-factor request${customPending === 1 ? ' is' : 's are'} awaiting approval and not yet in the calculation.` });
  if (facilitiesWithoutGrid > 0) out.push({ id: 'grid-connection', kind: 'warning', title: tr ? 'Şebeke bağlantı türü seçilmemiş' : 'Grid connection not chosen',
    text: tr ? `${facilitiesWithoutGrid} tesis için şebeke bağlantı türü seçilmedi; bu tesislerin elektriği hesaplanamıyor.`
      : `No grid connection chosen for ${facilitiesWithoutGrid} facilit${facilitiesWithoutGrid === 1 ? 'y' : 'ies'}; their electricity cannot be calculated.`,
    action: { kind: 'tab', tab: 'settings', label: tr ? 'Tesisler' : 'Facilities' } });
  if (canApprove && num(pendingApprovals) > 0) out.push({ id: 'pending-approvals', kind: 'warning', title: tr ? 'Onayınızı bekleyen kayıtlar' : 'Awaiting your approval',
    text: tr ? `${num(pendingApprovals)} kayıt veya danışman onayı incelemenizi bekliyor.` : `${num(pendingApprovals)} item${num(pendingApprovals) === 1 ? '' : 's'} await${num(pendingApprovals) === 1 ? 's' : ''} your review and approval.`,
    action: { kind: 'tab', tab: 'review', label: tr ? 'İncele' : 'Review' } });
  const advisorPending = num(inventory?.advisor_pending);
  const advisorRejected = num(inventory?.advisor_rejected);
  if (advisorPending + advisorRejected > 0) out.push({ id: 'advisor', kind: 'warning', title: tr ? 'Danışman onayı' : 'Advisor approval',
    text: tr ? `${advisorPending} onay bekliyor, ${advisorRejected} reddedildi.` : `${advisorPending} awaiting approval, ${advisorRejected} rejected.` });

  // ── missing information ──────────────────────────────────────────────────────────────────────────────────────
  if (status && status.requiredUnanswered != null && status.requiredUnanswered > 0) out.push({ id: 'required-open', kind: 'missing',
    title: tr ? 'Yanıtlanması zorunlu sorular' : 'Required questions still open',
    text: tr ? `${status.requiredUnanswered} zorunlu soru yanıtsız; envanter tamamlanmadan önce yanıtlanmalı.`
      : `${status.requiredUnanswered} required question${status.requiredUnanswered === 1 ? ' is' : 's are'} unanswered and must be answered before the inventory can be completed.`,
    action: { kind: 'continue', label: tr ? 'Envantere devam et' : 'Continue inventory' } });
  if (status && status.pending != null && status.pending > 0) out.push({ id: 'deferred', kind: 'missing',
    title: tr ? 'Sonra yanıtlanacak sorular' : 'Questions left for later',
    text: tr ? `${status.pending} soru "sonra yanıtla" olarak işaretli; yanıt sayılmaz.`
      : `${status.pending} question${status.pending === 1 ? ' is' : 's are'} marked "answer later"; they do not count as answered.`,
    action: { kind: 'continue', label: tr ? 'Soruları incele' : 'Review questions' } });
  if (shares) {
    for (const s of shares.scopes) if (!(s.tonne > 0)) out.push({ id: `empty-${s.key}`, kind: 'missing',
      title: tr ? `${scopeName[/** @type {'scope1'|'scope2'|'scope3'} */ (s.key)]}: hesaplanmış emisyon yok` : `${scopeName[/** @type {'scope1'|'scope2'|'scope3'} */ (s.key)]}: nothing calculated`,
      text: tr ? `Bu envanterde ${scopeName[/** @type {'scope1'|'scope2'|'scope3'} */ (s.key)]} için hesaplanmış emisyon görünmüyor.`
        : `No calculated emissions are shown for ${scopeName[/** @type {'scope1'|'scope2'|'scope3'} */ (s.key)]} in this inventory.` });
  } else if (inventory) {
    out.push({ id: 'no-emissions', kind: 'missing', title: tr ? 'Henüz hesaplanmış emisyon yok' : 'No emissions calculated yet',
      text: tr ? 'Bu envanter için henüz hesaplanmış emisyon yok. Envanteri yanıtladıkça veya veri ekledikçe burada görünür.'
        : 'Nothing has been calculated for this inventory yet. Figures appear as you answer the inventory or add data.',
      action: { kind: 'continue', label: tr ? 'Envantere devam et' : 'Continue inventory' } });
  }
  if (canApprove && (!Array.isArray(targets) || targets.length === 0) && total > 0) out.push({ id: 'no-target', kind: 'missing',
    title: tr ? 'Azaltım hedefi yok' : 'No reduction target',
    text: tr ? 'Henüz bir azaltım hedefi belirlenmedi; ilerleme karşılaştırması yapılamıyor.' : 'No reduction target has been set, so progress cannot be compared.',
    action: { kind: 'tab', tab: 'reduction', label: tr ? 'Hedef ekle' : 'Add target' } });

  // ── AI: an action, not a finding ─────────────────────────────────────────────────────────────────────────────
  if (inventory || total > 0) out.push({ id: 'ask-ai', kind: 'ai',
    title: tr ? 'Carbon AI ile incele' : 'Explore with Carbon AI',
    text: tr ? 'Bu envanterin rakamlarını açıklatın ya da azaltım fikirleri isteyin. Yanıtlar AI asistanından gelir; burada bulgu olarak gösterilmez.'
      : "Ask the assistant to explain this inventory's figures or suggest reduction ideas. The answers come from the AI assistant; they are not shown here as findings.",
    action: { kind: 'ask-ai', label: tr ? 'AI asistana sor' : 'Ask the AI assistant',
      prefill: tr ? `${summary?.year ?? ''} envanterimin emisyon profilini özetler misin? En büyük kaynaklar ve azaltım fırsatları neler?`
        : `Can you summarise the emission profile of my ${summary?.year ?? ''} inventory? What are the biggest sources and the reduction opportunities?` } });

  return out;
}
