# Legacy duplicate-year inventories — safe recovery plan

## What they are

Before several inventories per year were allowed, some companies ended up with more than one inventory for the
same reporting year. Migration `0012` flagged those inventories (`legacy_duplicate_year = True`). Migration `0015`
deliberately leaves them **unlinked** (`ownership_linked = False`): their company-and-year rows were always shared
by the whole group, so no member can be proven to own any of them.

While unlinked, a member still **reads** exactly what it always read (the shared rows), so no historical
figure or report changes — but every write that could touch those shared rows is refused, so nothing can be
written or removed on a guess. The refusal is `409 inventory_not_ownership_scoped`, raised by
`questionnaire/immutability.py` (`lock_and_check` for writes, `assert_delete_allowed` for deletes) before anything
is written. It is deliberate and pinned by `questionnaire/test_inventory_tagging.py` and
`questionnaire/test_inventory_year_integrity.py`.

| Operation on an unlinked member | In the application |
|---|---|
| Read: open it, dashboard figures, summary, ISO report / PDF, exports | **Allowed** (unchanged) |
| Rename it | **Allowed** (refused only when it is signed) |
| Save a questionnaire step, a Workspace field, or a restart | **Refused** (`inventory_not_ownership_scoped`) |
| Delete it (even an empty draft) | **Refused** (`inventory_not_ownership_scoped`) |
| Save the sign-off step of a completed inventory (creates no entries) | **Allowed** |
| Any write to a signed member | **Refused** (`inventory_signed`, which takes precedence) |
| Assign, tag, copy or move its shared rows; set `ownership_linked`; delete it to "resolve" the group | **Operator-level only**, see the procedure below. Nothing in the application does this. |

Other inventories of the same company and year are not affected: a normal (linked) inventory of that year is
edited and deleted as usual and writes only rows tagged with its own id.

Nothing in the application assigns, tags, copies or moves the shared rows of such a group.

## What the development database contains (checked 2026-11-02, on a copy)

| Group | Members | Rows tagged to a member | Shared (NULL-inventory) rows of that year | Custom requests | Chats / targets |
|---|---|---|---|---|---|
| company 1, 2024 | 22 inventories (QA / E2E runs; 3 signed) | 0 | **0** | 0 | 0 / 0 |
| company 3, 2024 | 2 inventories ("QA 2024 Draft") | 0 | **0** | 0 | 0 / 0 |

No emission entry, custom request, chat session or reduction target of either company has that year, so
**no record is at stake and no historical calculation can change** whatever is decided. Each member's answers
and advisor approvals are tied to it by id and are intact (answers per member are in the evidence output).
The ambiguity is only that several inventories claim the same year.

## The review tool (read-only)

```
python manage.py review_duplicate_inventories --evidence [--company ID] [--json FILE]
```

Per group it reports, for every member: answers, advisor approvals, chats, targets, and the entries / requests
already tied to it by id; and for every company-and-year row that belongs to no inventory: the questionnaire
question it was made from and which members answered that question (the **candidates**). It writes nothing.
A candidate is evidence, never an owner. The verdict per row is one of:

* *not from a questionnaire answer (chat/form row)* — company-level by design; stays unassigned;
* *no member answered this question* — orphan, a person must decide;
* *one member answered it (candidate only)*;
* *N members answered it (ambiguous)*.

## Evidence needed before a row may be given to a member

For each shared row, **all** of the following, kept with the decision:

1. who entered it and when (`user`, `created_at`) against the member's answer history for that question;
2. the source document or the member's stored answer that yields that exact quantity and unit;
3. the factor used (`factor_value_snapshot`) matching what the member's saved answer resolves to;
4. confirmation by the company's owner/admin that the inventory is the intended one;
5. for a signed member, the signed version's recorded figures (a signed inventory's figures must not move).

## Procedure

1. `review_duplicate_inventories --evidence --json review.json` and take a database backup.
2. Groups reported *nothing a decision could change* (the dev database's two): no figure depends on the choice,
   but **the extra inventories cannot be deleted in the application** while they are unlinked (see the table
   above), and they stay frozen if they are kept. Removing one is an operator action, by the owner's decision, on
   the backed-up database, outside the app (for example a reviewed one-off script run in `manage.py shell`
   inside a transaction); no shipped command deletes or links inventories. After a duplicate is removed the
   remaining member is **still unlinked**: `--clear-resolved` clears only its `legacy_duplicate_year` flag, not
   `ownership_linked`, and migration `0015` ran once and is not re-run. It becomes editable only when an
   operator links it as in step 3 (for a group with no shared rows, that is just setting `ownership_linked`).
3. Groups with shared rows: a person fills in the evidence above per row. Only then does an operator, in one
   transaction, tag exactly the confirmed rows (`inventory = member`) from a reviewed mapping file, and clears
   `legacy_duplicate_year` / sets `ownership_linked` for the members that now own their rows. Rows nobody can
   evidence stay unassigned and are reported as `unassigned_records` in the summary; they are never given to
   the newest inventory.
4. After any step: `python manage.py test questionnaire emissions` and the calculation baseline
   (`CALC_BASELINE_CMP`) must be unchanged, and each member's total must equal the total before the step.

`--clear-resolved` (existing) only clears `legacy_duplicate_year` on an inventory that is alone in its year now; it
changes nothing else (it does not link the inventory or lift the refusal above).

`link_inventory_records --dry-run` (read-only) reports, per record, whether it could be linked to an inventory
safely; the backfill itself is not shipped and needs its own approval.
