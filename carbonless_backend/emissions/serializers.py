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
    # Who entered it — shown on approval cards so an approver knows whose data it is.
    entered_by = serializers.SerializerMethodField()
    # Whether the requester entered it: a data-entry member may only change
    # their own entries, so the UI shows edit/delete only on those.
    is_mine = serializers.SerializerMethodField()
    # Whether the recorded proof file is actually in storage (a server disk
    # wiped by a redeploy leaves the record but loses the file).
    proof_available = serializers.SerializerMethodField()
    # For entries the questionnaire created: which inventory and question they
    # come from, so the UI can send the user there to correct them.
    questionnaire_source = serializers.SerializerMethodField()

    def get_questionnaire_source(self, obj):
        desc = obj.description or ''
        if not desc.startswith('Questionnaire step '):
            return None
        step_id = desc[len('Questionnaire step '):].split(' ')[0]
        cache = self.context.setdefault('_inventory_by_year', {})
        key = (obj.company_id, obj.year)
        if key not in cache:
            from questionnaire.models import CarbonReport
            report = (CarbonReport.objects
                      .filter(company_id=obj.company_id, reporting_year=obj.year)
                      .order_by('-updated_at').only('id').first())
            cache[key] = report.id if report else None
        if not cache[key]:
            return None
        return {'report_id': cache[key], 'step_id': step_id}

    def get_proof_available(self, obj):
        f = obj.proof_document
        if not f:
            return False
        try:
            return f.storage.exists(f.name)
        except Exception:
            return False

    def get_is_mine(self, obj):
        request = self.context.get('request')
        return bool(request and obj.user_id and obj.user_id == request.user.id)

    def get_entered_by(self, obj):
        u = obj.user
        if not u:
            return None
        return u.get_full_name() or u.email or u.username

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
            'created_at', 'updated_at', 'entered_by', 'is_mine', 'proof_available', 'questionnaire_source',
        ]
        read_only_fields = [
            'calculated_co2e_kg', 'facility_name',
            'status', 'approved_at', 'rejected_reason',
            'created_at', 'updated_at',
            'factor_value_snapshot', 'factor_source_snapshot',
        ]

    # Same limits as EmissionEntry.clean(); checked here so a bad upload is a
    # 400 with a message instead of a ValidationError escaping save() as a 500.
    PROOF_MAX_BYTES = 10 * 1024 * 1024
    PROOF_EXTENSIONS = ('.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx')

    def validate_proof_document(self, value):
        if not value:
            return value
        import os
        if value.size > self.PROOF_MAX_BYTES:
            raise serializers.ValidationError('File size must be under 10MB.')
        if os.path.splitext(value.name)[1].lower() not in self.PROOF_EXTENSIONS:
            raise serializers.ValidationError(
                'File type not allowed. Use: ' + ', '.join(self.PROOF_EXTENSIONS)
            )
        return value

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

    def validate(self, attrs):
        # No entries for a month that hasn't started yet (emissions/periods.py).
        from emissions.periods import FUTURE_PERIOD_CODE, future_period_message, is_future_period
        year = attrs.get('year', getattr(self.instance, 'year', None))
        month = attrs.get('month', getattr(self.instance, 'month', None))
        if ('year' in attrs or 'month' in attrs) and is_future_period(year, month):
            raise serializers.ValidationError(
                {'month': [future_period_message('en')], 'code': FUTURE_PERIOD_CODE})
        return attrs


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

    def validate_unit(self, value):
        # A unit, not a sentence (the form offers a list plus a short "other").
        value = (value or '').strip()
        if len(value) > 20:
            raise serializers.ValidationError('Enter a short unit (at most 20 characters), e.g. litre, kg, kWh.')
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

    def validate(self, attrs):
        from emissions.periods import FUTURE_PERIOD_CODE, future_period_message, is_future_period
        if is_future_period(attrs.get('year'), attrs.get('month')):
            raise serializers.ValidationError(
                {'month': [future_period_message('en')], 'code': FUTURE_PERIOD_CODE})
        return attrs
