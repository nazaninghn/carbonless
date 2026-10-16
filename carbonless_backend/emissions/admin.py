from django import forms
from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from .models import EmissionFactor, EmissionEntry, ReductionTarget, CustomEmissionRequest


@admin.register(EmissionFactor)
class EmissionFactorAdmin(ModelAdmin):
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
        ('Per-Gas Breakdown', {
            'fields': ('gas_split_basis',
                       ('factor_co2_kg_co2e', 'factor_ch4_kg_co2e', 'factor_n2o_kg_co2e'),
                       ('factor_hfc_kg_co2e', 'factor_pfc_kg_co2e', 'factor_sf6_kg_co2e'),
                       'gas_split_reference'),
            'classes': ('collapse',),
            'description': (
                'How this factor\'s CO2e divides between greenhouse gases — required by '
                'ISO 14064-1 reporting, which is gas by gas rather than CO2e only. Each '
                'value is kg CO2e per unit (already GWP-weighted), so the six must add up '
                'to the factor above. Leave all six blank when the publisher issues no '
                'split; the report then reports the source as a combined CO2e figure and '
                'says so. Most rows are filled by "manage.py seed_gas_splits".'),
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
class EmissionEntryAdmin(ModelAdmin):
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
class ReductionTargetAdmin(ModelAdmin):
    list_display = ['user', 'title', 'base_year', 'target_year',
                    'target_reduction_percent', 'status']
    list_filter = ['status']
    search_fields = ['user__username', 'title']


class CustomEmissionRequestForm(forms.ModelForm):
    """A facility electricity factor needs a facility, Scope 2 and kWh, and
    there is at most one approved factor per facility + year + method —
    approving a second one would leave two factors for the same kWh."""

    class Meta:
        model = CustomEmissionRequest
        fields = '__all__'

    def clean(self):
        data = super().clean()
        method = data.get('electricity_method')
        if not method:
            return data
        errors = {}
        facility, year = data.get('facility'), data.get('year')
        if not facility:
            errors['facility'] = 'A facility electricity factor needs the facility.'
        if data.get('scope') != 'scope2':
            errors['scope'] = 'A facility electricity factor is Scope 2.'
        if (data.get('unit') or '').strip().lower() != 'kwh':
            errors['unit'] = 'A facility electricity factor is per kWh.'
        if data.get('status') == 'approved':
            if not data.get('approved_factor_kg_co2e'):
                errors['approved_factor_kg_co2e'] = 'Enter the approved factor (kg CO2e per kWh).'
            if facility and year:
                other = (CustomEmissionRequest.objects
                         .filter(facility=facility, year=year, electricity_method=method, status='approved')
                         .exclude(pk=self.instance.pk).first())
                if other:
                    errors['electricity_method'] = (
                        f'Request #{other.pk} is already the approved {method.replace("_", "-")} electricity '
                        f'factor of {facility.name} for {year}. Reject or change that one first.')
        if errors:
            raise forms.ValidationError(errors)
        return data


@admin.register(CustomEmissionRequest)
class CustomEmissionRequestAdmin(ModelAdmin):
    form = CustomEmissionRequestForm
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
            'fields': ('status', 'admin_notes', 'approved_factor_kg_co2e', 'electricity_method',
                       'calculated_co2e_kg', 'linked_entry'),
            'description': 'Set status to Approved and enter the factor to auto-calculate. For a '
                           "facility's purchased electricity, set the electricity method: the factor then "
                           "replaces that facility's electricity factor for the year (location-based: the "
                           'inventory is recalculated; market-based: the separate market-based result) and '
                           "the request's own amount is not added to any total.",
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

        # A location-based facility factor changes that facility's electricity
        # entries (and their Scope 3 Category 3 rows): recalculate the
        # inventory of the year now, whether it was approved, withdrawn or edited.
        touched = {'status', 'electricity_method', 'approved_factor_kg_co2e', 'facility', 'year'}
        before = getattr(form, 'initial', {}) if change else {}
        if obj.company_id and touched & set(getattr(form, 'changed_data', ())) and 'location_based' in (
                obj.electricity_method, before.get('electricity_method')):
            from questionnaire.step_entries import resync_inventory
            for year in {obj.year, before.get('year') or obj.year}:
                resync_inventory(obj.company, year, getattr(request, 'user', None) or obj.user)

        if change and 'status' in form.changed_data and obj.user_id:
            from .notifications import notify_custom_request_reviewed
            notify_custom_request_reviewed(obj)
