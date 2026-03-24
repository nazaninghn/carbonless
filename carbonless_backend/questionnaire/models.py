from django.db import models
from django.contrib.auth.models import User


class QuestionnaireSession(models.Model):
    """Stores a user's questionnaire session and all their answers"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='questionnaire_sessions')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_complete = models.BooleanField(default=False)
    current_question = models.CharField(max_length=10, default='S1')
    answers = models.JSONField(default=dict, blank=True)
    warnings = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.user.username} - Session {self.pk} ({'Complete' if self.is_complete else self.current_question})"

    class Meta:
        ordering = ['-started_at']
