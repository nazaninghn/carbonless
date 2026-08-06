from django.db import models
from django.contrib.auth.models import User
from companies.models import Company


class CarbonReport(models.Model):

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'

    class EFDatabase(models.TextChoices):
        DEFRA = 'DEFRA', 'DEFRA 2023'
        DEFRA_TUIK = 'DEFRA_TUIK', 'DEFRA + TÜİK'
        IPCC_AR6 = 'IPCC_AR6', 'IPCC AR6 2021'
        EPA = 'EPA', 'EPA'
        CUSTOM = 'custom', 'Custom'

    class OrgBoundary(models.TextChoices):
        OPERATIONAL = 'operational_control', 'Operational Control'
        FINANCIAL = 'financial_control', 'Financial Control'
        EQUITY = 'equity_share', 'Equity Share'

    class Scope3Approach(models.TextChoices):
        MATERIALITY = 'materiality', 'Materiality Based'
        FULL = 'full', 'Full 15 Categories'

    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='carbon_reports'
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='created_reports'
    )
    title = models.CharField(max_length=200, blank=True, default='')
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    current_step = models.CharField(max_length=10, default='A1')

    # 1A
    reporting_year = models.IntegerField(null=True, blank=True)
    prepared_by = models.CharField(max_length=100, blank=True)
    purposes = models.JSONField(default=list)
    legal_framework = models.CharField(max_length=200, blank=True)
    voluntary_framework = models.CharField(max_length=200, blank=True)
    has_previous_report = models.BooleanField(null=True)
    baseline_year = models.IntegerField(null=True, blank=True)

    # 1C
    has_subsidiaries = models.BooleanField(null=True)
    has_international = models.BooleanField(null=True)
    has_jv_franchise = models.BooleanField(null=True)

    # 1D
    ef_database = models.CharField(
        max_length=20, choices=EFDatabase.choices, blank=True
    )
    ef_custom_source = models.CharField(max_length=200, blank=True)
    ef_custom_year = models.IntegerField(null=True, blank=True)
    scope2_method = models.CharField(max_length=20, default='location_based')
    boundary_approach = models.CharField(
        max_length=30, choices=OrgBoundary.choices, blank=True
    )
    scope3_approach = models.CharField(
        max_length=20, choices=Scope3Approach.choices, blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.company.legal_entity_name} — {self.reporting_year or 'Draft'}"


class ReportStep(models.Model):
    report = models.ForeignKey(
        CarbonReport, on_delete=models.CASCADE, related_name='steps'
    )
    # Was max_length=10 — fine for the original short ids (e.g. '7B-INFO') but
    # too narrow for newer follow-up questions like '3D-4-zero-decision' (18
    # chars). Dev's SQLite silently accepts the overflow (TEXT storage, no
    # length enforcement), but production Postgres stores this as varchar(10)
    # and raises DataError on insert — this would have broken saving several
    # of this session's new questions in production without ever failing locally.
    step_id = models.CharField(max_length=50)
    answer = models.JSONField(default=dict)
    is_skipped = models.BooleanField(default=False)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['report', 'step_id']
        ordering = ['completed_at']

    def __str__(self):
        return f"{self.report} — {self.step_id}"


class Assumption(models.Model):

    class AssumptionType(models.TextChoices):
        A = 'A', 'Data Gap'
        B = 'B', 'Methodology Choice'
        C = 'C', 'Boundary Decision'

    class ImpactDirection(models.TextChoices):
        HIGH = 'high', 'High Estimate'
        LOW = 'low', 'Low Estimate'
        UNCERTAIN = 'uncertain', 'Uncertain'
        NEUTRAL = 'neutral', 'No Impact'

    report = models.ForeignKey(
        CarbonReport, on_delete=models.CASCADE, related_name='assumptions'
    )
    step_id = models.CharField(max_length=50)  # see ReportStep.step_id for why 50
    assumption_type = models.CharField(max_length=1, choices=AssumptionType.choices)
    auto_text = models.TextField()
    user_approved = models.BooleanField(default=False)
    impact_direction = models.CharField(
        max_length=10, choices=ImpactDirection.choices, blank=True
    )
    improvement_path = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.report} — {self.step_id} (Type {self.assumption_type})"


class QuestionnaireSession(models.Model):
    """Legacy model — kept for backward compatibility"""
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='questionnaire_sessions'
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_complete = models.BooleanField(default=False)
    current_question = models.CharField(max_length=20, default='A1')
    answers = models.JSONField(default=dict, blank=True)
    warnings = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.user.username} - Session {self.pk}"


# ── Workspace: shared data layer ──────────────────────────────────────────────

class ReportField(models.Model):
    """
    Single source of truth for every structured data point in a report.
    Both the Chatbot and the Dashboard read/write via this model.
    """
    class Source(models.TextChoices):
        CHATBOT   = 'chatbot',   'Chatbot'
        DASHBOARD = 'dashboard', 'Dashboard'
        EXCEL     = 'excel',     'Excel Import'
        PREFILL   = 'prefill',   'Pre-fill'

    report      = models.ForeignKey(CarbonReport, on_delete=models.CASCADE,
                                    related_name='report_fields')
    field_id    = models.CharField(max_length=100)          # e.g. "rf.3a.consumption"
    value       = models.JSONField()                        # string | number | list | dict
    source      = models.CharField(max_length=20, choices=Source.choices,
                                   default=Source.DASHBOARD)
    confidence  = models.FloatField(null=True, blank=True)  # 0.0–1.0, set by AI
    updated_by  = models.ForeignKey(User, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='+')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['report', 'field_id']
        ordering = ['field_id']
        indexes = [
            models.Index(fields=['report', 'field_id'], name='rf_report_field_idx'),
        ]

    def __str__(self):
        return f"[{self.report_id}] {self.field_id} = {self.value}"


class PendingSuggestion(models.Model):
    """
    AI-generated field suggestions waiting for user confirmation.
    AI MUST NOT write directly to ReportField — it creates a PendingSuggestion first.
    """
    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        REJECTED  = 'rejected',  'Rejected'
        EDITED    = 'edited',    'Confirmed with Edits'

    report      = models.ForeignKey(CarbonReport, on_delete=models.CASCADE,
                                    related_name='suggestions')
    message_id  = models.CharField(max_length=100, blank=True)  # optional chat ref
    category    = models.CharField(max_length=20)               # e.g. "3A"
    fields      = models.JSONField()                            # list of {field_id, label, value, unit?, confidence}
    status      = models.CharField(max_length=20, choices=Status.choices,
                                   default=Status.PENDING)
    confidence  = models.FloatField(null=True, blank=True)
    created_by  = models.ForeignKey(User, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='+')
    created_at  = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Suggestion [{self.category}] {self.status} — report {self.report_id}"


class AdvisorApproval(models.Model):
    """Danışman Onayı — flags a questionnaire answer for advisor/manager review.

    Created automatically by evaluate_advisor_triggers() (see advisor_triggers.py)
    whenever a saved ReportStep answer matches one of the 32 trigger rules from
    the client spec (custom EF override, sector average used, RFI applied, a
    K3 category answered "No", a %5 materiality threshold exceeded, etc.).
    Mirrors emissions.EmissionEntry's pending/approved/rejected workflow so the
    review UI pattern (ReviewTab.jsx) can be reused for both.
    """

    class RiskLevel(models.TextChoices):
        LOW          = 'low',          'Low'
        MEDIUM       = 'medium',       'Medium'
        MEDIUM_HIGH  = 'medium_high',  'Medium-High'
        HIGH         = 'high',         'High'
        CRITICAL     = 'critical',     'Critical'
        WARNING      = 'warning',      'Warning'
        POSITIVE     = 'positive',     'Positive'

    class Status(models.TextChoices):
        PENDING  = 'pending',  'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    report        = models.ForeignKey(CarbonReport, on_delete=models.CASCADE, related_name='advisor_approvals')
    question_id   = models.CharField(max_length=50, help_text="e.g. '3A-EF', 'K3C5-1'")
    field_id      = models.CharField(max_length=100, help_text="Question Map field_id, e.g. 'ef.ef_3a'")
    reason_code   = models.CharField(max_length=50, help_text="e.g. 'custom_ef_override', 'rfi_applied'")
    trigger_category = models.CharField(max_length=30, help_text="Veri Girişi / Metodoloji / Kapsam / Belge / Tutarsızlık")
    risk_level    = models.CharField(max_length=20, choices=RiskLevel.choices)
    description   = models.TextField(blank=True, help_text="Human-readable context/snapshot of the triggering answer")
    status        = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by   = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='advisor_reviews')
    reviewed_at   = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        # A single (report, question, reason) trigger should only ever create one
        # flag — re-saving the same answer (e.g. editing then re-confirming) must
        # not spam duplicate pending rows.
        unique_together = ['report', 'question_id', 'reason_code']
        ordering = ['-created_at']

    def __str__(self):
        return f"AdvisorApproval [{self.reason_code}] {self.status} — report {self.report_id}"
