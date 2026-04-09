from rest_framework.permissions import BasePermission


class IsCompanyMember(BasePermission):
    """Ensure user can only access objects belonging to their company."""

    def has_object_permission(self, request, view, obj):
        if not hasattr(obj, 'company') or obj.company is None:
            return True  # backward compat for entries without company
        try:
            return obj.company == request.user.company
        except Exception:
            return False


def get_user_company(user):
    """Helper to get user's company, returns None if not found."""
    try:
        return user.company
    except Exception:
        return None
