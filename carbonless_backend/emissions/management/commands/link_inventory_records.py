"""Multi-inventory, stage 2: which existing records could be linked to an inventory.

    python manage.py link_inventory_records --dry-run [--json]

Read-only report. For every emission entry, custom factor request, reduction
target and chat session it says whether the record could be linked to an
inventory (CarbonReport) safely, and if not, why:

* linkable      the record's company and year are covered by exactly one
                inventory, so that inventory is unambiguously its owner;
* no_inventory  no inventory of the company covers the year;
* ambiguous     several inventories of the company cover the year (legacy
                duplicate-year groups) — ownership cannot be decided from data;
* no_company    the record has no company;
* no_year       the record has no year to match (chat sessions).

Every record that is not linkable stays "Not assigned to an inventory".

Only --dry-run exists at this stage: the backfill itself is a separate, later
step that needs its own approval. The dry run cannot write: it reads only
columns that existed before the inventory link was added (so it also runs on
a database without that migration), and while it runs the connection refuses
any statement that is not a read. Nothing is saved, updated, deleted, merged,
copied, recalculated or repriced; legacy duplicate-year inventories stay as
they are (locked).
"""
import json
from collections import Counter, defaultdict

from django.core.management.base import BaseCommand, CommandError
from django.db import connection

NOT_ASSIGNED = 'Not assigned to an inventory'
REASONS = {
    'no_inventory': 'no inventory of the company covers this year',
    'ambiguous': 'several inventories of the company cover this year (legacy duplicate-year group)',
    'no_company': 'the record has no company',
    'no_year': 'the record has no year to match an inventory by',
}
READ_ONLY_PREFIXES = ('SELECT', 'WITH', 'PRAGMA', 'EXPLAIN')


class ReadOnlyViolation(Exception):
    pass


def _block_writes(execute, sql, params, many, context):
    if not str(sql).lstrip().upper().startswith(READ_ONLY_PREFIXES):
        raise ReadOnlyViolation(f'dry run attempted a write: {str(sql)[:120]}')
    return execute(sql, params, many, context)


def build_report():
    """The dry-run report as plain data (no database writes)."""
    from chat.models import ChatSession
    from emissions.models import CustomEmissionRequest, EmissionEntry, ReductionTarget
    from questionnaire.models import CarbonReport

    inventories = list(CarbonReport.objects.order_by('id').values(
        'id', 'company_id', 'reporting_year', 'title', 'status', 'legacy_duplicate_year', 'signed_at'))
    by_key = defaultdict(list)
    for inv in inventories:
        if inv['reporting_year'] is not None:
            by_key[(inv['company_id'], inv['reporting_year'])].append(inv)

    def classify(company_id, year):
        if company_id is None:
            return 'no_company', None
        if year is None:
            return 'no_year', None
        owners = by_key.get((company_id, year), [])
        if len(owners) == 1:
            return 'linkable', owners[0]
        return ('ambiguous' if owners else 'no_inventory'), None

    sources = [
        ('EmissionEntry', EmissionEntry.objects.order_by('id').values(
            'id', 'company_id', 'year', 'status', 'description', 'calc_detail'), 'year'),
        ('CustomEmissionRequest', CustomEmissionRequest.objects.order_by('id').values(
            'id', 'company_id', 'year', 'status'), 'year'),
        # A target is set against its base year's inventory.
        ('ReductionTarget', ReductionTarget.objects.order_by('id').values(
            'id', 'company_id', 'base_year', 'target_year', 'title'), 'base_year'),
        # A conversation has no year: it cannot be matched to an inventory from existing data.
        ('ChatSession', ChatSession.objects.order_by('id').values('id', 'company_id', 'title'), None),
    ]

    totals, linked, unlinked = {}, [], []
    for model, rows, year_field in sources:
        counts = Counter()
        for row in rows:
            year = row.get(year_field) if year_field else None
            kind, owner = classify(row['company_id'], year)
            counts[kind] += 1
            item = {'model': model, 'id': row['id'], 'company_id': row['company_id'], 'year': year}
            if kind == 'linkable':
                linked.append({**item, 'inventory_id': owner['id'],
                               'inventory_locked_legacy': bool(owner['legacy_duplicate_year'])})
            else:
                extra = {}
                if model == 'EmissionEntry':
                    extra = {'status': row['status'], 'from_questionnaire': row['calc_detail'] is not None,
                             'description': (row['description'] or '')[:80]}
                unlinked.append({**item, 'reason': kind, 'reason_text': REASONS[kind], 'label': NOT_ASSIGNED, **extra})
        totals[model] = {'inspected': sum(counts.values()), 'linkable': counts['linkable'],
                         'no_inventory': counts['no_inventory'], 'ambiguous': counts['ambiguous'],
                         'no_company': counts['no_company'], 'no_year': counts['no_year']}

    # Unexpected / noteworthy conditions.
    legacy = [inv for inv in inventories if inv['legacy_duplicate_year']]
    groups = {k: v for k, v in by_key.items() if len(v) > 1}
    findings = []
    stale_flags = [inv['id'] for inv in legacy
                   if inv['reporting_year'] is not None and len(by_key[(inv['company_id'], inv['reporting_year'])]) == 1]
    if stale_flags:
        findings.append(f'{len(stale_flags)} inventory(ies) flagged legacy_duplicate_year are now alone in their '
                        f'company-year (the duplicate was resolved but the flag remains): {stale_flags}')
    unflagged_dups = [inv['id'] for v in groups.values() for inv in v if not inv['legacy_duplicate_year']]
    if unflagged_dups:
        findings.append(f'{len(unflagged_dups)} inventory(ies) share a company-year without the legacy flag '
                        f'(the unique constraint should prevent this): {unflagged_dups}')
    no_year_inv = [inv['id'] for inv in inventories if inv['reporting_year'] is None]
    if no_year_inv:
        findings.append(f'{len(no_year_inv)} inventory(ies) have no reporting year and can own nothing yet: {no_year_inv}')
    orphans = [u['id'] for u in unlinked if u['model'] == 'EmissionEntry' and u['reason'] == 'no_inventory'
               and u.get('from_questionnaire')]
    if orphans:
        findings.append(f'{len(orphans)} questionnaire-calculated emission entry(ies) have no inventory for their '
                        f'company-year (left from a deleted inventory?): {orphans}')
    for (company_id, year), v in sorted(groups.items(), key=lambda kv: (kv[0][0] or 0, kv[0][1])):
        findings.append(f'company {company_id}, {year}: {len(v)} inventories {[i["id"] for i in v]} '
                        f'({"all" if all(i["legacy_duplicate_year"] for i in v) else "not all"} legacy-flagged, '
                        f'{sum(1 for i in v if i["signed_at"])} signed) - records of this company-year are ambiguous')

    return {
        'mode': 'dry-run (read-only)',
        'inventories': {'total': len(inventories), 'legacy_duplicate_year': len(legacy),
                        'legacy_ids': [inv['id'] for inv in legacy],
                        'duplicate_company_years': len(groups), 'without_reporting_year': len(no_year_inv)},
        'totals': totals,
        'linked': linked,
        'unlinked': unlinked,
        'findings': findings,
    }


class Command(BaseCommand):
    help = 'Report (read-only) which existing records could be linked to an inventory. Only --dry-run exists yet.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Report only; never writes (required at this stage).')
        parser.add_argument('--json', action='store_true', help='Print the report as JSON.')

    def handle(self, *args, **opts):
        if not opts['dry_run']:
            raise CommandError('Only --dry-run is available: linking existing records is a separate step that has '
                               'not been approved yet. Nothing was changed.')
        with connection.execute_wrapper(_block_writes):
            report = build_report()
        if opts['json']:
            self.stdout.write(json.dumps(report, indent=2, default=str))
            return
        self._print(report)

    def _print(self, r):
        w = self.stdout.write
        w('LINK INVENTORY RECORDS - DRY RUN (read-only; nothing is written)\n')
        inv = r['inventories']
        w(f'Inventories: {inv["total"]} total, {inv["legacy_duplicate_year"]} flagged legacy_duplicate_year '
          f'(left locked), {inv["duplicate_company_years"]} company-year(s) with more than one, '
          f'{inv["without_reporting_year"]} without a reporting year\n')
        w(f'{"model":24} {"inspected":>9} {"linkable":>9} {"no inv.":>8} {"ambiguous":>10} {"no comp.":>9} {"no year":>8}')
        for model, t in r['totals'].items():
            w(f'{model:24} {t["inspected"]:>9} {t["linkable"]:>9} {t["no_inventory"]:>8} {t["ambiguous"]:>10} '
              f'{t["no_company"]:>9} {t["no_year"]:>8}')
        w(f'\nWOULD BE LINKED ({len(r["linked"])}):')
        for x in r['linked']:
            lock = '  [target inventory is legacy-flagged: stays locked]' if x['inventory_locked_legacy'] else ''
            w(f'  {x["model"]} #{x["id"]}  company {x["company_id"]}, {x["year"]}  ->  inventory #{x["inventory_id"]}{lock}')
        w(f'\nWOULD STAY UNLINKED - "{NOT_ASSIGNED}" ({len(r["unlinked"])}):')
        for x in r['unlinked']:
            more = ''
            if x['model'] == 'EmissionEntry':
                more = f'  [{x["status"]}{", questionnaire" if x["from_questionnaire"] else ""}] {x["description"]!r}'
            w(f'  {x["model"]} #{x["id"]}  company {x["company_id"]}, {x["year"]}  -  {x["reason"]}: {x["reason_text"]}{more}')
        w(f'\nFINDINGS ({len(r["findings"])}):')
        for f in r['findings'] or ['none']:
            w(f'  - {f}')
