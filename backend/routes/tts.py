# backend/routes/tts.py
import io
from typing import Optional, Literal

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse

from services.tts_service import generate_tts_audio_bytes
from utils.tagalog_nav import tagalog_rewrite  # ✅ your Tagalog rewrite

router = APIRouter()

Style = Literal["calm", "warning"]

def apply_style(text: str, style: str) -> str:
    """
    OpenAI TTS doesn't support a real 'style' parameter.
    So we influence prosody by wording (Tagalog) + punctuation.
    """
    t = text.strip()

    if style == "warning":
        # short + clear + urgent
        # (keeps it Tagalog; you can tweak)
        return f"Babala. {t}."
    # calm (default)
    return t

def normalize_voice(voice: Optional[str]) -> str:
    """
    Make 'female' and 'male' convenient aliases.
    Pick voices you prefer.
    """
    if not voice:
        return "nova"  # ✅ default female
    v = voice.strip().lower()
    if v in ["female", "girl", "woman"]:
        return "nova"
    if v in ["male", "man", "boy"]:
        return "alloy"
    return voice  # assume user passed a valid OpenAI voice name

@router.get("/tts")
async def tts(
    text: str = Query(...),
    lang: str = Query("fil"),                 # ✅ default Tagalog
    voice: Optional[str] = Query(None),       # ✅ default handled in normalize_voice()
    style: Style = Query("calm"),
):
    try:
        final_text = text

        # ✅ 1) Tagalog rewrite (remove Taglish, improve phrasing)
        if (lang or "").lower().startswith("fil"):
            final_text = tagalog_rewrite(final_text)

        # ✅ 2) Emotion / style shaping
        final_text = apply_style(final_text, style)

        # ✅ 3) Voice selection (female default)
        final_voice = normalize_voice(voice)

        audio_bytes = await generate_tts_audio_bytes(
            text=final_text,
            voice=final_voice,
        )

        if not audio_bytes:
            raise ValueError("TTS returned no audio")

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-store",
                "Accept-Ranges": "bytes",
                "Content-Disposition": "inline; filename=tts.mp3",
            },
        )

    except Exception as e:
        print("TTS ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))
