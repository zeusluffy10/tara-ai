# backend/routes/tts.py
import io
from typing import Optional, Literal

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse

from services.tts_service import generate_tts_audio_bytes
from utils.tts_format import prepare_tts_text, normalize_voice

router = APIRouter()

Style = Literal["calm", "warning"]

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
        final_text, _, _ = prepare_tts_text(
            text=text,
            lang=lang,
            style=style,
            pause_ms=pause_ms,
            emphasis=emphasis,
        )
        final_voice = normalize_voice(voice, gender)

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
