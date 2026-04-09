from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from .serializers import RegisterSerializer, UserSerializer, UserProfileSerializer
from .models import UserProfile


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        # Default role: data_entry. Admin role assigned when user creates a company.
        from .models import UserProfile
        UserProfile.objects.create(user=user, role='data_entry')


@method_decorator(ratelimit(key='ip', rate='10/m', method='POST', block=True), name='post')
class RateLimitedLoginView(TokenObtainPairView):
    """Login with rate limiting + sets HttpOnly cookies for tokens"""

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            from django.conf import settings as django_settings
            access = response.data.get('access')
            refresh = response.data.get('refresh')
            is_secure = not django_settings.DEBUG
            if access:
                response.set_cookie(
                    'access_token', access,
                    httponly=True, secure=is_secure, samesite='Lax',
                    max_age=30 * 60, path='/',
                )
            if refresh:
                response.set_cookie(
                    'refresh_token', refresh,
                    httponly=True, secure=is_secure, samesite='Lax',
                    max_age=7 * 24 * 3600, path='/',
                )

            # Audit log
            from .models import ActivityLog
            username = request.data.get('username')
            user = User.objects.filter(username=username).first()
            if user:
                ActivityLog.objects.create(
                    user=user, action='login', detail='User logged in',
                    ip_address=request.META.get('REMOTE_ADDR'),
                    target_type='User', target_id=str(user.id),
                )

            # Remove tokens from response body — cookie-only
            response.data = {'status': 'ok', 'message': 'Login successful'}
        return response


class UserProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserSerializer
    
    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        user = self.get_object()
        data = UserSerializer(user).data
        # Add role info
        try:
            profile = user.profile
            data['role'] = profile.role
            data['role_display'] = profile.get_role_display()
            data['permissions'] = {
                'can_edit_entries': profile.can_edit_entries,
                'can_manage_users': profile.can_manage_users,
                'can_approve_requests': profile.can_approve_requests,
                'can_generate_reports': profile.can_generate_reports,
            }
        except UserProfile.DoesNotExist:
            # Auto-create profile with data_entry role
            # Admin role is assigned when user creates a company
            profile = UserProfile.objects.create(user=user, role='data_entry')
            data['role'] = 'data_entry'
            data['role_display'] = 'Data Entry'
            data['permissions'] = {
                'can_edit_entries': profile.can_edit_entries,
                'can_manage_users': profile.can_manage_users,
                'can_approve_requests': profile.can_approve_requests,
                'can_generate_reports': profile.can_generate_reports,
            }
        return Response(data)


from rest_framework.decorators import api_view, permission_classes
from .models import Notification
from .serializers import NotificationSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_list(request):
    """Get user notifications"""
    notifs = Notification.objects.filter(user=request.user)[:50]
    return Response(NotificationSerializer(notifs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notifications_read(request):
    """Mark all or specific notifications as read"""
    ids = request.data.get('ids')
    if ids:
        Notification.objects.filter(user=request.user, id__in=ids).update(is_read=True)
    else:
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({'status': 'ok'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unread_count(request):
    """Get unread notification count"""
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return Response({'unread_count': count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change user password"""
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    if not old_password or not new_password:
        return Response({'error': 'old_password and new_password required'}, status=400)
    if not request.user.check_password(old_password):
        return Response({'error': 'Current password is incorrect'}, status=400)
    if len(new_password) < 8:
        return Response({'error': 'Password must be at least 8 characters'}, status=400)
    request.user.set_password(new_password)
    request.user.save()
    from .models import ActivityLog
    ActivityLog.objects.create(
        user=request.user, action='password_changed',
        detail='User changed password',
        ip_address=request.META.get('REMOTE_ADDR'),
        target_type='User', target_id=str(request.user.id),
    )
    return Response({'status': 'ok', 'message': 'Password changed successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Logout — clear HttpOnly cookies"""
    response = Response({'status': 'ok', 'message': 'Logged out'})
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return response


from rest_framework_simplejwt.views import TokenRefreshView


class CookieTokenRefreshView(TokenRefreshView):
    """Refresh token from HttpOnly cookie, set new access cookie."""

    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get('refresh_token')
        if not refresh:
            return Response({'detail': 'No refresh token'}, status=401)

        # QueryDict is immutable by default
        request.data._mutable = True
        request.data['refresh'] = refresh
        request.data._mutable = False

        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            from django.conf import settings as django_settings
            access = response.data.get('access')
            is_secure = not django_settings.DEBUG
            if access:
                response.set_cookie(
                    'access_token', access,
                    httponly=True, secure=is_secure, samesite='Lax',
                    max_age=30 * 60, path='/',
                )
            response.data = {'status': 'ok'}
        return response
