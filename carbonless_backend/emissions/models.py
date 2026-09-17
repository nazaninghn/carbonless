from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User


class EmissionFactor(models.Model):
    """Emission factors from Defra 2024, IPCC 2006/2019, Turkey ISO 14064-1 verified inventory, Turkey-specific"""

    SCOPE_CHOICES = [
        ('scope1', 'Scope 1 - Direct'),
        ('scope2', 'Scope 2 - Energy Indirect'),
        ('scope3', 'Scope 3 - Other Indirect'),
    ]

    CATEGORY_CHOICES = [
        # Scope 1
        ('stationary_combustion', 'Stationary Combustion'),
        ('mobile_combustion', 'Mobile Combustion'),
        ('fugitive_emissions', 'Fugitive Emissions'),
        # Scope 2
        ('electricity', 'Electricity'),
        ('steam_heat', 'Steam & Heat'),
        # Scope 3
        ('purchased_goods', 'Purchased Goods & Services'),
        ('capital_goods', 'Capital Goods'),
        ('fuel_energy', 'Fuel & Energy Related'),
        ('upstream_transport', 'Upstream Transportation'),
        ('waste', 'Waste Generated'),
        ('business_travel', 'Business Travel'),
        ('employee_commuting', 'Employee Commuting'),
        ('upstream_leased', 'Upstream Leased Assets'),
        ('downstream_transport', 'Downstream Transportation'),
        ('processing_sold', 'Processing of Sold Products'),
        ('use_of_sold', 'Use of Sold Products'),
        ('end_of_life', 'End-of-Life Treatment'),
        ('franchises', 'Franchises'),
        ('investments', 'Investments'),
        ('water', 'Water'),
        ('custom', 'Custom'),
    ]

    UNIT_CHOICES = [
        ('liters', 'Litres'),
        ('kg', 'Kilogram'),
        ('tonne', 'Tonne'),
        ('kwh', 'kWh'),
        ('gj', 'GJ'),
        ('m3', 'm³'),
        ('m2', 'm²'),
        ('km', 'Kilometre'),
        ('pkm', 'Passenger-km'),
        ('tonne-km', 'Tonne-km'),
        ('night', 'Night'),
        ('units', 'Unit'),
        ('packages', 'Packages'),
        ('usd', 'USD'),
        ('franchises', 'Franchises'),
    ]

    SOURCE_CHOICES = [
        ('defra_2024', 'Defra/DESNZ 2024'),
        ('ipcc_2006', 'IPCC 2006'),
        ('ipcc_2019', 'IPCC 2019 + AR6 GWP'),
        ('turkey_grid', 'Turkey Grid/National'),
        ('atom_kablo', 'Turkey ISO 14064-1 verified inventory'),
        ('icao', 'ICAO'),
        ('turkey_fleet', 'Turkey Fleet'),
        ('generic', 'Generic/Estimated'),
        ('custom', 'Custom'),
    ]

    COUNTRY_CHOICES = [
        ('global', 'Global'),
        ('turkey', 'Turkey'),
    ]

    name = models.CharField(max_length=255)
    name_tr = models.CharField(max_length=255, blank=True)
    slug = models.CharField(max_length=100, default='', help_text='Unique key e.g. coal-industrial')
    scope = models.CharField(max_length=10, choices=SCOPE_CHOICES)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    country = models.CharField(max_length=10, choices=COUNTRY_CHOICES, default='global')
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES)
    factor_kg_co2e = models.DecimalField(max_digits=14, decimal_places=6, help_text='kg CO2e per unit')
    year = models.IntegerField(default=2024, help_text='Factor reference year (hidden from user)')
    is_default = models.BooleanField(default=True, help_text='Default factor for this slug+country+category')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='defra_2024')
    reference = models.TextField(blank=True, help_text='Source reference text')
    is_active = models.BooleanField(default=True)

    # ── Per-gas breakdown of factor_kg_co2e ──────────────────────────────
    # ISO 14064-1 reports an inventory gas by gas, not as a single CO2e
    # number, so a factor has to be able to say how its CO2e divides between
    # the gases. Each field below is *already GWP-weighted* — kg CO2e per
    # unit, not kg of gas — so the six of them sum to factor_kg_co2e and no
    # second GWP step is needed anywhere downstream.
    #
    # All six are nullable together: most published factors (grid electricity,
    # purchased goods, water, waste) are issued as a single CO2e figure with
    # no split available, and a blank has to stay blank rather than be guessed.
    # `gas_split_basis` says where a split that IS present came from.
    GAS_COLUMNS = ('CO2', 'CH4', 'N2O', 'HFC', 'PFC', 'SF6')
    GAS_FIELDS = {
        'CO2': 'factor_co2_kg_co2e',
        'CH4': 'factor_ch4_kg_co2e',
        'N2O': 'factor_n2o_kg_co2e',
        'HFC': 'factor_hfc_kg_co2e',
        'PFC': 'factor_pfc_kg_co2e',
        'SF6': 'factor_sf6_kg_co2e',
    }

    SPLIT_BASIS_CHOICES = [
        ('published', 'Published by the factor source'),
        ('apportioned', 'Apportioned from published default gas ratios'),
        ('single_gas', 'Single-gas source — whole factor is one gas'),
    ]

    _gas_field_kw = dict(max_digits=14, decimal_places=6, null=True, blank=True)
    factor_co2_kg_co2e = models.DecimalField(**_gas_field_kw, help_text='kg CO2e per unit attributable to CO2')
    factor_ch4_kg_co2e = models.DecimalField(**_gas_field_kw, help_text='kg CO2e per unit attributable to CH4')
    factor_n2o_kg_co2e = models.DecimalField(**_gas_field_kw, help_text='kg CO2e per unit attributable to N2O')
    factor_hfc_kg_co2e = models.DecimalField(**_gas_field_kw, help_text='kg CO2e per unit attributable to HFCs (HCFCs reported here too)')
    factor_pfc_kg_co2e = models.DecimalField(**_gas_field_kw, help_text='kg CO2e per unit attributable to PFCs')
    factor_sf6_kg_co2e = models.DecimalField(**_gas_field_kw, help_text='kg CO2e per unit attributable to SF6')
    del _gas_field_kw

    gas_split_basis = models.CharField(
        max_length=20, choices=SPLIT_BASIS_CHOICES, blank=True,
        help_text='How the per-gas breakdown was arrived at. Required when any gas field is set.')
    gas_split_reference = models.TextField(
        blank=True, help_text='Citation for the per-gas breakdown, e.g. the IPCC table the ratios come from')

    # A split is treated as agreeing with the headline factor when it is
    # within this fraction of it. Rounding in published factors makes an exact
    # match unrealistic; anything looser than this is a data error, not rounding.
    GAS_SPLIT_TOLERANCE = Decimal('0.01')

    def gas_split(self):
        """{gas: kg CO2e per unit} for the gases this factor emits, or None.

        None means the publisher issued a single CO2e figure with no split —
        the caller must not infer one. Gases with no contribution are omitted
        rather than returned as zero, so `'CH4' in split` reads correctly.
        """
        values = {g: getattr(self, f) for g, f in self.GAS_FIELDS.items()}
        if all(v is None for v in values.values()):
            return None
        return {g: v for g, v in values.items() if v}

    def gas_split_shares(self):
        """{gas: fraction of factor_kg_co2e}, or None if no split is published.

        Consumers apply these to a recorded CO2e quantity rather than
        multiplying the per-gas factors by activity data directly: a stored
        emission's CO2e is authoritative (it may have been calculated against
        an older factor value, see EmissionEntry.factor_value_snapshot), and
        shares guarantee the gas rows still add up to exactly that emission.
        """
        split = self.gas_split()
        if not split:
            return None
        total = sum(split.values())
        if not total:
            return None
        return {g: v / total for g, v in split.items()}

    def clean(self):
        super().clean()
        split = self.gas_split()
        if split is None:
            return
        if not self.gas_split_basis:
            raise ValidationError({
                'gas_split_basis': 'Set the basis when a per-gas breakdown is entered — '
                                   'a split with no stated provenance cannot be reported.'})
        if self.factor_kg_co2e:
            total = sum(split.values())
            drift = abs(total - self.factor_kg_co2e) / self.factor_kg_co2e
            if drift > self.GAS_SPLIT_TOLERANCE:
                raise ValidationError({
                    'factor_kg_co2e': (
                        f'The per-gas breakdown sums to {total}, which differs from the '
                        f'factor ({self.factor_kg_co2e}) by {drift:.1%}. The gas rows must '
                        f'add up to the factor they break down.')})

    def __str__(self):
        return f"{self.name} ({self.factor_kg_co2e} kg CO2e/{self.unit}) [{self.country}]"

    class Meta:
        ordering = ['scope', 'category', 'name']
        unique_together = ['slug', 'country', 'year']


class EmissionEntry(models.Model):
    """Individual emission data entry by user"""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='emission_entries')
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, null=True, blank=True, related_name='emission_entries')
    emission_factor = models.ForeignKey(EmissionFactor, on_delete=models.PROTECT)

    year = models.IntegerField()
    month = models.IntegerField(choices=[(i, i) for i in range(1, 13)])

    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    calculated_co2e_kg = models.DecimalField(max_digits=16, decimal_places=4, editable=False)

    description = models.TextField(blank=True)
    facility = models.ForeignKey(
        'companies.Facility', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='emission_entries', help_text='Structured facility reference'
    )
    proof_document = models.FileField(upload_to='proofs/%Y/%m/', blank=True, null=True,
                                       help_text='Upload invoice, receipt, or meter reading',
                                       validators=[])  # validators added in clean()

    def clean(self):
        super().clean()
        if self.proof_document:
            # Max 10MB
            if self.proof_document.size > 10 * 1024 * 1024:
                from django.core.exceptions import ValidationError
                raise ValidationError({'proof_document': 'File size must be under 10MB.'})
            # Allowed extensions
            import os
            ext = os.path.splitext(self.proof_document.name)[1].lower()
            allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']
            if ext not in allowed:
                from django.core.exceptions import ValidationError
                raise ValidationError({'proof_document': f'File type {ext} not allowed. Use: {", ".join(allowed)}'})

    # Audit: snapshot factor at time of entry creation
    factor_value_snapshot = models.DecimalField(max_digits=14, decimal_places=6, null=True, blank=True,
                                                 help_text='Factor value at time of entry creation')
    factor_source_snapshot = models.CharField(max_length=255, blank=True,
                                               help_text='Factor source/reference at time of entry')

    # Approval workflow
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('draft', 'Draft'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    approved_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='approved_entries')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_reason = models.TextField(blank=True, help_text='Reason for rejection')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Fix #39: clean() defines file-size and extension validators but Django's
        # ORM save() never calls it automatically — uploads bypassed all validation.
        # We call it here so rules are enforced regardless of how the model is saved
        # (DRF serializer, admin, management command, etc.).
        if self.proof_document:
            self.clean()

        self.calculated_co2e_kg = self.quantity * self.emission_factor.factor_kg_co2e
        # Snapshot factor on first save
        if not self.factor_value_snapshot:
            self.factor_value_snapshot = self.emission_factor.factor_kg_co2e
            self.factor_source_snapshot = f"{self.emission_factor.source}: {self.emission_factor.reference[:100]}"
        super().save(*args, **kwargs)

    @property
    def calculated_co2e_tonne(self):
        return self.calculated_co2e_kg / 1000

    def __str__(self):
        return f"{self.user.username} - {self.emission_factor.name} - {self.calculated_co2e_kg} kg"

    class Meta:
        ordering = ['-year', '-month', '-created_at']


class ReductionTarget(models.Model):
    """Carbon reduction targets"""

    STATUS_CHOICES = [
        ('on_track', 'On Track'),
        ('off_track', 'Off Track'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reduction_targets')
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, null=True, blank=True, related_name='reduction_targets')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    base_year = models.IntegerField()
    target_year = models.IntegerField()
    base_emissions_kg = models.DecimalField(max_digits=14, decimal_places=4)
    target_reduction_percent = models.DecimalField(max_digits=5, decimal_places=2)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='on_track')

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.target_reduction_percent}%"


class CustomEmissionRequest(models.Model):
    """User-submitted custom emission data when no matching factor exists.
    Admin reviews and optionally creates a proper EmissionFactor + Entry."""

    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    SCOPE_CHOICES = EmissionFactor.SCOPE_CHOICES

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='custom_emission_requests')
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, null=True, blank=True, related_name='custom_emission_requests')

    # What the user wants to report
    scope = models.CharField(max_length=10, choices=SCOPE_CHOICES)
    category_name = models.CharField(max_length=255, help_text='User-described category')
    source_name = models.CharField(max_length=255, help_text='User-described emission source')
    description = models.TextField(help_text='Detailed description of the emission activity')
    unit = models.CharField(max_length=50, help_text='Unit of measurement (e.g. liters, kg, kWh)')
    quantity = models.DecimalField(max_digits=14, decimal_places=4, help_text='Amount consumed')
    year = models.IntegerField()
    month = models.IntegerField(choices=[(i, i) for i in range(1, 13)])
    facility = models.ForeignKey(
        'companies.Facility', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='custom_emission_requests', help_text='Structured facility reference'
    )

    # Admin review
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(blank=True, help_text='Admin review notes')
    approved_factor_kg_co2e = models.DecimalField(
        max_digits=14, decimal_places=6, null=True, blank=True,
        help_text='Factor assigned by admin after review'
    )
    calculated_co2e_kg = models.DecimalField(
        max_digits=16, decimal_places=4, null=True, blank=True,
        help_text='Calculated after admin approval'
    )
    linked_entry = models.ForeignKey(
        EmissionEntry, on_delete=models.SET_NULL, null=True, blank=True,
        help_text='EmissionEntry created after approval'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.source_name} ({self.get_status_display()})"

    class Meta:
        ordering = ['-created_at']
