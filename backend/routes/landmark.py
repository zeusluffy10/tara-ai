# backend/routes/landmark.py
from fastapi import APIRouter, Query
import requests
import os
import time
from typing import Any

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
TYPE_PRIORITIES = {
    "restaurant": 120,
    "bank": 110,
    "church": 105,
    "school": 100,
    "pharmacy": 80,
    "supermarket": 75,
    "shopping_mall": 70,
    "cafe": 60,
    "store": 35,
}

BRAND_PRIORITIES = {
    "jollibee": 40,
    "chowking": 40,
    "mcdonald": 30,
    "bdo": 35,
    "bpi": 35,
    "metrobank": 30,
    "security bank": 28,
    "church": 18,
    "parish": 18,
    "school": 16,
    "college": 16,
    "university": 16,
}

GENERIC_BUILDING_WORDS = [
    "building",
    "residence",
    "tower",
    "block",
    "phase",
    "street",
    "road",
    "avenue",
    "lane",
    "drive",
    "complex",
]

GOOD_TYPES = list(TYPE_PRIORITIES.keys())

def is_bad_name(name: str) -> bool:
    low = (name or "").lower().strip()
    if not low:
        return True
    if any(b in low for b in BAD_WORDS):
        return True
    if len(low) < 4:
        return True
    if any(word == low for word in {"unknown", "unnamed road", "unnamed"}):
        return True
    return False

def place_score(place: dict[str, Any]) -> int:
    name = (place.get("name") or "").strip()
    if is_bad_name(name):
        return -1

    score = 0
    lower_name = name.lower()
    place_types = [place_type.lower() for place_type in place.get("types", [])]

    for place_type in place_types:
        score += TYPE_PRIORITIES.get(place_type, 0)

    for brand, bonus in BRAND_PRIORITIES.items():
        if brand in lower_name:
            score += bonus

    if any(word in lower_name for word in GENERIC_BUILDING_WORDS):
        score -= 50

    if any(char.isdigit() for char in lower_name):
        score -= 12

    rating = place.get("rating")
    if isinstance(rating, (int, float)):
        score += min(int(rating * 4), 20)

    user_ratings_total = place.get("user_ratings_total")
    if isinstance(user_ratings_total, int) and user_ratings_total > 0:
        score += min(user_ratings_total // 40, 12)

    return score

def pick_best_landmark(results: list[dict[str, Any]]):
    best_name = None
    best_score = -1
    seen_names = set()

    for result in results:
        name = (result.get("name") or "").strip()
        low_name = name.lower()
        if not name or low_name in seen_names:
            continue
        seen_names.add(low_name)

        score = place_score(result)
        if score > best_score:
            best_name = name
            best_score = score

    return best_name

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

    radius = 60
    candidates: list[dict[str, Any]] = []

    for t in GOOD_TYPES:
        try:
            res = nearby_search(lat, lng, radius, t)
            if res.status_code != 200:
                continue
            data = res.json()
            if data.get("status") != "OK":
                continue
            candidates.extend(data.get("results", []))
        except Exception:
            continue

    try:
        res = nearby_search(lat, lng, radius, None)
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == "OK":
                candidates.extend(data.get("results", []))
    except Exception:
        pass

    best_name = pick_best_landmark(candidates)
    if best_name:
        CACHE[key] = {"name": best_name, "ts": now}
        return {"name": best_name}

    CACHE[key] = {"name": None, "ts": now}
    return {"name": None}
