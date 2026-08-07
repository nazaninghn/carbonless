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
