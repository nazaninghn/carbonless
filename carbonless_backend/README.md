# Carbonless Backend

Django REST API for the Carbonless carbon accounting platform.

## Quick Start (Local Development)

```bash
cd carbonless_backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## Environment Variables

Create a `.env` file in `carbonless_backend/`:

```env
# Required
SECRET_KEY=your-secret-key-here
ALLOW_DEV_SECRET=true          # Only for local dev (uses a hardcoded key if SECRET_KEY missing)
DATABASE_URL=                   # Leave empty for SQLite (local), or postgres://... for production

# Email (optional locally — uses console backend if unset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=your@email.com
EMAIL_HOST_PASSWORD=app-password
DEFAULT_FROM_EMAIL=noreply@carbonless.info

# AI Chat
GROQ_API_KEY=gsk_...           # Required for AI chat to work

# Google OAuth (optional)
GOOGLE_CLIENT_ID=...

# Production only
RENDER=true
PRODUCTION=true
FRONTEND_URL=https://carbonless.info
SKIP_EMAIL_VERIFICATION=false
```

## Management Commands

```bash
# Fix users without a company (legacy accounts)
python manage.py fix_missing_companies

# Seed emission factors
python manage.py seed_emission_factors
```

## Deployment (Render)

- Python 3.12 (`runtime.txt`)
- Build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
- Start command: `gunicorn carbonless_api.wsgi:application --workers 2 --timeout 60`
  (2 workers fits the Starter plan's 0.5 CPU / 512MB — more workers would
  contend for the half core rather than add capacity; 60s timeout gives
  Groq-backed AI endpoints room to finish instead of being killed early)
- Set all env vars above in Render dashboard

## Architecture

- `accounts/` — User auth, JWT, email verification, Google OAuth
- `companies/` — Company model, memberships, invites
- `emissions/` — Emission factors, entries, reports, ISO 14064-1 PDF
- `chat/` — AI chatbot (Groq LLM + NLU + factor lookup)
- `questionnaire/` — Guided carbon inventory questionnaire (133 questions)
- `subscriptions/` — Stripe billing (Pro plan)
