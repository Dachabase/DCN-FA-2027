from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.dependencies import get_current_admin
from app.schemas.faq import FaqCreate, FaqOut, FaqUpdate

router = APIRouter(prefix="/faqs", tags=["faqs"])


@router.get("", response_model=list[FaqOut])
async def list_faqs(db: AsyncIOMotorDatabase = Depends(get_db)):
    return await db.faqs.find().sort("order", 1).to_list(length=None)


@router.post("", response_model=FaqOut, status_code=status.HTTP_201_CREATED)
async def create_faq(
    payload: FaqCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    result = await db.faqs.insert_one(payload.model_dump())
    return await db.faqs.find_one({"_id": result.inserted_id})


@router.patch("/{faq_id}", response_model=FaqOut)
async def update_faq(
    faq_id: str,
    payload: FaqUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(faq_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid faq id")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        await db.faqs.update_one({"_id": ObjectId(faq_id)}, {"$set": updates})
    faq = await db.faqs.find_one({"_id": ObjectId(faq_id)})
    if not faq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ not found")
    return faq


@router.delete("/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faq(
    faq_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(faq_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid faq id")
    await db.faqs.delete_one({"_id": ObjectId(faq_id)})
    return None
