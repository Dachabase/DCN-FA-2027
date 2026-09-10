from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.utils.object_id import PyObjectId


class UserOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: PyObjectId = Field(alias="_id")
    full_name: str
    email: EmailStr
    avatar_url: Optional[str] = None
    provider: str
    academic_status: Optional[str] = None
    level: Optional[str] = None
    faculty_id: Optional[PyObjectId] = None
    department_id: Optional[PyObjectId] = None
    is_admin: bool = False
    onboarding_completed: bool = False
    created_at: datetime


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    academic_status: Optional[str] = None  # "current_student" | "prospective"
    level: Optional[str] = None
    faculty_id: Optional[str] = None
    department_id: Optional[str] = None


class OnboardingRequest(BaseModel):
    academic_status: str  # "current_student" | "prospective"
    level: Optional[str] = None
    faculty_id: Optional[str] = None
    department_id: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)
