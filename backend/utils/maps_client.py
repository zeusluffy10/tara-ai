# backend/utils/maps_client.py
import os
import time
import requests
import html
import re
from dotenv import load_dotenv
from typing import Optional, Dict, Any, List, Union

load_dotenv()

# Accept either env var name used previously (compatibility)
GOOGLE_MAPS_SERVER_KEY = os.getenv("GOOGLE_MAPS_SERVER_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
if not GOOGLE_MAPS_SERVER_KEY:
    raise RuntimeError("GOOGLE_MAPS_SERVER_KEY / GOOGLE_MAPS_API_KEY not found in .env file")

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
AUTOCOMPLETE_URL = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# small helper for retrying transient errors
def _request_with_retries(url: str, params: dict, timeout: float = 6.0, retries: int = 2, backoff: float = 0.3):
    last_exc = None
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, params=params, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            last_exc = e
            if attempt < retries:
                time.sleep(backoff * (2 ** attempt))
            else:
                # raise the last exception up
                raise
    # Shouldn't reach here
    raise last_exc

# -----------------------------------------------------------
# helpers
# -----------------------------------------------------------
def _strip_html_tags(html_text: str) -> str:
    """Remove HTML tags and unescape HTML entities (safe, simple)."""
    if not html_text:
        return ""
    # Replace line-break like tags with a space first
    text = re.sub(r"<br\s*/?>", " ", html_text, flags=re.IGNORECASE)
    # Remove all other tags
    text = re.sub(r"<[^>]+>", "", text)
    # Unescape HTML entities (e.g. &amp;)
    text = html.unescape(text)
    return text.strip()

def _coords_from_result(result: dict) -> Optional[Dict[str, float]]:
    geometry = result.get("geometry", {})
    location = geometry.get("location")
    if not location:
        return None
    lat = location.get("lat")
    lng = location.get("lng")
    if lat is None or lng is None:
        return None
    return {"lat": float(lat), "lng": float(lng)}

def _format_location_param(loc: Union[str, Dict[str, float]]) -> str:
    """
    Accept either a "lat,lng" string or a dict {"lat":..., "lng":...} or plain address string.
    Returns appropriate string suitable for Google Directions 'origin'/'destination' parameter.
    """
    if isinstance(loc, dict):
        return f"{loc.get('lat')},{loc.get('lng')}"
    return str(loc)


# -----------------------------------------------------------
# 1) GET COORDINATES (GEOCODING)
# -----------------------------------------------------------
def get_place_coordinates(place_name: str, timeout: float = 6.0) -> Optional[Dict[str, float]]:
    """
    Geocode a freeform address/place string and return {'lat': float, 'lng': float}
    Returns None when no result or on error.
    """
    params = {"address": place_name, "key": GOOGLE_MAPS_SERVER_KEY}
    try:
        data = _request_with_retries(GEOCODE_URL, params, timeout=timeout)
    except Exception as e:
        print(f"[maps_client] Geocode request error: {e}")
        return None

    # debug output — keep temporarily when testing
    print("[maps_client] Google Geocode response status:", data.get("status"))

    status = data.get("status")
    if status != "OK":
        # if ZERO_RESULTS or OVER_QUERY_LIMIT etc. return None
        print(f"[maps_client] Geocode status: {status}, error_message: {data.get('error_message')}")
        return None

    results = data.get("results", [])
    if not results:
        print("[maps_client] No results in geocode response")
        return None

    coords = _coords_from_result(results[0])
    if coords is None:
        print("[maps_client] Missing lat/lng in geocode result")
        return None

    return coords


# -----------------------------------------------------------
# 2) GET DIRECTIONS (ROUTING)
# -----------------------------------------------------------
def get_directions(origin: Union[str, Dict[str, float]],
                   destination: Union[str, Dict[str, float]],
                   mode: str = "walking",
                   timeout: float = 6.0) -> Optional[Dict[str, Any]]:
    """
    Returns route information or None:
    {
        "distance": "10 km",
        "duration": "25 mins",
        "start_address": "...",
        "end_address": "...",
        "polyline": "...",
        "steps": [ { "instruction": "...", "distance": "...", "duration": "..."} ]
    }
    mode: 'walking' | 'driving' | 'transit' | 'bicycling'
    origin/destination may be strings (addresses) or dicts with lat/lng.
    """
    if mode not in {"walking", "driving", "transit", "bicycling"}:
        mode = "walking"

    params = {
        "origin": _format_location_param(origin),
        "destination": _format_location_param(destination),
        "mode": mode,
        "key": GOOGLE_MAPS_SERVER_KEY,
    }

    try:
        data = _request_with_retries(DIRECTIONS_URL, params, timeout=timeout)
    except Exception as e:
        print(f"[maps_client] Directions request failed: {e}")
        return None

    status = data.get("status")
    if status != "OK":
        print(f"[maps_client] Directions API error: {status}, msg={data.get('error_message')}")
        return None

    try:
        route = data["routes"][0]
        leg = route["legs"][0]
    except (IndexError, KeyError) as e:
        print(f"[maps_client] Unexpected directions response shape: {e}")
        return None

    # Extract steps, clean HTML instructions
    steps = []
    for step in leg.get("steps", []):
        html_instr = step.get("html_instructions", "")
        instr = _strip_html_tags(html_instr)
        steps.append({
            "instruction": instr,
            "distance": step.get("distance", {}).get("text"),
            "duration": step.get("duration", {}).get("text"),
        })

    return {
        "distance": leg.get("distance", {}).get("text"),
        "duration": leg.get("duration", {}).get("text"),
        "start_address": leg.get("start_address"),
        "end_address": leg.get("end_address"),
        "polyline": route.get("overview_polyline", {}).get("points"),
        "steps": steps,
    }


# -----------------------------------------------------------
# 3) AUTOCOMPLETE (PLACE SUGGESTIONS)
# -----------------------------------------------------------
def autocomplete_place(query: str, session_token: Optional[str] = None, components: Optional[str] = "country:ph", timeout: float = 4.0) -> List[Dict[str, Any]]:
    """
    Returns a list of predictions: [{"description": "...", "place_id": "..."}, ...]
    Use session_token for billing optimization when implementing on frontend.
    """
    params = {
        "input": query,
        "key": GOOGLE_MAPS_SERVER_KEY,
        "components": components,
        "types": "geocode"  # 'address' or other types possible
    }
    if session_token:
        params["sessiontoken"] = session_token

    try:
        data = _request_with_retries(AUTOCOMPLETE_URL, params, timeout=timeout)
    except Exception as e:
        print(f"[maps_client] Autocomplete request failed: {e}")
        return []

    if data.get("status") != "OK":
        # can be ZERO_RESULTS or OVER_QUERY_LIMIT etc
        print(f"[maps_client] Autocomplete status: {data.get('status')}")
        return []

    preds = []
    for p in data.get("predictions", []):
        preds.append({"description": p.get("description"), "place_id": p.get("place_id")})
    return preds


# -----------------------------------------------------------
# 4) PLACE DETAILS (from place_id -> lat/lng + formatted_address)
# -----------------------------------------------------------
def place_details(place_id: str, timeout: float = 4.0) -> Optional[Dict[str, Any]]:
    """
    Returns {'name','address','lat','lng','phone' (if available)} or None.
    """
    params = {"place_id": place_id, "key": GOOGLE_MAPS_SERVER_KEY, "fields": "name,formatted_address,geometry,formatted_phone_number"}
    try:
        data = _request_with_retries(PLACE_DETAILS_URL, params, timeout=timeout)
    except Exception as e:
        print(f"[maps_client] Place details request failed: {e}")
        return None

    if data.get("status") != "OK":
        print(f"[maps_client] Place details status: {data.get('status')}")
        return None

    result = data.get("result", {})
    loc = result.get("geometry", {}).get("location", {})
    return {
        "name": result.get("name"),
        "address": result.get("formatted_address"),
        "lat": loc.get("lat"),
        "lng": loc.get("lng"),
        "phone": result.get("formatted_phone_number")
    }
