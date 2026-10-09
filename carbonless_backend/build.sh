#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate
python manage.py seed_factors
# Must follow seed_factors: it owns the factor values, this divides each
# factor's CO2e between the gases. Without it the ISO report's CH4/N2O/HFC/
# PFC/SF6 columns are empty and every source falls back to the CO2 column.
python manage.py seed_gas_splits
python manage.py create_admin
# Text only: the calculation description of existing questionnaire entries.
python manage.py backfill_calc_detail || echo "backfill_calc_detail skipped (non-critical)"
python manage.py ensure_user_companies || echo "ensure_user_companies skipped (non-critical)"
