# backend/services/tts_service.py
import os
from typing import Optional
import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Optional default voice mapping (you can tweak this later)
DEFAULT_VOICE_BY_LANG = {
    "fil": "alloy",  # Tagalog (best effort; OpenAI TTS voices are multilingual)
    "en": "alloy",
}

DEFAULT_MODEL_BY_LANG = {
    "fil": "tts-1",  # or "tts-1-hd" if you want better quality (higher cost)
    "en": "tts-1",
}


def _normalize_lang(lang: Optional[str]) -> str:
    if not lang:
        return "fil"
    l = lang.lower().strip()
    # accept common variants
    if l in ("fil", "tl", "tagalog", "fil-ph", "tl-ph"):
        return "fil"
    if l.startswith("en"):
        return "en"
    return l


async def generate_tts_audio_bytes(
    text: str,
    voice: Optional[str] = None,
    model: Optional[str] = None,
    lang: str = "fil",
) -> bytes:
    """
    Calls OpenAI audio/speech and returns raw MP3 bytes.

    Parameters:
    - text: string to speak
    - voice: optional OpenAI voice id (ex: alloy, verse, etc.). If None, auto-picks by lang.
    - model: optional model (tts-1 or tts-1-hd). If None, auto-picks by lang.
    - lang: "fil" recommended for Tagalog. (OpenAI API doesn't take 'language' directly,
            but we keep it for app-level control & defaults.)
    """
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured in environment")

    if not text or not str(text).strip():
        raise RuntimeError("TTS text is empty")

    lang = _normalize_lang(lang)

    chosen_voice = voice or DEFAULT_VOICE_BY_LANG.get(lang, "alloy")
    chosen_model = model or DEFAULT_MODEL_BY_LANG.get(lang, "tts-1")

    url = "https://api.openai.com/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    # OpenAI expects: { model, input, voice?, format? }
    payload = {
        "model": chosen_model,
        "input": text,
        "voice": chosen_voice,
        # (Optional) You can force format if you want, but Accept header is enough
        # "format": "mp3",
    }

    timeout_seconds = 120.0

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        resp = await client.post(url, headers=headers, json=payload)

    if resp.status_code != 200:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise Exception(
            f"OpenAI TTS error: HTTP {resp.status_code} - {detail}"
        )

    return resp.content


# Backwards-compatible alias: some routes import generate_tts_audio
async def generate_tts_audio(
    text: str,
    voice: Optional[str] = "alloy",
    model: str = "tts-1",
) -> bytes:
    """
    Backwards-compatible wrapper for older imports.
    """
    return await generate_tts_audio_bytes(text=text, voice=voice, model=model, lang="fil")
