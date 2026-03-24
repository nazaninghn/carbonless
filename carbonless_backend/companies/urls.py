from django.urls import path
from .views import CompanyCreateView, CompanyDetailView

urlpatterns = [
    path('create/', CompanyCreateView.as_view(), name='company_create'),
    path('detail/', CompanyDetailView.as_view(), name='company_detail'),
]
