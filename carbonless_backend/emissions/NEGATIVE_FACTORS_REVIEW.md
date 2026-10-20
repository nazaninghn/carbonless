# Negative recycling factors — review for the methodology owner

**Status: UNRESOLVED.** No factor value was changed. The source of the three
factors could not be verified, and whether they may reduce an inventory total is a
methodology decision that has not been taken.

## The factors

| slug | value (kg CO₂e per kg) | label in the catalogue |
|---|---|---|
| `wt-01-recycling` | −0.125 | Paper/cardboard — recycling ("recycling avoids virgin production") |
| `wt-03-recycling` | −0.506 | Steel — recycling ("avoids virgin steel production") |
| `wt-04-recycling` | −9.1 | Aluminium — recycling ("very high negative EF, avoids energy-intensive primary aluminium production") |

All three are global, `scope3`, category `waste`, `source = defra_2024`, year 2024
(`emissions/seed_data.py`, "SCOPE 3 - WASTE — WT catalog").

## What they measure (from the repository's own descriptions)

- **Not process emissions.** A recycling *process* emits CO₂e, so its factor is
  positive. These values are negative and the catalogue explains them as the
  production that recycling *avoids*.
- **System boundary:** an avoided-burden / substitution credit — the emissions of
  producing the same quantity of virgin material, credited against the waste
  stream. The boundary of the credit (which virgin-production mix, which recycled
  content, closed or open loop, which recycling process emissions are netted off)
  is **not documented anywhere in the repository**.
- **Classification:** *avoided-emission credits*, not actual recycling emissions.

## Where they come from — what could and could not be verified

| Check | Result |
|---|---|
| Introduced | commit `4d1ea40` "questionary v3" (2026-08-06), `seed_data.py` |
| Cited source | `reference = "CarbonIQ EF Katalogu EF-K3A-003 / -006 / -005"` |
| That catalogue | **not in the repository, not on the project disks searched, not found in the connected Google Drive** (searched `EF-K3A-005`, `EF Katalogu`) |
| `source = defra_2024` | **unsupported**: the reference names an internal catalogue, not DESNZ/DEFRA |
| DESNZ 2024 | a third-party mirror lists aluminium cans (closed loop) at about **6.4 kg CO₂e per tonne** — positive, roughly 1,400× smaller than −9.1 per kg. *Not confirmed against the DESNZ workbook itself.* |
| Project's own spec | `.carbon/specs/scope3-full-categories/design.md` states "CO2e calculation is non-negative for valid inputs" (Property 8), which these factors contradict |
| GHG Protocol | secondary sources say avoided-emission credits are reported separately and not netted against the Scope 3 total. *The standard's text was not reached.* |

## Where they take effect

- **K3C5-2** (waste generated, ISO Category IV) and **K3C12-1** (end-of-life of sold
  products, ISO Category V) build the slug `<material>-<disposal method>`; a
  "recycling" choice for paper, steel or aluminium therefore applies a negative
  factor, and the entry **lowers** the Scope 3 and inventory totals.
- The questionnaire tells the user so ("Metal recycling produces negative
  emissions … This value reduces your total Scope 3 emissions").
- An existing test asserts the result (400 kg paper recycling → −50 kg CO₂e).
- The dev database held no entry using them at the time of the audit.

## What was done, and what was not

- **Done (numbers unchanged):** when an inventory contains such a credit, its
  assumptions section now states the amount, that it lowers the total, and that the
  source is unverified (`derive_assumptions`, step id `EF-CREDIT`;
  `RecyclingCreditDisclosureTests`).
- **Done:** a guard test fails if any *other* negative factor is added to the
  catalogue (`NegativeFactorReviewTests`).
- **Not done, on purpose:** no value changed, no replacement proposed, no netting
  rule changed. Replacement values must come from a verified source.

## Where the unverified-source warning is shown

Whenever approved entries use a negative factor, the amount and the sentence
"the source of these factors is not verified; the methodology decision is pending"
appear in:

| Place | How |
|---|---|
| Dashboard | amber note under the totals (`summary.avoided_credit`) |
| Summary API | `avoided_credit` = `{total_kg, entries, note: {tr, en}}`, `null` when none |
| Excel export | a note row under the data |
| Emissions PDF | a line under the executive summary |
| Questionnaire | the K3C5-2 warning text, and a method note right after an answer that uses such a factor |
| ISO report | assumptions section (`EF-CREDIT`) |
| AI assistant | its data context, so it states the caveat when quoting a total |

**Not annotated:** the CSV export (a trailing note would corrupt the data file;
the negative values are visible in it). Anyone using the CSV should read this
document.

## Decision requested from the methodology owner

1. **Provenance.** Produce the "CarbonIQ EF Katalogu" (or any primary source) for
   EF-K3A-003/005/006, or declare the three factors unsupported.
2. **Treatment.** Choose one:
   - **A — keep, disclosed (current).** Credits stay in the total with the
     disclosure above. Lowest effort; contested practice, and unsupported while the
     source is missing.
   - **B — report separately (recommended once provenance is settled).** Keep the
     credit out of the Category IV/V totals and show it as a separate "avoided
     emissions" line outside the inventory. Needs a code change (entries flagged as
     credits; totals, dashboard, exports and ISO report adjusted).
   - **C — replace with verified process factors.** Use published end-of-life
     recycling factors (e.g. DESNZ's waste-disposal table) with a documented source
     and reference year. Values to be taken from the source by the owner, not
     estimated.
3. **Interim safeguard until decided.** Either leave A in place, or hide the
   "recycling" option for paper/steel/aluminium in K3C5-2/K3C12-1 so no new credit
   enters an inventory.

Until the owner decides, treat any inventory that shows the `EF-CREDIT` assumption
as carrying an unverified credit.

## Decision record (to be completed by the methodology owner)

| Field | Entry |
|---|---|
| Decision (A keep + disclose / B report separately / C replace with verified factors / other) | |
| Source verified for EF-K3A-003 / -005 / -006 (document, version, page) | |
| If C: replacement values, their source and reference year | |
| Effective for inventories of year(s) | |
| Treatment of inventories already signed with these credits (leave as signed / recalculate with approval) | |
| Interim: hide "recycling" for paper, steel, aluminium until implemented? (yes / no) | |
| Approved by (name, role) and date | |

Until this record is completed, the factors stay as they are and every
presentation of a total that contains them carries the warning above. A
recalculation of any signed inventory needs an explicit, separate authorisation
(see the applied-connection snapshot work for how signed inventories are protected).

