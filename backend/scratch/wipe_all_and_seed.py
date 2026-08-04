import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.connection import conversations_collection, tickets_collection, users_collection
from app.services.user_service import hash_password

def full_wipe_and_seed():
    print("--- BEFORE FULL WIPE ---")
    u_before = users_collection.count_documents({}) if hasattr(users_collection, "count_documents") else len(users_collection.docs)
    c_before = conversations_collection.count_documents({}) if hasattr(conversations_collection, "count_documents") else len(conversations_collection.docs)
    t_before = tickets_collection.count_documents({}) if hasattr(tickets_collection, "count_documents") else len(tickets_collection.docs)

    print(f"Users Count: {u_before}")
    print(f"Conversations Count: {c_before}")
    print(f"Tickets Count: {t_before}")

    # Delete all documents from all collections
    if hasattr(users_collection, "delete_many"):
        users_collection.delete_many({})
        conversations_collection.delete_many({})
        tickets_collection.delete_many({})
    else:
        users_collection.docs.clear()
        conversations_collection.docs.clear()
        tickets_collection.docs.clear()

    # Recreate standard super_admin account in users_collection
    admin_doc = {
        "user_id": "usr_super_admin_001",
        "username": "admin",
        "password_hash": hash_password("admin123"),
        "role": "super_admin",
        "department": "All",
        "created_at": "2026-08-02T00:00:00Z"
    }

    if hasattr(users_collection, "insert_one"):
        users_collection.insert_one(admin_doc)
    else:
        users_collection.docs.append(admin_doc)

    print("\n--- AFTER FULL WIPE & ADMIN SEED ---")
    u_after = users_collection.count_documents({}) if hasattr(users_collection, "count_documents") else len(users_collection.docs)
    c_after = conversations_collection.count_documents({}) if hasattr(conversations_collection, "count_documents") else len(conversations_collection.docs)
    t_after = tickets_collection.count_documents({}) if hasattr(tickets_collection, "count_documents") else len(tickets_collection.docs)

    print(f"Users Count (Recreated Admin): {u_after}")
    print(f"Conversations Count: {c_after}")
    print(f"Tickets Count: {t_after}")

if __name__ == "__main__":
    full_wipe_and_seed()
