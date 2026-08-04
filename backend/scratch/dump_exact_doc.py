import sys
import os
import json
from bson import json_util

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.connection import conversations_collection, tickets_collection, users_collection

def dump_db():
    print("=================== CONVERSATIONS COLLECTION DUMP ===================")
    convs = list(conversations_collection.find({}))
    print(f"Total Conversations Found: {len(convs)}")
    for i, c in enumerate(convs):
        print(f"\n--- Conversation #{i+1} ---")
        print(json.dumps(c, indent=2, default=str))

    print("\n=================== TICKETS COLLECTION DUMP ===================")
    tickets = list(tickets_collection.find({}))
    print(f"Total Tickets Found: {len(tickets)}")
    for i, t in enumerate(tickets):
        print(f"\n--- Ticket #{i+1} ---")
        print(json.dumps(t, indent=2, default=str))

if __name__ == "__main__":
    dump_db()
