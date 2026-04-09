from django.urls import path
from .views import RegisterView, UserProfileView, RateLimitedLoginView, CookieTokenRefreshView, notification_list, mark_notifications_read, unread_count, change_password, logout_view

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', RateLimitedLoginView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('change-password/', change_password, name='change_password'),
    path('logout/', logout_view, name='logout'),
    path('notifications/', notification_list, name='notification_list'),
    path('notifications/read/', mark_notifications_read, name='notifications_read'),
    path('notifications/unread-count/', unread_count, name='notifications_unread'),
]
