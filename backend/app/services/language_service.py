from langdetect import detect

def detect_language(text: str) -> str:
    try:
        language = detect(text)
        return language
    except Exception:
        return "unknown"
