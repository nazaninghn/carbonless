from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_session, name='questionnaire-start'),
    path('answer/', views.answer_question, name='questionnaire-answer'),
    path('sessions/', views.get_sessions, name='questionnaire-sessions'),
    path('reset/', views.reset_session, name='questionnaire-reset'),
    path('profile/', views.get_profile, name='questionnaire-profile'),
]
