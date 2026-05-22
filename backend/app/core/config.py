from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"


class Settings(BaseSettings):
    LINE_CHANNEL_SECRET: str
    LINE_CHANNEL_ACCESS_TOKEN: str

    OPENAI_API_KEY: str

    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
    )


settings = Settings()