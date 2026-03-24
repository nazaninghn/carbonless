from django.contrib import admin
from .models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('legal_entity_name', 'tax_number', 'country_of_headquarters', 'created_at')
    search_fields = ('legal_entity_name', 'tax_number')
    list_filter = ('country_of_headquarters', 'has_iso_14001', 'has_iso_50001')
    readonly_fields = ('created_at', 'updated_at')
