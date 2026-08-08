# 🖥️ WESAD Affect Recognition — Next.js 14 Frontend

Interactive clinical and research web console for real-time WESAD physiological affect recognition, SHAP explainability, model diagnostics, and biomedical AI chat.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Ensure `NEXT_PUBLIC_API_URL` points to your backend instance (default `http://localhost:8000`).

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Project Structure

```
frontend/
├── app/
│   ├── globals.css          # Custom styling & Tailwind directives
│   ├── layout.tsx           # Main application root layout & fonts
│   └── page.tsx             # Main page entrypoint rendering <StressConsole />
├── components/
│   ├── StressConsole.tsx    # Primary dashboard controller & state manager
│   ├── LiveVitals.tsx       # Live simulated waveform & vital signs monitor
│   ├── FeatureInput.tsx     # 85-feature vector input form with subject/affect presets
│   ├── ModelEvaluation.tsx  # ML performance suite (Confusion Matrix, ROC, Metrics)
│   ├── ShapChart.tsx        # SHAP feature importance bar visualization
│   ├── ShapTranslation.tsx  # Natural language clinical translation of SHAP values
│   ├── Chatbox.tsx          # Real-time Biomedical AI Assistant chat interface
│   ├── InterventionPanel.tsx# Affect-based evidence-based clinical intervention protocols
│   ├── PatientHistory.tsx   # Historical session log & trend analysis
│   ├── TeleHealthModal.tsx  # Specialist tele-consultation simulation
│   ├── HealthBadge.tsx      # Backend API health indicator badge
│   ├── ProbabilityPanel.tsx # Class probability gauge breakdown
│   ├── ResultsPanel.tsx     # Affect prediction status banner
│   └── Card.tsx             # Standard UI card container
└── lib/
    ├── api.ts               # FastAPI client wrappers (/predict, /health, /chat)
    ├── demo.ts              # Dataset sample vectors & subject presets
    ├── features.ts          # Feature name metadata & grouped domain categories
    ├── fhir.ts              # HL7 FHIR R4 JSON Exporter (Observation & DiagnosticReport)
    ├── mockData.ts          # Default baseline mock responses
    ├── theme.ts             # Affect color palette constants
    └── types.ts             # TypeScript interface declarations
```

---

## ⚡ Available NPM Scripts

- `npm run dev`: Starts the Next.js development server on port 3000.
- `npm run build`: Compiles the Next.js production build.
- `npm run start`: Starts the Next.js production server.
- `npm run lint`: Runs ESLint check across all TypeScript/React source files.

---

## 🩺 FHIR R4 Export Integration

Clicking the **"Export FHIR R4 JSON"** button in the top navigation header generates a standard HL7 FHIR bundle containing:
1. `Patient` resource record.
2. `Observation` resource for vital signs (`LOINC 8684-3`).
3. `DiagnosticReport` resource containing ML model predictions and SHAP biomarker evidence.
