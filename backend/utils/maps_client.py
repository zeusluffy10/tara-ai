import os
import requests
from dotenv import load_dotenv

load_dotenv()

GOOGLE_MAPS_SERVER_KEY = os.getenv("GOOGLE_MAPS_SERVER_KEY")

def get_place_coordinates(place_name: str):
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": place_name,
        "key": GOOGLE_MAPS_SERVER_KEY
    }

    response = requests.get(url, params=params).json()

    if response["status"] != "OK":
        return None

    location = response["results"][0]["geometry"]["location"]
    return {
        "lat": location["lat"],
        "lng": location["lng"]
    }

