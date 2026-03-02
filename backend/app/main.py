from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import chat router
from app.routes.chat import router as chat_router
from app.routes.ticket import router as ticket_router
from app.routes.analytics import router as analytics_router
from app.routes.auth import router as auth_router
app = FastAPI(title="AI Government Grievance System")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include chat routes
app.include_router(chat_router)
app.include_router(ticket_router)
app.include_router(analytics_router)
app.include_router(auth_router)

# Startup event to verify MongoDB connection
@app.on_event("startup")
def startup_event():
    from app.database.connection import client
    client.admin.command("ping")
    print("✅ MongoDB Atlas connection verified on startup!")

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "System running successfully"}
