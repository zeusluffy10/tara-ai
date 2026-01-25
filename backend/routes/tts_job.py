# backend/routes/tts_job.py
import os
import uuid
import json
import io
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from services.tts_service import generate_tts_audio_bytes
from utils.tagalog_nav import tagalog_rewrite  # ✅ new

router = APIRouter(prefix="")

# jobs directory (relative to backend)
JOBS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "jobs")
os.makedirs(JOBS_DIR, exist_ok=True)


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


# ✅ 1) GET /tts (STREAMING) — this fixes Safari testing and mobile playback
@router.get("/tts")
async def tts_stream(
    text: str = Query(...),
    lang: str = Query("fil"),            # ✅ default Tagalog
    voice: Optional[str] = Query(None),  # ✅ optional
):
    try:
        # ✅ Always rewrite to Tagalog when lang=fil
        final_text = tagalog_rewrite(text) if lang.lower().startswith("fil") else text

        audio_bytes = await generate_tts_audio_bytes(final_text, voice=voice, lang=lang)
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
        raise HTTPException(status_code=500, detail=str(e))


# ✅ 2) POST /tts (JOB) — keep your job-based flow
@router.post("/tts", status_code=202)
async def create_tts_job(payload: dict, background_tasks: BackgroundTasks):
    """
    Start a TTS job and return job id immediately.
    Accepts: { "text": "...", "voice": "...", "lang": "fil" }
    """
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    voice = payload.get("voice")
    lang = payload.get("lang") or "fil"

    # rewrite to Tagalog if fil
    final_text = tagalog_rewrite(text) if str(lang).lower().startswith("fil") else text

    job_id = uuid.uuid4().hex
    meta = {"job_id": job_id, "status": "queued", "voice": voice, "lang": lang}
    _write_meta(job_id, meta)

    async def _process_job():
        meta2 = {"job_id": job_id, "status": "processing", "voice": voice, "lang": lang}
        _write_meta(job_id, meta2)
        try:
            audio_bytes = await generate_tts_audio_bytes(final_text, voice=voice, lang=lang)
            audio_path = _audio_path(job_id)
            with open(audio_path, "wb") as fa:
                fa.write(audio_bytes)
            meta2.update({"status": "done", "size": os.path.getsize(audio_path)})
            _write_meta(job_id, meta2)
        except Exception as e:
            meta2.update({"status": "error", "error": str(e)})
            _write_meta(job_id, meta2)

    background_tasks.add_task(_process_job)
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
        return JSONResponse(status_code=202, content=meta)
    audio_path = _audio_path(job_id)
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="audio missing")
    return FileResponse(audio_path, media_type="audio/mpeg", filename=f"{job_id}.mp3")
