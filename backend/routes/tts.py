import io
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from services.tts_service import generate_tts_audio

router = APIRouter()

@router.get("/tts")
def tts(text: str = Query(...)):
    audio_bytes = generate_tts_audio(text)

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-store",
            "Accept-Ranges": "bytes"
        }
    )
