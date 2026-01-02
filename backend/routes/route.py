@router.get("/reroute")
def reroute(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float
):
    url = "https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": f"{origin_lat},{origin_lng}",
        "destination": f"{dest_lat},{dest_lng}",
        "mode": "walking",
        "key": GOOGLE_MAPS_API_KEY,
    }

    res = requests.get(url, params=params, timeout=5)
    return res.json()
