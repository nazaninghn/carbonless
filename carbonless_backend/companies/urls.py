from django.urls import path
from .views import (
    CompanyCreateView, CompanyDetailView,
    FacilityListCreateView, FacilityDetailView,
    CompanyMembershipListView, CompanyMembershipUpdateView,
)

urlpatterns = [
    path('create/', CompanyCreateView.as_view(), name='company_create'),
    path('detail/', CompanyDetailView.as_view(), name='company_detail'),
    path('facilities/', FacilityListCreateView.as_view(), name='facility_list'),
    path('facilities/<int:pk>/', FacilityDetailView.as_view(), name='facility_detail'),
    path('memberships/', CompanyMembershipListView.as_view(), name='membership_list'),
    path('memberships/<int:pk>/', CompanyMembershipUpdateView.as_view(), name='membership_update'),
]
