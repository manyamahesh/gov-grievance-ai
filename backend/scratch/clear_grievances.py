import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.connection import conversations_collection, tickets_collection, users_collection

def clear_grievance_data():
    print("--- BEFORE CLEARING ---")
    users_before = users_collection.count_documents({}) if hasattr(users_collection, "count_documents") else len(users_collection.docs)
    conversations_before = conversations_collection.count_documents({}) if hasattr(conversations_collection, "count_documents") else len(conversations_collection.docs)
    tickets_before = tickets_collection.count_documents({}) if hasattr(tickets_collection, "count_documents") else len(tickets_collection.docs)

    print(f"Users Collection Count: {users_before}")
    print(f"Conversations Collection Count: {conversations_before}")
    print(f"Tickets Collection Count: {tickets_before}")

    # Delete all documents from conversations and tickets
    if hasattr(conversations_collection, "delete_many"):
        conversations_collection.delete_many({})
    else:
        conversations_collection.docs.clear()

    if hasattr(tickets_collection, "delete_many"):
        tickets_collection.delete_many({})
    else:
        tickets_collection.docs.clear()

    print("\n--- AFTER CLEARING ---")
    users_after = users_collection.count_documents({}) if hasattr(users_collection, "count_documents") else len(users_collection.docs)
    conversations_after = conversations_collection.count_documents({}) if hasattr(conversations_collection, "count_documents") else len(conversations_collection.docs)
    tickets_after = tickets_collection.count_documents({}) if hasattr(tickets_collection, "count_documents") else len(tickets_collection.docs)

    print(f"Users Collection Count (Unchanged): {users_after}")
    print(f"Conversations Collection Count (Cleared): {conversations_after}")
    print(f"Tickets Collection Count (Cleared): {tickets_after}")

if __name__ == "__main__":
    clear_grievance_data()
