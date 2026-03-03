def detect_language(message: str) -> str:
    # Simple heuristic detection
    try:
        message.encode("ascii")
        return "English"
    except UnicodeEncodeError:
        return "Non-English"
def detect_language(text: str) -> str:
    try:
        language = detect(text)
        return language
    except Exception:
        return "unknown"
