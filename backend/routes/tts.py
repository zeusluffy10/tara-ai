from pydantic import BaseModel
from fastapi import APIRouter, Query
from fastapi.responses import Response
from services.tts_service import generate_tts_audio

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice: str = "alloy"


@router.get("/tts")
def tts(text: str = Query(...)):
    audio_bytes = generate_tts_audio(text)

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-store",
            "Accept-Ranges": "bytes"
        }
    )
