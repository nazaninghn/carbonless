"""
Local emission parser — extracts (activity_type, quantity, unit) from plain user
text without calling the Groq API.

Activity type names are aligned with emissions.factor_lookup.ACTIVITY_TO_SLUG so
the downstream resolve_factor_and_amount() call always finds a matching factor.
"""
import re
from datetime import datetime, timezone

# ── Activity detection patterns ───────────────────────────────────────────────
# Each key is the canonical activity_type that maps directly into ACTIVITY_TO_SLUG.
# Values are lists of keyword/alias strings matched case-insensitively.

ACTIVITY_PATTERNS: dict[str, list[str]] = {
    # ── Energy / Fuels ────────────────────────────────────────────────────────
    'electricity': [
        'electricity', 'elektrik', 'grid electricity', 'برق', 'electric',
    ],
    'natural_gas': [
        'natural gas', 'doğalgaz', 'dogalgaz', 'doğal gaz', 'گاز طبیعی', 'گاز',
    ],
    'diesel': [
        'diesel', 'mazot', 'dizel', 'دیزل', 'گازوییل', 'motorin',
    ],
    'petrol': [
        'petrol', 'gasoline', 'benzin', 'بنزین', 'motor gasoline',
    ],
    'lpg': [
        'lpg', 'ال پی جی',
    ],
    'coal': [
        'coal', 'kömür', 'komur', 'زغال', 'زغال‌سنگ',
    ],

    # ── Flights ───────────────────────────────────────────────────────────────
    'flight_domestic': [
        'domestic flight', 'iç hat uçuş', 'yurtiçi uçuş', 'پرواز داخلی',
    ],
    'flight_short_haul': [
        'short haul flight', 'short-haul flight', 'kısa mesafe uçuş',
        'پرواز کوتاه',
    ],
    'flight_medium_haul': [
        'medium haul flight', 'medium-haul flight', 'orta mesafe uçuş',
        'پرواز میان‌برد',
    ],
    'flight_long_haul': [
        'long haul flight', 'long-haul flight', 'uzun mesafe uçuş',
        'پرواز بلند',
    ],

    # ── Freight ───────────────────────────────────────────────────────────────
    'truck_freight': [
        'truck freight', 'kamyon taşımacılığı', 'karayolu taşıma',
        'حمل بار کامیون', 'road freight',
    ],
    'rail_freight': [
        'rail freight', 'demiryolu taşıma', 'tren yük',
        'حمل بار ریلی', 'train freight',
    ],
    'sea_freight': [
        'sea freight', 'deniz taşımacılığı', 'deniz yük',
        'حمل بار دریایی', 'ocean freight', 'ship freight',
    ],
    'air_freight': [
        'air freight', 'hava kargo', 'hava taşımacılığı',
        'حمل بار هوایی', 'air cargo',
    ],

    # ── Waste ─────────────────────────────────────────────────────────────────
    'waste_landfill': [
        'landfill', 'waste landfill', 'düzenli depolama', 'دفن زباله',
    ],
    'waste_recyclable': [
        'recyclable', 'recycle waste', 'geri dönüşüm', 'بازیافت',
    ],
    'waste_organic_compost': [
        'compost', 'organic waste', 'organik atık', 'kompost', 'کمپوست',
    ],
    'waste_incineration': [
        'incineration', 'yakma', 'atık yakma', 'سوزاندن زباله',
    ],

    # ── Employee Commuting ────────────────────────────────────────────────────
    'employee_commuting_car_commute': [
        'car commute', 'car commuting', 'arabayla işe gidiş',
        'رفت‌وآمد با خودرو',
    ],
    'employee_commuting_bus_commute': [
        'bus commute', 'bus commuting', 'otobüsle işe gidiş',
        'رفت‌وآمد با اتوبوس',
    ],
    'employee_commuting_train_commute': [
        'train commute', 'train commuting', 'trenle işe gidiş',
        'رفت‌وآمد با قطار',
    ],

    # ── Purchased Goods ───────────────────────────────────────────────────────
    'purchased_goods_plastic_average': [
        'plastic', 'plastik', 'پلاستیک',
    ],
    'purchased_goods_paper_mixed': [
        'paper', 'kağıt', 'kagit', 'کاغذ',
    ],
    'purchased_goods_glass': [
        'glass', 'cam', 'شیشه',
    ],
    'purchased_goods_metal_steel': [
        'steel', 'çelik', 'celik', 'فولاد',
    ],
    'purchased_goods_metal_aluminium': [
        'aluminium', 'aluminum', 'alüminyum', 'آلومینیوم',
    ],

    # ── Water ─────────────────────────────────────────────────────────────────
    'water_water_supply': [
        'water supply', 'su tüketimi', 'su kullanımı', 'مصرف آب',
        'water consumption', 'water usage',
    ],
    'water_water_treatment': [
        'water treatment', 'atıksu', 'su arıtma', 'تصفیه آب',
        'wastewater',
    ],

    # ── Road Travel (generic) ─────────────────────────────────────────────────
    'road_travel': [
        'road travel', 'car travel', 'drive', 'araba', 'ماشین', 'خودرو',
        'araç', 'road trip',
    ],
}


# ── Unit handling ─────────────────────────────────────────────────────────────

UNIT_SYNONYMS: dict[str, str] = {
    'm³': 'm3', 'm^3': 'm3',
    'kw/h': 'kwh', 'kw h': 'kwh',
    'liter': 'liters', 'litre': 'liters', 'litres': 'liters',
    'l': 'liters', 'lt': 'liters',
    'ton': 'tonne', 'tons': 'tonne', 'tonnes': 'tonne',
    'tkm': 'tonne-km',
}

UNIT_PATTERN = (
    r'(?P<unit>'
    r'kwh|kw/h|'
    r'm3|m³|m\^3|'
    r'liters?|litres?|l|lt|'
    r'kg|'
    r'km|'
    r'tonne-km|tkm|'
    r'gj'
    r')'
)


def normalise_unit(unit: str) -> str:
    """Canonicalise a raw unit string to the form used in ACTIVITY_TO_SLUG."""
    unit = (unit or '').strip().lower()
    return UNIT_SYNONYMS.get(unit, unit)


# ── Question / analysis detection ────────────────────────────────────────────

_QUESTION_WORDS = [
    'how', 'why', 'what', 'explain', 'summarize', 'report', 'reduce', 'strategy',
    'iso', 'ghg', 'nasıl', 'neden', 'nedir', 'özetle', 'rapor',
    'چطور', 'چگونه', 'چرا', 'چیست', 'گزارش', 'توضیح',
]


def looks_like_question(text: str) -> bool:
    """Return True if the text appears to be a question rather than data entry."""
    lower = text.lower()
    if '?' in text:
        return True
    return any(q in lower for q in _QUESTION_WORDS)


# ── Activity type detection ──────────────────────────────────────────────────

def detect_activity_type(text: str) -> str | None:
    """
    Scan *text* for activity keywords and return the matching activity_type key.
    Returns None if no match is found.
    """
    t = text.lower()
    for activity_type, aliases in ACTIVITY_PATTERNS.items():
        if any(alias in t for alias in aliases):
            return activity_type
    # Fallback heuristics
    if 'kwh' in t or 'kw/h' in t:
        return 'electricity'
    if ('m3' in t or 'm³' in t or 'm^3' in t) and 'gas' in t:
        return 'natural_gas'
    return None


# ── Main entry point ─────────────────────────────────────────────────────────

def try_local_emission_parse(text: str) -> dict | None:
    """
    Try to parse a simple emission data entry from user text without calling Groq.

    Returns a dict compatible with _build_pending_entries_from_data() on success,
    or None if the text doesn't look like a data entry (question, too vague, etc.)
    """
    if not text:
        return None

    if looks_like_question(text):
        return None

    pattern = (
        r'(?P<quantity>\d+(?:[.,]\d+)?)\s*'
        + UNIT_PATTERN + r'\b'
    )
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None

    activity_type = detect_activity_type(text)
    if not activity_type:
        return None

    quantity = match.group('quantity').replace(',', '.')
    unit = normalise_unit(match.group('unit'))

    return {
        'fuel_type': activity_type,
        'quantity': float(quantity),
        'unit': unit,
        'month': datetime.now(timezone.utc).month,
        'year': datetime.now(timezone.utc).year,
        'description': f'AI Chat: {activity_type} {quantity} {unit}',
    }
