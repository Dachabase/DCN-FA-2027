from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.dependencies import get_current_admin
from app.schemas.opportunity import OpportunityCreate, OpportunityOut, OpportunityUpdate

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("", response_model=list[OpportunityOut])
async def list_opportunities(type: str | None = None, db: AsyncIOMotorDatabase = Depends(get_db)):
    query = {"type": type} if type else {}
    return await db.opportunities.find(query).sort("deadline", 1).to_list(length=None)


@router.post("", response_model=OpportunityOut, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    payload: OpportunityCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    result = await db.opportunities.insert_one(payload.model_dump())
    return await db.opportunities.find_one({"_id": result.inserted_id})


@router.patch("/{opportunity_id}", response_model=OpportunityOut)
async def update_opportunity(
    opportunity_id: str,
    payload: OpportunityUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(opportunity_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid opportunity id")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        await db.opportunities.update_one({"_id": ObjectId(opportunity_id)}, {"$set": updates})
    opportunity = await db.opportunities.find_one({"_id": ObjectId(opportunity_id)})
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
    return opportunity


@router.delete("/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(
    opportunity_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(opportunity_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid opportunity id")
    await db.opportunities.delete_one({"_id": ObjectId(opportunity_id)})
    return None
