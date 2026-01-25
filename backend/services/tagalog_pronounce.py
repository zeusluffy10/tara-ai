# backend/services/tagalog_pronounce.py
import re
from typing import Literal

Style = Literal["calm", "warning"]

# Very practical, high-impact substitutions for PH Tagalog TTS.
# Keep this list small + focused; add words as you encounter issues.
REPLACEMENTS = [
    # common: direction words
    (r"\bkumanan\b", "ku-ma-nan"),  # your example (if your text sometimes contains this)
    (r"\bkumain\b", "ku-ma-in"),
    (r"\bkain\b", "ka-in"),
    (r"\bdumaan\b", "du-ma-an"),
    (r"\bumikot\b", "u-mi-kot"),
    (r"\bkaliwa\b", "ka-li-wa"),
    (r"\bkanan\b", "ka-nan"),
    (r"\bdiretso\b", "di-ret-so"),
    (r"\bmalapit\b", "ma-la-pit"),
    (r"\bmalayo\b", "ma-la-yo"),
    (r"\btawid\b", "ta-wid"),
    (r"\bhinto\b", "hin-to"),

    # polite phrases (if you use them)
    (r"\bpo\b", "po"),
    (r"\bopo\b", "o-po"),
]

def _apply_replacements(text: str) -> str:
    out = text
    for pattern, repl in REPLACEMENTS:
        out = re.sub(pattern, repl, out, flags=re.IGNORECASE)
    return out

def _style_wrap(text: str, style: Style) -> str:
    # Emotion is mostly: pacing + emphasis.
    # We do it with punctuation + short phrases (works reliably across TTS engines).
    if style == "warning":
        # sharper, shorter, more urgent
        return f"Babala! {text.strip()}!"
    return text.strip()

def normalize_tagalog(text: str, style: Style = "calm") -> str:
    t = text.strip()
    t = _apply_replacements(t)
    t = _style_wrap(t, style)
    # light cleanup
    t = re.sub(r"\s+", " ", t)
    return t
