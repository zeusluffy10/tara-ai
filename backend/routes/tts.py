# backend/routes/tts.py (or wherever your GET /tts is)
import io
from typing import Optional, Literal
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from services.tts_service import generate_tts_audio_bytes

router = APIRouter()

Style = Literal["calm", "warning"]

@router.get("/tts")
async def tts(
    text: str = Query(...),
    voice: Optional[str] = Query("alloy"),
    style: Style = Query("calm"),
):
    try:
        audio_bytes = await generate_tts_audio_bytes(text=text, voice=voice, style=style)
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
