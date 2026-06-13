/**
 * Workspace API helpers — ReportField data layer + AI suggestion flow.
 * All functions use the existing `api` util for auth + base URL.
 */
import { api } from '@/lib/utils/api';

// ── ReportField ─────────────────────────────────────────────────────────────

/**
 * Fetch all saved field values for a report.
 * @returns {{ values: Object, meta: Object }}
 */
export async function getReportFields(reportId) {
  const res = await api(`/questionnaire/report-fields/map/?report=${reportId}`);
  if (!res.ok) throw new Error('Failed to load report fields');
  return res.json();
}

/**
 * Save / update one or many fields for a report.
 * @param {number} reportId
 * @param {Array<{field_id: string, value: any, source?: string}>} fields
 */
export async function saveReportFields(reportId, fields, source = 'dashboard') {
  const payload = {
    report: reportId,
    fields: fields.map(f => ({ source, ...f })),
  };
  const res = await api('/questionnaire/report-fields/bulk-upsert/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save report fields');
  return res.json();
}

// ── Workspace Chat ───────────────────────────────────────────────────────────

/**
 * Send a message to the AI workspace assistant.
 * Returns { reply, suggestion } — suggestion is a PendingSuggestion object or null.
 */
export async function sendWorkspaceChatMessage(reportId, message) {
  const res = await api('/chat/workspace/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report: reportId, message }),
  });
  if (!res.ok) throw new Error('AI request failed');
  return res.json();
}

// ── Suggestion lifecycle ─────────────────────────────────────────────────────

/**
 * Confirm a PendingSuggestion (optionally with edited field values).
 * After confirm, ReportField rows are created/updated by the backend.
 * @param {number} suggestionId
 * @param {Array|null} editedFields — optional override list [{field_id, value}]
 */
export async function confirmSuggestion(suggestionId, editedFields = null) {
  const body = editedFields ? { fields: editedFields } : {};
  const res = await api(`/chat/suggestions/${suggestionId}/confirm/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to confirm suggestion');
  return res.json();
}

/**
 * Reject a PendingSuggestion.
 */
export async function rejectSuggestion(suggestionId) {
  const res = await api(`/chat/suggestions/${suggestionId}/reject/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Failed to reject suggestion');
  return res.json();
}

// ── Category status helpers ──────────────────────────────────────────────────

/** Required field IDs per category for status computation */
export const REQUIRED_FIELDS = {
  '3A': ['rf.3a.fuel_type', 'rf.3a.consumption', 'rf.3a.unit'],
  '4A': ['rf.4a.consumption_kwh', 'rf.4a.supplier'],
  'K4': ['rf.k4.shipments', 'rf.k4.total_emission_kgco2e'],
  'K5': ['rf.k5.total_emission_kgco2e'],
};

/**
 * Compute status string for a category given current field values.
 * @returns {'complete'|'in_progress'|'missing'}
 */
export function getCategoryStatus(categoryId, fieldValues) {
  const required = REQUIRED_FIELDS[categoryId] || [];
  if (required.length === 0) return 'missing';
  const filled = required.filter(fid => {
    const v = fieldValues[fid];
    // Empty arrays count as unfilled (e.g. rf.k4.shipments = [])
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  });
  if (filled.length === 0) return 'missing';
  if (filled.length === required.length) return 'complete';
  return 'in_progress';
}
