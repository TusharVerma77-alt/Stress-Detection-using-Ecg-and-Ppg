/**
 * Dynamic actionable-interventions panel. Shows class-specific clinical
 * recommendations, with an animated deep-breathing guide when Stress is
 * detected.
 */

"use client";

import { useEffect, useState } from "react";
import type { PredictResponse } from "@/lib/types";
import { interventionFor, type Recommendation } from "@/lib/demo";
import { Card } from "./Card";
import { TeleHealthModal } from "./TeleHealthModal";

export function InterventionPanel({ result }: { result: PredictResponse }) {
  const { severity, label, accent, recommendations } = interventionFor(
    result.prediction,
  );
  const [teleOpen, setTeleOpen] = useState(false);
  const isStress = severity === "urgent";

  return (
    <Card
      title="Clinical Recommendations"
      subtitle={label}
      actions={
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ background: accent + "18", color: accent }}
        >
          {result.prediction}
        </span>
      }
    >
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <RecommendationRow key={rec.title} rec={rec} severity={severity} />
        ))}
      </div>

      {/* Breathing guide — only for Stress */}
      {isStress && <BreathingGuide accent={accent} />}

      {/* Emergency tele-consult — only for Stress */}
      {isStress && (
        <button
          type="button"
          onClick={() => setTeleOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-stress/90 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-stress/20 transition-all hover:bg-stress"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          Emergency Tele-Consult
        </button>
      )}

      <TeleHealthModal
        key={String(teleOpen)}
        open={teleOpen}
        onClose={() => setTeleOpen(false)}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Recommendation row                                                 */
/* ------------------------------------------------------------------ */

function RecommendationRow({
  rec,
  severity,
}: {
  rec: Recommendation;
  severity: string;
}) {
  const borderColor =
    severity === "urgent"
      ? rec.urgent
        ? "border-stress/30"
        : "border-edge"
      : "border-edge";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border bg-raised/50 px-3.5 py-2.5 ${borderColor}`}
    >
      <span className="mt-0.5 text-base">{rec.icon}</span>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-ink">{rec.title}</div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-dim">
          {rec.description}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  4-7-8 Breathing guide (animated expanding circle)                  */
/* ------------------------------------------------------------------ */

function BreathingGuide({ accent }: { accent: string }) {
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale">(
    "inhale",
  );
  const [count, setCount] = useState<number>(4);

  useEffect(() => {
    // 4 s inhale → 7 s hold → 8 s exhale → loop
    const DURATIONS = { inhale: 4, hold: 7, exhale: 8 } as const;
    const NEXT = { inhale: "hold", hold: "exhale", exhale: "inhale" } as const;
    let current: "inhale" | "hold" | "exhale" = "inhale";
    let remaining: number = DURATIONS[current];

    const id = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        current = NEXT[current];
        remaining = DURATIONS[current];
      }
      setPhase(current);
      setCount(remaining);
    }, 1000);

    return () => clearInterval(id);
  }, []);

  const LABELS = {
    inhale: "Breathe in …",
    hold: "Hold …",
    exhale: "Breathe out …",
  };

  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-stress/15 bg-stress/[0.04] py-5">
      {/* Breathing circle */}
      <div className="relative flex items-center justify-center">
        <div
          className="breathe-circle h-20 w-20 rounded-full border-2 opacity-70"
          style={{ borderColor: accent }}
        />
        <div
          className="breathe-circle absolute h-16 w-16 rounded-full opacity-30"
          style={{
            borderColor: accent,
            animationDelay: "0.1s",
          }}
        />
      </div>
      <div className="text-center">
        <div className="text-[12px] font-medium text-ink">
          {LABELS[phase]}
        </div>
        <div className="font-mono text-2xl font-bold tabular-nums text-stress">
          {count}
        </div>
        <div className="text-[10px] text-faint">4-7-8 Breathing Technique</div>
      </div>
    </div>
  );
}
