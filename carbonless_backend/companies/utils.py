def get_current_company(user):
    """
    Get the company this user is currently working in.

    A user can have more than one active CompanyMembership (e.g. invited into
    a second company while still owning their own auto-created one on
    registration) — profile.active_company records which one they last
    selected. Falls back to the earliest active membership (deterministic,
    not an arbitrary DB row order) when unset or no longer valid, and finally
    to the legacy Company.user link for backward compat.
    """
    try:
        preferred = user.profile.active_company
    except Exception:
        preferred = None
    if preferred and user.company_memberships.filter(company=preferred, is_active=True).exists():
        return preferred

    membership = (
        user.company_memberships
        .filter(is_active=True)
        .select_related('company')
        .order_by('created_at')
        .first()
    )
    if membership:
        return membership.company
    # Fallback for backward compat
    try:
        return user.company
    except Exception:
        return None
