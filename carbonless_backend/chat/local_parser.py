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
    elif s.count('.') > 1 or s.count(',') > 1:
        # "1.250.000" / "1,250,000": a repeated separator can only be grouping.
        s = s.replace('.', '').replace(',', '')
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


# ── Date detection ────────────────────────────────────────────────────────────

_MONTH_NAMES = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'sept': 9, 'september': 9, 'oct': 10,
    'october': 10, 'nov': 11, 'november': 11, 'dec': 12, 'december': 12,
}
_MONTH_NAME_PATTERN = '|'.join(_MONTH_NAMES.keys())


# Turkish month names. 'ekim' (also "sowing") and 'aralık' (also "interval")
# are ordinary words too, so they only count as a month next to a year, an
# apostrophe suffix ("Aralık'ta") or the word "ay" ("Ekim ayında").
_TR_MONTH_NAMES = {
    'ocak': 1, 'şubat': 2, 'subat': 2, 'mart': 3, 'nisan': 4, 'mayıs': 5, 'mayis': 5,
    'haziran': 6, 'temmuz': 7, 'ağustos': 8, 'agustos': 8, 'eylül': 9, 'eylul': 9,
    'ekim': 10, 'kasım': 11, 'kasim': 11, 'aralık': 12, 'aralik': 12,
}
_TR_AMBIGUOUS_MONTHS = {'ekim', 'aralık', 'aralik'}
_TR_MONTH_PATTERN = '|'.join(sorted(_TR_MONTH_NAMES, key=len, reverse=True))

# Relative months — "Geçen ay 12.000 kWh" used to be booked to the current month.
_LAST_MONTH_RE = re.compile(r'\b(?:last|previous|past)\s+month\b|\b(?:geçen|gecen|önceki|onceki)\s+ay\b')
_THIS_MONTH_RE = re.compile(r'\b(?:this|current)\s+month\b|\bbu\s+ay\b')


def _previous_month(now):
    return (12, now.year - 1) if now.month == 1 else (now.month - 1, now.year)


def _extract_date_from_text(text: str) -> tuple[int, int] | None:
    """Find a month(+year) mention in *text*: 'in June 2025', 'Mart 2025',
    'Ocak ayında', 'for 03/2024', '2025-06', 'last month' / 'geçen ay'.
    Returns None if no date phrase is found — callers should fall back to the
    current month rather than guess."""
    t = text.lower()
    now = datetime.now(timezone.utc)

    m = re.search(r'\b(\d{4})[-/](\d{1,2})\b', t)
    if m:
        year, month = int(m.group(1)), int(m.group(2))
        if 1 <= month <= 12:
            return month, year

    m = re.search(r'\b(\d{1,2})[-/](\d{4})\b', t)
    if m:
        month, year = int(m.group(1)), int(m.group(2))
        if 1 <= month <= 12:
            return month, year

    m = re.search(rf'\b({_MONTH_NAME_PATTERN})\b(?:\s*(\d{{4}}))?', t)
    if m:
        name, year_str = m.group(1), m.group(2)
        # "may" alone is too easily the modal verb ("we may add more data")
        # rather than the month — only trust it when a year makes the intent
        # unambiguous, e.g. "may 2025".
        if name == 'may' and not year_str:
            return None
        month = _MONTH_NAMES[name]
        year = int(year_str) if year_str else now.year
        return month, year

    m = re.search(
        rf"(?<![a-zçğıöşü])({_TR_MONTH_PATTERN})(?![a-zçğıöşü])"
        rf"(?P<apos>['’][a-zçğıöşü]*)?(?P<ay>\s+ay[a-zçğıöşü]*)?(?:\s*(?P<year>\d{{4}}))?",
        t,
    )
    if m:
        name = m.group(1)
        if name not in _TR_AMBIGUOUS_MONTHS or m.group('apos') or m.group('ay') or m.group('year'):
            year = int(m.group('year')) if m.group('year') else now.year
            return _TR_MONTH_NAMES[name], year

    if _LAST_MONTH_RE.search(t):
        return _previous_month(now)
    if _THIS_MONTH_RE.search(t):
        return now.month, now.year

    return None


# ── Main entry point ─────────────────────────────────────────────────────────

# A quantity is either a grouped number ("1.250,5", "15.000", "1,250.5") or a
# plain one ("1250,5", "300"). The grouped form comes first so "1.250,5 kWh"
# isn't read from its tail as 250,5.
_NUMBER = r'\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?'
_QUANTITY_RE = re.compile(r'(?<![\d.,])(?P<quantity>' + _NUMBER + r')\s*' + UNIT_PATTERN + r'\b', re.IGNORECASE)

# Where one item ends and the next begins: ; newline, "ve"/"and"/"ile"/"+"/"&",
# or a comma that isn't part of a number ("1250,5" keeps its decimal comma).
_ITEM_SPLIT_RE = re.compile(
    r';|\n|(?<!\d),|,(?!\d)|\s(?:ve|and|ile|artı|\+|&)\s',
    re.IGNORECASE,
)


def _entry(activity_type, quantity, unit, date):
    now = datetime.now(timezone.utc)
    return {
        'fuel_type': activity_type,
        'quantity': quantity,
        'unit': unit,
        'month': date[0] if date else now.month,
        'year': date[1] if date else now.year,
        'description': f'AI Chat: {activity_type} {quantity} {unit}',
        'date_extracted': date is not None,
    }


def _item_chunks(text: str) -> list[str]:
    """Split a message into one chunk per quantity. Separators come first;
    a chunk still holding several quantities ("5000 kWh elektrik 300 m3
    doğalgaz") is cut at each quantity, the leading text going to the first."""
    chunks = []
    for part in _ITEM_SPLIT_RE.split(text):
        part = (part or '').strip()
        if not part:
            continue
        matches = list(_QUANTITY_RE.finditer(part))
        if len(matches) <= 1:
            chunks.append(part)
            continue
        starts = [m.start() for m in matches] + [len(part)]
        for i in range(len(matches)):
            begin = 0 if i == 0 else starts[i]
            chunks.append(part[begin:starts[i + 1]].strip())
    return chunks


# "3 ton", "5 kişi", "20 adet": a number followed by a word, i.e. something the
# user meant as an amount even though no supported unit matched.
_LOOSE_AMOUNT_RE = re.compile(r'(?<![\d.,])(\d[\d.,]*)\s*([^\W\d_]{1,15})', re.UNICODE)
_NOT_AN_AMOUNT_WORDS = (
    set(_MONTH_NAMES) | set(_TR_MONTH_NAMES)
    | {'ay', 'ayı', 'ayında', 'yıl', 'yılı', 'yılında', 'year', 'month', 'th', 'st', 'nd', 'rd'}
)


def _loose_amounts(chunk: str) -> list[str]:
    found = []
    for m in _LOOSE_AMOUNT_RE.finditer(chunk):
        word = m.group(2).lower()
        if word in _NOT_AN_AMOUNT_WORDS or re.fullmatch(r'(19|20)\d\d', m.group(1)):
            continue
        found.append(m.group(0).strip())
    return found


def try_local_emission_parse_all(text: str) -> tuple[list[dict], list[str]]:
    """Parse every "quantity + unit + activity" item in one message.

    "Ocak'ta 5.000 kWh elektrik ve 300 m3 doğalgaz" used to keep only the
    electricity and silently drop the gas. Returns (entries, not_understood):
    the second list holds the quantity fragments no activity could be matched
    to, so the reply can say so instead of losing them.
    """
    if not text or looks_like_question(text):
        return [], []
    matches = list(_QUANTITY_RE.finditer(text))
    if not matches:
        return [], []
    chunks = _item_chunks(text)
    if len(matches) == 1:
        # One recognised quantity: the activity may be named anywhere in the
        # message ("Doğalgaz tüketimi, 300 m3"), so read it from all of it.
        entry = try_local_emission_parse(text)
        leftovers = [a for c in chunks if not _QUANTITY_RE.search(c) for a in _loose_amounts(c)]
        return ([entry] if entry else []), leftovers

    message_date = _extract_date_from_text(text)
    entries, not_understood = [], []
    for chunk in chunks:
        m = _QUANTITY_RE.search(chunk)
        if not m:
            not_understood.extend(_loose_amounts(chunk))
            continue
        activity_type = detect_activity_type(chunk)
        if not activity_type:
            not_understood.append(m.group(0).strip())
            continue
        entries.append(_entry(
            activity_type,
            parse_localized_number(m.group('quantity')),
            normalise_unit(m.group('unit')),
            _extract_date_from_text(chunk) or message_date,
        ))
    return entries, not_understood


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

    match = _QUANTITY_RE.search(text)
    if not match:
        return None

    activity_type = detect_activity_type(text)
    if not activity_type:
        return None

    quantity = parse_localized_number(match.group('quantity'))
    unit = normalise_unit(match.group('unit'))
    extracted_date = _extract_date_from_text(text)

    return {
        'fuel_type': activity_type,
        'quantity': quantity,
        'unit': unit,
        'month': extracted_date[0] if extracted_date else datetime.now(timezone.utc).month,
        'year': extracted_date[1] if extracted_date else datetime.now(timezone.utc).year,
        'description': f'AI Chat: {activity_type} {quantity} {unit}',
        'date_extracted': extracted_date is not None,
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
