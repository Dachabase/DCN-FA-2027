from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.dependencies import get_current_admin
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate

router = APIRouter(prefix="/departments", tags=["departments"])


async def _with_course_count(db: AsyncIOMotorDatabase, department: dict) -> dict:
    course_count = await db.courses.count_documents({"department_id": department["_id"]})
    return {**department, "course_count": course_count}


@router.get("", response_model=list[DepartmentOut])
async def list_departments(faculty_id: str | None = None, db: AsyncIOMotorDatabase = Depends(get_db)):
    query = {}
    if faculty_id:
        if not ObjectId.is_valid(faculty_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid faculty_id")
        query["faculty_id"] = ObjectId(faculty_id)
    departments = await db.departments.find(query).sort("name", 1).to_list(length=None)
    return [await _with_course_count(db, d) for d in departments]


@router.get("/{department_id}", response_model=DepartmentOut)
async def get_department(department_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    if not ObjectId.is_valid(department_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department id")
    department = await db.departments.find_one({"_id": ObjectId(department_id)})
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return await _with_course_count(db, department)


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(payload.faculty_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid faculty_id")
    faculty = await db.faculties.find_one({"_id": ObjectId(payload.faculty_id)})
    if not faculty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty not found")

    doc = payload.model_dump()
    doc["faculty_id"] = ObjectId(payload.faculty_id)

    existing = await db.departments.find_one({"faculty_id": doc["faculty_id"], "slug": doc["slug"]})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department slug already exists in this faculty")

    result = await db.departments.insert_one(doc)
    department = await db.departments.find_one({"_id": result.inserted_id})
    return await _with_course_count(db, department)


@router.patch("/{department_id}", response_model=DepartmentOut)
async def update_department(
    department_id: str,
    payload: DepartmentUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(department_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department id")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "faculty_id" in updates:
        if not ObjectId.is_valid(updates["faculty_id"]):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid faculty_id")
        updates["faculty_id"] = ObjectId(updates["faculty_id"])
    if updates:
        await db.departments.update_one({"_id": ObjectId(department_id)}, {"$set": updates})
    department = await db.departments.find_one({"_id": ObjectId(department_id)})
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return await _with_course_count(db, department)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(department_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department id")
    await db.departments.delete_one({"_id": ObjectId(department_id)})
    return None
