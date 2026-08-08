/**
 * Prediction confidence gauge (Recharts RadialBarChart) plus per-class
 * horizontal progress bars. Gives the clinician an at-a-glance read on
 * all three class probabilities.
 */

import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { classColor } from "@/lib/theme";

export function ProbabilityPanel({
  prediction,
  probabilities,
}: {
  prediction: string;
  probabilities: Record<string, number>;
}) {
  const confidence = probabilities[prediction] ?? 0;
  const color = classColor(prediction);

  const gaugeData = [
    {
      name: prediction,
      value: Math.round(confidence * 10_000) / 100,
    },
  ];

  return (
    <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
      {/* ---- Semicircle gauge ---- */}
      <div className="relative h-44 w-full shrink-0 sm:w-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={gaugeData}
            innerRadius="72%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            barSize={18}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <RadialBar
              dataKey="value"
              fill={color}
              cornerRadius={8}
              background={{ fill: "#1a212b" }}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Centre label overlays the arc. */}
        <div className="absolute inset-x-0 bottom-0.5 text-center">
          <div
            className="text-2xl font-semibold tabular-nums"
            style={{ color }}
          >
            {gaugeData[0].value.toFixed(1)}%
          </div>
          <div className="text-[10px] uppercase tracking-widest text-faint">
            confidence
          </div>
        </div>
      </div>

      {/* ---- Per-class progress bars ---- */}
      <div className="flex-1 space-y-3">
        {Object.entries(probabilities)
          .sort(([, a], [, b]) => b - a)
          .map(([name, p]) => (
            <div key={name}>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 text-dim">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: classColor(name) }}
                  />
                  {name}
                </span>
                <span className="font-mono tabular-nums text-ink">
                  {(p * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/40">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${p * 100}%`,
                    background: classColor(name),
                  }}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
