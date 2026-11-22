from django.contrib import admin
from unfold.admin import ModelAdmin
from django.utils import timezone

from .models import QuestionnaireSession, AdvisorApproval, StepDocument


@admin.register(QuestionnaireSession)
class QuestionnaireSessionAdmin(ModelAdmin):
    list_display = ['user', 'is_complete', 'current_question', 'started_at', 'completed_at']
    list_filter = ['is_complete']
    search_fields = ['user__username']


@admin.register(AdvisorApproval)
class AdvisorApprovalAdmin(ModelAdmin):
    list_display = ['report', 'company', 'question_id', 'reason_code', 'risk_level', 'status', 'what', 'documents', 'created_at']
    list_filter = ['status', 'reason_code', 'risk_level', 'trigger_category']
    search_fields = ['question_id', 'reason_code', 'report__id', 'report__company__legal_entity_name', 'description']
    readonly_fields = ['created_at', 'documents']
    actions = ['approve_selected', 'reject_selected']
    # Pending first: this list is the advisor's inbox (data-quality items carry reason codes ut02 … ut05).
    ordering = ['-status', '-created_at']

    @admin.display(description='Company')
    def company(self, obj):
        return obj.report.company.legal_entity_name if obj.report_id and obj.report.company_id else '—'

    @admin.display(description='What is asked')
    def what(self, obj):
        text = obj.description or ''
        return text if len(text) <= 160 else text[:157] + '…'

    @admin.display(description='Documents of the question')
    def documents(self, obj):
        from django.urls import reverse
        from django.utils.html import format_html_join
        docs = StepDocument.objects.filter(report_id=obj.report_id, step_id=obj.question_id)
        if not docs:
            return '—'
        return format_html_join(', ', '<a href="{}">{}</a>', (
            (reverse('admin:questionnaire_stepdocument_change', args=[d.pk]), d.original_name) for d in docs))

    def _decide(self, request, queryset, status):
        from django.contrib import messages
        done = skipped = 0
        for item in queryset.select_related('report'):
            if item.report.signed_at is not None:
                skipped += 1                      # a signed inventory's items are part of what it reports
                continue
            item.status, item.reviewed_by, item.reviewed_at = status, request.user, timezone.now()
            item.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
            done += 1
        self.message_user(request, f'{done} item(s) set to {status}.' + (
            f' {skipped} left unchanged: their inventory is signed.' if skipped else ''),
            level=messages.SUCCESS if done else messages.WARNING)

    @admin.action(description='Approve the selected items')
    def approve_selected(self, request, queryset):
        self._decide(request, queryset, AdvisorApproval.Status.APPROVED)

    @admin.action(description='Reject the selected items (the claim is then counted as an estimate)')
    def reject_selected(self, request, queryset):
        self._decide(request, queryset, AdvisorApproval.Status.REJECTED)

    # A signed inventory's advisor items are part of what it reports: they are not changed or deleted here.
    def _signed(self, obj):
        return obj is not None and bool(obj.report_id) and obj.report.signed_at is not None

    def has_change_permission(self, request, obj=None):
        return False if self._signed(obj) else super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        return False if self._signed(obj) else super().has_delete_permission(request, obj)

    def save_model(self, request, obj, form, change):
        from django.contrib import messages
        from .immutability import InventoryGuardError, assert_not_signed
        try:
            if obj.report_id:
                assert_not_signed(obj.report)      # also stops a NEW item being added to a signed inventory
        except InventoryGuardError as exc:
            self.message_user(request, f'{exc.en} / {exc.tr}', level=messages.ERROR)
            return
        super().save_model(request, obj, form, change)


@admin.register(StepDocument)
class StepDocumentAdmin(ModelAdmin):
    """The documents users uploaded for a question (measurement records, supplier declarations): read here by
    the advisor before deciding the matching item in "Advisor approvals"."""
    list_display = ['report', 'step_id', 'kind', 'original_name', 'uploaded_by', 'uploaded_at']
    list_filter = ['kind']
    search_fields = ['step_id', 'original_name', 'report__id', 'report__company__legal_entity_name']
    readonly_fields = ['report', 'step_id', 'kind', 'file', 'original_name', 'uploaded_by', 'uploaded_at']

    def has_add_permission(self, request):
        return False
