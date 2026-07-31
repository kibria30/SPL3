import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / ".env"), extra="ignore")

    # Peer-auth local connection by default (no password needed for the `kibria` OS user) --
    # override via .env / DATABASE_URL env var for any other environment.
    database_url: str = "postgresql+psycopg2:///tsf_forecasting_app"

    jwt_secret: str = "dev-secret-change-me-in-.env-CHANGE-THIS-BEFORE-DEPLOY"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24 * 7  # 7 days

    storage_dir: Path = BACKEND_DIR / "storage"

    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()

os.makedirs(settings.storage_dir / "datasets" / "system", exist_ok=True)
os.makedirs(settings.storage_dir / "datasets" / "user", exist_ok=True)
os.makedirs(settings.storage_dir / "experiments", exist_ok=True)
