/**
 * "AI Insight" box that translates the top SHAP feature into plain English,
 * with native speech-synthesis accessibility (🔊 Listen).
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureAttribution } from "@/lib/types";
import { featureDescription } from "@/lib/demo";
import { SparklesIcon } from "./icons";

export function ShapTranslation({
  topFeatures,
  prediction,
}: {
  topFeatures: FeatureAttribution[];
  prediction: string;
}) {
  const top = topFeatures[0];
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  /* Clean up any ongoing speech on unmount. */
  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  if (!top) return null;

  const desc = featureDescription(top.name);
  const direction = top.shap_value >= 0 ? "higher" : "lower";
  const absVal = Math.abs(top.shap_value);

  /* ---- Plain-English summary (also used for TTS) ---- */
  const summary =
    `The primary biomarker driving this ${prediction} classification is ` +
    `${top.name}, ${desc.short}. Its ${direction} value, SHAP contribution ` +
    `${top.shap_value >= 0 ? "plus " : "minus "}${absVal.toFixed(4)}, ` +
    `contributed ${(top.importance * 100).toFixed(1)} percent toward this ` +
    `prediction. ${desc.detail}`;

  /* ---- Toggle speech synthesis ---- */
  const toggleSpeech = () => {
    if (!("speechSynthesis" in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utt = new SpeechSynthesisUtterance(summary);
    utt.rate = 1.0;
    utt.pitch = 1.0;
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utt;
    window.speechSynthesis.speak(utt);
    setIsSpeaking(true);
  };

  return (
    <div className="mt-4 rounded-lg border border-accent/20 bg-accent/[0.05] px-4 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <SparklesIcon className="h-4 w-4 text-accent" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          AI Insight
        </span>

        {/* ---- Voice accessibility button ---- */}
        <button
          type="button"
          onClick={toggleSpeech}
          className={
            "ml-auto inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors " +
            (isSpeaking
              ? "border-stress/40 bg-stress/10 text-stress"
              : "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20")
          }
          title={isSpeaking ? "Stop reading" : "Listen to this insight"}
          aria-pressed={isSpeaking}
        >
          {isSpeaking ? (
            <>
              <StopIcon className="h-3 w-3" />
              Stop
            </>
          ) : (
            <>
              <SpeakerIcon className="h-3 w-3" />
              Listen
            </>
          )}
        </button>
      </div>

      <p className="text-[12px] leading-relaxed text-dim">
        The primary biomarker driving this{" "}
        <strong className="text-ink">{prediction}</strong> classification is{" "}
        <strong className="text-ink font-mono text-[11px]">{top.name}</strong>{" "}
        ({desc.short}).{" "}
        <span className="text-faint">
          Its{" "}
          <span
            className="font-medium"
            style={{
              color: top.shap_value >= 0 ? "#5b9bff" : "#f0726d",
            }}
          >
            {direction} value
          </span>{" "}
          (SHAP contribution: {top.shap_value >= 0 ? "+" : ""}
          {absVal.toFixed(4)}) contributed{" "}
          {(top.importance * 100).toFixed(1)}% toward this prediction.
        </span>
      </p>

      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        {desc.detail}
      </p>

      {topFeatures.length > 1 && (
        <p className="mt-2 text-[10px] text-faint/70">
          Other contributing markers:{" "}
          {topFeatures
            .slice(1, 3)
            .map((f) => f.name)
            .join(", ")}
          .
        </p>
      )}
    </div>
  );
}

/* ---- Icons ---- */

function SpeakerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function StopIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      {...props}
    >
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}
