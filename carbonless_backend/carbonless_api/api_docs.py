"""
API Documentation — auto-generated endpoint list for Carbonless API.
Access at: GET /api/docs/
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


API_DOCS = {
    'name': 'Carbonless API',
    'version': '2.0',
    'base_url': '/api',
    'description': 'ISO 14064-1 compliant carbon inventory platform API',
    'authentication': {
        'type': 'Bearer Token (JWT)',
        'login': 'POST /api/accounts/login/ → returns {access, refresh}',
        'refresh': 'POST /api/accounts/token/refresh/ → returns {access, refresh}',
        'header': 'Authorization: Bearer <access_token>',
    },
    'endpoints': {
        'Authentication': [
            {'method': 'POST', 'path': '/api/accounts/register/', 'description': 'Create new account', 'auth': False},
            {'method': 'POST', 'path': '/api/accounts/login/', 'description': 'Get JWT tokens', 'auth': False},
            {'method': 'POST', 'path': '/api/accounts/token/refresh/', 'description': 'Refresh access token', 'auth': False},
            {'method': 'POST', 'path': '/api/accounts/logout/', 'description': 'Blacklist refresh token', 'auth': True},
            {'method': 'POST', 'path': '/api/accounts/verify-email/', 'description': 'Verify email with token', 'auth': False},
            {'method': 'POST', 'path': '/api/accounts/resend-verification/', 'description': 'Resend verification email', 'auth': False},
            {'method': 'POST', 'path': '/api/accounts/password-reset/', 'description': 'Request password reset email', 'auth': False},
            {'method': 'POST', 'path': '/api/accounts/password-reset-confirm/', 'description': 'Set new password with token', 'auth': False},
        ],
        'User Profile': [
            {'method': 'GET', 'path': '/api/accounts/profile/', 'description': 'Get user profile', 'auth': True},
            {'method': 'PATCH', 'path': '/api/accounts/update-profile/', 'description': 'Update profile fields', 'auth': True},
            {'method': 'POST', 'path': '/api/accounts/change-password/', 'description': 'Change password', 'auth': True},
            {'method': 'DELETE', 'path': '/api/accounts/delete-account/', 'description': 'Delete account (requires password)', 'auth': True},
        ],
        'Companies': [
            {'method': 'POST', 'path': '/api/companies/create/', 'description': 'Create company', 'auth': True},
            {'method': 'GET', 'path': '/api/companies/detail/', 'description': 'Get company details', 'auth': True},
            {'method': 'PATCH', 'path': '/api/companies/detail/', 'description': 'Update company', 'auth': True},
            {'method': 'GET', 'path': '/api/companies/facilities/', 'description': 'List facilities', 'auth': True},
            {'method': 'POST', 'path': '/api/companies/facilities/', 'description': 'Create facility', 'auth': True},
            {'method': 'GET', 'path': '/api/companies/memberships/', 'description': 'List team members', 'auth': True},
            {'method': 'POST', 'path': '/api/companies/invite/', 'description': 'Invite team member', 'auth': True},
            {'method': 'POST', 'path': '/api/companies/accept-invite/', 'description': 'Accept team invite', 'auth': True},
        ],
        'Emission Factors': [
            {'method': 'GET', 'path': '/api/emissions/factors/', 'description': 'List all emission factors (188+)', 'auth': False},
            {'method': 'GET', 'path': '/api/emissions/factors/?scope=scope1', 'description': 'Filter by scope', 'auth': False},
            {'method': 'GET', 'path': '/api/emissions/factors/?category=stationary_combustion', 'description': 'Filter by category', 'auth': False},
            {'method': 'GET', 'path': '/api/emissions/factors/?country=turkey', 'description': 'Filter by country', 'auth': False},
        ],
        'Emission Entries': [
            {'method': 'GET', 'path': '/api/emissions/entries/', 'description': 'List entries (paginated)', 'auth': True},
            {'method': 'GET', 'path': '/api/emissions/entries/?year=2026', 'description': 'Filter by year', 'auth': True},
            {'method': 'POST', 'path': '/api/emissions/entries/', 'description': 'Create entry', 'auth': True,
             'body': {'emission_factor': 'int (factor ID)', 'year': 'int', 'month': 'int (1-12)', 'quantity': 'decimal', 'description': 'string (optional)', 'facility': 'int (optional)'}},
            {'method': 'PATCH', 'path': '/api/emissions/entries/{id}/', 'description': 'Update entry', 'auth': True},
            {'method': 'DELETE', 'path': '/api/emissions/entries/{id}/', 'description': 'Delete entry', 'auth': True},
            {'method': 'POST', 'path': '/api/emissions/entries/{id}/approve/', 'description': 'Approve/reject entry', 'auth': True},
            {'method': 'POST', 'path': '/api/emissions/bulk-import/', 'description': 'Bulk import from JSON array', 'auth': True},
        ],
        'Reports & Analytics': [
            {'method': 'GET', 'path': '/api/emissions/summary/?year=2026', 'description': 'Emission summary with scope breakdown', 'auth': True},
            {'method': 'GET', 'path': '/api/emissions/comparison/?year1=2025&year2=2026', 'description': 'Year-over-year comparison', 'auth': True},
            {'method': 'GET', 'path': '/api/emissions/by-facility/?year=2026', 'description': 'Emissions grouped by facility', 'auth': True},
            {'method': 'GET', 'path': '/api/emissions/report/?year=2026&lang=en', 'description': 'Download ISO 14064-1 PDF report', 'auth': True},
            {'method': 'GET', 'path': '/api/emissions/export-csv/?year=2026', 'description': 'Export as CSV', 'auth': True},
            {'method': 'GET', 'path': '/api/emissions/export-excel/?year=2026', 'description': 'Export as Excel', 'auth': True},
        ],
        'Targets': [
            {'method': 'GET', 'path': '/api/emissions/targets/', 'description': 'List reduction targets', 'auth': True},
            {'method': 'POST', 'path': '/api/emissions/targets/', 'description': 'Create target', 'auth': True},
            {'method': 'PATCH', 'path': '/api/emissions/targets/{id}/', 'description': 'Update target', 'auth': True},
            {'method': 'DELETE', 'path': '/api/emissions/targets/{id}/', 'description': 'Delete target', 'auth': True},
        ],
        'AI Questionnaire': [
            {'method': 'POST', 'path': '/api/questionnaire/start/', 'description': 'Start/resume carbon report', 'auth': True},
            {'method': 'PATCH', 'path': '/api/questionnaire/{id}/step/', 'description': 'Submit questionnaire step', 'auth': True},
            {'method': 'GET', 'path': '/api/questionnaire/{id}/', 'description': 'Get report status', 'auth': True},
            {'method': 'GET', 'path': '/api/questionnaire/', 'description': 'List all reports', 'auth': True},
        ],
        'AI Chat': [
            {'method': 'GET', 'path': '/api/chat/sessions/', 'description': 'List chat sessions', 'auth': True},
            {'method': 'POST', 'path': '/api/chat/sessions/new/', 'description': 'Create new chat', 'auth': True},
            {'method': 'GET', 'path': '/api/chat/sessions/{id}/', 'description': 'Get chat with messages', 'auth': True},
            {'method': 'DELETE', 'path': '/api/chat/sessions/{id}/', 'description': 'Delete chat session', 'auth': True},
            {'method': 'POST', 'path': '/api/chat/sessions/{id}/message/', 'description': 'Send message (AI responds + auto-saves emissions)', 'auth': True},
        ],
        'Subscriptions': [
            {'method': 'GET', 'path': '/api/subscriptions/status/', 'description': 'Current plan & usage', 'auth': True},
            {'method': 'POST', 'path': '/api/subscriptions/checkout/', 'description': 'Create Stripe checkout for Pro', 'auth': True},
            {'method': 'POST', 'path': '/api/subscriptions/portal/', 'description': 'Stripe billing portal', 'auth': True},
        ],
        'Notifications': [
            {'method': 'GET', 'path': '/api/accounts/notifications/', 'description': 'List notifications', 'auth': True},
            {'method': 'POST', 'path': '/api/accounts/notifications/read/', 'description': 'Mark as read', 'auth': True},
            {'method': 'GET', 'path': '/api/accounts/notifications/unread-count/', 'description': 'Unread count', 'auth': True},
        ],
    },
    'rate_limits': {
        'login': '10 requests/minute per IP',
        'ai_chat_free': '5 messages/month',
        'ai_chat_pro': 'Unlimited',
    },
    'data_formats': {
        'dates': 'ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)',
        'numbers': 'Decimal with up to 4 decimal places',
        'pagination': '?page=1&page_size=50 (default 50)',
    },
}


@api_view(['GET'])
@permission_classes([AllowAny])
def api_documentation(request):
    """Return full API documentation as JSON"""
    return Response(API_DOCS)
