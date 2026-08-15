from rest_framework import serializers
from .models import EmissionFactor, EmissionEntry, ReductionTarget, CustomEmissionRequest


class EmissionFactorSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmissionFactor
        fields = '__all__'


class EmissionEntrySerializer(serializers.ModelSerializer):
    emission_factor_name = serializers.CharField(source='emission_factor.name', read_only=True)
    emission_factor_name_tr = serializers.CharField(source='emission_factor.name_tr', read_only=True)
    scope = serializers.CharField(source='emission_factor.scope', read_only=True)
    category = serializers.CharField(source='emission_factor.category', read_only=True)
    unit = serializers.CharField(source='emission_factor.unit', read_only=True)
    country = serializers.CharField(source='emission_factor.country', read_only=True)
    factor_year_used = serializers.IntegerField(source='emission_factor.year', read_only=True)
    source_dataset = serializers.CharField(source='emission_factor.source', read_only=True)
    calculated_co2e_tonne = serializers.DecimalField(
        max_digits=16, decimal_places=4, read_only=True
    )
    # Fix #58: facility_name was missing — frontend uses entry.facility_name to
    # display the facility label in the entries table and cards.  Without this
    # field, the facility badge was always hidden even when a facility was linked.
    facility_name = serializers.CharField(
        source='facility.name', read_only=True, allow_null=True, default=None
    )

    class Meta:
        model = EmissionEntry
        # Fix #40: Added status, approved_at, rejected_reason so clients can see
        # whether an entry is pending/approved/rejected without a separate request.
        # These fields are read-only — the approval workflow uses approve_entry_view.
        # Fix #57: Added proof_document so the frontend paperclip icon and the
        # "Upload a proof document" getting-started step work correctly.
        fields = [
            'id', 'emission_factor', 'emission_factor_name',
            'emission_factor_name_tr', 'scope', 'category', 'unit',
            'country', 'year', 'month', 'quantity',
            'calculated_co2e_kg', 'calculated_co2e_tonne',
            'factor_year_used', 'source_dataset',
            # Audit trail: the factor value/source actually used at calculation
            # time, frozen on first save — distinct from factor_year_used /
            # source_dataset above, which read the *live* EmissionFactor row
            # and would silently show a different value if that row is ever
            # corrected or re-pointed after this entry was calculated.
            'factor_value_snapshot', 'factor_source_snapshot',
            'description', 'facility', 'facility_name',
            'proof_document',
            'status', 'approved_at', 'rejected_reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'calculated_co2e_kg', 'facility_name', 'proof_document',
            'status', 'approved_at', 'rejected_reason',
            'created_at', 'updated_at',
            'factor_value_snapshot', 'factor_source_snapshot',
        ]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than zero.')
        # Sanity ceiling, not a real-world limit — guards against a typo'd or
        # malicious value silently corrupting calculated_co2e_kg totals and
        # downstream ISO 14064-1 reports.
        if value > 1_000_000_000_000:
            raise serializers.ValidationError('Quantity is unrealistically large — please check the value.')
        return value

    def validate_facility(self, value):
        if value is None:
            return value
        from companies.utils import get_current_company
        request = self.context.get('request')
        company = get_current_company(request.user) if request else None
        if not company or value.company_id != company.id:
            raise serializers.ValidationError('Facility not found.')
        return value


class ReductionTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReductionTarget
        fields = '__all__'
        # 'company' is set server-side from the requester's own membership
        # (see ReductionTargetViewSet.perform_create) — must stay read-only
        # or a PATCH could reassign a target to an unrelated company.
        read_only_fields = ['user', 'company', 'created_at']


class CustomEmissionRequestSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = CustomEmissionRequest
        fields = [
            'id', 'username', 'scope', 'category_name', 'source_name',
            'description', 'unit', 'quantity', 'year', 'month', 'facility',
            'status', 'admin_notes', 'approved_factor_kg_co2e',
            'calculated_co2e_kg', 'linked_entry',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'user', 'status', 'admin_notes', 'approved_factor_kg_co2e',
            'calculated_co2e_kg', 'linked_entry', 'created_at', 'updated_at'
        ]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than zero.')
        if value > 1_000_000_000_000:
            raise serializers.ValidationError('Quantity is unrealistically large — please check the value.')
        return value

    def validate_facility(self, value):
        if value is None:
            return value
        from companies.utils import get_current_company
        request = self.context.get('request')
        company = get_current_company(request.user) if request else None
        if not company or value.company_id != company.id:
            raise serializers.ValidationError('Facility not found.')
        return value
