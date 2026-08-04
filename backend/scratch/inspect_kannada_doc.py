import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.connection import conversations_collection, tickets_collection

def main():
    conv = conversations_collection.find_one({"grievance_ref": "GR-59F82143"})
    if not conv:
        conv = conversations_collection.find_one({})
    
    print("=== STORED KANNADA COMPLAINT DOCUMENT ===")
    print("grievance_id:", conv.get("grievance_id"))
    print("grievance_ref:", conv.get("grievance_ref"))
    print("detected_language:", conv.get("detected_language"))
    print("translated_text:", repr(conv.get("translated_text")))
    print("department:", conv.get("department"))
    print("priority:", conv.get("priority"))
    print("sentiment:", conv.get("sentiment"))
    print("ticket_id:", conv.get("ticket_id"))
    print("messages:", json.dumps(conv.get("messages", []), indent=2, default=str))

if __name__ == "__main__":
    main()
