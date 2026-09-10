from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.utils.object_id import PyObjectId

GUIDE_CATEGORIES = (
    "Faculty Guides",
    "Academic Mastery",
    "Exam Prep",
    "Study Strategy",
    "Student Life & Business",
    "Productivity & Mindset",
    "Course Registration",
    "Grading System",
    "Campus Navigation",
)


class GuideBase(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    slug: str = Field(min_length=3, max_length=200)
    category: str
    summary: str
    content: str  # markdown or HTML body
    cover_image: Optional[str] = None
    read_time_minutes: int = Field(default=5, ge=1, le=60)
    verified: bool = True


class GuideCreate(GuideBase):
    pass


class GuideUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    cover_image: Optional[str] = None
    read_time_minutes: Optional[int] = None
    verified: Optional[bool] = None


class GuideOut(GuideBase):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
    created_at: datetime
    updated_at: datetime


class GuideListItem(BaseModel):
    """Lighter payload for list views (omits full content)."""

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
    title: str
    slug: str
    category: str
    summary: str
    cover_image: Optional[str] = None
    read_time_minutes: int
    verified: bool
