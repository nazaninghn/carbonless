from rest_framework import serializers
from .contact import message, phone_ok, website_ok
from .models import Company, Facility, CompanyMembership


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            'id', 'legal_entity_name', 'tax_number', 'country_of_headquarters',
            'countries_of_operation', 'nace_code', 'main_activity_description',
            'registered_address', 'telephone', 'website', 'tax_office',
            'trade_registry_number', 'inventory_declaration_scope',
            'environmental_regulations', 'certificates',
            'number_of_employees', 'annual_turnover_range', 'number_of_facilities',
            'has_overseas_operations', 'number_of_subsidiaries',
            'has_iso_14001', 'has_iso_50001', 'has_iso_14064_work',
            'target_iso_14064_verification', 'has_3rd_party_audit_plan',
            'is_for_financing', 'is_due_to_export_pressure', 'is_for_group_reporting',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    # The report prints these as stated (companies/contact.py).
    def _lang(self):
        request = self.context.get('request')
        profile = getattr(getattr(request, 'user', None), 'profile', None)
        return getattr(profile, 'language_preference', 'tr')

    def validate_telephone(self, value):
        if not phone_ok(value):
            raise serializers.ValidationError(message('invalid_phone', self._lang()), code='invalid_phone')
        return (value or '').strip()

    def validate_website(self, value):
        if not website_ok(value):
            raise serializers.ValidationError(message('invalid_website', self._lang()), code='invalid_website')
        return (value or '').strip()


class FacilitySerializer(serializers.ModelSerializer):
    # Shown before deleting a facility: its entries are kept, only unlinked.
    entry_count = serializers.SerializerMethodField()

    def get_entry_count(self, obj):
        return obj.emission_entries.count()

    class Meta:
        model = Facility
        fields = ['id', 'company', 'name', 'address', 'city', 'country',
                  'facility_type', 'is_active', 'created_at', 'entry_count']
        # 'company' is set server-side from the requester's own membership
        # (see FacilityListCreateView.perform_create) — it must never be
        # settable by the client, or a PATCH could reassign a facility to a
        # company the user has no relationship with.
        read_only_fields = ['id', 'created_at', 'company']


class CompanyMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    # The member's name as they set it in their profile ('' when not set).
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return obj.user.get_full_name() if obj.user_id else ''

    class Meta:
        model = CompanyMembership
        fields = ['id', 'company', 'user', 'username', 'user_email', 'full_name',
                  'role', 'is_active', 'invited_by', 'created_at']
        # 'company' and 'user' must never be client-writable: this serializer
        # backs CompanyMembershipUpdateView, and a PATCH with a different
        # company/user id would let an admin move their own membership into
        # an arbitrary company they were never invited to (full tenant
        # takeover), or hijack another user's membership row.
        read_only_fields = ['id', 'created_at', 'company', 'user']
