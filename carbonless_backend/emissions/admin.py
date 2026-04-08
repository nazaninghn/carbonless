from django.contrib import admin
from django.utils.html import format_html
from .models import EmissionFactor, EmissionEntry, ReductionTarget, CustomEmissionRequest


@admin.register(EmissionFactor)
class EmissionFactorAdmin(admin.ModelAdmin):
    """Full management of emission factors — add new scopes, categories, sources"""
    list_display = ['name', 'scope_badge', 'category', 'country_flag', 'unit',
                    'factor_display', 'year', 'source', 'is_default', 'is_active']
    list_filter = ['scope', 'category', 'country', 'source', 'is_active', 'is_default', 'year']
    search_fields = ['name', 'name_tr', 'slug', 'reference']
    list_editable = ['is_active', 'is_default']
    list_per_page = 50
    ordering = ['scope', 'category', 'country', 'name']

    fieldsets = (
        ('Identity', {
            'fields': ('slug', 'name', 'name_tr'),
        }),
        ('Classification', {
            'fields': ('scope', 'category', 'country'),
            'description': 'Select scope and category. You can type new category values if needed.',
        }),
        ('Factor Data', {
            'fields': ('unit', 'factor_kg_co2e', 'year'),
        }),
        ('Source & Reference', {
            'fields': ('source', 'reference'),
        }),
        ('Status', {
            'fields': ('is_active', 'is_default'),
        }),
    )

    def scope_badge(self, obj):
        colors = {'scope1': '#ef4444', 'scope2': '#eab308', 'scope3': '#3b82f6'}
        c = colors.get(obj.scope, '#6b7280')
        label = obj.scope.replace('scope', 'S')
        return format_html('<span style="background:{}; color:white; padding:2px 8px; border-radius:4px; font-size:11px;">{}</span>', c, label)
    scope_badge.short_description = 'Scope'

    def country_flag(self, obj):
        flags = {'turkey': '🇹🇷', 'global': '🌍'}
        return f"{flags.get(obj.country, '')} {obj.country}"
    country_flag.short_description = 'Country'

    def factor_display(self, obj):
        return f"{obj.factor_kg_co2e} kg CO2e/{obj.unit}"
    factor_display.short_description = 'Factor'

    actions = ['make_active', 'make_inactive', 'set_as_default']

    @admin.action(description='Activate selected factors')
    def make_active(self, request, queryset):
        queryset.update(is_active=True)

    @admin.action(description='Deactivate selected factors')
    def make_inactive(self, request, queryset):
        queryset.update(is_active=False)

    @admin.action(description='Set as default for their slug+country')
    def set_as_default(self, request, queryset):
        queryset.update(is_default=True)


@admin.register(EmissionEntry)
class EmissionEntryAdmin(admin.ModelAdmin):
    list_display = ['user', 'factor_name', 'scope_badge', 'year', 'month',
                    'quantity', 'unit_display', 'co2e_display', 'facility']
    list_filter = ['year', 'month', 'emission_factor__scope', 'emission_factor__category',
                   'emission_factor__country']
    search_fields = ['user__username', 'description', 'facility',
                     'emission_factor__name']
    list_per_page = 50
    raw_id_fields = ['emission_factor']

    def factor_name(self, obj):
        return obj.emission_factor.name[:40]
    factor_name.short_description = 'Source'

    def scope_badge(self, obj):
        colors = {'scope1': '#ef4444', 'scope2': '#eab308', 'scope3': '#3b82f6'}
        s = obj.emission_factor.scope
        c = colors.get(s, '#6b7280')
        return format_html('<span style="background:{}; color:white; padding:2px 8px; border-radius:4px; font-size:11px;">{}</span>', c, s.replace('scope', 'S'))
    scope_badge.short_description = 'Scope'

    def unit_display(self, obj):
        return obj.emission_factor.unit
    unit_display.short_description = 'Unit'

    def co2e_display(self, obj):
        return f"{float(obj.calculated_co2e_kg):,.2f} kg"
    co2e_display.short_description = 'CO2e'


@admin.register(ReductionTarget)
class ReductionTargetAdmin(admin.ModelAdmin):
    list_display = ['user', 'title', 'base_year', 'target_year',
                    'target_reduction_percent', 'status']
    list_filter = ['status']
    search_fields = ['user__username', 'title']


@admin.register(CustomEmissionRequest)
class CustomEmissionRequestAdmin(admin.ModelAdmin):
    list_display = ['user', 'source_name', 'scope_badge', 'category_name',
                    'quantity', 'unit', 'status_badge', 'created_at']
    list_filter = ['status', 'scope', 'year']
    search_fields = ['user__username', 'source_name', 'category_name', 'description']
    readonly_fields = ['user', 'created_at', 'updated_at']
    list_per_page = 30

    fieldsets = (
        ('User Request', {
            'fields': ('user', 'scope', 'category_name', 'source_name', 'description',
                       'unit', 'quantity', 'year', 'month', 'facility'),
        }),
        ('Admin Review', {
            'fields': ('status', 'admin_notes', 'approved_factor_kg_co2e',
                       'calculated_co2e_kg', 'linked_entry'),
            'description': 'Set status to Approved and enter the factor to auto-calculate.',
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    def scope_badge(self, obj):
        colors = {'scope1': '#ef4444', 'scope2': '#eab308', 'scope3': '#3b82f6'}
        c = colors.get(obj.scope, '#6b7280')
        return format_html('<span style="background:{}; color:white; padding:2px 8px; border-radius:4px; font-size:11px;">{}</span>', c, obj.scope.replace('scope', 'S'))
    scope_badge.short_description = 'Scope'

    def status_badge(self, obj):
        colors = {'pending': '#f59e0b', 'approved': '#10b981', 'rejected': '#ef4444'}
        c = colors.get(obj.status, '#6b7280')
        return format_html('<span style="background:{}; color:white; padding:2px 8px; border-radius:4px; font-size:11px;">{}</span>', c, obj.get_status_display())
    status_badge.short_description = 'Status'

    def save_model(self, request, obj, form, change):
        if obj.status == 'approved' and obj.approved_factor_kg_co2e and not obj.calculated_co2e_kg:
            obj.calculated_co2e_kg = obj.quantity * obj.approved_factor_kg_co2e
        super().save_model(request, obj, form, change)

        if change and 'status' in form.changed_data:
            from accounts.models import Notification
            if obj.status == 'approved':
                Notification.objects.create(
                    user=obj.user, notification_type='custom_approved',
                    title='Özel talep onaylandı',
                    message=f'{obj.source_name}: {obj.calculated_co2e_kg or 0:.2f} kg CO2e',
                    link='/dashboard',
                )
            elif obj.status == 'rejected':
                Notification.objects.create(
                    user=obj.user, notification_type='custom_rejected',
                    title='Özel talep reddedildi',
                    message=f'{obj.source_name}: {obj.admin_notes or ""}',
                    link='/dashboard',
                )
