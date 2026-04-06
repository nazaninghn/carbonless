from rest_framework import serializers
from .models import EmissionFactor, EmissionEntry, ReductionTarget


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

    class Meta:
        model = EmissionEntry
        fields = [
            'id', 'emission_factor', 'emission_factor_name',
            'emission_factor_name_tr', 'scope', 'category', 'unit',
            'country', 'year', 'month', 'quantity',
            'calculated_co2e_kg', 'calculated_co2e_tonne',
            'factor_year_used', 'source_dataset',
            'description', 'facility', 'created_at', 'updated_at'
        ]
        read_only_fields = ['calculated_co2e_kg', 'created_at', 'updated_at']


class ReductionTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReductionTarget
        fields = '__all__'
        read_only_fields = ['user', 'created_at']
