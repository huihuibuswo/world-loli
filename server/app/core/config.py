from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "斗萝大陆 API"
    environment: str = "development"
    database_url: str
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = Field(default=120, ge=5, le=1440)
    cors_origins: str = "http://localhost:5173"
    ai_enabled: bool = False
    ai_dialogue_enabled: bool = False
    ai_battle_enabled: bool = False
    ai_base_url: str = "https://api.openai.com/v1"
    ai_api_key: SecretStr | None = None
    ai_model: str = ""
    ai_dialogue_timeout_seconds: float = Field(default=8, ge=1, le=30)
    ai_battle_timeout_seconds: float = Field(default=2, ge=0.5, le=10)
    ai_max_input_chars: int = Field(default=500, ge=50, le=2000)
    ai_max_reply_chars: int = Field(default=400, ge=50, le=2000)
    ai_memory_recent_turns: int = Field(default=8, ge=2, le=20)
    ai_memory_summary_chars: int = Field(default=1200, ge=200, le=4000)
    ai_memory_retention_days: int = Field(default=90, ge=1, le=3650)
    ai_dialogue_min_interval_seconds: float = Field(default=1.5, ge=0, le=60)
    ai_blocked_terms: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def ai_blocked_term_list(self) -> list[str]:
        return [item.strip().casefold() for item in self.ai_blocked_terms.split(",") if item.strip()]

    @property
    def ai_configured(self) -> bool:
        return bool(self.ai_api_key and self.ai_model.strip() and self.ai_base_url.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
