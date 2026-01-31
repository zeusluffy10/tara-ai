from fastapi import APIRouter, Query
import requests
import os
import time

router = APIRouter()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# 🔹 Simple in-memory cache
CACHE = {}
CACHE_TTL = 60 * 60  # 1 hour

# ❌ Area-level names we NEVER want to speak
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

def is_bad_landmark(name: str) -> bool:
    low = name.lower()
    return any(bad in low for bad in BAD_WORDS)


@router.get("/landmark")
def get_landmark(
    lat: float = Query(...),
    lng: float = Query(...)
):
    if not GOOGLE_MAPS_API_KEY:
        return {"name": None}

    key = f"{round(lat,5)},{round(lng,5)}"
    now = time.time()

    # ✅ Cache hit
    cached = CACHE.get(key)
    if cached and now - cached["ts"] < CACHE_TTL:
        return {"name": cached["name"]}

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lng}",
        "radius": 40,   # 👴 walking distance
        "key": GOOGLE_MAPS_API_KEY,
    }

    try:
        res = requests.get(url, params=params, timeout=5)
        data = res.json()
    except Exception:
        return {"name": None}

    if data.get("status") != "OK":
        return {"name": None}

    results = data.get("results", [])

    for r in results:
        name = r.get("name")
        if not name:
            continue

        # ❌ Skip city/area names
        if is_bad_landmark(name):
            continue

        # ✅ First GOOD small place wins (photo studio, bakery, tindahan)
        CACHE[key] = {"name": name, "ts": now}
        return {"name": name}

    # fallback: nothing suitable
    CACHE[key] = {"name": None, "ts": now}
    return {"name": None}
