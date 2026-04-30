from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    PORT: int = 3000
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    ENCRYPTION_KEY: str  # 32-byte hex
    CORS_ORIGIN: str = "http://localhost:5173"
    NODE_ENV: str = "development"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7


settings = Settings()
