import json

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework_simplejwt.tokens import RefreshToken

from companies.models import Company, CompanyMembership
from .models import CarbonReport, ReportStep

# The two question ids the questionnaire can reach that are longer than the
# old max_length=10 on CarbonReport.current_step. SQLite ignores varchar
# limits, so these only ever failed on Postgres (production) — a DataError
# that surfaced as a 500 and hard-blocked the questionnaire at Q36.
LONG_STEP_IDS = ['SCOPE-GROUPING', '3D-4-zero-decision']

# A valid option for each, so the submit test exercises the save path rather
# than bouncing off schema validation.
VALID_ANSWERS = {
    'SCOPE-GROUPING': 'combined',
    '3D-4-zero-decision': 'ipcc_default',
}


class CurrentStepLengthTests(TestCase):
    """CarbonReport.current_step must fit every question id we assign to it."""

    def setUp(self):
        self.user = User.objects.create_user('stepuser', 'step@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Step Co', tax_number='1',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(
            company=self.company, created_by=self.user, reporting_year=2026,
        )

    def test_field_is_wide_enough_for_every_long_id(self):
        """Backend-independent guard: assert the column, not the write.

        A plain save() would pass on SQLite even with the old max_length=10,
        so this checks the declared field width directly — it fails on any
        backend if the field is ever narrowed again.
        """
        width = CarbonReport._meta.get_field('current_step').max_length
        for step_id in LONG_STEP_IDS:
            self.assertLessEqual(
                len(step_id), width,
                f"current_step (max_length={width}) cannot hold '{step_id}' "
                f"({len(step_id)} chars) — this raises DataError on Postgres",
            )

    def test_submitting_a_long_step_id_succeeds(self):
        token = str(RefreshToken.for_user(self.user).access_token)
        for step_id in LONG_STEP_IDS:
            with self.subTest(step=step_id):
                res = self.client.patch(
                    f'/api/questionnaire/{self.report.id}/step/',
                    data=json.dumps({
                        'step': step_id,
                        'data': {'answer': VALID_ANSWERS[step_id]},
                        'language': 'en',
                    }),
                    content_type='application/json',
                    HTTP_AUTHORIZATION=f'Bearer {token}',
                )
                self.assertEqual(res.status_code, 200, res.content)
                self.report.refresh_from_db()
                self.assertEqual(self.report.current_step, step_id)
                self.assertTrue(
                    ReportStep.objects.filter(report=self.report, step_id=step_id).exists()
                )


class CombinedReportTests(TestCase):
    """The three-report pack: one PDF, bound in order, numbered straight through."""

    def setUp(self):
        self.user = User.objects.create_user('packuser', 'pack@test.com', 'pass12345')
        self.other = User.objects.create_user('packother', 'other@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Pack Co', tax_number='2',
            country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(
            company=self.company, created_by=self.user, reporting_year=2026,
        )
        self.url = f'/api/questionnaire/{self.report.id}/combined-report/'

    def _auth(self, user=None):
        return {'HTTP_AUTHORIZATION':
                f'Bearer {RefreshToken.for_user(user or self.user).access_token}'}

    def test_returns_one_pdf_with_all_three_parts(self):
        res = self.client.get(self.url, **self._auth())
        self.assertEqual(res.status_code, 200, getattr(res, 'data', res.content[:200]))
        self.assertEqual(res['Content-Type'], 'application/pdf')
        self.assertIn('ghg_reporting_pack_2026_en.pdf', res['Content-Disposition'])

        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(res.content))
        titles = [o.title for o in reader.outline]
        self.assertEqual(len(titles), 3, f'expected three bookmarked parts, got {titles}')
        self.assertTrue(titles[0].startswith('Part I'), titles)
        self.assertTrue(titles[1].startswith('Part II'), titles)
        self.assertTrue(titles[2].startswith('Part III'), titles)

        # Each part must start after the one before it, or they were bound
        # out of order or on top of each other.
        starts = [reader.get_destination_page_number(o) for o in reader.outline]
        self.assertEqual(starts, sorted(starts))
        self.assertLess(starts[-1], len(reader.pages))

    def test_pages_are_numbered_continuously_across_parts(self):
        """The pack's whole point over three separate files: one page sequence."""
        import io
        import re
        from pypdf import PdfReader

        res = self.client.get(self.url, **self._auth())
        reader = PdfReader(io.BytesIO(res.content))
        printed = []
        for sheet, page in enumerate(reader.pages, start=1):
            found = re.findall(r'Page\s+(\d+)', page.extract_text() or '')
            if found:
                printed.append((sheet, int(found[0])))

        self.assertGreater(len(printed), 10, 'no page numbers found to check')
        # Every numbered sheet carries the same sheet-to-number offset; a part
        # that restarted its own numbering would break the run.
        offsets = {sheet - number for sheet, number in printed}
        self.assertEqual(
            len(offsets), 1,
            f'page numbering restarts inside the pack (offsets seen: {sorted(offsets)})')

    def test_turkish_pack_is_built_in_turkish(self):
        res = self.client.get(self.url + '?lang=tr', **self._auth())
        self.assertEqual(res.status_code, 200)
        self.assertIn('ghg_reporting_pack_2026_tr.pdf', res['Content-Disposition'])

        import io
        from pypdf import PdfReader
        titles = [o.title for o in PdfReader(io.BytesIO(res.content)).outline]
        self.assertTrue(all(t.startswith('Bölüm') for t in titles), titles)

    def test_another_users_report_is_not_downloadable(self):
        res = self.client.get(self.url, **self._auth(self.other))
        self.assertEqual(res.status_code, 404)

    def test_bad_year_is_rejected(self):
        res = self.client.get(self.url + '?year=soon', **self._auth())
        self.assertEqual(res.status_code, 400)
