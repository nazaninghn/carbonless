"""One factor for one source, wherever it is entered.

The questionnaire calculates an inventory on the factor standard chosen in
question D1 and on the edition of the inventory year
(`factor_lookup.pick_factor`). An entry made OUTSIDE the questionnaire — the
dashboard form, the AI chat, the Workspace — must use that same row, or the
same litre of diesel would have two factors inside one inventory.

This module only decides WHICH row applies (mapping). It holds no factor
value and no formula: the row comes from `pick_factor`, the amount is still
quantity × factor.

The inventory that decides is the one that will hold the entry:
* the inventory the client named, else
* the only inventory of the company and year (it reads the company-level
  rows of that year — see `inventory_scope.reads_unassigned_rows`), else
* none: the platform catalogue (a year with no inventory, or with several
  and none named).
"""
import contextlib

from .factor_lookup import (STANDARD_UNSET, active_standard, inventory_standard_scope, pick_factor,
                            standard_gap_message)

QUESTIONNAIRE_PREFIX = 'Questionnaire step '


def _as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def holding_inventory(company, year, inventory=None):
    """The inventory an entry of `company` and `year` is read by, or None."""
    if inventory is not None:
        return inventory
    from .inventory_scope import sole_inventory_for
    return sole_inventory_for(company, _as_int(year))


@contextlib.contextmanager
def entry_standard_scope(company, year, inventory=None):
    """Calculate inside the block on the standard of the inventory that holds
    an entry of `company` and `year`. A standard already in force (the request
    named an inventory) is kept."""
    if inventory is None and active_standard():
        yield
        return
    with inventory_standard_scope(holding_inventory(company, year, inventory)):
        yield


def _row_for(chosen, year):
    """The row of the chosen source under the standard in force, for `year`:
    the source's own country first, then the global row — the order the
    questionnaire uses (`step_entries._factor_by_slug`)."""
    picked = pick_factor(chosen.slug, chosen.country, year)
    if picked is None and chosen.country != 'global':
        picked = pick_factor(chosen.slug, 'global', year)
    if picked is not None and picked.unit != chosen.unit:
        return None        # another unit is another quantity: never applied to the amount as entered
    return picked


def factor_for_entry(chosen, company, year, inventory=None):
    """(factor, error) — the row the questionnaire would use for the source
    the user chose (`chosen`, an EmissionFactor), in the inventory that holds
    the entry. `error` is the bilingual "not calculated" message when the
    standard in force publishes no factor for it."""
    if chosen is None:
        return None, None
    with entry_standard_scope(company, year, inventory):
        standard = active_standard()
        if not standard:
            # The catalogue: the edition of the entry year where the source has several
            # (grid electricity); a row the catalogue does not offer by default is kept as chosen.
            if chosen.standard:
                # A standard's row named for an inventory that is not on that standard.
                picked = pick_factor(chosen.slug, 'global', year) or pick_factor(chosen.slug, 'turkey', year)
                if picked is None or picked.unit != chosen.unit:
                    return None, catalogue_only_message(chosen)
                return picked, None
            if not chosen.is_default:
                return chosen, None
            picked = pick_factor(chosen.slug, chosen.country, year)
            return (picked if picked is not None and picked.unit == chosen.unit else chosen), None
        picked = _row_for(chosen, year)
        if picked is None:
            return None, standard_gap_message(chosen.name, chosen.unit, chosen.slug)
        return picked, None


def catalogue_only_message(chosen):
    return (f"'{chosen.name}' belongs to a factor standard this inventory does not use — choose the source "
            f"from the list again. / '{chosen.name_tr or chosen.name}' bu envanterin kullanmadığı bir faktör "
            f"standardına ait — kaynağı listeden yeniden seçin.")


def split_message(message, lang='en'):
    """The English or Turkish half of an "English / Türkçe" message."""
    parts = [p.strip() for p in (message or '').split(' / ', 1)]
    return parts[1] if lang == 'tr' and len(parts) == 2 else parts[0]


def factors_for_inventory(inventory):
    """The sources an entry of `inventory` can be made with, each as the row
    the questionnaire would use: one row per catalogue source, replaced by the
    row of the inventory's standard and year. A source the standard does not
    publish is left out (it cannot be calculated in this inventory)."""
    from .models import EmissionFactor
    year = inventory.reporting_year
    out, seen = [], set()
    with inventory_standard_scope(inventory):
        catalogue = EmissionFactor.objects.filter(is_active=True, is_default=True, standard='').order_by('pk')
        if not active_standard():
            return list(catalogue)
        for chosen in catalogue:
            picked = _row_for(chosen, year)
            if picked is not None and picked.pk not in seen:
                seen.add(picked.pk)
                out.append(picked)
    return out


def _outside_entries(inventory):
    """The inventory's entries that do not come from questionnaire answers
    (form, chat, Workspace), with a factor that is a real source (not the
    "calculated" carrier rows)."""
    from .inventory_scope import entries_of
    return (entries_of(inventory).exclude(description__startswith=QUESTIONNAIRE_PREFIX)
            .exclude(emission_factor__slug__startswith='calculated-')
            .select_related('emission_factor', 'facility'))


def inventory_standard_of(inventory):
    with inventory_standard_scope(inventory):
        return active_standard()


def off_standard_entries(inventory):
    """Entries made outside the questionnaire whose factor is not the row the
    inventory's standard and year prescribe: [(entry, wanted_row_or_None)].
    Empty for an inventory on the platform catalogue."""
    if inventory is None or not inventory.reporting_year:
        return []
    out = []
    with inventory_standard_scope(inventory):
        if not active_standard():
            return []
        for entry in _outside_entries(inventory):
            wanted = _row_for(entry.emission_factor, entry.year)
            if wanted is None or wanted.pk != entry.emission_factor_id:
                out.append((entry, wanted))
    return out


def rebase_outside_entries(inventory):
    """After the inventory's standard changed: put every entry made outside
    the questionnaire on the row of the new standard (quantity unchanged, so
    the amount is quantity × that row). An entry whose source the standard
    does not publish is left exactly as it is — never deleted, never counted
    as zero — and stays listed by `off_standard_entries`. Returns the number
    of entries moved."""
    moved = 0
    for entry, wanted in off_standard_entries(inventory):
        if wanted is None:
            continue
        entry.emission_factor = wanted
        entry.factor_value_snapshot = wanted.factor_kg_co2e
        entry.factor_source_snapshot = wanted.source
        entry.save()        # EmissionEntry.save(): calculated_co2e_kg = quantity × factor
        moved += 1
    return moved


_LABEL = {'defra': 'DEFRA', 'ipcc': 'IPCC', 'ghg': 'GHG Protocol', STANDARD_UNSET: 'mixed / karma'}


def off_standard_notes(inventory):
    """[{entry_id, tr, en}] — said plainly on the dashboard: these amounts are
    in the inventory on a factor of another basis than its standard."""
    rows = [(e, w) for e, w in off_standard_entries(inventory) if w is None]
    if not rows:
        return []
    standard = inventory_standard_of(inventory)
    label = _LABEL.get(standard, standard)
    out = []
    for entry, _ in rows:
        f = entry.emission_factor
        if standard == STANDARD_UNSET:
            en = (f'"{f.name}" ({entry.year}/{entry.month:02d}) was entered outside the questionnaire. This inventory '
                  f'chooses its factor standard on each questionnaire question, so this amount stays on the factor it '
                  f'was entered with; enter it in the questionnaire to choose its standard.')
            tr = (f'"{f.name_tr or f.name}" ({entry.year}/{entry.month:02d}) anket dışında girildi. Bu envanter faktör '
                  f'standardını her anket sorusunda seçtiği için bu miktar girildiği faktörle duruyor; standardını '
                  f'seçmek için miktarı ankette girin.')
        else:
            en = (f'"{f.name}" ({entry.year}/{entry.month:02d}) was entered outside the questionnaire and is calculated '
                  f'with the factor it was entered with: the standard of this inventory ({label}) publishes no factor '
                  f'for this source.')
            tr = (f'"{f.name_tr or f.name}" ({entry.year}/{entry.month:02d}) anket dışında girildi ve girildiği faktörle '
                  f'hesaplanıyor: bu envanterin standardı ({label}) bu kaynak için faktör yayımlamıyor.')
        out.append({'entry_id': entry.pk, 'en': en, 'tr': tr})
    return out
