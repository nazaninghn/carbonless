"""
CarbonIQ AI Chat — Grok (xAI) integration
Proxies frontend chat messages to Grok and returns contextual responses.
API key: set GROK_API_KEY env var on Render.
"""

import os
import json
import urllib.request
import urllib.error
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

GROK_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROK_MODEL   = "llama-3.1-8b-instant"   # Groq free tier — very fast
TIMEOUT_SEC  = 8

SYSTEM_PROMPT_EN = """You are CarbonIQ, an expert GHG inventory assistant built into Carbonless, an ISO 14064-1 carbon accounting platform.

The user is filling out a step-by-step GHG inventory questionnaire. After each answer, give a brief, expert, warm response (max 2–3 sentences / 60 words):
1. Acknowledge their specific answer naturally
2. Add one relevant insight, context, or tip about what it means for their carbon inventory
3. Be encouraging and professional

Rules:
- Do NOT ask questions (the questionnaire handles that)
- Be specific to their actual answer — never generic
- Use GHG / carbon accounting terminology naturally
- Keep it concise"""

SYSTEM_PROMPT_TR = """Sen CarbonIQ'sun — Carbonless'in ISO 14064-1 uyumlu karbon muhasebesi platformuna entegre edilmiş uzman bir sera gazı envanteri asistanısın.

Kullanıcı adım adım bir sera gazı envanteri anketi dolduruyor. Her cevabın ardından kısa, uzman ve samimi bir yanıt ver (en fazla 2–3 cümle / 60 kelime):
1. Kullanıcının spesifik cevabını doğal biçimde kabul et
2. Bu cevabın karbon envanteri açısından ne anlama geldiğine dair tek bir ilgili bilgi, bağlam veya ipucu ekle
3. Teşvik edici ve profesyonel ol

Kurallar:
- Soru sorma (anketi soru sorma kısmını yönetiyor)
- Kullanıcının gerçek cevabına özel ol — asla genel kalma
- GHG / karbon muhasebesi terminolojisini doğal kullan
- Kısa tut"""


def _call_grok(api_key: str, system_prompt: str, user_message: str) -> str | None:
    """Call Grok API using only stdlib (no third-party requests lib needed)."""
    payload = json.dumps({
        "model": GROK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        "max_tokens": 130,
        "temperature": 0.7,
    }).encode("utf-8")

    req = urllib.request.Request(
        GROK_API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"].strip()
    except (urllib.error.URLError, KeyError, json.JSONDecodeError):
        return None


class AIChatView(APIView):
    """
    POST /api/questionnaire/ai/chat/
    Body: {
        question_id:   str,
        question_text: str,
        user_answer:   str,       # human-readable display value
        language:      "en"|"tr",
        company_name:  str,       # optional context
        reporting_year: str,      # optional context
    }
    Response: { message: str|null, source: "grok"|"fallback" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if not api_key:
            # No key configured — frontend will use static messages
            return JsonResponse({"message": None, "source": "fallback"})

        data        = request.data
        lang        = data.get("language", "en")
        question    = data.get("question_text", "")
        answer      = data.get("user_answer", "")
        company     = data.get("company_name", "")
        year        = data.get("reporting_year", "")

        # Build context string
        context_parts = []
        if company:
            context_parts.append(f"Company: {company}")
        if year:
            context_parts.append(f"Reporting year: {year}")

        context_line = " | ".join(context_parts)
        user_message = (
            f"{context_line}\n" if context_line else ""
        ) + f"Question: {question}\nUser's answer: {answer}"

        system_prompt = SYSTEM_PROMPT_TR if lang == "tr" else SYSTEM_PROMPT_EN
        ai_message    = _call_grok(api_key, system_prompt, user_message)

        if ai_message:
            return JsonResponse({"message": ai_message, "source": "grok"})
        return JsonResponse({"message": None, "source": "fallback"})
