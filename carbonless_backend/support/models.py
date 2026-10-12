"""
Questions the AI assistant could not (or should not) answer itself, handed to
the support team, and the users' feedback on the assistant's answers.

Both are also the product team's list of what is missing: every request the
AI passed on and every answer marked unhelpful says where the product or its
help falls short. The team marks a request as a gap and notes what to change.
"""
from django.contrib.auth.models import User
from django.db import models


class SupportRequest(models.Model):
    class Source(models.TextChoices):
        AI = 'ai', 'Referred by the AI'
        USER = 'user', 'Asked by the user'

    class Topic(models.TextChoices):
        ACCOUNT = 'account', 'Account / sign-in'
        BILLING = 'billing', 'Billing / subscription'
        BUG = 'bug', 'Error / something not working'
        DATA = 'data', 'Lost or wrong data'
        INTEGRATION = 'integration', 'Integration / import'
        LEGAL = 'legal', 'Legal / contract / verification'
        METHOD = 'method', 'Methodology / calculation'
        OTHER = 'other', 'Other'

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        ANSWERED = 'answered', 'Answered'
        CLOSED = 'closed', 'Closed'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_requests')
    company = models.ForeignKey('companies.Company', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='support_requests')
    # The chat the question came from: the answer is posted back into it.
    session = models.ForeignKey('chat.ChatSession', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='support_requests')
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.USER)
    topic = models.CharField(max_length=20, choices=Topic.choices, default=Topic.OTHER)
    question = models.TextField(max_length=4000)
    # The last turns of the conversation, so the team sees what was asked
    # and what the AI already said.
    context = models.TextField(blank=True)
    language = models.CharField(max_length=5, default='tr')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN, db_index=True)
    answer = models.TextField(blank=True, help_text='Sent to the user (notification, e-mail and the chat).')
    answered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='answered_support_requests')
    answered_at = models.DateTimeField(null=True, blank=True)
    # Product feedback: this request shows something missing or unclear.
    is_gap = models.BooleanField(default=False, verbose_name='Product gap',
                                 help_text='The question shows a missing feature, unclear text or a bug to fix.')
    gap_note = models.TextField(blank=True, verbose_name='What to improve')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'#{self.pk} {self.get_status_display()} — {self.question[:60]}'


class AnswerFeedback(models.Model):
    """A user's 👍 / 👎 (and optional comment) on one assistant answer."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='answer_feedback')
    company = models.ForeignKey('companies.Company', on_delete=models.SET_NULL, null=True, blank=True)
    message = models.ForeignKey('chat.ChatMessage', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='feedback')
    helpful = models.BooleanField()
    comment = models.TextField(blank=True, max_length=2000)
    # The question that answer was for, kept even if the chat is deleted later.
    question = models.TextField(blank=True)
    answer = models.TextField(blank=True)
    is_gap = models.BooleanField(default=False, verbose_name='Product gap')
    gap_note = models.TextField(blank=True, verbose_name='What to improve')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['user', 'message'], name='one_feedback_per_answer')]

    def __str__(self):
        return f"{'👍' if self.helpful else '👎'} {self.question[:60]}"
