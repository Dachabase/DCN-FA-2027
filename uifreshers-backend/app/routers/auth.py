from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserOut
from app.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


async def _issue_tokens(db: AsyncIOMotorDatabase, user_id: ObjectId) -> TokenResponse:
    access_token = create_access_token(subject=str(user_id))
    raw_refresh = generate_refresh_token()

    await db.refresh_tokens.insert_one(
        {
            "user_id": user_id,
            "token_hash": hash_refresh_token(raw_refresh),
            "created_at": datetime.now(timezone.utc),
            "expires_at": refresh_token_expiry(),
        }
    )

    return TokenResponse(access_token=access_token, refresh_token=raw_refresh)


def _maybe_admin(email: str) -> bool:
    return bool(settings.admin_bootstrap_email) and email.lower() == settings.admin_bootstrap_email.lower()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")

    now = datetime.now(timezone.utc)
    user_doc = {
        "full_name": payload.full_name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "provider": "email",
        "google_sub": None,
        "avatar_url": None,
        "academic_status": None,
        "level": None,
        "faculty_id": None,
        "department_id": None,
        "is_admin": _maybe_admin(email),
        "is_active": True,
        "onboarding_completed": False,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(user_doc)
    return await _issue_tokens(db, result.inserted_id)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})

    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    return await _issue_tokens(db, user["_id"])


@router.post("/google", response_model=TokenResponse)
async def google_auth(payload: GoogleAuthRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google sign-in is not configured on this server",
        )

    try:
        idinfo = google_id_token.verify_oauth2_token(
            payload.id_token, google_requests.Request(), settings.google_client_id
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    google_sub = idinfo["sub"]
    email = idinfo.get("email", "").lower()
    full_name = idinfo.get("name", email.split("@")[0] if email else "Student")
    avatar_url = idinfo.get("picture")

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account has no email")

    user = await db.users.find_one({"google_sub": google_sub})

    if user is None:
        # Check if an email-registered account already exists -> link it
        existing_email_user = await db.users.find_one({"email": email})
        now = datetime.now(timezone.utc)

        if existing_email_user:
            await db.users.update_one(
                {"_id": existing_email_user["_id"]},
                {
                    "$set": {
                        "google_sub": google_sub,
                        "provider": "both",
                        "avatar_url": existing_email_user.get("avatar_url") or avatar_url,
                        "updated_at": now,
                    }
                },
            )
            user = await db.users.find_one({"_id": existing_email_user["_id"]})
        else:
            user_doc = {
                "full_name": full_name,
                "email": email,
                "password_hash": None,
                "provider": "google",
                "google_sub": google_sub,
                "avatar_url": avatar_url,
                "academic_status": None,
                "level": None,
                "faculty_id": None,
                "department_id": None,
                "is_admin": _maybe_admin(email),
                "is_active": True,
                "onboarding_completed": False,
                "created_at": now,
                "updated_at": now,
            }
            result = await db.users.insert_one(user_doc)
            user = await db.users.find_one({"_id": result.inserted_id})

    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    return await _issue_tokens(db, user["_id"])


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(payload: RefreshRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    token_hash = hash_refresh_token(payload.refresh_token)
    stored = await db.refresh_tokens.find_one({"token_hash": token_hash})

    if not stored or stored["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    # Rotate: delete old, issue new pair
    await db.refresh_tokens.delete_one({"_id": stored["_id"]})
    return await _issue_tokens(db, stored["user_id"])


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    token_hash = hash_refresh_token(payload.refresh_token)
    await db.refresh_tokens.delete_one({"token_hash": token_hash})
    return None


@router.get("/me", response_model=UserOut)
async def read_current_user(current_user: dict = Depends(get_current_user)):
    return current_user
