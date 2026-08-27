from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ML_", extra="ignore")

    model_mode: str = "heuristic"  # heuristic | pretrained
    service_port: int = 8010
    max_image_dimension: int = 2048  # downscale larger images before analysis


settings = Settings()
