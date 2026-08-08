/**
 * ModelEvaluation.tsx
 * -------------------------------------------------------
 * Displays the stored evaluation matrix from final13.json:
 *   - Accuracy / Precision / Recall / F1 scorecards
 *   - Confusion matrix heatmap
 *   - Per-class metrics bar chart
 *   - Top feature importances ranked bar chart
 */

"use client";

import { useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  Static data from final13.json                                      */
/* ------------------------------------------------------------------ */

const MODEL_META = {
  project_title: "WESAD Physiological Affect Recognition (85 Features)",
  model_type: "XGBoost Classifier (Baseline-Normalized, n_est=300)",
  n_samples: 982,
  n_features: 85,
};

const METRICS = {
  accuracy: 0.8216,
  precision: 0.8372,
  recall: 0.7329,
  f1_score: 0.7526,
};

const LABELS = ["Baseline", "Stress", "Amusement", "Meditation"];

/** Row-major confusion matrix: actual x predicted */
const CONF_MATRIX = [
  [398, 5, 3, 5],
  [41, 114, 11, 14],
  [48, 6, 52, 18],
  [20, 5, 2, 240],
];

const FEATURE_IMPORTANCES = [
  { feature: "pulse_amplitude_std", importance: 0.0593 },
  { feature: "ecg_wav_energy_L3", importance: 0.0525 },
  { feature: "ppg_variance", importance: 0.0509 },
  { feature: "ppg_energy", importance: 0.0308 },
  { feature: "resp_interval_iqr", importance: 0.0236 },
  { feature: "ppg_wav_energy_L0", importance: 0.0234 },
  { feature: "ecg_sqi", importance: 0.0222 },
  { feature: "mean_rr", importance: 0.0198 },
  { feature: "ecg_std", importance: 0.0194 },
  { feature: "ppg_app_entropy", importance: 0.0193 },
  { feature: "ecg_sampen", importance: 0.0182 },
  { feature: "ecg_wav_energy_L4", importance: 0.0181 },
  { feature: "ppg_iqr", importance: 0.0181 },
  { feature: "ecg_wav_energy_L1", importance: 0.0168 },
  { feature: "ecg_perm_entropy", importance: 0.0154 },
];

/* ------------------------------------------------------------------ */
/*  Per-class derived metrics                                          */
/* ------------------------------------------------------------------ */

function computePerClassMetrics() {
  return LABELS.map((label, i) => {
    const tp = CONF_MATRIX[i][i];
    const fp = CONF_MATRIX.reduce((s, row, r) => s + (r !== i ? row[i] : 0), 0);
    const fn = CONF_MATRIX[i].reduce((s, v, c) => s + (c !== i ? v : 0), 0);
    const precision = tp / (tp + fp || 1);
    const recall = tp / (tp + fn || 1);
    const f1 = (2 * precision * recall) / (precision + recall || 1);
    const support = CONF_MATRIX[i].reduce((s, v) => s + v, 0);
    return { label, precision, recall, f1, support };
  });
}

/* ------------------------------------------------------------------ */
/*  Colour helpers                                                     */
/* ------------------------------------------------------------------ */

function heatColor(v: number) {
  const r = Math.round(20 + v * 91);
  const g = Math.round(40 + v * 100);
  const b = Math.round(80 + v * 175);
  return `rgba(${r},${g},${b},${0.18 + v * 0.72})`;
}

const CLASS_COLORS = [
  "#5b9bff",
  "#f0726d",
  "#e0b15c",
  "#7ecb95",
];

/* ------------------------------------------------------------------ */
/*  ScoreCard                                                          */
/* ------------------------------------------------------------------ */

function ScoreCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub?: string;
  color: string;
}) {
  const pct = Math.round(value * 1000) / 10;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dash = (value * circumference).toFixed(2);
  const gap = (circumference - parseFloat(dash)).toFixed(2);

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-edge bg-raised p-5 transition-shadow hover:shadow-lg hover:shadow-black/20">
      <div className="relative">
        <svg width={100} height={100} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={50}
            cy={50}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={8}
          />
          <circle
            cx={50}
            cy={50}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center"
        >
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color, filter: "brightness(1.3)" }}
          >
            {pct}%
          </span>
        </div>
      </div>
      <p className="text-[13px] font-semibold text-ink">{label}</p>
      {sub && <p className="text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ConfusionMatrix                                                    */
/* ------------------------------------------------------------------ */

function ConfusionMatrix() {
  const maxVal = Math.max(...CONF_MATRIX.flat());
  const rowTotals = CONF_MATRIX.map((row) => row.reduce((s, v) => s + v, 0));

  return (
    <div className="rounded-2xl border border-edge bg-raised p-5">
      <h3 className="mb-1 text-[13px] font-semibold text-ink">Confusion Matrix</h3>
      <p className="mb-4 text-[11px] text-faint">Rows = Actual · Columns = Predicted</p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-[11px]">
          <thead>
            <tr>
              <th className="pb-2 pr-2 text-right text-[10px] text-faint font-normal">
                Actual ↓ / Pred →
              </th>
              {LABELS.map((l, i) => (
                <th
                  key={l}
                  className="pb-2 px-1 font-semibold"
                  style={{ color: CLASS_COLORS[i] }}
                >
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONF_MATRIX.map((row, ri) => (
              <tr key={LABELS[ri]}>
                <td
                  className="py-1 pr-3 text-right text-[11px] font-semibold whitespace-nowrap"
                  style={{ color: CLASS_COLORS[ri] }}
                >
                  {LABELS[ri]}
                </td>
                {row.map((val, ci) => {
                  const isTP = ri === ci;
                  const pct = ((val / rowTotals[ri]) * 100).toFixed(1);
                  const bg = heatColor(val / maxVal);
                  return (
                    <td
                      key={ci}
                      className="px-2 py-2"
                      style={{
                        background: bg,
                        borderRadius: 6,
                        border: isTP
                          ? `1px solid ${CLASS_COLORS[ri]}55`
                          : "1px solid transparent",
                      }}
                    >
                      <span
                        className="block text-[13px] font-bold"
                        style={{ color: isTP ? CLASS_COLORS[ri] : "#e8eef4" }}
                      >
                        {val}
                      </span>
                      <span className="block text-[9px] text-faint/80">{pct}%</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PerClassMetricsChart                                               */
/* ------------------------------------------------------------------ */

function PerClassMetricsChart() {
  const perClass = useMemo(() => computePerClassMetrics(), []);

  return (
    <div className="rounded-2xl border border-edge bg-raised p-5">
      <h3 className="mb-1 text-[13px] font-semibold text-ink">Per-Class Metrics</h3>
      <p className="mb-4 text-[11px] text-faint">Precision · Recall · F1 per affect class</p>

      <div className="space-y-5">
        {perClass.map(({ label, precision, recall, f1, support }, i) => (
          <div key={label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-semibold" style={{ color: CLASS_COLORS[i] }}>
                {label}
              </span>
              <span className="text-[10px] text-faint">n = {support}</span>
            </div>
            {[
              { name: "Precision", value: precision, opacity: 1.0 },
              { name: "Recall", value: recall, opacity: 0.7 },
              { name: "F1", value: f1, opacity: 0.5 },
            ].map(({ name, value, opacity }) => (
              <div key={name} className="mb-1.5 flex items-center gap-2">
                <span className="w-16 text-right text-[10px] text-faint">{name}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-base/60 h-2">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${value * 100}%`,
                      background: CLASS_COLORS[i],
                      opacity,
                      transition: "width 0.7s ease",
                    }}
                  />
                </div>
                <span className="w-10 text-right text-[10px] font-mono text-dim tabular-nums">
                  {(value * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FeatureImportanceChart                                             */
/* ------------------------------------------------------------------ */

function FeatureImportanceChart() {
  const maxImp = FEATURE_IMPORTANCES[0].importance;

  return (
    <div className="rounded-2xl border border-edge bg-raised p-5">
      <h3 className="mb-1 text-[13px] font-semibold text-ink">Top Feature Importances</h3>
      <p className="mb-4 text-[11px] text-faint">
        XGBoost gain-based importance · Top 15 of 85 features
      </p>

      <div className="space-y-[7px]">
        {FEATURE_IMPORTANCES.map(({ feature, importance }, idx) => {
          const barPct = ((importance / maxImp) * 100).toFixed(1);
          const hue = Math.round(210 - (idx / (FEATURE_IMPORTANCES.length - 1)) * 40);
          const barColor = `hsl(${hue}, 80%, 65%)`;

          return (
            <div key={feature} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-[9px] text-faint/60 tabular-nums">
                {idx + 1}
              </span>
              <span className="w-44 shrink-0 truncate text-[11px] text-dim font-mono">
                {feature}
              </span>
              <div className="flex-1 overflow-hidden rounded-full bg-base/60 h-[6px]">
                <div
                  className="h-[6px] rounded-full"
                  style={{
                    width: `${barPct}%`,
                    background: barColor,
                    transition: "width 0.7s ease",
                  }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-[10px] font-mono text-faint tabular-nums">
                {(importance * 100).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chip helper                                                        */
/* ------------------------------------------------------------------ */

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-edge bg-base/60 px-3 py-1.5 text-center">
      <p className="text-[9px] uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-0.5 text-[12px] font-semibold text-ink">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function ModelEvaluation() {
  return (
    <div className="space-y-6 pb-12">
      {/* ── Model info banner ── */}
      <div className="rounded-2xl border border-edge bg-raised px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Model Evaluation Matrix</h2>
            <p className="mt-0.5 text-[11px] text-faint">{MODEL_META.project_title}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Chip label="Model" value={MODEL_META.model_type} />
            <Chip label="Samples" value={MODEL_META.n_samples.toLocaleString()} />
            <Chip label="Features" value={String(MODEL_META.n_features)} />
            <Chip label="Classes" value="4" />
          </div>
        </div>
      </div>

      {/* ── Score cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ScoreCard label="Accuracy" value={METRICS.accuracy} sub="Overall" color="#5b9bff" />
        <ScoreCard label="Precision" value={METRICS.precision} sub="Macro avg" color="#7ecb95" />
        <ScoreCard label="Recall" value={METRICS.recall} sub="Macro avg" color="#e0b15c" />
        <ScoreCard label="F1 Score" value={METRICS.f1_score} sub="Macro avg" color="#c784f7" />
      </div>

      {/* ── Confusion matrix + per-class metrics ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ConfusionMatrix />
        <PerClassMetricsChart />
      </div>

      {/* ── Feature importances ── */}
      <FeatureImportanceChart />

      {/* ── Interpretation note ── */}
      <div className="rounded-2xl border border-edge bg-raised/50 px-5 py-4">
        <h4 className="mb-2 text-[12px] font-semibold text-dim">Interpretation Notes</h4>
        <ul className="list-disc space-y-1.5 pl-4 text-[11px] text-faint">
          <li>
            <span className="font-medium" style={{ color: "#5b9bff" }}>Baseline</span> is
            classified with very high accuracy (398/411 = 96.8%) — the resting physiological
            state is highly distinct after per-subject baseline normalization.
          </li>
          <li>
            <span className="font-medium" style={{ color: "#f0726d" }}>Stress</span> detection
            achieves 63.3% recall (114/180) — false-negatives remain the primary clinical risk;
            the SOS protocol fires at &gt;90% Stress confidence to minimize missed events.
          </li>
          <li>
            <span className="font-medium" style={{ color: "#e0b15c" }}>Amusement</span> is the
            hardest class (F1 ≈ 54%) with 42.0% recall — physiological overlap with Meditation
            and Baseline causes 48 misclassifications as Baseline. Recall improved significantly
            vs. the prior model due to balanced class weighting during training.
          </li>
          <li>
            <span className="font-medium" style={{ color: "#7ecb95" }}>Meditation</span> recall
            is 89.9% (240/267), the strongest non-Baseline class — baseline normalization
            made its HRV deceleration pattern highly separable.{" "}
            <code className="rounded bg-raised px-1 py-0.5 font-mono text-[10px]">
              resp_interval_iqr
            </code>{" "}
            remains a key discriminating feature.
          </li>
          <li>
            <span className="font-medium text-dim">pulse_amplitude_std</span> is the single
            most predictive feature (5.93% gain), reflecting beat-to-beat amplitude variability
            in the PPG signal. Model trained with 5-fold GroupKFold cross-validation.
          </li>
        </ul>
      </div>
    </div>
  );
}
