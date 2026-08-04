from app.services.llm_service import analyze_grievance_sync

def analyze_sentiment(text: str) -> str:
    """Analyze sentiment of text using LLM service wrapper."""
    try:
        res = analyze_grievance_sync([{"role": "user", "content": text}])
        return res.get("sentiment", "neutral")
    except Exception:
        return "neutral"
