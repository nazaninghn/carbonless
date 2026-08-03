import logging
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from .serializers import RegisterSerializer, UserSerializer, UserProfileSerializer
from .models import UserProfile

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        # Create user as inactive — they must verify email first
        user = serializer.save(is_active=False)
        from .models import UserProfile, EmailVerificationToken
        UserProfile.objects.create(user=user, role='data_entry')

        # Create verification code
        token_obj = EmailVerificationToken.objects.create(user=user)

        # Send verification email
        self._send_verification_email(user, token_obj.code)

        # For development: also activate immediately if SKIP_EMAIL_VERIFICATION=true
        import os
        if os.environ.get('SKIP_EMAIL_VERIFICATION', 'false').lower() == 'true':
            user.is_active = True
            user.save(update_fields=['is_active'])

    def _send_verification_email(self, user, code):
        from django.core.mail import send_mail
        from django.conf import settings

        subject = f'{code} is your Carbonless verification code'
        message = (
            f"Hi {user.username},\n\n"
            f"Your verification code is:\n\n"
            f"    {code}\n\n"
            f"Enter this code on the site to activate your account. "
            f"This code expires in 24 hours.\n\n"
            f"If you didn't create this account, please ignore this email.\n\n"
            f"— Carbonless Team"
        )

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as e:
            # Don't block registration if email fails — but log it loudly.
            # Previously this was fail_silently=True + a bare `except: pass`,
            # so a broken/unconfigured SMTP setup produced zero trace anywhere:
            # the UI said "check your email" and nothing was ever sent, with
            # no way to tell from server logs.
            logger.error(f'Failed to send verification email to {user.email}: {e}', exc_info=True)


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
            # Fix #62: frontend sends credential as both `username` and `email`
            # fields.  A user who registered with an email-style username would
            # match by username; one who typed their email address needs the
            # email fallback.  Without it, ActivityLog is never written for
            # email-based logins — the entire audit trail is silently lost.
            from .models import ActivityLog
            credential = request.data.get('username') or request.data.get('email') or ''
            user = (
                User.objects.filter(username=credential).first()
                or User.objects.filter(email__iexact=credential).first()
            )
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


@method_decorator(ratelimit(key='ip', rate='10/m', method='POST', block=True), name='dispatch')
class GoogleLoginView(generics.GenericAPIView):
    """Sign in (or register) with a Google Identity Services ID token.

    Frontend sends the `credential` JWT produced by Google's GSI button.
    We verify it against Google's public keys + our OAuth client ID, then
    find-or-create the Django user by email and issue the same JWT pair
    (+ cookies) as the password login flow, so the rest of the app can't
    tell the two auth paths apart.
    """
    permission_classes = (AllowAny,)

    def post(self, request, *args, **kwargs):
        from django.conf import settings as django_settings

        credential = request.data.get('credential') or request.data.get('id_token')
        if not credential:
            return Response({'detail': 'Missing Google credential'}, status=400)

        client_id = getattr(django_settings, 'GOOGLE_CLIENT_ID', '')
        if not client_id:
            logger.error('Google sign-in attempted but GOOGLE_CLIENT_ID is not configured')
            return Response({'detail': 'Google sign-in is not configured'}, status=503)

        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests
            idinfo = google_id_token.verify_oauth2_token(
                credential, google_requests.Request(), client_id
            )
        except ValueError:
            return Response({'detail': 'Invalid or expired Google credential'}, status=401)
        except Exception:
            logger.exception('Unexpected error verifying Google credential')
            return Response({'detail': 'Could not verify Google credential'}, status=502)

        if idinfo.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
            return Response({'detail': 'Invalid token issuer'}, status=401)

        email = (idinfo.get('email') or '').strip().lower()
        if not email:
            return Response({'detail': 'Google account has no email address'}, status=400)
        if not idinfo.get('email_verified'):
            return Response({'detail': 'Google email address is not verified'}, status=400)

        user = User.objects.filter(email__iexact=email).first()
        created = False
        if user is None:
            base_username = (email.split('@')[0] or 'user')[:25]
            username = base_username
            n = 1
            while User.objects.filter(username=username).exists():
                n += 1
                username = f"{base_username}{n}"[:150]
            user = User(
                username=username,
                email=email,
                first_name=idinfo.get('given_name', '')[:150],
                last_name=idinfo.get('family_name', '')[:150],
                is_active=True,
            )
            user.set_unusable_password()
            user.save()
            UserProfile.objects.get_or_create(user=user, defaults={'role': 'data_entry'})
            created = True
        elif not user.is_active:
            # Google has already verified this email — trust it and lift the
            # "verify your email" gate an existing password signup left in place.
            user.is_active = True
            user.save(update_fields=['is_active'])

        from rest_framework_simplejwt.tokens import RefreshToken
        from .models import ActivityLog

        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)

        ActivityLog.objects.create(
            user=user, action='login',
            detail='Signed in with Google' + (' (account created)' if created else ''),
            ip_address=request.META.get('REMOTE_ADDR'),
            target_type='User', target_id=str(user.id),
        )

        response = Response({'access': access, 'refresh': str(refresh), 'created': created})
        is_secure = not django_settings.DEBUG
        response.set_cookie(
            'access_token', access,
            httponly=True, secure=is_secure, samesite='None' if is_secure else 'Lax',
            max_age=30 * 60, path='/',
        )
        response.set_cookie(
            'refresh_token', str(refresh),
            httponly=True, secure=is_secure, samesite='None' if is_secure else 'Lax',
            max_age=7 * 24 * 3600, path='/',
        )
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
    """Logout — blacklist refresh token and clear HttpOnly cookies.

    Fix #55: Previously only the cookies were deleted, leaving the refresh
    token valid in the JWT blacklist store for up to 7 days.  A captured
    refresh token could therefore be used to obtain new access tokens even
    after the user had logged out.  Now we blacklist it explicitly so the
    simplejwt blacklist app rejects any future use of that token.
    """
    refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh')
    if refresh_token:
        try:
            from rest_framework_simplejwt.tokens import RefreshToken
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            # Expired or already blacklisted — still safe to clear the cookies
            pass

    response = Response({'status': 'ok', 'message': 'Logged out'})
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return response


from rest_framework_simplejwt.views import TokenRefreshView


class CookieTokenRefreshView(TokenRefreshView):
    """
    Refresh JWT. Accepts refresh token from request body (primary — sent by
    Next.js /api/auth/refresh proxy) or HttpOnly cookie (fallback).
    Returns new access + refresh tokens in body.
    """

    def post(self, request, *args, **kwargs):
        # Body first (Next.js server proxy sends it here), cookie as fallback
        refresh = request.data.get('refresh') or request.COOKIES.get('refresh_token')
        if not refresh:
            return Response({'detail': 'No refresh token'}, status=401)

        try:
            request.data._mutable = True
            request.data['refresh'] = refresh
            request.data._mutable = False
        except AttributeError:
            pass

        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            from django.conf import settings as django_settings
            access = response.data.get('access')
            new_refresh = response.data.get('refresh')
            is_secure = not django_settings.DEBUG
            if access:
                response.set_cookie(
                    'access_token', access,
                    httponly=True, secure=is_secure, samesite='None' if is_secure else 'Lax',
                    max_age=30 * 60, path='/',
                )
            if new_refresh:
                response.set_cookie(
                    'refresh_token', new_refresh,
                    httponly=True, secure=is_secure, samesite='None' if is_secure else 'Lax',
                    max_age=7 * 24 * 3600, path='/',
                )
            response.data = {'status': 'ok', 'access': access, 'refresh': new_refresh}
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

    # Fix #29: Replaced bare `except Exception: pass` which silently swallowed
    # any DB error on profile.save().  Now we only handle the expected case
    # (UserProfile not yet created) and let real errors surface as 500s so they
    # appear in logs and Sentry rather than returning a fake 200 OK.
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(user=user, role='data_entry')

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

    return Response({'status': 'ok'})


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    """Send password reset email with a unique token link"""
    from .models import PasswordResetToken
    from django.core.mail import send_mail
    from django.conf import settings
    import os

    email = (request.data.get('email') or '').strip().lower()
    # Always respond 200 so attackers cannot probe which emails are registered.
    success_msg = {'status': 'ok', 'message': 'If an account with that email exists, a reset link has been sent.'}

    if not email:
        return Response(success_msg)

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response(success_msg)

    # Invalidate old tokens
    PasswordResetToken.objects.filter(user=user, used_at__isnull=True).delete()

    # Create new token
    token_obj = PasswordResetToken.objects.create(user=user)

    # Send email
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    reset_link = f"{frontend_url}/reset-password?token={token_obj.token}"

    try:
        send_mail(
            subject='Reset your Carbonless password',
            message=(
                f"Hi {user.username},\n\n"
                f"We received a request to reset your password. Click the link below:\n\n"
                f"{reset_link}\n\n"
                f"This link expires in 1 hour.\n\n"
                f"If you didn't request this, please ignore this email.\n\n"
                f"— Carbonless Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f'Failed to send password reset email to {user.email}: {e}', exc_info=True)

    return Response(success_msg)


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    """Confirm password reset — validate token and set new password"""
    from .models import PasswordResetToken
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError

    token_str = request.data.get('token', '')
    new_password = request.data.get('new_password', '')

    if not token_str or not new_password:
        return Response({'error': 'Token and new_password are required'}, status=400)

    try:
        import uuid
        token_uuid = uuid.UUID(str(token_str))
    except ValueError:
        return Response({'error': 'Invalid token'}, status=400)

    try:
        token_obj = PasswordResetToken.objects.select_related('user').get(token=token_uuid)
    except PasswordResetToken.DoesNotExist:
        return Response({'error': 'Invalid or expired reset link'}, status=400)

    if token_obj.is_used:
        return Response({'error': 'This reset link has already been used'}, status=400)

    if token_obj.is_expired:
        return Response({'error': 'This reset link has expired. Please request a new one.'}, status=400)

    # Validate new password
    try:
        validate_password(new_password, token_obj.user)
    except ValidationError as e:
        return Response({'error': '; '.join(e.messages)}, status=400)

    # Set new password
    token_obj.user.set_password(new_password)
    token_obj.user.save()
    token_obj.use()

    # Log the action
    from .models import ActivityLog
    ActivityLog.objects.create(
        user=token_obj.user, action='password_changed',
        detail='Password reset via email link',
        target_type='User', target_id=str(token_obj.user.id),
    )

    return Response({'status': 'ok', 'message': 'Password has been reset successfully. You can now log in.'})


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


# ── Email Verification ──────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_email(request):
    """Verify email address using token from registration email"""
    from .models import EmailVerificationToken
    token_str = request.data.get('token', '')
    if not token_str:
        return Response({'error': 'Token is required'}, status=400)

    try:
        import uuid
        token_uuid = uuid.UUID(str(token_str))
    except ValueError:
        return Response({'error': 'Invalid token format'}, status=400)

    try:
        token_obj = EmailVerificationToken.objects.select_related('user').get(token=token_uuid)
    except EmailVerificationToken.DoesNotExist:
        return Response({'error': 'Invalid or expired verification link'}, status=400)

    if token_obj.is_verified:
        return Response({'status': 'ok', 'message': 'Email already verified'})

    if token_obj.is_expired:
        return Response({'error': 'Verification link has expired. Please request a new one.'}, status=400)

    # Verify!
    token_obj.verify()
    return Response({'status': 'ok', 'message': 'Email verified successfully. You can now log in.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_email_code(request):
    """Verify email address using the 6-digit code from the registration email"""
    from .models import EmailVerificationToken

    email = (request.data.get('email') or '').strip().lower()
    code = (request.data.get('code') or '').strip()
    if not email or not code:
        return Response({'error': 'Email and code are required'}, status=400)

    try:
        token_obj = EmailVerificationToken.objects.select_related('user').get(user__email__iexact=email)
    except EmailVerificationToken.DoesNotExist:
        return Response({'error': 'Invalid code'}, status=400)

    if token_obj.is_verified:
        return Response({'status': 'ok', 'message': 'Email already verified'})

    if token_obj.is_expired:
        return Response({'error': 'Verification code has expired. Please request a new one.'}, status=400)

    if token_obj.is_locked:
        return Response({'error': 'Too many incorrect attempts. Please request a new code.'}, status=400)

    if token_obj.code != code:
        token_obj.register_failed_attempt()
        remaining = token_obj.MAX_ATTEMPTS - token_obj.attempts
        if remaining <= 0:
            return Response({'error': 'Too many incorrect attempts. Please request a new code.'}, status=400)
        return Response({'error': f'Incorrect code. {remaining} attempt(s) remaining.'}, status=400)

    token_obj.verify()
    return Response({'status': 'ok', 'message': 'Email verified successfully. You can now log in.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_verification(request):
    """Resend verification code"""
    from .models import EmailVerificationToken
    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'error': 'Email is required'}, status=400)

    user = User.objects.filter(email__iexact=email, is_active=False).first()
    if not user:
        # Don't reveal whether the email exists
        return Response({'status': 'ok', 'message': 'If the email exists and is unverified, a new code has been sent.'})

    # Delete old token and create new one (resets both the code and attempts counter)
    EmailVerificationToken.objects.filter(user=user).delete()
    token_obj = EmailVerificationToken.objects.create(user=user)

    # Send email
    from django.core.mail import send_mail
    from django.conf import settings

    try:
        send_mail(
            subject=f'{token_obj.code} is your Carbonless verification code',
            message=(
                f"Hi {user.username},\n\n"
                f"Your verification code is:\n\n"
                f"    {token_obj.code}\n\n"
                f"Enter this code on the site to activate your account. "
                f"This code expires in 24 hours.\n\n— Carbonless Team"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f'Failed to resend verification email to {user.email}: {e}', exc_info=True)

    return Response({'status': 'ok', 'message': 'If the email exists and is unverified, a new code has been sent.'})


# ── Two-Factor Authentication (2FA) ─────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def setup_2fa(request):
    """Generate TOTP secret and QR URI for setting up 2FA"""
    from .totp import TOTPDevice, generate_secret, generate_backup_codes, get_totp_uri

    # Check if already has a device
    device, created = TOTPDevice.objects.get_or_create(
        user=request.user,
        defaults={'secret': generate_secret(), 'backup_codes': generate_backup_codes()}
    )

    if not created and device.is_confirmed:
        return Response({'error': '2FA is already enabled. Disable it first to reconfigure.'}, status=400)

    # If not confirmed yet, regenerate
    if not created and not device.is_confirmed:
        device.secret = generate_secret()
        device.backup_codes = generate_backup_codes()
        device.save()

    uri = get_totp_uri(device.secret, request.user.username)

    return Response({
        'secret': device.secret,
        'uri': uri,
        'backup_codes': device.backup_codes,
        'message': 'Scan the QR code with your authenticator app, then confirm with a code.',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_2fa(request):
    """Confirm 2FA setup by verifying the first TOTP code"""
    from .totp import TOTPDevice, verify_totp

    code = request.data.get('code', '')
    if not code:
        return Response({'error': 'Verification code is required'}, status=400)

    try:
        device = TOTPDevice.objects.get(user=request.user)
    except TOTPDevice.DoesNotExist:
        return Response({'error': 'Please set up 2FA first'}, status=400)

    if device.is_confirmed:
        return Response({'error': '2FA is already confirmed'}, status=400)

    if verify_totp(device.secret, code):
        device.is_confirmed = True
        device.save(update_fields=['is_confirmed'])
        return Response({'status': 'ok', 'message': '2FA enabled successfully!'})
    else:
        return Response({'error': 'Invalid code. Please try again.'}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disable_2fa(request):
    """Disable 2FA (requires password confirmation)"""
    from .totp import TOTPDevice

    password = request.data.get('password', '')
    if not password or not request.user.check_password(password):
        return Response({'error': 'Password confirmation required'}, status=400)

    TOTPDevice.objects.filter(user=request.user).delete()
    return Response({'status': 'ok', 'message': '2FA has been disabled.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_2fa_status(request):
    """Check if 2FA is enabled for current user"""
    from .totp import TOTPDevice
    try:
        device = TOTPDevice.objects.get(user=request.user)
        return Response({
            'enabled': device.is_confirmed,
            'pending_setup': not device.is_confirmed,
        })
    except TOTPDevice.DoesNotExist:
        return Response({'enabled': False, 'pending_setup': False})
