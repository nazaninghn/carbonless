"""Release the DR-19 hold on one signed / completed inventory. Needs the inventory id, the acting user's username and a reason;
writes one history row. It does not rebuild anything: after the release the normal routes may rebuild the inventory again."""
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from questionnaire.applied_factors import release_hold
from questionnaire.models import CarbonReport


class Command(BaseCommand):
    help = 'Release the hold on a signed / completed inventory (audited).'

    def add_arguments(self, parser):
        parser.add_argument('report_id', type=int)
        parser.add_argument('--user', required=True)
        parser.add_argument('--reason', required=True)

    def handle(self, *args, **opts):
        try:
            report = CarbonReport.objects.get(pk=opts['report_id'])
            user = User.objects.get(username=opts['user'])
            release_hold(report, user, opts['reason'])
        except (CarbonReport.DoesNotExist, User.DoesNotExist, ValueError) as exc:
            raise CommandError(str(exc))
        self.stdout.write(f"hold released on report {report.pk}")
