# backend/routes/tts.py
import hashlib
import os
from typing import Optional, Literal

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse

from services.tts_service import generate_tts_audio_bytes
from utils.tts_format import prepare_tts_text, normalize_voice

router = APIRouter()

Style = Literal["calm", "warning"]
MAX_TEXT_LENGTH = 500
TTS_CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache", "tts")
os.makedirs(TTS_CACHE_DIR, exist_ok=True)


def _tts_cache_key(text: str, lang: str, voice: str) -> str:
    """Build a stable cache key for deterministic TTS inputs."""
    joined = f"{lang}|{voice}|{text}"
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def _tts_cache_path(cache_key: str) -> str:
    """Resolve the on-disk cache file path for a key."""
    return os.path.join(TTS_CACHE_DIR, f"{cache_key}.mp3")

@router.get("/tts")
async def tts(
    text: str = Query(...),
    lang: str = Query("fil"),                 # ✅ default Tagalog
    voice: Optional[str] = Query(None),       # ✅ default handled in normalize_voice()
    gender: Optional[str] = Query(None),
    style: Style = Query("calm"),
    pause_ms: Optional[int] = Query(None),
    emphasis: Optional[str] = Query(None),
):
    try:
        stripped_text = text.strip()
        if not stripped_text:
            raise HTTPException(status_code=400, detail="text is required")
        if len(stripped_text) > MAX_TEXT_LENGTH:
            raise HTTPException(status_code=400, detail=f"text too long (max {MAX_TEXT_LENGTH} chars)")

        final_text, _, _ = prepare_tts_text(
            text=stripped_text,
            lang=lang,
            style=style,
            pause_ms=pause_ms,
            emphasis=emphasis,
        )
        final_voice = normalize_voice(voice, gender)
        cache_key = _tts_cache_key(final_text, lang, final_voice)
        cache_path = _tts_cache_path(cache_key)

        if os.path.exists(cache_path):
            return FileResponse(
                cache_path,
                media_type="audio/mpeg",
                filename="tts.mp3",
                headers={
                    "Cache-Control": "private, max-age=86400",
                    "ETag": cache_key,
                    "Accept-Ranges": "bytes",
                    "Content-Disposition": "inline; filename=tts.mp3",
                    "X-TTS-Cache": "HIT",
                },
            )

        audio_bytes = await generate_tts_audio_bytes(
            text=final_text,
            voice=final_voice,
        )

        if not audio_bytes:
            raise ValueError("TTS returned no audio")

        tmp_path = f"{cache_path}.tmp"
        with open(tmp_path, "wb") as f:
            f.write(audio_bytes)
        os.replace(tmp_path, cache_path)

        return FileResponse(
            cache_path,
            media_type="audio/mpeg",
            filename="tts.mp3",
            headers={
                "Cache-Control": "private, max-age=86400",
                "ETag": cache_key,
                "Accept-Ranges": "bytes",
                "Content-Disposition": "inline; filename=tts.mp3",
                "X-TTS-Cache": "MISS",
            },
        )

    except Exception as e:
        print("TTS ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))
