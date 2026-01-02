from fastapi import APIRouter, Query
import requests
import os
import time

router = APIRouter()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# 🔹 Simple in-memory cache
CACHE = {}
CACHE_TTL = 60 * 60  # 1 hour

@router.get("/landmark")
def get_landmark(
    lat: float = Query(...),
    lng: float = Query(...)
):
    if not GOOGLE_MAPS_API_KEY:
        return {"error": "API_KEY_MISSING"}

    key = f"{round(lat,5)},{round(lng,5)}"
    now = time.time()

    # ✅ Cache hit
    if key in CACHE:
        cached = CACHE[key]
        if now - cached["ts"] < CACHE_TTL:
            return {"name": cached["name"]}

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": 40,
        "type": "store|school|church|restaurant",
        "key": GOOGLE_MAPS_API_KEY,
    }

    res = requests.get(url, params=params, timeout=5)
    data = res.json()

    if data.get("status") != "OK":
        return {"name": None}

    results = data.get("results", [])
    if not results:
        return {"name": None}

    name = results[0]["name"]

    # ✅ Save to cache
    CACHE[key] = {
        "name": name,
        "ts": now
    }

    return {"name": name}
