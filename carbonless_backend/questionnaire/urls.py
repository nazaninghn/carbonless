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
    pending_advisor_approvals_view,
    approve_advisor_approval_view,
    reset_session,
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

    # Danışman Onayı (Advisor Approval)
    path('advisor-approvals/pending/', pending_advisor_approvals_view, name='advisor-approvals-pending'),
    path('advisor-approvals/<int:pk>/approve/', approve_advisor_approval_view, name='advisor-approvals-approve'),

    # Workspace: ReportField data layer
    path('report-fields/map/', ReportFieldMapView.as_view()),
    path('report-fields/bulk-upsert/', ReportFieldBulkUpsertView.as_view()),
]
