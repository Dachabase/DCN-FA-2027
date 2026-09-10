from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.utils.object_id import PyObjectId

COURSE_TYPES = ("compulsory", "elective", "general_study", "faculty_core")


class CourseBase(BaseModel):
    code: str = Field(min_length=3, max_length=20)  # e.g. "CSC101"
    title: str
    description: Optional[str] = None
    units: int = Field(ge=1, le=10)
    level: str = "100L"
    semester: int = Field(ge=1, le=2)
    course_type: str = "compulsory"  # one of COURSE_TYPES
    department_id: str
    has_cbt_practice: bool = False
    telegram_practice_link: Optional[str] = None


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    code: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    units: Optional[int] = None
    level: Optional[str] = None
    semester: Optional[int] = None
    course_type: Optional[str] = None
    department_id: Optional[str] = None
    has_cbt_practice: Optional[bool] = None
    telegram_practice_link: Optional[str] = None


class CourseOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
    code: str
    title: str
    description: Optional[str] = None
    units: int
    level: str
    semester: int
    course_type: str
    department_id: PyObjectId
    has_cbt_practice: bool = False
    telegram_practice_link: Optional[str] = None
