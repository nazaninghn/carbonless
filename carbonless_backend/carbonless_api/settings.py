"""
Django settings for carbonless_api project.
Environment-aware: development / production (Render)
"""

import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file if it exists (for local development)
_env_path = BASE_DIR / '.env'
if _env_path.exists():
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                os.environ.setdefault(key.strip(), value.strip())

# ============================================
# ENVIRONMENT DETECTION
# ============================================
IS_PRODUCTION = bool(os.environ.get('RENDER') or os.environ.get('PRODUCTION'))
IS_DEV = not IS_PRODUCTION

# ============================================
# SECURITY
# ============================================
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if os.environ.get('ALLOW_DEV_SECRET') == 'true':
        SECRET_KEY = 'dev-only-not-for-shared-env-minimum-32-chars-long'
    else:
        raise RuntimeError('SECRET_KEY environment variable is required. Set ALLOW_DEV_SECRET=true for local dev.')

DEBUG = os.environ.get('DEBUG', 'false').lower() == 'true'

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,0.0.0.0').split(',')
    if host.strip()
]
if DEBUG:
    ALLOWED_HOSTS = ['*']
RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# ============================================
# APPS & MIDDLEWARE
# ============================================
INSTALLED_APPS = [
    'unfold',  # Must be listed before django.contrib.admin — it overrides admin templates.
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    # Fix #42: token_blacklist MUST be installed for BLACKLIST_AFTER_ROTATION=True
    # to have any effect.  Without it, old refresh tokens are never invalidated
    # after rotation — a stolen refresh token stays valid indefinitely.
    # Run `python manage.py migrate` after adding this app.
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'accounts',
    'companies',
    'emissions',
    'questionnaire',
    'chat',
    'subscriptions',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'carbonless_api.middleware.ContentSecurityPolicyMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'carbonless_api.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        # Project-level templates/ dir is checked before app dirs, so our
        # templates/admin/index.html override wins over unfold's own
        # (unfold is listed before our apps in INSTALLED_APPS, so without
        # this it would always win via APP_DIRS instead).
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'carbonless_api.wsgi.application'

# ============================================
# DATABASE
# ============================================
import dj_database_url

if os.environ.get('DATABASE_URL'):
    DATABASES = {
        'default': dj_database_url.config(default=os.environ.get('DATABASE_URL'), conn_max_age=600)
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ============================================
# AUTH & PASSWORD
# ============================================
# Google Identity Services OAuth client ID (public — also used by the frontend
# as NEXT_PUBLIC_GOOGLE_CLIENT_ID). Must match exactly or token verification
# in accounts.views.GoogleLoginView rejects every credential.
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ============================================
# I18N & TIMEZONE
# ============================================
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ============================================
# STATIC & MEDIA
# ============================================
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# File upload limits
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
STORAGES = {
    # Defining STORAGES at all replaces Django's defaults wholesale — it
    # doesn't merge with them. This dict previously only had 'staticfiles',
    # so 'default' (used by every FileField/ImageField, e.g. chat message
    # attachments) fell through to django.core.files.storage.storages['default']
    # with no backend registered, raising InvalidStorageError on every upload.
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ============================================
# REST FRAMEWORK & JWT
# ============================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'accounts.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    # BrowsableAPIRenderer is a DRF default that renders every endpoint as an
    # interactive HTML page with forms — useful in dev, but unnecessary
    # attack surface (and API structure disclosure) in production, where
    # nothing but the Next.js frontend talks to this API.
    'DEFAULT_RENDERER_CLASSES': (
        ('rest_framework.renderers.JSONRenderer', 'rest_framework.renderers.BrowsableAPIRenderer')
        if DEBUG else ('rest_framework.renderers.JSONRenderer',)
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# ============================================
# CORS — environment-aware
# ============================================
if IS_DEV:
    # 3003 is the port .claude/launch.json starts the Next.js frontend on —
    # without it every browser call to this API fails CORS preflight in local
    # dev (the Next.js /api/auth/* proxy routes still work, since those are
    # same-origin, which makes the breakage look like "login works but nothing
    # else does").
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3003",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3003",
    ]
else:
    CORS_ALLOWED_ORIGINS = []

# Allow all *.vercel.app preview & production URLs automatically
# so we don't need to update CORS every time Vercel generates a new deploy URL.
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://[\w-]+\.vercel\.app$",
]

VERCEL_URL = os.environ.get('VERCEL_URL', '')
if VERCEL_URL:
    CORS_ALLOWED_ORIGINS.append(f"https://{VERCEL_URL}")

# Trailing slashes are a silent killer here: a browser Origin header never has
# one, so "https://site.com/" would never match and every request would fail
# CORS with no obvious reason. Normalise once, at the source.
FRONTEND_URL = os.environ.get('FRONTEND_URL', '').strip().rstrip('/')


def _origin_variants(url):
    """The given origin plus its www/apex counterpart.

    https://example.com and https://www.example.com are different origins to
    the browser, but a visitor can arrive at either one. Registering only the
    one that happens to be in FRONTEND_URL is the most common cause of a CORS
    failure that looks like it appeared out of nowhere on "the other" URL.
    """
    if not url:
        return []
    scheme, _, host = url.partition('://')
    if not host:
        return [url]
    counterpart = host[4:] if host.startswith('www.') else f'www.{host}'
    return [url, f'{scheme}://{counterpart}']


CORS_ALLOWED_ORIGINS.extend(_origin_variants(FRONTEND_URL))

# Allow any additional origins from env (comma-separated list)
# e.g. CORS_EXTRA_ORIGINS=https://mycustomdomain.com,https://staging.example.com
for extra in os.environ.get('CORS_EXTRA_ORIGINS', '').split(','):
    extra = extra.strip()
    if extra:
        CORS_ALLOWED_ORIGINS.append(extra)

CSRF_TRUSTED_ORIGINS = [
    # All Vercel preview deployments
    "https://*.vercel.app",
]
CSRF_TRUSTED_ORIGINS.extend(_origin_variants(FRONTEND_URL))
if VERCEL_URL:
    CSRF_TRUSTED_ORIGINS.append(f"https://{VERCEL_URL}")

CORS_ALLOWED_ORIGINS = list({o.strip() for o in CORS_ALLOWED_ORIGINS if o.strip()})
CSRF_TRUSTED_ORIGINS = list({o.strip() for o in CSRF_TRUSTED_ORIGINS if o.strip()})

CORS_ALLOW_CREDENTIALS = True

# ============================================
# PRODUCTION SECURITY HEADERS
# ============================================
if IS_PRODUCTION:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_HTTPONLY = False  # JS needs to read CSRF token
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
    SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'

    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
    SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'

# ============================================
# EMAIL CONFIGURATION
# ============================================
# Uses real SMTP whenever EMAIL_HOST is set, in ANY environment (not just
# production) — this lets a developer test real delivery locally too.
# Falls back to console.EmailBackend (prints to server logs, no real send)
# only when EMAIL_HOST is absent, so registration/reset never hard-fails
# just because email isn't configured yet.
if os.environ.get('EMAIL_HOST'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('EMAIL_HOST')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')

    def _env_bool(name, default):
        """Read a boolean env var, treating blank as absent.

        A key left with an empty value in a hosting dashboard is indistinguishable
        from a typo, and reading '' as False would silently disable TLS — so an
        empty string falls back to the default rather than to off.
        """
        raw = os.environ.get(name, '').strip().lower()
        return default if raw == '' else raw in ('true', '1', 'yes', 'on')

    # Port 465 wants implicit SSL; port 587 wants STARTTLS. Django refuses to
    # start if both flags are true, and previously EMAIL_USE_SSL was read by
    # nobody — so an SSL-only provider (common on Turkish shared hosting) would
    # be dialled with STARTTLS and every send would fail. Treat SSL as the
    # explicit opt-in and let it switch TLS off.
    EMAIL_USE_SSL = _env_bool('EMAIL_USE_SSL', False)
    EMAIL_USE_TLS = (not EMAIL_USE_SSL) and _env_bool('EMAIL_USE_TLS', True)

    # send_mail runs inline during registration. Without a timeout an
    # unreachable SMTP host holds the HTTP request open until the platform
    # kills it, which reads to the user as the whole site hanging; with one it
    # fails fast and the "we couldn't send the email" path takes over.
    EMAIL_TIMEOUT = int(os.environ.get('EMAIL_TIMEOUT', 15))
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    EMAIL_HOST_USER = ''
    if IS_PRODUCTION:
        # console.EmailBackend "succeeds" — it just prints to server stdout
        # instead of sending — so send_mail() never raises here and the
        # try/except around it in accounts/views.py never logs anything.
        # Without this, a missing EMAIL_HOST on Render is invisible: users
        # see "Check Your Email" (registration genuinely succeeded) but no
        # mail ever leaves the server, and nothing in the logs says so.
        import warnings
        warnings.warn(
            'PRODUCTION IS RUNNING WITHOUT SMTP CONFIGURED — EMAIL_HOST is '
            'unset, so verification/reset emails are only printed to server '
            'logs, never actually sent. Set EMAIL_HOST, EMAIL_HOST_USER, '
            'EMAIL_HOST_PASSWORD (and EMAIL_PORT/EMAIL_USE_TLS if needed) '
            'in the Render environment variables.',
            RuntimeWarning,
        )

# Most SMTP providers (Gmail included) require the From address to match
# the authenticated account, or they silently rewrite/reject it — default
# to EMAIL_HOST_USER when DEFAULT_FROM_EMAIL isn't explicitly overridden.
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL') or EMAIL_HOST_USER or 'noreply@carbonless.info'

# ============================================
# DJANGO-UNFOLD — modern admin theme
# ============================================
# Colors match the frontend's brand green (#2ABD41 / #175022) so the admin
# doesn't feel like a bolted-on, unrelated tool.
UNFOLD = {
    'SITE_TITLE': 'Carbonless Admin',
    'SITE_HEADER': 'Carbonless',
    'SITE_SUBHEADER': 'Carbon Inventory Management',
    'SITE_LOGO': '/static/img/logo.png',
    'SITE_SYMBOL': 'eco',
    'SHOW_HISTORY': True,
    'SHOW_VIEW_ON_SITE': False,
    'DASHBOARD_CALLBACK': 'carbonless_api.admin_dashboard.dashboard_callback',
    'COLORS': {
        'primary': {
            '50': '240 253 244', '100': '222 250 225', '200': '187 247 208',
            '300': '134 239 172', '400': '74 222 128', '500': '42 189 65',
            '600': '23 80 34', '700': '21 128 61', '800': '22 101 52',
            '900': '20 83 45', '950': '5 46 22',
        },
    },
    'SIDEBAR': {
        'show_search': True,
        'show_all_applications': False,
        'navigation': [
            {
                'title': 'Accounts',
                'items': [
                    {'title': 'Users', 'icon': 'person', 'link': '/admin/auth/user/'},
                    {'title': 'Profiles', 'icon': 'badge', 'link': '/admin/accounts/userprofile/'},
                    {'title': 'Notifications', 'icon': 'notifications', 'link': '/admin/accounts/notification/'},
                    {'title': 'Activity Log', 'icon': 'history', 'link': '/admin/accounts/activitylog/'},
                ],
            },
            {
                'title': 'Companies',
                'items': [
                    {'title': 'Companies', 'icon': 'apartment', 'link': '/admin/companies/company/'},
                    {'title': 'Facilities', 'icon': 'factory', 'link': '/admin/companies/facility/'},
                    {'title': 'Memberships', 'icon': 'group', 'link': '/admin/companies/companymembership/'},
                ],
            },
            {
                'title': 'Emissions',
                'items': [
                    {'title': 'Emission Factors', 'icon': 'science', 'link': '/admin/emissions/emissionfactor/'},
                    {'title': 'Emission Entries', 'icon': 'local_fire_department', 'link': '/admin/emissions/emissionentry/'},
                    {'title': 'Reduction Targets', 'icon': 'target', 'link': '/admin/emissions/reductiontarget/'},
                    {'title': 'Custom Requests', 'icon': 'rule', 'link': '/admin/emissions/customemissionrequest/'},
                ],
            },
            {
                'title': 'Questionnaire',
                'items': [
                    {'title': 'Sessions', 'icon': 'quiz', 'link': '/admin/questionnaire/questionnairesession/'},
                    {'title': 'Advisor Approvals', 'icon': 'fact_check', 'link': '/admin/questionnaire/advisorapproval/'},
                ],
            },
            {
                'title': 'Subscriptions',
                'items': [
                    {'title': 'Subscriptions', 'icon': 'workspace_premium', 'link': '/admin/subscriptions/subscription/'},
                ],
            },
        ],
    },
}

# Skip email verification in development (set SKIP_EMAIL_VERIFICATION=true in .env)
# In production, remove this or set to false
