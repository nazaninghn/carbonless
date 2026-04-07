from django.contrib import admin
from .models import EmissionFactor, EmissionEntry, ReductionTarget


@admin.register(EmissionFactor)
class EmissionFactorAdmin(admin.ModelAdmin):
    list_display = ['name', 'name_tr', 'scope', 'category', 'unit', 'factor_kg_co2e', 'source']
    list_filter = ['scope', 'category', 'source', 'is_active']
    search_fields = ['name', 'name_tr', 'slug']


@admin.register(EmissionEntry)
class EmissionEntryAdmin(admin.ModelAdmin):
    list_display = ['user', 'emission_factor', 'year', 'month', 'quantity', 'calculated_co2e_kg']
    list_filter = ['year', 'month', 'emission_factor__scope']
    search_fields = ['user__username', 'description']


@admin.register(ReductionTarget)
class ReductionTargetAdmin(admin.ModelAdmin):
    list_display = ['user', 'title', 'base_year', 'target_year', 'target_reduction_percent', 'status']
    list_filter = ['status']


from .models import CustomEmissionRequest


@admin.register(CustomEmissionRequest)
class CustomEmissionRequestAdmin(admin.ModelAdmin):
    list_display = ['user', 'source_name', 'scope', 'category_name', 'quantity', 'unit', 'status', 'created_at']
    list_filter = ['status', 'scope']
    search_fields = ['user__username', 'source_name', 'category_name', 'description']
    readonly_fields = ['user', 'created_at', 'updated_at']
    fieldsets = (
        ('User Request', {
            'fields': ('user', 'scope', 'category_name', 'source_name', 'description',
                       'unit', 'quantity', 'year', 'month', 'facility')
        }),
        ('Admin Review', {
            'fields': ('status', 'admin_notes', 'approved_factor_kg_co2e',
                       'calculated_co2e_kg', 'linked_entry')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def save_model(self, request, obj, form, change):
        """Auto-calculate when admin approves with a factor, send notification"""
        if obj.status == 'approved' and obj.approved_factor_kg_co2e and not obj.calculated_co2e_kg:
            obj.calculated_co2e_kg = obj.quantity * obj.approved_factor_kg_co2e
        super().save_model(request, obj, form, change)

        # Send notification on status change
        if change and 'status' in form.changed_data:
            from accounts.models import Notification
            if obj.status == 'approved':
                Notification.objects.create(
                    user=obj.user,
                    notification_type='custom_approved',
                    title='Özel talep onaylandı' if True else 'Custom request approved',
                    message=f'{obj.source_name}: {obj.calculated_co2e_kg or 0:.2f} kg CO2e',
                    link='/dashboard',
                )
            elif obj.status == 'rejected':
                Notification.objects.create(
                    user=obj.user,
                    notification_type='custom_rejected',
                    title='Özel talep reddedildi',
                    message=f'{obj.source_name}: {obj.admin_notes or ""}',
                    link='/dashboard',
                )
