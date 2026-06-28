from django.urls import path
from .views import (
    subscription_status, create_checkout_session,
    create_portal_session, stripe_webhook,
)

urlpatterns = [
    path('status/', subscription_status, name='subscription_status'),
    path('checkout/', create_checkout_session, name='create_checkout'),
    path('portal/', create_portal_session, name='create_portal'),
    path('webhook/', stripe_webhook, name='stripe_webhook'),
]
