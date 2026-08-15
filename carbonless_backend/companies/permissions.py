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
    """Only owner/admin of the user's CURRENT company can access.

    Was previously `.company_memberships.filter(is_active=True).first()` —
    ANY of the user's active memberships across ANY company, not specifically
    their current one. A user who's e.g. admin in Company A but only
    data_entry in Company B (their active company) could pass this check
    while acting on Company B's data, since get_queryset() scopes the
    editable objects to the current company but this permission check
    didn't — verified live: a data_entry-in-current-company attacker who
    was admin elsewhere could successfully promote another member of their
    (non-admin) current company to admin.
    """
    allowed_roles = {'owner', 'admin'}

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        company = get_current_company(request.user)
        if company is None:
            return False
        membership = (
            request.user.company_memberships
            .filter(is_active=True, company=company)
            .first()
        )
        return membership is not None and membership.role in self.allowed_roles
