# Methodology decision record MDR-S4-01 — negative recycling factors

| | |
|---|---|
| **Status** | **OPEN — awaiting the methodology owner.** No value, code, or signed inventory was changed. |
| Factors | `wt-01-recycling` (−0.125), `wt-03-recycling` (−0.506), `wt-04-recycling` (−9.1), all kg CO₂e per kg, global, 2024 |
| Prepared | 2026-10-23, Stage 4 audit |
| Builds on | `emissions/NEGATIVE_FACTORS_REVIEW.md` (2026-10-20), which left three items open; Stage 4 closes two of them with primary sources (§3) |
| Evidence files | `audit/stage4/evidence/` (SHA-256 in `evidence_manifest.md`) |

> **Stage 5 addendum (2026-10-23).** Your own documents now bear on this record. **Neither documented inventory contains a recycling credit:**
> the 2023 calculation document uses positive DEFRA 2023 waste factors (C&I open-loop/combustion 21.28 kg/t), and the 2024 file uses DEFRA 2024
> Waste management (recycling **+6.41061 kg/t**, landfill positive); purchased recycled-content metal is accounted with the closed-loop
> **material** factor (1,558.95 kg/t), not as a credit. So the three negative factors are not part of your documented methodology (and the
> `metal-recycled` catalog row is a *purchase* factor, not a credit). Provenance of EF-K3A-003/005/006 is still open. See `audit/stage5/decision_register.md` DR-07.

Evidence labels used below: **[V]** verified in a retrieved primary document · **[I]** inference from verified facts (stated as such) · **[U]** unverified / not located.

---

## 1. The question asked

Do the three negative factors represent **actual process emissions** or **avoided-emission credits**?

## 2. Answer

**They are avoided-emission (substitution) credits, not process emissions.**

| # | Evidence | Label |
|---|---|---|
| 1 | The catalog describes them as credits: *"negative: recycling avoids virgin production"* (paper), *"avoids virgin steel production"*, *"very high negative EF, avoids energy-intensive primary aluminium production"* (`emissions/seed_data.py`; also printed in the CSV export and the ISO report). | V (repository) |
| 2 | A recycling **process** emits CO₂e, so a process factor is positive. DESNZ 2024 publishes the treatment factors for these same materials as **positive**: paper, steel cans and aluminium cans, closed-loop recycling = **+6.41061 kg CO₂e per tonne** (+0.00641 per kg), IDs `20_506_5450_15_1`, `20_504_5373_15_1`, `20_504_5352_15_1`. The stored values are −125, −506 and −9,100 kg per tonne: opposite sign and 19×, 79× and 1,420× the size. | V (DESNZ 2024 workbook) |
| 3 | DESNZ explains why its figure is small: *"As defined under the Scope 3 standard, emissions associated with recycling and energy recovery are attributed to the organisation which uses the recycled material … The emissions attributed to the company which generates the waste cover only the collection of waste from their site and deposit at the first point of processing."* | V (DESNZ 2024 methodology paper §12.29, p.121) |
| 4 | `wt-04-recycling` (−9.1) equals the **negative of DESNZ's primary aluminium production factor** (9.10692 kg/kg, `19_504_5104_15_1`) to within 0.07%. So the credit equals the whole virgin-production burden: 1:1 substitution and zero recycling burden are assumed. | I (numerical equality; the catalog's own source is unavailable) |
| 5 | `wt-03` (−0.506) and `wt-01` (−0.125) match no difference of DESNZ primary vs closed-loop material values (steel cans 2.855 − 1.727 = 1.128; paper 1.283 − 1.063 = 0.220). Their derivation is unknown. | U |
| 6 | The cited source, *"CarbonIQ EF Katalogu EF-K3A-003 / -005 / -006"*, is not in the repository or any location searched in this or the earlier review. The label `source = defra_2024` is therefore unsupported. | U |

## 3. What the governing texts say (retrieved, not recalled)

**GHG Protocol Corporate Value Chain (Scope 3) Standard, Box 5.6, p.49 [V]:**

> "Companies should not report negative or avoided emissions associated with recycling in category 5 or category 12. Any claims of avoided emissions associated with recycling should not be included in, or deducted from, the scope 3 inventory, but may instead be reported separately from scope 1, scope 2, and scope 3 emissions. Companies that report avoided emissions should also provide data to support the claim that emissions are avoided (e.g., that recycled materials are collected, recycled, and used) and report the methodology, data sources, system boundary, time period, and other assumptions used to calculate avoided emissions."

Section 9.5 adds that avoided emissions outside the inventory "require a project accounting methodology".

**Precision about the strength of that text [V, §3.2 of the same standard]:** *"The term 'shall' … indicate[s] what is required … The term 'should' is used to indicate a recommendation, but not a requirement."* So netting the credits **departs from a recommendation**, not from a requirement. It does not by itself make a "conformance with the GHG Protocol Scope 3 Standard" claim impossible. Whether it is acceptable to your verifier is a separate question.

**ISO 14064-1:2018 [U]:** the standard is paywalled and was not retrieved. **This record makes no statement about what ISO 14064-1 requires** for avoided emissions or recycling credits. The methodology owner should check the clauses on emission reductions/removals and on exclusions with the verifier.

**Items the 2026-10-20 review left open, now closed:**
- *"DESNZ 2024 … positive … not confirmed against the DESNZ workbook itself"* → confirmed against the workbook (row 2 above).
- *"GHG Protocol … the standard's text was not reached"* → reached (this section).
- *Provenance of EF-K3A-003/005/006* → **still open** (row 6).

## 4. How the platform treats the credits today (code facts, not changed)

- The credit is **netted into Scope 3 and into the inventory total** (K3C5-2 waste in ISO Category IV, K3C12-1 end-of-life in Category V).
- Wherever a total containing a credit is shown, a sentence says it lowers the total and that the source is unverified: Dashboard, summary API (`avoided_credit`), Excel note row, emissions PDF, questionnaire message, ISO report assumption `EF-CREDIT`, AI assistant context. **The CSV export carries no note** (a trailing note would corrupt the data file).
- A regression test pins the behaviour: 400 kg paper recycling → −50 kg CO₂e. The Stage 4 test `test_the_negative_factors_are_exactly_the_three_recycling_credits` fails if a fourth negative factor appears.
- The development database holds **no entry** using these factors.

## 5. Size of the effect

| Recycled | Stored credit | DESNZ collection factor (closed-loop) | Difference |
|---|---|---|---|
| 1 t paper/board | −125 kg | +6.4 kg | 131 kg |
| 1 t steel | −506 kg | +6.4 kg | 512 kg |
| 1 t aluminium | −9,100 kg | +6.4 kg | 9,106 kg |
| 20 t aluminium | −182 t CO₂e | +0.13 t | **182 t**, larger than the entire Scope 1 of the Stage 3 test inventory (22.9 t) |

On the Stage 3 representative inventory the credit is −50 kg of 341,265 kg Scope 3 (0.015%), so it is invisible there. For a company with a material aluminium or steel stream it is not.

## 6. Options for the methodology owner

None is selected here. "Evidence" states what the verified sources do and do not support.

| Option | What changes | Evidence for / against | Cost and risk |
|---|---|---|---|
| **A. Keep, with disclosure** (today) | Nothing | Against: GHG Protocol recommendation (§3); source unverified; −9.1 assumes full 1:1 substitution; inconsistent with DESNZ. For: no change, disclosure already present. | Totals can be materially lowered by an unverified number; a verifier may challenge it. |
| **B. Report separately** | Credit leaves the Category IV/V and inventory totals and appears as a separate "avoided emissions (outside the scopes)" line | Consistent with Box 5.6. Requires, per Box 5.6, supporting data (collected, recycled, used) and a stated methodology, boundary and sources. The credit values still need a verified source. | Code change: entries flagged as credits; totals, Dashboard, exports (including the CSV), ISO report, PDFs. |
| **C. Replace with published treatment factors** | Value change to DESNZ-type positive collection factors (e.g. +6.41 kg/t closed-loop) with a documented edition and geography | Consistent with DESNZ §12.29 and Box 5.6. Caveat: DESNZ values are UK data; the methodology owner must accept UK data for Turkish companies or find a local source. | Needs explicit approval to change factor values; changes future results of any inventory that recycles these materials. |
| **D. Interim safeguard** | Hide the "recycling" choice for paper/steel/aluminium in K3C5-2 and K3C12-1 so no *new* credit enters an inventory | Prevents growth of the exposure while A/B/C is decided. Does not change existing entries. | Users lose a way to describe real recycling until implemented, unless it is entered at zero. |
| **E. B + C together** | Positive treatment factor in the total, and the avoided emissions reported separately with its evidence | Matches both the DESNZ and the GHG Protocol texts retrieved. | The largest change; both of the above risks. |

## 7. Decisions needed

1. Provenance: produce the CarbonIQ catalogue entries EF-K3A-003/005/006, or declare the three values unsupported.
2. Treatment: A / B / C / D / E, or other.
3. If C or E: which published factor, edition, geography and reference year.
4. Effective year(s), and what to do with **inventories already signed** with these credits: leave as signed (recommended default by the project's own rule that signed inventories are history) or recalculate with a separate, explicit authorisation.
5. Whether to check the ISO 14064-1:2018 clauses with the verifier before choosing.

## 8. Not done, on purpose

No factor value, no formula, no code path, no signed or approved inventory, and no production data was changed or recalculated. The existing disclosure and the guard test stay in force.

| Decision field | Entry |
|---|---|
| Decision (A / B / C / D / E / other) | |
| Source verified for EF-K3A-003 / -005 / -006 | |
| If C/E: replacement values, edition, geography, year | |
| Effective for inventory year(s) | |
| Treatment of already-signed inventories | |
| ISO 14064-1:2018 clauses checked with verifier (yes/no, by whom) | |
| Approved by (name, role) and date | |
