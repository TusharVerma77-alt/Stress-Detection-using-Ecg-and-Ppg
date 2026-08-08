"""
schemas.py — Pydantic request/response models.
Field names mirror frontend/lib/types.ts exactly.
"""
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field


# ── Prediction ──────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    features: list[float] = Field(..., description="Ordered ECG/PPG feature vector")
    session_id: str | None = Field(None, description="Client trace identifier (echoed)")
    request_id: str | None = Field(None, description="Client request id; generated if omitted")


class FeatureAttribution(BaseModel):
    name: str
    shap_value: float
    importance: float  # |shap_value| / sum(|all shap values|)


class ModelMeta(BaseModel):
    type: str
    n_features: int
    classes: list[str]
    scaler: bool


class PredictResponse(BaseModel):
    prediction: str
    probabilities: dict[str, float]
    top_features: list[FeatureAttribution]
    base_value: float
    model: ModelMeta
    request_id: str


# ── Health ──────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str                    # "ok" | "degraded"
    model_loaded: bool
    model_class: str | None = None
    n_features: int | None = None
    classes: list[str] | None = None
    shap_available: bool | None = None


# ── Chat ────────────────────────────────────────────────────────────────────

class ChatContext(BaseModel):
    prediction: str | None = None
    confidence: float | None = None
    top_feature: str | None = None
    shap_value: float | None = None
    importance: float | None = None


class ChatRequest(BaseModel):
    message: str
    context: ChatContext | None = None


class ChatResponse(BaseModel):
    response: str
    agent: str
    agent_label: str
    message_id: str
