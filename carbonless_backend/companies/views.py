from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Company, Facility, CompanyMembership
from .serializers import CompanySerializer, FacilitySerializer
from .utils import get_current_company


class CompanyCreateView(generics.CreateAPIView):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = (IsAuthenticated,)

    def perform_create(self, serializer):
        company = serializer.save(user=self.request.user)
        CompanyMembership.objects.get_or_create(
            company=company, user=self.request.user,
            defaults={'role': 'owner', 'is_active': True},
        )


from .permissions import IsCompanyMember, HasCompanyAdminRole


class CompanyDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CompanySerializer
    permission_classes = (IsAuthenticated, IsCompanyMember)

    def get_object(self):
        company = get_current_company(self.request.user)
        if not company:
            from rest_framework.exceptions import NotFound
            raise NotFound('No company found')
        return company


class FacilityListCreateView(generics.ListCreateAPIView):
    serializer_class = FacilitySerializer
    permission_classes = (IsAuthenticated, IsCompanyMember)

    def get_queryset(self):
        company = get_current_company(self.request.user)
        return Facility.objects.filter(company=company) if company else Facility.objects.none()

    def perform_create(self, serializer):
        company = get_current_company(self.request.user)
        serializer.save(company=company)


class FacilityDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FacilitySerializer
    permission_classes = (IsAuthenticated, IsCompanyMember)

    def get_queryset(self):
        company = get_current_company(self.request.user)
        return Facility.objects.filter(company=company) if company else Facility.objects.none()


from .serializers import CompanyMembershipSerializer


class CompanyMembershipListView(generics.ListAPIView):
    """List all members of current company (admin/owner only)"""
    serializer_class = CompanyMembershipSerializer
    permission_classes = (IsAuthenticated, HasCompanyAdminRole)

    def get_queryset(self):
        company = get_current_company(self.request.user)
        if not company:
            return CompanyMembership.objects.none()
        return CompanyMembership.objects.filter(company=company).select_related('user', 'invited_by')


class CompanyMembershipUpdateView(generics.UpdateAPIView):
    """Update member role (admin/owner only)"""
    serializer_class = CompanyMembershipSerializer
    permission_classes = (IsAuthenticated, HasCompanyAdminRole)

    def get_queryset(self):
        company = get_current_company(self.request.user)
        if not company:
            return CompanyMembership.objects.none()
        return CompanyMembership.objects.filter(company=company)
