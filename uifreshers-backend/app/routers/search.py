import re

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.schemas.search import SearchResults

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResults)
async def global_search(
    q: str = Query(min_length=1, max_length=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    pattern = re.compile(re.escape(q), re.IGNORECASE)

    faculties = await db.faculties.find({"name": pattern}).limit(5).to_list(length=None)
    departments = await db.departments.find({"name": pattern}).limit(5).to_list(length=None)
    courses = await db.courses.find(
        {"$or": [{"code": pattern}, {"title": pattern}]}
    ).limit(10).to_list(length=None)
    guides = await db.guides.find(
        {"$or": [{"title": pattern}, {"summary": pattern}]}
    ).limit(5).to_list(length=None)

    # Attach department course_count for consistency with the departments endpoint
    for d in departments:
        d["course_count"] = await db.courses.count_documents({"department_id": d["_id"]})

    # Attach faculty department/course counts
    enriched_faculties = []
    for f in faculties:
        department_ids = [dep["_id"] async for dep in db.departments.find({"faculty_id": f["_id"]}, {"_id": 1})]
        enriched_faculties.append(
            {
                **f,
                "department_count": len(department_ids),
                "course_count": await db.courses.count_documents({"department_id": {"$in": department_ids}}),
            }
        )

    return SearchResults(faculties=enriched_faculties, departments=departments, courses=courses, guides=guides)
