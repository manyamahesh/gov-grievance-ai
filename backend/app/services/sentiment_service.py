from transformers import pipeline

# Load sentiment model once at startup
sentiment_pipeline = pipeline(
    "sentiment-analysis",
    model="nlptown/bert-base-multilingual-uncased-sentiment"
)

def analyze_sentiment(text: str) -> str:
    try:
        result = sentiment_pipeline(text)[0]
        label = result["label"]  # Example: "1 star", "5 stars"
        
        # Convert stars to sentiment category
        stars = int(label.split()[0])

        if stars <= 2:
            return "negative"
        elif stars == 3:
            return "neutral"
        else:
            return "positive"

    except Exception:
        return "unknown"
