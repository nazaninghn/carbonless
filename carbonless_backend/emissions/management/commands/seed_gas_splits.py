"""Fill in the per-gas breakdown of emission factors.

Separate from `seed_factors` on purpose: that command owns the factor values
themselves, this one only divides an already-seeded factor's CO2e between the
gases. Running it never changes a factor's total — if a split it computes does
not add back up to the stored factor, that is a bug in this command and it
refuses the row rather than adjusting the factor to fit.

    python manage.py seed_gas_splits            # apply
    python manage.py seed_gas_splits --dry-run  # report what would change
    python manage.py seed_gas_splits --clear    # remove every split first
"""
from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand
from django.db import transaction

from emissions.models import EmissionFactor
from emissions.gas_split_data import (
    FUEL_PROFILE_BY_SLUG, SINGLE_GAS_BY_SLUG,
    fuel_gas_shares, fuel_profile_citation,
)

Q = Decimal('0.000001')  # the DecimalField's own precision


def _q(value):
    return Decimal(value).quantize(Q, rounding=ROUND_HALF_UP)


class Command(BaseCommand):
    help = 'Derive the per-gas (CO2/CH4/N2O/HFC/PFC/SF6) breakdown of seeded emission factors'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would change without writing')
        parser.add_argument('--clear', action='store_true',
                            help='Clear every existing split before applying')

    def handle(self, *args, **options):
        dry = options['dry_run']
        gas_fields = list(EmissionFactor.GAS_FIELDS.values())

        if options['clear'] and not dry:
            cleared = EmissionFactor.objects.exclude(gas_split_basis='').update(
                gas_split_basis='', gas_split_reference='',
                **{f: None for f in gas_fields})
            self.stdout.write(f'Cleared splits on {cleared} factors.')

        single, apportioned, skipped, mismatched = 0, 0, 0, []

        with transaction.atomic():
            for factor in EmissionFactor.objects.all():
                total = factor.factor_kg_co2e
                if not total or total <= 0:
                    skipped += 1
                    continue

                if factor.slug in SINGLE_GAS_BY_SLUG:
                    gas, description = SINGLE_GAS_BY_SLUG[factor.slug]
                    values = {g: None for g in EmissionFactor.GAS_COLUMNS}
                    values[gas] = _q(total)
                    basis = 'single_gas'
                    citation = (f'Single-gas source: {description}. The whole factor is '
                                f'{gas}, weighted by its own 100-year GWP.')
                elif factor.slug in FUEL_PROFILE_BY_SLUG:
                    profile = FUEL_PROFILE_BY_SLUG[factor.slug]
                    shares = fuel_gas_shares(profile)
                    values = {g: None for g in EmissionFactor.GAS_COLUMNS}
                    # Give CO2 the remainder rather than its own rounded share,
                    # so the six values add back to the factor exactly instead
                    # of drifting by a few units in the last decimal place.
                    minor = {g: _q(total * Decimal(str(shares[g])))
                             for g in ('CH4', 'N2O')}
                    values.update(minor)
                    values['CO2'] = _q(total - sum(minor.values()))
                    basis = 'apportioned'
                    citation = (
                        f'CO2/CH4/N2O proportions from {fuel_profile_citation(profile)}, '
                        f'weighted by AR6 100-year GWPs and applied to this factor\'s '
                        f'published CO2e total, which is unchanged.')
                else:
                    skipped += 1
                    continue

                written = {g: v for g, v in values.items() if v}
                drift = abs(sum(written.values()) - total) / total
                if drift > EmissionFactor.GAS_SPLIT_TOLERANCE:
                    mismatched.append((factor.slug, factor.country, drift))
                    continue

                for gas, field in EmissionFactor.GAS_FIELDS.items():
                    setattr(factor, field, values[gas])
                factor.gas_split_basis = basis
                factor.gas_split_reference = citation
                if not dry:
                    factor.save(update_fields=gas_fields +
                                ['gas_split_basis', 'gas_split_reference'])
                if basis == 'single_gas':
                    single += 1
                else:
                    apportioned += 1

            if dry:
                transaction.set_rollback(True)

        for slug, country, drift in mismatched:
            self.stdout.write(self.style.ERROR(
                f'  REFUSED {slug} [{country}] — split drifts {drift:.2%} from the factor'))

        verb = 'would be set' if dry else 'set'
        self.stdout.write(self.style.SUCCESS(
            f'{verb}: {single} single-gas, {apportioned} apportioned; '
            f'{skipped} left without a split (no published basis); '
            f'{len(mismatched)} refused.'))
