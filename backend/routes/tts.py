from fastapi import APIRouter, Response
from pydantic import BaseModel
from services.tts_service import generate_tts_audio

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice: str = "alloy"

@router.post("/tts", response_class=Response)
async def tts_endpoint(body: TTSRequest):
    audio_mp3 = await generate_tts_audio(body.text, body.voice)
    return Response(content=audio_mp3, media_type="audio/mpeg")
