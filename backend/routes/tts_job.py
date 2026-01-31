# backend/routes/tts_job.py
import os
import uuid
import json
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from services.tts_service import generate_tts_audio_bytes
from utils.tagalog_nav import tagalog_rewrite  # ✅ Tagalog rewrite

# ✅ IMPORTANT: prefix to avoid clashing with GET /tts
router = APIRouter(prefix="/tts/job")

# jobs directory (relative to backend)
JOBS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "jobs")
os.makedirs(JOBS_DIR, exist_ok=True)

class TTSCreate(BaseModel):
  text: str
  voice: Optional[str] = None
  lang: Optional[str] = "fil"
  style: Optional[str] = "calm"

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

def apply_style(text: str, style: str) -> str:
  t = (text or "").strip()
  if style == "warning":
    return f"Babala. {t}."
  return t

def normalize_voice(voice: Optional[str]) -> str:
  if not voice:
    return "nova"  # ✅ default female
  v = voice.strip().lower()
  if v in ["female", "girl", "woman"]:
    return "nova"
  if v in ["male", "man", "boy"]:
    return "alloy"
  return voice

async def _process_job(job_id: str, text: str, voice: Optional[str], lang: str, style: str):
  meta = {"job_id": job_id, "status": "processing", "voice": voice, "lang": lang, "style": style}
  _write_meta(job_id, meta)

  try:
    final_text = text
    if (lang or "").lower().startswith("fil"):
      final_text = tagalog_rewrite(final_text)

    final_text = apply_style(final_text, style)
    final_voice = normalize_voice(voice)

    audio_bytes = await generate_tts_audio_bytes(text=final_text, voice=final_voice)

    audio_path = _audio_path(job_id)
    with open(audio_path, "wb") as fa:
      fa.write(audio_bytes)

    meta.update({"status": "done", "size": os.path.getsize(audio_path)})
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
    "lang": payload.lang or "fil",
    "style": payload.style or "calm",
  }
  _write_meta(job_id, meta)

  background_tasks.add_task(
    _process_job,
    job_id,
    text,
    payload.voice,
    payload.lang or "fil",
    payload.style or "calm",
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
