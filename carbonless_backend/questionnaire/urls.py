from django.urls import path
from .views import (
    StartReportView,
    SubmitStepView,
    ReportStatusView,
    ReportListView,
    # legacy
    start_session,
    answer_question,
    get_sessions,
    reset_session,
    get_profile,
)
from .ai_views import AIChatView

urlpatterns = [
    # New CarbonIQ API
    path('', ReportListView.as_view()),
    path('start/', StartReportView.as_view()),
    path('ai/chat/', AIChatView.as_view()),
    path('<int:report_id>/', ReportStatusView.as_view()),
    path('<int:report_id>/step/', SubmitStepView.as_view()),

    # Legacy (keep for existing chatbot)
    path('legacy/start/', start_session, name='questionnaire-start'),
    path('legacy/answer/', answer_question, name='questionnaire-answer'),
    path('legacy/sessions/', get_sessions, name='questionnaire-sessions'),
    path('legacy/reset/', reset_session, name='questionnaire-reset'),
    path('legacy/profile/', get_profile, name='questionnaire-profile'),
]
