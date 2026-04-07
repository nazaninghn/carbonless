from django.urls import path
from .views import CompanyCreateView, CompanyDetailView, FacilityListCreateView, FacilityDetailView

urlpatterns = [
    path('create/', CompanyCreateView.as_view(), name='company_create'),
    path('detail/', CompanyDetailView.as_view(), name='company_detail'),
    path('facilities/', FacilityListCreateView.as_view(), name='facility_list'),
    path('facilities/<int:pk>/', FacilityDetailView.as_view(), name='facility_detail'),
]
