from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin, UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group, User
from unfold.admin import ModelAdmin
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm
from .models import UserProfile, Notification, ActivityLog


# User and Group ship registered against plain django.contrib ModelAdmins, so
# they never picked up unfold's action_form — the one that binds the action
# <select> to Alpine via x-model="action". Unfold's changelist template shows
# the "Run" button with x-show="action", so on these two pages the variable
# stayed empty forever and the button was never rendered: every bulk action,
# "Delete selected users" included, was impossible to trigger from the UI.
admin.site.unregister(User)
admin.site.unregister(Group)


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm


@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass


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
