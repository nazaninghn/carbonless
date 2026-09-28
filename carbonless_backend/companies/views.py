from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Company, Facility, CompanyMembership
from .serializers import CompanySerializer, FacilitySerializer
from .utils import get_current_company


class CompanyCreateView(generics.CreateAPIView):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = (IsAuthenticated,)

    def perform_create(self, serializer):
        company = serializer.save()
        CompanyMembership.objects.get_or_create(
            company=company, user=self.request.user,
            defaults={'role': 'owner', 'is_active': True},
        )


from .permissions import IsCompanyMember, HasCompanyAdminRole, NotAuditorForWrites


class CompanyDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CompanySerializer
    permission_classes = (IsAuthenticated, IsCompanyMember, NotAuditorForWrites)

    def get_object(self):
        company = get_current_company(self.request.user)
        if not company:
            from rest_framework.exceptions import NotFound
            raise NotFound('No company found')
        return company


class FacilityListCreateView(generics.ListCreateAPIView):
    serializer_class = FacilitySerializer
    permission_classes = (IsAuthenticated, IsCompanyMember, NotAuditorForWrites)

    def get_queryset(self):
        company = get_current_company(self.request.user)
        return Facility.objects.filter(company=company) if company else Facility.objects.none()

    def perform_create(self, serializer):
        company = get_current_company(self.request.user)
        serializer.save(company=company)


class FacilityDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FacilitySerializer
    permission_classes = (IsAuthenticated, IsCompanyMember, NotAuditorForWrites)

    def get_queryset(self):
        company = get_current_company(self.request.user)
        return Facility.objects.filter(company=company) if company else Facility.objects.none()


from .serializers import CompanyMembershipSerializer


class CompanyMembershipListView(generics.ListAPIView):
    """List all members of current company (admin/owner only)"""
    serializer_class = CompanyMembershipSerializer
    permission_classes = (IsAuthenticated, HasCompanyAdminRole)

    def get_queryset(self):
        company = get_current_company(self.request.user)
        if not company:
            return CompanyMembership.objects.none()
        return CompanyMembership.objects.filter(company=company).select_related('user', 'invited_by')


class CompanyMembershipUpdateView(generics.UpdateAPIView):
    """Update member role (admin/owner only)"""
    serializer_class = CompanyMembershipSerializer
    permission_classes = (IsAuthenticated, HasCompanyAdminRole)

    def get_queryset(self):
        company = get_current_company(self.request.user)
        if not company:
            return CompanyMembership.objects.none()
        return CompanyMembership.objects.filter(company=company)

    def perform_update(self, serializer):
        # Fix #54: Prevent privilege escalation via membership role changes.
        # Without this guard, any admin can PATCH role='owner' on any membership
        # — including their own — or demote the actual owner to data_entry.
        # Rules enforced:
        #   1. The new role must not be 'owner' (owner is granted only at company creation).
        #   2. The target membership must not already hold the 'owner' role.
        new_role = serializer.validated_data.get('role', serializer.instance.role)
        if new_role == 'owner':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("The 'owner' role cannot be assigned via this endpoint.")
        if serializer.instance.role == 'owner':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("The owner's membership cannot be modified.")
        serializer.save()


from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.core.exceptions import ValidationError
from .models import CompanyInvite


def _join_company_via_invite(user, invite):
    """Add `user` to the invite's company, mark it accepted, and switch the
    user into that company (they otherwise stay in their own signup company)."""
    CompanyMembership.objects.get_or_create(
        company=invite.company, user=user,
        defaults={'role': invite.role, 'invited_by': invite.invited_by}
    )
    invite.accepted = True
    invite.save(update_fields=['accepted'])
    from accounts.models import UserProfile
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.active_company = invite.company
    profile.save(update_fields=['active_company'])


def accept_pending_invites(user):
    """Join every open, unexpired invite addressed to this user's email.

    Called once the email address is verified: the team screen promises that
    an invited person "is added automatically after registration", and only a
    verified address proves they own the one the invite was sent to.
    """
    if not user.email:
        return []
    joined = []
    for invite in CompanyInvite.objects.filter(email__iexact=user.email.strip(), accepted=False).select_related('company'):
        if invite.is_expired:
            continue
        _join_company_via_invite(user, invite)
        joined.append(invite.company)
    return joined


def _send_invite_email(invite, inviter):
    """Email the invitee a join link. Returns True if handed to the mail backend.

    Bilingual because nothing tells us the invitee's language yet.
    """
    import logging
    import os
    from django.conf import settings
    from django.core.mail import send_mail

    frontend = (os.environ.get('FRONTEND_URL') or 'http://localhost:3000').strip().rstrip('/')
    link = f"{frontend}/accept-invite?token={invite.token}"
    company = invite.company.legal_entity_name
    who = (inviter.get_full_name() or inviter.username) if inviter else 'Carbonless'
    if who.strip() == company.strip() and inviter:
        # Signup stores the company name as the person's name until they edit
        # their profile — "X invited you to X" reads as a mistake.
        who = inviter.username
    days = CompanyInvite.INVITE_TTL_DAYS
    message = (
        f"Merhaba,\n\n"
        f"{who}, sizi Carbonless'ta {company} ekibine davet etti.\n\n"
        f"Katılmak için bağlantıya tıklayın:\n{link}\n\n"
        f"Henüz hesabınız yoksa bu e-posta adresiyle ({invite.email}) kayıt olun; "
        f"e-postanızı doğruladığınızda ekibe otomatik olarak eklenirsiniz. "
        f"Davet {days} gün geçerlidir.\n\n"
        f"— — —\n\n"
        f"Hello,\n\n"
        f"{who} invited you to join {company} on Carbonless.\n\n"
        f"Join here:\n{link}\n\n"
        f"No account yet? Sign up with this email address ({invite.email}); you will be "
        f"added to the team automatically once you verify it. "
        f"The invite is valid for {days} days.\n\n"
        f"— Carbonless"
    )
    try:
        send_mail(
            subject=f"{company} sizi Carbonless'a davet ediyor / invites you to Carbonless",
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invite.email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        logging.getLogger(__name__).error('Invite email to %s failed: %s', invite.email, e)
        return False


@api_view(['POST'])
@permission_classes([IsAuthenticated, HasCompanyAdminRole])
def invite_member(request):
    """Invite a user to current company (owner/admin only)"""
    company = get_current_company(request.user)
    if not company:
        return Response({'error': 'No company'}, status=403)
    email = (request.data.get('email') or '').strip().lower()
    role = request.data.get('role', 'data_entry')
    if not email:
        return Response({'error': 'email required', 'code': 'email_required'}, status=400)
    from django.core.validators import validate_email
    from django.core.exceptions import ValidationError as DjangoValidationError
    try:
        validate_email(email)
    except DjangoValidationError:
        return Response({'error': 'Enter a valid email address.', 'code': 'invalid_email'}, status=400)
    # Someone already in the team gets no "join the team" e-mail; a
    # deactivated member is turned back on from the member list instead.
    existing = (CompanyMembership.objects.filter(company=company, user__email__iexact=email)
                .select_related('user').first())
    if existing:
        return Response({
            'error': 'This person is already a member of the team.',
            'code': 'already_member' if existing.is_active else 'inactive_member',
        }, status=400)

    # Fix #27: Validate role — 'owner' must never be assignable via an invite.
    # Without this check any API caller could POST role='owner' and gain full
    # control over the company account.  Owner is only granted by perform_create
    # in CompanyCreateView when the user creates the company.
    ALLOWED_INVITE_ROLES = {'admin', 'manager', 'data_entry', 'auditor'}
    if role not in ALLOWED_INVITE_ROLES:
        return Response(
            {'error': f"Invalid role '{role}'. Allowed values: {', '.join(sorted(ALLOWED_INVITE_ROLES))}"},
            status=400,
        )

    # Fix #47: update_or_create replaces get_or_create so that re-inviting an
    # existing unaccepted invite properly refreshes the role and invited_by
    # fields instead of silently keeping stale values.
    # Sending the invite again also renews it: a fresh 7-day expiry (the old
    # one kept counting, so a re-sent link could already be expired) and a
    # new link, so an earlier forwarded link stops working.
    import datetime
    import uuid
    from django.utils import timezone
    invite, created = CompanyInvite.objects.update_or_create(
        company=company, email=email,
        defaults={
            'role': role, 'invited_by': request.user, 'accepted': False,
            'token': uuid.uuid4(),
            'expires_at': timezone.now() + datetime.timedelta(days=CompanyInvite.INVITE_TTL_DAYS),
        }
    )
    # Previously nothing was sent: the invite only existed in the database and
    # its token only in this response, so the invitee had no way to join.
    email_sent = _send_invite_email(invite, request.user)
    return Response({
        'token': str(invite.token), 'email': invite.email, 'created': created,
        'email_sent': email_sent,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def invite_info(request):
    """What an invite link is for — company, role and address — so the join
    page can show it and lock the email. Only the holder of the (random)
    token can ask."""
    token = request.query_params.get('token')
    try:
        invite = CompanyInvite.objects.select_related('company').get(token=token)
    except (CompanyInvite.DoesNotExist, ValueError, ValidationError):
        return Response({'error': 'Invalid invite', 'code': 'invalid_invite'}, status=404)
    if invite.accepted:
        return Response({'error': 'This invite has already been used.', 'code': 'invite_used'}, status=410)
    if invite.is_expired:
        return Response({'error': 'This invite has expired.', 'code': 'invite_expired'}, status=410)
    return Response({
        'email': invite.email, 'role': invite.role,
        'company': invite.company.legal_entity_name,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAdminRole])
def pending_invites(request):
    """Invites of the current company not yet accepted, newest first."""
    company = get_current_company(request.user)
    rows = CompanyInvite.objects.filter(company=company, accepted=False).order_by('-created_at')
    return Response([{
        'id': i.id, 'email': i.email, 'role': i.role,
        'created_at': i.created_at, 'expires_at': i.expires_at, 'expired': i.is_expired,
    } for i in rows])


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, HasCompanyAdminRole])
def cancel_invite(request, pk):
    """Withdraw a pending invite; its link stops working."""
    company = get_current_company(request.user)
    deleted, _ = CompanyInvite.objects.filter(company=company, pk=pk, accepted=False).delete()
    if not deleted:
        return Response({'error': 'Invite not found'}, status=404)
    return Response(status=204)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_invite(request):
    """Accept an invite to join a company"""
    token = request.data.get('token')
    try:
        invite = CompanyInvite.objects.select_related('company').get(token=token)
    except (CompanyInvite.DoesNotExist, ValueError, ValidationError):
        return Response({'error': 'Invalid or already used invite'}, status=404)

    if invite.accepted:
        # Already joined — typically auto-joined on email verification, then
        # the invite link was opened. Treat it as success for that member.
        if CompanyMembership.objects.filter(company=invite.company, user=request.user).exists():
            return Response({'status': 'ok', 'company': invite.company.legal_entity_name})
        return Response({'error': 'Invalid or already used invite'}, status=404)

    # Fix #30: Reject expired invites (is_expired handles legacy None rows safely)
    if invite.is_expired:
        return Response({'error': 'This invite has expired. Please request a new one.'}, status=410)

    # Security fix: an invite is only valid for the email it was addressed
    # to. Without this check, anyone who obtains a valid token (e.g. the
    # inviter themselves, since invite_member echoes it back in the response)
    # could accept it with a different account and join the company under
    # that invite's role, regardless of which address it was sent to.
    if request.user.email.strip().lower() != invite.email.strip().lower():
        return Response(
            {'error': 'This invite was sent to a different email address. Please log in with that account.'},
            status=403,
        )

    # Also switches the user into that company — otherwise someone who has
    # their own (signup) company never actually sees the one they joined.
    _join_company_via_invite(request.user, invite)

    return Response({'status': 'ok', 'company': invite.company.legal_entity_name})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_companies(request):
    """List every company the user has an active membership in, so the
    frontend can offer a switcher for users who belong to more than one."""
    memberships = (
        request.user.company_memberships
        .filter(is_active=True)
        .select_related('company')
        .order_by('created_at')
    )
    current = get_current_company(request.user)
    return Response([
        {
            'id': m.company.id,
            'name': m.company.legal_entity_name,
            'role': m.role,
            'is_current': current is not None and m.company_id == current.id,
        }
        for m in memberships
    ])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def switch_company(request):
    """Switch which company the user is currently viewing/working in."""
    company_id = request.data.get('company_id')
    if not company_id:
        return Response({'error': 'company_id is required'}, status=400)

    membership = request.user.company_memberships.filter(
        company_id=company_id, is_active=True
    ).select_related('company').first()
    if not membership:
        return Response({'error': "You don't have access to that company."}, status=403)

    request.user.profile.active_company = membership.company
    request.user.profile.save(update_fields=['active_company'])
    return Response({'status': 'ok', 'company': membership.company.legal_entity_name})
