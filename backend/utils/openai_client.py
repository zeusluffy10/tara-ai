import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)

def ask_openai(question: str):
    response = client.chat.completions.create(
        model="gpt-5-mini",
        messages=[{"role": "user", "content": question}]
    )
    return response.choices[0].message["content"]
