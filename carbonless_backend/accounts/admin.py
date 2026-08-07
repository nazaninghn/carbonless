from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import UserProfile, Notification, ActivityLog


@admin.register(UserProfile)
class UserProfileAdmin(ModelAdmin):
    list_display = ['user', 'role', 'department', 'phone']
    list_filter = ['role']
    search_fields = ['user__username', 'user__email']


@admin.register(Notification)
class NotificationAdmin(ModelAdmin):
    list_display = ['user', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read']
    search_fields = ['user__username', 'title']


@admin.register(ActivityLog)
class ActivityLogAdmin(ModelAdmin):
    list_display = ['user', 'action', 'detail', 'ip_address', 'created_at']
    list_filter = ['action']
    search_fields = ['user__username', 'detail']
    readonly_fields = ['user', 'action', 'detail', 'ip_address', 'created_at']
