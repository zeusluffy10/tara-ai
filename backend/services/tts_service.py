# backend/services/tts_service.py
import os
from typing import Optional
import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    # keep import-time silent; raise later when used so tests / linting don't break
    pass


async def generate_tts_audio_bytes(text: str, voice: Optional[str] = "alloy", model: str = "tts-1") -> bytes:
    """
    Primary async TTS function: calls OpenAI audio/speech and returns raw bytes (audio/mpeg).
    - text: text to synthesize
    - voice: optional voice id
    - model: TTS model name (default tts-1)
    Raises an Exception on non-200 response.
    """
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured in environment")

    url = "https://api.openai.com/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {"model": model, "input": text}
    if voice:
        payload["voice"] = voice

    # generous timeout for TTS (in seconds)
    timeout_seconds = 120.0

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        resp = await client.post(url, headers=headers, json=payload)

    if resp.status_code != 200:
        # try to provide helpful diagnostic info
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise Exception(f"OpenAI TTS error: HTTP {resp.status_code} - {detail}")

    return resp.content


# Backwards-compatible alias: some routes import generate_tts_audio
async def generate_tts_audio(text: str, voice: Optional[str] = "alloy", model: str = "tts-1") -> bytes:
    """
    Backwards-compatible wrapper for older imports.
    Calls generate_tts_audio_bytes and returns the same bytes.
    """
    return await generate_tts_audio_bytes(text=text, voice=voice, model=model)
