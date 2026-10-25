# DR-11 decision note: methane GWP and IPCC sector tier in the ISO gas table

**Status: HOLD. Nothing was changed.** `gas_split_data.py` still uses CH₄ 29.8 and the stored tiers. This note separates three questions that the earlier
register ran together, states what each source actually says, and lists what you would need to decide. It does not recommend a value from the size of
its effect.

Evidence used (all retrieved; hashes in `audit/stage4/evidence/SHA256SUMS.txt` and `audit/stage5/evidence/SHA256SUMS_AR6.txt`):
GHG Protocol "IPCC Global Warming Potential Values" v2.0 (Aug 2024); IPCC AR6 WG1 Ch.7 Supplementary Material Table 7.SM.7; IPCC 2006 Guidelines Vol.2 Ch.2
Tables 2.2 to 2.5. **Not retrieved:** ISO 14064-1:2018 (paywalled), so nothing below states what ISO requires; AR6 Table 7.15 itself (its numeric rows could
not be text-extracted; the fossil and non-fossil values below are read from the GHG Protocol's AR6 column).

## 1. Which methane GWP, and its fossil / non-fossil classification

| Value | What it is | Where it is stated | Where the platform or you use it |
|---|---|---|---|
| **29.8** | AR6 GWP-100, methane **fossil** | GHG Protocol table (AR6 column) | `gas_split_data.GWP_CH4_FOSSIL`; the ISO report's GWP table ("Methane (fossil)") |
| **27.0** | AR6 GWP-100, methane **non-fossil** | GHG Protocol table (AR6 column) | not used |
| **27.9** | AR6 GWP-100 for methane in the supplementary table (one methane row, no fossil / non-fossil split) | AR6 7.SM.7 (row "Methane CH4 … 27.9 …") | your 2023 calculation document |

What the GHG Protocol instruction says (quoted from the retrieved document, p.1): the **fossil** value "should be used for methane emissions from fossil fuel
fugitive emission sources (e.g., oil & gas systems, coal mining) and industrial processes where carbon in methane is of fossil origin"; "**all other sources of
methane emissions, including from combustion of fossil fuels, should use the Methane - non-fossil GWP value**", because the fossil value "includes the added
radiative forcing effect from CO₂ that is formed from the oxidation of methane" and applying it to combustion "would be double counting". It is guidance for
GHG Protocol-based inventories, not a rule of ISO 14064-1 or of IPCC.

What this means for the platform: the CH₄ in `gas_split_data` is **combustion** methane (the fuel profiles are stationary and mobile combustion). Read literally,
the GHG Protocol text points to 27.0 for it, not to 29.8 and not to 27.9. Your documents use 27.9 and the platform uses 29.8, so **three** values are in play.
Open points for you:
1. Which authority governs the platform's methane classification: the GHG Protocol instruction (27.0), the single-row AR6 value your documents use (27.9), or the fossil value (29.8)?
2. Whether the ISO report's GWP table and the apportionment constant must be the **same** number (today they are, 29.8). If you change one, the other and the footnote must change together.
3. Whether the verifier you work with has a stated preference (ISO 14064-1 clauses not reviewed here).

## 2. Which IPCC sector tier (natural gas, diesel, LPG)

IPCC 2006 gives separate default CH₄ / N₂O factors (kg per TJ, net calorific basis) by **the sector in which the fuel is burned**. Retrieved values (CH₄ / N₂O):

| Fuel | Energy industries (T 2.2) | Manufacturing & construction (T 2.3) | Commercial / institutional (T 2.4) | Residential, agriculture… (T 2.5) | Platform uses |
|---|---|---|---|---|---|
| Natural gas | 1 / 0.1 | 1 / 0.1 | 5 / 0.1 | 5 / 0.1 | **5 / 0.1** (commercial) |
| Gas / diesel oil | 3 / 0.6 | 3 / 0.6 | 10 / 0.6 | 10 / 0.6 | **10 / 0.6** (commercial) |
| LPG | 1 / 0.1 | 1 / 0.1 | 5 / 0.1 | 5 / 0.1 | **5 / 0.1** (commercial) |
| Residual fuel oil | 3 / 0.6 | 3 / 0.6 | 10 / 0.6 | 10 / 0.6 | 3 / 0.6 (manufacturing / energy row) |
| Other bituminous coal | 1 / 1.5 | 10 / 1.5 | 10 / 1.5 | 300 / 1.5 | 10 / 1.5 (manufacturing row) |

(CO₂ is 56,100 / 74,100 / 63,100 / 77,400 / 94,600 kg/TJ in every sector, so the tier only moves CH₄ and N₂O.)

Facts that bear on the choice:
* The tier follows the **activity that burns the fuel**, not the company's legal form. A manufacturer's process or boiler fuel is category 1A2 (Table 2.3); an office or retail building's heating is 1A4a (Table 2.4); a farm is 1A4c (Table 2.5).
* The platform applies **one tier per fuel regardless of the company**, and the profiles are inconsistent with each other: natural gas, gas/diesel oil and LPG use the commercial rows, while coal and residual fuel oil use manufacturing / energy rows.
* Your documented inventory (a cable manufacturer) uses the manufacturing values (CH₄ 1 for natural gas, 3 for diesel). That is the correct tier **for that company's activity**; it is not evidence about a service company.
* The platform stores a company activity description and NACE code, so a sector-dependent tier is technically possible; whether to use it, and how to treat a mixed-activity site, is a methodology choice not made here.
Open points for you: (a) one platform-wide tier or tier by declared activity; (b) if by activity, the mapping from NACE / activity to IPCC category and the default for undeclared or mixed sites; (c) whether coal and residual fuel oil should follow the same rule.

## 3. Effect on the reported CH₄ total and on the ISO disclosure (measured, disposable DB)

Stage 3 inventory (396,315.30 kg; **totals never change**, only how a fixed CO₂e total is divided):

| Scenario | CH₄ t | change | printed table (2 dp) |
|---|---|---|---|
| current: 29.8, commercial rows | 0.0642 | | CO₂ 396.24, CH₄ 0.06, N₂O 0.02 |
| 27.9 | 0.0601 | −4.1 kg | unchanged |
| 27.0 | 0.0582 | −6.0 kg | unchanged |
| 27.9 + manufacturing rows | 0.0131 | −51.1 kg | CH₄ 0.01, CO₂ 396.29 |
| 27.0 + manufacturing rows | 0.0126 | −51.6 kg | CH₄ 0.01, CO₂ 396.29 |

Per-fuel CH₄ share of a factor (current → 27.0 + manufacturing): natural gas 0.265% → 0.048%; diesel 0.400% → 0.109%; LPG 0.236% → 0.043%
(`dr11_gas_shares_per_factor.csv`). Because the share is small, the effect on the CH₄ line is large in relative terms and negligible in tonnes of CO₂e.

Disclosure implications if either choice is changed (to be done together, after your decision):
* The ISO PDF's GWP table (`GWP_AR6` in `iso_report_pdf.py`: CH₄ 29.8, "Methane (fossil)") and the apportionment constant must stay identical.
* The gas footnote says the split follows "the IPCC default emission factors for that fuel and combustion type"; it does not say **which sector table**. If the tier becomes activity-dependent, the footnote (EN + TR) should name the category used.
* Every signed inventory's printed gas columns would change on regeneration while its total stays fixed. Because the split is re-derived by `seed_gas_splits` into the factor rows, a change would alter the CH₄/CO₂ columns of already-signed reports unless the split is also pinned per inventory (DR-19 does not cover the split fields; this would need to be added).
* Whether historical reports should be regenerated with the old or the new split is your decision.

## 4. What I need from you to proceed (no implementation until you answer)

| # | Decision | Options |
|---|---|---|
| 1 | Methane value for combustion CH₄ | 29.8 (keep) · 27.9 · 27.0 · other, with the stated authority |
| 2 | Whether ISO table and split constant must match | yes (recommended consistency check) · no, with reason |
| 3 | Tier policy | keep commercial for gas/diesel/LPG · manufacturing for all · tier by declared activity (mapping to be agreed) |
| 4 | Treatment of coal and residual fuel oil | follow the same rule · keep as is |
| 5 | Effective inventory year and signed inventories | new year rows only (recommended) · regenerate history (needs separate approval) |
