"""Factor rows of a standard that are loaded but withheld from selection.

emissions/data/withheld_factors.json names them, per standard, with the reason.
A withheld row is stored inactive: `pick_factor` never selects it, and the
activity is reported as "not calculated — factor under review" (never as a
number, and never as "the standard publishes no factor", which would be untrue).
"""
import functools
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent / 'data' / 'withheld_factors.json'


@functools.lru_cache(maxsize=None)
def withheld():
    """{standard: {slug: {reason, register, risk}}}"""
    payload = json.loads(DATA.read_text(encoding='utf-8'))
    return {k: v for k, v in payload.items() if isinstance(v, dict)}


def is_withheld(standard, slug):
    return slug in withheld().get(standard, {})
