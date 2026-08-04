import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/gov_grievance_db")
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey_change_in_production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Keep ANTHROPIC_API_KEY as empty alias so old imports don't break during transition
ANTHROPIC_API_KEY = GEMINI_API_KEY
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
MODEL_NAME = os.getenv("GEMINI_MODEL", "models/gemini-flash-latest")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT.lower() in ["production", "prod"]
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
COOKIE_SAMESITE = "none" if IS_PRODUCTION else "lax"
COOKIE_SECURE = True if IS_PRODUCTION else False