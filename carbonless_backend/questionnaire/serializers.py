from rest_framework import serializers
import datetime
import re


class StepA1Serializer(serializers.Serializer):
    legal_name = serializers.CharField(max_length=200)

    def validate_legal_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Company name is required.")
        return value.strip()


TURKEY_CODES = {'TR', 'TUR', 'TURKEY', 'TÜRKIYE', 'TÜRKİYE', 'TURKIYE'}


def is_turkish_company(company):
    """Turkish (or not yet set) headquarters: tax IDs are VKN/TCKN."""
    country = (getattr(company, 'country_of_headquarters', '') or '').strip().upper()
    return not country or country in TURKEY_CODES


class StepA2Serializer(serializers.Serializer):
    """Tax ID. A Turkish company gives its VKN (10 digits) or TCKN (11); a
    company based elsewhere gives its own registration / VAT number, which
    has no single format (GB123456789, DE123456789, 12-3456789, …)."""
    tax_id = serializers.CharField()

    def validate_tax_id(self, value):
        company = self.context.get('company')
        if company is not None and not is_turkish_company(company):
            cleaned = ' '.join(value.split()).upper()
            if not re.fullmatch(r'[A-Z0-9][A-Z0-9 ./-]{3,29}', cleaned) or not re.search(r'\d', cleaned):
                raise serializers.ValidationError(
                    "Enter your company's tax or VAT registration number (letters and digits, 4-30 characters).")
            return cleaned
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


class StepA7bSerializer(serializers.Serializer):
    """Organisation details published in the report's first table.

    Every field is optional and may be sent blank: the report prints
    "Not declared" in place of anything the organisation has not stated, so an
    empty submission is a valid answer rather than a skipped step.

    No `default` on purpose. With one, DRF would materialise every key on every
    request, and a caller sending only the field it meant to change would
    silently blank the other seven. Leaving them absent lets handle_A7b tell
    "not mentioned" (leave alone) from "sent empty" (clear).
    """
    _opt = dict(required=False, allow_blank=True)
    registered_address = serializers.CharField(max_length=500, **_opt)
    tax_office = serializers.CharField(max_length=150, **_opt)
    trade_registry_number = serializers.CharField(max_length=100, **_opt)
    telephone = serializers.CharField(max_length=50, **_opt)
    website = serializers.CharField(max_length=255, **_opt)
    inventory_declaration_scope = serializers.CharField(max_length=1000, **_opt)
    environmental_regulations = serializers.CharField(max_length=2000, **_opt)
    certificates = serializers.CharField(max_length=2000, **_opt)
    del _opt

    # Same checks as Company Settings (companies/contact.py).
    def validate_telephone(self, value):
        from companies.contact import message, phone_ok
        if not phone_ok(value):
            raise serializers.ValidationError(message('invalid_phone', self.context.get('lang')))
        return value

    def validate_website(self, value):
        from companies.contact import message, website_ok
        if not website_ok(value):
            raise serializers.ValidationError(message('invalid_website', self.context.get('lang')))
        return value


class StepB1Serializer(serializers.Serializer):
    nace_code = serializers.CharField(max_length=50)
    nace_label = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')


class StepB2Serializer(serializers.Serializer):
    activity_description = serializers.CharField(max_length=500)


class StepB3Serializer(serializers.Serializer):
    BANDS = ['1-50', '51-250', '251-1000', '1001-5000', '5000+']
    employee_band = serializers.ChoiceField(choices=BANDS)


class StepB4Serializer(serializers.Serializer):
    number_of_facilities = serializers.IntegerField(
        min_value=1,
        max_value=10000,
        error_messages={
            'min_value': 'En az 1 tesis / At least 1 facility.',
            'max_value': 'Gerçekçi bir tesis sayısı girin / Enter a realistic number of facilities.',
            'invalid': 'Geçerli bir sayı girin / Enter a valid number.',
        },
    )


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
    DATABASES = ['std_ghg', 'std_ipcc', 'std_defra', 'std_mix',
                 'DEFRA', 'DEFRA_TUIK', 'IPCC_AR6', 'EPA', 'custom']
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


class SignOffExclusionsSerializer(serializers.Serializer):
    """The written justification the signatory gives, per question, for an amount of direct or
    energy-indirect emissions the inventory does not calculate: {step_id: text}."""
    from .step_entries import EXCLUSION_JUSTIFICATION_MIN as MIN, EXCLUSION_JUSTIFICATION_MAX as MAX
    exclusions = serializers.DictField(
        required=False,
        child=serializers.CharField(
            min_length=MIN, max_length=MAX, trim_whitespace=True,
            error_messages={
                'min_length': f'Gerekçe en az {MIN} karakter olmalıdır / The justification must be at least {MIN} characters.',
                'max_length': f'Gerekçe en fazla {MAX} karakter olabilir / The justification may be at most {MAX} characters.',
                'blank': 'Gerekçe boş bırakılamaz / The justification cannot be empty.',
                'invalid': 'Gerekçe metin olmalıdır / The justification must be text.',
                'null': 'Gerekçe boş bırakılamaz / The justification cannot be empty.',
            }),
        error_messages={'not_a_dict': 'Gerekçeler soru başına verilmelidir / Justifications are given per question.'},
    )


class DataSourceSerializer(serializers.Serializer):
    """Where the figure of a calculating question comes from. "other" carries the uncertainty the organisation
    states for it, in per cent, and the reason — both go to the advisor."""
    from .uncertainty import (OTHER, SOURCES, OTHER_PERCENT_MIN as PMIN, OTHER_PERCENT_MAX as PMAX,
                              OTHER_REASON_MIN as RMIN, OTHER_REASON_MAX as RMAX)
    data_source = serializers.ChoiceField(choices=SOURCES, error_messages={
        'invalid_choice': 'Geçersiz veri kaynağı. Ölçüm, fatura / sistem verisi, tahmin veya diğer seçin / '
                          'Invalid data source. Choose measurement, invoice / system data, estimate or other.',
        'required': 'Veri kaynağı gerekli / A data source is required.'})
    data_source_percent = serializers.FloatField(required=False, allow_null=True, min_value=PMIN, max_value=PMAX, error_messages={
        # "%%": DRF formats these messages with the limit value.
        'min_value': f'Belirsizlik en az %%{PMIN} olmalıdır / The uncertainty must be at least {PMIN} %%.',
        'max_value': f'Belirsizlik en fazla %%{PMAX:.0f} olabilir / The uncertainty may be at most {PMAX:.0f} %%.',
        'invalid': 'Belirsizlik için geçerli bir sayı girin / Enter a valid number for the uncertainty.'})
    data_source_reason = serializers.CharField(required=False, allow_blank=True, min_length=RMIN, max_length=RMAX,
                                               trim_whitespace=True, error_messages={
        'min_length': f'Gerekçe en az {RMIN} karakter olmalıdır / The reason must be at least {RMIN} characters.',
        'max_length': f'Gerekçe en fazla {RMAX} karakter olabilir / The reason may be at most {RMAX} characters.'})
    data_source_small = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if attrs['data_source'] == self.OTHER:
            if attrs.get('data_source_percent') is None:
                raise serializers.ValidationError({'data_source_percent': [
                    '"Diğer" için belirsizlik yüzdesini girin / Enter the uncertainty in per cent for "other".']})
            if not (attrs.get('data_source_reason') or '').strip():
                raise serializers.ValidationError({'data_source_reason': [
                    '"Diğer" için gerekçe yazın; danışman onayına gider / Write the reason for "other"; it goes to the advisor.']})
        return attrs
