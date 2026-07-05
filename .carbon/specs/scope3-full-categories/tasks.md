# Implementation Plan: Scope 3 Full Categories

## Overview

This plan extends the Carbonless platform to fully support all 15 GHG Protocol Scope 3 emission categories. The implementation follows a bottom-up approach: data model updates first, then backend factor resolution, seed data, AI chat context, frontend entry forms, and finally reporting. Each step builds incrementally on the previous one, ensuring no orphaned code.

## Tasks

- [x] 1. Update data model and create category registry
  - [x] 1.1 Add missing CATEGORY_CHOICES to EmissionFactor model
    - Add `('processing_sold', 'Processing of Sold Products')` and `('use_of_sold', 'Use of Sold Products')` to `CATEGORY_CHOICES` in `emissions/models.py`
    - Generate and apply a Django migration for the updated choices
    - _Requirements: 8.1, 9.1, 17.2_

  - [x] 1.2 Create the Scope 3 Category Metadata Registry
    - Create new file `emissions/scope3_categories.py`
    - Define `SCOPE3_CATEGORIES` dictionary with all 15 categories, each containing: `ghg_number`, `name_en`, `name_tr`, valid `subtypes` (with unit and slug for each)
    - Define `SCOPE3_GHG_NUMBER` mapping (category key → GHG Protocol number 1–15)
    - Include water category metadata alongside the 15 standard categories
    - _Requirements: 1.2, 2.2, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2, 9.2, 10.2, 11.2, 12.2, 13.2, 15.2, 16.1, 17.1, 18.2, 19.1_

  - [ ]* 1.3 Write property test for seed data completeness (Property 7)
    - **Property 7: Seed data covers all 15 Scope 3 categories**
    - Verify that for every category key in `SCOPE3_GHG_NUMBER`, at least one entry in `EMISSION_FACTORS` has that category value
    - **Validates: Requirements 17.1**

- [x] 2. Extend backend factor resolution for all Scope 3 categories
  - [x] 2.1 Add all new ACTIVITY_TO_SLUG entries to factor_lookup.py
    - Add compound key entries for all 15 Scope 3 categories as defined in the design (purchased_goods, capital_goods, fuel_energy, waste, employee_commuting, upstream_leased, downstream_transport, processing_sold, use_of_sold, end_of_life, downstream_leased, franchises, investments, water)
    - Pattern: `('{category}_{subtype}', '{unit}'): '{slug}'`
    - Include bicycle_commute with zero-emission factor slug
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 8.1, 8.2, 9.1, 9.2, 10.1, 10.2, 11.1, 11.2, 12.1, 12.2, 13.1, 13.2, 18.1, 18.2_

  - [x] 2.2 Implement resolve_scope3_activity helper function
    - Add `resolve_scope3_activity(category, subtype, quantity, unit)` to `factor_lookup.py`
    - Validate category exists in `SCOPE3_CATEGORIES`
    - Validate subtype exists for the given category
    - Validate unit matches the expected unit for the subtype
    - Compose the activity_type key as `{category}_{subtype}` and delegate to `resolve_factor_and_amount()`
    - Return descriptive errors for unknown category, unknown subtype (listing valid options), and unit mismatch (showing correct unit)
    - _Requirements: 1.1, 1.3, 2.1, 2.3, 3.1, 3.3, 4.1, 4.4, 5.1, 5.4, 6.1, 6.3, 7.1, 7.3, 8.1, 9.1, 9.3, 10.1, 10.3, 11.1, 11.3, 12.1, 12.3, 13.1, 13.3, 18.1, 18.4_

  - [ ]* 2.3 Write property test for valid activity resolution (Property 1)
    - **Property 1: Valid Scope 3 activity resolution always succeeds**
    - Use Hypothesis to generate all valid `(category, subtype, unit)` triples from `SCOPE3_CATEGORIES` with positive quantities
    - Assert that `resolve_scope3_activity` returns a non-null factor and CO2e = quantity × factor
    - **Validates: Requirements 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1, 13.1, 18.1**

  - [ ]* 2.4 Write property test for invalid sub-type error (Property 2)
    - **Property 2: Invalid sub-type returns descriptive error with supported list**
    - Use Hypothesis to generate invalid subtype strings for each category
    - Assert that the error message contains at least one valid sub-type for that category
    - **Validates: Requirements 1.3, 3.3, 4.4, 5.4, 7.3, 9.3, 10.3, 11.3, 13.3, 18.4**

  - [ ]* 2.5 Write property test for unit mismatch error (Property 3)
    - **Property 3: Unit mismatch returns error with correct unit**
    - Use Hypothesis to generate valid (category, subtype) pairs with incorrect units
    - Assert that the error message contains the expected correct unit
    - **Validates: Requirements 2.3, 6.3, 12.3**

  - [ ]* 2.6 Write property test for Turkey-specific factor preference (Property 4)
    - **Property 4: Turkey-specific factors are preferred over global**
    - For activity slugs that have both Turkey and global factors in the DB, assert that `resolve_factor` returns the Turkey factor
    - **Validates: Requirements 4.3, 18.3**

  - [ ]* 2.7 Write property test for non-negative CO2e (Property 8)
    - **Property 8: CO2e calculation is non-negative for valid inputs**
    - Use Hypothesis to generate any valid Scope 3 activity with positive quantity
    - Assert that `co2e_kg >= 0` (allows zero for bicycle commuting)
    - **Validates: Requirements 1.1, 5.3**

- [x] 3. Checkpoint - Ensure all backend factor resolution tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend seed data for all 15 Scope 3 categories
  - [x] 4.1 Add missing emission factor entries to seed_data.py
    - Add entries for: processing_sold (Category 10) with sub-types energy_intensive, light, chemical
    - Add entries for: use_of_sold (Category 11) with sub-types electricity, fuel, gas
    - Add entries for: downstream_leased (Category 13) with sub-types leased_building, leased_equipment
    - Add entries for: employee_commuting (Category 7) with sub-types car_commute, bus_commute, train_commute, motorcycle_commute, bicycle_commute (0.0 factor)
    - Add entries for: downstream_transport (Category 9) with sub-types truck_delivery, courier, postal
    - Add entries for: end_of_life (Category 12) with sub-types product_recycling, product_landfill, product_incineration
    - Add entries for: upstream_leased (Category 8) with sub-types office_space, warehouse, leased_vehicles
    - Add entries for: franchises (Category 14) with franchise-operations slug
    - Add entries for: investments (Category 15) with sub-types equity_investments, debt_investments
    - Normalize existing seed entries to use `processing_sold` and `use_of_sold` category keys
    - Include Turkey-specific factors where Turkey data is available (waste, water)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 4.3, 5.3, 18.3_

  - [ ]* 4.2 Write unit tests for seed data integrity
    - Verify seed command runs without errors (all 15 categories populated)
    - Verify `validate_emission_factors()` passes for all new entries
    - Verify bicycle_commute slug has `factor_kg_co2e = 0.0`
    - _Requirements: 17.3_

- [x] 5. Update AI Chat context for all 15 Scope 3 categories
  - [x] 5.1 Update get_emission_factor_reference() for expanded activity types
    - The function already iterates `ACTIVITY_TO_SLUG` automatically, but verify that the new entries produce readable RAG context lines
    - Add Scope 3 category grouping headers to the reference output (e.g., "Cat 1 - Purchased Goods & Services")
    - _Requirements: 14.4_

  - [x] 5.2 Update AI Chat system prompt with Scope 3 category listing
    - Modify the system prompt in `chat/views.py` to include a Scope 3 category listing from `SCOPE3_CATEGORIES`
    - Include both English and Turkish category names so the LLM can map natural-language descriptions
    - Add instructions for the LLM to compose valid `activity_type` keys (e.g., `purchased_goods_electrical_large`)
    - Add instruction for the LLM to ask clarifying questions when category or sub-type is ambiguous
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 19.2_

  - [ ]* 5.3 Write unit tests for AI chat Scope 3 recognition
    - Test that `get_emission_factor_reference()` output includes all 15 category types
    - Test that the system prompt contains all 15 Scope 3 categories
    - _Requirements: 14.4_

- [x] 6. Create Scope 3 metadata API endpoint
  - [x] 6.1 Add GET /api/emissions/scope3-categories/ endpoint
    - Create a new view in `emissions/views.py` that returns the `SCOPE3_CATEGORIES` registry as JSON
    - Include all 15 categories with: key, ghg_number, name_en, name_tr, and subtypes array (each with key, unit, name_en, name_tr)
    - Register the URL in `emissions/urls.py`
    - Requires authentication (same as other emissions endpoints)
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ]* 6.2 Write unit tests for the scope3-categories endpoint
    - Test that response contains exactly 15 categories (plus water)
    - Test that each category has valid ghg_number, name_en, name_tr, and non-empty subtypes
    - _Requirements: 15.1, 15.2_

- [x] 7. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create frontend Scope 3 entry form
  - [x] 8.1 Add Scope 3 translations to translations.js
    - Add `scope3` key to both `tr` and `en` translation objects
    - Include all 15 category names and all sub-type labels in both English and Turkish
    - Include unit labels for all supported units
    - _Requirements: 15.4, 19.1, 19.3_

  - [x] 8.2 Create Scope3EntryForm.jsx component
    - Create `nexus_insights-saas-neon_nextjs/src/components/dashboard/Scope3EntryForm.jsx`
    - Implement cascading form: Category selector → Sub-type selector → Quantity input with dynamic unit label → Submit button
    - Fetch categories from `GET /api/emissions/scope3-categories/` on mount
    - When category changes, update sub-type options; when sub-type changes, update unit label
    - Display category and sub-type names in user's preferred language (EN/TR)
    - On submit, call `POST /api/emissions/entries/` with resolved activity_type, quantity, and unit
    - Handle API errors with toast notifications and retry option
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 19.1_

  - [x] 8.3 Integrate Scope3EntryForm into the Dashboard
    - Add Scope3EntryForm to the emissions entry section of the dashboard
    - Ensure it is accessible as a selectable option alongside existing entry methods
    - _Requirements: 15.1, 15.5_

  - [ ]* 8.4 Write frontend tests for Scope3EntryForm
    - **Property 5: Frontend category-subtype filtering matches registry**
    - Test that selecting a category shows only valid sub-types for that category
    - Test that selecting a sub-type shows the correct unit label
    - Test that all 15 categories render in the category selector
    - Test bilingual label rendering (EN/TR switch)
    - **Validates: Requirements 15.2, 15.3, 15.4**

  - [ ]* 8.5 Write frontend test for translation completeness (Property 6)
    - **Property 6: Bilingual translations are complete for all categories and sub-types**
    - Verify that every (category, subtype) pair in the registry has non-empty EN and TR translations
    - **Validates: Requirements 15.4, 19.3**

- [x] 9. Update Scope 3 reporting in PDF and dashboard
  - [x] 9.1 Update report_pdf.py for Scope 3 category breakdown
    - Modify the Category Analysis section (Section 3) to group Scope 3 entries by GHG Protocol category number (1–15)
    - Display all 15 categories even when zero entries exist (for completeness of boundary assessment)
    - Show both English and Turkish category names using `SCOPE3_CATEGORIES` registry
    - Add a dedicated "Scope 3 Category Breakdown" sub-section with a table listing each category's total CO2e
    - _Requirements: 16.1, 16.2, 16.3_

  - [x] 9.2 Add Scope 3 breakdown chart to dashboard summary API
    - Update the emission_summary API endpoint to include a `scope3_by_category` breakdown
    - Return totals for each of the 15 GHG Protocol categories (including zeros)
    - _Requirements: 16.4_

  - [x] 9.3 Add Scope 3 breakdown chart component to frontend dashboard
    - Create or extend a chart component to visualize Scope 3 emissions by category
    - Display category names bilingually based on user preference
    - _Requirements: 16.4_

  - [ ]* 9.4 Write unit tests for Scope 3 report generation
    - Test that report PDF includes all 15 Scope 3 categories with zero values when no entries exist
    - Test that dashboard summary API returns scope3_by_category with 15 category entries
    - _Requirements: 16.1, 16.2, 16.4_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses Python (Django/Hypothesis) for backend and JavaScript/React for frontend — no language selection was needed
- The existing `ACTIVITY_TO_SLUG` pattern is preserved and extended, not replaced
- No schema changes to the EmissionFactor or EmissionEntry models are needed beyond adding two CATEGORY_CHOICES values

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "2.6", "2.7", "4.2"] },
    { "id": 4, "tasks": ["5.1", "5.2", "6.1"] },
    { "id": 5, "tasks": ["5.3", "6.2", "8.1"] },
    { "id": 6, "tasks": ["8.2", "9.1", "9.2"] },
    { "id": 7, "tasks": ["8.3", "8.4", "8.5", "9.3"] },
    { "id": 8, "tasks": ["9.4"] }
  ]
}
```
