from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    """Extended user profile with role-based access"""
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('manager', 'Manager'),
        ('data_entry', 'Data Entry'),
        ('auditor', 'Auditor (Read-Only)'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='admin')
    phone = models.CharField(max_length=20, blank=True)
    department = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"

    @property
    def can_edit_entries(self):
        return self.role in ('admin', 'manager', 'data_entry')

    @property
    def can_manage_users(self):
        return self.role == 'admin'

    @property
    def can_approve_requests(self):
        return self.role in ('admin', 'manager')

    @property
    def can_generate_reports(self):
        return self.role in ('admin', 'manager', 'auditor')


class Notification(models.Model):
    """In-app notifications for users"""
    TYPE_CHOICES = [
        ('custom_approved', 'Custom Request Approved'),
        ('custom_rejected', 'Custom Request Rejected'),
        ('target_alert', 'Target Alert'),
        ('report_ready', 'Report Ready'),
        ('system', 'System Message'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=255, blank=True, help_text='Optional link to related page')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username}: {self.title} ({'read' if self.is_read else 'unread'})"

    class Meta:
        ordering = ['-created_at']
