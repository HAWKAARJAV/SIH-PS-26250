"""Runtime configuration. Secrets come from the environment, never from source."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/vyuha.db"
    demo_mode: bool = False
    jwt_secret: str = "dev-only-change-me"
    access_ttl_min: int = 15
    refresh_ttl_days: int = 7
    cookie_secure: bool = True
    idle_timeout_min: int = 15
    demo_password: str = "Vyuha-demo-2026"


_current: Settings | None = None


def set_settings(settings: Settings) -> None:
    global _current
    _current = settings


def get_settings() -> Settings:
    return _current or Settings()
