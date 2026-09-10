from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.dependencies import get_current_admin
from app.schemas.guide import GuideCreate, GuideListItem, GuideOut, GuideUpdate

router = APIRouter(prefix="/guides", tags=["guides"])


@router.get("", response_model=list[GuideListItem])
async def list_guides(category: str | None = None, db: AsyncIOMotorDatabase = Depends(get_db)):
    query = {"category": category} if category else {}
    return await db.guides.find(query).sort("created_at", -1).to_list(length=None)


@router.get("/{slug}", response_model=GuideOut)
async def get_guide(slug: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    guide = await db.guides.find_one({"slug": slug})
    if not guide:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide not found")
    return guide


@router.post("", response_model=GuideOut, status_code=status.HTTP_201_CREATED)
async def create_guide(
    payload: GuideCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    existing = await db.guides.find_one({"slug": payload.slug})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A guide with this slug already exists")
    now = datetime.now(timezone.utc)
    doc = {**payload.model_dump(), "created_at": now, "updated_at": now}
    result = await db.guides.insert_one(doc)
    return await db.guides.find_one({"_id": result.inserted_id})


@router.patch("/{guide_id}", response_model=GuideOut)
async def update_guide(
    guide_id: str,
    payload: GuideUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(guide_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid guide id")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db.guides.update_one({"_id": ObjectId(guide_id)}, {"$set": updates})
    guide = await db.guides.find_one({"_id": ObjectId(guide_id)})
    if not guide:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guide not found")
    return guide


@router.delete("/{guide_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guide(
    guide_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(guide_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid guide id")
    await db.guides.delete_one({"_id": ObjectId(guide_id)})
    return None
