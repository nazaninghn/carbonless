"""
Per-gas breakdown of the emission factors in `seed_data.py`.

ISO 14064-1 reports an inventory gas by gas. The factors this platform applies
are published as a single CO2e figure per activity unit, so the split has to
come from somewhere else. There are exactly two defensible sources, and this
module keeps them apart:

  * **single_gas** — the source releases one identified gas, so 100 % of the
    factor is that gas. True of every refrigerant and fire-suppressant: an
    R-410A leak is R-410A. Nothing is inferred here.

  * **apportioned** — the source burns a fuel, and the IPCC publishes default
    CO2 / CH4 / N2O emission factors for that fuel and combustion type. Those
    published *ratios* are applied to the factor's own CO2e total, which is
    left unchanged. The split is therefore an apportionment on a published
    basis, not a measurement, and `gas_split_basis` says so on every row so
    the report can state it.

Deliberately absent, and left with no split so the report reports them as a
combined CO2e figure:

  * grid electricity — national grid declarations differ on whether they
    include CH4/N2O at all, and this platform's Turkish grid factor carries no
    published split;
  * biogenic fuels (biodiesel, bioethanol, wood pellets, biogas) — the stored
    factor is the *non-CO2* portion only, since biogenic CO2 is reported
    separately, so apportioning a CO2 share out of it would be wrong;
  * distance-based composite factors (flights, rail, metro, bus, electric and
    hybrid cars) — these bundle fuel, grid and occupancy assumptions that no
    single IPCC fuel profile describes;
  * everything in Categories III-VI (purchased goods, waste, water, travel) —
    published as CO2e only.
"""

# ── AR6 100-year global warming potentials ──────────────────────────────────
# IPCC Sixth Assessment Report (2021), WG1 Chapter 7, Table 7.15. Used only to
# turn the IPCC's mass-based default factors below into CO2e ratios.
GWP_CH4_FOSSIL = 29.8
GWP_N2O = 273

# ── IPCC default combustion factors, kg of gas per TJ of fuel ───────────────
# profile -> (CO2, CH4, N2O, citation)
IPCC_FUEL_PROFILES = {
    'natural_gas_stationary': (
        56100, 5, 0.1,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 2, Table 2.3 — natural gas, commercial/institutional'),
    'gas_oil_stationary': (
        74100, 10, 0.6,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 2, Table 2.3 — gas/diesel oil, commercial/institutional'),
    'lpg_stationary': (
        63100, 5, 0.1,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 2, Table 2.3 — LPG, commercial/institutional'),
    'coal_other_bituminous': (
        94600, 10, 1.5,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 2, Table 2.3 — other bituminous coal, manufacturing'),
    'residual_fuel_oil': (
        77400, 3, 0.6,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 2, Table 2.3 — residual fuel oil'),
    'diesel_onroad': (
        74100, 3.9, 3.9,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 3, Tables 3.2.1 / 3.2.2 — diesel, on-road'),
    'petrol_onroad': (
        69300, 3.8, 5.7,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 3, Tables 3.2.1 / 3.2.2 — petrol, on-road'),
    'lpg_onroad': (
        63100, 62, 0.2,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 3, Tables 3.2.1 / 3.2.2 — LPG, on-road'),
    'cng_onroad': (
        56100, 92, 3,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 3, Tables 3.2.1 / 3.2.2 — natural gas, on-road'),
    'diesel_offroad': (
        74100, 4.15, 28.6,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 3, Table 3.3.1 — diesel, off-road'),
    'petrol_offroad': (
        69300, 80, 2,
        'IPCC 2006 Guidelines, Vol. 2, Ch. 3, Table 3.3.1 — petrol, off-road'),
}

# ── Which factor burns which fuel ───────────────────────────────────────────
# slug -> IPCC profile. Slugs not listed here get no split.
FUEL_PROFILE_BY_SLUG = {
    # Stationary combustion
    'natural-gas': 'natural_gas_stationary',
    'natural-gas-kwh': 'natural_gas_stationary',
    'natural-gas-m3': 'natural_gas_stationary',
    'gas-diesel-oil-energy': 'gas_oil_stationary',
    'diesel': 'gas_oil_stationary',
    'diesel-kwh': 'gas_oil_stationary',
    'lpg': 'lpg_stationary',
    'propane': 'lpg_stationary',
    'coal': 'coal_other_bituminous',
    'coal-industrial': 'coal_other_bituminous',
    'fuel-oil': 'residual_fuel_oil',
    'motor-gasoline': 'petrol_onroad',

    # Mobile combustion
    'on-road-diesel': 'diesel_onroad',
    'on-road-diesel-desnz': 'diesel_onroad',
    'diesel-generic': 'diesel_onroad',
    'motorin-mobile': 'diesel_onroad',
    'car-diesel': 'diesel_onroad',
    'on-road-gasoline': 'petrol_onroad',
    'on-road-petrol-desnz': 'petrol_onroad',
    'gasoline-generic': 'petrol_onroad',
    'car-gasoline': 'petrol_onroad',
    'vehicle-km': 'petrol_onroad',
    'on-road-lpg': 'lpg_onroad',
    'car-lpg': 'lpg_onroad',
    'on-road-natural-gas': 'cng_onroad',
    'cng': 'cng_onroad',
    'off-road-ipcc': 'diesel_offroad',
    'off-road-diesel-desnz': 'diesel_offroad',
    'off-road-gasoline-desnz': 'petrol_offroad',
}

# ── Single-gas sources ──────────────────────────────────────────────────────
# slug -> (gas column, what the gas is). 100 % of the factor is that gas.
#
# R-22 is an HCFC, not an HFC. ISO 14064-1's reporting layout has six gas
# columns and no HCFC column, so it is reported with the other fluorinated
# gases — the same placement the reference inventory report uses — and the
# note on the row says which gas it actually is.
SINGLE_GAS_BY_SLUG = {
    'r134a': ('HFC', 'HFC-134a'),
    'r32': ('HFC', 'HFC-32'),
    'r410a': ('HFC', 'R-410A (HFC-32 / HFC-125 blend)'),
    'r404a': ('HFC', 'R-404A (HFC blend)'),
    'r407c': ('HFC', 'R-407C (HFC blend)'),
    'hfc-227ea': ('HFC', 'HFC-227ea (FM-200)'),
    'r22': ('HFC', 'HCFC-22 — reported in the fluorinated-gas column'),
    'sf6': ('SF6', 'Sulphur hexafluoride'),
    'co2-fire-suppression': ('CO2', 'Carbon dioxide'),
    'methane': ('CH4', 'Methane'),
    'n2o': ('N2O', 'Nitrous oxide'),
    # Deliberately absent: r600a (isobutane) and r432a (hydrocarbon blend) are
    # not fluorinated gases and have no column in the ISO layout, so they are
    # left without a split rather than filed under one they do not belong to.
}


def fuel_gas_shares(profile):
    """CO2e shares of one IPCC fuel profile: {'CO2': f, 'CH4': f, 'N2O': f}.

    The mass-based IPCC defaults are weighted by AR6 GWPs and normalised, so
    the result describes only the *proportions* between the gases. Applying
    them to a factor leaves that factor's own CO2e total untouched.
    """
    co2, ch4, n2o, _ref = IPCC_FUEL_PROFILES[profile]
    co2e = {
        'CO2': float(co2),
        'CH4': float(ch4) * GWP_CH4_FOSSIL,
        'N2O': float(n2o) * GWP_N2O,
    }
    total = sum(co2e.values())
    return {g: v / total for g, v in co2e.items()}


def fuel_profile_citation(profile):
    return IPCC_FUEL_PROFILES[profile][3]
