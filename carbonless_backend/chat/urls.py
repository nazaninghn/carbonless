from django.urls import path
from . import views
from questionnaire.workspace_views import (
    WorkspaceChatView,
    SuggestionConfirmView,
    SuggestionRejectView,
)

urlpatterns = [
    path('sessions/', views.list_sessions),
    path('sessions/new/', views.create_session),
    path('sessions/<int:session_id>/', views.session_detail),
    path('sessions/<int:session_id>/message/', views.send_message),
    path('messages/<int:message_id>/attachment/', views.download_attachment),
    path('confirm-entry/', views.confirm_entry),
    # Workspace AI chat + suggestion lifecycle
    path('workspace/', WorkspaceChatView.as_view()),
    path('suggestions/<int:suggestion_id>/confirm/', SuggestionConfirmView.as_view()),
    path('suggestions/<int:suggestion_id>/reject/', SuggestionRejectView.as_view()),
]
