from rest_framework.permissions import BasePermission
from .utils import get_current_company


class IsCompanyMember(BasePermission):
    """Ensure user has an active company membership."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and get_current_company(request.user) is not None

    def has_object_permission(self, request, view, obj):
        company = get_current_company(request.user)
        obj_company = getattr(obj, 'company', None)
        return company is not None and obj_company == company


class HasCompanyAdminRole(BasePermission):
    """Only owner/admin can access."""
    allowed_roles = {'owner', 'admin'}

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        membership = (
            request.user.company_memberships
            .filter(is_active=True)
            .first()
        )
        return membership is not None and membership.role in self.allowed_roles
