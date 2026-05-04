from rest_framework import serializers
import datetime


class StepA1Serializer(serializers.Serializer):
    legal_name = serializers.CharField(max_length=200)

    def validate_legal_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Company name is required.")
        return value.strip()


class StepA2Serializer(serializers.Serializer):
    tax_id = serializers.CharField()

    def validate_tax_id(self, value):
        digits = value.replace(' ', '').replace('-', '')
        if not digits.isdigit():
            raise serializers.ValidationError("Numbers only.")
        if len(digits) not in [10, 11]:
            raise serializers.ValidationError("Must be 10 or 11 digits.")
        return digits


class StepA3Serializer(serializers.Serializer):
    country = serializers.CharField(max_length=100)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')

    def validate_country(self, value):
        return value.strip()


class StepA4Serializer(serializers.Serializer):
    reporting_year = serializers.IntegerField()

    def validate_reporting_year(self, value):
        current = datetime.date.today().year
        if value < 2015:
            raise serializers.ValidationError("Year must be 2015 or later.")
        if value > current:
            raise serializers.ValidationError("Cannot select a future year.")
        return value


class StepA5Serializer(serializers.Serializer):
    prepared_by = serializers.CharField(max_length=100)

    def validate_prepared_by(self, value):
        if not value.strip():
            raise serializers.ValidationError("This field is required.")
        return value.strip()


class StepA6Serializer(serializers.Serializer):
    VALID_PURPOSES = ['internal', 'legal', 'voluntary', 'client', 'skip']

    purposes = serializers.ListField(
        child=serializers.ChoiceField(choices=VALID_PURPOSES),
        required=False,
        default=list
    )
    legal_framework = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=''
    )
    voluntary_framework = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=''
    )


class StepA7Serializer(serializers.Serializer):
    has_previous_report = serializers.BooleanField(required=False, allow_null=True, default=None)


class StepA7aSerializer(serializers.Serializer):
    baseline_year = serializers.IntegerField(
        min_value=2010, required=False, allow_null=True
    )


class StepB1Serializer(serializers.Serializer):
    nace_code = serializers.CharField(max_length=50)
    nace_label = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')


class StepB2Serializer(serializers.Serializer):
    activity_description = serializers.CharField(max_length=500)


class StepB3Serializer(serializers.Serializer):
    BANDS = ['1-50', '51-250', '251-1000', '1001-5000', '5000+']
    employee_band = serializers.ChoiceField(choices=BANDS)


class StepB4Serializer(serializers.Serializer):
    number_of_facilities = serializers.IntegerField(min_value=1)


class StepB5Serializer(serializers.Serializer):
    TYPES = ['office', 'factory', 'warehouse', 'field', 'datacenter', 'retail', 'other']
    facility_types = serializers.ListField(
        child=serializers.ChoiceField(choices=TYPES),
        min_length=1
    )


class StepB6Serializer(serializers.Serializer):
    BANDS = ['<1M', '1-10M', '10-100M', '100M-1B', '1B+', 'skip']
    revenue_band = serializers.ChoiceField(choices=BANDS)


class StepC1Serializer(serializers.Serializer):
    has_subsidiaries = serializers.BooleanField()


class StepC2Serializer(serializers.Serializer):
    has_international = serializers.BooleanField()


class StepC3Serializer(serializers.Serializer):
    has_jv_franchise = serializers.BooleanField()


class StepD1Serializer(serializers.Serializer):
    DATABASES = ['DEFRA', 'DEFRA_TUIK', 'IPCC_AR6', 'EPA', 'custom']
    ef_database = serializers.ChoiceField(choices=DATABASES)
    ef_custom_source = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=''
    )
    ef_custom_year = serializers.IntegerField(required=False, allow_null=True)


class StepD3Serializer(serializers.Serializer):
    APPROACHES = ['operational_control', 'financial_control', 'equity_share']
    boundary_approach = serializers.ChoiceField(choices=APPROACHES)


class StepD4Serializer(serializers.Serializer):
    APPROACHES = ['materiality', 'full']
    scope3_approach = serializers.ChoiceField(choices=APPROACHES)
