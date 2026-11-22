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

## Factor standards (owner decision, November 2026)

An inventory is calculated on the factor standard chosen in question **D1**: `std_ghg`, `std_ipcc`, `std_defra` or `std_mix` (a standard chosen on each calculating question, stored next to the answer as `factor_standard`). This was introduced on the owner's instruction, with the factor sources the client supplied; it is the one sanctioned exception to "emission numbers are sacred".

- `EmissionFactor.standard` says which standard a row belongs to. Blank = the platform catalogue (`seed_data.py`), which is still frozen: hard rule 1 applies to it unchanged, and an inventory whose D1 is not one of the four values above (every inventory answered before) is calculated on it with the same numbers as before.
- A standard's rows are data, loaded by their own command, never hand-edited: DEFRA from `emissions/data/defra_factors.json` (every published edition 2014–2026, generated from the gov.uk flat files) by `manage.py seed_defra_factors`. They are `is_default=False`, so no catalogue query sees them.
- The standard in force is applied in one place: `emissions/factor_lookup.py :: pick_factor` (`use_standard`). The edition is the inventory year's, else the latest earlier one. A source the standard does not publish is **not calculated** (honest note), never taken from another standard — except grid electricity, which keeps the national factor.
- `questionnaire/step_entries.py :: inventory_standard / answers_standard / report_standard` read the choice from the answers.
- **D1 is the first question of an inventory** (then A1 …; `getInitialQuestionId`, `STEP_FLOW`, `STRICT_STEP_ORDER`, the route walks in `deferral.py` / `deferral.js` all start at D1). It is never copied by "reuse previous company profile": every inventory is asked for its own standard.
- **Mix:** each question in `ENTRY_STEPS` carries its own standard. The wizard shows a picker on those questions (`src/lib/carboniq/factorStandard.js`, whose step list a backend test keeps equal to `ENTRY_STEPS`) and sends it as `data.factor_standard`; the server (`step_entries.checked_factor_standard`, called from `SubmitStepView`) refuses an unknown standard, requires one in a mix inventory (bilingual error, code `factor_standard`) and keeps the saved one when a later save does not repeat it. Changing the standard of an ANSWERED question is its own call, `POST /api/questionnaire/<id>/step-standard/` (`StepStandardView`): the stored choice is replaced and the inventory recalculated at once, the answer is not entered again.
- **IPCC and GHG Protocol** rows come from `emissions/data/ipcc_ghg_factors.json`, generated by `emissions/data/build_ipcc_ghg_factors.py` and loaded by `manage.py seed_ipcc_ghg_factors`. Both use the IPCC 2006 default factors per gas (Vol. 2, Tables 1.2, 1.4, 2.3, 3.2.1, 3.2.2, 3.3.1) and differ only in the GWP set: `ipcc` = AR5, `ghg` = AR6, both columns copied from the GHG Protocol GWP document (Aug 2024). This definition is the implementer's reading of the sources the client supplied and **awaits the client's confirmation**; to change it, edit the constants in the build script and re-run it — never edit the JSON by hand. They cover fuel combustion (stationary, road, off-road) and fugitive gases only. A factor per litre or per m³ is built the way the client's own inventories do it (ISO 14064-1 calculation document 2023; inventory report 2024, Tables 8–10): IPCC factor per TJ × IPCC default NCV (Table 1.2) × the density of the "Fuel properties" sheet of the UK Government conversion factors **of the inventory year** — one row per year 2014–2026 (`DENSITY` in the build script, copied from each edition), so those 12 slugs have 13 rows per standard and every one is selectable. Fuel amounts in kWh are not calculated under these two standards (the IPCC factors are on a net calorific basis and a metered kWh is not).
- **A source the standard in force does not publish is always noted** (`step_entries._standard_notes`, part of `uncalculated_notes`): "the chosen standard (X) publishes no factor for this source — not calculated", or in a mix inventory "the standard of this question is not chosen". Checks that ask "is there a factor at all?" use `_catalogue_factor`; lookups that calculate use the question's standard (`_step_scope`).
- **Entries made outside the questionnaire** (AI chat, forms) use the standard of the inventory they join: `factor_lookup.inventory_standard_scope`, applied in `create_entry_from_activity` and around the chat views (`chat/views.py :: _chat_standard`). A company-level entry (no inventory) keeps the catalogue. A mix inventory has no per-question choice there, so such an entry is refused with a message sending the user to the questionnaire.
- **Withheld rows.** A row of a standard whose mapping, density or method is not resolved and approved is loaded but **withheld**: `emissions/data/withheld_factors.json` lists it with its reason, the seed commands store it `is_active=False`, `pick_factor` never selects it, and the activity is noted as "not calculated — factor under review" (`emissions/withheld.py`, `step_entries._standard_notes`, `factor_lookup.standard_gap_message`). Withheld today: 13 DEFRA mappings that are wrong for a site outside the UK or not established (UK grid or heat inside the number: district heating, steam, T&D losses, rail and metro; UK coal for lignite; UK diesel freight train for electric rail; `diesel-kwh`; `biodiesel`) (the IPCC / GHG Protocol per-litre rows were released on 2026-11-22: the client's own calculation documents use exactly that density). **Release a row only by removing it from that file after it is individually resolved and approved by the owner**, never to make a number appear. Review and reasons: `audit/stage7/`.
- **GWP basis is recorded per row, never assumed.** `EmissionFactor.gwp_basis` holds the GWP source and version each standard row was built with (a DEFRA edition's basis is its publisher's and is never re-based); the ISO report prints the bases of the factors an inventory actually used. Do not impose one GWP set on a standard.
- **Densities follow the client's documented method.** A per-litre or per-m³ factor of the IPCC / GHG Protocol standards uses the DEFRA "Fuel properties" density of the inventory year, as the client's verified inventories do. Do not introduce another density (or a single year's value for all years) without the client's document for it.
- **TUR_NID_2024** was examined on 2026-11-22 (`audit/stage7/TUR_NID_2024_examination.md`). No factor is taken from it: its national NCV of natural gas per m³ (34.54 TJ/10⁶ m³, Annex 4) was used for a few hours and then replaced by the client's documented method, which gives about 10 % more (`audit/stage7/CLIENT_DOCUMENTS_2026-11-22.md`); which of the two the client wants is recorded there as an open question. It states no density for liquid fuels, and its country-specific CO₂ factors (Table 3.7) belong to the national inventory, not to any of the four standards.
- **The client's sources govern the standards** (owner, 2026-11-22): the DEFRA collection, the ETKB grid form, TUR_NID_2024, the GHG Protocol GWP document and the IPCC EFDB. A standard's rows are judged against what that standard publishes and prescribes. The earlier catalogue and the decisions recorded against it (`audit/stage5/decision_register_v2.md`, DR-01 … DR-22) are the history of the catalogue, not a constraint on the standards; read them for context. The catalogue itself (`seed_data.py`) stays frozen and guarded by its tests.
- **Turkish grid electricity has three official editions** (ETKB form ETKB-EVÇED-FRM-042, consumption-point factors, kg CO₂e/kWh, transmission / distribution): data year 2020 (0.427 / 0.462) and 2022 (0.445 / 0.478) in `seed_data.EDITION_FACTORS`, added on the owner's instruction, and 2023 (0.436 / 0.469) in the catalogue. `pick_factor` selects the edition of the inventory year, else the latest earlier one: 2021 and earlier → 2020, 2022 → 2022, 2023 and later → 2023. The ministry's page lists these three periods only (checked 2026-11-22): there is no 2021 or 2024 form. `EDITION_FACTORS` holds further data years of slugs the catalogue already has; `EMISSION_FACTORS` itself stays frozen against its baseline.
- **Fugitive gases (question 62, step `3D-4`) are calculated on a factor standard** (`step_entries._fugitive`): annual refill (kg) × the gas's factor of the standard in force, i.e. its GWP (`_FUGITIVE_SLUG`: R-410A, R-32, R-22, R-134a, R-404A, SF₆, CH₄). The gas is the group's own (3D-4) or the equipment's (3D-2); the entry belongs to the facility named in 3D-2 only when that is a 2A-2 facility, else unassigned. Not calculated, and said so: a gas with no published factor (R-1234yf, NF₃, unknown) and a group with no refill amount — no default leak rate is applied. An inventory on the platform catalogue keeps its earlier treatment (not calculated: the catalogue's GWPs were never unified). `3D-4` is in `ENTRY_STEPS`, so a mix inventory chooses its standard on it.
- **Both reports state an uncalculated Scope 1 / 2 amount**: `emissions/report_pdf.py` uses `iso_report_pdf.unquantified_required` for its opening statement too.
- **Final-report gate (owner decision, 2026-11-22).** A signed inventory is final. Direct and energy-indirect emissions (questions 3… and 4…, `step_entries.REQUIRED_CALCULATION_PREFIXES`) that hold an amount the inventory does not calculate (`step_entries.unmet_required_calculations`: notes of kind `not_calculated`, never a method note or a scope marked absent) must each be justified in writing by the signatory: the sign-off (7C-2) is refused with code `uncalculated_required` until `data.exclusions = {step_id: text}` covers every such question (20–1000 characters, `SignOffExclusionsSerializer`, bilingual). The record (question, what was not calculated in both languages, justification) is stored inside the signed 7C-2 answer and read back by `signed_exclusions`, never recomputed. The ISO report (`iso_report_pdf.unquantified_required`) prints it in section 3.4 and words the compliance principle accordingly: plain when nothing is uncalculated, "with the exception of …" when justified, and "conformity is not claimed" for an unsigned inventory or one signed before this gate that holds such an amount. Scope 3 amounts without a factor are disclosed in the report but do not hold the signature back. Never make the signature pass by deleting the amount or by counting it as zero. Tests: `questionnaire/test_final_report_gate.py`, `tests/smoke/signoff.spec.js`.
- **DEFRA rows by item** (2026-11-22): cardboard (`carton`) is DEFRA "Paper and board: board" and paper (`paper-mixed`, the questionnaire's "Paper") is "Paper and board: paper", as in the client's 2024 report; domestic flights are selectable; the upstream of fuel (K3C3) goes on the row of each fuel — `fuel-extraction` (diesel), `fuel-extraction-petrol`, `-fuel-oil`, `-lpg`, slugs that exist under the DEFRA standard only (`EXTRA_SLUGS` in the build script; `step_entries._upstream_energy` splits by fuel only when the question's standard is DEFRA, so the catalogue and the other standards keep one activity).
- **The DEFRA data file is generated** by `emissions/data/build_defra_factors.py <folder of gov.uk flat files>` (the slug → DEFRA row map lives there); it reproduces `defra_factors.json` exactly. Change a mapping there and re-run, never in the JSON.
- Still open: the remaining IPCC / GHG Protocol values rest on the implementer's choice of GWP set and IPCC sector tier (DR-02a, DR-11).
- Tests: `questionnaire/test_factor_standards.py` (backend), `tests/smoke/factor-standard.spec.js` (browser).

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
