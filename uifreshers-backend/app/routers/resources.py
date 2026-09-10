from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.dependencies import get_current_admin
from app.schemas.resource import ResourceCreate, ResourceOut, ResourceUpdate

router = APIRouter(prefix="/resources", tags=["resources"])


@router.get("", response_model=list[ResourceOut])
async def list_resources(category: str | None = None, db: AsyncIOMotorDatabase = Depends(get_db)):
    query = {"category": category} if category else {}
    return await db.resources.find(query).sort("title", 1).to_list(length=None)


@router.post("", response_model=ResourceOut, status_code=status.HTTP_201_CREATED)
async def create_resource(
    payload: ResourceCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    result = await db.resources.insert_one(payload.model_dump())
    return await db.resources.find_one({"_id": result.inserted_id})


@router.patch("/{resource_id}", response_model=ResourceOut)
async def update_resource(
    resource_id: str,
    payload: ResourceUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(resource_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid resource id")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        await db.resources.update_one({"_id": ObjectId(resource_id)}, {"$set": updates})
    resource = await db.resources.find_one({"_id": ObjectId(resource_id)})
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return resource


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(resource_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid resource id")
    await db.resources.delete_one({"_id": ObjectId(resource_id)})
    return None
