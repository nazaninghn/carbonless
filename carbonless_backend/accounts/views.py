from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, UserSerializer, UserProfileSerializer
from .models import UserProfile


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        # Auto-create profile with admin role for first user
        UserProfile.objects.create(user=user, role='admin')


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
            # Auto-create profile
            profile = UserProfile.objects.create(user=user, role='admin')
            data['role'] = 'admin'
            data['permissions'] = {
                'can_edit_entries': True, 'can_manage_users': True,
                'can_approve_requests': True, 'can_generate_reports': True,
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
    return Response({'status': 'ok', 'message': 'Password changed successfully'})
