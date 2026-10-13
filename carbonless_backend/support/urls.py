from django.urls import path

from . import views

urlpatterns = [
    path('requests/', views.support_requests, name='support-requests'),
    path('requests/<int:pk>/reply/', views.reply_to_request, name='support-request-reply'),
    path('feedback/', views.answer_feedback, name='answer-feedback'),
]
