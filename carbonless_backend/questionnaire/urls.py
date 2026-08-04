from django.urls import path
from .views import (
    StartReportView,
    SubmitStepView,
    ReportStatusView,
    ReportListView,
    SaveDraftView,
    QuestionnairePDFView,
    PreviousCompanyProfileView,
    ReuseCompanyProfileView,
    get_report_summary,
    # legacy
    start_session,
    answer_question,
    get_sessions,
    reset_session,
    get_profile,
)
from .workspace_views import (
    ReportFieldMapView,
    ReportFieldBulkUpsertView,
    WorkspaceChatView,
    SuggestionConfirmView,
    SuggestionRejectView,
)

urlpatterns = [
    # New CarbonIQ API
    path('', ReportListView.as_view()),
    path('start/', StartReportView.as_view()),
    path('reset/', reset_session, name='questionnaire-reset-new'),
    path('report/<str:report_id>/', get_report_summary, name='report-summary'),
    path('<int:report_id>/', ReportStatusView.as_view()),
    path('<int:report_id>/step/', SubmitStepView.as_view()),
    path('<int:report_id>/draft/', SaveDraftView.as_view(), name='questionnaire-save-draft'),
    path('<int:report_id>/pdf/', QuestionnairePDFView.as_view(), name='questionnaire-pdf'),
    path('<int:report_id>/previous-profile/', PreviousCompanyProfileView.as_view(), name='questionnaire-previous-profile'),
    path('<int:report_id>/reuse-profile/', ReuseCompanyProfileView.as_view(), name='questionnaire-reuse-profile'),

    # Workspace: ReportField data layer
    path('report-fields/map/', ReportFieldMapView.as_view()),
    path('report-fields/bulk-upsert/', ReportFieldBulkUpsertView.as_view()),

    # Legacy (keep for existing chatbot)
    path('legacy/start/', start_session, name='questionnaire-start'),
    path('legacy/answer/', answer_question, name='questionnaire-answer'),
    path('legacy/sessions/', get_sessions, name='questionnaire-sessions'),
    path('legacy/reset/', reset_session, name='questionnaire-reset'),
    path('legacy/profile/', get_profile, name='questionnaire-profile'),
]
