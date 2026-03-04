def analyze_sentiment(text: str) -> str:
    text = text.lower()

    negative_words = [
        "bad", "worst", "complaint", "issue", "problem",
        "delay", "angry", "broken", "not working",
        "damage", "corruption", "fraud", "unsafe",
        "dirty", "garbage", "water leakage", "electricity problem"
    ]

    positive_words = [
        "good", "great", "thanks", "thank you",
        "helpful", "resolved", "fixed", "appreciate"
    ]

    negative_score = sum(word in text for word in negative_words)
    positive_score = sum(word in text for word in positive_words)

    if negative_score > positive_score:
        return "negative"
    elif positive_score > negative_score:
        return "positive"
    else:
        return "neutral"
