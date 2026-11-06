"""
Roamly AI — Core Configuration
All settings loaded from environment variables.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator
import json


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "Roamly AI"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    BACKEND_PORT: int = 8000

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [i.strip() for i in v.split(",")]
        return v

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://roamly:roamly_password@localhost:5432/roamly_db"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SECONDS: int = 3600

    # Security / JWT
    JWT_SECRET: str = "change_this_secret_key_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    FIREBASE_PROJECT_ID: str = "curecast-468bb"

    # Gemini / Google AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    GEMINI_EMBEDDING_DIMENSIONS: int = 768
    GEMINI_MAX_TOKENS: int = 8192
    GEMINI_TEMPERATURE: float = 0.7

    # Google Maps & Places
    MAPS_API_KEY: str = ""
    GOOGLE_MAPS_API_KEY: str = ""
    GOOGLE_PLACES_API_KEY: str = ""
    MAPS_BASE_URL: str = "https://maps.googleapis.com/maps/api"

    # Voice API
    VOICE_API_BASE_URL: str = ""
    VOICE_API_KEY: str = ""

    # Weather API
    WEATHER_API_KEY: str = ""
    WEATHER_API_BASE_URL: str = "https://api.openweathermap.org/data/2.5"

    # SerpApi (Live Web Search)
    SERPAPI_API_KEY: str = ""
    SERPAPI_ENGINE: str = "google"
    SERPAPI_TIMEOUT_SECONDS: int = 15
    SERPAPI_CACHE_TTL_SECONDS: int = 1800

    # Amadeus Travel API
    AMADEUS_CLIENT_ID: str = ""
    AMADEUS_CLIENT_SECRET: str = ""
    AMADEUS_BASE_URL: str = "https://test.api.amadeus.com"

    # Hotel & Restaurant API
    HOTEL_API_KEY: str = ""
    HOTEL_API_BASE_URL: str = ""
    RESTAURANT_API_KEY: str = ""
    RESTAURANT_API_BASE_URL: str = ""

    # Cache TTLs (seconds)
    CACHE_TTL_PLACES: int = 86400         # 24 hours
    CACHE_TTL_SEARCH: int = 1800          # 30 minutes
    CACHE_TTL_WEATHER: int = 900          # 15 minutes
    CACHE_TTL_HOTEL_AVAILABILITY: int = 300 # 5 minutes
    CACHE_TTL_ROUTES: int = 900           # 15 minutes
    CACHE_TTL_EVENTS: int = 3600          # 1 hour


    # Storage
    STORAGE_BUCKET: str = "roamly-assets"
    STORAGE_URL: str = ""

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # MLflow
    MLFLOW_TRACKING_URI: str = "http://localhost:5001"

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    AI_RATE_LIMIT_PER_MINUTE: int = 20

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


settings = Settings()
