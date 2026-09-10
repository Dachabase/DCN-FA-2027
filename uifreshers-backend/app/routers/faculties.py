from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.dependencies import get_current_admin
from app.schemas.faculty import FacultyCreate, FacultyOut, FacultyUpdate

router = APIRouter(prefix="/faculties", tags=["faculties"])


async def _with_counts(db: AsyncIOMotorDatabase, faculty: dict) -> dict:
    department_count = await db.departments.count_documents({"faculty_id": faculty["_id"]})
    department_ids = [d["_id"] async for d in db.departments.find({"faculty_id": faculty["_id"]}, {"_id": 1})]
    course_count = await db.courses.count_documents({"department_id": {"$in": department_ids}})
    return {**faculty, "department_count": department_count, "course_count": course_count}


@router.get("", response_model=list[FacultyOut])
async def list_faculties(category: str | None = None, db: AsyncIOMotorDatabase = Depends(get_db)):
    query = {"category": category} if category else {}
    faculties = await db.faculties.find(query).sort("name", 1).to_list(length=None)
    return [await _with_counts(db, f) for f in faculties]


@router.get("/{faculty_id}", response_model=FacultyOut)
async def get_faculty(faculty_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    if not ObjectId.is_valid(faculty_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid faculty id")
    faculty = await db.faculties.find_one({"_id": ObjectId(faculty_id)})
    if not faculty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty not found")
    return await _with_counts(db, faculty)


@router.post("", response_model=FacultyOut, status_code=status.HTTP_201_CREATED)
async def create_faculty(
    payload: FacultyCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    existing = await db.faculties.find_one({"slug": payload.slug})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A faculty with this slug already exists")
    result = await db.faculties.insert_one(payload.model_dump())
    faculty = await db.faculties.find_one({"_id": result.inserted_id})
    return await _with_counts(db, faculty)


@router.patch("/{faculty_id}", response_model=FacultyOut)
async def update_faculty(
    faculty_id: str,
    payload: FacultyUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(faculty_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid faculty id")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        await db.faculties.update_one({"_id": ObjectId(faculty_id)}, {"$set": updates})
    faculty = await db.faculties.find_one({"_id": ObjectId(faculty_id)})
    if not faculty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty not found")
    return await _with_counts(db, faculty)


@router.delete("/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faculty(
    faculty_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(faculty_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid faculty id")
    await db.faculties.delete_one({"_id": ObjectId(faculty_id)})
    return None
