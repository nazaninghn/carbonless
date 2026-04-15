# Carbonless Backend

ISO 14064-1 Carbon Inventory Platform — Django REST API

## Architecture

- **Auth**: Cookie-based JWT (HttpOnly) + header fallback for cross-origin dev
- **Companies**: CompanyMembership model (owner/admin/manager/data_entry/auditor)
- **Emissions**: Company-scoped entries, targets, custom requests, 131+ factors
- **Questionnaire**: ISO 14064-1 chatbot flow (9 questions)
- **Reporting**: PDF (TR/EN) + CSV export

## Setup

```bash
cd carbonless_backend
python -m venv venv
venv/Scripts/activate  # Windows
pip install -r requirements.txt

# Environment
export ALLOW_DEV_SECRET=true
export DEBUG=true

python manage.py migrate
python manage.py seed_factors
python manage.py createsuperuser
python manage.py runserver
```

## Key Endpoints

### Auth
- `POST /api/accounts/register/` — Register (default role: data_entry)
- `POST /api/accounts/login/` — Login (sets HttpOnly cookies + returns tokens)
- `POST /api/accounts/token/refresh/` — Cookie-based refresh
- `POST /api/accounts/logout/` — Clear cookies
- `GET /api/accounts/profile/` — User profile + role + permissions
- `POST /api/accounts/change-password/`

### Companies (membership-based)
- `POST /api/companies/create/` — Create company (creator = owner)
- `GET /api/companies/detail/` — Current company
- `GET /api/companies/facilities/` — List facilities
- `GET /api/companies/memberships/` — List members (admin only)
- `PATCH /api/companies/memberships/{id}/` — Update role

### Emissions (company-scoped)
- `GET /api/emissions/factors/` — List emission factors
- `GET/POST /api/emissions/entries/` — CRUD entries
- `GET /api/emissions/summary/?year=2026` — Summary
- `GET /api/emissions/report/?year=2026&lang=tr` — PDF report
- `GET /api/emissions/export-csv/?year=2026` — CSV export
- `POST /api/emissions/calculate/` — Calculate (by ID or slug)
- `GET /api/emissions/comparison/?year1=2025&year2=2026`
- `POST /api/emissions/bulk-import/`
- `GET/POST /api/emissions/custom-requests/`

### Questionnaire
- `POST /api/questionnaire/start/` — Start/resume
- `POST /api/questionnaire/answer/` — Submit answer
- `GET /api/questionnaire/profile/` — Inventory config

## Tests

```bash
export ALLOW_DEV_SECRET=true
python manage.py test emissions accounts questionnaire companies
```

## Deploy (Render)

Environment variables: `SECRET_KEY`, `DATABASE_URL`, `DEBUG=False`, `FRONTEND_URL`, `ALLOWED_HOSTS`
