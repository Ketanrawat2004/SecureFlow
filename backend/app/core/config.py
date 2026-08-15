import json
import os
from typing import Any, List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Core
    APP_NAME: str = "SecureFlow"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "secureflow-dev-secret-key-change-in-production-min-32-chars-long"
    JWT_SECRET_KEY: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def assemble_secret_key(cls, v: Any) -> str:
        return os.getenv("JWT_SECRET_KEY") or (str(v) if v else "secureflow-dev-secret-key-change-in-production-min-32-chars-long")

    # Network / Host
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                try:
                    return json.loads(v_str)
                except Exception:
                    pass
            return [i.strip() for i in v_str.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(i).strip() for i in v]
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ]

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./secureflow.db"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "secureflow"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 120

    # Kafka
    KAFKA_BROKERS: str = "localhost:9092"
    KAFKA_BOOTSTRAP_SERVERS: Optional[str] = None
    KAFKA_CLIENT_ID: str = "secureflow-backend"
    KAFKA_GROUP_ID: str = "secureflow-consumers"
    KAFKA_ENABLED: bool = True

    @field_validator("KAFKA_BROKERS", mode="before")
    @classmethod
    def assemble_kafka_brokers(cls, v: Optional[str]) -> str:
        return os.getenv("KAFKA_BOOTSTRAP_SERVERS") or v or "localhost:9092"

    # Google OAuth — supply via environment variables, never hardcode
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    OAUTH_REDIRECT_URI: str = "http://localhost:3000/auth/callback"

    # Seed data config
    AUTO_SEED_DATABASE: bool = True


settings = Settings()
