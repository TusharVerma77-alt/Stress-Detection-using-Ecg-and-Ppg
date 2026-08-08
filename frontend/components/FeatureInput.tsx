/**
 * Data-entry panel: a JSON textarea, a "Load sample" button, and a CSV
 * upload. Validates locally and fires `onSubmit` with a clean PredictRequest.
 */

"use client";

import { useRef, useState } from "react";
import type { PredictRequest } from "@/lib/types";
import {
  generateDemoSample,
  parseJsonInput,
  parseCsvText,
} from "@/lib/features";
import { Card } from "./Card";
import { SpinnerIcon, UploadIcon } from "./icons";

export function FeatureInput({
  nFeatures,
  running,
  demoMode,
  onDemoToggle,
  onSubmit,
}: {
  nFeatures: number | null;
  running: boolean;
  demoMode: boolean;
  onDemoToggle: () => void;
  onSubmit: (req: PredictRequest) => void;
}) {
  const [text, setText] = useState<string>(() =>
    JSON.stringify(generateDemoSample(), null, 2),
  );
  const [sessionId, setSessionId] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [fileSummary, setFileSummary] = useState<{
    name: string;
    count: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---- CSV upload handler ---- */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const csv = await file.text();
      const targetCount = nFeatures ?? 78;
      const result = parseCsvText(csv, targetCount);
      if (result.error) {
        setLocalError(result.error);
        return;
      }
      setText(JSON.stringify(result.features, null, 2));
      setFileSummary({ name: file.name, count: result.features!.length });
      setLocalError(null);

      // Auto-run prediction on newly uploaded CSV reading
      onSubmit({
        features: result.features!,
        session_id: sessionId || file.name,
      });
    } catch {
      setLocalError("Failed to read the uploaded file.");
    }
    // Reset the input so re-uploading the same file still fires change.
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ---- Load a known-good sample ---- */
  const loadSample = () => {
    const sample = generateDemoSample();
    setText(JSON.stringify(sample, null, 2));
    setFileSummary(null);
    setLocalError(null);
  };

  /* ---- Validate + submit ---- */
  const handleSubmit = () => {
    const parsed = parseJsonInput(text);
    if (parsed.error) {
      setLocalError(parsed.error);
      return;
    }
    if (nFeatures !== null && parsed.features!.length !== nFeatures) {
      setLocalError(
        `The loaded model expects ${nFeatures} features, but you provided ${parsed.features!.length}.`,
      );
      return;
    }
    setLocalError(null);
    onSubmit({
      features: parsed.features!,
      session_id: sessionId || null,
    });
  };

  return (
    <Card
      title="Feature Input"
      subtitle="Paste JSON or upload a CSV of ECG / PPG features"
    >
      {/* ---- Toolbar ---- */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={loadSample}
          className="rounded-lg border border-edge bg-raised px-3 py-1.5 text-[11px] font-medium text-dim transition-colors hover:border-accent/40 hover:text-ink"
        >
          Load sample
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-edge bg-raised px-3 py-1.5 text-[11px] font-medium text-dim transition-colors hover:border-accent/40 hover:text-ink">
          <UploadIcon className="h-3.5 w-3.5" />
          Upload CSV
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFile}
            className="sr-only"
          />
        </label>
        {fileSummary != null && (
          <span className="text-[11px] text-faint">
            {fileSummary.name} — {fileSummary.count} features parsed
          </span>
        )}
        {/* ---- Demo Live Stream toggle ---- */}
        <button
          type="button"
          onClick={onDemoToggle}
          className={
            "ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors " +
            (demoMode
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-edge bg-raised text-dim hover:border-accent/40 hover:text-ink")
          }
        >
          {demoMode && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
          )}
          {demoMode ? "Stop Demo" : "Demo Live Stream"}
        </button>
      </div>

      {/* ---- JSON textarea ---- */}
      <textarea
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setLocalError(null);
        }}
        rows={14}
        className={
          "w-full resize-y rounded-lg border bg-raised px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none transition-colors " +
          (localError
            ? "border-stress/50 focus:border-stress"
            : "border-edge focus:border-accent/50")
        }
        placeholder='{"features": [0.72, 1.15, ...]}'
      />

      {/* ---- Errors ---- */}
      {localError != null && (
        <p className="mt-2 text-[12px] text-stress">{localError}</p>
      )}

      {/* ---- Session + Submit ---- */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-[11px] text-faint">
          Session ID (optional)
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="e.g. subject-S2"
            className="mt-1 block w-48 rounded-lg border border-edge bg-raised px-3 py-1.5 text-[12px] text-dim outline-none focus:border-accent/50"
          />
        </label>
        {demoMode && (
          <span className="ml-auto text-[11px] text-faint">
            Features generated automatically — auto-predicting every 5 s
          </span>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={running || demoMode}
          className={
            demoMode
              ? "ml-auto inline-flex items-center gap-2 rounded-lg bg-line/50 px-5 py-2 text-[12px] font-semibold text-faint cursor-not-allowed opacity-50"
              : "ml-auto inline-flex items-center gap-2 rounded-lg bg-accent/90 px-5 py-2 text-[12px] font-semibold text-[#070a0e] transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          }
        >
          {running ? (
            <>
              <SpinnerIcon className="h-3.5 w-3.5" />
              Running…
            </>
          ) : (
            "Run prediction"
          )}
        </button>
      </div>
    </Card>
  );
}
