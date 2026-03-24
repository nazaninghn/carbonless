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
