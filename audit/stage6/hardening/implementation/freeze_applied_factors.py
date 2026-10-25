"""Deployment step for DR-19. DRY RUN unless --apply. Run report_factor_provenance first and review it.

For each signed / completed inventory that has no frozen map:
  * verdict provable / no_entries      -> frozen now (basis 'deploy_time': UNPROVEN, today's rows, not evidence of signing-time rows)
  * verdict UNPROVABLE / ENTRIES_MISSING / RECORD_INCONSISTENT -> NOT frozen and NOT rebuilt: put on HOLD. Every automatic
    rebuild route (questionnaire save, Workspace sync, resync) then refuses to touch it and writes a history row, until a person
    releases the hold with a reason (release_inventory_hold). Nothing is repriced, rebuilt or overwritten.
Run this before any new factor row is added."""
from django.core.management.base import BaseCommand

from questionnaire.applied_factors import DEPLOY, HOLD_VERDICTS, freeze_applied_factors, locked_q, normalise, provenance_report, set_hold
from questionnaire.models import CarbonReport


class Command(BaseCommand):
    help = 'Freeze the factor map of legacy signed / completed inventories; hold the ones that cannot be proven (dry run unless --apply).'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')

    def handle(self, *args, **opts):
        verdicts = {s['report_id']: s['verdict'] for s, _steps, _ents in provenance_report()}
        todo = [r for r in CarbonReport.objects.filter(locked_q()).order_by('pk') if not normalise(r.applied_factors)['frozen_at']]
        hold = [r for r in todo if verdicts.get(r.pk) in HOLD_VERDICTS]
        freeze = [r for r in todo if r not in hold]
        self.stdout.write(f'{len(todo)} locked inventories have no frozen factor map. '
                          f'To freeze: {[r.pk for r in freeze]}. To put on hold (not frozen, not rebuilt): '
                          f'{[(r.pk, verdicts[r.pk]) for r in hold]}')
        if not opts['apply']:
            self.stdout.write('dry run: nothing written (use --apply)')
            return
        for r in hold:
            set_hold(r, verdicts[r.pk])
        done = sum(1 for r in freeze if freeze_applied_factors(r, basis=DEPLOY))
        self.stdout.write(f'frozen: {done}; held: {len(hold)}')
