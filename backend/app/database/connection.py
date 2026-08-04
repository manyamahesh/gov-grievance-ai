from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import PyMongoError
import redis
import logging
from app.config import MONGO_URI, REDIS_URL
from app.services.llm_service import normalize_llm_analysis

logger = logging.getLogger(__name__)


class DummyCollection:
    """In-memory mock fallback when MongoDB is unreachable."""
    def __init__(self, name: str):
        self.name = name
        self.docs = []

    def insert_one(self, doc):
        self.docs.append(doc)
        return type("InsertResult", (), {"inserted_id": doc.get("_id", "mock_id")})()

    def find_one(self, filter_dict, projection=None):
        for doc in reversed(self.docs):
            match = True
            for k, v in filter_dict.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                res = doc.copy()
                if projection and "_id" in projection and projection["_id"] == 0:
                    res.pop("_id", None)
                return res
        return None

    def find(self, filter_dict=None, projection=None):
        matched = []
        filter_dict = filter_dict or {}
        for doc in self.docs:
            match = True
            for k, v in filter_dict.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                res = doc.copy()
                if projection and "_id" in projection and projection["_id"] == 0:
                    res.pop("_id", None)
                matched.append(res)
        
        class Cursor:
            def __init__(self, items):
                self.items = items
            def sort(self, key, direction=1):
                return self
            def skip(self, n):
                self.items = self.items[n:]
                return self
            def limit(self, n):
                self.items = self.items[:n]
                return self
            def __iter__(self):
                return iter(self.items)
            def __list__(self):
                return self.items

        return Cursor(matched)

    def update_one(self, filter_dict, update_dict):
        doc = self.find_one(filter_dict)
        if doc:
            if "$set" in update_dict:
                doc.update(update_dict["$set"])
            return type("UpdateResult", (), {"matched_count": 1, "modified_count": 1})()
        return type("UpdateResult", (), {"matched_count": 0, "modified_count": 0})()

    def count_documents(self, filter_dict=None):
        filter_dict = filter_dict or {}
        count = 0
        for doc in self.docs:
            match = True
            for k, v in filter_dict.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                count += 1
        return count

    def aggregate(self, pipeline):
        """In-memory processing of $match and $group stages for analytics aggregation."""
        working_docs = list(self.docs)

        for stage in pipeline:
            if "$match" in stage:
                match_filter = stage["$match"]
                if match_filter:
                    filtered = []
                    for doc in working_docs:
                        match = True
                        for k, v in match_filter.items():
                            if doc.get(k) != v:
                                match = False
                                break
                        if match:
                            filtered.append(doc)
                    working_docs = filtered

            elif "$group" in stage:
                group_spec = stage["$group"]
                id_spec = group_spec.get("_id")
                
                field_name = None
                default_val = None

                if isinstance(id_spec, dict) and "$ifNull" in id_spec:
                    target_ref, default_val = id_spec["$ifNull"]
                    if isinstance(target_ref, str) and target_ref.startswith("$"):
                        field_name = target_ref[1:]
                elif isinstance(id_spec, str) and id_spec.startswith("$"):
                    field_name = id_spec[1:]

                counts = {}
                for doc in working_docs:
                    val = doc.get(field_name) if field_name else None
                    if val is None or val == "":
                        val = default_val or "Unclassified"
                    counts[val] = counts.get(val, 0) + 1

                res = []
                for k, v in counts.items():
                    res.append({"_id": k, "count": v})
                return res

        return []

    def create_index(self, *args, **kwargs):
        pass


client = None
db = None
conversations_collection = None
tickets_collection = None
users_collection = None

try:
    if MONGO_URI:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")

        db = client["gov_grievance_db"]
        conversations_collection = db["conversations"]
        tickets_collection = db["tickets"]
        users_collection = db["users"]

        # Ensure MongoDB Indexes
        conversations_collection.create_index([("session_id", ASCENDING)])
        conversations_collection.create_index([("user_id", ASCENDING)])
        conversations_collection.create_index([("status", ASCENDING)])
        conversations_collection.create_index([("department", ASCENDING)])

        tickets_collection.create_index([("ticket_id", ASCENDING)], unique=True)
        tickets_collection.create_index([("status", ASCENDING)])
        tickets_collection.create_index([("department", ASCENDING)])
        tickets_collection.create_index([("created_at", DESCENDING)])

        users_collection.create_index([("username", ASCENDING)], unique=True)
        users_collection.create_index([("user_id", ASCENDING)], unique=True)

        logger.info("✅ Successfully connected to MongoDB Atlas & created database indexes!")
        print("✅ Successfully connected to MongoDB Atlas & created database indexes!")
    else:
        raise ValueError("MONGO_URI not provided")

except Exception as e:
    logger.warning(f"⚠️ MongoDB connection failed: {e}. Falling back to in-memory collection mode.")
    print(f"⚠️ MongoDB connection failed: {e}. Falling back to in-memory collection mode.")
    conversations_collection = DummyCollection("conversations")
    tickets_collection = DummyCollection("tickets")
    users_collection = DummyCollection("users")


def migrate_and_normalize_conversations():
    """One-time startup migration ensuring existing conversation documents have normalized department/priority/sentiment fields."""
    try:
        if hasattr(conversations_collection, "find"):
            docs = list(conversations_collection.find({}))
            for doc in docs:
                session_id = doc.get("session_id")
                if not session_id:
                    continue
                normalized = normalize_llm_analysis(doc)
                conversations_collection.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "department": normalized["department"],
                        "priority": normalized["priority"],
                        "sentiment": normalized["sentiment"]
                    }}
                )
    except Exception as e:
        logger.warning(f"Startup document normalization migration notice: {e}")


# Run initial document normalization migration
migrate_and_normalize_conversations()


# Redis Client Helper
redis_client = None
try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    redis_client.ping()
    print("✅ Redis client connected!")
except Exception as err:
    logger.warning(f"⚠️ Redis connection failed or unconfigured: {err}. Caching disabled.")
    redis_client = None