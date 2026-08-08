/**
 * Top-level client component. Orchestrates health checks, prediction
 * requests, demo-mode live streaming, and the clinical dashboard layout.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  HealthResponse,
  PredictRequest,
  PredictResponse,
} from "@/lib/types";
import { ApiError, health, predict } from "@/lib/api";
import { perturbSample } from "@/lib/demo";
import { downloadFhirReport } from "@/lib/fhir";
import { ActivityIcon } from "./icons";
import { HealthBadge } from "./HealthBadge";
import { FeatureInput } from "./FeatureInput";
import { LiveVitals } from "./LiveVitals";
import { ResultsPanel } from "./ResultsPanel";
import { PatientHistory } from "./PatientHistory";
import { Chatbox } from "./Chatbox";
import { ModelEvaluation } from "./ModelEvaluation";

type HealthStatus = "checking" | "ok" | "degraded" | "offline";
type ViewMode = "clinician" | "patient";

const HEALTH_POLL_MS = 20_000;
const DEMO_PREDICT_MS = 5_000;

/**
 * Critical-threshold for the SOS alert. The synthetic placeholder model can
 * only reach ~93.6% Stress confidence, so 0.90 keeps the alert demonstrable
 * during the live demo while remaining clinically meaningful. Raise to 0.95
 * once a real WESAD model is deployed.
 */
const CRITICAL_CONFIDENCE = 0.90;

export default function StressConsole() {
  /* ---- health ---- */
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("checking");

  /* ---- prediction ---- */
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [running, setRunning] = useState(false);

  /* ---- demo mode ---- */
  const [demoMode, setDemoMode] = useState(false);
  const demoTick = useRef(0);

  /* ---- active tab ---- */
  const [activeTab, setActiveTab] = useState<"live" | "history" | "evaluation">("live");

  /* ---- dual persona ---- */
  const [viewMode, setViewMode] = useState<ViewMode>("clinician");

  /* ---- SOS critical alert ---- */
  const [sosDismissed, setSosDismissed] = useState(false);
  const prevCritical = useRef(false);

  /* ---- health polling ---- */
  const refreshHealth = useCallback(async () => {
    try {
      const h = await health();
      setHealthData(h);
      setHealthStatus(
        h.status === "ok" && h.model_loaded ? "ok" : "degraded",
      );
    } catch {
      setHealthData(null);
      setHealthStatus("offline");
    }
  }, []);

  useEffect(() => {
    // Poll-once-then-interval. refreshHealth is async: its setState calls
    // run only after `await health()`, so they are not synchronous with the
    // effect body — the rule flags the call site regardless.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshHealth();
    const id = setInterval(refreshHealth, HEALTH_POLL_MS);
    return () => clearInterval(id);
  }, [refreshHealth]);

  /* ---- manual prediction ---- */
  const handleSubmit = useCallback(async (req: PredictRequest) => {
    setRunning(true);
    setError(null);
    try {
      const res = await predict(req);
      setResult(res);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("network", "Unexpected error — please try again."),
      );
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, []);

  /* ---- demo mode: auto-predict every 5 s ---- */
  useEffect(() => {
    if (!demoMode) return;

    // Run immediately, then every 5 s
    const tick = async () => {
      try {
        const features = perturbSample(demoTick.current);
        demoTick.current += 1;
        const res = await predict({ features, session_id: "demo-live" });
        setResult(res);
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err
            : new ApiError("network", "Demo prediction failed."),
        );
      }
    };

    tick(); // immediate first prediction
    const id = setInterval(tick, DEMO_PREDICT_MS);
    return () => clearInterval(id);
  }, [demoMode]);

  /* ---- print report (client-only date to avoid hydration mismatch) ---- */
  const [reportDate, setReportDate] = useState<Date | null>(null);
  // Rendering the placeholder first, then setting the date after mount, is
  // the standard hydration-safe pattern for client-only values (the date
  // would otherwise differ between server and client renders).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setReportDate(new Date()), []);
  const handlePrint = () => window.print();

  /* ---- SOS critical alert ---- */
  const confidence =
    result && result.prediction
      ? (result.probabilities[result.prediction] ?? 0)
      : 0;
  const isCritical =
    !!result && result.prediction === "Stress" && confidence > CRITICAL_CONFIDENCE;

  // Re-arm the banner whenever a NEW critical episode starts (not per tick).
  // The state write only happens on a false→true transition, so it is not a
  // per-render cascade.
  useEffect(() => {
    if (isCritical && !prevCritical.current) setSosDismissed(false);
    prevCritical.current = isCritical;
  }, [isCritical]);

  /* ---- FHIR export ---- */
  const handleExportFhir = () => {
    if (result) downloadFhirReport(result);
  };

  return (
    <div
      className={
        "mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 " +
        (isCritical ? "sos-critical" : "")
      }
    >
      {/* ---- Critical Alert banner (screen-only) ---- */}
      {isCritical && !sosDismissed && (
        <div className="no-print sos-banner">
          <span className="sos-banner-icon" aria-hidden="true">
            ⚠️
          </span>
          <span className="sos-banner-text">
            CRITICAL ALERT: Stress threshold exceeded. Automated SOS protocol
            engaged.
          </span>
          <button
            type="button"
            onClick={() => setSosDismissed(true)}
            className="sos-banner-close"
            aria-label="Dismiss critical alert"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              className="h-3.5 w-3.5"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/*  PRINT-ONLY report header (hidden on screen)                  */}
      {/* ============================================================ */}
      <div className="print-only hidden mb-6 border-b-2 border-gray-300 pb-4">
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "Georgia, serif",
            color: "#111",
            marginBottom: 4,
          }}
        >
          Clinical Stress Assessment Report
        </h1>
        <p style={{ fontSize: 12, color: "#555" }}>
          Stress Detection Console · WESAD ECG/PPG · Generated{" "}
          {reportDate ? reportDate.toLocaleString() : ""}
        </p>
        {healthData && (
          <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
            Backend model: {healthData.model_class ?? "N/A"} ·{" "}
            {healthData.n_features} features · Classes:{" "}
            {healthData.classes?.join(", ")}
          </p>
        )}
      </div>

      {/* ============================================================ */}
      {/*  HEADER (screen-only)                                         */}
      {/* ============================================================ */}
      <header className="no-print mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 font-serif text-xl font-semibold tracking-tight text-ink">
            <ActivityIcon className="h-5 w-5 text-accent" />
            Stress Detection Console
          </h1>
          <p className="mt-0.5 text-[12px] text-faint">
            WESAD · ECG / PPG feature inference · Clinical Decision Support
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* ---- Dual-persona toggle ---- */}
          <div
            className="no-print flex items-center gap-1 rounded-lg border border-edge bg-raised p-1"
            role="tablist"
            aria-label="View mode"
          >
            <ViewToggle
              active={viewMode === "clinician"}
              onClick={() => setViewMode("clinician")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              Clinician
            </ViewToggle>
            <ViewToggle
              active={viewMode === "patient"}
              onClick={() => {
                setViewMode("patient");
                if (activeTab === "evaluation") {
                  setActiveTab("live");
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
              </svg>
              Patient
            </ViewToggle>
          </div>

          <button
            type="button"
            onClick={handleExportFhir}
            disabled={!result}
            className="no-print inline-flex items-center gap-2 rounded-lg border border-edge bg-raised px-3.5 py-1.5 text-[11px] font-medium text-dim transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            title="Export current prediction as an HL7 FHIR Observation"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M12 18v-6" />
              <path d="M9 15l3 3 3-3" />
            </svg>
            Export to EMR (FHIR)
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="no-print inline-flex items-center gap-2 rounded-lg border border-edge bg-raised px-3.5 py-1.5 text-[11px] font-medium text-dim transition-colors hover:border-accent/40 hover:text-ink"
            title="Download Clinical Report (Print / PDF)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M6 9V2h12v7" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Clinical Report
          </button>
          <HealthBadge
            health={healthData}
            status={healthStatus}
            onRefresh={refreshHealth}
          />
        </div>
      </header>

      {/* ============================================================ */}
      {/*  TAB BAR (screen-only)                                        */}
      {/* ============================================================ */}
      <div className="no-print mb-6 flex gap-1 rounded-lg border border-edge bg-raised p-1 w-fit">
        <TabButton
          active={activeTab === "live"}
          onClick={() => setActiveTab("live")}
        >
          <ActivityIcon className="h-3.5 w-3.5" />
          Live Console
        </TabButton>
        <TabButton
          active={activeTab === "history"}
          onClick={() => setActiveTab("history")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M3 3v18h18" />
            <rect x="7" y="10" width="3" height="7" rx="0.5" />
            <rect x="12" y="6" width="3" height="11" rx="0.5" />
            <rect x="17" y="13" width="3" height="4" rx="0.5" />
          </svg>
          Patient History
        </TabButton>
        {viewMode === "clinician" && (
          <TabButton
            active={activeTab === "evaluation"}
            onClick={() => setActiveTab("evaluation")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Model Evaluation
          </TabButton>
        )}
      </div>

      {/* ============================================================ */}
      {/*  MAIN CONTENT                                                */}
      {/* ============================================================ */}
      <main className="flex-1 pb-12">
        {activeTab === "live" ? (
          /* ---- LIVE CONSOLE: left (input + vitals) | right (results) ---- */
          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <div className="flex flex-col gap-6">
              <div className="no-print">
                <FeatureInput
                  nFeatures={healthData?.n_features ?? null}
                  running={running}
                  demoMode={demoMode}
                  onDemoToggle={() => setDemoMode((d) => !d)}
                  onSubmit={handleSubmit}
                />
              </div>
              <LiveVitals key={String(demoMode)} active={demoMode} />
            </div>

            <ResultsPanel
              result={result}
              error={error}
              running={running}
              viewMode={viewMode}
            />
          </div>
        ) : activeTab === "history" ? (
          /* ---- PATIENT HISTORY ---- */
          <PatientHistory />
        ) : viewMode === "clinician" ? (
          /* ---- MODEL EVALUATION MATRIX (Clinician Only) ---- */
          <ModelEvaluation />
        ) : (
          /* ---- PATIENT FALLBACK: LIVE CONSOLE ---- */
          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <div className="flex flex-col gap-6">
              <div className="no-print">
                <FeatureInput
                  nFeatures={healthData?.n_features ?? null}
                  running={running}
                  demoMode={demoMode}
                  onDemoToggle={() => setDemoMode((d) => !d)}
                  onSubmit={handleSubmit}
                />
              </div>
              <LiveVitals key={String(demoMode)} active={demoMode} />
            </div>

            <ResultsPanel
              result={result}
              error={error}
              running={running}
              viewMode={viewMode}
            />
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/*  FOOTER (screen-only)                                         */}
      {/* ============================================================ */}
      <footer className="no-print border-t border-edge py-4 text-center text-[11px] text-faint">
        Backend{" "}
        <code className="rounded bg-raised px-1.5 py-0.5 font-mono">
          POST /predict
        </code>{" "}
        · Classes: Baseline / Stress / Amusement / Meditation ·{" "}
        <a
          className="text-dim underline-offset-2 hover:text-ink hover:underline"
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenAPI docs
        </a>
      </footer>

      {/* ============================================================ */}
      {/*  PRINT-ONLY report footer (hidden on screen)                  */}
      {/* ============================================================ */}
      <div className="print-only hidden mt-8 border-t border-gray-300 pt-3 text-center">
        <p style={{ fontSize: 10, color: "#999" }}>
          Generated by Stress Detection Console · WESAD Clinical Decision
          Support System ·{" "}
          {reportDate
            ? reportDate.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : ""}
        </p>
        <p style={{ fontSize: 9, color: "#bbb", marginTop: 2 }}>
          This report is generated by an AI-assisted clinical decision support
          tool and does not constitute a medical diagnosis.
        </p>
      </div>

      {/* ============================================================ */}
      {/*  GLOBAL — floating chat assistant (hidden in print)           */}
      {/* ============================================================ */}
      <Chatbox result={result} viewMode={viewMode} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  View-mode toggle button                                            */
/* ------------------------------------------------------------------ */

function ViewToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors " +
        (active
          ? "bg-accent/15 text-accent"
          : "text-faint hover:bg-raised/60 hover:text-dim")
      }
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab bar button                                                     */
/* ------------------------------------------------------------------ */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12px] font-medium transition-colors " +
        (active
          ? "bg-accent/15 text-accent"
          : "text-faint hover:bg-raised/60 hover:text-dim")
      }
    >
      {children}
    </button>
  );
}
