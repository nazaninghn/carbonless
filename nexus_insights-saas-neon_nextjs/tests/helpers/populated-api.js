/**
 * Populated API fixtures — tests/helpers/populated-api.js
 *
 * A realistic, data-rich stand-in for the Django backend, so layout tests see what a real company sees: KPI numbers, a monthly
 * trend, facilities with long names, dozens of entries, several inventories, targets, team members, notifications and chat
 * conversations with long messages. Everything is served by Playwright's request interception: no real backend, database or
 * user data is touched, and nothing is written anywhere.
 *
 * Usage:
 *   import { mockPopulatedApi } from '../helpers/populated-api.js';
 *   await mockPopulatedApi(page);      // instead of mockDjangoApi(page)
 *   await seedAuth(page);              // from mock-api.js
 *
 * The strings are deliberately long in places (company, facility and member names, an e-mail address, chat messages) because
 * that is where layouts break. All figures are ILLUSTRATIVE test values, not emission factors or results of any calculation.
 */

const YEAR = 2025;
const MONTH_KG = [152300, 148100, 161800, 149900, 153200, 160700, 171400, 168900, 157300, 150600, 146200, 149600];   // 12 months

const FACILITIES = [
  { id: 1, company: 1, name: 'Gebze Üretim Tesisi — Hat 2 ve Boya Atölyesi', address: 'Gebze Organize Sanayi Bölgesi, 1. Cadde No: 14', city: 'Kocaeli', country: 'TR', facility_type: 'factory', grid_connection: 'transmission', proposed_grid_connection: null, is_active: true, created_at: '2025-01-10T09:00:00Z', entry_count: 14 },
  { id: 2, company: 1, name: 'İzmir Lojistik ve Dağıtım Merkezi', address: 'Kemalpaşa OSB', city: 'İzmir', country: 'TR', facility_type: 'warehouse', grid_connection: 'distribution', proposed_grid_connection: null, is_active: true, created_at: '2025-01-10T09:05:00Z', entry_count: 8 },
  { id: 3, company: 1, name: 'Head Office', address: 'Levent, Büyükdere Cd. 201', city: 'İstanbul', country: 'TR', facility_type: 'office', grid_connection: 'distribution', proposed_grid_connection: null, is_active: true, created_at: '2025-01-10T09:10:00Z', entry_count: 6 },
];

const FACTORS = Array.from({ length: 24 }, (_, i) => ({
  id: 100 + i, name: ['Natural gas', 'Diesel (road)', 'Electricity — grid', 'LPG', 'Purchased steel', 'Coal', 'Steam purchased', 'Refrigerant R410A'][i % 8] + (i >= 8 ? ` (variant ${Math.floor(i / 8)})` : ''),
  name_tr: ['Doğal gaz', 'Dizel (karayolu)', 'Elektrik — şebeke', 'LPG', 'Satın alınan çelik', 'Kömür', 'Satın alınan buhar', 'Soğutucu akışkan R410A'][i % 8],
  slug: `factor-${i}`, scope: ['scope1', 'scope1', 'scope2', 'scope1', 'scope3', 'scope1', 'scope2', 'scope1'][i % 8], category: ['stationary_combustion', 'mobile_combustion', 'electricity', 'stationary_combustion', 'purchased_goods', 'stationary_combustion', 'steam_heat', 'fugitive_emissions'][i % 8],
  country: i % 2 ? 'turkey' : 'global', unit: ['m3', 'liters', 'kwh', 'kg', 'tonne', 'tonne', 'gj', 'kg'][i % 8], factor_kg_co2e: 0.2 + i * 0.037, year: 2024, is_default: true,
  source: 'Illustrative test factor', reference: 'test fixture', is_active: true, method: '', is_yearly: false,
}));

// The stored values of the real API: `scope` is 'scope1' | 'scope2' | 'scope3' (EmissionFactor.SCOPE_CHOICES) and `status` is
// 'submitted' | 'approved' | 'draft' (EmissionEntry.STATUS_CHOICES). The Emissions tab totals only approved entries.
export const ENTRIES = Array.from({ length: 28 }, (_, i) => {
  const f = FACTORS[i % 8]; const fac = FACILITIES[i % 3]; const qty = 800 + i * 137;
  return {
    id: 500 + i, emission_factor: f.id, emission_factor_name: f.name, emission_factor_name_tr: f.name_tr, scope: f.scope, category: f.category, unit: f.unit,
    country: f.country, year: YEAR, month: (i % 12) + 1, quantity: qty, calculated_co2e_kg: Math.round(qty * f.factor_kg_co2e * 100) / 100,
    calculated_co2e_tonne: Math.round(qty * f.factor_kg_co2e) / 1000, factor_year_used: 2024, source_dataset: 'Test', factor_value_snapshot: f.factor_kg_co2e, factor_source_snapshot: 'Test',
    description: i % 5 === 0 ? 'Monthly invoice for the second production line, including the paint shop and the compressed-air plant' : '', facility: fac.id, facility_name: fac.name,
    proof_document: null, status: i % 9 === 0 ? 'submitted' : 'approved', approved_at: null, rejected_reason: '', created_at: '2025-02-01T10:00:00Z', updated_at: '2025-02-01T10:00:00Z',
    entered_by: 'aylin.demir', is_mine: true, proof_available: false, questionnaire_source: false, inventory_id: 1, calc_detail: null, question_number: null,
    replaces: null, removed_by_change: false, replaces_entry: null, delete_requested: false, change_batch: null, change_question: null, facility_country: 'TR', factor_country_mismatch: false,
  };
});

const SCOPE3 = [
  ['purchased_goods', 1, 'Purchased goods and services', 'Satın alınan mal ve hizmetler', 241000],
  ['capital_goods', 2, 'Capital goods', 'Sermaye malları', 38000],
  ['fuel_energy', 3, 'Fuel- and energy-related activities', 'Yakıt ve enerji ile ilgili faaliyetler', 52000],
  ['upstream_transport', 4, 'Upstream transportation and distribution', 'Yukarı akış taşıma ve dağıtım', 96000],
  ['waste', 5, 'Waste generated in operations', 'Operasyonlarda oluşan atık', 21000],
  ['business_travel', 6, 'Business travel', 'İş seyahatleri', 14000],
  ['employee_commuting', 7, 'Employee commuting', 'Çalışan ulaşımı', 33000],
  ['upstream_leased', 8, 'Upstream leased assets', 'Yukarı akış kiralanan varlıklar', 0],
  ['downstream_transport', 9, 'Downstream transportation and distribution', 'Aşağı akış taşıma ve dağıtım', 88000],
  ['processing_sold', 10, 'Processing of sold products', 'Satılan ürünlerin işlenmesi', 0],
  ['use_of_sold', 11, 'Use of sold products', 'Satılan ürünlerin kullanımı', 0],
  ['end_of_life', 12, 'End-of-life treatment of sold products', 'Satılan ürünlerin ömür sonu', 29000],
  ['downstream_leased', 13, 'Downstream leased assets', 'Aşağı akış kiralanan varlıklar', 0],
  ['franchises', 14, 'Franchises', 'Franchise', 0],
  ['investments', 15, 'Investments', 'Yatırımlar', 0],
].map(([category, ghg_number, name_en, name_tr, total_co2e_kg]) => ({ category, ghg_number, name_en, name_tr, total_co2e_kg }));

const SCOPE1 = 520300, SCOPE2 = 710400;
const SCOPE3_TOTAL = SCOPE3.reduce((n, c) => n + c.total_co2e_kg, 0);
const TOTAL = SCOPE1 + SCOPE2 + SCOPE3_TOTAL;

export const SUMMARY = {
  year: YEAR, total_kg: TOTAL, total_tonne: TOTAL / 1000,
  previous_year_change: { previous_year: YEAR - 1, previous_kg: TOTAL * 1.081, current_kg: TOTAL, change_pct: -7.5, months: 12 },
  avoided_credit: { total_kg: 0, entries: 0 }, not_counted: { pending: { entries: 3, total_kg: 4120 }, rejected: { entries: 0, total_kg: 0 } },
  inventory_id: 1, unassigned_records: { entries: 0, total_kg: 0 },
  scope1_kg: SCOPE1, scope2_kg: SCOPE2, scope3_kg: SCOPE3_TOTAL, scope1_tonne: SCOPE1 / 1000, scope2_tonne: SCOPE2 / 1000, scope3_tonne: SCOPE3_TOTAL / 1000,
  monthly: MONTH_KG.map((kg, i) => ({ month: i + 1, total_kg: kg })), annual_kg: 0,
  by_facility: [{ facility_id: 1, facility_name: FACILITIES[0].name, total_kg: 912000 }, { facility_id: 2, facility_name: FACILITIES[1].name, total_kg: 401000 }, { facility_id: 3, facility_name: 'Head Office', total_kg: 168000 }],
  unassigned_kg: 0,
  by_category: [{ category: 'stationary_combustion', total_kg: 301000 }, { category: 'mobile_combustion', total_kg: 142000 }, { category: 'electricity', total_kg: 710400 }, { category: 'fugitive_emissions', total_kg: 77300 }],
  scope3_by_category: SCOPE3, custom_emissions: { approved_total_kg: 0, pending_count: 1 },
  questionnaire_profile: null, company_profile: { nace_code: 'C', employee_band: '251–500' },
  inventory_in_progress: false, years_with_data: [YEAR, YEAR - 1],
};

const REPORTS = [
  { report_id: 1, title: 'Annual inventory 2025 — group consolidation, all production sites and the head office', status: 'completed', reporting_year: 2025, current_step: 'DONE', progress: { percent: 100, completed: 98, total: 98 }, updated_at: '2026-02-03T10:00:00Z', created_by: 'aylin.demir' },
  { report_id: 2, title: 'Inventory 2024', status: 'completed', reporting_year: 2024, current_step: 'DONE', progress: { percent: 100, completed: 98, total: 98 }, updated_at: '2025-02-10T10:00:00Z', created_by: 'aylin.demir' },
  { report_id: 3, title: 'Draft 2026', status: 'in_progress', reporting_year: 2026, current_step: 'B5', progress: { percent: 34, completed: 33, total: 98 }, updated_at: '2026-10-01T10:00:00Z', created_by: 'aylin.demir' },
  { report_id: 4, title: 'Pilot — Gebze plant only', status: 'in_progress', reporting_year: 2025, current_step: 'B5', progress: { percent: 12, completed: 11, total: 98 }, updated_at: '2026-09-12T10:00:00Z', created_by: 'mehmet.kaya' },
];

const MEMBERS = [
  { id: 1, company: 1, user: 1, username: 'aylin.demir', user_email: 'aylin.demir@anadolu-celik-sanayi.example', full_name: 'Aylin Demir', role: 'owner', is_active: true, invited_by: null, created_at: '2025-01-01T00:00:00Z' },
  { id: 2, company: 1, user: 2, username: 'mehmet.kaya', user_email: 'mehmet.kaya@anadolu-celik-sanayi.example', full_name: 'Mehmet Kaya', role: 'admin', is_active: true, invited_by: 1, created_at: '2025-01-05T00:00:00Z' },
  { id: 3, company: 1, user: 3, username: 'z', user_email: 'a.very.long.address.for.testing.the.layout@a-rather-long-company-domain-name.example.com', full_name: 'Zeynep Aydın-Yıldırım Özkaya', role: 'data_entry', is_active: true, invited_by: 1, created_at: '2025-02-05T00:00:00Z' },
  { id: 4, company: 1, user: 4, username: 'auditor1', user_email: 'audit@external-verifier.example', full_name: 'External Auditor', role: 'auditor', is_active: true, invited_by: 1, created_at: '2025-03-05T00:00:00Z' },
];

const NOTIFICATIONS = Array.from({ length: 7 }, (_, i) => ({
  id: i + 1, notification_type: ['entry_approved', 'entry_rejected', 'invite', 'report_ready'][i % 4], title: ['Entry approved', 'An entry needs your attention', 'New team member', 'Your report is ready'][i % 4],
  message: i % 2 ? 'The natural gas entry for the Gebze Üretim Tesisi — Hat 2 ve Boya Atölyesi was rejected: the invoice attachment is unreadable, please upload it again.' : 'All good.',
  is_read: i > 2, created_at: `2026-10-0${(i % 7) + 1}T10:00:00Z`, link: '/dashboard?tab=emissions',
}));

const TARGETS = [
  { id: 1, user: 1, company: 1, title: 'Cut Scope 1 and 2 by 30% against the 2023 baseline, with the paint shop moving to electric curing', description: 'Board-approved target.', base_year: 2023, target_year: 2030, inventory: null, base_emissions_kg: 1900000, target_reduction_percent: 30, status: 'active', created_at: '2025-03-01T00:00:00Z' },
  { id: 2, user: 1, company: 1, title: 'Net zero', description: '', base_year: 2024, target_year: 2045, inventory: null, base_emissions_kg: 1990000, target_reduction_percent: 90, status: 'active', created_at: '2025-03-02T00:00:00Z' },
];

const CHAT_SESSIONS = [
  { id: 11, title: 'Natural gas for the Gebze plant', created_at: '2026-10-05T10:00:00Z', updated_at: '2026-10-05T10:30:00Z', message_count: 6 },
  { id: 12, title: 'A conversation with a very long title that keeps going to see what the sidebar does with it', created_at: '2026-10-04T10:00:00Z', updated_at: '2026-10-04T10:30:00Z', message_count: 2 },
  { id: 13, title: 'New Chat', created_at: '2026-10-03T10:00:00Z', updated_at: '2026-10-03T10:30:00Z', message_count: 0 },
];
const LONG = 'We consumed 48,250 m³ of natural gas at the Gebze Üretim Tesisi — Hat 2 ve Boya Atölyesi in March, and the invoices also show 1,200 litres of diesel for the forklifts, plus an electricity bill of 212,400 kWh that includes the compressed-air plant and the paint-shop curing ovens. Please add all three to the 2025 inventory and tell me what is still missing before the report can be generated.';
const CHAT_MESSAGES = [
  { id: 1, role: 'user', content: 'Hi' },
  { id: 2, role: 'assistant', content: 'Hello! I can help you add emission data, check your totals and prepare your ISO 14064-1 report. What would you like to do?' },
  { id: 3, role: 'user', content: LONG },
  { id: 4, role: 'assistant', content: 'Thanks. I found three activities in your message:\n\n1. Natural gas — 48,250 m³ (Scope 1, stationary combustion)\n2. Diesel — 1,200 litres (Scope 1, mobile combustion)\n3. Electricity — 212,400 kWh (Scope 2)\n\nA long unbroken token to test wrapping: ' + 'x'.repeat(120) + '\n\nShall I save these?' },
  { id: 5, role: 'user', content: 'Yes, please save them.', has_attachment: true, attachment_name: 'gebze-march-invoices-natural-gas-diesel-electricity-final-v3.pdf' },
  { id: 6, role: 'assistant', content: 'Saved. Your inventory now has 28 entries.' },
];

/** Registers the populated stand-in for the backend on `page`. */
export async function mockPopulatedApi(page, { chat = true } = {}) {
  await page.route('http://localhost:8000/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/api/, '');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p.startsWith('/accounts/profile')) return json({ id: 1, username: 'aylin.demir', email: 'aylin.demir@anadolu-celik-sanayi.example', first_name: 'Aylin', last_name: 'Demir', is_staff: false, phone: '+90 212 555 0100', department: 'Sustainability' });
    if (p.startsWith('/accounts/notifications/unread-count')) return json({ unread_count: 3 });
    if (p.startsWith('/accounts/notifications')) return json(NOTIFICATIONS);
    if (p.startsWith('/emissions/summary')) return json(SUMMARY);
    if (p.startsWith('/emissions/entries')) return json({ results: ENTRIES, count: ENTRIES.length });
    if (p.startsWith('/emissions/factors')) return json(FACTORS);
    if (p.startsWith('/emissions/targets')) return json(TARGETS);
    if (p.startsWith('/emissions/scope3-categories')) return json(SCOPE3.map(c => ({ key: c.category, ...c })));
    if (p.startsWith('/emissions/custom-requests')) return json([{ id: 1, username: 'aylin.demir', scope: 'scope1', category_name: 'Process emissions', source_name: 'Paint shop curing oven, a source that is not in the factor list', description: 'Pending review', unit: 'kg', quantity: 1200, year: YEAR, month: 3, facility: 1, status: 'pending', admin_notes: '', approved_factor_kg_co2e: null, calculated_co2e_kg: null, linked_entry: null, electricity_method: '', created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' }]);
    if (p.startsWith('/companies/facilities')) return json(FACILITIES);
    if (p.startsWith('/companies/memberships')) return json(MEMBERS);
    if (p.startsWith('/companies/invites')) return json([{ id: 1, email: 'new.colleague.with.a.long.address@anadolu-celik-sanayi.example', role: 'data_entry', status: 'pending', created_at: '2026-10-01T00:00:00Z' }]);
    if (p.startsWith('/companies/my-companies')) return json([{ id: 1, name: 'Anadolu Çelik Sanayi ve Ticaret Anonim Şirketi', legal_entity_name: 'Anadolu Çelik Sanayi ve Ticaret Anonim Şirketi', role: 'owner', is_current: true }]);
    if (p.startsWith('/companies/detail')) return json({ id: 1, legal_entity_name: 'Anadolu Çelik Sanayi ve Ticaret Anonim Şirketi', tax_number: '1234567890', country_of_headquarters: 'TR', countries_of_operation: ['TR'], nace_code: 'NACE_C', main_activity_description: 'Steel fabrication, painting and logistics for the automotive and white-goods industries.', registered_address: 'Gebze Organize Sanayi Bölgesi, 1. Cadde No: 14, Kocaeli', telephone: '+90 262 555 0100', website: 'https://anadolu-celik-sanayi.example', number_of_employees: 420, annual_turnover_range: '100M-1B', number_of_facilities: 3, has_overseas_operations: false, number_of_subsidiaries: 0 });
    if (chat) {
      if (/^\/chat\/sessions\/new\//.test(p)) return json({ id: 99, title: 'New Chat', created_at: '2026-11-06T10:00:00Z', updated_at: '2026-11-06T10:00:00Z', message_count: 0 });
      if (/^\/chat\/sessions\/\d+\/message\//.test(p)) return json({ id: 1000 + Math.floor(Math.random() * 1e6), role: 'assistant', content: 'This is a reply to your message. ' + 'It is intentionally long so that the conversation layout has to wrap and scroll. '.repeat(4) + '\n\n- First point of a list\n- Second point with a rather long explanation that continues over more than one line on a narrow phone screen\n- Third point' });
      if (/^\/chat\/sessions\/\d+\//.test(p)) return json({ id: Number(p.split('/')[3]), title: 'Natural gas for the Gebze plant', messages: CHAT_MESSAGES });
      if (/^\/chat\/sessions\//.test(p)) return json(CHAT_SESSIONS);
    }
    if (p === '/questionnaire/') return json({ reports: REPORTS });
    const rm = p.match(/^\/questionnaire\/(\d+)\/$/);
    if (rm) { const r = REPORTS.find(x => x.report_id === Number(rm[1])); return r ? json({ ...r, answers: { A1: { answer: 'Alpha' }, A2: { answer: 'x' }, A3: { answer: 'x' }, A4: { answer: '2025' }, A5: { answer: 'x' }, A6: { answer: 'x' }, A7: { answer: 'no' }, B1: { answer: 'NACE_A' }, B2: { answer: 'Makes things' } }, completed_steps: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'B1', 'B2'], advisor_rejected: [], advisor_pending: 0, pending_questions: [] }) : json({ error: 'not found' }, 404); }
    return json([]);
  });
}

export const FIXTURE_NOTES = { year: YEAR, entries: ENTRIES.length, facilities: FACILITIES.length, inventories: REPORTS.length, members: MEMBERS.length, chatSessions: CHAT_SESSIONS.length };
