from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, UserProfileView, notification_list, mark_notifications_read, unread_count

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('notifications/', notification_list, name='notification_list'),
    path('notifications/read/', mark_notifications_read, name='notifications_read'),
    path('notifications/unread-count/', unread_count, name='notifications_unread'),
]
