from django.contrib import admin
from .models import QuestionnaireSession


@admin.register(QuestionnaireSession)
class QuestionnaireSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'is_complete', 'current_question', 'started_at', 'completed_at']
    list_filter = ['is_complete']
    search_fields = ['user__username']
