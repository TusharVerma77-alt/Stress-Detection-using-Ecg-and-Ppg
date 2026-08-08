"""
main.py — FastAPI application entry point.

Endpoints
─────────
GET  /health    → HealthResponse
POST /predict   → PredictResponse  (SHAP explainability included)
POST /chat      → ChatResponse     (LLM-backed Biomedical Expert Agent)

Run with:
    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager

import numpy as np
import openai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .model_loader import FEATURE_NAMES, get_bundle
from .schemas import (
    ChatRequest,
    ChatResponse,
    FeatureAttribution,
    HealthResponse,
    ModelMeta,
    PredictRequest,
    PredictResponse,
)
from .services.multi_agent import AgentUnavailableError, get_agent

# ── logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s │ %(name)s │ %(message)s")
logger = logging.getLogger(__name__)

# ── lifespan: warm up model at startup ───────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        get_bundle()
        logger.info("Model loaded successfully at startup.")
    except Exception as exc:  # noqa: BLE001
        logger.error("Model failed to load: %s", exc)
    yield


# ── app ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="WESAD Stress Detection API",
    description=(
        "XGBoost-based physiological affect recognition (Baseline / Stress / "
        "Amusement / Meditation) trained on the WESAD dataset with 85 ECG/PPG/Resp features."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
_cors_raw = os.getenv(
    "STRESS_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001",
)
_cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error("Unhandled Exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return HTTPException(
        status_code=500,
        detail="An internal server error occurred. Please contact system administrator."
    )



# ─────────────────────────────────────────────────────────────────────────────
#  GET /health
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["infra"])
def health() -> HealthResponse:
    """Readiness probe — returns model metadata so the frontend can sanity-check."""
    try:
        b = get_bundle()
        return HealthResponse(
            status="ok",
            model_loaded=True,
            model_class=b.model_class,
            n_features=b.n_features,
            classes=b.classes,
            shap_available=b.shap_available,
        )
    except Exception:  # noqa: BLE001
        return HealthResponse(status="degraded", model_loaded=False)


# ─────────────────────────────────────────────────────────────────────────────
#  POST /predict
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/predict", response_model=PredictResponse, tags=["inference"])
def predict(req: PredictRequest) -> PredictResponse:
    """
    Accept an 85-feature ECG/PPG/Resp vector and return:
    - Predicted affect class
    - Class probabilities
    - Top-10 SHAP feature attributions
    - Model metadata
    """
    b = get_bundle()

    # Validate feature count
    n_expected = b.n_features
    if len(req.features) != n_expected:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Expected {n_expected} features, got {len(req.features)}. "
                "Ensure the vector matches the model's training feature order."
            ),
        )

    # Run inference
    label, prob_dict, shap_vals, base_value = b.predict(req.features)

    # Build SHAP attributions
    top_features: list[FeatureAttribution] = []
    if shap_vals is not None:
        abs_shap = np.abs(shap_vals)
        total = float(abs_shap.sum()) or 1.0
        # top-10 by absolute SHAP
        top_idx = np.argsort(abs_shap)[::-1][:10]
        for i in top_idx:
            feat_name = FEATURE_NAMES[i] if i < len(FEATURE_NAMES) else f"feature_{i}"
            top_features.append(
                FeatureAttribution(
                    name=feat_name,
                    shap_value=float(shap_vals[i]),
                    importance=float(abs_shap[i] / total),
                )
            )

    request_id = req.request_id or str(uuid.uuid4())

    return PredictResponse(
        prediction=label,
        probabilities=prob_dict,
        top_features=top_features,
        base_value=base_value,
        model=ModelMeta(
            type=b.model_class,
            n_features=b.n_features,
            classes=b.classes,
            scaler=False,
        ),
        request_id=request_id,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  POST /chat  (LLM-backed Biomedical Expert Agent)
# ─────────────────────────────────────────────────────────────────────────────

# Keep the LLM call comfortably inside the frontend's 30s request timeout.
_CHAT_TIMEOUT_SECONDS = 25.0


@app.post("/chat", response_model=ChatResponse, tags=["assistant"])
async def chat(req: ChatRequest) -> ChatResponse:
    """
    Biomedical Expert Agent (LLM-backed). Answers any ECG/PPG/HRV/stress
    question in real time and personalizes replies with the live dashboard
    context (Predicted Class, SHAP biomarkers) when provided.
    """
    agent = get_agent()

    if not agent.available:
        logger.warning("Chat requested but no LLM API key is set.")
        raise HTTPException(
            status_code=503,
            detail=(
                "The AI assistant isn't configured yet — no LLM API key was found. "
                "Set GROQ_API_KEY (or OPENAI_API_KEY) in backend/.env "
                "(see backend/.env.example) and restart the server."
            ),
        )

    try:
        response_text = await asyncio.wait_for(
            agent.respond(req.message, req.context),
            timeout=_CHAT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.warning("Chat request timed out after %.0fs.", _CHAT_TIMEOUT_SECONDS)
        raise HTTPException(
            status_code=504,
            detail="The AI assistant took too long to respond. Please try again.",
        ) from None
    except (openai.AuthenticationError, openai.PermissionDeniedError) as exc:
        logger.warning("OpenAI %s: %s", type(exc).__name__, exc)
        raise HTTPException(
            status_code=503,
            detail="The AI assistant couldn't authenticate with the model provider. "
            "Please check GROQ_API_KEY / OPENAI_API_KEY and try again.",
        ) from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit hit: %s", exc)
        raise HTTPException(
            status_code=429,
            detail="The AI assistant is busy (rate limit). Please wait a moment and try again.",
        ) from exc
    except (openai.APIConnectionError, openai.APITimeoutError) as exc:
        logger.warning("OpenAI connection error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not reach the AI model provider. Please check your connection and try again.",
        ) from exc
    except openai.APIError as exc:
        logger.warning("OpenAI API error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="The AI assistant hit a temporary error. Please try again.",
        ) from exc
    except AgentUnavailableError as exc:
        logger.warning("Agent unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error in /chat")
        raise HTTPException(
            status_code=500,
            detail="The AI assistant encountered an unexpected error. Please try again.",
        )

    return ChatResponse(
        response=response_text,
        agent="biomedical-expert",
        agent_label="Biomedical Expert",
        message_id=str(uuid.uuid4()),
    )
