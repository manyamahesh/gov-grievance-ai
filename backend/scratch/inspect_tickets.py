import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.connection import conversations_collection, tickets_collection, users_collection

def inspect_db():
    print("=== USERS COLLECTION ===")
    users = list(users_collection.find({}, {"_id": 0})) if hasattr(users_collection, "find") else users_collection.docs
    print(f"Total Users: {len(users)}")
    for u in users:
        print("User:", u)

    print("\n=== CONVERSATIONS COLLECTION ===")
    convs = list(conversations_collection.find({}, {"_id": 0})) if hasattr(conversations_collection, "find") else conversations_collection.docs
    print(f"Total Conversations: {len(convs)}")
    for c in convs:
        print("Conv ID:", c.get("grievance_id"), "Ref:", c.get("grievance_ref"), "Priority:", c.get("priority"), "Dept:", c.get("department"), "TicketID:", c.get("ticket_id"))

    print("\n=== TICKETS COLLECTION ===")
    tickets = list(tickets_collection.find({}, {"_id": 0})) if hasattr(tickets_collection, "find") else tickets_collection.docs
    print(f"Total Tickets: {len(tickets)}")
    for t in tickets:
        print("Ticket:", t)

if __name__ == "__main__":
    inspect_db()
