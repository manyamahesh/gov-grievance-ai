def assign_priority(sentiment: str) -> str:
    if sentiment == "negative":
        return "HIGH"
    elif sentiment == "neutral":
        return "MEDIUM"
    elif sentiment == "positive":
        return "LOW"
    else:
        return "MEDIUM"
