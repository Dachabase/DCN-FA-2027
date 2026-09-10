from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.utils.object_id import PyObjectId


class FacultyBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=120)
    category: str  # e.g. "STEM & Computing", "Medical & Health", "Arts & Social Sciences", "Law & Education"
    description: Optional[str] = None
    icon: Optional[str] = None  # icon name from the frontend icon set (e.g. lucide icon key)
    color: Optional[str] = None  # accent color hex for UI


class FacultyCreate(FacultyBase):
    pass


class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class FacultyOut(FacultyBase):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
    department_count: int = 0
    course_count: int = 0
