from fastapi import FastAPI
from utils.openai_client import ask_openai
from utils.maps_client import get_place_coordinates

app = FastAPI()

@app.get("/")
def home():
    return {"message": "TARA AI backend running!"}

@app.post("/ask")
def ask_route(question: str):
    answer = ask_openai(question)
    return {"answer": answer}

@app.get("/geocode")
def geocode(place: str):
    coords = get_place_coordinates(place)
    return coords or {"error": "Place not found"}
