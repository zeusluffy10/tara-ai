from fastapi import APIRouter, Query
import requests
import os
import time
from typing import Optional

router = APIRouter()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# 🔹 Simple in-memory cache
CACHE = {}
CACHE_TTL = 60 * 60  # 1 hour

# POI types that are GOOD spoken landmarks for seniors
POI_TYPES = [
    "restaurant",
    "cafe",
    "convenience_store",
    "supermarket",
    "pharmacy",
    "hospital",
    "bank",
    "atm",
    "school",
    "church",
    "shopping_mall",
]

def _places_nearby(lat: float, lng: float, radius: int, place_type: Optional[str] = None):
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "key": GOOGLE_MAPS_API_KEY,
        "rankby": "prominence",
    }
    if place_type:
        params["type"] = place_type

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    return requests.get(url, params=params, timeout=6)


@router.get("/landmark")
def get_landmark(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(100, ge=40, le=300),
):
    if not GOOGLE_MAPS_API_KEY:
        return {"name": None}

    key = f"{round(lat,5)},{round(lng,5)}"
    now = time.time()

    # ✅ Cache hit
    if key in CACHE:
        cached = CACHE[key]
        if now - cached["ts"] < CACHE_TTL:
            return {"name": cached["name"], "source": "cache"}

    # 1️⃣ First pass: general nearby search (often finds Chowking directly)
    try:
        res = _places_nearby(lat, lng, radius)
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == "OK" and data.get("results"):
                name = data["results"][0].get("name")
                if name:
                    CACHE[key] = {"name": name, "ts": now}
                    return {"name": name, "source": "places"}
    except Exception:
        pass

    # 2️⃣ Second pass: try specific POI types
    for t in POI_TYPES:
        try:
            res = _places_nearby(lat, lng, radius, place_type=t)
            if res.status_code != 200:
                continue

            data = res.json()
            if data.get("status") == "OK" and data.get("results"):
                name = data["results"][0].get("name")
                if name:
                    CACHE[key] = {"name": name, "ts": now}
                    return {"name": name, "source": f"type:{t}"}
        except Exception:
            continue

    # 3️⃣ Fallback: nothing useful nearby
    CACHE[key] = {"name": None, "ts": now}
    return {"name": None, "source": "none"}
