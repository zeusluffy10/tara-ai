# backend/routes/landmark.py
from fastapi import APIRouter, Query
import requests
import os
import time

router = APIRouter()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

CACHE = {}
CACHE_TTL = 60 * 60  # 1 hour

# Block area-level names
BAD_WORDS = [
    "manila",
    "quezon city",
    "makati",
    "city",
    "barangay",
    "district",
    "region",
    "philippines",
]

# Types that most often produce "Chowking / photo studio / tindahan"
GOOD_TYPES = [
    "restaurant",
    "store",
    "pharmacy",
    "supermarket",
    "cafe",
    "shopping_mall",
]

def is_bad_name(name: str) -> bool:
    low = (name or "").lower().strip()
    if not low:
        return True
    return any(b in low for b in BAD_WORDS)

def nearby_search(lat: float, lng: float, radius: int, place_type: str | None = None):
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "key": GOOGLE_MAPS_API_KEY,
    }
    if place_type:
        params["type"] = place_type
    return requests.get(url, params=params, timeout=6)

@router.get("/landmark")
def get_landmark(lat: float = Query(...), lng: float = Query(...)):
    if not GOOGLE_MAPS_API_KEY:
        return {"name": None}

    key = f"{round(lat,5)},{round(lng,5)}"
    now = time.time()

    cached = CACHE.get(key)
    if cached and now - cached["ts"] < CACHE_TTL:
        return {"name": cached["name"]}

    radius = 40  # walking senior

    # ✅ Try POI types first
    for t in GOOD_TYPES:
        try:
            res = nearby_search(lat, lng, radius, t)
            if res.status_code != 200:
                continue
            data = res.json()
            if data.get("status") != "OK":
                continue
            for r in data.get("results", []):
                name = r.get("name")
                if name and not is_bad_name(name):
                    CACHE[key] = {"name": name, "ts": now}
                    return {"name": name}
        except Exception:
            continue

    # ✅ Fallback without type
    try:
        res = nearby_search(lat, lng, radius, None)
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == "OK":
                for r in data.get("results", []):
                    name = r.get("name")
                    if name and not is_bad_name(name):
                        CACHE[key] = {"name": name, "ts": now}
                        return {"name": name}
    except Exception:
        pass

    CACHE[key] = {"name": None, "ts": now}
    return {"name": None}
