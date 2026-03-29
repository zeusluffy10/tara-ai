# backend/routes/tts_job.py
import os
import uuid
import json
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from services.tts_service import generate_tts_audio_bytes
from utils.tts_format import prepare_tts_text, normalize_voice

# ✅ IMPORTANT: prefix to avoid clashing with GET /tts
router = APIRouter(prefix="/tts/job")

# jobs directory (relative to backend)
JOBS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "jobs")
os.makedirs(JOBS_DIR, exist_ok=True)

class TTSCreate(BaseModel):
  text: str
  voice: Optional[str] = None
  gender: Optional[str] = None
  lang: Optional[str] = "fil"
  style: Optional[str] = "calm"
  pause_ms: Optional[int] = None
  emphasis: Optional[str] = None

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

async def _process_job(
  job_id: str,
  text: str,
  voice: Optional[str],
  gender: Optional[str],
  lang: str,
  style: str,
  pause_ms: Optional[int],
  emphasis: Optional[str],
):
  meta = {
    "job_id": job_id,
    "status": "processing",
    "voice": voice,
    "gender": gender,
    "lang": lang,
    "style": style,
    "pause_ms": pause_ms,
    "emphasis": emphasis,
  }
  _write_meta(job_id, meta)

  try:
    final_text, normalized_pause, normalized_emphasis = prepare_tts_text(
      text=text,
      lang=lang,
      style=style,
      pause_ms=pause_ms,
      emphasis=emphasis,
    )
    final_voice = normalize_voice(voice, gender)

    audio_bytes = await generate_tts_audio_bytes(text=final_text, voice=final_voice)

    audio_path = _audio_path(job_id)
    with open(audio_path, "wb") as fa:
      fa.write(audio_bytes)

    meta.update({
      "status": "done",
      "size": os.path.getsize(audio_path),
      "voice": final_voice,
      "pause_ms": normalized_pause,
      "emphasis": normalized_emphasis,
    })
    _write_meta(job_id, meta)

  except Exception as e:
    meta.update({"status": "error", "error": str(e)})
    _write_meta(job_id, meta)

@router.post("", status_code=202)
async def create_tts_job(payload: TTSCreate, background_tasks: BackgroundTasks):
  text = (payload.text or "").strip()
  if not text:
    raise HTTPException(status_code=400, detail="text is required")

  job_id = uuid.uuid4().hex
  meta = {
    "job_id": job_id,
    "status": "queued",
    "voice": payload.voice,
    "gender": payload.gender,
    "lang": payload.lang or "fil",
    "style": payload.style or "calm",
    "pause_ms": payload.pause_ms,
    "emphasis": payload.emphasis,
  }
  _write_meta(job_id, meta)

  background_tasks.add_task(
    _process_job,
    job_id,
    text,
    payload.voice,
    payload.gender,
    payload.lang or "fil",
    payload.style or "calm",
    payload.pause_ms,
    payload.emphasis,
  )

  return JSONResponse(status_code=202, content={"job_id": job_id, "status": "queued"})

@router.get("/status/{job_id}")
def get_tts_status(job_id: str):
  meta = _read_meta(job_id)
  if not meta:
    raise HTTPException(status_code=404, detail="job not found")
  return meta

@router.get("/result/{job_id}")
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
