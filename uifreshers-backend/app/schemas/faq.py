from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.utils.object_id import PyObjectId


class FaqBase(BaseModel):
    question: str = Field(min_length=5, max_length=300)
    answer: str
    order: int = 0


class FaqCreate(FaqBase):
    pass


class FaqUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    order: Optional[int] = None


class FaqOut(FaqBase):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
