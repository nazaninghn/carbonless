from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import QuestionnaireSession, AdvisorApproval


@admin.register(QuestionnaireSession)
class QuestionnaireSessionAdmin(ModelAdmin):
    list_display = ['user', 'is_complete', 'current_question', 'started_at', 'completed_at']
    list_filter = ['is_complete']
    search_fields = ['user__username']


@admin.register(AdvisorApproval)
class AdvisorApprovalAdmin(ModelAdmin):
    list_display = ['report', 'question_id', 'reason_code', 'risk_level', 'status', 'created_at']
    list_filter = ['status', 'risk_level', 'trigger_category']
    search_fields = ['question_id', 'reason_code', 'report__id']
    readonly_fields = ['created_at']

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
