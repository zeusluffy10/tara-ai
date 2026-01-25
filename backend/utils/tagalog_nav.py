import re

def _clean(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s

def tagalog_rewrite(text: str) -> str:
    """
    Convert common English navigation phrases into pure Tagalog.
    This is a best-effort rule-based rewrite (works great for Directions steps).
    """
    t = _clean(text)

    # Remove HTML leftovers if any
    t = re.sub(r"<[^>]+>", "", t)

    # Normalize quotes
    t = t.replace("’", "'").replace("“", '"').replace("”", '"')

    # Common replacements (pure Tagalog)
    repl = [
        (r"\bHead north\b", "Dumiretso pahilaga"),
        (r"\bHead south\b", "Dumiretso patimog"),
        (r"\bHead east\b", "Dumiretso pasilangan"),
        (r"\bHead west\b", "Dumiretso pakanluran"),

        (r"\bContinue\b", "Magpatuloy"),
        (r"\bKeep left\b", "Manatili sa kaliwa"),
        (r"\bKeep right\b", "Manatili sa kanan"),

        (r"\bTurn left\b", "Kumaliwa"),
        (r"\bTurn right\b", "Kumanan"),
        (r"\bSlight left\b", "Bahagyang kumaliwa"),
        (r"\bSlight right\b", "Bahagyang kumanan"),

        (r"\bMake a U-turn\b", "Mag-U-turn"),
        (r"\bU-turn\b", "U-turn"),

        (r"\bExit\b", "Lumabas"),
        (r"\bTake the exit\b", "Dumaan sa labasan"),
        (r"\bMerge\b", "Sumanib sa daan"),

        (r"\bDestination will be on the left\b", "Ang pupuntahan ay nasa kaliwa"),
        (r"\bDestination will be on the right\b", "Ang pupuntahan ay nasa kanan"),
        (r"\bYou have arrived\b", "Nakarating na tayo"),
        (r"\bArrive\b", "Dumating"),
    ]

    for pattern, replacement in repl:
        t = re.sub(pattern, replacement, t, flags=re.IGNORECASE)

    # If it still starts with an English imperative, force Tagalog "Gawin ito:"
    # (optional safety)
    # Example: "Walk to..." => "Maglakad papunta sa..."
    t = re.sub(r"^\bWalk\b", "Maglakad", t, flags=re.IGNORECASE)
    t = re.sub(r"^\bGo\b", "Pumunta", t, flags=re.IGNORECASE)

    # Final cleanup
    t = _clean(t)

    # Add punctuation to help natural TTS
    if t and not t.endswith((".", "?", "!")):
        t += "."

    return t

def tagalog_distance_phrase(meters: int) -> str:
    if meters < 15:
        return "Malapit na."
    return f"Pagkalipas ng {meters} metro,"
