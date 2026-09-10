from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import close_mongo_connection, connect_to_mongo
from app.routers import (
    auth,
    courses,
    departments,
    faculties,
    faqs,
    guides,
    opportunities,
    resources,
    search,
    users,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title=settings.app_name,
    description="Backend API for the UI Freshers Companion webapp.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(faculties.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(courses.router, prefix="/api")
app.include_router(guides.router, prefix="/api")
app.include_router(resources.router, prefix="/api")
app.include_router(opportunities.router, prefix="/api")
app.include_router(faqs.router, prefix="/api")
app.include_router(search.router, prefix="/api")


@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}


@app.get("/", tags=["health"])
async def root():
    return {"message": f"{settings.app_name} is running. See /docs for API documentation."}
