# Carbonless Backend API

Django REST API for Carbonless Carbon Footprint Calculator

## Setup

1. Create superuser:
```bash
python manage.py createsuperuser
```

2. Run server:
```bash
python manage.py runserver
```

## API Endpoints

### Authentication
- POST `/api/accounts/register/` - Register new user
- POST `/api/accounts/login/` - Login (get JWT token)
- POST `/api/accounts/token/refresh/` - Refresh JWT token
- GET `/api/accounts/profile/` - Get user profile (authenticated)

### Companies
- POST `/api/companies/create/` - Create company profile (authenticated)
- GET `/api/companies/detail/` - Get company details (authenticated)
- PUT `/api/companies/detail/` - Update company details (authenticated)

## Admin Panel
Access at: http://localhost:8000/admin/

## Testing with curl

### Register:
```bash
curl -X POST http://localhost:8000/api/accounts/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"testpass123","password2":"testpass123"}'
```

### Login:
```bash
curl -X POST http://localhost:8000/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"testpass123"}'
```
