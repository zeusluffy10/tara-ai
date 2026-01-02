from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, Query, HTTPException, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple
import html
from routes.navigation import router as navigation_router
from routes.tts import router as tts_router
from routes.tts_job import router as tts_job_router
from routes.landmark import router as landmark_router
from routes.route import router as reroute_router


# new imports for /transcribe
import os
import tempfile
import requests
import re

from utils.openai_client import ask_openai
from utils.maps_client import (
    get_place_coordinates,
    autocomplete_place,
    place_details,
    get_directions,
)

app = FastAPI()
app.include_router(tts_job_router)
app.include_router(navigation_router)
app.include_router(tts_router)
app.include_router(landmark_router)
app.include_router(reroute_router)


class Question(BaseModel):
    question: str


class SimplifyPayload(BaseModel):
    # accept either 'steps' (list of step dicts) or 'raw_text' (string)
    steps: Optional[List[Dict[str, Any]]] = None
    raw_text: Optional[str] = None
    # optional user preferences (voice speed, senior_mode etc)
    prefs: Optional[Dict[str, Any]] = None

# def _strip_html(s: str) -> str:
#     """Remove HTML tags and unescape entities."""
#     clean = re.sub(r"<[^>]+>", "", s or "")
#     return html.unescape(clean).strip()

def _strip_html_tags(s: str) -> str:
    """Remove HTML tags and unescape entities."""
    if not s:
        return ""
    clean = re.sub(r"<[^>]+>", "", s)
    return html.unescape(clean).strip()

def _get_latlng_from_loc(loc: dict) -> Tuple[float, float]:
    """Extract lat/lng from a Google location dict {lat: .., lng: ..}"""
    if not loc:
        return (None, None)
    return (loc.get("lat") or loc.get("latitude"), loc.get("lng") or loc.get("longitude"))

@app.get("/")
def home():
    return {"message": "TARA AI backend running!"}


@app.post("/ask")
def ask_route(payload: Question):
    answer = ask_openai(payload.question)
    return {"answer": answer}


# -------------------------------------------------------
# GEOCODE — existing
# -------------------------------------------------------
@app.get("/geocode")
def geocode(place: str = Query(..., description="Place name to search for")):
    """
    Returns lat/lng of a place by calling Google Geocoding API.
    Sample:
      GET /geocode?place=Manila
    """
    coords = get_place_coordinates(place)

    if coords is None:
        return JSONResponse(
            status_code=404,
            content={"error": "place_not_found", "message": f"No results for '{place}'"}
        )

    return {
        "place": place,
        "coordinates": coords,
        "status": "ok"
    }


# -------------------------------------------------------
# SEARCH / AUTOCOMPLETE
# -------------------------------------------------------
@app.get("/search")
def search(q: str = Query(..., description="Query text for place autocomplete"),
           session: Optional[str] = Query(None, description="Optional session token")):
    """
    Returns autocomplete predictions from maps_client.autocomplete_place
    """
    preds = autocomplete_place(q, session_token=session)
    if not preds:
        return {"predictions": [], "status": "no_results"}
    return {"predictions": preds, "status": "ok"}


# -------------------------------------------------------
# PLACE DETAILS (place_id -> lat,lng,address)
# -------------------------------------------------------
@app.get("/placedetails")
def get_place(place_id: str = Query(..., description="Google place_id")):
    details = place_details(place_id)
    if details is None:
        raise HTTPException(status_code=404, detail="place not found")
    return {"status": "ok", "place": details}


# -------------------------------------------------------
# DIRECTIONS / ROUTE
# -------------------------------------------------------
@app.get("/route")
def route(
    origin: str = Query(..., description="origin address or 'lat,lng'"),
    destination: str = Query(..., description="destination address or 'lat,lng'"),
    mode: str = Query("walking", description="walking | driving | transit | bicycling")
):
    """
    Unified route endpoint:
      - Try existing get_directions() first (keeps current provider)
      - If result missing step-by-step instructions, call Google Directions
        and augment the route with 'steps' (plain text instructions + distance/duration).
    Response:
    {
      "status": "ok",
      "route": {
         "polyline": "...",
         "distance": {...},
         "duration": {...},
         "steps": [ { instruction, distance, duration, start_location, end_location, polyline }, ... ]
      }
    }
    """

    # validation
    if not origin or not destination:
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "code": "INVALID_INPUT",
                "message": "Origin and destination are required."
            }
        )

    # try the existing provider first
    try:
        route_obj = get_directions(origin, destination, mode=mode)
    except Exception as e:
        print("Internal get_directions error:", e)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "code": "INTERNAL_ROUTE_ERROR",
                "message": "Internal routing engine failed."
            }
        )

    # if provider returned nothing, we will try Google below
    if route_obj is None:
        # fallthrough to try google directions
        route_obj = None

    # If route_obj already contains steps, return it immediately
    if isinstance(route_obj, dict) and route_obj.get("steps"):
        return {"status": "ok", "route": route_obj}

    # At this point either route_obj is None or missing steps.
    # Attempt to fetch detailed directions (including steps) from Google Directions API.
    GOOGLE_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
    if not GOOGLE_KEY:
        # If key missing and we already have a polyline/distance/duration, return that as a fallback
        if route_obj:
            return {"status": "ok", "route": route_obj}
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "code": "NO_MAPS_KEY",
                "message": "Missing GOOGLE_MAPS_API_KEY on server to fetch detailed directions."
            }
        )

    try:
        params = {
            "origin": origin,
            "destination": destination,
            "key": GOOGLE_KEY,
            "mode": mode,
            "alternatives": "false",
            "departure_time": "now"
        }
        resp = requests.get("https://maps.googleapis.com/maps/api/directions/json", params=params, timeout=15)
        if resp.status_code != 200:
            raise Exception(f"Google Directions HTTP {resp.status_code}: {resp.text}")

        data = resp.json()
        status = data.get("status", "")
        if status != "OK":
            # If no route found but we have a fallback route_obj, return it
            if route_obj:
                return {"status": "ok", "route": route_obj}
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "code": "DIRECTIONS_API",
                    "message": f"Google Directions returned {status}: {data.get('error_message')}"
                }
            )

        route0 = data["routes"][0]
        leg0 = route0["legs"][0]

        # Build normalized steps (plain text instructions)
        steps_raw = leg0.get("steps", [])
        steps = []
        for s in steps_raw:
            instr_html = s.get("html_instructions", "")
            instr_text = _strip_html_tags(instr_html)
            steps.append({
                "instruction": instr_text,
                "distance": s.get("distance"),
                "duration": s.get("duration"),
                "start_location": s.get("start_location"),
                "end_location": s.get("end_location"),
                "polyline": s.get("polyline", {}).get("points"),
            })

        overview_polyline = route0.get("overview_polyline", {}).get("points")
        distance = leg0.get("distance")
        duration = leg0.get("duration")

        # Merge with existing route_obj if available, prefer Google fields for steps and overview.
        unified = route_obj if isinstance(route_obj, dict) else {}
        unified.update({
            "polyline": overview_polyline or unified.get("polyline"),
            "distance": distance or unified.get("distance"),
            "duration": duration or unified.get("duration"),
            "steps": steps
        })

        return {"status": "ok", "route": unified}

    except Exception as e:
        print("Error fetching Google Directions:", e)
        # fallback: if we previously had a route_obj without steps, return it
        if route_obj:
            return {"status": "ok", "route": route_obj}
        return JSONResponse(
            status_code=502,
            content={
                "status": "error",
                "code": "DIRECTIONS_FETCH_FAILED",
                "message": "Could not fetch directions from provider."
            }
        )

# -------------------------------------------------------
# SIMPLIFY — use OpenAI to convert raw steps -> short Taglish lines
# -------------------------------------------------------
@app.post("/simplify")
def simplify(payload: SimplifyPayload):
    """
    Accepts either:
      - payload.steps: list of steps each containing 'instruction' (clean text) OR
      - payload.raw_text: a single text blob (HTML or plain)
    Returns:
      { "status": "ok", "simple": ["step 1", "step 2", ...], "raw": "..." }
    """
    # Build plain text from input
    if payload.steps:
        # join step instructions into numbered list
        text_lines = []
        for i, s in enumerate(payload.steps):
            instr = s.get("instruction") or s.get("html_instructions") or ""
            # remove HTML tags if present
            instr = html.unescape(instr)
            instr = instr.replace("\n", " ").strip()
            text_lines.append(f"{i+1}. {instr}")
        raw_text = "\n".join(text_lines)
    elif payload.raw_text:
        raw_text = payload.raw_text
    else:
        raise HTTPException(status_code=400, detail="provide either 'steps' or 'raw_text' in the payload")

    # Prepare prompt for the LLM
    prompt = f"""
You are TaraAI, a friendly Filipino voice assistant for elderly users.
Convert the following map/navigation instructions into a short list of simple Tagalog/Taglish steps that an elderly person can follow.
- Keep each step short (<= 12 words)
- Use landmarks and simple cues (e.g., 'tatlong poste', 'may tindahan sa kaliwa')
- Use polite, calm tone
- Output each step on a new line, in Tagalog or Taglish only.

Input instructions:
{raw_text}

Respond with the simplified steps only (no extra explanation).
"""
    # Call the OpenAI wrapper that returns text
    answer = ask_openai(prompt)

    # Post-process: split lines and trim
    simple_lines = [ln.strip() for ln in answer.splitlines() if ln.strip()]

    # If model returned a single paragraph, try splitting by sentence punctuation as fallback
    if not simple_lines:
        # fallback: split by period
        simple_lines = [s.strip() for s in answer.replace("•", ".").split(".") if s.strip()]

    return {"status": "ok", "simple": simple_lines, "raw_reply": answer}


# -------------------------------------------------------
# TRANSCRIBE — audio -> text via OpenAI Whisper (whisper-1)
# -------------------------------------------------------
@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Upload an audio file (.m4a/.wav/.mp3) and receive transcribed text.
    Uses OpenAI Audio Transcriptions endpoint (model=whisper-1).
    Returns: { "text": "transcribed text" }
    """
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured in environment")

    # Save upload to temp file
    suffix = os.path.splitext(file.filename)[1] or ".m4a"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        contents = await file.read()
        tmp.write(contents)

    try:
        with open(tmp_path, "rb") as f:
            files = {
                "file": (file.filename, f, file.content_type or "audio/m4a"),
            }
            data = {"model": "whisper-1"}
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            resp = requests.post("https://api.openai.com/v1/audio/transcriptions",
                                 headers=headers, files=files, data=data, timeout=240)

        if resp.status_code != 200:
            # surface OpenAI error
            raise HTTPException(status_code=502, detail=f"Transcription service error: {resp.status_code} {resp.text}")

        j = resp.json()
        text = j.get("text") or j.get("transcript") or ""
        return JSONResponse(status_code=200, content={"text": text})

    finally:
        # cleanup temp file
        try:
            os.remove(tmp_path)
        except Exception:
            pass
