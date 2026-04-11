from companies.utils import get_current_company


def scope_queryset_to_company(queryset, user):
    """Filter queryset to current user's company. Returns empty if no company."""
    company = get_current_company(user)
    if not company:
        return queryset.none()
    return queryset.filter(company=company)
