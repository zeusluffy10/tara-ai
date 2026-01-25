# backend/services/tts_service.py
import os
from typing import Optional, Literal
import httpx
import random

TAGALOG_PREFIXES = [
    "",  # most natural: no prefix
    "Pagdating sa kanto, ",
    "Bandang unahan, ",
    "Sa susunod na kalsada, ",
    "Malapit na, ",
]

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

Style = Literal["calm", "warning"]

def _apply_natural_prefix(text: str) -> str:
    t = (text or "").strip()

    # Avoid double-prefixing
    lowered = t.lower()
    if lowered.startswith(("pagdating", "bandang", "sa susunod", "malapit")):
        return t

    prefix = random.choice(TAGALOG_PREFIXES)
    return f"{prefix}{t}" if prefix else t

def _normalize_lang(lang: Optional[str]) -> str:
    if not lang:
        return "fil"
    l = lang.lower().strip()
    if l in ("fil", "tl", "tagalog", "fil-ph", "tl-ph"):
        return "fil"
    if l.startswith("en"):
        return "en"
    return l

def _tagalog_tuning(text: str) -> str:
    """
    Simple pronunciation tuning for Tagalog.
    Keep it small; add more words as you encounter mispronunciations.
    """
    t = (text or "").strip()

    # syllable hints (work well with many neural TTS engines)
    t = t.replace("kumanan", "ku-ma-nan")
    t = t.replace("kumaliwa", "ku-ma-li-wa")
    t = t.replace("kaliwa", "ka-li-wa")
    t = t.replace("kanan", "ka-nan")
    t = t.replace("dumaan", "du-ma-an")
    t = t.replace("diretso", "di-ret-so")

    return t

def _apply_style(text: str, style: Style) -> str:
    t = (text or "").strip()

    # ✅ natural variation first
    t = _apply_natural_prefix(t)

    if style == "warning":
        return f"Babala. {t}!"

    return t
    

async def generate_tts_audio_bytes(
    text: str,
    voice: Optional[str] = "nova",
    model: str = "tts-1",
    lang: Optional[str] = "fil",          # ✅ ADD THIS
    style: Style = "calm",                # ✅ optional (safe default)
) -> bytes:
    """
    OpenAI TTS -> returns MP3 bytes.
    Note: OpenAI does not take 'lang' param, but we accept it for API compatibility.
    """
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured in environment")

    if not text or not str(text).strip():
        raise RuntimeError("TTS text is empty")

    lang = _normalize_lang(lang)

    final_text = text.strip()

    # ✅ apply Tagalog tuning if lang=fil
    if lang == "fil":
        final_text = _tagalog_tuning(final_text)

    # ✅ emotion style
    final_text = _apply_style(final_text, style)

    url = "https://api.openai.com/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    payload = {
        "model": model,
        "input": final_text,
        "voice": voice or "alloy",
    }

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
    return await generate_tts_audio_bytes(text=text, voice=voice, model=model, lang="fil", style="calm")
