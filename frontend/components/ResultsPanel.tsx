/**
 * Right-hand results column. Composes the prediction callout, probability
 * gauge, SHAP bar chart, and a model-metadata footer. Gracefully degrades
 * to an error banner or a placeholder when there is no result yet.
 */

import type { PredictResponse } from "@/lib/types";
import type { ApiError } from "@/lib/api";
import { classColor } from "@/lib/theme";
import { Card } from "./Card";
import { ProbabilityPanel } from "./ProbabilityPanel";
import { ShapChart } from "./ShapChart";
import { ShapTranslation } from "./ShapTranslation";
import { InterventionPanel } from "./InterventionPanel";
import { SpinnerIcon, AlertIcon } from "./icons";

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function ResultsPanel({
  result,
  error,
  running,
  viewMode = "clinician",
}: {
  result: PredictResponse | null;
  error: ApiError | null;
  running: boolean;
  viewMode?: "clinician" | "patient";
}) {
  if (error) return <ErrorCard error={error} />;
  if (!result) return <Placeholder running={running} />;

  const isPatient = viewMode === "patient";
  const color = classColor(result.prediction);
  const confidence = result.probabilities[result.prediction] ?? 0;

  return (
    <div className={`flex flex-col gap-6 ${isPatient ? "items-center" : ""}`}>
      {/* ---- Prediction callout ---- */}
      <Card
        title={isPatient ? "Your Stress Level" : "Prediction"}
        subtitle={
          isPatient
            ? "Current assessment from your live vitals"
            : `${result.model.type} · ${result.model.n_features} features · ${result.model.scaler ? "scaled" : "raw"}`
        }
        actions={isPatient ? undefined : <RequestId id={result.request_id} />}
        className={isPatient ? "w-full max-w-2xl text-center" : ""}
      >
        <div
          className={
            "flex items-baseline justify-center gap-3 " +
            (isPatient ? "flex-col items-center" : "")
          }
        >
          <span
            className="inline-block rounded-md px-4 py-1 font-serif text-2xl font-semibold tracking-tight"
            style={{ background: color + "18", color }}
          >
            {result.prediction}
          </span>
          <span className="font-mono text-sm tabular-nums text-dim">
            {(confidence * 100).toFixed(1)}% confidence
          </span>
        </div>

        {/* Gauges are clinician tooling — hidden in patient view. */}
        {!isPatient && (
          <ProbabilityPanel
            prediction={result.prediction}
            probabilities={result.probabilities}
          />
        )}
      </Card>

      {isPatient ? (
        /* ---- PATIENT VIEW: calm, centered guidance ---- */
        <>
          <div className="w-full max-w-2xl">
            <InterventionPanel result={result} />
          </div>
          <div className="w-full max-w-2xl">
            <ShapTranslation
              topFeatures={result.top_features}
              prediction={result.prediction}
            />
          </div>
        </>
      ) : (
        /* ---- CLINICIAN VIEW: full detail ---- */
        <>
          <InterventionPanel result={result} />

          <Card
            title="Feature attribution (SHAP)"
            subtitle="Top contributing features for this prediction"
            actions={
              <span className="text-[11px] text-faint" title="SHAP base value (model expected log-odds for predicted class)">
                base = {result.base_value.toFixed(4)}
              </span>
            }
          >
            <ShapChart
              topFeatures={result.top_features}
              prediction={result.prediction}
            />
            <ShapTranslation
              topFeatures={result.top_features}
              prediction={result.prediction}
            />
          </Card>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Error banner                                                       */
/* ------------------------------------------------------------------ */

function ErrorCard({ error }: { error: ApiError }) {
  return (
    <Card
      title="Prediction"
      subtitle="The request failed"
      actions={
        <span className="rounded-md bg-stress/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stress">
          Error
        </span>
      }
    >
      <div className="flex items-start gap-3 rounded-lg border border-stress/20 bg-stress/5 px-4 py-3">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-stress" />
        <div className="min-w-0">
          <p className="text-sm text-ink">{error.message}</p>
          {error.status != null && (
            <p className="mt-1 text-[11px] text-faint">
              HTTP {error.status}
              {error.kind === "network" && " (network / CORS)"}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state / loading indicator                                    */
/* ------------------------------------------------------------------ */

function Placeholder({ running }: { running: boolean }) {
  return (
    <Card title="Prediction" subtitle="Awaiting a feature vector">
      <div className="flex flex-col items-center gap-3 py-8 text-center text-faint">
        {running ? (
          <SpinnerIcon className="h-8 w-8 text-accent" />
        ) : (
          <span className="text-3xl opacity-30">⬡</span>
        )}
        <p className="max-w-xs text-sm leading-relaxed">
          {running
            ? "Running inference and computing SHAP values…"
            : "Enter a feature vector and click Run prediction to see results here."}
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Tiny helpers                                                       */
/* ------------------------------------------------------------------ */

function RequestId({ id }: { id: string }) {
  return (
    <code className="rounded bg-raised px-2 py-0.5 text-[10px] text-faint">
      {id.slice(0, 8)}
    </code>
  );
}
