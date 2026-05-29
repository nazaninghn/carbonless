from django.db import models
from django.contrib.auth.models import User


class ChatSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_sessions')
    title = models.CharField(max_length=200, default='New Chat')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            # Fix #76: covers list_sessions → filter(user=…).order_by('-updated_at')
            # Without this, every sidebar load is a full-table scan on large deployments.
            models.Index(fields=['user', '-updated_at'], name='chat_session_user_updated_idx'),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.title}"


class ChatMessage(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            # Fix #76: covers send_message → messages.order_by('-created_at')[:20]
            # and session_detail → messages.all() (uses ASC ordering, same index reversed).
            models.Index(fields=['session', '-created_at'], name='chat_msg_session_created_idx'),
        ]

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}"
