import re

from rest_framework import serializers
from .contact import message, phone_ok, website_ok
from .models import Company, Facility, CompanyMembership


class CompanySerializer(serializers.ModelSerializer):
    # Required for every country and exactly 10 numeric digits. Declared
    # explicitly so a full create (registration / company create) must supply
    # it, while a partial PATCH that omits it stays untouched. `allow_blank` is
    # True so that an empty value reaches validate_tax_number and gets the same
    # bilingual "exactly 10 digits" message instead of DRF's generic blank one.
    tax_number = serializers.CharField(required=True, allow_blank=True)

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

    def validate_tax_number(self, value):
        # Universal rule: required, exactly 10 numeric digits (0-9). Spaces,
        # dashes and letters are stripped first, then the result must be
        # exactly 10 digits. The stored value is always the normalised digits.
        digits = re.sub(r'\D', '', value or '')
        if not re.fullmatch(r'\d{10}', digits):
            tr = self._lang() == 'tr'
            raise serializers.ValidationError(
                'Vergi numarası tam olarak 10 haneli olmalıdır' if tr
                else 'Tax number must be exactly 10 digits', code='invalid_tax_number')
        return digits


class FacilitySerializer(serializers.ModelSerializer):
    # Shown before deleting a facility: its entries are kept, only unlinked.
    entry_count = serializers.SerializerMethodField()

    def get_entry_count(self, obj):
        return obj.emission_entries.count()

    # A grid connection a data-entry member gave in Q24, waiting for an
    # approver: {'connection': 'transmission' | 'distribution' | '' (not
    # known), 'year'}, or None.
    proposed_grid_connection = serializers.SerializerMethodField()

    def get_proposed_grid_connection(self, obj):
        if not hasattr(self, '_proposals'):
            from questionnaire.facility_sync import proposed_connections
            self._proposals = proposed_connections(obj.company) if obj.company_id else {}
        return self._proposals.get(obj.pk)

    def validate_name(self, value):
        # Two facilities with one name can't be told apart in the entry form,
        # the filters and the reports, and the questionnaire matches its
        # facility answers to facilities by name (questionnaire/facility_sync).
        value = (value or '').strip()
        request = self.context.get('request')
        company = self.instance.company if self.instance else None
        if company is None and request is not None:
            from .utils import get_current_company
            company = get_current_company(request.user)
        if company is not None:
            clash = Facility.objects.filter(company=company, name__iexact=value)
            if self.instance:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                profile = getattr(getattr(request, 'user', None), 'profile', None)
                tr = getattr(profile, 'language_preference', 'tr') == 'tr'
                raise serializers.ValidationError(
                    f'"{value}" adında bir tesis zaten var. Farklı bir ad girin.' if tr
                    else f'A facility named "{value}" already exists. Choose a different name.',
                    code='duplicate_name')
        return value

    class Meta:
        model = Facility
        fields = ['id', 'company', 'name', 'address', 'city', 'country',
                  'facility_type', 'grid_connection', 'proposed_grid_connection', 'is_active',
                  'created_at', 'entry_count']
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
