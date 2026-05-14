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
        ECOINVENT = 'ecoinvent', 'ecoinvent'
        OTHER = 'other', 'Other / Country-specific'
        CUSTOM = 'custom', 'Custom'

    class OrgBoundary(models.TextChoices):
        OPERATIONAL = 'operational_control', 'Operational Control'
        FINANCIAL = 'financial_control', 'Financial Control'
        EQUITY = 'equity_share', 'Equity Share'

    class Scope3Approach(models.TextChoices):
        MATERIALITY = 'materiality', 'Materiality Based'
        FULL_15 = 'full_15', 'Full 15 Categories'
        EXCLUDE = 'exclude', 'Scope 1 & 2 Only'

    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='carbon_reports'
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='created_reports'
    )
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
    step_id = models.CharField(max_length=10)
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
    step_id = models.CharField(max_length=10)
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
