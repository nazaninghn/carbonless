# Requirements Document

## Introduction

This feature extends the Carbonless platform to fully support all 15 Scope 3 emission categories as defined by ISO 14064-1 and the GHG Protocol Corporate Value Chain Standard. Currently, the system only resolves 4 Scope 3 activity types through `ACTIVITY_TO_SLUG` (business travel, flights, train, freight). The remaining 11 categories—purchased goods & services, capital goods, fuel & energy-related activities, waste, employee commuting, upstream leased assets, downstream transportation, processing of sold products, use of sold products, end-of-life treatment, downstream leased assets, franchises, and investments—must be integrated into the factor lookup, AI chat, frontend entry forms, and reporting pipeline.

## Glossary

- **Factor_Lookup**: The `emissions/factor_lookup.py` module containing the `ACTIVITY_TO_SLUG` dictionary and the `create_entry_from_activity()` function that resolves activity types to emission factors.
- **EmissionFactor**: The Django model storing emission factor data with fields: slug, scope, category, country, unit, factor_kg_co2e.
- **EmissionEntry**: The Django model storing individual emission data entries linked to an EmissionFactor.
- **ACTIVITY_TO_SLUG**: The dictionary mapping (activity_type, unit) pairs to EmissionFactor slugs for deterministic factor resolution.
- **AI_Chat**: The CarbonAI chat interface that parses user natural-language input and calls `create_entry_from_activity()` to log emissions.
- **Dashboard**: The Next.js frontend displaying emission data, entry forms, and reports.
- **Scope3_Category**: One of the 15 GHG Protocol categories for indirect value-chain emissions.
- **Seed_Data**: The `emissions/seed_data.py` module containing the `EMISSION_FACTORS` list used to populate the EmissionFactor table.
- **Report_Generator**: The `emissions/report_pdf.py` module that generates ISO 14064-1 compliant PDF reports.

## Requirements

### Requirement 1: Purchased Goods & Services Activity Types

**User Story:** As a sustainability manager, I want to log purchased goods and services emissions by material type and weight, so that I can report Category 1 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "purchased_goods" with a valid material sub-type and quantity in kg, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug and return a calculated CO2e value.
2. THE Factor_Lookup SHALL support the following purchased goods activity sub-types: electrical_large, electrical_small, electrical_it, glass, metal_aluminium, metal_steel, paper_mixed, plastic_average, plastic_hdpe, wood, chemical, mineral_oil.
3. WHEN a user submits a purchased goods activity with an unsupported sub-type, THE Factor_Lookup SHALL return a descriptive error message listing the supported sub-types.
4. IF a purchased goods EmissionFactor does not exist in the database for the given slug, THEN THE Factor_Lookup SHALL return an error indicating no active emission factor was found.

---

### Requirement 2: Capital Goods Activity Types

**User Story:** As a sustainability manager, I want to log capital goods purchases (machinery, vehicles, buildings, IT equipment), so that I can report Category 2 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "capital_goods" with a valid sub-type and quantity, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support the following capital goods activity sub-types: machinery (units), vehicles (units), buildings (m2), it_equipment (units).
3. WHEN a user submits a capital goods activity with an unsupported unit for the given sub-type, THE Factor_Lookup SHALL return an error listing the valid unit for that sub-type.

---

### Requirement 3: Fuel & Energy-Related Activities

**User Story:** As a sustainability manager, I want to log upstream fuel and energy activities not included in Scope 1 or 2 (well-to-tank, T&D losses), so that I can report Category 3 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "fuel_energy" with a valid sub-type and quantity, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support the following fuel & energy sub-types: upstream_electricity (kwh), transmission_losses (kwh), fuel_extraction (liters).
3. WHEN a user submits a fuel & energy activity with an unsupported sub-type, THE Factor_Lookup SHALL return a descriptive error message.

---

### Requirement 4: Waste Generated in Operations

**User Story:** As a sustainability manager, I want to log waste generated in operations by disposal method, so that I can report Category 5 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "waste" with a valid disposal method sub-type and quantity in kg, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support the following waste sub-types: landfill, recyclable, organic_compost, incineration.
3. THE Factor_Lookup SHALL prefer Turkey-specific waste emission factors when available, falling back to global factors.
4. WHEN a user submits a waste activity with an unsupported disposal method, THE Factor_Lookup SHALL return a descriptive error message.

---

### Requirement 5: Employee Commuting

**User Story:** As a sustainability manager, I want to log employee commuting emissions by transport mode, so that I can report Category 7 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "employee_commuting" with a valid transport mode and distance in km, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support the following commuting sub-types: car_commute, bus_commute, train_commute, motorcycle_commute, bicycle_commute.
3. WHEN a user submits a bicycle commute activity, THE Factor_Lookup SHALL calculate 0.0 kg CO2e (zero-emission mode).
4. WHEN a user submits a commuting activity with an unsupported transport mode, THE Factor_Lookup SHALL return a descriptive error message.

---

### Requirement 6: Upstream Leased Assets

**User Story:** As a sustainability manager, I want to log emissions from upstream leased assets (offices, warehouses, vehicles), so that I can report Category 8 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "upstream_leased" with a valid asset type and quantity, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support the following leased asset sub-types: office_space (m2), warehouse (m2), leased_vehicles (units).
3. WHEN a user submits a leased asset activity with a unit that does not match the sub-type, THE Factor_Lookup SHALL return an error listing the valid unit for that sub-type.

---

### Requirement 7: Downstream Transportation & Distribution

**User Story:** As a sustainability manager, I want to log emissions from outbound product delivery, so that I can report Category 9 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "downstream_transport" with a valid sub-type and quantity, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support the following downstream transport sub-types: truck_delivery (tonne-km), courier (packages), postal (packages).
3. WHEN a user submits a downstream transport activity with an unsupported sub-type, THE Factor_Lookup SHALL return a descriptive error message.

---

### Requirement 8: Processing of Sold Products

**User Story:** As a sustainability manager, I want to log emissions from the processing of intermediate products sold to other companies, so that I can report Category 10 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "processing_sold" with a quantity in kg or tonne, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support a spend-based or mass-based approach for processing of sold products with unit kg.
3. WHEN the Seed_Data does not include a factor for processing of sold products, THE Factor_Lookup SHALL use a generic industry-average processing emission factor.

---

### Requirement 9: Use of Sold Products

**User Story:** As a sustainability manager, I want to log emissions from the use phase of products sold by the company, so that I can report Category 11 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "use_of_sold" with a quantity in kwh or units, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support energy-consuming products (kwh) and non-energy products (units) as separate sub-types.
3. WHEN a user submits a use-of-sold-products activity with an unsupported unit, THE Factor_Lookup SHALL return an error listing supported units (kwh, units).

---

### Requirement 10: End-of-Life Treatment of Sold Products

**User Story:** As a sustainability manager, I want to log emissions from the end-of-life treatment of sold products, so that I can report Category 12 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "end_of_life" with a valid disposal method and quantity in kg, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support the following end-of-life sub-types: product_recycling, product_landfill, product_incineration.
3. WHEN a user submits an end-of-life activity with an unsupported disposal method, THE Factor_Lookup SHALL return a descriptive error message.

---

### Requirement 11: Downstream Leased Assets

**User Story:** As a sustainability manager, I want to log emissions from assets owned by the company and leased to other entities, so that I can report Category 13 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "downstream_leased" with a valid asset type and quantity, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support the following downstream leased asset sub-types: leased_building (m2), leased_equipment (units).
3. WHEN a user submits a downstream leased asset activity with an unsupported sub-type, THE Factor_Lookup SHALL return a descriptive error message.

---

### Requirement 12: Franchises

**User Story:** As a sustainability manager, I want to log emissions from franchise operations, so that I can report Category 14 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "franchises" with a quantity representing the number of franchise units, THE Factor_Lookup SHALL resolve the activity to the "franchise-operations" EmissionFactor slug.
2. THE Factor_Lookup SHALL use "franchises" as the unit for franchise activity entries.
3. WHEN a user submits a franchise activity with an invalid unit, THE Factor_Lookup SHALL return an error indicating the valid unit is "franchises".

---

### Requirement 13: Investments

**User Story:** As a sustainability manager, I want to log emissions from financial investments, so that I can report Category 15 Scope 3 emissions.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "investments" with a valid investment sub-type and amount in USD, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support the following investment sub-types: equity_investments (usd), debt_investments (usd).
3. WHEN a user submits an investment activity with an unsupported sub-type, THE Factor_Lookup SHALL return a descriptive error message.

---

### Requirement 14: AI Chat Scope 3 Category Recognition

**User Story:** As a user, I want the AI Chat to understand natural-language descriptions of all 15 Scope 3 categories, so that I can log emissions conversationally.

#### Acceptance Criteria

1. WHEN a user describes a Scope 3 emission activity in natural language, THE AI_Chat SHALL identify the correct Scope3_Category and activity sub-type from the description.
2. THE AI_Chat SHALL map the identified category to a valid activity_type recognized by Factor_Lookup before calling `create_entry_from_activity()`.
3. WHEN the AI_Chat cannot determine the category or sub-type from the user description, THE AI_Chat SHALL ask the user a clarifying question listing available options for the ambiguous parameter.
4. THE AI_Chat SHALL include all 15 Scope 3 categories in the emission factor reference context provided to the language model.

---

### Requirement 15: Frontend Scope 3 Entry Forms

**User Story:** As a user, I want the Dashboard to provide entry forms for all 15 Scope 3 categories with appropriate input fields, so that I can log emissions without using the AI chat.

#### Acceptance Criteria

1. THE Dashboard SHALL display all 15 Scope 3 categories as selectable options in the emission entry interface.
2. WHEN a user selects a Scope3_Category, THE Dashboard SHALL present a sub-type selector showing only the valid activity sub-types for that category.
3. WHEN a user selects a sub-type, THE Dashboard SHALL display the correct unit label and input field for the selected sub-type.
4. THE Dashboard SHALL display category names in both English and Turkish based on the user language preference.
5. WHEN a user submits a Scope 3 entry from the form, THE Dashboard SHALL call the backend API with the correct activity_type, quantity, and unit parameters.

---

### Requirement 16: Scope 3 Reporting by Category

**User Story:** As a sustainability manager, I want reports to break down Scope 3 emissions by all 15 GHG Protocol categories, so that I can identify hotspots and comply with ISO 14064-1 disclosure requirements.

#### Acceptance Criteria

1. THE Report_Generator SHALL group Scope 3 emissions by their GHG Protocol category number (1–15) in the PDF report.
2. WHEN a Scope 3 category has zero entries for the reporting period, THE Report_Generator SHALL still list the category with a zero value to demonstrate completeness of boundary assessment.
3. THE Report_Generator SHALL display both the category number and the category name in English and Turkish.
4. THE Dashboard SHALL display a breakdown chart showing Scope 3 emissions by category.

---

### Requirement 17: Seed Data for Missing Categories

**User Story:** As a system administrator, I want all 15 Scope 3 categories to have at least one default emission factor seeded in the database, so that the system is ready for use immediately after deployment.

#### Acceptance Criteria

1. THE Seed_Data SHALL include at least one EmissionFactor entry for each of the 15 GHG Protocol Scope 3 categories.
2. THE Seed_Data SHALL include EmissionFactor entries for the newly added categories: processing_sold, use_of_sold, downstream_leased.
3. WHEN the seed command is executed, THE system SHALL create EmissionFactor records for all 15 Scope 3 categories without errors.
4. THE Seed_Data SHALL include both a global factor and a Turkey-specific factor for categories where Turkey data is available.

---

### Requirement 18: Water Supply & Wastewater as Scope 3 Activity

**User Story:** As a sustainability manager, I want to log water supply and wastewater treatment emissions as Scope 3 activities, so that I can include water-related indirect emissions in the carbon footprint.

#### Acceptance Criteria

1. WHEN a user submits an activity of type "water" with a valid sub-type and quantity in m3, THE Factor_Lookup SHALL resolve the activity to the correct EmissionFactor slug.
2. THE Factor_Lookup SHALL support the following water sub-types: water_supply (m3), water_treatment (m3).
3. THE Factor_Lookup SHALL prefer Turkey-specific water emission factors (ATOM KABLO source) when available, falling back to global Defra factors.
4. WHEN a user submits a water activity with an unsupported sub-type, THE Factor_Lookup SHALL return a descriptive error message.

---

### Requirement 19: Bilingual Activity Type Labels

**User Story:** As a Turkish-speaking user, I want all Scope 3 activity type names and category labels to be available in Turkish, so that I can use the platform in my preferred language.

#### Acceptance Criteria

1. THE Dashboard SHALL display Scope 3 category names and sub-type labels in Turkish when the user language preference is set to Turkish.
2. THE AI_Chat SHALL understand Scope 3 activity descriptions provided in Turkish and map them to the correct activity_type.
3. THE translations file SHALL include Turkish translations for all 15 Scope 3 category names and all activity sub-type labels.
