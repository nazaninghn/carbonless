from django.urls import path
from . import views

urlpatterns = [
    path('sessions/', views.list_sessions),
    path('sessions/new/', views.create_session),
    path('sessions/<int:session_id>/', views.session_detail),
    path('sessions/<int:session_id>/message/', views.send_message),
]
