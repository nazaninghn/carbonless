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
                    httponly=True, secure=is_secure, samesite='None' if is_secure else 'Lax',
                    max_age=30 * 60, path='/',
                )
            if refresh:
                response.set_cookie(
                    'refresh_token', refresh,
                    httponly=True, secure=is_secure, samesite='None' if is_secure else 'Lax',
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

            # Always return tokens in body for cross-origin compatibility
            # Cookie is also set as secondary auth layer
            # Frontend uses header-based auth (Authorization: Bearer) as primary
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
            data['phone'] = profile.phone
            data['department'] = profile.department
            data['language_preference'] = profile.language_preference
            data['notify_approvals'] = profile.notify_approvals
            data['notify_system'] = profile.notify_system
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
    """Change user password with full Django validation"""
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')
    if not old_password or not new_password:
        return Response({'error': 'old_password and new_password required'}, status=400)
    if not request.user.check_password(old_password):
        return Response({'error': 'Current password is incorrect'}, status=400)
    # Full Django password validation
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError
    try:
        validate_password(new_password, request.user)
    except ValidationError as e:
        return Response({'error': '; '.join(e.messages)}, status=400)
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
                    httponly=True, secure=is_secure, samesite='None' if is_secure else 'Lax',
                    max_age=30 * 60, path='/',
                )
            # Always return access token for cross-origin header-based auth
            response.data = {'status': 'ok', 'access': access}
        return response


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """Update user profile (name, department, phone)"""
    user = request.user
    if 'first_name' in request.data:
        user.first_name = request.data['first_name']
    if 'last_name' in request.data:
        user.last_name = request.data['last_name']
    user.save()

    try:
        profile = user.profile
        if 'department' in request.data:
            profile.department = request.data['department']
        if 'phone' in request.data:
            profile.phone = request.data['phone']
        if 'language_preference' in request.data:
            profile.language_preference = request.data['language_preference']
        if 'notify_approvals' in request.data:
            profile.notify_approvals = request.data['notify_approvals']
        if 'notify_system' in request.data:
            profile.notify_system = request.data['notify_system']
        profile.save()
    except Exception:
        pass

    return Response({'status': 'ok'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """Delete user account — requires password confirmation"""
    password = request.data.get('password')
    if not password or not request.user.check_password(password):
        return Response({'error': 'Password confirmation required'}, status=400)
    user = request.user
    from .models import ActivityLog
    ActivityLog.objects.create(
        user=user, action='account_deleted',
        detail=f'User {user.username} deleted their account',
        ip_address=request.META.get('REMOTE_ADDR'),
        target_type='User', target_id=str(user.id),
    )
    user.delete()
    response = Response({'status': 'ok', 'message': 'Account deleted'})
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return response
