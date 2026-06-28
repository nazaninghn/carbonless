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
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='data_entry')
    phone = models.CharField(max_length=20, blank=True)
    department = models.CharField(max_length=100, blank=True)
    language_preference = models.CharField(max_length=5, default='tr', choices=[('tr', 'Türkçe'), ('en', 'English')])
    notify_approvals = models.BooleanField(default=True)
    notify_system = models.BooleanField(default=True)

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


class ActivityLog(models.Model):
    """Audit trail for important actions"""
    ACTION_CHOICES = [
        ('entry_created', 'Emission Entry Created'),
        ('entry_deleted', 'Emission Entry Deleted'),
        ('entry_updated', 'Emission Entry Updated'),
        ('custom_submitted', 'Custom Request Submitted'),
        ('custom_approved', 'Custom Request Approved'),
        ('custom_rejected', 'Custom Request Rejected'),
        ('report_generated', 'Report Generated'),
        ('password_changed', 'Password Changed'),
        ('login', 'Login'),
        # Fix #25: 'account_deleted' was used in delete_account view but missing from choices
        ('account_deleted', 'Account Deleted'),
    ]

    # Fix #25: SET_NULL so audit logs survive user deletion.
    # CASCADE was silently deleting the entire audit trail the moment user.delete()
    # was called — the log entry created just before the delete was wiped too.
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='activity_logs',
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, db_index=True)
    detail = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    target_type = models.CharField(max_length=50, blank=True, help_text='e.g. EmissionEntry, CustomRequest')
    target_id = models.CharField(max_length=50, blank=True, help_text='PK of the target object')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        # Fix #53: user is SET_NULL — accessing .username on None raises
        # AttributeError in Django admin and any str(log) call after deletion.
        username = self.user.username if self.user else '(deleted)'
        return f"{username}: {self.action} at {self.created_at}"

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]


import uuid
from django.utils import timezone
from datetime import timedelta


class EmailVerificationToken(models.Model):
    """Token for email verification after registration"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='email_verification')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_expired(self):
        """Token expires after 24 hours"""
        return timezone.now() > self.created_at + timedelta(hours=24)

    @property
    def is_verified(self):
        return self.verified_at is not None

    def verify(self):
        """Mark as verified and activate the user"""
        self.verified_at = timezone.now()
        self.save(update_fields=['verified_at'])
        self.user.is_active = True
        self.user.save(update_fields=['is_active'])

    def __str__(self):
        status = 'verified' if self.is_verified else ('expired' if self.is_expired else 'pending')
        return f"{self.user.email} — {status}"


class PasswordResetToken(models.Model):
    """Token for password reset via email"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_resets')
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    @property
    def is_expired(self):
        """Token expires after 1 hour"""
        return timezone.now() > self.created_at + timedelta(hours=1)

    @property
    def is_used(self):
        return self.used_at is not None

    def use(self):
        self.used_at = timezone.now()
        self.save(update_fields=['used_at'])

    def __str__(self):
        return f"{self.user.email} — {'used' if self.is_used else 'active'}"
