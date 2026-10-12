from django.urls import path

from . import views

urlpatterns = [
    path('requests/', views.support_requests, name='support-requests'),
    path('feedback/', views.answer_feedback, name='answer-feedback'),
]
