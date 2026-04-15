#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

# Install fonts for PDF Turkish character support
apt-get update && apt-get install -y fonts-dejavu-core || true

python manage.py collectstatic --no-input

# Run migrations (may fail on first deploy with new schema)
python manage.py migrate --run-syncdb || python manage.py migrate

# Seed emission factors (safe: update_or_create)
python manage.py seed_factors || true

# Create admin if not exists
python manage.py create_admin || true
