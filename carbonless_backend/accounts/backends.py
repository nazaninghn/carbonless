from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class EmailOrUsernameModelBackend(ModelBackend):
    """Authenticate with either the Django `username` or the account email.

    The login form (and its "Username or Email" label/placeholder) promises
    both work, and the frontend sends the typed value as both `username` and
    `email` in the token request — but Simple JWT's TokenObtainPairSerializer
    only ever reads the `username` field and hands it straight to
    Django's stock ModelBackend, which looks up `User.username` exactly.
    Anyone who types their email (and whose Django username differs from it,
    the common case — registration has separate username/email fields) could
    never log in: authenticate() returned None regardless of a correct
    password, and Simple JWT's generic "No active account found with the
    given credentials" was misread by the login page as an unverified
    account, sending users on a pointless re-verification loop that could
    never fix the real problem.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(get_user_model().USERNAME_FIELD)
        if username is None or password is None:
            return None

        UserModel = get_user_model()
        user = (
            UserModel._default_manager.filter(username__iexact=username).first()
            or UserModel._default_manager.filter(email__iexact=username).first()
        )
        if user is None:
            # Run the default hasher anyway to keep timing consistent between
            # "no such user" and "wrong password" (mirrors ModelBackend).
            UserModel().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
