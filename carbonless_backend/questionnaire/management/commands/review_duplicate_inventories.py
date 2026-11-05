"""List companies that have more than one inventory for the same reporting year.

A company can have one inventory per year: emission entries belong to the company
and year, so a second inventory shares (and used to overwrite) the first one's
numbers. Groups that existed when the rule was introduced were flagged by migration
0012 (`legacy_duplicate_year`) and left exactly as they were, unlinked by migration 0015. None of their members
can be saved, restarted or deleted in the app (409 `inventory_not_ownership_scoped`) until an operator resolves
their ownership (see LEGACY_INVENTORY_RECOVERY.md) — and this command shows what is waiting.

    python manage.py review_duplicate_inventories                  # read-only
    python manage.py review_duplicate_inventories --company 7
    python manage.py review_duplicate_inventories --clear-resolved # clears the flag of rows that are
                                                                   # alone in their year now (nothing else)
    python manage.py review_duplicate_inventories --evidence       # read-only: what each group's records show
    python manage.py review_duplicate_inventories --evidence --json review.json
Nothing is ever deleted or recalculated here.

--evidence (read-only) is the manual-review aid for the groups that stay unlinked. For each group it lists, per
member, the answers, approvals, chat sessions, targets and rows that are ALREADY tied to it by id; and, for the
company-and-year rows that belong to no inventory, which members answered the question each row was made from
("candidates"). A candidate is evidence, never an owner: nothing is assigned, tagged or changed. A group with no
records at stake is reported as such; a group with shared rows lists what a person must decide (the `needs`
line). Ownership is only ever settled by a person: an operator, with a signed-off mapping, outside the app
(the app refuses to delete or edit an unlinked inventory); never by this command.
"""
from django.core.management.base import BaseCommand
from django.db.models import Count


class Command(BaseCommand):
    help = "List duplicate (company, year) inventory groups (read-only; --clear-resolved clears resolved flags only)."

    def add_arguments(self, parser):
        parser.add_argument('--company', type=int, default=None, help='Only this company id.')
        parser.add_argument('--evidence', action='store_true',
                            help='Read-only: per group, what each member owns and which members could own the shared rows.')
        parser.add_argument('--json', default=None, metavar='FILE', help='With --evidence: also write the evidence to FILE.')
        parser.add_argument('--clear-resolved', action='store_true',
                            help='Clear legacy_duplicate_year on inventories that are the only one of their year now.')

    def handle(self, *args, **options):
        from questionnaire.models import CarbonReport
        reports = CarbonReport.objects.filter(reporting_year__isnull=False)
        if options['company']:
            reports = reports.filter(company_id=options['company'])
        groups = (reports.values('company_id', 'reporting_year').annotate(n=Count('id')).filter(n__gt=1)
                  .order_by('company_id', '-reporting_year'))
        if options['evidence']:
            return self._evidence(reports, groups, options['json'])
        shown = 0
        for g in groups:
            members = list(reports.filter(company_id=g['company_id'], reporting_year=g['reporting_year'])
                           .select_related('company').order_by('id'))
            shown += 1
            self.stdout.write(f'company {g["company_id"]} ({members[0].company.legal_entity_name}) · {g["reporting_year"]} · '
                              f'{g["n"]} inventories:')
            for r in members:
                state = 'signed' if r.signed_at else str(r.status)
                self.stdout.write(f'    #{r.pk}  {state:12} flagged_legacy={r.legacy_duplicate_year}  '
                                  f'updated {r.updated_at:%Y-%m-%d %H:%M}  "{r.title}"')
        resolved = list(reports.filter(legacy_duplicate_year=True).exclude(
            pk__in=[r.pk for g in groups for r in reports.filter(company_id=g['company_id'], reporting_year=g['reporting_year'])]))
        if resolved:
            self.stdout.write(f'{len(resolved)} flagged inventor{"y" if len(resolved) == 1 else "ies"} no longer share their year: '
                              + ', '.join(f'#{r.pk}' for r in resolved))
            if options['clear_resolved']:
                n = CarbonReport.objects.filter(pk__in=[r.pk for r in resolved]).update(legacy_duplicate_year=False)
                self.stdout.write(self.style.SUCCESS(f'cleared the flag on {n} (nothing else was changed).'))
        self.stdout.write(self.style.SUCCESS(
            f'{shown} duplicate group(s). They stay read-only until an operator resolves ownership '
            f'(see LEGACY_INVENTORY_RECOVERY.md); nothing was changed here'
            + ('' if not options['clear_resolved'] else ' except the cleared flags') + '.'))

    # ── --evidence ──────────────────────────────────────────────────────────
    def _evidence(self, reports, groups, json_path):
        import json
        from chat.models import ChatSession
        from emissions.models import CustomEmissionRequest, EmissionEntry, ReductionTarget
        from questionnaire.models import AdvisorApproval, ReportStep
        from questionnaire.step_entries import entry_group

        out = []
        for g in groups:
            members = list(reports.filter(company_id=g['company_id'], reporting_year=g['reporting_year'])
                           .select_related('company').order_by('id'))
            answered = {}                                   # step id -> [member ids that answered it]
            for m in members:
                for step_id in ReportStep.objects.filter(report=m, is_skipped=False).values_list('step_id', flat=True):
                    answered.setdefault(step_id, []).append(m.pk)
            shared_entries = list(EmissionEntry.objects.filter(
                company_id=g['company_id'], year=g['reporting_year'], inventory__isnull=True).order_by('id'))
            shared_custom = list(CustomEmissionRequest.objects.filter(
                company_id=g['company_id'], year=g['reporting_year'], inventory__isnull=True).order_by('id'))
            rows = []
            for e in shared_entries:
                step = entry_group(e.description)
                cands = answered.get(step, []) if step else []
                rows.append({'kind': 'entry', 'id': e.pk, 'status': e.status, 'step': step,
                             'co2e_kg': float(e.calculated_co2e_kg or 0), 'created_at': e.created_at.isoformat(),
                             'candidates': cands,
                             'verdict': ('not from a questionnaire answer (chat/form row)' if not step else
                                         'no member answered this question' if not cands else
                                         'one member answered it (candidate only)' if len(cands) == 1 else
                                         f'{len(cands)} members answered it (ambiguous)')})
            for r in shared_custom:
                rows.append({'kind': 'custom_request', 'id': r.pk, 'status': r.status, 'step': None,
                             'co2e_kg': float(r.calculated_co2e_kg or 0), 'created_at': r.created_at.isoformat(),
                             'candidates': [], 'verdict': 'a company request (no inventory named): needs a person'})
            member_info = []
            for m in members:
                member_info.append({
                    'id': m.pk, 'title': m.title, 'status': str(m.status),
                    'signed_at': m.signed_at.isoformat() if m.signed_at else None,
                    'created_at': m.created_at.isoformat(), 'updated_at': m.updated_at.isoformat(),
                    'created_by': m.created_by_id,
                    'answers': ReportStep.objects.filter(report=m).count(),
                    'advisor_approvals': AdvisorApproval.objects.filter(report=m).count(),
                    'chat_sessions': ChatSession.objects.filter(inventory=m).count(),
                    'targets': ReductionTarget.objects.filter(inventory=m).count(),
                    'entries_tagged': EmissionEntry.objects.filter(inventory=m).count(),
                    'custom_requests_tagged': CustomEmissionRequest.objects.filter(inventory=m).count(),
                })
            at_stake = bool(rows) or any(i['entries_tagged'] or i['custom_requests_tagged'] for i in member_info)
            out.append({'company_id': g['company_id'], 'company': members[0].company.legal_entity_name,
                        'year': g['reporting_year'], 'members': member_info, 'shared_rows': rows,
                        'records_at_stake': at_stake})

            self.stdout.write(f'company {g["company_id"]} ({members[0].company.legal_entity_name}) · {g["reporting_year"]} · '
                              f'{len(members)} inventories')
            for i in member_info:
                self.stdout.write(f'    #{i["id"]:<4} {i["status"]:12} answers={i["answers"]:<4} approvals={i["advisor_approvals"]:<3} '
                                  f'tagged entries={i["entries_tagged"]} requests={i["custom_requests_tagged"]} '
                                  f'chats={i["chat_sessions"]} targets={i["targets"]}  "{i["title"]}"')
            if not at_stake:
                self.stdout.write(self.style.SUCCESS(
                    '    no emission entry or custom request of this year belongs to, or is shared by, any member: '
                    'nothing a decision could change. Their answers and approvals are already tied to each member by id.'))
            else:
                self.stdout.write(self.style.WARNING(f'    {len(rows)} shared row(s) belong to no inventory:'))
                for r in rows:
                    self.stdout.write(f'      {r["kind"]} #{r["id"]} {r["status"]} step={r["step"]} {r["co2e_kg"]:,.2f} kg '
                                      f'-> {r["verdict"]} {r["candidates"] or ""}')
                self.stdout.write("    needs: a person to confirm each row's inventory (who entered it, the source document, "
                                  "and its date against the member's answer history); then an operator-signed mapping.")
        if json_path:
            with open(json_path, 'w', encoding='utf-8') as fh:
                json.dump(out, fh, indent=2, ensure_ascii=False)
            self.stdout.write(f'evidence written to {json_path}')
        self.stdout.write(self.style.SUCCESS(f'{len(out)} duplicate group(s) reviewed (read-only; nothing was changed).'))
