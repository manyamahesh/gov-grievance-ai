from app.services.llm_service import analyze_grievance_sync

def detect_language(text: str) -> str:
    """Detect language of text using LLM service wrapper."""
    try:
        res = analyze_grievance_sync([{"role": "user", "content": text}])
        return res.get("detected_language", "English")
    except Exception:
        return "English"
