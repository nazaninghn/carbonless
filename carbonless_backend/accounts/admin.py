from django.contrib import admin
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'department', 'phone']
    list_filter = ['role']
    search_fields = ['user__username', 'user__email']


from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read']
    search_fields = ['user__username', 'title']


from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'detail', 'ip_address', 'created_at']
    list_filter = ['action']
    search_fields = ['user__username', 'detail']
    readonly_fields = ['user', 'action', 'detail', 'ip_address', 'created_at']
