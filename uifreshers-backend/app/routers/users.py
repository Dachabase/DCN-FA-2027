from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import ACADEMIC_STATUS_VALUES
from app.schemas.user import ChangePasswordRequest, OnboardingRequest, UpdateProfileRequest, UserOut
from app.security import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_my_profile(
    payload: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}

    if "academic_status" in updates and updates["academic_status"] not in ACADEMIC_STATUS_VALUES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid academic_status")

    for field in ("faculty_id", "department_id"):
        if field in updates:
            if not ObjectId.is_valid(updates[field]):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field}")
            updates[field] = ObjectId(updates[field])

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db.users.update_one({"_id": current_user["_id"]}, {"$set": updates})

    return await db.users.find_one({"_id": current_user["_id"]})


@router.post("/me/onboarding", response_model=UserOut)
async def complete_onboarding(
    payload: OnboardingRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if payload.academic_status not in ACADEMIC_STATUS_VALUES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid academic_status")

    updates: dict = {
        "academic_status": payload.academic_status,
        "onboarding_completed": True,
        "updated_at": datetime.now(timezone.utc),
    }
    if payload.level:
        updates["level"] = payload.level
    for field_name, value in (("faculty_id", payload.faculty_id), ("department_id", payload.department_id)):
        if value:
            if not ObjectId.is_valid(value):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_name}")
            updates[field_name] = ObjectId(value)

    await db.users.update_one({"_id": current_user["_id"]}, {"$set": updates})
    return await db.users.find_one({"_id": current_user["_id"]})


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not current_user.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account signed up with Google and has no password set",
        )

    if not verify_password(payload.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    await db.users.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "password_hash": hash_password(payload.new_password),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    return None
