from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Database / Redis ---
    # psycopg3 drayveri sync va async uchun bir xil URL ishlatadi
    database_url: str = "postgresql+psycopg://voltage_user:CHANGEME@localhost:5432/voltage"
    redis_url: str = "redis://localhost:6379/1"

    # --- Auth / JWT ---
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12 soat

    # --- Bootstrap admin (startupda yaratiladi, agar berilgan bo'lsa) ---
    admin_username: str | None = None
    admin_password: str | None = None
    admin_email: str | None = None

    # --- Tarmoq ---
    tcp_port: int = 5001          # ESP32 xom TCP listener
    http_port: int = 5000         # FastAPI/uvicorn
    cors_origins: str = "*"       # vergul bilan ajratilgan ro'yxat yoki "*"

    # --- Frontend (React build) ---
    frontend_dist: Path = BASE_DIR.parent / "VoltageFronend" / "dist"

    # --- Yuklangan rasmlar ---
    media_dir: Path = BASE_DIR / "media"
    max_image_bytes: int = 5 * 1024 * 1024  # 5 MB

    # Redis pub/sub kanali
    events_channel: str = "voltage:events"

    @property
    def cors_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
