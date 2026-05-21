from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    LINE_CHANNEL_SECRET: str
    LINE_CHANNEL_ACCESS_TOKEN: str

    OPENAI_API_KEY: str

    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

    model_config = SettingsConfigDict(env_file='.env')

settings = Settings()
