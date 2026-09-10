from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.utils.object_id import PyObjectId

RESOURCE_CATEGORIES = ("Academic", "General Studies", "Administrative")


class ResourceBase(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str
    category: str  # one of RESOURCE_CATEGORIES
    source_label: str = "Google Drive"
    link: str
    course_code: Optional[str] = None  # optional link to a specific course, e.g. "CSC101"


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    source_label: Optional[str] = None
    link: Optional[str] = None
    course_code: Optional[str] = None


class ResourceOut(ResourceBase):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
