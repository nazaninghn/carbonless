from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Company, Facility, CompanyMembership


@admin.register(Company)
class CompanyAdmin(ModelAdmin):
    list_display = ('legal_entity_name', 'tax_number', 'country_of_headquarters', 'created_at')
    search_fields = ('legal_entity_name', 'tax_number')
    list_filter = ('country_of_headquarters', 'has_iso_14001', 'has_iso_50001')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Facility)
class FacilityAdmin(ModelAdmin):
    list_display = ['name', 'company', 'city', 'country', 'facility_type', 'is_active']
    list_filter = ['is_active', 'facility_type']
    search_fields = ['name', 'company__legal_entity_name']

    def has_delete_permission(self, request, obj=None):
        # A facility that an entry of a signed inventory points at is not deleted (the delete would null
        # that reference); this also keeps it out of the bulk "delete selected" action.
        if obj is not None:
            from questionnaire.immutability import InventoryGuardError, assert_facility_deletable
            try:
                assert_facility_deletable(obj)
            except InventoryGuardError:
                return False
        return super().has_delete_permission(request, obj)

    def save_model(self, request, obj, form, change):
        # A change a signed inventory depends on (name, country, grid connection) is refused by the model's
        # pre_save guard; show it as an admin error instead of a server error.
        from django.contrib import messages
        from questionnaire.immutability import InventoryGuardError
        try:
            super().save_model(request, obj, form, change)
        except InventoryGuardError as exc:
            self.message_user(request, f'{exc.en} / {exc.tr}', level=messages.ERROR)


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(ModelAdmin):
    list_display = ['user', 'company', 'role', 'is_active', 'created_at']
    list_filter = ['role', 'is_active']
    search_fields = ['user__username', 'company__legal_entity_name']
