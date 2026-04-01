# backend/services/tts_service.py
import os
from typing import Optional
import httpx

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
_TTS_HTTP_CLIENT: Optional[httpx.AsyncClient] = None


def _get_tts_http_client() -> httpx.AsyncClient:
    """Return a shared AsyncClient to reuse TCP/TLS connections for faster TTS calls."""
    global _TTS_HTTP_CLIENT
    if _TTS_HTTP_CLIENT is None:
        _TTS_HTTP_CLIENT = httpx.AsyncClient(
            timeout=60.0,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
            headers={"Connection": "keep-alive"},
        )
    return _TTS_HTTP_CLIENT

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

    client = _get_tts_http_client()
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
