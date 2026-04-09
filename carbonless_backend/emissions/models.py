from django.db import models
from django.contrib.auth.models import User


class EmissionFactor(models.Model):
    """Emission factors from Defra 2024, IPCC 2006/2019, ATOM KABLO, Turkey-specific"""

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
        ('atom_kablo', 'ATOM KABLO ISO 14064-1'),
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
    facility = models.CharField(max_length=255, blank=True)
    proof_document = models.FileField(upload_to='proofs/%Y/%m/', blank=True, null=True,
                                       help_text='Upload invoice, receipt, or meter reading')

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

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
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
    facility = models.CharField(max_length=255, blank=True)

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
