#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate
python manage.py seed_factors
python manage.py create_admin
python manage.py ensure_user_companies || echo "ensure_user_companies skipped (non-critical)"
