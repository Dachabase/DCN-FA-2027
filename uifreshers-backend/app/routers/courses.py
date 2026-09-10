from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.dependencies import get_current_admin
from app.schemas.course import CourseCreate, CourseOut, CourseUpdate

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[CourseOut])
async def list_courses(
    department_id: str | None = None,
    level: str | None = None,
    course_type: str | None = None,
    has_cbt_practice: bool | None = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query: dict = {}
    if department_id:
        if not ObjectId.is_valid(department_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department_id")
        query["department_id"] = ObjectId(department_id)
    if level:
        query["level"] = level
    if course_type:
        query["course_type"] = course_type
    if has_cbt_practice is not None:
        query["has_cbt_practice"] = has_cbt_practice

    return await db.courses.find(query).sort("code", 1).to_list(length=None)


@router.get("/{course_id}", response_model=CourseOut)
async def get_course(course_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    if not ObjectId.is_valid(course_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course id")
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(payload.department_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department_id")
    department = await db.departments.find_one({"_id": ObjectId(payload.department_id)})
    if not department:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    doc = payload.model_dump()
    doc["department_id"] = ObjectId(payload.department_id)
    doc["code"] = doc["code"].upper()

    existing = await db.courses.find_one({"department_id": doc["department_id"], "code": doc["code"]})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course code already exists in this department")

    result = await db.courses.insert_one(doc)
    return await db.courses.find_one({"_id": result.inserted_id})


@router.patch("/{course_id}", response_model=CourseOut)
async def update_course(
    course_id: str,
    payload: CourseUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(course_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course id")
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "department_id" in updates:
        if not ObjectId.is_valid(updates["department_id"]):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department_id")
        updates["department_id"] = ObjectId(updates["department_id"])
    if "code" in updates:
        updates["code"] = updates["code"].upper()
    if updates:
        await db.courses.update_one({"_id": ObjectId(course_id)}, {"$set": updates})
    course = await db.courses.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    _admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(course_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course id")
    await db.courses.delete_one({"_id": ObjectId(course_id)})
    return None
