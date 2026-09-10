from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.utils.object_id import PyObjectId

OPPORTUNITY_TYPES = ("Scholarship", "Work-Study", "Hackathon", "Mentorship")


class OpportunityBase(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    type: str  # one of OPPORTUNITY_TYPES
    description: str
    deadline: Optional[date] = None
    link: str


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[date] = None
    link: Optional[str] = None


class OpportunityOut(OpportunityBase):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
