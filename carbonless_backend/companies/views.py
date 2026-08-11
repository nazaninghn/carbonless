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


from .permissions import IsCompanyMember, HasCompanyAdminRole


class CompanyDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CompanySerializer
    permission_classes = (IsAuthenticated, IsCompanyMember)

    def get_object(self):
        company = get_current_company(self.request.user)
        if not company:
            from rest_framework.exceptions import NotFound
            raise NotFound('No company found')
        return company


class FacilityListCreateView(generics.ListCreateAPIView):
    serializer_class = FacilitySerializer
    permission_classes = (IsAuthenticated, IsCompanyMember)

    def get_queryset(self):
        company = get_current_company(self.request.user)
        return Facility.objects.filter(company=company) if company else Facility.objects.none()

    def perform_create(self, serializer):
        company = get_current_company(self.request.user)
        serializer.save(company=company)


class FacilityDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FacilitySerializer
    permission_classes = (IsAuthenticated, IsCompanyMember)

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
from .models import CompanyInvite


@api_view(['POST'])
@permission_classes([IsAuthenticated, HasCompanyAdminRole])
def invite_member(request):
    """Invite a user to current company (owner/admin only)"""
    company = get_current_company(request.user)
    if not company:
        return Response({'error': 'No company'}, status=403)
    email = request.data.get('email')
    role = request.data.get('role', 'data_entry')
    if not email:
        return Response({'error': 'email required'}, status=400)

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
    invite, created = CompanyInvite.objects.update_or_create(
        company=company, email=email.strip().lower(),
        defaults={'role': role, 'invited_by': request.user}
    )
    return Response({'token': str(invite.token), 'email': invite.email, 'created': created})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_invite(request):
    """Accept an invite to join a company"""
    token = request.data.get('token')
    try:
        invite = CompanyInvite.objects.get(token=token, accepted=False)
    except CompanyInvite.DoesNotExist:
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

    CompanyMembership.objects.get_or_create(
        company=invite.company, user=request.user,
        defaults={'role': invite.role, 'invited_by': invite.invited_by}
    )
    invite.accepted = True
    invite.save()
    return Response({'status': 'ok', 'company': invite.company.legal_entity_name})
