"""
NLU Extractor — uses Groq to parse free-text emission descriptions into
structured JSON for the calculation engine.
"""

import json
import logging
import os
import re

import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

NLU_SYSTEM_PROMPT = """You are a carbon-footprint NLU parser. Your ONLY job is to return a single valid JSON object — no markdown, no prose, no code fences, just raw JSON.

Extract emission-related intent from the user message and return exactly this structure:

{
  "mode": "calculation | general_question | unknown",
  "activity_family": "stationary_fuel | vehicle_distance | electricity | purchased_energy | waste | flight | freight | commuting | water | purchased_goods | refrigerant | null",
  "scope_hint": "1 | 2 | 3 | null",
  "activity_type": "<string or null>",
  "quantity": <number or null>,
  "unit": "<string or null>",
  "fuel_type": "<string or null>",
  "vehicle_type": "<string or null>",
  "vehicle_count": <integer or null>,
  "distance_basis": "per_vehicle | fleet_total | null",
  "waste_method": "<string or null>",
  "transport_mode": "<string or null>",
  "flight_type": "domestic | short_haul | long_haul | international | null",
  "commute_mode": "<string or null>",
  "water_type": "potable | wastewater | null",
  "material_type": "<string or null>",
  "refrigerant_type": "<string or null>",
  "missing_required": [],
  "ambiguous_fields": [],
  "confidence": <0.0–1.0>
}

Rules:
- mode = "calculation" when the user wants to calculate or log an emission.
- mode = "general_question" when the user is asking a conceptual question about carbon/emissions.
- mode = "unknown" when intent is unclear.
- missing_required lists field names that are needed for calculation but absent from the message.
- ambiguous_fields lists field names whose values are unclear or could be interpreted multiple ways.
- confidence reflects how certain you are about the extraction (0 = no idea, 1 = perfectly clear).

Examples:

User: "I drove 120 km in my petrol car"
{"mode":"calculation","activity_family":"vehicle_distance","scope_hint":"1","activity_type":"passenger_vehicle","quantity":120,"unit":"km","fuel_type":"petrol","vehicle_type":"car","vehicle_count":null,"distance_basis":"per_vehicle","waste_method":null,"transport_mode":null,"flight_type":null,"commute_mode":null,"water_type":null,"material_type":null,"refrigerant_type":null,"missing_required":[],"ambiguous_fields":[],"confidence":0.95}

User: "We used 5000 kWh of electricity last month"
{"mode":"calculation","activity_family":"electricity","scope_hint":"2","activity_type":"grid_electricity","quantity":5000,"unit":"kWh","fuel_type":null,"vehicle_type":null,"vehicle_count":null,"distance_basis":null,"waste_method":null,"transport_mode":null,"flight_type":null,"commute_mode":null,"water_type":null,"material_type":null,"refrigerant_type":null,"missing_required":[],"ambiguous_fields":[],"confidence":0.97}

User: "We sent 2 tonnes of general waste to landfill"
{"mode":"calculation","activity_family":"waste","scope_hint":"3","activity_type":"waste_disposal","quantity":2,"unit":"tonnes","fuel_type":null,"vehicle_type":null,"vehicle_count":null,"distance_basis":null,"waste_method":"landfill","transport_mode":null,"flight_type":null,"commute_mode":null,"water_type":null,"material_type":null,"refrigerant_type":null,"missing_required":[],"ambiguous_fields":[],"confidence":0.93}

User: "What is Scope 2 emissions?"
{"mode":"general_question","activity_family":null,"scope_hint":null,"activity_type":null,"quantity":null,"unit":null,"fuel_type":null,"vehicle_type":null,"vehicle_count":null,"distance_basis":null,"waste_method":null,"transport_mode":null,"flight_type":null,"commute_mode":null,"water_type":null,"material_type":null,"refrigerant_type":null,"missing_required":[],"ambiguous_fields":[],"confidence":0.99}
"""

# ---------------------------------------------------------------------------
# Default NLU result template
# ---------------------------------------------------------------------------

DEFAULT_NLU = {
    "mode": "unknown",
    "activity_family": None,
    "scope_hint": None,
    "activity_type": None,
    "quantity": None,
    "unit": None,
    "fuel_type": None,
    "vehicle_type": None,
    "vehicle_count": None,
    "distance_basis": None,
    "waste_method": None,
    "transport_mode": None,
    "flight_type": None,
    "commute_mode": None,
    "water_type": None,
    "material_type": None,
    "refrigerant_type": None,
    "missing_required": [],
    "ambiguous_fields": [],
    "confidence": 0.0,
    "_source": "default",
}

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _clean_json_text(text: str) -> str:
    """Strip markdown code fences and surrounding whitespace."""
    # Remove ```json ... ``` or ``` ... ``` fences
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text.strip())
    return text.strip()


def _safe_json_loads(text: str) -> dict | None:
    """Parse JSON, returning None on failure instead of raising."""
    try:
        cleaned = _clean_json_text(text)
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.debug("JSON parse failed: %s | raw text: %.200s", exc, text)
        return None


def _merge_with_default(parsed: dict) -> dict:
    """Fill any missing keys from DEFAULT_NLU, preserving parsed values."""
    result = dict(DEFAULT_NLU)
    result.update(parsed)
    # Ensure list fields are lists
    for field in ("missing_required", "ambiguous_fields"):
        if not isinstance(result.get(field), list):
            result[field] = []
    return result


def _post_groq(
    api_key: str,
    model: str,
    messages: list,
    max_tokens: int,
    use_json_mode: bool,
) -> requests.Response:
    """Send a chat-completion request to Groq."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: dict = {
        "model": model,
        "messages": messages,
        "temperature": 0,
        "max_tokens": max_tokens,
    }
    if use_json_mode:
        payload["response_format"] = {"type": "json_object"}

    return requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers=headers,
        json=payload,
        timeout=30,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_emission_intent(user_text: str) -> dict:
    """
    Call Groq to extract structured emission intent from *user_text*.

    Returns a dict matching DEFAULT_NLU structure, with an added ``_source``
    field indicating how the result was produced:
      - "groq_json_mode"   — successful call with response_format=json_object
      - "groq_text_mode"   — successful call without response_format
      - "groq_parse_error" — Groq responded but JSON could not be parsed
      - "rate_limited"     — Groq returned 429
      - "error"            — any other failure
      - "default"          — no API key configured
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.warning("GROQ_API_KEY not set; returning default NLU result.")
        result = dict(DEFAULT_NLU)
        result["_source"] = "default"
        return result

    model = os.getenv("GROQ_NLU_MODEL", "llama-3.1-8b-instant").strip()
    max_tokens = int(os.getenv("GROQ_NLU_MAX_TOKENS", "450"))
    use_json_mode = os.getenv("GROQ_NLU_JSON_MODE", "true").strip().lower() not in (
        "false", "0", "no",
    )

    messages = [
        {"role": "system", "content": NLU_SYSTEM_PROMPT},
        {"role": "user", "content": user_text},
    ]

    # --- First attempt (with json_object mode if enabled) ---
    try:
        resp = _post_groq(api_key, model, messages, max_tokens, use_json_mode)

        if resp.status_code == 429:
            logger.warning("Groq rate limit hit (429). Returning default NLU.")
            result = dict(DEFAULT_NLU)
            result["_source"] = "rate_limited"
            return result

        if resp.status_code == 400 and use_json_mode:
            # Some model/payload combinations reject json_object mode — retry without it
            logger.debug("Groq returned 400 with json_mode=True; retrying without.")
            resp = _post_groq(api_key, model, messages, max_tokens, False)

        if resp.status_code != 200:
            logger.error(
                "Groq API error %s: %.300s", resp.status_code, resp.text
            )
            result = dict(DEFAULT_NLU)
            result["_source"] = "error"
            return result

        data = resp.json()
        raw_content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        parsed = _safe_json_loads(raw_content)
        if parsed is None:
            logger.warning(
                "Could not parse Groq JSON response. Raw: %.300s", raw_content
            )
            result = _merge_with_default({})
            result["_source"] = "groq_parse_error"
            return result

        source = "groq_json_mode" if use_json_mode else "groq_text_mode"
        merged = _merge_with_default(parsed)
        merged["_source"] = source
        return merged

    except requests.Timeout:
        logger.error("Groq request timed out.")
        result = dict(DEFAULT_NLU)
        result["_source"] = "error"
        return result
    except requests.RequestException as exc:
        logger.error("Groq request failed: %s", exc)
        result = dict(DEFAULT_NLU)
        result["_source"] = "error"
        return result
