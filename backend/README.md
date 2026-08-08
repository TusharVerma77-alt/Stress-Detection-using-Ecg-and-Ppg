# WESAD Stress Detection — Backend

FastAPI backend serving the WESAD XGBoost physiological affect recognition model.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Readiness probe + model metadata |
| `POST` | `/predict` | 85-feature vector → prediction + SHAP |
| `POST` | `/chat` | LLM-powered Biomedical Expert chatbot |
| `GET`  | `/docs` | Interactive Swagger UI |

## Setup

```bash
cd backend
pip install -r requirements.txt
```

## Run

```bash
# From the backend/ directory
uvicorn app.main:app --reload --port 8000
```

The frontend expects the backend at `http://localhost:8000` (set via `NEXT_PUBLIC_API_URL`).

## Model

The backend automatically resolves the model file in this order:
1. `WESAD_MODEL_PATH` environment variable
2. `../final12.joblib` (project root)
3. `../final_project_model.joblib` (project root)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WESAD_MODEL_PATH` | *(auto)* | Path to the `.joblib` model file |
| `STRESS_CORS_ORIGINS` | `http://localhost:3000,...` | Comma-separated allowed origins |
| `GROQ_API_KEY` | *(none)* | **Required** for `/chat` — enables the Biomedical Expert Agent (Groq is fast & OpenAI-compatible) |
| `OPENAI_API_KEY` | *(none)* | Alternate LLM key (used only if `GROQ_API_KEY` is unset) |
| `LLM_MODEL` | *per-provider* | Chat model (`llama-3.3-70b-versatile` on Groq, `gpt-4o-mini` on OpenAI) |
| `LLM_BASE_URL` | *auto* | Explicit OpenAI-compatible endpoint override |
| `LLM_TIMEOUT_SECONDS` | `25` | Per-request LLM timeout (kept under the frontend's 30s) |

Copy `backend/.env.example` to `backend/.env` and set `GROQ_API_KEY` (or
`OPENAI_API_KEY`) to enable chat:

```bash
cp .env.example .env   # then edit .env
```

If no LLM key is set, `/chat` returns a graceful `503` message to the chatbox
instead of crashing — the rest of the API keeps working.

## Quick test

```bash
# Health check
curl http://localhost:8000/health

# Prediction (85 zeros — just for structure test)
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d "{\"features\": $(python -c "print([0.0]*85)")}"
```
