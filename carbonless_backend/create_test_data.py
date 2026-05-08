from django.contrib.auth.models import User
from companies.models import Company, CompanyMembership

# کاربر موجود
admin = User.objects.get(username='admin')

# شرکت موجود؟
if not Company.objects.filter(legal_entity_name='Test Company').exists():
    company = Company.objects.create(
        legal_entity_name='Test Company',
        tax_number='1234567890'
    )
    print(f"✅ Created company: {company.id}")
    
    # membership
    membership = CompanyMembership.objects.create(
        company=company,
        user=admin,
        role='owner',
        is_active=True
    )
    print(f"✅ Created membership: {membership.id}")
else:
    print("✅ Company already exists")
