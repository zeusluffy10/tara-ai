from fastapi import FastAPI
from utils.openai_client import ask_openai

app = FastAPI()

@app.get("/")
def home():
    return {"message": "TARA AI backend is running!"}

@app.post("/ask")
def ask(question: str):
    answer = ask_openai(question)
    return {"answer": answer}
