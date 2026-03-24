from django.db import models
from django.contrib.auth.models import User


class Company(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='company')
    
    # Section 1: Basic Corporate Information
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
