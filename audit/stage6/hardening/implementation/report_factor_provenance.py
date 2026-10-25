"""Read-only: which signed / completed inventories could not be reconstructed if a factor changed (DR-19).

Nothing is saved, rebuilt, repriced or overwritten. For every locked inventory it re-runs the inventory's own calculation
inside the process, compares it with the approved entries on record, and classifies every entry:

  proven                        the entry references the factor row it was priced with; its value snapshot still matches
  record_inconsistent           the factor row no longer equals the entry's own snapshot (edited after the fact)
  unproven_reproducible_today   priced with a catalog factor that no entry records; today's row reproduces the stored figure
  unprovable                    priced with a catalog factor that is recorded nowhere AND today's rows no longer reproduce it
  answer_based                  the figure comes from the user's own answer (supplier factor, declaration, reported total)
  no_answer_behind_entry        the entry exists but no saved answer produces it
  entries_missing               the inventory has saved answers but no entries (a save would create them)

Inventory verdicts: provable | UNPROVABLE_REVIEW | RECORD_INCONSISTENT_REVIEW | ENTRIES_MISSING_REVIEW | no_entries."""
import csv

from django.core.management.base import BaseCommand

from questionnaire.applied_factors import provenance_report


class Command(BaseCommand):
    help = 'Read-only report of signed / completed inventories whose factor provenance cannot be proven (writes nothing to the database).'

    def add_arguments(self, parser):
        parser.add_argument('--csv', help='per-inventory summary')
        parser.add_argument('--steps-csv', help='per-step differences')
        parser.add_argument('--entries-csv', help='per-entry classification with missing provenance and recommended handling')

    def handle(self, *args, **opts):
        rows = provenance_report()
        summary = [r[0] for r in rows]
        if opts.get('csv'):
            with open(opts['csv'], 'w', encoding='utf-8-sig', newline='') as fh:
                w = csv.DictWriter(fh, fieldnames=list(summary[0]) if summary else ['report_id'])
                w.writeheader()
                w.writerows(summary)
        if opts.get('steps_csv'):
            with open(opts['steps_csv'], 'w', encoding='utf-8-sig', newline='') as fh:
                w = csv.writer(fh)
                w.writerow(['report_id', 'step', 'entries', 'stored_kg', 'recomputed_kg_now', 'delta_kg', 'calculated_entry', 'no_answer_behind_entries'])
                for s, steps, _entries in rows:
                    for x in steps:
                        w.writerow([s['report_id'], x['step'], x['entries'], x['stored_kg'], x['now_kg'],
                                    round(x['now_kg'] - x['stored_kg'], 4), x['calculated'], x['no_answer_behind_entries']])
        if opts.get('entries_csv'):
            with open(opts['entries_csv'], 'w', encoding='utf-8-sig', newline='') as fh:
                cols = ['report_id', 'status', 'entry_id', 'step', 'factor_slug', 'factor_id', 'quantity', 'kg', 'class',
                        'underlying_factor', 'missing_provenance', 'recommended_handling']
                w = csv.DictWriter(fh, fieldnames=cols)
                w.writeheader()
                for _s, _steps, entries in rows:
                    w.writerows(entries)
        counts = {}
        for s in summary:
            counts[s['verdict']] = counts.get(s['verdict'], 0) + 1
        self.stdout.write(f'{len(summary)} signed / completed inventories: {counts}')
        for s in summary:
            if s['verdict'] not in ('provable', 'no_entries'):
                self.stdout.write(f"  REVIEW report {s['report_id']} company {s['company_id']} {s['year']}: {s['verdict']} "
                                  f"unprotected steps={s['steps_unprotected_with_pins']} stored kg={s['unprotected_stored_kg']} "
                                  f"now kg={s['unprotected_now_kg']} drift={s['entries_value_drift']} mismatch={s['entries_qty_x_snapshot_mismatch']}")
