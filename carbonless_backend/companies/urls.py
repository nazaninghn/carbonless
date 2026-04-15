from django.urls import path
from .views import (
    CompanyCreateView, CompanyDetailView,
    FacilityListCreateView, FacilityDetailView,
    CompanyMembershipListView, CompanyMembershipUpdateView,
    invite_member, accept_invite,
)

urlpatterns = [
    path('create/', CompanyCreateView.as_view(), name='company_create'),
    path('detail/', CompanyDetailView.as_view(), name='company_detail'),
    path('facilities/', FacilityListCreateView.as_view(), name='facility_list'),
    path('facilities/<int:pk>/', FacilityDetailView.as_view(), name='facility_detail'),
    path('memberships/', CompanyMembershipListView.as_view(), name='membership_list'),
    path('memberships/<int:pk>/', CompanyMembershipUpdateView.as_view(), name='membership_update'),
    path('invite/', invite_member, name='company_invite'),
    path('accept-invite/', accept_invite, name='accept_invite'),
]
