from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "UI Freshers Companion API"
    environment: str = "development"
    debug: bool = True
    frontend_url: str = "http://localhost:5173"

    # MongoDB
    mongodb_uri: str
    mongodb_db_name: str = "uifreshers"

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # Google OAuth
    google_client_id: str = ""

    # CORS
    allowed_origins: str = "http://localhost:5173"

    # Admin bootstrap
    admin_bootstrap_email: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
