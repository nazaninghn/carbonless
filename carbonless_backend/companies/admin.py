from django.contrib import admin
from .models import Company, Facility, CompanyMembership


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('legal_entity_name', 'tax_number', 'country_of_headquarters', 'created_at')
    search_fields = ('legal_entity_name', 'tax_number')
    list_filter = ('country_of_headquarters', 'has_iso_14001', 'has_iso_50001')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Facility)
class FacilityAdmin(admin.ModelAdmin):
    list_display = ['name', 'company', 'city', 'country', 'facility_type', 'is_active']
    list_filter = ['is_active', 'facility_type']
    search_fields = ['name', 'company__legal_entity_name']


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'company', 'role', 'is_active', 'created_at']
    list_filter = ['role', 'is_active']
    search_fields = ['user__username', 'company__legal_entity_name']
