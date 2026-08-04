import os
import logging
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Configure Structured Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger("gov-grievance-backend")

from app.routes.chat import router as chat_router, limiter
from app.routes.ticket import router as ticket_router
from app.routes.analytics import router as analytics_router
from app.routes.auth import router as auth_router
from app.routes.user_auth import router as user_auth_router
from app.routes.admin_users import router as admin_users_router
from app.database.connection import client as mongo_client, redis_client

app = FastAPI(
    title="AI-Based Government Grievance Management System",
    description="Multi-language conversational grievance intake powered by Anthropic Claude, Redis caching, SLA escalation, and RBAC admin portal.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Attach slowapi rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.config import FRONTEND_URL

cors_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:3003",
]
if FRONTEND_URL:
    cors_origins.append(FRONTEND_URL.rstrip("/"))

# Configure CORS with credential support
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://.*(vercel\.app|onrender\.com|localhost|127\.0\.0\.1).*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Mount Static Uploads Folder
uploads_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Router Inclusion with OpenAPI Tags
app.include_router(chat_router, tags=["Conversational Chat Intake"])
app.include_router(user_auth_router, tags=["Citizen Authentication"])
app.include_router(ticket_router, tags=["Ticket & Feedback Management"])
app.include_router(analytics_router, tags=["Analytics & Reporting"])
app.include_router(auth_router, tags=["Authentication & Admin RBAC"])
app.include_router(admin_users_router, tags=["Admin Citizen Management"])


@app.on_event("startup")
def startup_event():
    try:
        if mongo_client:
            mongo_client.admin.command("ping")
            logger.info("✅ MongoDB Atlas connection verified on startup!")
        else:
            logger.info("ℹ️ Running in-memory database fallback mode (MongoDB Atlas unreachable).")
    except Exception as e:
        logger.error(f"❌ MongoDB connection error on startup: {e}")


@app.get(
    "/health",
    summary="System Health Check",
    description="Inspects live connectivity for MongoDB database and Redis cache.",
    tags=["System Health"]
)
def health_check():
    mongo_status = "unhealthy"
    if mongo_client:
        try:
            mongo_client.admin.command("ping")
            mongo_status = "healthy"
        except Exception:
            mongo_status = "unhealthy"

    redis_status = "disconnected"
    if redis_client:
        try:
            if redis_client.ping():
                redis_status = "healthy"
        except Exception:
            redis_status = "unhealthy"

    overall_status = "healthy" if mongo_status == "healthy" else "degraded"

    return {
        "status": overall_status,
        "services": {
            "mongodb": mongo_status,
            "redis": redis_status
        }
    }
