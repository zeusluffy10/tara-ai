# backend/services/tts_service.py
import os
from typing import Optional, Literal
import httpx

from services.tagalog_pronounce import normalize_tagalog

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

Style = Literal["calm", "warning"]

async def generate_tts_audio_bytes(
    text: str,
    voice: Optional[str] = "alloy",
    model: str = "tts-1",
    style: Style = "calm",
) -> bytes:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured in environment")

    # ✅ Tagalog tuning + emotion pacing
    tuned = normalize_tagalog(text, style=style)

    url = "https://api.openai.com/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {"model": model, "input": tuned}
    if voice:
        payload["voice"] = voice

    timeout_seconds = 120.0
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        resp = await client.post(url, headers=headers, json=payload)

    if resp.status_code != 200:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise Exception(f"OpenAI TTS error: HTTP {resp.status_code} - {detail}")

    return resp.content


# Backwards-compatible alias
async def generate_tts_audio(text: str, voice: Optional[str] = "alloy", model: str = "tts-1") -> bytes:
    return await generate_tts_audio_bytes(text=text, voice=voice, model=model, style="calm")
