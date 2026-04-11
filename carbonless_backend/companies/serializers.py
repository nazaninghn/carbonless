from rest_framework import serializers
from .models import Company, Facility, CompanyMembership


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            'id', 'legal_entity_name', 'tax_number', 'country_of_headquarters',
            'countries_of_operation', 'nace_code', 'main_activity_description',
            'number_of_employees', 'annual_turnover_range', 'number_of_facilities',
            'has_overseas_operations', 'number_of_subsidiaries',
            'has_iso_14001', 'has_iso_50001', 'has_iso_14064_work',
            'target_iso_14064_verification', 'has_3rd_party_audit_plan',
            'is_for_financing', 'is_due_to_export_pressure', 'is_for_group_reporting',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class FacilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Facility
        fields = ['id', 'company', 'name', 'address', 'city', 'country',
                  'facility_type', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class CompanyMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = CompanyMembership
        fields = ['id', 'company', 'user', 'username', 'user_email',
                  'role', 'is_active', 'invited_by', 'created_at']
        read_only_fields = ['id', 'created_at']
