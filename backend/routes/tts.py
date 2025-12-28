import io
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from services.tts_service import generate_tts_audio

router = APIRouter()

@router.get("/tts")
def tts(text: str = Query(...)):
    try:
        audio_bytes = generate_tts_audio(text)

        if not audio_bytes:
            raise ValueError("TTS returned no audio")

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-store",
                "Accept-Ranges": "bytes",
                "Content-Disposition": "inline; filename=tts.mp3"
            }
        )

    except Exception as e:
        print("TTS ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))
