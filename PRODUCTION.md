# 🚀 WESAD Production Deployment Guide

This guide details the complete production deployment procedures for the WESAD Affect Recognition & Stress Detection platform.

---

## 🏗️ Architecture Overview

The system consists of two primary services:
1. **FastAPI Backend (Port 8000)**: Serves ML inference (`/predict`), SHAP feature attributions, readiness probe (`/health`), and LLM Biomedical Assistant (`/chat`).
2. **Next.js 14 Frontend (Port 3000)**: Interactive clinical dashboard built with React & Recharts.

---

## ⚡ Option A: Docker Compose Deployment (Recommended)

### Prerequisites
- Docker Engine 24.0+
- Docker Compose v2+

### Quick Start Commands
```bash
# Clone repository and navigate to root
cd "final project"

# Configure Backend environment variables
cp backend/.env.example backend/.env
# Edit backend/.env and set GROQ_API_KEY / OPENAI_API_KEY

# Build and start services in detached mode
docker compose up --build -d

# Check running status and health checks
docker compose ps
```

- **Frontend Dashboard**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **Health Check**: `http://localhost:8000/health`

---

## 🌐 Option B: Manual Server Deployment

### 1. Backend Server Setup (Gunicorn / Uvicorn)

```bash
cd backend

# Create production virtual environment
python -m venv venv
source venv/bin/activate  # Linux/macOS
# .\venv\Scripts\Activate.ps1 # Windows

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run with Gunicorn (Linux/macOS Production)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# OR run with Uvicorn multi-worker (Windows / Cross-platform)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 2. Frontend Server Setup (Next.js Production Build)

```bash
cd frontend

# Install Node dependencies
npm ci

# Build static & standalone bundle
npm run build

# Start production Node server
npm run start
```

---

## 🧪 Automated Testing & Verification

### Running Backend Unit & Integration Tests
```bash
cd backend
# Run full Pytest suite covering /health, /predict, /chat, and security headers
pytest -v
```

### Running Frontend Linting & Production Build
```bash
cd frontend
# Run ESLint verification
npm run lint

# Build production standalone bundle
npm run build
```

---

## 🔐 Production Hardening Checklist

- [x] **CORS Origins**: Configured via `STRESS_CORS_ORIGINS` environment variable to restrict domain cross-origin requests.
- [x] **Security Headers**: Enabled `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, and `Referrer-Policy` headers.
- [x] **Container Hardening**: Configured non-root system users (`appuser` in backend, `nextjs` in frontend) for production container execution.
- [x] **Automated Test Suite**: 5 unit/integration tests (`pytest`) covering API endpoints, input validation, and security headers.
- [x] **Global Error Handling**: Unhandled internal exceptions return standardized 500 error responses without exposing raw stack traces.
- [x] **Health Probe**: Readiness probe available at `GET /health` for Kubernetes / Docker container health checks.

