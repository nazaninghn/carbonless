from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import AnswerFeedback, SupportRequest


def open_requests_badge(request):
    """Sidebar badge: support requests waiting for an answer."""
    n = SupportRequest.objects.filter(status=SupportRequest.Status.OPEN).count()
    return str(n) if n else None


def unhelpful_badge(request):
    n = AnswerFeedback.objects.filter(helpful=False).count()
    return str(n) if n else None


@admin.register(SupportRequest)
class SupportRequestAdmin(ModelAdmin):
    """Answer a request by writing in "Answer" and saving: the user gets it
    as a notification, an e-mail and a message in the chat it came from.
    Tick "Product gap" (and note what to improve) for anything the product
    or its help should cover itself."""
    list_display = ['id', 'created_at', 'status', 'topic', 'source', 'user', 'company', 'short_question', 'is_gap']
    list_filter = ['status', 'topic', 'source', 'is_gap', 'created_at']
    search_fields = ['question', 'answer', 'gap_note', 'user__email', 'company__legal_entity_name']
    readonly_fields = ['user', 'company', 'session', 'source', 'question', 'context', 'language',
                       'answered_by', 'answered_at', 'created_at', 'updated_at']
    fieldsets = [
        ('Question', {'fields': ['status', 'topic', 'source', 'user', 'company', 'language', 'created_at',
                                 'question', 'context']}),
        ('Answer (sent to the user when saved)', {'fields': ['answer', 'answered_by', 'answered_at']}),
        ('Product feedback', {'fields': ['is_gap', 'gap_note']}),
    ]

    @admin.display(description='Question')
    def short_question(self, obj):
        return obj.question[:90]

    def save_model(self, request, obj, form, change):
        from .service import deliver_answer
        answer_changed = 'answer' in form.changed_data and obj.answer.strip()
        if answer_changed:
            from django.utils import timezone
            obj.answered_by = request.user
            obj.answered_at = timezone.now()
            if obj.status == SupportRequest.Status.OPEN:
                obj.status = SupportRequest.Status.ANSWERED
        super().save_model(request, obj, form, change)
        if answer_changed:
            deliver_answer(obj)
            self.message_user(request, f'Answer sent to {obj.user.email or obj.user.username}.')


@admin.register(AnswerFeedback)
class AnswerFeedbackAdmin(ModelAdmin):
    """Users' 👍 / 👎 on the AI's answers — the unhelpful ones show what the
    assistant (or the product) does not cover yet."""
    list_display = ['created_at', 'helpful', 'user', 'short_question', 'short_comment', 'is_gap']
    list_filter = ['helpful', 'is_gap', 'created_at']
    search_fields = ['question', 'answer', 'comment', 'user__email']
    readonly_fields = ['user', 'company', 'message', 'helpful', 'comment', 'question', 'answer', 'created_at']
    fields = ['created_at', 'user', 'company', 'helpful', 'question', 'answer', 'comment', 'is_gap', 'gap_note']

    def has_add_permission(self, request):
        return False

    @admin.display(description='Question')
    def short_question(self, obj):
        return obj.question[:80]

    @admin.display(description='Comment')
    def short_comment(self, obj):
        return obj.comment[:80]
