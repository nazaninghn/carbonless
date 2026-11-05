// Which inventory the dashboard shows for the selected reporting year.
//
// Several inventories can share a reporting year, so the year alone no longer
// identifies one. The server stays the authority (every scoped request carries an
// inventory_id and the server checks it belongs to the caller's company); this module only
// chooses WHICH id to send, and remembers the user's choice per user and year. The
// remembered value is a preference, never a source of data: it is validated against the
// list the server returned, and a stale id (a deleted inventory) is ignored.

const KEY_PREFIX = 'carbonless_selected_inventory';

const keyOf = (userId, year) => `${KEY_PREFIX}:${userId}:${year}`;

export function rememberedInventory(userId, year, storage) {
  if (!userId || !year || !storage) return null;
  try {
    const id = Number(storage.getItem(keyOf(userId, year)));
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function rememberInventory(userId, year, inventoryId, storage) {
  if (!userId || !year || !storage) return;
  try {
    if (inventoryId) storage.setItem(keyOf(userId, year), String(inventoryId));
    else storage.removeItem(keyOf(userId, year));
  } catch { /* the choice falls back to the most recently updated inventory */ }
}

// The inventories of one reporting year, newest-updated first (the order the server lists them).
export function inventoriesForYear(reports, year) {
  return (Array.isArray(reports) ? reports : []).filter(
    r => r && r.report_id != null && String(r.reporting_year) === String(year));
}

// The inventory to show: the preferred one if it still belongs to the year, else the one the user
// last chose for that year, else the most recently updated one. null when the year has none
// (the server then reads the company's year-level records, as before).
export function pickInventory(reports, year, preferredId = null, rememberedId = null) {
  const list = inventoriesForYear(reports, year);
  if (!list.length) return null;
  for (const want of [preferredId, rememberedId]) {
    const hit = want != null && list.find(r => Number(r.report_id) === Number(want));
    if (hit) return Number(hit.report_id);
  }
  return Number(list[0].report_id);
}

// `?inventory_id=` fragment, or '' when there is none.
export function inventoryQuery(inventoryId) {
  return inventoryId ? `inventory_id=${Number(inventoryId)}` : '';
}
