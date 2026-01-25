# backend/routes/route.py
from fastapi import APIRouter, HTTPException
import requests
import os
import re

router = APIRouter()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

if not GOOGLE_MAPS_API_KEY:
    raise RuntimeError("GOOGLE_MAPS_API_KEY is not set")


def _strip_html(text: str) -> str:
    """Remove HTML tags from Google instructions."""
    return re.sub(r"<[^>]+>", "", text or "").strip()


@router.get("/reroute")
def reroute(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    mode: str = "walking",
):
    """
    Returns Google Directions JSON, localized for PH / Filipino usage.
    The mobile app will convert instructions to pure Tagalog.
    """

    url = "https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": f"{origin_lat},{origin_lng}",
        "destination": f"{dest_lat},{dest_lng}",
        "mode": mode,                    # walking | driving
        "language": "tl",                # 🇵🇭 Filipino / Tagalog
        "region": "PH",                  # Philippines bias
        "alternatives": "false",
        "key": GOOGLE_MAPS_API_KEY,
    }

    try:
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Directions error: {e}")

    data = res.json()

    if data.get("status") != "OK":
        raise HTTPException(
            status_code=400,
            detail=f"Directions failed: {data.get('status')}",
        )

    # 🔥 CLEAN INSTRUCTIONS FOR TAGALOG REWRITE
    try:
        route = data["routes"][0]
        leg = route["legs"][0]

        steps = []
        for s in leg["steps"]:
            steps.append({
                "instruction": _strip_html(s.get("html_instructions")),
                "maneuver": s.get("maneuver"),
                "lat": s["end_location"]["lat"],
                "lng": s["end_location"]["lng"],
                "distance_m": s["distance"]["value"],
            })

        return {
            "polyline": route["overview_polyline"]["points"],
            "destination": {
                "lat": dest_lat,
                "lng": dest_lng,
            },
            "steps": steps,
            "distance_m": leg["distance"]["value"],
            "duration_s": leg["duration"]["value"],
            "mode": mode,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse directions: {e}",
        )
