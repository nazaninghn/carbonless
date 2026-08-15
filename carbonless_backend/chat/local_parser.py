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


_THOUSANDS_GROUP_RE = re.compile(r'^\d{1,3}[.,]\d{3}$')


def parse_localized_number(raw: str) -> float:
    """Parse a user-typed quantity that may use either '.' or ',' as the
    thousands/decimal separator, without guessing wrong on the extremely
    common "15.000" (Turkish: fifteen thousand) / "15,000" (English:
    fifteen thousand) case.

    Before this, every call site here did a blind `.replace(',', '.')`,
    which silently turned "15.000 kWh" into 15.0 kWh — a 1000x
    understatement with no error, since the string is still valid float
    syntax. Verified live: try_local_emission_parse('15.000 kWh ...')
    returned quantity=15.0 pre-fix.
    """
    s = raw.strip()
    if ',' in s and '.' in s:
        # Both present — whichever comes last is the real decimal point;
        # the earlier one(s) are thousands grouping. Handles "1.234.567,89"
        # (Turkish) and "1,234,567.89" (English) alike.
        if s.rfind(',') > s.rfind('.'):
            s = s.replace('.', '').replace(',', '.')
        else:
            s = s.replace(',', '')
    elif _THOUSANDS_GROUP_RE.match(s):
        # A single separator followed by exactly 3 digits and nothing else
        # — "15.000" or "15,000" — is thousands grouping in both
        # conventions; a genuine decimal quantity essentially never has
        # exactly 3 trailing digits in casual chat input.
        s = s.replace('.', '').replace(',', '')
    else:
        s = s.replace(',', '.')
    return float(s)


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

    quantity = parse_localized_number(match.group('quantity'))
    unit = normalise_unit(match.group('unit'))

    return {
        'fuel_type': activity_type,
        'quantity': quantity,
        'unit': unit,
        'month': datetime.now(timezone.utc).month,
        'year': datetime.now(timezone.utc).year,
        'description': f'AI Chat: {activity_type} {quantity} {unit}',
    }


def try_guided_draft_parse(text: str) -> dict | None:
    """
    Detect incomplete but useful activity data that needs one more detail.
    Example: "i have 3 trucks and use them 450000 km" → needs fuel type.
    """
    if not text:
        return None

    t = text.lower()

    # ── Truck: needs fuel type ────────────────────────────────────────────
    has_truck = any(word in t for word in [
        'truck', 'trucks', 'trunk', 'trunks', 'kamyon', 'کامیون',
    ])

    km_match = re.search(r'(?P<quantity>\d+(?:[.,]\d+)?)\s*km\b', t)

    if has_truck and km_match:
        quantity = parse_localized_number(km_match.group('quantity'))

        # If fuel is already mentioned, the normal parser should handle it
        has_fuel = any(fuel in t for fuel in [
            'diesel', 'petrol', 'gasoline', 'benzin', 'lpg', 'natural gas',
        ])

        if not has_fuel:
            return {
                'flow': 'truck_distance',
                'vehicle_type': 'truck',
                'quantity': quantity,
                'unit': 'km',
                'missing': ['fuel_type'],
                'description': f'Truck travel {quantity:g} km',
            }

    # ── Flight: needs haul type ───────────────────────────────────────────
    has_flight = any(word in t for word in ['flight', 'fly', 'flew', 'uçuş', 'پرواز'])
    if has_flight and km_match:
        quantity = parse_localized_number(km_match.group('quantity'))
        has_haul = any(h in t for h in ['domestic', 'short', 'medium', 'long', 'iç hat', 'kısa', 'orta', 'uzun'])
        if not has_haul:
            return {
                'flow': 'flight_distance',
                'vehicle_type': 'flight',
                'quantity': quantity,
                'unit': 'km',
                'missing': ['haul_type'],
                'description': f'Flight {quantity:g} km',
            }

    # ── Freight: needs mode ───────────────────────────────────────────────
    has_freight = any(word in t for word in ['freight', 'cargo', 'shipment', 'yük', 'حمل'])
    tkm_match = re.search(r'(?P<quantity>\d+(?:[.,]\d+)?)\s*(?:tonne-km|tkm)\b', t)
    if has_freight and tkm_match:
        quantity = parse_localized_number(tkm_match.group('quantity'))
        has_mode = any(m in t for m in ['truck', 'rail', 'sea', 'air', 'road', 'ocean', 'ship', 'train'])
        if not has_mode:
            return {
                'flow': 'freight_mode',
                'vehicle_type': 'freight',
                'quantity': quantity,
                'unit': 'tonne-km',
                'missing': ['transport_mode'],
                'description': f'Freight {quantity:g} tonne-km',
            }

    # ── Waste: needs disposal method ──────────────────────────────────────
    has_waste = any(word in t for word in ['waste', 'atık', 'زباله', 'پسماند'])
    kg_match = re.search(r'(?P<quantity>\d+(?:[.,]\d+)?)\s*kg\b', t)
    if has_waste and kg_match:
        quantity = parse_localized_number(kg_match.group('quantity'))
        has_method = any(m in t for m in ['landfill', 'recycle', 'recyclable', 'compost', 'incineration', 'organic'])
        if not has_method:
            return {
                'flow': 'waste_method',
                'vehicle_type': 'waste',
                'quantity': quantity,
                'unit': 'kg',
                'missing': ['disposal_method'],
                'description': f'Waste {quantity:g} kg',
            }

    # ── Commuting: needs transport mode ───────────────────────────────────
    has_commute = any(word in t for word in ['commut', 'commute', 'commuting', 'işe gidiş', 'رفت‌وآمد'])
    if has_commute and km_match:
        quantity = parse_localized_number(km_match.group('quantity'))
        has_mode = any(m in t for m in ['car', 'bus', 'train', 'araba', 'otobüs', 'tren'])
        if not has_mode:
            return {
                'flow': 'commute_mode',
                'vehicle_type': 'commute',
                'quantity': quantity,
                'unit': 'km',
                'missing': ['transport_mode'],
                'description': f'Commuting {quantity:g} km',
            }

    # ── Water: needs type ─────────────────────────────────────────────────
    has_water = any(word in t for word in ['water', 'su', 'آب'])
    m3_match = re.search(r'(?P<quantity>\d+(?:[.,]\d+)?)\s*(?:m3|m³)\b', t)
    if has_water and m3_match:
        quantity = parse_localized_number(m3_match.group('quantity'))
        has_type = any(tp in t for tp in ['supply', 'treatment', 'wastewater', 'atıksu', 'arıtma', 'تصفیه'])
        if not has_type:
            return {
                'flow': 'water_type',
                'vehicle_type': 'water',
                'quantity': quantity,
                'unit': 'm3',
                'missing': ['water_type'],
                'description': f'Water {quantity:g} m3',
            }

    # ── Private car / vehicle: needs fuel type ────────────────────────────
    has_car = any(word in t for word in [
        'private car', 'car', 'cars', 'vehicle', 'vehicles', 'automobile',
        'ماشین', 'خودرو', 'اتومبیل', 'araba', 'araç',
    ])
    if has_car and km_match:
        quantity = parse_localized_number(km_match.group('quantity'))
        has_fuel = any(fuel in t for fuel in [
            'diesel', 'petrol', 'gasoline', 'benzin', 'lpg', 'natural gas', 'electric', 'hybrid',
        ])
        if not has_fuel:
            # Try to extract vehicle count
            count_match = re.search(r'(\d+)\s*(?:private\s*)?(?:car|cars|vehicle|vehicles)', t)
            vehicle_count = int(count_match.group(1)) if count_match else None
            return {
                'flow': 'private_car_distance',
                'vehicle_type': 'private_car',
                'vehicle_count': vehicle_count,
                'quantity': quantity,
                'unit': 'km',
                'missing': ['fuel_type'],
                'description': f'Private car travel {quantity:g} km',
            }

    return None
