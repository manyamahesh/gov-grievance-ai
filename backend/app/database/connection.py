from pymongo import MongoClient
from app.config import MONGO_URI


if not MONGO_URI:
    raise ValueError("❌ MONGO_URI not found in environment variables")


try:
    client = MongoClient(MONGO_URI)

    # Force connection test
    client.admin.command("ping")

    db = client["gov_grievance_db"]

    conversations_collection = db["conversations"]
    tickets_collection = db["tickets"]

    print("✅ Successfully connected to MongoDB Atlas!")

except Exception as e:
    print("❌ MongoDB connection failed:", e)
    raise e