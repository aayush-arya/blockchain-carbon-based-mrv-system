from typing import Literal

from pydantic import BaseModel, Field

EcosystemCode = Literal["mangrove", "seagrass", "salt_marsh"]
ModelMode = Literal["heuristic", "pretrained"]


class AnalysisExplanation(BaseModel):
    ecosystem_scores: dict[str, float] = Field(..., description="Per-ecosystem similarity scores, sum to 1.")
    features: dict[str, float] = Field(..., description="Extracted image features used for classification.")
    coverage_method: str
    coverage_threshold_used: float
    coverage_mean_index: float


class AnalyzeResponse(BaseModel):
    model_name: str
    model_mode: ModelMode
    predicted_ecosystem: EcosystemCode
    confidence: float = Field(..., ge=0, le=1)
    vegetation_coverage_pct: float = Field(..., ge=0, le=100)
    inference_ms: int
    warnings: list[str]
    explanation: AnalysisExplanation


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_mode: ModelMode
    model_name: str
