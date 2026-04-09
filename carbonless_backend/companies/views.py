from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Company, Facility
from .serializers import CompanySerializer, FacilitySerializer


class CompanyCreateView(generics.CreateAPIView):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = (IsAuthenticated,)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        # Company creator gets admin role
        from accounts.models import UserProfile
        profile, created = UserProfile.objects.get_or_create(
            user=self.request.user,
            defaults={'role': 'admin'}
        )
        if not created and profile.role != 'admin':
            profile.role = 'admin'
            profile.save()


class CompanyDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CompanySerializer
    permission_classes = (IsAuthenticated,)
    
    def get_object(self):
        return Company.objects.get(user=self.request.user)


class FacilityListCreateView(generics.ListCreateAPIView):
    serializer_class = FacilitySerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        try:
            return Facility.objects.filter(company=self.request.user.company)
        except Company.DoesNotExist:
            return Facility.objects.none()

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.company)


class FacilityDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FacilitySerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        try:
            return Facility.objects.filter(company=self.request.user.company)
        except Company.DoesNotExist:
            return Facility.objects.none()
