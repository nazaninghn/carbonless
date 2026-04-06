from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'factors', views.EmissionFactorViewSet)
router.register(r'entries', views.EmissionEntryViewSet, basename='emission-entry')
router.register(r'targets', views.ReductionTargetViewSet, basename='reduction-target')
router.register(r'custom-requests', views.CustomEmissionRequestViewSet, basename='custom-emission-request')

urlpatterns = [
    path('', include(router.urls)),
    path('summary/', views.emission_summary, name='emission-summary'),
    path('calculate/', views.calculate_view, name='emission-calculate'),
    path('countries/', views.countries_view, name='emission-countries'),
]
