import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)

def ask_openai(prompt: str):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are TARA AI, a navigation assistant."},
            {"role": "user", "content": prompt}
        ],
    )

    # robustly get the message content (works for object-like or dict-like responses)
    choice = response.choices[0]
    # try attribute first
    msg = getattr(choice.message, "content", None)
    if msg is not None:
        return msg

    # then try dict-like access
    try:
        return choice.message["content"]
    except Exception:
        # fallback to string representation if all else fails
        return str(choice)
