#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

# Install fonts for PDF Turkish character support
apt-get update && apt-get install -y fonts-dejavu-core || true

python manage.py collectstatic --no-input
python manage.py migrate
python manage.py seed_factors
python manage.py create_admin
