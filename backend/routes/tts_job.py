# backend/routes/tts_job.py
import os
import uuid
import json
import io
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel

from services.tts_service import generate_tts_audio_bytes  # async

router = APIRouter(prefix="")

# jobs directory (relative to backend)
JOBS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "jobs")
os.makedirs(JOBS_DIR, exist_ok=True)


class TTSCreate(BaseModel):
    text: str
    voice: Optional[str] = None


def _meta_path(job_id: str):
    return os.path.join(JOBS_DIR, f"{job_id}.meta.json")


def _audio_path(job_id: str):
    return os.path.join(JOBS_DIR, f"{job_id}.mp3")


def _write_meta(job_id: str, meta: dict):
    with open(_meta_path(job_id), "w", encoding="utf-8") as f:
        json.dump(meta, f)


def _read_meta(job_id: str):
    p = _meta_path(job_id)
    if not os.path.exists(p):
        return None
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


async def _process_job(job_id: str, text: str, voice: Optional[str]):
    """
    Background worker function that calls TTS service and writes files.
    """
    meta = {"job_id": job_id, "status": "processing", "voice": voice}
    _write_meta(job_id, meta)
    try:
        audio_bytes = await generate_tts_audio_bytes(text, voice)
        if not audio_bytes:
            raise ValueError("TTS returned no audio bytes")

        audio_path = _audio_path(job_id)
        with open(audio_path, "wb") as fa:
            fa.write(audio_bytes)

        meta.update({"status": "done", "size": os.path.getsize(audio_path)})
        _write_meta(job_id, meta)
    except Exception as e:
        meta.update({"status": "error", "error": str(e)})
        _write_meta(job_id, meta)


# ============================================================
# ✅ NEW: GET /tts for Safari + Expo playback (IMPORTANT)
# ============================================================
@router.get("/tts")
async def tts_stream(
    text: str = Query(..., description="Text to speak"),
    voice: Optional[str] = Query(None, description="Optional voice id/name"),
):
    """
    Direct streaming TTS endpoint:
    - iPhone Safari audio tag works
    - expo-av Audio.Sound.createAsync({uri}) works
    """
    t = (text or "").strip()
    if not t:
        raise HTTPException(status_code=400, detail="text is required")

    try:
        audio_bytes = await generate_tts_audio_bytes(t, voice)
        if not audio_bytes:
            raise ValueError("TTS returned no audio bytes")

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={
                # iOS Safari friendliness
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-store",
                "Content-Disposition": "inline; filename=tts.mp3",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {e}")


# ============================================================
# ✅ Existing Job API (keep it)
# ============================================================
@router.post("/tts", status_code=202)
async def create_tts_job(payload: TTSCreate, background_tasks: BackgroundTasks):
    """
    Start a TTS job and return job id immediately.
    (Used for your async job workflow.)
    """
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    job_id = uuid.uuid4().hex
    meta = {"job_id": job_id, "status": "queued", "voice": payload.voice}
    _write_meta(job_id, meta)

    # schedule background work (does not block response)
    background_tasks.add_task(_process_job, job_id, text, payload.voice)

    return JSONResponse(status_code=202, content={"job_id": job_id, "status": "queued"})


@router.get("/tts/status/{job_id}")
def get_tts_status(job_id: str):
    meta = _read_meta(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="job not found")
    return meta


@router.get("/tts/result/{job_id}")
def get_tts_result(job_id: str):
    meta = _read_meta(job_id)
    if not meta:
        raise HTTPException(status_code=404, detail="job not found")
    if meta.get("status") != "done":
        return JSONResponse(status_code=202, content=meta)  # still processing

    audio_path = _audio_path(job_id)
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="audio missing")

    return FileResponse(
        audio_path,
        media_type="audio/mpeg",
        filename=f"{job_id}.mp3",
    )
