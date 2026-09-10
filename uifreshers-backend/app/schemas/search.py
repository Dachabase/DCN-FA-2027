from pydantic import BaseModel

from app.schemas.course import CourseOut
from app.schemas.department import DepartmentOut
from app.schemas.faculty import FacultyOut
from app.schemas.guide import GuideListItem


class SearchResults(BaseModel):
    faculties: list[FacultyOut] = []
    departments: list[DepartmentOut] = []
    courses: list[CourseOut] = []
    guides: list[GuideListItem] = []
