# CLAUDE.md

Instructions for Claude (and other AI assistants) working on **Carbonless**. Follow these for every session in this repository unless explicitly overridden.

## What Carbonless is

Carbonless helps companies **measure, report, and reduce** their greenhouse-gas (GHG) emissions in compliance with **ISO 14064-1** and the **GHG Protocol**, across **Scope 1, 2 & 3**. Companies enter activity data (fuel, electricity, transport, purchases) through a guided ~133-question carbon-inventory questionnaire or an AI chat, and the platform produces an **audit-ready carbon inventory and an ISO 14064-1 PDF report** using real emission factors (DEFRA, IPCC, IEA, GLEC, and Turkish national factors). It is an academic project (İstinye University IT Valley), fully **bilingual (English + Turkish)**, currently in beta.

## Repository layout

- `carbonless_backend/` — Django 5 + Django REST Framework API
- `nexus_insights-saas-neon_nextjs/` — Next.js 15 + React 19 + Tailwind CSS 4 frontend

## Tech stack

- **Backend:** Django 5 + DRF, SimpleJWT auth, ReportLab + pypdf (ISO PDF), openpyxl (Excel), Groq SDK (LLM), Stripe (billing), google-auth (OAuth), django-unfold (admin). SQLite locally / PostgreSQL in production (Render). Served by gunicorn + whitenoise.
- **Frontend:** Next.js 15 (App Router) + React 19 + Tailwind CSS 4, Playwright for E2E. Deployed on Vercel.
- **AI:** Groq `llama-3.3-70b-versatile` at temperature 0.2 for deterministic structured extraction. **Do not raise the temperature.**

### Backend apps
- `accounts/` — user auth, JWT, email verification, Google OAuth
- `companies/` — company model, memberships, invites
- `emissions/` — emission factors, entries, reports, ISO 14064-1 PDF generation
- `chat/` — AI chatbot (Groq LLM + NLU + factor lookup)
- `questionnaire/` — guided carbon-inventory questionnaire (~133 questions) and the Workspace data layer
- `subscriptions/` — Stripe billing

### Frontend routes (`src/app/`)
`/` (landing), `/about`, `/ai`, `/features`, `/contact`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/join`, `/accept-invite`, `/dashboard` (authenticated app), `/privacy`, `/terms`.

## Key files — what each one does

Use this so you edit the right file instead of searching blind.

**Backend — calculation core (DO NOT change values/formulas):**
- `emissions/calculator.py` — the CO₂e engine: factor lookup + `quantity × factor`.
- `emissions/models.py` — `EmissionFactor`, `EmissionEntry` (`calculated_co2e_kg`, `facility`).
- `emissions/factor_lookup.py`, `seed_data.py` — factor values and their lookup/seeding.
- `emissions/gas_split_data.py` — per-gas (CH₄/N₂O/…) breakdown for ISO reporting.
- `emissions/unit_converter.py` — unit conversions + alias maps (tokens are stable).
- `emissions/scope3_categories.py` — Scope 3 category definitions.

**Backend — safe to edit (mapping / exposure / validation / reports):**
- `questionnaire/step_entries.py` — answers → activities → `EmissionEntry`. **Facility attribution lives here** (editable); the factor/unit maps also live here (NOT editable).
- `questionnaire/views.py` — `SubmitStepView` (step save, `sync_step_entries`, `calc_feedback`), STRICT-step routing to serializers.
- `questionnaire/serializers.py` — step validation (e.g. `StepB4Serializer` facility-count bound, bilingual `error_messages`).
- `questionnaire/facility_sync.py` — keeps facilities in sync.
- `questionnaire/assumptions.py` — the honest "not calculated — no factor" notes shown to users and in the report.
- `questionnaire/year_guard.py` — write guards that remain (locked inventories, an inventory with entries cannot move year). It no longer limits inventories per year.
- `emissions/inventory_scope.py` — which records belong to which inventory (`entries_of`, `customs_of`, `claim_unassigned_rows`, `resolve_scope`). Every inventory-specific read goes through it.
- `questionnaire/iso_report_pdf.py`, `emissions/report_pdf.py` — ISO 14064-1 PDF rendering (layout/wording editable; numbers come from the engine).
- `emissions/views.py` — summary/aggregation endpoint (`by_facility`, `unassigned_kg`, scope totals, `uncalculated_notes`).
- `questionnaire/data/carboniq_schema.json`, `carboniq_labels.json` — questionnaire schema + labels (note: STRICT steps like B4 bypass schema validation and use a serializer instead).
- `questionnaire/workspace_views.py` — Workspace API, `CATEGORY_SCHEMAS`, `EXTRACTION_SYSTEM_PROMPT`, `_coerce_value`.

**Frontend — key files:**
- `src/lib/carboniq/questions.js` — all ~133 questions + the shared `validateCarbonIQAnswer` validator (client-side bounds/messages live here, not in the components).
- `src/components/dashboard/CarbonAIPage.jsx` — questionnaire wizard engine (`submitAnswer`), answer reverse-maps, renders `calc_feedback` notes.
- `src/components/dashboard/InventoryWorkflow.jsx`, `InventoryLibrary.jsx` — inventory flow/listing.
- `src/lib/hooks/useDashboardData.js` — dashboard fetch (gate refetch on real emission changes, not every step).
- `src/lib/carboniq/emission-factors.js` — *preview* factors for the FE estimate only (not authoritative).
- `src/lib/workspace/api.js` — `REQUIRED_FIELDS`, category status helpers.

## Golden rule — one source of truth

Structured data has a single source of truth: the `ReportField` model (one row per `report` + `field_id`, enforced by a DB `unique_together`). AI extractions are staged in `PendingSuggestion` and require human approval first.

**The AI NEVER writes authoritative data directly.** Every AI extraction flows:

```
PendingSuggestion (pending) --> human confirm / edit / reject --> ReportField
```

The dashboard writes `ReportField` directly (bypassing the suggestion step). Never break this invariant.

## How a number becomes an emission (the data flow)

Read this before editing anything near calculations — it is the whole story.

1. **Input.** A company provides activity data two ways: the guided questionnaire (`questionnaire/` — ~133 questions, steps like `3A-5` stationary fuel, `4A-1` electricity, `K3C…` Scope 3) or the AI chat (`chat/`). Dashboard forms also write directly.
2. **Questionnaire → entries.** On each step save, `questionnaire/views.py` (`SubmitStepView`) persists the answer and calls `sync_step_entries`. `questionnaire/step_entries.py` turns answers into concrete activities: it decides **fuel type, quantity, unit, and which facility** each activity belongs to, then builds `EmissionEntry` rows. This file is where **attribution** (facility bucketing) happens — editing attribution here is allowed; editing the factor/unit maps here is NOT.
3. **Factor lookup.** For each activity, the engine finds an `EmissionFactor` by `slug + country + category (+ optional year)` via `emissions/calculator.py :: get_emission_factor`. Year is normally hidden — the system picks `is_default` then latest, or the closest factor with `year <= N`. `country` is `global` (Defra 2024 + IPCC) or `turkey` (national mix).
4. **Unit conversion.** If the input unit differs from the factor's unit, `emissions/unit_converter.py :: convert_unit` converts it. Stored unit *tokens* must stay stable — the converter and alias maps key off them.
5. **CO₂e math.** The calculation is simply `emissions_kg = converted_quantity × factor.factor_kg_co2e` (`calculator.py`), rounded. Tonnes = kg / 1000. This formula, the factor values, and the GWP/gas-split derivation (`gas_split_data.py`, `seed_gas_splits`) are the sacred core — never change them.
6. **Storage.** The result is an `EmissionEntry` with `calculated_co2e_kg` and a `facility` (or `null` = unassigned). `calculated_co2e_kg` depends ONLY on quantity × factor — never on which facility bucket it lands in.
7. **Aggregation / exposure.** `emissions/views.py` (summary endpoint) groups entries by scope and facility, sums `calculated_co2e_kg`, and exposes `by_facility`, `unassigned_kg`, `scope1/2/3`, and `uncalculated_notes`. Changing how already-computed values are grouped/exposed is allowed; changing the values is not.
8. **Reporting.** `emissions/report_pdf.py` and `questionnaire/iso_report_pdf.py` render the ISO 14064-1 PDF (ReportLab), including the per-gas CH₄/N₂O/HFC/PFC/SF₆ columns that come from the gas splits.

**The two seeds matter and are order-sensitive:** `seed_factors` owns factor values; `seed_gas_splits` derives each factor's per-gas breakdown and must run *after* it (see `build.sh`). Skipping them leaves the ISO report's gas columns empty.

## Safe-to-edit vs. do-not-touch (quick map)

- **Allowed to change:** data mapping/attribution (`questionnaire/step_entries.py` facility logic, `facility_sync.py`), aggregation/exposure (`emissions/views.py` summary), validation (`questionnaire/serializers.py`, `emissions/serializers.py`), UI, reports' layout/wording, honest "not calculated" notes (`assumptions.py`).
- **Do NOT touch (calculation core):** `emissions/calculator.py`, `gas_split_data.py`, `scope3_categories.py`, `seed_data.py`, `factor_lookup.py`, `unit_converter.py`, `emissions/models.py`, and the factor/unit maps inside `questionnaire/step_entries.py`. If a task seems to need a change here, stop and flag it.

## Hard rules (never break)

1. **Emission numbers are sacred.** Never change factor values, CO₂e formulas, GWP math, or unit conversions, and never change units or slugs. This covers `emissions/*` (calculator.py, gas_split_data.py, scope3_categories.py, seed_data.py, factor_lookup.py, unit_converter.py, models.py) and the factor/unit maps in `questionnaire/step_entries.py`. If a task appears to require it, **stop and flag it** — do not edit.
2. **Bilingual always.** All user-facing text, including error messages and system notes, must exist in English and Turkish with correct Turkish characters (ç ğ ı İ ö ş ü). Use the existing `{ tr: '…', en: '…' }` / `tr ? '…' : '…'` patterns.
3. **Validate at the serializer.** Reject bad input at the DRF serializer with a bilingual error message before it reaches the database. Client-side validation is a convenience; the server is the authoritative choke point (defence-in-depth).
4. **Any number of inventories may share a company and year; each is isolated by `inventory_id`.** A record belongs to the inventory named by its `inventory` column; never select an inventory's records by company + year (use `emissions/inventory_scope.py`). Records with no inventory are read only as described in that module and are never copied or moved to the "newest" inventory. **Deliberately company-wide, not per inventory:** reduction targets (the company's commitment; they keep their own `base_emissions_kg` snapshot, so they read no inventory after creation), admin-approved electricity factors (Özel Talep — a reference factor per facility + year + method, unique by admin validation; every inventory of that year applies it to its own kWh, and it is never duplicated or tied to one inventory), and chat/form monthly entries (company-level rows, so deleting an inventory never removes them). **The chat assistant reads one inventory:** the client sends `inventory_id` with each message; the database answers, the prompt context and the part of the conversation sent to the model hold only that inventory (a year with several inventories and none selected gets "choose an inventory", never a blend). Legacy duplicate-year groups stay unlinked and read-only until a person resolves them (`manage.py review_duplicate_inventories --evidence`, see `carbonless_backend/LEGACY_INVENTORY_RECOVERY.md`).
5. **Attribution must not change math.** Changing which facility/bucket an entry is attributed to must never change its calculated CO₂e.
6. **"I don't know — answer later" is decided by what a question does, never by how it looks.** A question that routes the questionnaire (any `nextByValue`), defines loop items, sets the boundary or the method, identifies the inventory or signs off is REQUIRED and cannot be deferred; profile/documentation/data follow-ups are DEFERRABLE; some apply only on certain routes (CONDITIONAL; off the route they are inactive: not pending, not counted). The policy is `questionnaire/deferral_policy.json` (+ the frontend copy `src/lib/carboniq/deferralPolicy.js`), enforced on the server by `questionnaire/deferral.py` (`POST …/pending/`, completion) and mirrored by `src/lib/carboniq/deferral.js`; `deferral_parity.json` keeps both route walks identical. A new question must be classified (tests fail otherwise). Table and reasons: `carbonless_backend/ANSWER_LATER_POLICY.md`.

## Calculation & data rules (the DOs and DON'Ts)

These are non-negotiable rules established across the inventory/calculation work. They protect the audit-grade correctness of every number.

### DON'T
- **DON'T** change any emission-factor value, CO₂e formula (`quantity × factor`), GWP/gas-split math, or unit conversion. Ever.
- **DON'T** invent or fabricate an emission factor that doesn't exist (e.g. a spend-based factor for a category that has none). If no factor exists, the amount is "not calculated — no factor", never a guessed number.
- **DON'T** silently drop a recorded answer that can't be calculated, and **DON'T** show it as a counted `0`. Surface an honest bilingual "not calculated — no factor" note instead.
- **DON'T** attribute an entry to an arbitrary, "last", or guessed facility. An unresolved/missing facility key must land in `unassigned`, never a wrong facility.
- **DON'T** change a stored unit token or slug for display reasons — only change the *displayed* label. The backend keys off the stored token, so the token must stay stable.
- **DON'T** let an out-of-range numeric input reach the database. Bound it at the serializer first (e.g. facility count is `1..10000`).
- **DON'T** refetch dashboard data on every questionnaire step — only when an answer actually changes emissions (gate on the backend's `calc_feedback.delta_kg` / `saved_entry`).

### DO
- **DO** keep computed CO₂e byte-for-byte identical after any mapping/attribution/exposure change. Regression guards that must always hold:
  - natural gas **10,000 m³ = 20,200 kg CO₂e (20.2 t)**
  - electricity **50,000 kWh ≈ 20,995 kg CO₂e**
  - (smaller guard used in tests: 1,000 kWh × 0.4 = 400 kg)
- **DO** restrict changes to **data mapping/attribution** (which facility an entry belongs to) and **aggregation/exposure** of already-computed values. These are the only calculation-adjacent things allowed to change.
- **DO** attribute a questionnaire entry to the facility the user selected for that source; if none was selected, mark it `unassigned`.
- **DO** collapse stationary-fuel (3A-5) attribution to the single 3A-2 site only when exactly ONE distinct site exists; if zero or more than one, leave it `unassigned` (never guess). Exclude biomass from this rule.
- **DO** resolve electricity (4A-1) site keys only against valid 2A-2 facilities; on non-resolution leave the entry `unassigned`.
- **DO** add bilingual bound + error messages at the DRF serializer for numeric inputs (the server choke point), matching any client-side min/max.
- **DO** run the Django test suite and confirm the regression numbers still hold after any change near the calculation path.

## How to work

- **Read before you write.** Read the relevant files and match existing patterns, naming, and libraries. Don't restate what the code or docs already say.
- **Think step by step** for complex problems and show your reasoning. Use specific examples and exact file paths.
- **Solve exactly what's asked.** Don't add features, abstractions, refactors, or cleanup beyond the task's scope.
- **Be honest about verification.** State what you actually ran/checked versus what you assumed. Never claim something works without confirming it.
- If an approach fails twice, stop and diagnose the root cause instead of patching incrementally.

## Verify before claiming done

- **Backend:** run `python manage.py check` and the suite below (set `ALLOW_DEV_SECRET=true` locally; leave `INVENTORY_OWNERSHIP_CUTOVER` UNSET for the general run (CI no longer sets it either): with a `2000-01-01…` cutover exported, five `LegacyDuplicateGroupTests`/`WorkspaceWritePathTests` tests in `test_inventory_year_integrity` fail on the default settings; `settings_test_filedb` sets its own value). The suite must be green, including new tests:
  ```
  python manage.py test emissions accounts questionnaire companies chat --exclude-tag=filedb_only      # the same command as .github/workflows/ci.yml
  python manage.py test questionnaire.test_stage3_lifecycle --tag=filedb_only --settings=carbonless_api.settings_test_filedb
  python manage.py test questionnaire.test_inventory_year_integrity --tag=filedb_only --settings=carbonless_api.settings_test_filedb
  python manage.py test accounts.test_refresh_concurrency --tag=filedb_only --settings=carbonless_api.settings_test_filedb
  ```
  **Tests tagged `filedb_only` are multi-threaded concurrency tests. They MUST NOT run in the general suite**: Django's in-memory SQLite test database uses shared-cache table locks that raise `database table is locked` at once instead of waiting, so they fail there without any application fault. Always exclude the tag from the general run and run them separately on the file-backed `settings_test_filedb` (set `TEST_SQLITE_FILE` to a scratch path to keep it out of the system temp directory). Never "fix" such a failure by changing the test or the application.
- **Frontend:** run the build. For UI/animation work, verify in a real browser across **desktop, mobile, and reduced-motion** — reading the code is not verification.
- **Playwright worker policy:** against the dev server (`npm.cmd run dev`) use at most **2 workers** (`npx.cmd playwright test --workers=2`). With 4 workers on an 8-core machine the dev server and four Chromium instances saturate the CPU (about 91% mean vs 40% solo; dev-server requests about 5.6× slower) and `leave-workspace.spec.js` (Log Out) fails on its fixed time budgets, with a normal result at 1 and 2 workers. 4 workers may be used only against a production server (`npm.cmd run build` then `npm.cmd start`), and never run `next build` while a dev server is using the same `.next` directory. Use `--reporter=list,json` for unattended runs (the default HTML reporter opens a browser on failure).
- **Regression guards that must always hold:** natural gas 10,000 m³ = **20,200 kg CO₂e**; electricity 50,000 kWh ≈ **20,995 kg CO₂e**.
- Clean up any temporary files you create for verification.

## Environment

- OS is **Windows / PowerShell**. `npm` scripts can be blocked by the execution policy — use **`npm.cmd`** (e.g. `npm.cmd run dev`, `npm.cmd run build`) instead of `npm`.
- Backend commands need `$env:ALLOW_DEV_SECRET="true"` locally. Backend runs on `http://localhost:8000`, frontend on `http://localhost:3000`.
- Never start a long-running server inside a blocking command — give the exact command to run, or run it as a background process.

## Local setup

```bash
# Backend
cd carbonless_backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend
cd nexus_insights-saas-neon_nextjs
npm.cmd install
npm.cmd run dev
```

## Git

- Only commit when explicitly asked.
- Push to a feature branch and open a PR by default; only push straight to `main` when asked.
- Stage specific files rather than `git add -A` when practical, and flag any file that may contain secrets (`.env`, credentials) before committing.

## When given a task

1. Restate the goal in one line.
2. Name the files you'll read/change.
3. Check the task against the hard rules above (flag any conflict).
4. Implement it, matching existing patterns.
5. Verify as described above.
6. Report what you changed and what you verified (and what you could not).
