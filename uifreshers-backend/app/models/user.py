"""
Mongo document shape for `users` collection (informal reference, not an ODM):

{
  _id: ObjectId,
  full_name: str,
  email: str (unique, lowercased),
  password_hash: str | None,          # None for pure Google-only accounts
  provider: "email" | "google" | "both",
  google_sub: str | None (unique, sparse),
  avatar_url: str | None,
  academic_status: "current_student" | "prospective" | None,
  level: str | None,                  # e.g. "100L"
  faculty_id: ObjectId | None,
  department_id: ObjectId | None,
  is_admin: bool,
  is_active: bool,
  onboarding_completed: bool,
  created_at: datetime,
  updated_at: datetime,
}
"""

ACADEMIC_STATUS_VALUES = ("current_student", "prospective")
PROVIDER_VALUES = ("email", "google", "both")
