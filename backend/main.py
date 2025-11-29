# backend/main.py
from fastapi import FastAPI, Query, HTTPException, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import html

from utils.openai_client import ask_openai
from utils.maps_client import (
    get_place_coordinates,
    autocomplete_place,
    place_details,
    get_directions,
)

app = FastAPI()


class Question(BaseModel):
    question: str


class SimplifyPayload(BaseModel):
    # accept either 'steps' (list of step dicts) or 'raw_text' (string)
    steps: Optional[List[Dict[str, Any]]] = None
    raw_text: Optional[str] = None
    # optional user preferences (voice speed, senior_mode etc)
    prefs: Optional[Dict[str, Any]] = None


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
def route(origin: str = Query(..., description="origin address or 'lat,lng'"),
          destination: str = Query(..., description="destination address or 'lat,lng'"),
          mode: str = Query("walking", description="walking|driving|transit|bicycling")):
    """
    Example:
      GET /route?origin=14.5995,120.9842&destination=14.6050,120.9878&mode=walking
    Returns parsed route with cleaned step instructions (no HTML).
    """
    route = get_directions(origin, destination, mode=mode)
    if route is None:
        raise HTTPException(status_code=500, detail="directions error")
    return {"status": "ok", "route": route}


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
