"""
Texts of the account e-mails (verification code, password reset), in the
recipient's language.

The language is the one the request was made in (the page the user was on)
when it sends one, else the account's language preference, else Turkish.
"""


def email_language(user, requested=None):
    if requested in ('tr', 'en'):
        return requested
    profile = getattr(user, 'profile', None)
    lang = getattr(profile, 'language_preference', None)
    return lang if lang in ('tr', 'en') else 'tr'


def _greeting_name(user):
    return (user.first_name or '').strip() or user.username


def verification_email(user, code, lang):
    """(subject, body) of the e-mail carrying the account verification code."""
    name = _greeting_name(user)
    if lang == 'tr':
        return (
            f'Carbonless doğrulama kodunuz: {code}',
            f"Merhaba {name},\n\n"
            f"Doğrulama kodunuz:\n\n"
            f"    {code}\n\n"
            f"Hesabınızı etkinleştirmek için bu kodu sitede girin. "
            f"Kod 24 saat geçerlidir.\n\n"
            f"Bu hesabı siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz.\n\n"
            f"— Carbonless Ekibi",
        )
    return (
        f'{code} is your Carbonless verification code',
        f"Hi {name},\n\n"
        f"Your verification code is:\n\n"
        f"    {code}\n\n"
        f"Enter this code on the site to activate your account. "
        f"This code expires in 24 hours.\n\n"
        f"If you didn't create this account, please ignore this email.\n\n"
        f"— Carbonless Team",
    )


def password_reset_email(user, reset_link, lang):
    """(subject, body) of the password reset e-mail."""
    name = _greeting_name(user)
    if lang == 'tr':
        return (
            'Carbonless şifrenizi sıfırlayın',
            f"Merhaba {name},\n\n"
            f"Şifrenizi sıfırlamak için bir istek aldık. Yeni şifrenizi belirlemek için "
            f"aşağıdaki bağlantıya tıklayın:\n\n"
            f"{reset_link}\n\n"
            f"Bu bağlantı 1 saat geçerlidir.\n\n"
            f"Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.\n\n"
            f"— Carbonless Ekibi",
        )
    return (
        'Reset your Carbonless password',
        f"Hi {name},\n\n"
        f"We received a request to reset your password. Click the link below:\n\n"
        f"{reset_link}\n\n"
        f"This link expires in 1 hour.\n\n"
        f"If you didn't request this, please ignore this email.\n\n"
        f"— Carbonless Team",
    )
