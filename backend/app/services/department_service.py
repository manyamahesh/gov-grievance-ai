from app.services.llm_service import analyze_grievance_sync

def assign_department(message: str) -> str:
    """Assign department using LLM service wrapper."""
    try:
        res = analyze_grievance_sync([{"role": "user", "content": message}])
        return res.get("department", "General Administration")
    except Exception:
        return "General Administration"
