def get_current_company(user):
    """Get user's active company via membership. Falls back to Company.user."""
    membership = (
        user.company_memberships
        .filter(is_active=True)
        .select_related('company')
        .first()
    )
    if membership:
        return membership.company
    # Fallback for backward compat
    try:
        return user.company
    except Exception:
        return None
