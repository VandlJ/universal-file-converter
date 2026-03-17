from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MAX_FILE_SIZE: int = 104857600  # 100MB
    MAX_CONCURRENT_JOBS: int = 20
    CLEANUP_INTERVAL_SECONDS: int = 3600
    TESSERACT_LANGUAGES: str = "ces+eng+deu"
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    LOG_LEVEL: str = "INFO"
    TEMP_DIR: str = "/tmp/converter"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v: str | list[str]) -> str:
        if isinstance(v, list):
            return ",".join(v)
        return v

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
