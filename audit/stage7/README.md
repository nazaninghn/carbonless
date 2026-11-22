# Stage 7: factor standards review (November 2026)

Review of the factor-standards work merged in PR #149 and #150, and what was done about it.

| File | What it is |
|---|---|
| `carbonless_factors_vs_DEFRA.xlsx` | The mapping workbook: every catalogue factor against DEFRA editions 2014–2026 |
| `Carbonless_calculation_questions_assessment.md` | Assessment of GWP policy, fuel density, the DEFRA mapping and TUR_NID_2024 |
| `DEFRA_mapping_review.xlsx` | Row-by-row mapping review: 48 exact, 46 acceptable, 48 unresolved slugs |
| `Carbonless_PR149_150_safety_and_impact_review.md` | Impact of the two PRs, calculation paths, report issuance |
| `PR149_150_impact_and_unresolved_register.xlsx` | PR impact register (19 items) and the register of the 48 unresolved mappings |
| `RE_REVIEW_2026-11-22_new_sources_govern.md` | Re-review of those 48 on the basis that the client's sources govern: 33 selectable again, 15 withheld |

## What was applied afterwards

Policy given by the owner on 2026-11-22 and applied to the factor rows:

1. No universal GWP set: every row of a standard records the GWP source and version it was built with (`EmissionFactor.gwp_basis`), and the ISO report states it.
2. No universal density: the 24 IPCC / GHG Protocol per-litre and per-m³ rows, which rest on a DEFRA 2026 density, are **withheld**.
3. Of the 48 DEFRA mappings first judged unresolved, **15 are withheld**; 18 were released and 15 re-mapped to the row DEFRA publishes for the item, once the owner stated that the client's sources govern and the earlier catalogue decisions do not (`RE_REVIEW_2026-11-22_new_sources_govern.md`).
4. TUR_NID_2024 stays outside the factor library.
5. A withheld row never produces a number: the activity is reported as "not calculated — factor under review".

Withheld rows are listed with their reasons in `carbonless_backend/emissions/data/withheld_factors.json`. A row is released only by removing it from that file after its mapping, density or method is individually resolved and approved.

## Not done here

- Policy 6 (no final signed or conformity-claiming report while required calculations are unmet) is **not implemented**: what counts as a required calculation is still to be decided.
- The values of the remaining IPCC / GHG Protocol rows are unchanged. Their GWP assignment (AR5 for "IPCC", the GHG Protocol AR6 column for "GHG Protocol") and the single IPCC sector tier remain the implementer's choices, open as DR-02a and DR-11.
- New inventories still have to choose one of the four standards; the platform catalogue is not offered for new work.
