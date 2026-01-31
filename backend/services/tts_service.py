# backend/services/tts_service.py
import os
from typing import Optional
import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

async def generate_tts_audio_bytes(
    text: str,
    voice: Optional[str] = "alloy",
    model: str = "tts-1",
) -> bytes:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured in environment")

    url = "https://api.openai.com/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {
        "model": model,
        "input": text,
        "voice": voice or "alloy",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, headers=headers, json=payload)

    if resp.status_code != 200:
        try:
            detail = resp.json()
        except Exception:
            detail = resp.text
        raise Exception(f"OpenAI TTS error: HTTP {resp.status_code} - {detail}")

    return resp.content

# Backwards compatible alias
async def generate_tts_audio(text: str, voice: Optional[str] = "alloy", model: str = "tts-1") -> bytes:
    return await generate_tts_audio_bytes(text=text, voice=voice, model=model)
