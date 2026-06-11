# CarbonIQ Workspace — Technical Architecture Note
**Version:** MVP Sprint 3 · June 2026  
**Status:** Baseline locked — do not change ReportField contracts or PendingSuggestion flow  
**Audience:** Engineering team, future contributors adding Scope 3 categories

---

## 1. System Overview

The Workspace is a structured data-collection layer that sits on top of an existing CarbonIQ questionnaire/chatbot system. It introduces a distinct, auditable write path from AI suggestion through to a single-record-per-field storage model.

```
User (chat)            User (dashboard panel)
     │                          │
     ▼                          ▼
WorkspaceChatView          ReportFieldBulkUpsertView
     │                          │
     ▼                          │
PendingSuggestion               │
  (status=pending)              │
     │                          │
  [user reviews]                │
     │                          │
     ├─ Confirm ─────────────►──┤
     │   SuggestionConfirmView  │
     │                          ▼
     └──────────────────► ReportField
                          (single row per field_id, upserted)
```

**Key invariant:** The AI never writes directly to `ReportField`. Every AI extraction goes through `PendingSuggestion` → human approval → `ReportField`. Dashboard saves bypass the suggestion step.

---

## 2. Database Models

### 2.1 `ReportField`
*File: `questionnaire/models.py`*

The single source of truth for every structured data point in a report.

```python
class ReportField(models.Model):
    report      = ForeignKey(CarbonReport)   # owner report
    field_id    = CharField(max_length=100)  # e.g. "rf.3a.consumption"
    value       = JSONField()                # str | int | float | list | dict
    source      = CharField(choices=['chatbot', 'dashboard', 'excel', 'prefill'])
    confidence  = FloatField(null=True)      # 0.0–1.0, set by AI; null for manual
    updated_by  = ForeignKey(User, null=True)
    created_at  = DateTimeField(auto_now_add=True)
    updated_at  = DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['report', 'field_id']   # ← enforced at DB level
        indexes = [Index(fields=['report', 'field_id'])]
```

**`field_id` naming convention:** `rf.<category_code>.<field_name>`

| Segment | Example | Meaning |
|---------|---------|---------|
| `rf` | `rf` | ReportField prefix (fixed) |
| `<category>` | `3a`, `4a`, `k4` | ISO/GHG category code, lowercase |
| `<field>` | `consumption`, `supplier` | snake_case field name |

**`value` field types used in practice:**

| Type | Example | Used by |
|------|---------|---------|
| `int` | `15000` | Consumption quantities |
| `float` | `0.437` | Emission factors |
| `str` | `"natural_gas"` | Fuel types, suppliers, sources |
| `list[dict]` | `[{mode, cargo_t, distance_km, tkm}]` | K4 shipment records |

**Never** change the `unique_together` constraint. It is the guarantee that every `(report, field_id)` pair has exactly one row; all writes are `update_or_create`.

---

### 2.2 `PendingSuggestion`
*File: `questionnaire/models.py`*

Stores an AI extraction that has not yet been committed to `ReportField`.

```python
class PendingSuggestion(models.Model):
    report      = ForeignKey(CarbonReport)
    category    = CharField(max_length=20)    # "3A", "4A", "K4"
    fields      = JSONField()                 # [{field_id, label, value, unit?, confidence}]
    status      = CharField(choices=['pending', 'confirmed', 'rejected', 'edited'])
    confidence  = FloatField(null=True)       # average of field confidences
    created_by  = ForeignKey(User, null=True)
    created_at  = DateTimeField(auto_now_add=True)
    confirmed_at = DateTimeField(null=True)
```

**Status transitions (one-way, enforced by views):**
```
pending ──► confirmed    (SuggestionConfirmView, no edits)
pending ──► edited       (SuggestionConfirmView, with edited field values)
pending ──► rejected     (SuggestionRejectView)
```
Once resolved (confirmed / edited / rejected), a suggestion is immutable. A second confirm/reject on the same ID returns 404.

---

## 3. API Endpoints

Base path: `/api/`

| Method | Path | View | Purpose |
|--------|------|------|---------|
| `GET` | `questionnaire/report-fields/map/?report=<id>` | `ReportFieldMapView` | Load all field values for a report → `{values, meta}` |
| `POST` | `questionnaire/report-fields/bulk-upsert/` | `ReportFieldBulkUpsertView` | Dashboard save — upsert N fields at once |
| `POST` | `chat/workspace/` | `WorkspaceChatView` | Send message → AI extraction → PendingSuggestion |
| `POST` | `chat/suggestions/<id>/confirm/` | `SuggestionConfirmView` | Confirm (optionally with edited values) → writes ReportField |
| `POST` | `chat/suggestions/<id>/reject/` | `SuggestionRejectView` | Reject → no ReportField write |

All endpoints require `IsAuthenticated`. `_get_report()` enforces ownership (`created_by=request.user`).

### 3.1 Map endpoint response shape
```json
{
  "report": 5,
  "values": {
    "rf.3a.fuel_type": "natural_gas",
    "rf.3a.consumption": 15000,
    "rf.4a.consumption_kwh": 18000
  },
  "meta": {
    "rf.3a.fuel_type": {"source": "chatbot", "confidence": 0.95, "updated_at": "..."}
  }
}
```

### 3.2 Bulk-upsert request shape
```json
{
  "report": 5,
  "fields": [
    {"field_id": "rf.4a.consumption_kwh", "value": 18000, "source": "dashboard"},
    {"field_id": "rf.4a.supplier",        "value": "TEDAŞ", "source": "dashboard"}
  ]
}
```
Fields with `value: null` or `value: ""` are silently skipped.

---

## 4. Category Registry

### 4.1 Backend: `CATEGORY_SCHEMAS`
*File: `questionnaire/workspace_views.py`*

All categories the AI can extract into are registered here:

```python
CATEGORY_SCHEMAS = {
    '3A': {
        'label': 'Stationary Combustion',
        'fields': [
            {'field_id': 'rf.3a.fuel_type',   'label': 'Fuel type',   'type': 'string'},
            {'field_id': 'rf.3a.consumption', 'label': 'Consumption', 'type': 'number'},
            {'field_id': 'rf.3a.unit',        'label': 'Unit',        'type': 'string'},
            {'field_id': 'rf.3a.facility',    'label': 'Facility',    'type': 'string'},
        ],
    },
    '4A': { ... },   # 8 fields — see workspace_views.py
    'K4': { ... },   # 6 fields including rf.k4.shipments (array)
}
```

The AI receives this schema verbatim in every system prompt. Fields not listed here **cannot** be extracted by the AI; they must be added to `CATEGORY_SCHEMAS` first.

### 4.2 Backend: `FIELD_HUMAN_LABELS`
Human-readable labels for each field, used in `_context_summary()` which feeds the AI's context about already-entered data. Must be kept in sync with `CATEGORY_SCHEMAS`.

### 4.3 Frontend: `REQUIRED_FIELDS`
*File: `src/lib/workspace/api.js`*

Determines `complete / in_progress / missing` status per category:

```js
export const REQUIRED_FIELDS = {
  '3A': ['rf.3a.fuel_type', 'rf.3a.consumption', 'rf.3a.unit'],
  '4A': ['rf.4a.consumption_kwh', 'rf.4a.supplier'],
  'K4': ['rf.k4.shipments', 'rf.k4.total_emission_kgco2e'],
};
```

A field is considered filled when its value is not `undefined`, `null`, `""`, or an empty array `[]`.

### 4.4 Frontend: `CATEGORIES` array
*File: `src/app/dashboard/workspace/page.jsx`*

Controls the sidebar, category cards, and emission estimate routing:

```js
const CATEGORIES = [
  { id: '3A', scope: 1, icon: Flame, color: '...', label: {...}, desc: {...}, efField: '...', ... },
  { id: '4A', scope: 2, icon: Zap,   ... },
  { id: 'K4', scope: 3, icon: Truck, ... },
];
```

### 4.5 Currently supported categories

| ID | ISO ref | Scope | Emission source | EF used | Panel component |
|----|---------|-------|-----------------|---------|-----------------|
| 3A | §5.2 Stationary Combustion | 1 | Fuel combustion (gas, oil, diesel, LPG, coal) | DEFRA 2023 | `StationaryCombustionPanel` |
| 4A | §5.3 Purchased Electricity | 2 | Grid electricity | IEA 2023 (location-based) | `ElectricityPanel` |
| K4 | ISO 14083 / Scope 3 Cat.4 | 3 | Upstream transport (road, rail, sea, air) | GLEC Framework v3 | `UpstreamTransportPanel` |

---

## 5. AI Extraction Flow

### 5.1 WorkspaceChatView — request lifecycle

```
POST /api/chat/workspace/  { report, message }
 │
 ├─ _get_report()          — ownership check
 ├─ _context_summary()     — load existing ReportFields as text context
 ├─ EXTRACTION_SYSTEM_PROMPT.format(context, schemas)
 │
 ├─ Groq API call          — model: llama-3.3-70b-versatile
 │   temperature: 0.2, max_tokens: 1200
 │
 ├─ Parse JSON response    — strip markdown fences if present
 │   { reply, suggestions: [{category, confidence, fields}] }
 │
 ├─ Pick best suggestion   — max(confidence) if multiple categories
 ├─ PendingSuggestion.objects.create()
 │
 └─ Response: { reply, suggestion: {id, category, fields, confidence, ...} }
```

**Groq model selection rationale:** `llama-3.3-70b-versatile` at temperature 0.2 was chosen for deterministic structured extraction. Do not raise temperature; higher values produce inconsistent JSON.

### 5.2 SuggestionConfirmView — commit lifecycle

```
POST /api/chat/suggestions/<id>/confirm/  { fields?: [...] }
 │
 ├─ PendingSuggestion.objects.get(id, status=PENDING, report__created_by=user)
 │
 ├─ If edited_fields provided:
 │    ├─ _coerce_value(new_val, original_val)  — HTML inputs are always strings;
 │    │   coerce back to int/float if original was numeric
 │    └─ suggestion.status = EDITED
 │
 ├─ Else: suggestion.status = CONFIRMED
 │
 ├─ suggestion.confirmed_at = now()
 ├─ suggestion.save()
 │
 └─ For each field in fields_to_save:
      ReportField.objects.update_or_create(
          report=suggestion.report,
          field_id=fid,
          defaults={value, source='chatbot', confidence, updated_by}
      )
```

### 5.3 Extraction prompt strategy

The system prompt (in `EXTRACTION_SYSTEM_PROMPT`) is structured in five sections:

| Section | Purpose |
|---------|---------|
| **Number normalisation** | Turkish `.` thousand separator, `k`/`M` suffix expansion, always numeric |
| **Unit synonyms & conversions** | MWh→kWh×1000, m³ variants, litre variants, tonne variants |
| **Fuel type mapping** | `motorin→diesel`, `doğalgaz→natural_gas`, `kömür→coal`, etc. |
| **Transport mode mapping** | `TIR/tır/kamyon→road`, `tren→rail`, `hava kargo→air`, `gemi→sea` |
| **Extraction rules** | Passive voice handling, multi-fuel resolution, renewable deduction, pre-aggregated tkm |
| **Few-shot examples** | 5 concrete input→output pairs covering known edge cases |

The full prompt is sent as the `system` message. The user's text is the `user` message. No conversation history is maintained between messages (stateless per-call).

**Context injection:** `_context_summary()` builds a text list of existing `ReportField` values (up to 40 fields) and injects it into the prompt. This prevents the AI from re-extracting data that already exists unless the user explicitly changes it.

### 5.4 Confidence scoring

- **Field-level confidence** (`f.confidence`): 0.0–1.0, set by the AI per extracted field
- **Suggestion-level confidence** (`suggestion.confidence`): arithmetic mean of all field confidences
- **Threshold for inclusion:** only fields with confidence > 0.5 are included in a suggestion
- **Display:** green ≥ 85%, amber ≥ 65%, red < 65%

---

## 6. Frontend Architecture

### 6.1 State flow in `WorkspacePage`

```
loadFields()
  ├─ GET /api/questionnaire/report-fields/map/
  ├─ setFieldValues(values)           — flat {field_id: value} map
  └─ setStatuses({3A: 'complete', …}) — computed via getCategoryStatus()

handleFieldsSaved()   (called by any panel or ChatWorkspace on save/confirm)
  ├─ setRefreshing(true)
  ├─ await loadFields()               — re-fetches all fields from API
  └─ setRefreshing(false)
```

`fieldValues` is the single shared state object. All panels receive it as a prop and sync via `useEffect`. This means any save — whether from Dashboard or Chat — triggers a full re-fetch, and all panels auto-fill.

### 6.2 Panel contract

Every panel receives:

```js
{ reportId, fieldValues, lang, onSaved }
```

- `fieldValues`: the full flat map from the API — panels read their own keys
- `onSaved`: callback to trigger `loadFields()` on the parent — panels call this after any successful save
- Panels must not call `loadFields()` directly; they call `onSaved()`

### 6.3 Emission estimate — `estimateEmissionKg(catId, vals)`

Client-side only, used for live display in cards and sidebar. **Not authoritative** — it is an estimate shown before the user saves.

| Category | Calculation |
|----------|-------------|
| 3A | `consumption × DEFRA_EF[fuel_type][unit]` |
| 4A | `max(consumption_kwh − renewable_on_site, 0) × emission_factor` |
| K4 | `total_emission_kgco2e` (read directly from stored field) |

---

## 7. Known Limitations (MVP Baseline)

| # | Description | Impact | Notes |
|---|-------------|--------|-------|
| L1 | 4A: emission factor not AI-extracted — user selects grid preset manually | Low | AI lacks EF in "18000 kWh" input; needs IEA lookup integration |
| L2 | K4: AI transport mode assignment may use generic `entry_method` only — GLEC mode code not always extracted | Low | Dashboard flow is clean; K4 AI is supplementary |
| L3 | Single-facility per report — no multi-location support | Medium | `rf.3a.facility` is one string field, not a list |
| L4 | Panel UI hidden below 1280px (xl breakpoint only) | Medium | Full responsive layout is post-MVP |
| L5 | Language hardcoded Turkish (`const [lang] = useState('tr')`) | Low | No toggle exposed in UI |
| L6 | `_context_summary()` truncates at 40 fields — reports with many categories lose older context | Low | Increase limit or paginate when ≥5 categories |
| L7 | No bulk-delete endpoint for ReportField — only `demo_seed.py reset` | Low | Acceptable for MVP; add admin action if needed |
| L8 | `CarbonReport.reporting_year` is null for demo report | Cosmetic | Set during report creation step |

---

## 8. Adding a New Scope 3 Category (Onboarding Guide)

This is the exact sequence used to build 3A, 4A, and K4. Follow it in order; do not skip steps.

### Step 1 — Define field IDs

Choose a category code (e.g. `K5` for downstream transport). All field IDs follow:
```
rf.<code_lowercase>.<field_name>
```
Example: `rf.k5.shipments`, `rf.k5.total_emission_kgco2e`

Rule: field IDs are **immutable** once any `ReportField` row exists in production with that ID.

---

### Step 2 — Register in `CATEGORY_SCHEMAS` (backend)

*File: `questionnaire/workspace_views.py`*

```python
CATEGORY_SCHEMAS['K5'] = {
    'label': 'Downstream Transport (Scope 3 Cat.9)',
    'fields': [
        {'field_id': 'rf.k5.entry_method',          'label': 'Data entry method',   'type': 'string'},
        {'field_id': 'rf.k5.shipments',             'label': 'Shipment records',    'type': 'array'},
        {'field_id': 'rf.k5.total_tkm',             'label': 'Total tonne-km',      'type': 'number'},
        {'field_id': 'rf.k5.total_emission_kgco2e', 'label': 'Total emission (kgCO₂e)', 'type': 'number'},
        # add more as needed
    ],
}
```

---

### Step 3 — Add human labels to `FIELD_HUMAN_LABELS` (backend)

*Same file.* These appear in the AI context summary:

```python
FIELD_HUMAN_LABELS['rf.k5.total_tkm']             = 'Scope 3 / K5 — Total tonne-km'
FIELD_HUMAN_LABELS['rf.k5.total_emission_kgco2e'] = 'Scope 3 / K5 — Total emission (kgCO2e)'
```

---

### Step 4 — Add required fields for status computation (frontend)

*File: `src/lib/workspace/api.js`*

```js
export const REQUIRED_FIELDS = {
  // existing…
  'K5': ['rf.k5.shipments', 'rf.k5.total_emission_kgco2e'],
};
```

Array fields must not be empty to count as filled (already handled by `getCategoryStatus`).

---

### Step 5 — Add to `CATEGORIES` array (frontend)

*File: `src/app/dashboard/workspace/page.jsx`*

```js
{
  id: 'K5', scope: 3,
  icon: Package,                         // import from lucide-react
  color: 'text-purple-500', bg: 'bg-purple-50',
  label: { tr: 'Downstream Taşıma', en: 'Downstream Transport' },
  desc:  { tr: 'Kapsam 3 · Kategori 9', en: 'Scope 3 · Category 9' },
  emissionField: 'rf.k5.total_emission_kgco2e',
}
```

Also add to `SCOPE_GROUPS`:
```js
{ id: 3, label: {...}, cats: ['K4', 'K5'] }   // add K5 to Scope 3
```

---

### Step 6 — Build the panel component

Create: `src/components/workspace/panels/DownstreamTransportPanel.jsx`

Follow the pattern of `UpstreamTransportPanel.jsx`:
- Props: `{ reportId, fieldValues, lang, onSaved }`
- Local state synced from `fieldValues` via `useEffect([fieldValues])`
- `saving` / `saved` / `saveError` states
- `onSaved()` called after successful `saveReportFields()`

---

### Step 7 — Route in `DataEntryPanel`

*File: `src/app/dashboard/workspace/page.jsx`*

```js
if (categoryId === 'K5') return <DownstreamTransportPanel ... />;
```

---

### Step 8 — Add emission factor logic in `estimateEmissionKg`

*Same file.* Mirror the K4 pattern if using stored total:
```js
if (catId === 'K5') {
  const kg = parseFloat(vals['rf.k5.total_emission_kgco2e']);
  if (!isNaN(kg)) return kg;
}
```

---

### Step 9 — Add QA test cases

- Add 2–3 test cases to `qa_extraction_hardening.py` for the new category (TR, EN, Mixed)
- Run `qa_stabilization.py` to confirm no regression on 3A, 4A, K4
- Add K5 to the `qa_stabilization.py` cross-cutting independence checks

---

### Step 10 — No migration needed

`ReportField` and `PendingSuggestion` are schema-agnostic. New categories are pure configuration changes — no Django migrations, no database schema changes. The `field_id` column is a free-form string and `value` is a JSONField.

---

## 9. File Index

| File | Purpose |
|------|---------|
| `questionnaire/models.py` | `ReportField`, `PendingSuggestion`, `CarbonReport` model definitions |
| `questionnaire/workspace_views.py` | All workspace API views, `CATEGORY_SCHEMAS`, `EXTRACTION_SYSTEM_PROMPT`, `_coerce_value` |
| `questionnaire/urls.py` | URL routing for ReportField endpoints |
| `chat/urls.py` | URL routing for workspace chat + suggestion lifecycle |
| `carbonless_api/urls.py` | Root URL config: `/api/questionnaire/` + `/api/chat/` |
| `demo_seed.py` | Local dev: reset / seed / status for demo report |
| `qa_stabilization.py` | 50-check regression suite for 3A + 4A + K4 |
| `qa_extraction_hardening.py` | 30 phrase variant tests, static analysis + live Groq mode |
| `DEMO_SCRIPT.md` | Client walkthrough script with exact values and commands |
| `src/lib/workspace/api.js` | `REQUIRED_FIELDS`, `getCategoryStatus`, API call helpers |
| `src/app/dashboard/workspace/page.jsx` | Main workspace page: state, sidebar, cards, mode switch |
| `src/components/workspace/ChatWorkspace.jsx` | Chat UI, suggestion rendering, confirm/reject handlers |
| `src/components/workspace/SuggestionReviewCard.jsx` | Suggestion card with confidence badge, edit, confirm, reject |
| `src/components/workspace/panels/StationaryCombustionPanel.jsx` | 3A panel (DEFRA 2023) |
| `src/components/workspace/panels/ElectricityPanel.jsx` | 4A panel (IEA 2023 grid presets) |
| `src/components/workspace/panels/UpstreamTransportPanel.jsx` | K4 panel (GLEC v3, multi-shipment) |
