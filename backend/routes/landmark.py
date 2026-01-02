from fastapi import APIRouter, Query
import requests
import os

router = APIRouter()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

@router.get("/landmark")
def get_landmark(
    lat: float = Query(...),
    lng: float = Query(...)
):
    if not GOOGLE_MAPS_API_KEY:
        return {"error": "API_KEY_MISSING"}

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
        return {
            "name": None,
            "status": data.get("status"),
            "message": data.get("error_message"),
        }

    results = data.get("results", [])
    if not results:
        return {"name": None}

    return {
        "name": results[0]["name"]
    }
