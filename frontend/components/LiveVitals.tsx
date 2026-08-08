/**
 * Simulated scrolling ECG + PPG waveforms using Recharts LineChart.
 *
 * Generates a parametric PQRST complex (ECG) and a systolic/dicrotic
 * photoplethysmography pulse at ~72 bpm with natural RR variability.
 * Designed to look convincing on a hackathon projector.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const BUFFER = 160;
const TICK_MS = 70; // ≈ 14 fps
const BASELINE = 0.833; // seconds per beat (~72 bpm)

/* ---- Gaussian helper ---- */
function gauss(x: number, mu: number, sigma: number): number {
  const d = (x - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

/* ---- Synthetic waveforms ---- */
function ecgPhase(phase: number, noise: number): number {
  return (
    0.12 * gauss(phase, 0.12, 0.02) + // P wave
    -0.06 * gauss(phase, 0.19, 0.005) + // Q dip
    0.88 * gauss(phase, 0.22, 0.004) + // R peak
    -0.1 * gauss(phase, 0.26, 0.006) + // S dip
    0.16 * gauss(phase, 0.4, 0.03) + // T wave
    noise
  );
}

function ppgPhase(phase: number, noise: number): number {
  return (
    0.72 * gauss(phase, 0.22, 0.03) + // systolic peak
    0.28 * gauss(phase, 0.36, 0.02) + // dicrotic bump
    0.06 + // baseline offset
    noise
  );
}

export function LiveVitals({ active }: { active: boolean }) {
  const [ecgData, setEcg] = useState<Point[]>([]);
  const [ppgData, setPpg] = useState<Point[]>([]);

  const tRef = useRef(0);
  const phaseRef = useRef(0);
  const periodRef = useRef(BASELINE);

  useEffect(() => {
    if (!active) return;

    // (State is reset automatically when re-activated via the `key` prop.)
    tRef.current = 0;
    phaseRef.current = 0;

    const id = setInterval(() => {
      tRef.current += TICK_MS / 1000;
      phaseRef.current =
        (tRef.current % periodRef.current) / periodRef.current;

      // Slight RR jitter at each new beat cycle
      if (phaseRef.current < 0.08) {
        periodRef.current =
          BASELINE + (Math.random() - 0.5) * 0.06;
      }

      const noise = (Math.random() - 0.5) * 0.012;
      const ecg = ecgPhase(phaseRef.current, noise);
      const ppg = ppgPhase(phaseRef.current, noise * 0.6);
      const idx = Math.floor(tRef.current * 1000 / TICK_MS);

      const pt: Point = { t: idx, ecg, ppg };

      setEcg((prev) => {
        const next = [...prev, pt];
        return next.length > BUFFER ? next.slice(-BUFFER) : next;
      });
      setPpg((prev) => {
        const next = [...prev, pt];
        return next.length > BUFFER ? next.slice(-BUFFER) : next;
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="no-print rounded-xl border border-edge bg-surface shadow-xl shadow-black/20">
      {/* ---- Header ---- */}
      <div className="flex items-center gap-2 border-b border-edge px-4 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-faint">
          Simulated Live Vitals
        </span>
      </div>

      {/* ---- ECG trace ---- */}
      <div className="relative px-2 pt-2">
        <span className="absolute left-3 top-2.5 z-10 rounded bg-surface/80 px-1.5 py-0.5 text-[9px] font-bold text-green-500">
          II
        </span>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ecgData}>
              <YAxis domain={[-0.2, 1.1]} hide />
              <ReferenceLine
                y={0}
                stroke="#1a212b"
                strokeDasharray="3 3"
              />
              <Line
                type="monotone"
                dataKey="ecg"
                stroke="#22c55e"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---- PPG trace ---- */}
      <div className="relative px-2 pb-2">
        <span className="absolute left-3 top-1 z-10 rounded bg-surface/80 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
          PPG
        </span>
        <div className="h-[64px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ppgData}>
              <YAxis domain={[0, 1.15]} hide />
              <ReferenceLine
                y={0.06}
                stroke="#1a212b"
                strokeDasharray="3 3"
              />
              <Line
                type="monotone"
                dataKey="ppg"
                stroke="#f59e0b"
                dot={false}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---- Time scale ---- */}
      <div className="flex justify-between border-t border-edge px-3 py-1 text-[8px] text-faint/60">
        <span>— 5 s window</span>
        <span>~72 bpm</span>
      </div>
    </div>
  );
}

/* Data point type used internally. */
interface Point {
  t: number;
  ecg: number;
  ppg: number;
}
