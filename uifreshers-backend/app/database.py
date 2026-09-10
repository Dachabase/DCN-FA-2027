from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings

settings = get_settings()


class MongoDB:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


mongodb = MongoDB()


async def connect_to_mongo() -> None:
    mongodb.client = AsyncIOMotorClient(settings.mongodb_uri)
    mongodb.db = mongodb.client[settings.mongodb_db_name]
    await ensure_indexes()


async def close_mongo_connection() -> None:
    if mongodb.client:
        mongodb.client.close()


async def ensure_indexes() -> None:
    """Create indexes needed for uniqueness / lookup performance."""
    db = mongodb.db
    await db.users.create_index("email", unique=True)
    await db.users.create_index("google_sub", unique=True, sparse=True)
    await db.refresh_tokens.create_index("token_hash", unique=True)
    await db.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.faculties.create_index("slug", unique=True)
    await db.departments.create_index([("faculty_id", 1), ("slug", 1)], unique=True)
    await db.courses.create_index([("department_id", 1), ("code", 1)], unique=True)
    await db.guides.create_index("slug", unique=True)
    await db.resources.create_index("title")
    await db.opportunities.create_index("deadline")
    await db.faqs.create_index("order")


def get_db() -> AsyncIOMotorDatabase:
    return mongodb.db
