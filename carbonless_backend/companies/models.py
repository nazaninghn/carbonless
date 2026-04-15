from django.db import models
from django.contrib.auth.models import User


class Company(models.Model):
    # Note: user field removed. Use CompanyMembership for ownership.
    legal_entity_name = models.CharField(max_length=255)
    tax_number = models.CharField(max_length=100)
    country_of_headquarters = models.CharField(max_length=100)
    countries_of_operation = models.TextField()
    nace_code = models.CharField(max_length=50, blank=True)
    main_activity_description = models.TextField()
    
    # Section 2: Scale & Complexity
    number_of_employees = models.CharField(max_length=50)
    annual_turnover_range = models.CharField(max_length=50)
    number_of_facilities = models.IntegerField()
    has_overseas_operations = models.BooleanField(default=False)
    number_of_subsidiaries = models.IntegerField(default=0)
    has_iso_14001 = models.BooleanField(default=False)
    has_iso_50001 = models.BooleanField(default=False)
    has_iso_14064_work = models.BooleanField(default=False)
    
    # Section 3: Audit & Purpose
    target_iso_14064_verification = models.BooleanField(default=False)
    has_3rd_party_audit_plan = models.BooleanField(default=False)
    is_for_financing = models.BooleanField(default=False)
    is_due_to_export_pressure = models.BooleanField(default=False)
    is_for_group_reporting = models.BooleanField(default=False)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.legal_entity_name
    
    class Meta:
        verbose_name_plural = "Companies"


class Facility(models.Model):
    """Individual facility/site belonging to a company"""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='facilities')
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    facility_type = models.CharField(max_length=100, blank=True, help_text='e.g. Office, Factory, Warehouse')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.company.legal_entity_name})"

    class Meta:
        verbose_name_plural = "Facilities"
        ordering = ['name']


class CompanyMembership(models.Model):
    """Links users to companies with roles. Replaces Company.user OneToOne."""
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('manager', 'Manager'),
        ('data_entry', 'Data Entry'),
        ('auditor', 'Auditor'),
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='company_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='data_entry')
    is_active = models.BooleanField(default=True)
    invited_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='sent_company_invites')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('company', 'user')

    def __str__(self):
        return f"{self.user.username} @ {self.company} ({self.role})"


import uuid

class CompanyInvite(models.Model):
    """Invite a user to join a company"""
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='invites')
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=CompanyMembership.ROLE_CHOICES, default='data_entry')
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE)
    accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('company', 'email')

    def __str__(self):
        return f"Invite {self.email} to {self.company} as {self.role}"
