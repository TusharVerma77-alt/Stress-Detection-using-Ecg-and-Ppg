/**
 * Emergency Tele-Consult modal. Shows a short "generating secure link"
 * state, then reveals a mock Google-Meet-style consultation URL.
 */

"use client";

import { useEffect, useState } from "react";
import { SpinnerIcon, CheckIcon } from "./icons";

const MOCK_MEET_URL = "https://meet.google.com/stress-cons-4821";

export function TeleHealthModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"generating" | "ready">("generating");

  // The parent keys this modal by `open`, so it remounts fresh each time it
  // is opened with `phase = "generating"`; this effect only schedules the
  // flip to "ready" (async setState — allowed by the hooks lint rule).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setPhase("ready"), 1800);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Emergency tele-health consultation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-edge bg-surface shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between border-b border-edge px-5 py-3.5">
          <h2 className="font-serif text-[15px] font-semibold text-ink">
            Emergency Tele-Consult
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-faint transition-colors hover:bg-raised hover:text-ink"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-6">
          {phase === "generating" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <SpinnerIcon className="h-8 w-8 text-accent" />
              <p className="text-[13px] text-dim">
                Generating secure tele-health link…
              </p>
              <p className="max-w-[240px] text-[11px] leading-relaxed text-faint">
                Establishing an encrypted connection to the on-call
                cardiologist.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
                <CheckIcon className="h-6 w-6 text-green-400" />
              </div>
              <p className="text-[13px] text-ink">
                Secure consultation link ready —{" "}
                <span className="font-medium text-stress">
                  join within 5 minutes
                </span>
              </p>
              <div className="w-full rounded-lg border border-edge bg-raised px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-faint">
                  Tele-health room
                </div>
                <a
                  href={MOCK_MEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all font-mono text-[13px] text-accent hover:underline"
                >
                  {MOCK_MEET_URL}
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-faint">
                <span>🔒 End-to-end encrypted</span>
                <span>👨‍⚕️ Cardiologist on-call</span>
                <span>⏱️ 24/7 available</span>
              </div>
              <button
                onClick={onClose}
                className="mt-1 rounded-lg border border-edge bg-raised px-4 py-2 text-[12px] font-medium text-dim transition-colors hover:border-accent/40 hover:text-ink"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
